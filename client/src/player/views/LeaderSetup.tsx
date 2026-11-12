import { useState, type Dispatch, SetStateAction } from 'react';
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
  type PartyMode,
} from '../../shared/events';
import { Card, Pill, Button, Alert } from '../../shared/ui';

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
  partyMode?: PartyMode | null;
  setPartyMode?: Dispatch<SetStateAction<PartyMode | null>>;
  partyIntensity?: 'complicita' | 'piccante';
  setPartyIntensity?: Dispatch<SetStateAction<'complicita' | 'piccante'>>;
  theme?: string;
  setTheme?: Dispatch<SetStateAction<string>>;
}

function durataLabel(min: number): string {
  if (min >= 90) return `~${Math.round(min / 60)}h`;
  return `~${min} min`;
}

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
  partyMode = 'flash',
  setPartyMode,
  partyIntensity = 'complicita',
  setPartyIntensity,
  theme = '',
  setTheme,
}: LeaderSetupProps) {
  const [activeTab, setActiveTab] = useState<'party' | 'classica'>('party');

  const isClassica = tipoPartita === 'classica';
  const isDuello = isClassica && gameMode === 'duello';
  const isPercorso = tipoPartita === 'percorso';
  const isStoria = tipoPartita === 'storia';
  const showSpecial = isPercorso || (isClassica && gameMode === 'gruppo');
  const discardsSubmitted = (isPercorso || isStoria) && submittedCount > 0;
  const storieGenres = [...new Set(storieCatalog.map((s) => s.genre))];
  const storieSubtitle =
    storieGenres.length > 0 ? storieGenres.map((g) => STORY_GENRE_LABELS[g]).join(' · ') : 'bivi da dibattere';

  const selectPartyMode = (mode: PartyMode) => {
    setPartyMode?.(mode);
    setTipoPartita('classica');
    setGameMode(mode === 'coppie' && humanCount === 2 ? 'duello' : 'gruppo');
    setInfiltratoOn(mode === 'infiltrato');
  };

  const switchToClassic = () => {
    setActiveTab('classica');
    setPartyMode?.(null);
  };

  const switchToParty = () => {
    setActiveTab('party');
    if (!partyMode) setPartyMode?.('flash');
  };

  return (
    <Card
      glow="accent"
      style={{
        width: 'min(92vw, 24rem)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
        alignItems: 'center',
        padding: '1.25rem 1rem',
      }}
    >
      <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Sei il leader — componi la serata</h3>

      {/* Tab Switcher */}
      <div
        style={{
          display: 'flex',
          width: '100%',
          background: 'rgba(0, 0, 0, 0.35)',
          padding: '0.25rem',
          borderRadius: 'var(--radius-pill, 999px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <button
          type="button"
          onClick={switchToParty}
          style={{
            flex: 1,
            padding: '0.5rem 0.6rem',
            borderRadius: '999px',
            border: 'none',
            background: activeTab === 'party' ? 'linear-gradient(135deg, #f59e0b 0%, #ec4899 100%)' : 'transparent',
            color: activeTab === 'party' ? '#fff' : 'rgba(255, 255, 255, 0.7)',
            fontWeight: 800,
            fontSize: '0.85rem',
            cursor: 'pointer',
            transition: 'all 150ms ease',
            textShadow: activeTab === 'party' ? '0 1px 2px rgba(0,0,0,0.4)' : undefined,
          }}
        >
          🔥 PARTY MODE
        </button>
        <button
          type="button"
          onClick={switchToClassic}
          style={{
            flex: 1,
            padding: '0.5rem 0.6rem',
            borderRadius: '999px',
            border: 'none',
            background: activeTab === 'classica' ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
            color: activeTab === 'classica' ? '#fff' : 'rgba(255, 255, 255, 0.7)',
            fontWeight: 700,
            fontSize: '0.82rem',
            cursor: 'pointer',
            transition: 'all 150ms ease',
          }}
        >
          🏛️ Modalità Classica
        </button>
      </div>

      {activeTab === 'party' ? (
        <>
          {/* Header Party Mode */}
          <div style={{ textAlign: 'center', width: '100%' }}>
            <h2
              style={{
                fontSize: '1.2rem',
                margin: 0,
                fontWeight: 900,
                letterSpacing: '0.02em',
                background: 'linear-gradient(90deg, #f59e0b, #ec4899, #8b5cf6)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              🎉 SCHIERATI PARTY GAME
            </h2>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', opacity: 0.8 }}>
              Zero overthinking · Risate, segreti & accuse in 5 secondi
            </p>
          </div>

          {/* 4 Hero Party Mode Buttons */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.6rem' }} role="group" aria-label="Modalità party">
            {/* Modalità 1: Flash */}
            <button
              type="button"
              onClick={() => selectPartyMode('flash')}
              style={{
                padding: '0.75rem 0.85rem',
                borderRadius: 'var(--radius-md)',
                border: partyMode === 'flash' ? '2px solid #f59e0b' : '1px solid rgba(245, 158, 11, 0.3)',
                background: partyMode === 'flash'
                  ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.25) 0%, rgba(30, 25, 15, 0.8) 100%)'
                  : 'rgba(25, 25, 40, 0.6)',
                color: 'var(--text)',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                boxShadow: partyMode === 'flash' ? '0 0 16px rgba(245, 158, 11, 0.4)' : undefined,
                transition: 'transform 100ms ease, border-color 100ms ease',
              }}
            >
              <span style={{ fontSize: '1.8rem', lineHeight: 1 }}>⚡</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.95rem', fontWeight: 900, color: '#f59e0b' }}>SCHIERATI FLASH</span>
                  <span style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', fontWeight: 700 }}>
                    3s voto · 15s blitz
                  </span>
                </div>
                <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', opacity: 0.85, lineHeight: 1.2 }}>
                  Dilemmi quotidiani divisivi. Chi è in minoranza beve e si difende dagli insulti!
                </p>
              </div>
            </button>

            {/* Modalità 2: Infiltrato */}
            <button
              type="button"
              onClick={() => selectPartyMode('infiltrato')}
              style={{
                padding: '0.75rem 0.85rem',
                borderRadius: 'var(--radius-md)',
                border: partyMode === 'infiltrato' ? '2px solid #a78bfa' : '1px solid rgba(167, 139, 250, 0.3)',
                background: partyMode === 'infiltrato'
                  ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.25) 0%, rgba(25, 20, 45, 0.8) 100%)'
                  : 'rgba(25, 25, 40, 0.6)',
                color: 'var(--text)',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                boxShadow: partyMode === 'infiltrato' ? '0 0 16px rgba(139, 92, 246, 0.4)' : undefined,
                transition: 'transform 100ms ease, border-color 100ms ease',
              }}
            >
              <span style={{ fontSize: '1.8rem', lineHeight: 1 }}>🕵️</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.95rem', fontWeight: 900, color: '#c084fc' }}>L'INFILTRATO</span>
                  <span style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(167, 139, 250, 0.2)', color: '#c084fc', fontWeight: 700 }}>
                    60s paranoia & accusa
                  </span>
                </div>
                <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', opacity: 0.85, lineHeight: 1.2 }}>
                  Domande segrete sui telefoni. 1 parola a testa, 60s di dibattito e accusa al volo!
                </p>
              </div>
            </button>

            {/* Modalità 3: Coppie & Scintille */}
            <div
              style={{
                borderRadius: 'var(--radius-md)',
                border: partyMode === 'coppie' ? '2px solid #f472b6' : '1px solid rgba(244, 114, 182, 0.3)',
                background: partyMode === 'coppie'
                  ? 'linear-gradient(135deg, rgba(236, 72, 153, 0.22) 0%, rgba(40, 15, 30, 0.8) 100%)'
                  : 'rgba(25, 25, 40, 0.6)',
                padding: '0.75rem 0.85rem',
                boxShadow: partyMode === 'coppie' ? '0 0 16px rgba(236, 72, 153, 0.4)' : undefined,
              }}
            >
              <button
                type="button"
                onClick={() => selectPartyMode('coppie')}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: 0,
                }}
              >
                <span style={{ fontSize: '1.8rem', lineHeight: 1 }}>🌶️</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.95rem', fontWeight: 900, color: '#f472b6' }}>COPPIE & SCINTILLE</span>
                    <span style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(244, 114, 182, 0.2)', color: '#f472b6', fontWeight: 700 }}>
                      Allineamento & Obbligo
                    </span>
                  </div>
                  <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', opacity: 0.85, lineHeight: 1.2 }}>
                    Al 3 indicate chi dei due... Coppia al centro o 1v1 con scommesse Matchano/Scoppiano!
                  </p>
                </div>
              </button>

              {partyMode === 'coppie' && (
                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.6rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(244, 114, 182, 0.25)' }}>
                  <button
                    type="button"
                    onClick={() => setPartyIntensity?.('complicita')}
                    style={{
                      flex: 1,
                      padding: '0.4rem',
                      borderRadius: 'var(--radius-sm)',
                      border: partyIntensity === 'complicita' ? '1.5px solid #ec4899' : '1px solid rgba(255,255,255,0.1)',
                      background: partyIntensity === 'complicita' ? 'rgba(236, 72, 153, 0.35)' : 'rgba(0,0,0,0.2)',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                    }}
                  >
                    💞 Complicità & Gelosia
                  </button>
                  <button
                    type="button"
                    onClick={() => setPartyIntensity?.('piccante')}
                    style={{
                      flex: 1,
                      padding: '0.4rem',
                      borderRadius: 'var(--radius-sm)',
                      border: partyIntensity === 'piccante' ? '1.5px solid #ef4444' : '1px solid rgba(255,255,255,0.1)',
                      background: partyIntensity === 'piccante' ? 'rgba(239, 68, 68, 0.35)' : 'rgba(0,0,0,0.2)',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                    }}
                  >
                    🔞 Piccante 18+
                  </button>
                </div>
              )}
            </div>

            {/* Modalità 4: Assurdo ma Semplice */}
            <button
              type="button"
              onClick={() => selectPartyMode('assurdo')}
              style={{
                padding: '0.75rem 0.85rem',
                borderRadius: 'var(--radius-md)',
                border: partyMode === 'assurdo' ? '2px solid #34d399' : '1px solid rgba(52, 211, 153, 0.3)',
                background: partyMode === 'assurdo'
                  ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.25) 0%, rgba(15, 35, 25, 0.8) 100%)'
                  : 'rgba(25, 25, 40, 0.6)',
                color: 'var(--text)',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                boxShadow: partyMode === 'assurdo' ? '0 0 16px rgba(52, 211, 153, 0.4)' : undefined,
                transition: 'transform 100ms ease, border-color 100ms ease',
              }}
            >
              <span style={{ fontSize: '1.8rem', lineHeight: 1 }}>🤡</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.95rem', fontWeight: 900, color: '#34d399' }}>ASSURDO MA SEMPLICE</span>
                  <span style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(52, 211, 153, 0.2)', color: '#34d399', fontWeight: 700 }}>
                    La Gogna & 500€
                  </span>
                </div>
                <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', opacity: 0.85, lineHeight: 1.2 }}>
                  "Chi tradirebbe tutti dopo 5 minuti?". Vota l'amico e incoronalo con la Sentenza dell'App!
                </p>
              </div>
            </button>
          </div>

          {/* Tema personalizzato della serata (Gemini Flash injection) */}
          <div style={{ width: '100%', marginTop: '0.2rem' }}>
            <label
              htmlFor="party-theme-input"
              style={{
                display: 'block',
                fontSize: '0.8rem',
                fontWeight: 800,
                color: 'var(--gold, #f59e0b)',
                marginBottom: '0.3rem',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              🔥 Tema della Serata (opzionale):
            </label>
            <input
              id="party-theme-input"
              type="text"
              value={theme}
              onChange={(e) => setTheme?.(e.target.value)}
              placeholder="es. Addio al celibato di Marco, Coinquilini fuorisede..."
              style={{
                width: '100%',
                padding: '0.6rem 0.75rem',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#fff',
                fontSize: '0.85rem',
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
            <span style={{ fontSize: '0.7rem', opacity: 0.65, display: 'block', marginTop: '0.2rem' }}>
              ✨ Gemini Flash genererà domande e dilemmi su misura per il vostro gruppo!
            </span>
          </div>

          {/* Durata Party */}
          <div style={{ width: '100%', marginTop: '0.2rem' }}>
            <p style={{ opacity: 0.85, margin: '0 0 0.4rem', fontSize: '0.8rem', fontWeight: 700 }}>
              Durata della sessione:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem' }}>
              <Pill selected={format === 'assaggio'} onClick={() => setFormat('assaggio')}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800 }}>⚡ ~15 min</span>
              </Pill>
              <Pill selected={format === 'classica'} onClick={() => setFormat('classica')}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800 }}>🚀 ~30 min</span>
              </Pill>
              <Pill selected={format === 'maratona'} onClick={() => setFormat('maratona')}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800 }}>💥 ~45 min</span>
              </Pill>
            </div>
          </div>

          {humanCount === 2 && gameMode === 'gruppo' && (
            <p style={{ opacity: 0.8, margin: '0.2rem 0 0', fontSize: '0.85rem', textAlign: 'center' }}>
              Siete in 2: provate il{' '}
              <button
                type="button"
                onClick={() => {
                  setGameMode('duello');
                  setPartyMode?.('coppie');
                }}
                style={{ background: 'none', border: 'none', padding: 0, color: 'var(--gold)', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
              >
                Duello
              </button>
              ?
            </p>
          )}

          {/* Bot addition helper */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'center' }}>
            <Button variant="ghost" onClick={onAddBot} disabled={!canAddBot}>
              + Aggiungi bot 🤖
            </Button>
            {gameMode === 'gruppo' && humanCount === 2 && (
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
          </div>

          {/* Hero START Button */}
          <Button
            variant="primary"
            size="lg"
            onClick={onStart}
            disabled={!canStart}
            style={{
              width: '100%',
              padding: '0.9rem',
              fontSize: '1.15rem',
              fontWeight: 900,
              letterSpacing: '0.04em',
              background: canStart
                ? 'linear-gradient(135deg, #f59e0b 0%, #ec4899 50%, #8b5cf6 100%)'
                : undefined,
              boxShadow: canStart ? '0 0 20px rgba(245, 158, 11, 0.5)' : undefined,
              border: canStart ? '2px solid rgba(255, 255, 255, 0.4)' : undefined,
              marginTop: '0.4rem',
            }}
          >
            INIZIA LA FESTA 🚀 · Avvia partita
          </Button>

          {!canStart && (
            <p style={{ opacity: 0.7, margin: 0, fontSize: '0.8rem', textAlign: 'center' }}>
              {partyMode === 'infiltrato' && humanCount < 3
                ? "L'Infiltrato richiede almeno 3 giocatori per divertirsi!"
                : humanCount < 1
                  ? 'Serve almeno un giocatore reale.'
                  : `Servono almeno ${MIN_PLAYERS_TO_START} partecipanti: aggiungi amici o bot 🤖`}
            </p>
          )}

          {startError && <Alert>{startError}</Alert>}
        </>
      ) : (
        <>
          {/* TAB 2: MODALITÀ CLASSICA (Dilemmi Filosofici, Percorso, Storie) */}
          <div style={{ width: '100%', textAlign: 'center' }}>
            <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Modalità Classica & Percorsi</h3>
            <p style={{ opacity: 0.7, fontSize: '0.8rem', margin: '0.2rem 0 0' }}>
              Dilemmi filosofici, ascesa tematica della vita o storie narrative
            </p>
          </div>

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
        </>
      )}
    </Card>
  );
}
