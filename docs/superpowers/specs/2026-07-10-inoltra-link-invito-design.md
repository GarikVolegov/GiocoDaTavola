# Inoltra il link d'invito — design

**Data:** 2026-07-10
**Stato:** approvato dall'utente, pronto per il piano di implementazione

## Problema

Durante la creazione della partita, il leader vede il codice stanza e un QR
(`JoinQr`) nella schermata "Sei nella stanza" (`client/src/player/PlayerApp.tsx`,
lobby view ~L972-992). Non c'è modo di inoltrare il link di invito direttamente
via chat (WhatsApp, Messaggi, Telegram...) o di copiarlo negli appunti: chi
vuole invitare qualcuno a distanza deve dettare il codice o far inquadrare il
QR di persona.

## Soluzione

Aggiungere un pulsante **"Inoltra invito"** nella lobby, subito sotto il QR
esistente.

### Comportamento (in ordine di fallback)

1. **Web Share API** (`navigator.share`), se disponibile:
   ```js
   navigator.share({
     title: 'Schierati',
     text: 'Unisciti alla mia partita su Schierati!',
     url: `${window.location.origin}/join?room=${code}`,
   })
   ```
   Apre il pannello di condivisione nativo del telefono.

2. **Fallback clipboard** (`navigator.clipboard.writeText`), se `navigator.share`
   non esiste o lancia (l'utente annulla il pannello nativo non deve triggerare
   il fallback — solo l'assenza dell'API, o un errore diverso da `AbortError`):
   copia `"${text}\n${url}"` negli appunti e mostra un feedback visivo
   "Link copiato ✓" per ~2s, riusando il pattern già presente altrove
   nell'app (memoria `chiarezza-ingame-telefono`: "✓ Hai confermato").

3. **Fallback finale**: se anche `clipboard.writeText` fallisce (permessi
   negati, contesto non sicuro), mostrare il link in chiaro come testo
   selezionabile così l'utente può copiarlo a mano.

### Contenuto condiviso

Messaggio + link (non il link nudo): `"Unisciti alla mia partita su Schierati!"`
seguito dall'URL. Stesso URL già generato da `JoinQr`:
`${window.location.origin}/join?room=${code}`.

### Dove

Solo nella lobby post-creazione (`PlayerApp.tsx`, vista `joinedCode`), subito
sotto `<JoinQr code={joinedCode} />`. Nessuna modifica a `/host` o a
`RoomCodeChip`: fuori scope per questa iterazione.

## Componente

Nuovo file `client/src/shared/ui/ShareInviteButton.tsx`:

```ts
interface ShareInviteButtonProps {
  code: string; // room code, stessa prop di JoinQr
}
```

Costruisce l'URL internamente (stessa logica di `JoinQr`), non riceve l'URL
già pronto — evita di duplicare la logica di costruzione URL in due punti se
mai cambiasse il formato.

Stato interno: idle → "copiato" (dopo fallback clipboard riuscito) → torna a
idle dopo ~2s. Se il fallback finale scatta (link in chiaro), lo stato resta
in quella modalità finché il componente non viene rimontato (non c'è un modo
sensato di "annullare" quello stato).

## Testing

`navigator.share` e `navigator.clipboard` non esistono in jsdom di default:
il test stubba questi globals su `window.navigator` per ciascun caso.

Casi da coprire:
1. `navigator.share` disponibile → click chiama `share` con i parametri
   corretti (title/text/url).
2. `navigator.share` assente, `clipboard.writeText` disponibile → click copia
   `text + url`, mostra "Link copiato ✓", poi torna allo stato idle.
3. `navigator.share` assente, `clipboard.writeText` assente/fallisce → click
   mostra il link in chiaro come testo selezionabile.
4. `navigator.share` presente ma l'utente annulla il pannello (`AbortError`)
   → nessun fallback, nessun cambiamento di stato visibile (non è un errore
   da gestire, è un annullamento volontario).

## Fuori scope

- Nessuna modifica allo schema URL di join (`/join?room=CODE` esistente,
  invariato).
- Nessuna modifica a `/host` / `RoomCodeChip`.
- Nessun tracking/analytics su quante volte viene condiviso il link.
