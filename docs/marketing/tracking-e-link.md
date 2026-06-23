# Tracking & link — come misurare il funnel SCHIERATI → NorthStar

> Obiettivo: sapere **quante persone arrivano dal gioco/dai contenuti** e **quante si iscrivono a
> NorthStar** grazie a noi. Due strumenti: UTM (analytics) + codice affiliato (attribuzione vera).

## 1. I due link che useremo ovunque

### a) Link a SCHIERATI (per i contenuti → far provare il gioco)
```
https://schierati-production.up.railway.app/?utm_source=<canale>&utm_medium=<formato>&utm_campaign=<tema>
```
- `<canale>`: `youtube` | `instagram` (| `tiktok` in futuro)
- `<formato>`: `short` | `reel` | `longform` | `bio` | `stories`
- `<tema>`: es. `dilemma-carriera`, `ribaltone`, `trailer`

Esempio (Short YouTube sul ribaltone):
`https://schierati-production.up.railway.app/?utm_source=youtube&utm_medium=short&utm_campaign=ribaltone`

### b) Link a NorthStar (per i post-ponte e per la CTA di fine partita nel gioco)
NorthStar **cattura il referral nella pagina `/sign-up`** (legge `?ref=` o `?referralCode=`). Per
avere **attribuzione affiliato certa**, manda il traffico di conversione lì.

**Valori confermati (2026-06-23):**
- Dominio prod: **`https://ainorthstar.vercel.app`** (verificato live, serve `/sign-up`).
- Codice affiliato del founder (canale SCHIERATI accreditato a lui): **`GARIKVOLEG76142`**.

Link di conversione (è quello cablato nella CTA di fine partita):
```
https://ainorthstar.vercel.app/sign-up?ref=GARIKVOLEG76142&utm_source=schierati&utm_medium=<formato>&utm_campaign=<tema>
```
Per traffico "esplorativo" (far scoprire NorthStar senza spingere subito l'iscrizione) va bene
anche la home con i soli UTM:
```
https://ainorthstar.vercel.app/?utm_source=schierati&utm_medium=<formato>&utm_campaign=<tema>
```

> ⚠️ **Note di verità (importanti):**
> - Il link **Railway** fornito inizialmente (`web-production-91c8.up.railway.app/sign-up?ref=...`)
>   dava **404 anche sulla root** → NON usato. Se in futuro Railway diventa il dominio buono,
>   basta cambiare la costante in `client/src/shared/northstar.ts`.
> - Da fare una volta: **iscrizione di prova** dal link sopra per confermare che il `ref` venga
>   davvero registrato dall'area affiliazione di NorthStar (il deploy Vercel potrebbe essere una
>   linea più vecchia).

## 2. Il "ponte" dentro il gioco (già implementato)

A fine partita (schermata premi, sul telefono di ogni giocatore) compare la card:
*"Questo era un gioco. Vuoi decidere così sul serio sulla tua carriera? → Scopri NorthStar"*.
Il link è la costante `NORTHSTAR_URL` in `client/src/shared/northstar.ts`. Punta a
`https://ainorthstar.vercel.app/sign-up?ref=GARIKVOLEG76142&utm_source=schierati&utm_medium=app&utm_campaign=fine-partita`
così ogni iscrizione che nasce dal gioco è attribuita al codice affiliato del founder.

## 3. KPI — cosa guardare ogni settimana (niente vanity)

| Tappa del funnel | Metrica | Dove la leggi |
|---|---|---|
| Awareness | Views / reach / nuovi follower | YouTube Studio · Instagram Insights |
| Interesse | Click sul link SCHIERATI | UTM nel tuo analytics / link in bio (es. accorciatore con statistiche) |
| Attivazione | Partite avviate | (lato gioco — se vorrai, aggiungiamo un contatore) |
| **Ponte** | Click "Scopri NorthStar" a fine partita + click sui post-ponte | UTM `utm_campaign=fine-partita` / per-post |
| **Conversione** | **Iscrizioni NorthStar attribuite** (`ref` / utm_source=schierati) | Area affiliazione + analytics NorthStar |
| Ricavo | Upgrade a Pro (24€) provenienti da quei lead | Stripe / NorthStar |

**Lettura settimanale (5 minuti):** 1 numero per riga, confronto con la settimana prima. Se le
**iscrizioni attribuite restano 0** mentre i click ci sono → il problema è la landing/sign-up di
NorthStar (readiness), non i contenuti.

## 4. Strumenti gratuiti consigliati

- **Accorciatore con statistiche** per i link in bio (così vedi i click senza analytics complesse).
- **YouTube Studio** + **Instagram Insights** (nativi, gratis) per reach e retention.
- Un **foglio** unico "KPI settimanali" con le 6 righe qui sopra: è la tua dashboard.

## 5. Convenzione UTM (da rispettare sempre, per non sporcare i dati)

- `utm_source` = la **piattaforma** (`youtube`, `instagram`).
- `utm_medium` = il **formato** (`short`, `reel`, `longform`, `bio`, `stories`).
- `utm_campaign` = il **tema/pilastro** (`ribaltone`, `dilemma-carriera`, `trailer`, `ponte`).
- Tutto **minuscolo**, senza spazi (usa trattini). Coerenza = dati leggibili.
