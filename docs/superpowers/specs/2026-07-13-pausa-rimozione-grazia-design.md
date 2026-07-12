# Grazia più lunga, rimozione offline, pausa di gioco — design

**Data:** 2026-07-13
**Stato:** approvato (in attesa di review della spec scritta)
**Tipo:** robustezza sessione (server + client), estensione del sistema di riconnessione già in produzione.

## Contesto e problema

Il gioco ha già un sistema di riconnessione maturo (token stabile in
`localStorage`, `Player.connected`, `RECONNECT_GRACE_MS`, snapshot periodici) che
copre schermo bloccato / refresh / blip di rete: si veda
`docs/superpowers/specs/2026-06-20-reconnection-design.md`. Verificando il codice
attuale sono emerse tre lacune rispetto a un uso reale "in presenza":

1. **La finestra di grazia è di soli 45 secondi** (`RECONNECT_GRACE_MS`,
   `server/src/index.ts:85`). Una pausa reale (bagno, telefonata, rispondere alla
   porta) la supera facilmente: il giocatore perde il posto e tutto il suo stato
   prima di riuscire a rientrare.
2. **Non esiste alcun modo per il leader di liberare manualmente il posto** di un
   giocatore che non torna. `Room.leave()` (`server/src/game/rooms.ts:2716`) fa
   già tutto il lavoro di rimozione, ma oggi lo invoca solo il timer di grazia
   automatico — nessun evento socket lo espone a un'azione del leader.
3. **Non esiste alcuna pausa esplicita del gioco.** Se il gruppo vuole fermarsi
   un attimo tutti insieme (non solo un giocatore assente), oggi l'unica opzione
   è lasciar scorrere i timer a vuoto: il conto alla rovescia continua, una fase
   può scadere ed avanzare mentre nessuno sta guardando.

## Obiettivo

- Un giocatore che si allontana per una pausa reale (fino a 5 minuti) ritrova il
  proprio posto e stato esattamente come oggi succede per un blip più breve.
- Il leader può liberare manualmente il posto di un giocatore **offline** dal
  menu ⋮ del proprio telefono, senza aspettare i 5 minuti.
- Il leader può mettere in pausa l'intera partita in qualsiasi momento; nessun
  timer scade e nessuna fase avanza finché non la riprende lui, a tempo
  indeterminato. I telefoni **restano connessi**: la pausa non è una
  disconnessione, è uno stato del gioco.

## Non-obiettivi (YAGNI)

- Rimuovere un giocatore **online** (kick vero e proprio): fuori scope, si
  applica solo a chi è già segnato offline.
- Congelare i timer "di piano" per-turno (`turnMinEndsAt` in DEFENSE/DUO_ARGUE):
  durante una pausa restano fermi nel senso che nessuna fase avanza comunque
  (vedi §3), ma il loro valore assoluto non viene ricalcolato al resume. Effetto
  collaterale accettato: il pulsante "Ho finito" del turno in corso potrebbe
  risultare già sbloccato subito al rientro da una pausa lunga. Innocuo (non fa
  saltare nulla, il turno finisce comunque solo su azione esplicita) e non vale
  la complessità di gestirlo in questa iterazione.
- Pausa con timeout automatico: resta in pausa finché il leader non la riprende.
- Persistenza della pausa attraverso un riavvio del server: se il processo
  riparte durante una pausa, la partita si restaura com'è oggi (tutti segnati
  offline, si riconnettono col token) ma il flag `paused` fa parte dello stato
  serializzato quindi sopravvive comunque a un riavvio senza codice aggiuntivo
  (è solo un altro campo di `Room`).

## Architettura

### 1. Finestra di grazia: 45s → 5 minuti

`RECONNECT_GRACE_MS` (`server/src/index.ts:85`) passa da `45_000` a `5 * 60_000`.
Nessun altro cambiamento: la logica di `disconnect`/grazia/reconnect è già
generica rispetto alla durata.

Conseguenza necessaria: `ABANDONED_ROOM_MAX_IDLE_MS` (`server/src/index.ts:90`,
oggi anch'esso 5 minuti) deve restare **molto più grande** della grazia per non
rischiare che lo sweep di sicurezza (`abandonedRooms`, gated da
`hasPendingGrace`) e la nuova grazia da 5 minuti finiscano alla pari. Sale a
`30 * 60_000` (30 minuti). L'invariante resta espressa nel commento inline
(`// 30 min, >> RECONNECT_GRACE_MS`).

### 2. Rimozione manuale di un giocatore offline

- Nuovo metodo su `RoomStore`: `removeIfOffline(code: string, playerId: string): boolean`
  — restituisce `false` se la stanza/giocatore non esistono o se
  `player.connected !== false` (cioè è online: rifiutato); altrimenti richiama
  la stessa logica di pulizia già usata da `leave()` (voti, code, leadership,
  ecc. — nessuna duplicazione, `removeIfOffline` chiama `leave` internamente
  dopo il check) e ritorna `true`.
- Nuovo evento socket `leader:removePlayer { id: string }`
  (`server/src/index.ts`, accanto a `leader:removeBot`): stesso pattern —
  `leaderCodeFor(socket.id)` per l'autorizzazione, poi
  `rooms.removeIfOffline(code, id)`; se `true`, `broadcastLobby(code)` e, se
  la fase è di voto, `refreshAfterRosterChange(code)` (stesso trattamento già
  riservato oggi alla rimozione-per-grazia-scaduta, per non bloccare un voto in
  corso).
- Evento gemello lato client in `client/src/shared/events.ts`.
- **UI:** nel menu ⋮ (`client/src/player/LeaveGameMenu.tsx`), quando il chiamante
  è il leader e la lista giocatori include almeno un offline, appare una voce
  "Rimuovi chi è assente" che apre un elenco dei soli giocatori offline (nome +
  bottone di rimozione per riga). Nessuna doppia conferma: l'azione è già
  ristretta ai soli assenti (non si può rimuovere per sbaglio chi sta giocando),
  è quindi a basso rischio come "Aggiungi bot".

### 3. Pausa/ripresa del gioco

**Stato:** `Room` guadagna due campi:
- `paused: boolean` (default `false`)
- `pausedRemainingMs: number | null` — quanto mancava alla scadenza della fase
  nel momento della pausa; `null` se la fase corrente non aveva un timer attivo
  (es. era già scaduto/assente).

Seguendo il pattern già usato per le altre transizioni (`startGame`,
`rematch`, `addBot`: logica di stato nello store, l'handler in index.ts si
occupa solo di timer/broadcast), `RoomStore` guadagna due metodi:

**`RoomStore.pauseGame(code): boolean`** — `false` (no-op) se la stanza non
esiste, è già in pausa, o la fase è `LOBBY`/`FINAL_AWARDS` (non c'è una
partita "in corso" da fermare). Altrimenti:
1. `room.pausedRemainingMs = room.phaseExpiresAt != null ? Math.max(0, room.phaseExpiresAt - this.now()) : null`
2. `room.phaseExpiresAt = null` (il countdown sparisce da solo su host+telefoni:
   `useCountdown(null)` già ritorna `null`, zero modifiche al hook).
3. `room.paused = true`; ritorna `true`.

**`RoomStore.resumeGame(code): boolean`** — `false` (no-op) se la stanza non
esiste o non è in pausa. Altrimenti:
1. `room.phaseExpiresAt = room.pausedRemainingMs != null ? this.now() + room.pausedRemainingMs : null`
2. `room.paused = false; room.pausedRemainingMs = null`; ritorna `true`.

**Handler `leader:pauseGame`/`leader:resumeGame`** (`server/src/index.ts`,
stesso pattern di `leader:rematch`): autorizzano via `leaderCodeFor`, poi
chiamano il metodo dello store corrispondente; se ritorna `true`:
- `pauseGame` → `clearPhaseTimer(code)` (ferma il `setTimeout` di auto-advance)
  poi `broadcastGameState(code)`.
- `resumeGame` → `schedulePhase(code)` (ririschedula l'auto-advance se c'è un
  nuovo `phaseExpiresAt`) poi `broadcastGameState(code)`.

**Guard unico per bloccare l'avanzamento:** in cima a `advanceAndBroadcast(code)`
(`server/src/index.ts:440`, il punto di atterraggio condiviso da scadenza
timer, force-advance del leader, e ogni via di completamento voto/submission):
`if (room.paused) return;`. Un solo punto d'intervento copre *tutte* le vie
d'avanzamento esistenti e future senza dover toccare i singoli handler
(`player:vote`, `leader:advancePhase`, `leader:skipDilemma`,
`refreshAfterRosterChange`, ecc.) — dato che tutte, alla fine, chiamano questa
funzione per far avanzare la fase.

Le azioni che *non* fanno avanzare la fase (es. registrare un voto, alzare la
mano) restano permesse anche in pausa: sono innocue (non cambiano fase da sole)
e non serve bloccarle esplicitamente, il guard sopra basta a garantire che la
partita resti ferma.

**UI:**
- `gameStatePayload()` aggiunge `paused: room.paused`.
- Overlay a schermo intero "⏸ Partita in pausa" quando `game.paused === true`,
  mostrato sia su `/host` (TV) sia su tutti i telefoni, sopra la vista di fase
  corrente.
  - Il **leader** vede sull'overlay stesso un pulsante "▶ Riprendi" ben
    visibile (più facile da trovare al momento del bisogno che riaprire il
    menu ⋮).
  - Gli altri giocatori vedono solo un messaggio di attesa (es. "In pausa —
    riprende a breve").
- Il trigger per mettere in pausa resta nel menu ⋮ del leader (voce "⏸ Metti in
  pausa", visibile solo a partita avviata e non già in pausa).

## Edge cases

- **Pausa + disconnessione:** i due meccanismi sono ortogonali. Se un giocatore
  si disconnette durante una pausa, la sua grazia da 5 minuti parte comunque
  normalmente (indipendente dal fatto che il gioco sia fermo); se rientra prima
  che scada, ritrova il posto. La pausa in sé non richiede che tutti siano
  connessi.
- **Rimozione offline durante una pausa:** permessa senza restrizioni aggiuntive
  — è comunque un'operazione che non fa avanzare la fase.
- **Leader che si disconnette mentre il gioco è in pausa:** la leadership passa
  già oggi al primo umano connesso alla scadenza della sua grazia
  (`rooms.ts:2739`); se non c'è nessun altro connesso resta al giocatore
  disconnesso (comportamento esistente, invariato) finché non rientra o rientra
  qualcun altro.
- **Riavvio del server durante una pausa:** `paused`/`pausedRemainingMs` fanno
  parte di `Room` e quindi dello snapshot serializzato — sopravvivono al
  restore come ogni altro campo, senza lavoro dedicato.
- **Pausa richiesta due volte / resume senza essere in pausa:** entrambi gli
  eventi sono no-op se lo stato non corrisponde (idempotenti, nessun errore da
  gestire lato client).

## Testing

- **Store (`rooms.test.ts`, TDD, clock iniettato):**
  - `removeIfOffline` rimuove solo un giocatore con `connected === false`;
    rifiuta un giocatore online o un id inesistente; pulisce voti/leadership
    come `leave()`.
  - `pauseGame`/`resumeGame` catturano/ripristinano correttamente
    `pausedRemainingMs` con un clock iniettato; no-op su fasi
    `LOBBY`/`FINAL_AWARDS` o stato già coerente (già in pausa / non in pausa).
  - Costanti di grazia/abbandono aggiornate nei test che le referenziano.
- **Integrazione socket (`server/src/__tests__/integration.test.ts`):**
  - pausa → un voto che normalmente farebbe scattare l'early-advance NON fa
    avanzare la fase; resume → il timer riparte e (o un nuovo voto completo)
    l'avanzamento torna a funzionare.
  - `leader:removePlayer` rifiutato se il target è online; accettato se
    offline, e libera il posto (verificabile da un nuovo join che lo rioccupa).
- **Client:** nessun test runner dedicato — `typecheck`/`lint`/`build` +
  verifica manuale dell'overlay di pausa e della voce di rimozione nel menu ⋮.
- **Gate verde end-to-end:** `npm run typecheck && npm run lint && npm test && npm run build`.

## File previsti

- `server/src/index.ts` — `RECONNECT_GRACE_MS`/`ABANDONED_ROOM_MAX_IDLE_MS`
  aggiornati; nuovi handler `leader:pauseGame`, `leader:resumeGame`,
  `leader:removePlayer`; guard `if (room.paused) return;` in
  `advanceAndBroadcast`; `gameStatePayload` espone `paused`.
- `server/src/game/rooms.ts` — `Room.paused`/`Room.pausedRemainingMs`;
  `removeIfOffline`; `pauseGame`/`resumeGame`.
- `client/src/shared/events.ts` — nuovi eventi `LeaderPauseGame`,
  `LeaderResumeGame`, `LeaderRemovePlayer`; `GameStatePayload.paused`.
- `client/src/player/LeaveGameMenu.tsx` — voce "⏸ Metti in pausa" /
  "Rimuovi chi è assente" (leader-only, condizionate allo stato).
- `client/src/player/PlayerApp.tsx` — overlay di pausa (fase indipendente),
  pulsante "▶ Riprendi" per il leader.
- `client/src/host/HostApp.tsx` — stesso overlay di pausa sulla vista TV.

## Compatibilità

Nessun cambiamento allo schema di `GamePhase` esistente: `paused` è un flag
ortogonale alla fase, quindi tutti i predicati/switch esistenti keyed su
`phase` restano invariati. `removeIfOffline` riusa `leave()` senza duplicare
la logica di pulizia already-tested. I client che non conoscono ancora
`paused` (cache vecchia) lo ignorerebbero semplicemente (campo opzionale con
default `false` lato UI) — non rilevante in pratica dato il deploy singolo.
