# Marketing funnel SCHIERATI → NorthStar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) o
> superpowers:subagent-driven-development per eseguire task-by-task. Gli step di codice usano
> checkbox (`- [ ]`). I task "deliverable di marketing" non sono codice: niente TDD, hanno
> criteri di accettazione invece dei test.

**Goal:** Mettere a terra la strategia: produrre il kit marketing (script video, ganci-dilemma,
calendario, outreach, tracking) e costruire il "ponte" prodotto in SCHIERATI (categoria dilemmi
"Carriera" + CTA di fine partita verso NorthStar con link tracciato).

**Architecture:** Due nature di lavoro. (1) **Deliverable di contenuto** = file Markdown in
`docs/marketing/` (nessun test, criterio = completo e pronto all'uso). (2) **Ponte prodotto** =
modifica codice in `gioco-dibattiti` con disciplina TDD sul registro `carriera` (lato server,
testabile) e modifica presentazionale per la CTA (lato client, coperta da typecheck/lint/build +
suite verde).

**Tech Stack:** Markdown (kit marketing); SCHIERATI: server TypeScript CommonJS (tsx/tsc),
client React+Vite TS ESM, Vitest, JSON data deck.

## Global Constraints

- Tutto in **italiano**. Niente i18n.
- Tono: sveglio, ironico, "tra amici". Mai corporate. (copia verbatim dallo spec)
- Bilanciamento contenuti: **~65% dilemmi vita/carriera**, ~35% puro divertimento.
- Canali attivi ora: **YouTube** (long + Shorts) + **Instagram** (feed + stories). TikTok escluso
  ma verticali riutilizzabili.
- Budget: **0€** (organico puro). Nessuna spesa pubblicitaria in questa fase.
- Codice SCHIERATI: server CJS / client ESM separati; **no `any`** (lint error); unused con `_`;
  voti segreti e timer server-side **non si toccano**; link esterni con
  `target="_blank" rel="noopener noreferrer"`; design system "Neon party night" via token, niente
  hex hardcoded; **gate verde obbligatorio**: `npm run typecheck && npm run lint && npm test && npm run build`.
- URL NorthStar centralizzato in **un'unica costante** (`NORTHSTAR_URL`) con parametri di
  tracciamento UTM, così l'utente può confermare/cambiare dominio e aggiungere il codice
  affiliato in un solo punto.

---

## File Structure

**Kit marketing (nuovi):**
- `docs/marketing/README.md` — indice del kit + come usarlo.
- `docs/marketing/script-video-hero.md` — 3 hero (script + shot-list + caption + CTA).
- `docs/marketing/pilastri-e-ganci-dilemma.md` — 4 pilastri + 30 ganci-dilemma pronti.
- `docs/marketing/calendario-editoriale.md` — ritmo settimanale + calendario 4 settimane.
- `docs/marketing/creator-outreach.md` — playbook + 3 template di contatto.
- `docs/marketing/tracking-e-link.md` — schema UTM, uso codici affiliato NorthStar, KPI.

**Ponte prodotto (modifiche):**
- Modify: `server/src/game/deck.ts` — `ContentRegister` + `Dilemma.register` aggiungono `'carriera'`.
- Modify: `server/src/game/rooms.ts:86` — `CONTENT_REGISTERS` aggiunge `'carriera'`.
- Modify: `client/src/shared/events.ts:119,142` — `CONTENT_REGISTERS` + `REGISTER_LABELS` per `carriera`.
- Modify: `server/data/dilemmas.json` — +12 dilemmi `register: "carriera"`.
- Modify: `server/src/game/__tests__/deck.test.ts` — test registro `carriera` + fix asserzione vita/business.
- Create: `client/src/shared/northstar.ts` — costante `NORTHSTAR_URL` (tracciata).
- Modify: `client/src/player/views/StatusView.tsx:286+` — card CTA NorthStar in `FINAL_AWARDS`.

---

## Task 1: Registro dilemmi "Carriera" (ponte tematico) — server, TDD

**Files:**
- Modify: `server/src/game/deck.ts`
- Modify: `server/src/game/rooms.ts`
- Modify: `client/src/shared/events.ts`
- Modify: `server/data/dilemmas.json`
- Test: `server/src/game/__tests__/deck.test.ts`

**Interfaces:**
- Produces: `ContentRegister = 'vita' | 'business' | 'carriera' | 'misto'`; `Dilemma.register:
  'vita' | 'business' | 'carriera'`; nuovi dilemmi con `register: "carriera"` in `dilemmas.json`.
- Consumes: `dilemmasForRegister(all, 'carriera')` (filtro esistente, nessuna firma cambia).

- [ ] **Step 1: Aggiorna il test di copertura registri (scrivi l'asserzione che fallisce)**

In `server/src/game/__tests__/deck.test.ts`, sostituisci il test "ogni dilemma è taggato vita o
business" e aggiungi il test del registro carriera:

```ts
  it('ogni dilemma è taggato vita, business o carriera', () => {
    expect(all.every((d) => d.register === 'vita' || d.register === 'business' || d.register === 'carriera')).toBe(true);
  });

  it('carriera restituisce solo i dilemmi taggati carriera, e ce ne sono abbastanza', () => {
    const car = dilemmasForRegister(all, 'carriera');
    expect(car.length).toBeGreaterThanOrEqual(10);
    expect(car.every((d) => d.register === 'carriera')).toBe(true);
  });
```

- [ ] **Step 2: Esegui i test e verifica il fallimento**

Run: `npm test -- deck`
Expected: FAIL — `carriera` non è assegnabile a `ContentRegister` (typecheck dei test) e/o 0
dilemmi carriera.

- [ ] **Step 3: Allarga i tipi e le costanti**

`server/src/game/deck.ts`:
```ts
export type ContentRegister = 'vita' | 'business' | 'carriera' | 'misto';
```
e nell'interfaccia `Dilemma`:
```ts
  register: 'vita' | 'business' | 'carriera';
```
`server/src/game/rooms.ts` (riga ~86):
```ts
export const CONTENT_REGISTERS = ['vita', 'business', 'carriera', 'misto'] as const;
```
`client/src/shared/events.ts` (righe ~119 e ~142):
```ts
export const CONTENT_REGISTERS = ['vita', 'business', 'carriera', 'misto'] as const;
// ...
export const REGISTER_LABELS: Record<ContentRegister, string> = {
  vita: 'Vita',
  business: 'Business pro',
  carriera: 'Carriera',
  misto: 'Misto',
};
```

- [ ] **Step 4: Aggiungi 12 dilemmi "carriera" a `server/data/dilemmas.json`**

Append (prima della `]` finale) 12 oggetti con id nuovi univoci (`dc01`..`dc12`),
`register: "carriera"`, `complessita` valida (`alto`/`max`/`power`, mix), **senza** `tappa`, con
`spuntiA`/`spuntiB` (≥2 ciascuno). Contenuti dal kit (`pilastri-e-ganci-dilemma.md`, sezione
Carriera). Esempio di forma:
```json
  {
    "id": "dc01",
    "text": "Ti offrono il posto fisso noioso o la startup che rischia di chiudere tra un anno.",
    "optionA": "Posto fisso: stabilità e sonni tranquilli",
    "optionB": "Startup: imparo 10x e mi gioco la scommessa",
    "register": "carriera",
    "complessita": "alto",
    "spuntiA": ["La stabilità è una base, non una prigione", "Con la testa serena rendi di più", "Puoi imparare anche in un posto solido"],
    "spuntiB": ["A 25 anni il rischio costa poco", "In startup cresci a velocità doppia", "Il fallimento è un CV, non una condanna"]
  }
```

- [ ] **Step 5: Esegui i test e verifica che passino**

Run: `npm test -- deck`
Expected: PASS (incluso `loadDilemmas` ids unici, complessità valida, registro carriera ≥10).

- [ ] **Step 6: Gate parziale + commit**

Run: `npm run typecheck && npm run lint`
```bash
git add server/src/game/deck.ts server/src/game/rooms.ts client/src/shared/events.ts server/data/dilemmas.json server/src/game/__tests__/deck.test.ts
git commit -m "feat(deck): registro dilemmi 'Carriera' (ponte tematico verso NorthStar)"
```

---

## Task 2: CTA fine partita verso NorthStar (ponte pratico) — client

**Files:**
- Create: `client/src/shared/northstar.ts`
- Modify: `client/src/player/views/StatusView.tsx`
- Test: gate (`typecheck`/`lint`/`build`) + suite client esistente verde.

**Interfaces:**
- Produces: `NORTHSTAR_URL: string` (link tracciato) esportato da `client/src/shared/northstar.ts`.
- Consumes: in `StatusView.tsx`, nel ramo `phase === 'FINAL_AWARDS'`, dopo `<AwardsPanel>`.

- [ ] **Step 1: Crea la costante del link tracciato**

`client/src/shared/northstar.ts`:
```ts
// Ponte verso NorthStar (l'app "seria" di orientamento e crescita professionale).
// Confermare/aggiornare il dominio di produzione e, se serve, appendere il codice
// affiliato (vedi docs/marketing/tracking-e-link.md). Un solo punto di verità.
export const NORTHSTAR_URL =
  'https://ainorthstar.vercel.app/?utm_source=schierati&utm_medium=app&utm_campaign=fine-partita';
```

- [ ] **Step 2: Aggiungi la card CTA in `FINAL_AWARDS`**

In `client/src/player/views/StatusView.tsx`, importa la costante in cima
(`import { NORTHSTAR_URL } from '../../shared/northstar';`) e inserisci, subito dopo
`{game?.awards && <AwardsPanel awards={game.awards} />}` (riga ~286), prima del blocco
`{blindSpot && ...}`:
```tsx
          <Card
            glow="a"
            style={{ width: 'min(90vw, 22rem)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', textAlign: 'center' }}
          >
            <p style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
              Questo era un gioco. ⚡
            </p>
            <p style={{ margin: 0, fontSize: '0.95rem', opacity: 0.9 }}>
              Vuoi decidere così sul serio — sulla tua carriera e la tua crescita?
            </p>
            <a
              href={NORTHSTAR_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{ marginTop: '0.2rem', fontWeight: 700, textDecoration: 'none', padding: '0.6rem 1.4rem', borderRadius: 'var(--radius-md)', background: 'var(--faction-a)', color: 'var(--bg)' }}
            >
              Scopri NorthStar →
            </a>
          </Card>
```

- [ ] **Step 3: Gate verde**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: tutto verde (la suite esistente non regredisce; la CTA è presentazionale).

- [ ] **Step 4: Commit**

```bash
git add client/src/shared/northstar.ts client/src/player/views/StatusView.tsx
git commit -m "feat(player): CTA fine partita verso NorthStar (link tracciato)"
```

---

## Task 3: Kit marketing — script dei 3 video hero

**Files:** Create `docs/marketing/script-video-hero.md`
**Acceptance:** 3 hero (Trailer 30s, Il Ponte 45s, Dilemma virale 20s), ciascuno con: obiettivo,
durata, gancio (primi 3s), script battuta-per-battuta, shot-list, testo a schermo, caption +
hashtag, CTA. Nessun placeholder.

- [ ] Scrivi il file con i 3 script completi.
- [ ] Rileggi: niente "TBD", ganci nei primi 3s, CTA coerente col ponte.

## Task 4: Kit marketing — pilastri + 30 ganci-dilemma

**Files:** Create `docs/marketing/pilastri-e-ganci-dilemma.md`
**Acceptance:** 4 pilastri descritti; 30 ganci-dilemma pronti (~20 vita/carriera, ~10 fun); una
sotto-sezione "Carriera" con i 12 dilemmi usati nel deck (Task 1) in forma A/B + spunti.

- [ ] Scrivi pilastri + 30 ganci (di cui i 12 carriera con optionA/optionB/spunti, riusabili nel JSON).

## Task 5: Kit marketing — calendario editoriale 4 settimane

**Files:** Create `docs/marketing/calendario-editoriale.md`
**Acceptance:** ritmo settimanale (regola "1 batch = 1 long + 5–8 verticali"); tabella 4 settimane
giorno-per-giorno con canale + formato + pilastro + CTA; checklist di pubblicazione.

- [ ] Scrivi ritmo + tabella 4 settimane + checklist.

## Task 6: Kit marketing — creator outreach

**Files:** Create `docs/marketing/creator-outreach.md`
**Acceptance:** criteri di scelta creator (carriera/università/giochi-da-tavolo); processo a
ondate; 3 template di messaggio (DM breve, email, follow-up); come dare codice affiliato NorthStar.

- [ ] Scrivi playbook + 3 template.

## Task 7: Kit marketing — tracking & link + indice

**Files:** Create `docs/marketing/tracking-e-link.md` e `docs/marketing/README.md`
**Acceptance:** schema UTM (source/medium/campaign per canale), come/dove appendere il codice
affiliato NorthStar, lista KPI settimanali + come leggerli; README come indice del kit.

- [ ] Scrivi tracking-e-link.md + README indice.
- [ ] Commit di tutto il kit marketing.

---

## Task 8: Verifica finale + push

- [ ] Gate verde completo: `npm run typecheck && npm run lint && npm test && npm run build`.
- [ ] `git push` del branch corrente sul remoto.
- [ ] Riepilogo all'utente con i punti che richiedono la sua autorizzazione (dominio NorthStar +
      codice affiliato; apertura account YT/IG; deploy della build col ponte).

---

## Self-Review (post-scrittura)

- **Spec coverage:** ponte prodotto → Task 1+2; contenuti/hero → Task 3; pilastri/ganci → Task 4;
  calendario → Task 5; creator → Task 6; funnel/tracking/KPI → Task 7. ✔
- **Placeholder scan:** `NORTHSTAR_URL` è costante configurabile documentata (non placeholder); i
  dilemmi del deck arrivano dal kit (Task 4 → Task 1). ✔
- **Type consistency:** `ContentRegister` allargato in deck.ts + events.ts + CONTENT_REGISTERS
  (server rooms.ts + client) + REGISTER_LABELS; test deck.test.ts aggiornato di conseguenza. ✔
