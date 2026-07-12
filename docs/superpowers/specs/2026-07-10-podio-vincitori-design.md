# Podio dei vincitori a fine partita — design

**Data:** 2026-07-10 · **Richiesta:** "tutte le partite devono avere un podio di
vincitori oltre che dare premi e consigli alla fine."

## Obiettivo

Ogni partita che oggi termina con premi (superlativi) e consigli (blind spot)
deve mostrare anche un **podio 🥇🥈🥉**: una classifica di merito con i primi
tre, sul tabellone (/host) e sul telefono di ogni giocatore (col proprio
piazzamento). Il gioco resta sociale: il podio si aggiunge ai premi, non li
sostituisce, e nessuno viene umiliato (i punti sono solo positivi).

## Ambito

- **Incluse:** tutte le partite in modalità `gruppo` — formati `classic`,
  `percorso`, `storia`, con o senza Infiltrato/Squadre — perché tutte terminano
  a `FINAL_AWARDS`, l'unica schermata che dà premi e consigli.
- **Esclusa:** la modalità `duello` (2 giocatori, termina a `FINAL_DUEL` con il
  proprio verdetto d'intesa e senza premi/consigli): un podio a due non è un
  podio, e il duello non è una gara ma una misura di sintonia.
- I **bot** partecipano alla classifica come al resto del gioco (votano,
  difendono, vincono premi): escluderli falserebbe i conti a serata mista.

## Punteggio — "Punti Serata"

Formula trasparente e spiegabile a voce, calcolata dalle `PlayerStats` già
accumulate (nessun nuovo tracciamento, nessun voto individuale rivelato):

| Componente | Punti |
|---|---|
| Round giocato (voto in VOTE_1 e VOTE_2) | +1 a round |
| Voto netto spostato dalle proprie difese (`persuasion`, mai sotto 0) | +2 a voto |
| Voto ricevuto come "oratore più convincente" (`oratorVotes`) | +2 a voto |
| Pronostico corretto sull'esito delle difese (`correctPredictions`) | +1 |
| Scommessa sul ribaltone indovinata (`correctSwingBets`) | +1 |
| "Quanto mi conosci" indovinato (`knowCorrect`) | +1 |
| Idea cambiata da un dilemma scritto da te (`authoredSwing`) | +1 |

Esclusi (con motivo): `devilPersuasion` (già dentro `persuasion`, doppio
conteggio); `reactionsReceived` (spammabile, non limitato); `majority/minority/
changedCount` (stile di gioco, non merito); esiti Infiltrato (v1 fuori scope,
il verdetto ha già il suo pannello).

**Classifica:** ordinamento per punti decrescenti; a pari punti, *ex aequo* con
"competition ranking" (1, 1, 3): due primi a pari merito, il successivo è terzo.
Il podio mostra chi ha `rank ≤ 3`; la classifica completa esiste comunque (serve
al telefono per il piazzamento personale).

## Architettura

Segue il pattern gemello di `awards.ts`/`blindspots.ts`:

- **`server/src/game/podium.ts`** (nuovo, puro, testato):
  `podiumPoints(s: PlayerStats): number` e
  `computePodium(room: Room): PodiumEntry[]` con
  `PodiumEntry = { player: Player; points: number; rank: number }`
  (lista completa, ordinata, solo chi ha `rounds > 0`).
- **`rooms.ts`**: re-export dei tipi + `publicPodium(code): PodiumEntry[] | null`
  gated a `FINAL_AWARDS` (specchio di `publicAwards`).
- **`index.ts`**: `podium: rooms.publicPodium(room.code)` nel payload
  `game:state` (broadcast — nessun dato segreto: solo totali aggregati).
- **`client/src/shared/events.ts`**: tipo `PodiumEntry` + campo
  `podium: PodiumEntry[] | null` su `GameStatePayload`.

## UI

- **`PodiumPanel`** in `client/src/shared/ui/PublicViews.tsx` (riusato da host e
  telefono come `NamedMomentsPanel`/`AwardsPanel`): podio a tre gradini
  (2° | 1° | 3°, gradino centrale più alto, oro/argento/bronzo, nome + punti);
  ex aequo = più nomi sullo stesso gradino. Sotto, la classifica completa in
  righe compatte quando ci sono più giocatori che posti sul podio.
- **/host (`HostApp`)**: a `FINAL_AWARDS`, `PodiumPanel` dopo i verdetti
  speciali (Infiltrato/Squadre) e prima di "I momenti della serata" — prima il
  podio, poi i momenti, poi i premi.
- **Telefono (`StatusView`)**: stesso `PodiumPanel` con `meId` per evidenziare
  la propria riga + intestazione personale ("Sei arrivatə 2° · 14 punti").

Niente nuovi suoni: la fanfara di `FINAL_AWARDS` esistente copre anche il podio.
Niente persistenza DB dei piazzamenti in v1 (YAGNI).

## Errori e casi limite

- Partita senza round completati: lista vuota → il pannello non renderizza nulla
  (come `NamedMomentsPanel`).
- Giocatore uscito prima della fine: resta in `room.stats` ma può mancare da
  `room.players` → nickname risolto come in `computeAwards` (fallback `''`,
  filtrato dal pannello se vuoto).
- Fuori da `FINAL_AWARDS`: `podium` è sempre `null` (nessuno spoiler in corsa).

## Test

- `podium.test.ts`: ogni componente della formula; `persuasion` negativa
  bloccata a 0; ordinamento; ex aequo (1,1,3); esclusione `rounds === 0`;
  bot inclusi.
- Livello room: `publicPodium` null fuori da `FINAL_AWARDS`, popolato a
  `FINAL_AWARDS` (classic; il gate vale identico per percorso/storia che
  condividono la fase).
- Client: render di `PodiumPanel` (podio, ex aequo, evidenza `meId`, lista
  completa) nello stile dei test esistenti.

## Alternative considerate

1. **Podio = primi 3 premi esistenti** (senza punti): zero formule nuove, ma la
   gerarchia fra premi sarebbe arbitraria e non "vincono i migliori". Scartata.
2. **Punteggio visibile durante la partita** (classifica live): più competitivo
   ma cambia la natura sociale del gioco e ancora l'attenzione ai punti.
   Scartata per v1 — il podio è una rivelazione finale.
3. **Formula scelta** (punti solo a fine partita, da stats esistenti):
   trasparente, zero nuovo tracciamento, non tocca la segretezza dei voti. ✅
