# Dibattiti tra amici

Web app stile Jackbox per un gioco da tavolo su **business e crescita personale**, da
giocare dal vivo con 3–8 amici. Uno **schermo comune** (`/host`) mostra tabellone, dilemmi
e timer; ogni giocatore usa il **proprio telefono** (`/`) per entrare e votare.
Esperienza social, niente vincitore: a fine partita **premi simpatici**.

Prima fase di gioco: **Dilemma di gruppo** (voto segreto → split → difese a tempo →
ri-voto → swing dei voti).

## Stack

- `server/` — Node + Express + Socket.IO (TypeScript), stato di gioco **in memoria**, autoritativo.
- `client/` — React + Vite (TypeScript), due viste: `host` e `player`.

## Sviluppo

```bash
npm install
npm run dev
```

- Host (schermo comune): http://localhost:5173/host
- Giocatore (telefono): http://localhost:5173/  — dallo stesso WiFi usa l'IP del computer, es. http://192.168.x.x:5173/

Il server gira su `:3000`; in dev Vite (`:5173`) fa da proxy per `/socket.io` e `/api`.

## Qualità

```bash
npm run typecheck   # tsc --noEmit (server + client)
npm run lint        # eslint
npm test            # vitest (logica di gioco lato server)
npm run build       # build client + server
```

## Produzione

```bash
npm run build
npm start           # il server serve client/dist e gestisce Socket.IO sulla stessa porta
```

## Sviluppo autonomo (Ralph)

Le user story sono in [`prd.json`](prd.json) (PRD leggibile in
[`tasks/prd-skeleton-dilemma.md`](tasks/prd-skeleton-dilemma.md)). Il loop autonomo:

```bash
./ralph.sh --tool claude   # richiede la CLI `claude` nel PATH
```

Ogni iterazione implementa la prossima story con `passes: false`, esegue i controlli di
qualità, committa e aggiorna `prd.json` + `progress.txt`.
