# Equa rotazione dei difensori — design

**Data:** 2026-06-22
**Stato:** approvato (brainstorming) — pronto per il piano di implementazione

## Problema

Oggi, all'ingresso nella fase `DEFENSE`, `selectDefenders`
([`server/src/game/rooms.ts`](../../../server/src/game/rooms.ts) ~L610) sceglie
**un difensore per lato pescando a caso tra i votanti di quel lato**:

```ts
const chosen = voters[Math.floor(this.rng() * voters.length)];
```

Essendo puramente casuale, in una partita con più dilemmi la stessa persona può
finire a difendere più volte mentre altri non parlano mai. Il requisito: il
sistema deve **capire sempre chi non ha ancora parlato e dargli la priorità**, in
modo che — entro i vincoli del gioco — tutti abbiano la possibilità di difendere.

## Requisito (deciso in brainstorming)

- **Garanzia rigida**, non solo uno sbilanciamento probabilistico: tra i votanti
  di un lato si sceglie **sempre** chi ha difeso **meno volte** finora. A parità
  di conteggio, il pareggio si risolve **a caso** (così resta imprevedibile e si
  riusa l'rng iniettabile esistente).
- **Cosa conta come "aver parlato":** solo i turni da **difensore** nella fase
  `DEFENSE` (incluso il round "Avvocato del Diavolo" — chi argomenta parla a
  prescindere dal lato). Non contano i voti come "oratore più convincente" né
  altre fasi.

## Vincolo intrinseco

Un difensore di un lato può essere scelto **solo tra chi ha votato quel lato**
(invariato). Quindi la "garanzia" è: chi ha votato un lato e non ha ancora
parlato verrà scelto **prima** di chi ha già parlato per quel lato. Non è
possibile far parlare chi non ha votato il lato che serve — ed è corretto così.

## Approccio scelto

**Contatore dedicato** `room.defenseCounts: Map<playerId, number>`, incrementato
**dentro `selectDefenders`** nell'istante esatto della scelta.

Alternativa scartata: riusare `defendedCount` (lo stat dei premi, incrementato in
`PHASE_RESULTS`). Funzionerebbe, ma accoppia la selezione a una variabile nata
per i premi e al timing delle fasi. Il contatore dedicato è auto-contenuto, non
dipende dall'ordine delle fasi ed è più facile da testare in isolamento. Il costo
è un solo campo in più nel `Room`.

## Algoritmo

In `selectDefenders`, per ciascun lato (A poi B, invariato):

1. Calcola i `voters` del lato dai voti segreti (invariato).
2. Se `voters.length === 0` → nessun difensore per quel lato (invariato).
3. Trova `min` = minimo di `room.defenseCounts.get(id) ?? 0` tra i `voters`.
4. Restringi ai votanti con conteggio uguale a `min` (i "più indietro").
5. Scegli tra questi con `this.rng()` (tiebreak casuale).
6. `room.defenseCounts.set(chosen, (room.defenseCounts.get(chosen) ?? 0) + 1)`.
7. Il resto (lookup del player, logica `devil`/`side`, push del `Defender`)
   resta identico.

## Ambito

- Si applica alla modalità **`gruppo`** — sia formato **classica** sia
  **percorso**, che condividono questo stesso codice di selezione.
- **`duello`** non è toccato: i 2 giocatori argomentano sempre entrambi, quindi
  non c'è equità da bilanciare.
- Il numero di difensori resta **uno per lato** → `SPEAKER_VOTE` (che richiede
  ≥2 difensori) e le altre fasi a valle non cambiano comportamento.

## Stato e ciclo di vita

- Nuovo campo `Room.defenseCounts: Map<string, number>`.
- Inizializzato **vuoto** alla creazione della stanza.
- **Azzerato a inizio partita** (`startGame`), insieme allo stato di gioco già
  resettato lì (come `stats`), così ogni partita riparte equa.
- Un giocatore che esce: la sua entry può restare (innocua, come gli `stats`);
  non serve potarla, perché viene letta solo per i votanti correnti del round.

## Regole del progetto rispettate

- **Voti segreti:** la selezione legge i voti solo lato server; restano pubbliche
  solo le identità dei difensori scelti (come oggi). `defenseCounts` non lascia
  mai il server.
- **Niente `any`**, vars inutilizzate prefissate con `_`.
- Logica di gioco sotto `server/src/game/`, test sotto
  `server/src/game/__tests__/`.

## Test (TDD, rng iniettabile)

In `server/src/game/__tests__` (estendendo i test esistenti delle stanze):

1. **Priorità a chi non ha parlato:** in più round, con abbastanza votanti su un
   lato, un votante mai-scelto è preferito a uno già-scelto, anche quando l'rng
   "vorrebbe" il secondo.
2. **Tiebreak casuale a parità:** quando tutti i candidati hanno lo stesso
   conteggio, la scelta usa l'rng come oggi (pin con rng fisso).
3. **Lato con un solo votante:** sempre quel votante, round dopo round.
4. **Lato con 0 voti:** nessun difensore (invariato).
5. **Round Avvocato del Diavolo:** il turno conta nel `defenseCounts` (chi
   argomenta ha "parlato"), così non viene riscelto subito dopo.
6. **Reset a nuova partita:** dopo `startGame` i conteggi ripartono da zero.

## Criteri di completamento

- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` tutti verdi.
- I nuovi test passano e quelli esistenti su `selectDefenders` restano verdi.
- Branch committato e **pushato** sul remoto.
