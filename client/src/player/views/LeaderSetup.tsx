import type { Dispatch, SetStateAction } from 'react';
import {
  MODE_LABELS,
  CONTENT_REGISTERS,
  REGISTER_LABELS,
  SESSION_FORMATS,
  FORMAT_LABELS,
  TAPPE,
  DURATE,
  DURATA_LABELS,
  STORY_GENRE_LABELS,
  MOODS,
  MOOD_LABELS,
  CAOS_LEVELS,
  CAOS_LABELS,
  estimatePercorsoDilemmi,
  MIN_PLAYERS_TO_START,
  MIN_INFILTRATO_HUMANS,
  MIN_SQUADRE_PLAYERS,
  type GameMode,
  type ContentRegister,
  type SessionFormat,
  type Durata,
  type TappaCounts,
  type StoriaCatalogItem,
  type Mood,
  type Caos,
} from '../../shared/events';
import { Card, Pill, Button, Alert } from '../../shared/ui';

/** Which kind of evening the leader is composing. */
export type TipoPartita = 'classica' | 'percorso' | 'storia';

interface LeaderSetupProps {
  tipoPartita: TipoPartita;
  setTipoPartita: Dispatch<SetStateAction<TipoPartita>>;
  gameMode: GameMode;
  setGameMode: Dispatch<SetStateAction<GameMode>>;
  register: ContentRegister;
  setRegister: Dispatch<SetStateAction<ContentRegister>>;
  mood: Mood;
  setMood: Dispatch<SetStateAction<Mood>>;
  caos: Caos;
  setCaos: Dispatch<SetStateAction<Caos>>;
  delicatoOptIn: boolean;
  setDelicatoOptIn: Dispatch<SetStateAction<boolean>>;
  serataLunga: boolean;
  setSerataLunga: Dispatch<SetStateAction<boolean>>;
  format: SessionFormat;
  setFormat: Dispatch<SetStateAction<SessionFormat>>;
  startTappa: number;
  setStartTappa: Dispatch<SetStateAction<number>>;
  durata: Durata;
  setDurata: Dispatch<SetStateAction<Durata>>;
  storyId: string;
  setStoryId: Dispatch<SetStateAction<string>>;
  storieCatalog: StoriaCatalogItem[];
  /** How many player-written dilemmas the group has added so far (LOBBY) —
   * only Classica/Duello actually play them; Percorso/Storia discard them. */
  submittedCount: number;
  infiltratoOn: boolean;
  setInfiltratoOn: Dispatch<SetStateAction<boolean>>;
  squadreOn: boolean;
  setSquadreOn: Dispatch<SetStateAction<boolean>>;
  tappaCounts: TappaCounts | null | undefined;
  humanCount: number;
  canAddBot: boolean;
  onAddBot: () => void;
  canStart: boolean;
  onStart: () => void;
  startError: string | null;
}

/** Roughly format a minutes estimate as "~Nh" / "~N min" for the story picker. */
function durataLabel(min: number): string {
  if (min >= 90) return `~${Math.round(min / 60)}h`;
  return `~${min} min`;
}

// The leader-only "compose the evening" lobby panel: kind of game (classic /
// percorso / storia), mode, content register, session length, percorso start-tappa
// + duration, the story picker, the special modes (infiltrato / squadre), add-bot,
// and start. Presentational: the parent owns all the setup state + the emits.
export default function LeaderSetup({
  tipoPartita,
  setTipoPartita,
  gameMode,
  setGameMode,
  register,
  setRegister,
  mood,
  setMood,
  caos,
  setCaos,
  delicatoOptIn,
  setDelicatoOptIn,
  serataLunga,
  setSerataLunga,
  format,
  setFormat,
  startTappa,
  setStartTappa,
  durata,
  setDurata,
  storyId,
  setStoryId,
  storieCatalog,
  submittedCount,
  infiltratoOn,
  setInfiltratoOn,
  squadreOn,
  setSquadreOn,
  tappaCounts,
  humanCount,
  canAddBot,
  onAddBot,
  canStart,
  onStart,
  startError,
}: LeaderSetupProps) {
  const isClassica = tipoPartita === 'classica';
  const isDuello = isClassica && gameMode === 'duello';
  const isPercorso = tipoPartita === 'percorso';
  const isStoria = tipoPartita === 'storia';
  const showSpecial = isPercorso || (isClassica && gameMode === 'gruppo');
  // 4.4: which discards the group's own written dilemmas (only Classica/Duello play them).
  const discardsSubmitted = (isPercorso || isStoria) && submittedCount > 0;
  // 4.4: the Storie pill's subtitle reflects the REAL genres on offer, not a
  // hardcoded "sci-fi" claim — every story is sci-fi-*framed*, but the actual
  // flavors (survival, dystopia, mystery, drama) vary story to story.
  const storieGenres = [...new Set(storieCatalog.map((s) => s.genre))];
  const storieSubtitle =
    storieGenres.length > 0 ? storieGenres.map((g) => STORY_GENRE_LABELS[g]).join(' · ') : 'bivi da dibattere';
  return (
    <Card
      glow="accent"
      style={{ width: 'min(90vw, 22rem)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', alignItems: 'center' }}
    >
      <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Sei il leader — componi la serata</h3>

      <div style={{ width: '100%' }}>
        <p style={{ opacity: 0.8, margin: '0 0 0.4rem' }}>Tipo di partita</p>
        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center', flexWrap: 'wrap' }} role="group" aria-label="Tipo di partita">
          <Pill
            selected={isClassica && gameMode === 'gruppo'}
            onClick={() => {
              setTipoPartita('classica');
              setGameMode('gruppo');
            }}
            aria-label="Gruppo: 3, 5 o 7 dilemmi, 3-8 persone"
          >
            <span style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', lineHeight: 1.1 }}>
              <span style={{ fontWeight: 700 }}>{MODE_LABELS.gruppo.nome}</span>
              <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>3 · 5 · 7 dilemmi</span>
            </span>
          </Pill>
          <Pill
            selected={isDuello}
            onClick={() => {
              setTipoPartita('classica');
              setGameMode('duello');
            }}
            aria-label="1v1 Duello, 2 giocatori"
          >
            <span style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', lineHeight: 1.1 }}>
              <span style={{ fontWeight: 700 }}>{MODE_LABELS.duello.nome}</span>
              <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>{MODE_LABELS.duello.descr}</span>
            </span>
          </Pill>
          <Pill
            selected={isPercorso}
            onClick={() => {
              setTipoPartita('percorso');
              setGameMode('gruppo');
            }}
            aria-label="Percorso: salita a tappe, 1-3 ore"
          >
            <span style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', lineHeight: 1.1 }}>
              <span style={{ fontWeight: 700 }}>🧗 Percorso</span>
              <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>salita a tappe · 1–3h</span>
            </span>
          </Pill>
          <Pill
            selected={isStoria}
            onClick={() => {
              setTipoPartita('storia');
              setGameMode('gruppo');
              if (!storyId && storieCatalog[0]) setStoryId(storieCatalog[0].id);
            }}
            aria-label={`Storie: ${storieSubtitle}, con bivi da dibattere`}
          >
            <span style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', lineHeight: 1.1 }}>
              <span style={{ fontWeight: 700 }}>📖 Storie</span>
              <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>{storieSubtitle}</span>
            </span>
          </Pill>
        </div>
        {discardsSubmitted && (
          <p style={{ opacity: 0.75, margin: '0.5rem 0 0', fontSize: '0.8rem', textAlign: 'center', color: 'var(--gold)' }}>
            ⚠️ {isPercorso ? 'Percorso' : 'Storie'} non usa i {submittedCount} dilemmi scritti dal gruppo — restano per un'altra partita.
          </p>
        )}
      </div>

      {isClassica && (
        <>
          <div style={{ width: '100%' }}>
            <p style={{ opacity: 0.8, margin: '0 0 0.4rem' }}>Mood della serata</p>
            <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center', flexWrap: 'wrap' }} role="group" aria-label="Mood della serata">
              {MOODS.map((m) => (
                <Pill
                  key={m}
                  selected={mood === m}
                  onClick={() => setMood(m)}
                  aria-label={`${MOOD_LABELS[m].nome}, ${MOOD_LABELS[m].descr}`}
                >
                  <span style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', lineHeight: 1.1 }}>
                    <span style={{ fontWeight: 700 }}>{MOOD_LABELS[m].nome}</span>
                    <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>{MOOD_LABELS[m].descr}</span>
                  </span>
                </Pill>
              ))}
            </div>
          </div>

          <div style={{ width: '100%' }}>
            <p style={{ opacity: 0.8, margin: '0 0 0.4rem' }}>Durata</p>
            <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center', flexWrap: 'wrap' }} role="group" aria-label="Formato">
              {SESSION_FORMATS.map((f) => (
                <Pill
                  key={f}
                  selected={format === f}
                  onClick={() => setFormat(f)}
                  aria-label={`${FORMAT_LABELS[f].nome}, ${FORMAT_LABELS[f].round} round, ${FORMAT_LABELS[f].durata}`}
                >
                  <span style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', lineHeight: 1.1 }}>
                    <span style={{ fontWeight: 700 }}>{FORMAT_LABELS[f].nome}</span>
                    <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                      {FORMAT_LABELS[f].round} round · {FORMAT_LABELS[f].durata}
                    </span>
                  </span>
                </Pill>
              ))}
            </div>
          </div>

          <div style={{ width: '100%' }}>
            <p style={{ opacity: 0.8, margin: '0 0 0.4rem' }}>Caos (twist a sorpresa)</p>
            <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center', flexWrap: 'wrap' }} role="group" aria-label="Caos">
              {CAOS_LEVELS.map((c) => (
                <Pill
                  key={c}
                  selected={caos === c}
                  onClick={() => setCaos(c)}
                  aria-label={`${CAOS_LABELS[c].nome}, ${CAOS_LABELS[c].descr}`}
                >
                  <span style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', lineHeight: 1.1 }}>
                    <span style={{ fontWeight: 700 }}>{CAOS_LABELS[c].nome}</span>
                    <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>{CAOS_LABELS[c].descr}</span>
                  </span>
                </Pill>
              ))}
            </div>
          </div>
        </>
      )}

      {isPercorso && (
        <>
          <div style={{ width: '100%' }}>
            <p style={{ opacity: 0.8, margin: '0 0 0.4rem' }}>Tappa di partenza</p>
            <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center', flexWrap: 'wrap' }} role="group" aria-label="Tappa di partenza">
              {TAPPE.map((t) => (
                <Pill
                  key={t.id}
                  selected={startTappa === t.id}
                  onClick={() => setStartTappa(t.id)}
                  aria-label={`${t.nome}: ${t.sottotitolo}`}
                >
                  <span style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', lineHeight: 1.1 }}>
                    <span style={{ fontWeight: 700 }}>{t.emoji} {t.nome}</span>
                    <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>{t.sottotitolo}</span>
                  </span>
                </Pill>
              ))}
            </div>
            <p style={{ opacity: 0.6, margin: '0.35rem 0 0', fontSize: '0.8rem', textAlign: 'center' }}>
              Si sale fino a 🌅 I Bilanci.
            </p>
          </div>

          <div style={{ width: '100%' }}>
            <p style={{ opacity: 0.8, margin: '0 0 0.4rem' }}>Durata</p>
            <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center', flexWrap: 'wrap' }} role="group" aria-label="Durata percorso">
              {DURATE.map((d) => (
                <Pill
                  key={d}
                  selected={durata === d}
                  onClick={() => setDurata(d)}
                  aria-label={`${DURATA_LABELS[d].nome}, ${DURATA_LABELS[d].durata}`}
                >
                  <span style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', lineHeight: 1.1 }}>
                    <span style={{ fontWeight: 700 }}>{DURATA_LABELS[d].nome}</span>
                    <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>{DURATA_LABELS[d].durata}</span>
                  </span>
                </Pill>
              ))}
            </div>
            <p style={{ opacity: 0.6, margin: '0.35rem 0 0', fontSize: '0.8rem', textAlign: 'center' }}>
              ~{estimatePercorsoDilemmi(tappaCounts, startTappa, durata)} dilemmi · {DURATA_LABELS[durata].durata}
            </p>
          </div>
        </>
      )}

      {isStoria && (
        <div style={{ width: '100%' }}>
          <p style={{ opacity: 0.8, margin: '0 0 0.4rem' }}>Scegli la storia</p>
          {storieCatalog.length === 0 ? (
            <p style={{ opacity: 0.6, margin: 0, fontSize: '0.85rem', textAlign: 'center' }}>
              Nessuna storia disponibile.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }} role="group" aria-label="Storie">
              {storieCatalog.map((s) => (
                <Pill
                  key={s.id}
                  selected={storyId === s.id}
                  onClick={() => setStoryId(s.id)}
                  aria-label={`${s.title}: ${s.hook}`}
                  style={{ width: '100%', justifyContent: 'center', textAlign: 'center' }}
                >
                  <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem', lineHeight: 1.15 }}>
                    <span style={{ fontWeight: 700 }}>{s.emoji} {s.title}</span>
                    <span style={{ fontSize: '0.78rem', opacity: 0.8 }}>{s.hook}</span>
                    <span style={{ fontSize: '0.72rem', opacity: 0.6 }}>
                      {STORY_GENRE_LABELS[s.genre]} · {s.scene} bivi · {durataLabel(s.durataStimaMin)}
                    </span>
                  </span>
                </Pill>
              ))}
            </div>
          )}
          <p style={{ opacity: 0.6, margin: '0.45rem 0 0', fontSize: '0.8rem', textAlign: 'center' }}>
            🔊 La storia è letta ad alta voce dal tuo telefono (sei tu il narratore). Tutti la leggono anche come testo.
          </p>
        </div>
      )}

      {/* Secondary tuning tucked behind a disclosure so the default view isn't a wall:
          most leaders just pick the type/duration and hit Avvia. Hidden in storia
          (the curated tale disables registers + special modes). */}
      {!isStoria && (
        <details style={{ width: '100%' }}>
          <summary style={{ cursor: 'pointer', opacity: 0.8, fontSize: '0.9rem', textAlign: 'center' }}>
            Altre opzioni ·{' '}
            {[isClassica && 'argomenti', showSpecial && 'modalità speciale'].filter(Boolean).join(' e ')}
          </summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginTop: '0.7rem' }}>
            {isClassica && (
              <div style={{ width: '100%' }}>
                <p style={{ opacity: 0.8, margin: '0 0 0.4rem' }}>Argomenti</p>
                <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center', flexWrap: 'wrap' }} role="group" aria-label="Registro">
                  {CONTENT_REGISTERS.map((r) => (
                    <Pill
                      key={r}
                      selected={register === r}
                      onClick={() => setRegister(r)}
                      aria-label={REGISTER_LABELS[r]}
                    >
                      {REGISTER_LABELS[r]}
                    </Pill>
                  ))}
                </div>
              </div>
            )}

            {isClassica && (
              <div style={{ width: '100%' }}>
                <Pill
                  selected={delicatoOptIn}
                  onClick={() => setDelicatoOptIn((v) => !v)}
                  aria-label="Includi temi delicati (eutanasia, lutto)"
                >
                  ⚠️ Temi delicati {delicatoOptIn ? 'ON' : 'OFF'}
                </Pill>
                <p style={{ opacity: 0.6, margin: '0.35rem 0 0', fontSize: '0.8rem', textAlign: 'center' }}>
                  Di norma escludiamo i dilemmi più pesanti (eutanasia, lutto) — attiva se il gruppo se la sente.
                </p>
              </div>
            )}

            <div style={{ width: '100%' }}>
              <Pill
                selected={serataLunga}
                onClick={() => setSerataLunga((v) => !v)}
                aria-label="Serata lunga: 180s per difesa invece di 90s"
              >
                🕰️ Serata lunga {serataLunga ? 'ON' : 'OFF'}
              </Pill>
              <p style={{ opacity: 0.6, margin: '0.35rem 0 0', fontSize: '0.8rem', textAlign: 'center' }}>
                {serataLunga ? '180s per difesa — più tempo per approfondire.' : '90s per difesa (default).'}
              </p>
            </div>

            {showSpecial && (
              <div style={{ width: '100%' }}>
                <p style={{ opacity: 0.8, margin: '0 0 0.4rem' }}>Modalità speciale</p>
                <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <Pill
                    selected={infiltratoOn}
                    onClick={() => {
                      setInfiltratoOn((v) => !v);
                      setSquadreOn(false);
                    }}
                    aria-label="L'Infiltrato (un giocatore segreto)"
                  >
                    🕵️ L'Infiltrato {infiltratoOn ? 'ON' : 'OFF'}
                  </Pill>
                  <Pill
                    selected={squadreOn}
                    onClick={() => {
                      setSquadreOn((v) => !v);
                      setInfiltratoOn(false);
                    }}
                    aria-label="Squadre (Blu contro Arancio)"
                  >
                    🔵🟠 Squadre {squadreOn ? 'ON' : 'OFF'}
                  </Pill>
                </div>
                <p style={{ opacity: 0.6, margin: '0.35rem 0 0', fontSize: '0.8rem', textAlign: 'center' }}>
                  {squadreOn
                    ? `Blu contro Arancio: vince chi convince di più · servono ≥${MIN_SQUADRE_PLAYERS} giocatori`
                    : `Un giocatore segreto deve ribaltare il gruppo · servono ≥${MIN_INFILTRATO_HUMANS} persone`}
                </p>
              </div>
            )}
          </div>
        </details>
      )}

      <Button variant="ghost" onClick={onAddBot} disabled={!canAddBot}>
        + Aggiungi bot 🤖
      </Button>

      {isClassica && gameMode === 'gruppo' && humanCount === 2 && (
        <Button
          variant="ghost"
          onClick={() => {
            onAddBot();
            onAddBot();
          }}
          disabled={!canAddBot}
        >
          🤖🤖 Preset: 2 umani + 2 bot
        </Button>
      )}

      <Button variant="primary" size="lg" onClick={onStart} disabled={!canStart}>
        Avvia partita
      </Button>
      {!canStart && (
        <p style={{ opacity: 0.6, margin: 0, fontSize: '0.85rem' }}>
          {gameMode === 'duello'
            ? 'Il 1v1 richiede esattamente 2 giocatori.'
            : humanCount < 1
              ? 'Serve almeno una persona (i bot da soli non bastano).'
              : `Servono almeno ${MIN_PLAYERS_TO_START} partecipanti: aggiungi giocatori o bot 🤖`}
        </p>
      )}
      {startError && <Alert>{startError}</Alert>}
    </Card>
  );
}
