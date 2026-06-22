// One-off: tag existing `vita` dilemmas with a percorso `tappa` and append new
// dilemmas so each tappa has >=10. Idempotent: re-running yields the same file.
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'server', 'data', 'dilemmas.json');
const data = JSON.parse(fs.readFileSync(file, 'utf-8'));

const TAPPA = {
  // 1 — Le Basi (giovinezza, prime scelte, leggero/quotidiano)
  d15: 1, d28: 1, d30: 1, d33: 1, d35: 1, d37: 1, d40: 1, d41: 1, d42: 1, d44: 1, d45: 1,
  // 2 — I Bivi (carriera, soldi, relazioni serie)
  d01: 2, d03: 2, d08: 2, d09: 2, d12: 2, d22: 2, d23: 2, d36: 2,
  // 3 — I Legami (famiglia, lealtà, responsabilità)
  d24: 3, d25: 3, d26: 3, d27: 3, d29: 3, d32: 3, d34: 3, d39: 3,
  // 4 — I Bilanci (eredità, senso, esistenziale)
  d31: 4, d38: 4, d43: 4,
};

const NEW = [
  // Tappa 2
  {
    id: 'p01', tappa: 2,
    text: 'Ti offrono la promozione dei sogni, ma in un’altra città.',
    optionA: 'Accetto: la carriera prima di tutto',
    optionB: 'Resto: la mia vita è qui',
    spuntiA: ['Le occasioni grosse non aspettano', 'Ci si trasferisce, gli affetti veri restano', 'Crescere a volte chiede di partire'],
    spuntiB: ['Una vita non è solo lavoro', 'Le radici valgono più di un titolo', 'Il prezzo nascosto del trasloco è altissimo'],
  },
  {
    id: 'p02', tappa: 2,
    text: 'Stipendio doppio ma lavorando il triplo.',
    optionA: 'Accetto: è il momento di spingere',
    optionB: 'No: il tempo vale più dei soldi',
    spuntiA: ['C’è una stagione per accumulare', 'Il doppio oggi compra libertà domani', 'Da giovani si ha più energia da spendere'],
    spuntiB: ['Il tempo perso non torna', 'I soldi non comprano le sere a casa', 'Bruciarsi costa più di quanto rende'],
  },
  // Tappa 3
  {
    id: 'p03', tappa: 3,
    text: 'Un genitore anziano ha bisogno di te, ma rinunceresti a un’occasione importante.',
    optionA: 'Resto: la famiglia viene prima',
    optionB: 'Vado: devo vivere anche la mia vita',
    spuntiA: ['Chi c’è stato per te merita che tu ci sia', 'Certe occasioni non valgono un rimpianto', 'La cura è il senso vero dei legami'],
    spuntiB: ['Annullarsi non aiuta nessuno', 'Si può amare anche da lontano', 'Una vita rinviata diventa rancore'],
  },
  {
    id: 'p04', tappa: 3,
    text: 'Scopri che un familiare ha mentito a tutti per proteggere qualcuno.',
    optionA: 'Dico la verità, costi quel che costi',
    optionB: 'Taccio: certe bugie tengono unita la famiglia',
    spuntiA: ['La fiducia si fonda sulla verità', 'I segreti marciscono col tempo', 'Meglio una ferita pulita che una nascosta'],
    spuntiB: ['Non tutte le verità vanno dette', 'A volte il silenzio è un atto d’amore', 'Smontare una bugia può distruggere tutto'],
  },
  // Tappa 4
  {
    id: 'p05', tappa: 4,
    text: 'A fine vita, cosa vorresti aver fatto di più?',
    optionA: 'Aver osato di più',
    optionB: 'Aver amato di più',
    spuntiA: ['Si rimpiange ciò che non si è provato', 'Il coraggio dà sapore ai ricordi', 'Le occasioni perse pesano più degli errori'],
    spuntiB: ['Restano le persone, non i traguardi', 'L’amore è l’unica cosa che si moltiplica', 'Nessuno, alla fine, rimpiange di aver voluto bene'],
  },
  {
    id: 'p06', tappa: 4,
    text: 'Puoi lasciare una sola cosa a chi verrà dopo di te.',
    optionA: 'Un patrimonio che li renda liberi',
    optionB: 'Un esempio che li ispiri',
    spuntiA: ['La libertà economica apre ogni porta', 'Togliere il bisogno è già un grande dono', 'I valori senza mezzi restano sogni'],
    spuntiB: ['Si eredita più un esempio che un conto', 'I soldi finiscono, l’ispirazione no', 'Chi sei conta più di cosa lasci'],
  },
  {
    id: 'p07', tappa: 4,
    text: 'Vita lunga e tranquilla o breve e intensa?',
    optionA: 'Lunga e serena',
    optionB: 'Breve e intensa',
    spuntiA: ['Il tempo è la ricchezza più rara', 'La serenità è una conquista, non una resa', 'Le cose belle hanno bisogno di durare'],
    spuntiB: ['Meglio bruciare che spegnersi piano', 'Conta la profondità, non la lunghezza', 'Una vita intensa lascia il segno'],
  },
  {
    id: 'p08', tappa: 4,
    text: 'Preferiresti essere ricordato da molti o amato da pochi?',
    optionA: 'Ricordato da molti',
    optionB: 'Amato da pochi',
    spuntiA: ['Lasciare un segno è dare un senso', 'Chi ispira tanti non muore davvero', 'L’impatto vale più dell’intimità'],
    spuntiB: ['Pochi veri valgono più di mille volti', 'L’amore vicino scalda, la fama no', 'Si vive davvero negli occhi di chi ci ama'],
  },
  {
    id: 'p09', tappa: 4,
    text: 'Sai di avere un anno di vita: lo diresti a tutti o a nessuno?',
    optionA: 'Lo dico: voglio vivere senza maschere',
    optionB: 'Lo tengo per me: voglio normalità',
    spuntiA: ['La verità libera le ultime giornate', 'Gli altri meritano di salutarti', 'Vivere senza finzioni è un dono'],
    spuntiB: ['Non voglio sguardi di pietà', 'La normalità è l’ultimo lusso', 'Certi pesi è giusto portarli da soli'],
  },
  {
    id: 'p10', tappa: 4,
    text: 'Cosa rende una vita «riuscita»?',
    optionA: 'Aver realizzato il proprio potenziale',
    optionB: 'Aver reso felici gli altri',
    spuntiA: ['Sprecare i propri talenti è il vero fallimento', 'Diventare ciò che potevi essere è un dovere verso te stesso', 'Una vita piena parte da sé'],
    spuntiB: ['Ciò che resta è la felicità lasciata agli altri', 'Si misura una vita da quanto bene ha fatto', 'Nessuno è riuscito da solo'],
  },
  {
    id: 'p11', tappa: 4,
    text: 'Rifaresti esattamente la stessa vita, errori compresi?',
    optionA: 'Sì: gli errori mi hanno fatto',
    optionB: 'No: alcune cose le cambierei',
    spuntiA: ['Senza quegli errori non saresti tu', 'Ogni cicatrice racconta una lezione', 'Accettarsi è la pace più grande'],
    spuntiB: ['Imparare significa voler fare meglio', 'Alcuni dolori si potevano risparmiare', 'Desiderare di cambiare non è rinnegarsi'],
  },
];

// Rebuild each object with a clean key order (tappa after register); drop any
// stale `tappa` first so re-running is idempotent. Then drop previously-added
// percorso dilemmas (p*) and re-append, so the script is fully repeatable.
const base = data.filter((d) => !/^p\d+$/.test(d.id));
const rebuilt = base.map((d) => {
  const tappa = TAPPA[d.id];
  const out = { id: d.id, text: d.text, optionA: d.optionA, optionB: d.optionB, register: d.register };
  // Preserve a tappa set elsewhere (e.g. the h-series hard dilemmas) so re-running
  // this tagger never strips tappe it doesn't know about.
  if (tappa) out.tappa = tappa;
  else if (d.tappa != null) out.tappa = d.tappa;
  out.spuntiA = d.spuntiA;
  out.spuntiB = d.spuntiB;
  return out;
});
const appended = NEW.map((d) => ({
  id: d.id, text: d.text, optionA: d.optionA, optionB: d.optionB, register: 'vita', tappa: d.tappa, spuntiA: d.spuntiA, spuntiB: d.spuntiB,
}));
const result = [...rebuilt, ...appended];

fs.writeFileSync(file, JSON.stringify(result, null, 2) + '\n', 'utf-8');

const counts = { 1: 0, 2: 0, 3: 0, 4: 0 };
for (const d of result) if (d.tappa) counts[d.tappa]++;
console.log('total:', result.length, 'per tappa:', counts);
