# Landing page con scelta Crea / Partecipa

**Data:** 2026-06-20
**Stato:** approvato (in attesa di review finale prima del piano)
**Tipo:** feature solo-client

## Obiettivo

La schermata principale (`/`) oggi mostra direttamente il form di join del
giocatore, senza alcuna introduzione. Vogliamo una **landing** che:

1. introduca brevemente il gioco ("Dibattiti tra amici"), e
2. permetta di iniziare subito scegliendo tra **Crea una partita** (diventare lo
   schermo condiviso / host) e **Partecipa** (entrare dal telefono con un codice).

Il flusso è **tutto in una schermata**: intro in alto, i due pulsanti subito sotto.

## Non-obiettivi (fuori scope)

- Nessuna modifica al server, ai gestori socket o alla logica di gioco. "Crea"
  riusa l'esperienza `/host` esistente (che già crea la stanza); "Partecipa" riusa
  il `player:join` esistente.
- Niente database. Il gioco resta effimero e in memoria (vincolo del progetto:
  *in-memory state, no DB, no accounts*).
- Niente deployment in questa spec. Vedi "Nota produzione (deferita)" in fondo.

## Decisioni di design (dal brainstorm)

- **Flusso:** tutto in una schermata (intro + Crea/Partecipa insieme).
- **"Crea una partita":** questo dispositivo diventa lo **schermo condiviso**
  (host/TV): codice + QR, lobby, conduzione partita — l'attuale `HostApp`.
- **Routing:** router dedicato con `react-router-dom` (scelta esplicita
  dell'utente, alternativa a uno split su pathname o a uno stato interno).
- **Gerarchia pulsanti:** "Crea una partita" = `Button` primary; "Partecipa" =
  `Button` ghost.

## Architettura

### Routing (`react-router-dom`)

Si aggiunge `react-router-dom` come dipendenza client. `client/src/App.tsx` passa
dallo split su `window.location.pathname` a un router esplicito:

| Route   | Componente          | Ruolo |
|---------|---------------------|-------|
| `/`     | `Landing` (nuovo)   | Intro + "Crea una partita" / "Partecipa" |
| `/host` | `HostApp` (invariato) | Schermo condiviso: crea stanza, QR, lobby, conduce |
| `/join` | `PlayerApp` (quasi invariato) | Form codice+nickname → lobby → gioco |

- La navigazione è SPA via `useNavigate` (niente reload). Il socket singleton
  `getSocket()` (`client/src/shared/socket.ts`) persiste tra le schermate, quindi
  passare da `Landing` a `HostApp`/`PlayerApp` non riapre la connessione.
- Il server serve già `index.html` su qualunque route
  (`app.get('*')` in `server/src/index.ts:208`), quindi il refresh su `/host` o
  `/join` regge anche in produzione. In dev, Vite fa historyApiFallback di default.

### URL del QR / deep-link

L'URL di join generato dall'host cambia da `/?room=CODE` a **`/join?room=CODE`**
(aggiornamento di `joinUrl` in `client/src/host/HostApp.tsx:83`), così lo scan del
QR atterra direttamente sul form di join e non sulla landing. L'URL si costruisce
da `window.location.origin`, quindi in produzione diventa automaticamente il
dominio reale — i link sono "veri" senza alcun hardcoding.

`PlayerApp` continua a leggere il codice da `?room=` con `initialCode()`
(`client/src/player/PlayerApp.tsx:20`): funziona identico sotto `/join`, nessuna
modifica a quella funzione.

### Componente `Landing`

Nuovo file `client/src/landing/Landing.tsx` — **presentazionale puro**, nessun
socket. Usa `useNavigate` per le due azioni e compone i componenti del design
system (`Stage`, `Button`); nessuno stile hardcoded, solo `var(--token)`.

Struttura (una schermata, `Stage variant="player"`):

```
┌─────────────────────────────────────┐
│           Dibattiti tra amici        │   h1, font display (Space Grotesk)
│   Il party game dove voti, difendi   │   tagline
│      e cambi idea… se ti convincono. │
│                                      │
│   1 · Vota un dilemma                │   3 mini-step ("come si gioca"),
│   2 · Ascolta le difese              │   testo leggero
│   3 · Cambia idea (o no!)            │
│                                      │
│      [  Crea una partita  ]          │   Button primary, lg → navigate('/host')
│      [     Partecipa      ]          │   Button ghost,  lg → navigate('/join')
│                                      │
│   3–8 giocatori · dal vivo           │   nota footer
└─────────────────────────────────────┘
```

- **"Crea una partita"** → `navigate('/host')` (azione di chi imposta la serata).
- **"Partecipa"** → `navigate('/join')` (chi entra dal telefono col codice).
- I 3 mini-step sono l'"introduce"; tagline + pulsanti sono l'"iniziare subito".

Interfaccia/dipendenze del componente:
- **Cosa fa:** mostra l'intro e instrada verso host o join.
- **Come si usa:** `<Landing />` montato dalla route `/`.
- **Da cosa dipende:** `react-router-dom` (`useNavigate`) + `Stage`/`Button` del
  design system. Nessuna dipendenza da socket o stato di gioco.

### Modifiche a `PlayerApp`

Cambia pochissimo. La schermata iniziale (il `return` finale,
`client/src/player/PlayerApp.tsx:295-359`) oggi ha un titolo "Dibattiti tra amici"
+ "Entra nella stanza dal tuo telefono" sopra il form: quel testo era l'unica
"intro" e ora vive nella `Landing`. Si alleggerisce a un'intestazione breve (es.
"Entra nella partita") mantenendo il form codice+nickname. Lobby, fasi di voto e
difese restano invariate.

## Flusso e casi limite

- **Landing → Crea:** `navigate('/host')` → `HostApp` monta, emette
  `host:createRoom`, mostra codice + QR. ✓
- **Landing → Partecipa:** `navigate('/join')` → `PlayerApp`, form vuoto, codice
  digitato a mano. ✓
- **Deep-link QR** `/join?room=CODE`: atterra su `PlayerApp`, codice precompilato,
  salta la landing — garantito dalla route, nessuna logica extra. ✓
- **Refresh** su `/host` o `/join`: il server serve `index.html`, il router
  rimonta la route corretta. L'host che fa refresh ricrea una stanza nuova
  (comportamento già esistente, fuori scope).
- **Vecchi link `/?room=CODE`:** ora atterrano sulla `Landing` (il `?room=` è
  ignorato lì). Non li preserviamo: è solo sviluppo, nessun utente reale. Nessun
  redirect aggiunto (codice in più per un caso che non serve).

## Testing / verifica

Intervento solo-client; nessun nuovo evento socket.

- Gate qualità verde end-to-end:
  `npm run typecheck && npm run lint && npm test && npm run build`. I test server
  non sono toccati e restano verdi.
- Non esiste test runner client in questo progetto (pattern documentato in
  `progress.txt`). La `Landing` è presentazionale pura: si verifica con
  typecheck/lint/build + check manuale, non con unit test — eccezione dichiarata
  dal progetto al TDD-by-test lato client.
- Check manuali:
  - `/` mostra intro + due pulsanti.
  - "Crea" → `/host` con codice+QR (stanza creata).
  - "Partecipa" → `/join` con form.
  - `/join?room=ABCD` precompila il codice e salta la landing.
  - Refresh su `/host` e `/join` regge.

## Nota produzione (deferita — NON implementata in questa spec)

Decisione registrata dal brainstorm, da affrontare in un brainstorm separato:

- **Hosting:** statico React/Vite su Vercel **+ server Socket.IO su un host con
  processi persistenti** (Render / Railway / Fly.io). Vercel serverless non regge
  WebSocket server long-lived né i timer `setTimeout` lato server, quindi il
  server non può girare lì così com'è.
- **Postgres:** escluso per design. Il gioco è effimero (stanze usa-e-getta, nessun
  account, nessun vincitore); un DB non serve per il funzionamento né per avere
  link reali. Diventerebbe rilevante solo per persistere qualcosa di specifico
  (storico, dilemmi custom, statistiche) — non è il caso ora.
- **Link reali in produzione:** già garantiti da questo design, perché QR/URL di
  join usano `window.location.origin` (nessun localhost hardcoded) e il fallback
  SPA serve le route su un host reale.

## File toccati (previsione)

- `client/package.json` — aggiunta `react-router-dom`.
- `client/src/App.tsx` — router con le 3 route.
- `client/src/landing/Landing.tsx` — **nuovo** componente presentazionale.
- `client/src/host/HostApp.tsx` — `joinUrl` → `/join?room=CODE`.
- `client/src/player/PlayerApp.tsx` — alleggerimento dell'intestazione iniziale.
