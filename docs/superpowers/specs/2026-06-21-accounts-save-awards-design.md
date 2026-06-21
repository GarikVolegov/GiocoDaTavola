# Account & salvataggio premi (Fetta 1) — design

**Data:** 2026-06-21
**Stato:** approvato (in attesa di review della spec scritta)
**Tipo:** full-stack (server + client + DB). Prima fetta verticale del sistema account.
**Prereq fatto:** Clerk integrato lato client (vedi memoria `auth-clerk`): `@clerk/react`,
`<ClerkProvider>`, controlli Accedi/UserButton nella nav.

## Obiettivo

Permettere a un utente **registrato (Clerk)** di **salvare i premi** vinti a fine partita
nel proprio profilo e di rivederli in una pagina "I miei premi". Gli account restano
**opzionali**: chi non fa login gioca come oggi (QR + nickname); il salvataggio è additivo.
Questa fetta prova l'intera verticale (auth → server → DB → lettura); risposte/storico/
statistiche sono Fette 2–3.

## Principi & vincoli

- **Server-mediated:** il server è l'autorità (calcola i premi, custodisce i voti). I
  salvataggi avvengono lato server; il browser non scrive sul DB.
- **Privacy:** `GET /api/me/...` ritorna **solo** i dati dell'utente autenticato. Nessun
  dato di un utente è mai esposto ad altri.
- **Degrado grazioso:** se `DATABASE_URL` non è impostata, il salvataggio è un **no-op**
  silenzioso e il gioco funziona identico (coerente con "account opzionale").
- **Stile progetto:** TypeScript; server CommonJS, client ESM; `pg` senza ORM; tabelle via
  `CREATE TABLE IF NOT EXISTS` all'avvio; evitare `any`; gate `typecheck/lint/test/build` verde.

## Schema (Postgres su Railway)

```sql
CREATE TABLE IF NOT EXISTS users (
  clerk_user_id text PRIMARY KEY,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_seen     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS awards (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  clerk_user_id text NOT NULL REFERENCES users(clerk_user_id) ON DELETE CASCADE,
  award_id      text NOT NULL,            -- 'persuasore' | 'banderuola' | 'roccione' | 'sintonia' | 'bastian'
  title         text NOT NULL,
  emoji         text NOT NULL,
  description   text NOT NULL,
  game_code     text NOT NULL,            -- la stanza
  game_mode     text NOT NULL,            -- 'gruppo' | 'duello'
  nickname      text NOT NULL,            -- nome usato in quella partita
  won_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS awards_user_idx ON awards(clerk_user_id, won_at DESC);
```

Le tabelle future (`games`, `answers`, `stats`) si agganceranno a `clerk_user_id`.

## Server

### `server/src/db.ts` (nuovo)
- Esporta un `pg.Pool` creato da `process.env.DATABASE_URL`, oppure `null` se assente.
- `dbEnabled(): boolean`.
- `migrate(): Promise<void>` — esegue lo schema sopra (idempotente). Chiamato all'avvio
  in `index.ts` **solo se** `dbEnabled()`; errori loggati, non fatali.

### `server/src/persistence.ts` (nuovo)
- **Puro & testabile:** `awardsToPersist(room: Room): PersistableAward[]` — prende
  `computeAwards(room)`, e per ogni premio il cui `winner.id` corrisponde a un giocatore
  con `clerkUserId` valorizzato, produce una riga `{ clerkUserId, awardId, title, emoji,
  description, gameCode, gameMode, nickname }`. Filtra i non-loggati. Nessun accesso DB qui.
- **I/O:** `saveAwards(rows: PersistableAward[]): Promise<void>` — upsert `users` +
  insert in `awards`; no-op se `!dbEnabled()` o `rows` vuoto.

### Identità giocatore in memoria
- `Player` (in `rooms.ts`) guadagna `clerkUserId?: string` (assente = anonimo, come oggi
  `isBot?`/`connected?`).
- `RoomStore.setPlayerUser(code, playerId, clerkUserId): boolean` — tagga il giocatore.
  Testabile.

### Clerk lato server (`@clerk/express`)
- `clerkMiddleware()` montato su Express (`CLERK_SECRET_KEY` da env, server-only).
- Un helper `verifyClerkToken(token): Promise<string | null>` (ritorna lo `userId`),
  usato dal flusso socket.

### Wiring in `index.ts`
- Avvio: se `dbEnabled()` → `await migrate()`.
- Nuovo evento socket **`player:identify { token }`**: verifica il token → `userId`;
  recupera `playerId` dalla session table esistente → `rooms.setPlayerUser(code, playerId,
  userId)`. (Solo tagging; nessun dato sensibile in giro.)
- **Salvataggio**: in `advanceAndBroadcast`, quando la fase diventa **`FINAL_AWARDS`**
  (modalità gruppo), `saveAwards(awardsToPersist(room))` (fire-and-forget, errori loggati).
  I 5 premi sono solo della modalità gruppo (`computeAwards` usa `room.stats`); il
  **duello** ha un risultato diverso (persuasioni) e **non** rientra in questa fetta
  (eventuale salvataggio duello = fetta successiva). `awardsToPersist` su una room non-
  gruppo ritorna `[]`, quindi è comunque un no-op innocuo.
- **Identify tardivo:** la stanza resta in memoria nella fase terminale, quindi chi fa
  login **sulla schermata premi** dev'essere salvato retroattivamente. Perciò
  l'handler `player:identify`, **se `room.phase === 'FINAL_AWARDS'`**, dopo aver taggato
  il giocatore richiama `saveAwards(awardsToPersist(room))`. Per evitare doppioni la insert
  usa una chiave naturale (`clerk_user_id, award_id, game_code`) con `ON CONFLICT DO
  NOTHING` (vincolo unico su quei tre campi) → idempotente, sia dal save di fase sia dal
  re-save su identify.
- **API**: `GET /api/me/awards` protetta (`requireAuth()`); `getAuth(req).userId` →
  `SELECT ... FROM awards WHERE clerk_user_id = $1 ORDER BY won_at DESC`. JSON degli premi.

> Aggiungo il vincolo unico: `CREATE UNIQUE INDEX IF NOT EXISTS awards_uniq ON awards(clerk_user_id, award_id, game_code);` per rendere il salvataggio idempotente.

## Client

- **`PlayerApp`**: con `useAuth()` di `@clerk/react`, se loggato ottiene `getToken()` ed
  emette `player:identify { token }` (al join e quando lo stato auth cambia). Così i premi
  si salvano da soli a fine partita.
- **Invito a salvare** (schermata `FINAL_AWARDS`/`FINAL_DUEL` del telefono): `<Show
  when="signed-out">` → testo "Accedi per salvare i tuoi premi 💾" + `SignInButton`
  (modal). Dopo il login l'effetto identify riparte e il server salva.
- **Vista profilo**: nuova rotta **`/profilo`** in `App.tsx`. Da loggati, `fetch
  /api/me/awards` con header `Authorization: Bearer <getToken()>` → lista premi salvati
  (emoji, titolo, descrizione, data, nickname). Da sloggati → invito ad accedere.
  Link alla pagina dal `UserButton` (menu) o un link nella nav.

## Test & verifica

- **Unit (vitest server):** `awardsToPersist` — con una `room` costruita a mano (un
  giocatore con `clerkUserId` che vince un premio, uno anonimo che non viene incluso);
  `setPlayerUser`. Niente DB.
- **Integrazione (ad-hoc, poi rimosso):** script `.mjs`/`.ts` contro un Postgres reale:
  `migrate` crea le tabelle; `saveAwards` scrive e l'idempotenza regge; `GET /api/me/awards`
  con un token Clerk valido ritorna le righe.
- **Gate verde:** `npm run typecheck && npm run lint && npm test && npm run build`.

## Dipendenze nuove

- Server: `pg`, `@types/pg`, `@clerk/express`.
- Nessuna nuova dip client (Clerk già presente).

## Produzione (note, non in questa fetta)

- `railway add --database postgres` (lo faccio io) → `DATABASE_URL` iniettato nel servizio.
- Env Railway: `CLERK_SECRET_KEY` (server), `VITE_CLERK_PUBLISHABLE_KEY` (build client),
  e un'istanza Clerk **production**.

## Non-obiettivi (YAGNI, rinviati)

- Salvataggio **risposte** A/B e **storico partite** → Fetta 2.
- **Statistiche** aggregate → Fetta 3.
- Migrazioni versionate / ORM, ruoli/organizzazioni Clerk, cancellazione account/GDPR UI.
- Sincronizzazione cross-device del profilo oltre a ciò che Clerk già fa.
