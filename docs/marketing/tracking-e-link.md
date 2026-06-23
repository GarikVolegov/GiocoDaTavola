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
avere **attribuzione affiliato certa**, manda il traffico di conversione lì:
```
https://<DOMINIO-NORTHSTAR>/sign-up?ref=<CODICE_AFFILIATO>&utm_source=schierati&utm_medium=<formato>&utm_campaign=<tema>
```
Per traffico "esplorativo" (far scoprire NorthStar senza spingere subito l'iscrizione) va bene
anche la home con i soli UTM:
```
https://<DOMINIO-NORTHSTAR>/?utm_source=schierati&utm_medium=<formato>&utm_campaign=<tema>
```

> ⚠️ **Da confermare con te (autorizzazione):**
> 1. Il **dominio di produzione** di NorthStar (es. `ainorthstar.vercel.app` o un dominio custom).
> 2. Il **codice affiliato** da usare per SCHIERATI (creato nell'area affiliazione di NorthStar).
> Appena me li dai, li metto: in **un solo punto** nel gioco (`client/src/shared/northstar.ts`,
> costante `NORTHSTAR_URL`) e qui nei template.

## 2. Il "ponte" dentro il gioco (già implementato)

A fine partita (schermata premi, sul telefono di ogni giocatore) compare la card:
*"Questo era un gioco. Vuoi decidere così sul serio sulla tua carriera? → Scopri NorthStar"*.
Il link è la costante `NORTHSTAR_URL` in `client/src/shared/northstar.ts`. Oggi punta a
`https://ainorthstar.vercel.app/?utm_source=schierati&utm_medium=app&utm_campaign=fine-partita`.
**Quando mi confermi dominio + codice affiliato**, lo aggiorno a `/sign-up?ref=<codice>&utm_...`
così ogni iscrizione che nasce dal gioco è attribuita.

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
