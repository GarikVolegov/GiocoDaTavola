import { useState, type Dispatch, SetStateAction } from 'react';
import {
  MODE_LABELS,
  CONTENT_REGISTERS,
  REGISTER_LABELS,
  SESSION_FORMATS,
  FORMAT_LABELS,
  CORSIE_META,
  PERCORSI_CATALOG,
  getPercorsoMeta,
  DURATE,
  DURATA_LABELS,
  STORY_GENRE_LABELS,
  MOODS,
  MOOD_LABELS,
  FAMILIARITA_VALUES,
  FAMILIARITA_LABELS,
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
  type PercorsoCounts,
  type CorsiaTono,
  type CoppieIntensity,
  type InfiltratoTono,
  type StoriaCatalogItem,
  type Mood,
  type Familiarita,
  type Caos,
  type PartyMode,
} from '../../shared/events';
import { Card, Pill, Button, Alert } from '../../shared/ui';
import lobbyStyles from './LobbyScreen.module.css';

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
  percorsoId?: string;
  setPercorsoId?: Dispatch<SetStateAction<string>>;
  percorsoCounts?: PercorsoCounts | null;
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
  canStart: boolean;
  onStart: () => void;
  startError: string | null;
  partyMode?: PartyMode | null;
  setPartyMode?: Dispatch<SetStateAction<PartyMode | null>>;
  partyIntensity?: CoppieIntensity;
  setPartyIntensity?: Dispatch<SetStateAction<CoppieIntensity>>;
  infiltratoTono?: InfiltratoTono;
  setInfiltratoTono?: Dispatch<SetStateAction<InfiltratoTono>>;
  familiarita?: Familiarita;
  setFamiliarita?: Dispatch<SetStateAction<Familiarita>>;
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
  percorsoId = 'bussola',
  setPercorsoId,
  percorsoCounts,
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
  canStart,
  onStart,
  startError,
  partyMode = 'flash',
  setPartyMode,
  partyIntensity = 'complicita',
  setPartyIntensity,
  infiltratoTono = 'misto',
  setInfiltratoTono,
  familiarita = 'vecchi_amici',
  setFamiliarita,
  theme = '',
  setTheme,
}: LeaderSetupProps) {
  const [activeTab, setActiveTab] = useState<'party' | 'classica'>('party');
  const [openInfo, setOpenInfo] = useState<string | null>(null);
  const toggleInfo = (id: string) => setOpenInfo((cur) => (cur === id ? null : id));

  const renderInfoBtn = (id: string, _label: string) => {
    const active = openInfo === id;
    return (
      <button
        type="button"
        aria-label="Dettagli opzione"
        aria-expanded={active}
        onClick={() => toggleInfo(id)}
        style={{
          minWidth: '2.75rem',
          minHeight: '2.75rem',
          padding: 0,
          borderRadius: 'var(--radius-md)',
          border: active ? '1.5px solid var(--gold)' : '1px solid rgba(255, 255, 255, 0.14)',
          background: active ? 'rgba(229, 193, 88, 0.16)' : 'rgba(255, 255, 255, 0.04)',
          color: active ? 'var(--gold)' : 'rgba(255, 255, 255, 0.72)',
          fontSize: '0.9rem',
          fontWeight: 700,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        ⓘ
      </button>
    );
  };

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
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        alignItems: 'center',
        padding: '1rem 0.95rem',
      }}
    >
      <h2 style={{ fontSize: '1.05rem', margin: 0 }}>Sei il leader — componi la serata</h2>

      {/* Group Familiarity Selector: Vecchi amici vs Nuove conoscenze */}
      <div
        role="group"
        aria-label="Con chi giochi"
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem',
        }}
      >
        <div
          style={{
            fontSize: '0.7rem',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--muted)',
            fontWeight: 700,
          }}
        >
          Con chi giochi?
        </div>
        <div style={{ display: 'flex', gap: '0.45rem', width: '100%' }}>
          {FAMILIARITA_VALUES.map((fam) => {
            const active = familiarita === fam;
            const meta = FAMILIARITA_LABELS[fam];
            return (
              <div key={fam} style={{ flex: 1, display: 'flex', gap: '0.25rem', alignItems: 'stretch', minWidth: 0 }}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFamiliarita?.(fam)}
                  style={{
                    flex: 1,
                    minHeight: '2.75rem',
                    textAlign: 'left',
                    padding: '0.45rem 0.65rem',
                    borderRadius: '0.7rem',
                    border: active ? '1.5px solid var(--gold)' : '1px solid rgba(255, 255, 255, 0.14)',
                    background: active ? 'rgba(229, 193, 88, 0.14)' : 'rgba(255, 255, 255, 0.04)',
                    color: active ? '#fff' : 'rgba(255, 255, 255, 0.85)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    fontWeight: 800,
                    fontSize: '0.82rem',
                    transition: 'all 140ms ease',
                  }}
                >
                  {meta.nome}
                </button>
                {renderInfoBtn(`fam-${fam}`, meta.nome)}
              </div>
            );
          })}
        </div>
        {openInfo?.startsWith('fam-') && (
          <p style={{ margin: '0.15rem 0 0', padding: '0.45rem 0.65rem', borderRadius: '0.55rem', background: 'rgba(255,255,255,0.06)', fontSize: '0.76rem', opacity: 0.9, lineHeight: 1.3 }}>
            {FAMILIARITA_LABELS[openInfo.replace('fam-', '') as keyof typeof FAMILIARITA_LABELS]?.descr}
          </p>
        )}
      </div>

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
            minHeight: '2.75rem',
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
            minHeight: '2.75rem',
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
          {/* Hero Party Mode Buttons (titles only; details behind ⓘ) */}
          <div className={lobbyStyles.partyGrid} role="group" aria-label="Modalità party">
            {/* Modalità 0: Serata Mix Variabile */}
            <div className={lobbyStyles.partyFeatured} style={{ display: 'flex', gap: '0.35rem', alignItems: 'stretch' }}>
              <button
                type="button"
                onClick={() => selectPartyMode('mix')}
                style={{
                  flex: 1,
                  minHeight: '2.9rem',
                  padding: '0.55rem 0.8rem',
                  borderRadius: 'var(--radius-md)',
                  border: partyMode === 'mix' ? '2px solid var(--gold)' : '1px solid rgba(229, 193, 88, 0.35)',
                  background: partyMode === 'mix'
                    ? 'linear-gradient(135deg, rgba(229, 193, 88, 0.25) 0%, rgba(20, 26, 52, 0.85) 100%)'
                    : 'rgba(25, 25, 40, 0.6)',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.55rem',
                  boxShadow: partyMode === 'mix' ? '0 0 14px rgba(229, 193, 88, 0.32)' : undefined,
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55rem', fontSize: '0.92rem', fontWeight: 900, color: 'var(--gold)' }}>
                  <span style={{ fontSize: '1.35rem', lineHeight: 1 }}>🎲</span>
                  SERATA MIX
                </span>
                <span style={{ fontSize: '0.66rem', padding: '0.12rem 0.4rem', borderRadius: '4px', background: 'rgba(229, 193, 88, 0.2)', color: 'var(--gold)', fontWeight: 700 }}>
                  Consigliata
                </span>
              </button>
              {renderInfoBtn('party-mix', 'Serata Mix')}
            </div>

            {/* Modalità 1: Flash */}
            <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'stretch' }}>
              <button
                type="button"
                onClick={() => selectPartyMode('flash')}
                style={{
                  flex: 1,
                  minHeight: '2.9rem',
                  padding: '0.55rem 0.7rem',
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
                  gap: '0.5rem',
                  boxShadow: partyMode === 'flash' ? '0 0 14px rgba(245, 158, 11, 0.35)' : undefined,
                }}
              >
                <span style={{ fontSize: '1.35rem', lineHeight: 1 }}>⚡</span>
                <span style={{ fontSize: '0.88rem', fontWeight: 900, color: '#f59e0b' }}>SCHIERATI FLASH</span>
              </button>
              {renderInfoBtn('party-flash', 'Schierati Flash')}
            </div>

            {/* Modalità 2: Infiltrato */}
            <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'stretch' }}>
              <button
                type="button"
                onClick={() => selectPartyMode('infiltrato')}
                style={{
                  flex: 1,
                  minHeight: '2.9rem',
                  padding: '0.55rem 0.7rem',
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
                  gap: '0.5rem',
                  boxShadow: partyMode === 'infiltrato' ? '0 0 14px rgba(139, 92, 246, 0.35)' : undefined,
                }}
              >
                <span style={{ fontSize: '1.35rem', lineHeight: 1 }}>🕵️</span>
                <span style={{ fontSize: '0.88rem', fontWeight: 900, color: '#c084fc' }}>L'INFILTRATO</span>
              </button>
              {renderInfoBtn('party-infiltrato', "L'Infiltrato")}
            </div>

            {/* Modalità 3: Coppie & Scintille */}
            <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'stretch' }}>
              <button
                type="button"
                onClick={() => selectPartyMode('coppie')}
                style={{
                  flex: 1,
                  minHeight: '2.9rem',
                  borderRadius: 'var(--radius-md)',
                  border: partyMode === 'coppie' ? '2px solid #f472b6' : '1px solid rgba(244, 114, 182, 0.3)',
                  background: partyMode === 'coppie'
                    ? 'linear-gradient(135deg, rgba(236, 72, 153, 0.22) 0%, rgba(40, 15, 30, 0.8) 100%)'
                    : 'rgba(25, 25, 40, 0.6)',
                  padding: '0.55rem 0.7rem',
                  boxShadow: partyMode === 'coppie' ? '0 0 14px rgba(236, 72, 153, 0.35)' : undefined,
                  color: 'var(--text)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <span style={{ fontSize: '1.35rem', lineHeight: 1 }}>🌶️</span>
                <span style={{ fontSize: '0.88rem', fontWeight: 900, color: '#f472b6' }}>COPPIE & SCINTILLE</span>
              </button>
              {renderInfoBtn('party-coppie', 'Coppie & Scintille')}
            </div>

            {/* Modalità 4: Assurdo ma Semplice */}
            <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'stretch' }}>
              <button
                type="button"
                onClick={() => selectPartyMode('assurdo')}
                style={{
                  flex: 1,
                  minHeight: '2.9rem',
                  padding: '0.55rem 0.7rem',
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
                  gap: '0.5rem',
                  boxShadow: partyMode === 'assurdo' ? '0 0 14px rgba(52, 211, 153, 0.35)' : undefined,
                }}
              >
                <span style={{ fontSize: '1.35rem', lineHeight: 1 }}>🤡</span>
                <span style={{ fontSize: '0.88rem', fontWeight: 900, color: '#34d399' }}>ASSURDO MA SEMPLICE</span>
              </button>
              {renderInfoBtn('party-assurdo', 'Assurdo ma Semplice')}
            </div>
          </div>

          {openInfo?.startsWith('party-') && (
            <p style={{ width: '100%', margin: 0, padding: '0.5rem 0.7rem', borderRadius: '0.55rem', background: 'rgba(255,255,255,0.06)', fontSize: '0.78rem', opacity: 0.92, lineHeight: 1.3 }}>
              {openInfo === 'party-mix' && 'Variabile · Ogni round cambia gioco: Flash, Termometro 1–10, Mente del Gruppo, Gogna, Scrivi e Infiltrato!'}
              {openInfo === 'party-flash' && '3s voto · 15s blitz: dilemmi quotidiani divisivi. Chi è in minoranza paga pegno e si difende al volo!'}
              {openInfo === 'party-infiltrato' && '60s paranoia & accusa: domande segrete sui telefoni, 1 parola a testa, 60s di dibattito e accusa al volo!'}
              {openInfo === 'party-coppie' && 'Allineamento & Obbligo: al 3 indicate chi dei due... Coppia al centro o 1v1 con scommesse Matchano/Scoppiano!'}
              {openInfo === 'party-assurdo' && 'La Gogna & 500€: "Chi tradirebbe tutti dopo 5 minuti?". Vota l\'amico e incoronalo con la Sentenza dell\'App!'}
            </p>
          )}

          {partyMode === 'infiltrato' && (
            <div style={{ width: '100%', display: 'flex', gap: '0.4rem', padding: '0.4rem 0.5rem', background: 'rgba(139, 92, 246, 0.12)', borderRadius: 'var(--radius-sm)' }}>
              {([
                { id: 'risate', label: '😂 Risate' },
                { id: 'profondo', label: '🧭 Profondo' },
                { id: 'misto', label: '🎭 Misto' },
              ] as const).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setInfiltratoTono?.(t.id)}
                  style={{
                    flex: 1,
                    minHeight: '2.75rem',
                    padding: '0.35rem',
                    borderRadius: 'var(--radius-sm)',
                    border: infiltratoTono === t.id ? '1.5px solid #c084fc' : '1px solid rgba(255,255,255,0.1)',
                    background: infiltratoTono === t.id ? 'rgba(167, 139, 250, 0.3)' : 'rgba(0,0,0,0.2)',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: '0.76rem',
                    fontWeight: 800,
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}

          {partyMode === 'coppie' && (
            <div style={{ width: '100%', display: 'flex', gap: '0.4rem', padding: '0.4rem 0.5rem', background: 'rgba(236, 72, 153, 0.12)', borderRadius: 'var(--radius-sm)' }}>
              <button
                type="button"
                onClick={() => setPartyIntensity?.('complicita')}
                style={{
                  flex: 1,
                  minHeight: '2.75rem',
                  padding: '0.4rem',
                  borderRadius: 'var(--radius-sm)',
                  border: partyIntensity === 'complicita' ? '1.5px solid #ec4899' : '1px solid rgba(255,255,255,0.1)',
                  background: partyIntensity === 'complicita' ? 'rgba(236, 72, 153, 0.35)' : 'rgba(0,0,0,0.2)',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                }}
              >
                💞 Complicità
              </button>
              <button
                type="button"
                onClick={() => setPartyIntensity?.('piccante')}
                style={{
                  flex: 1,
                  minHeight: '2.75rem',
                  padding: '0.4rem',
                  borderRadius: 'var(--radius-sm)',
                  border: partyIntensity === 'piccante' ? '1.5px solid #ef4444' : '1px solid rgba(255,255,255,0.1)',
                  background: partyIntensity === 'piccante' ? 'rgba(239, 68, 68, 0.35)' : 'rgba(0,0,0,0.2)',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                }}
              >
                🔞 Piccante 18+
              </button>
              <button
                type="button"
                onClick={() => setPartyIntensity?.('profondo')}
                style={{
                  flex: 1,
                  minHeight: '2.75rem',
                  padding: '0.4rem',
                  borderRadius: 'var(--radius-sm)',
                  border: partyIntensity === 'profondo' ? '1.5px solid #38bdf8' : '1px solid rgba(255,255,255,0.1)',
                  background: partyIntensity === 'profondo' ? 'rgba(56, 189, 248, 0.3)' : 'rgba(0,0,0,0.2)',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                }}
              >
                🧭 Profondo
              </button>
            </div>
          )}

          {/* Tema personalizzato della serata (Gemini Flash injection) */}
          <div style={{ width: '100%', marginTop: '0.1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', marginBottom: '0.3rem' }}>
              <label
                htmlFor="party-theme-input"
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  color: 'var(--gold, #f59e0b)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                🔥 Tema della Serata (opzionale)
              </label>
              {renderInfoBtn('party-theme', 'Tema della serata')}
            </div>
            <input
              id="party-theme-input"
              name="partyTheme"
              type="text"
              value={theme}
              onChange={(e) => setTheme?.(e.target.value)}
              placeholder="es. Addio al celibato di Marco, Coinquilini fuorisede..."
              style={{
                width: '100%',
                minHeight: '2.75rem',
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
            {openInfo === 'party-theme' && (
              <p style={{ margin: '0.3rem 0 0', padding: '0.4rem 0.6rem', borderRadius: '0.5rem', background: 'rgba(255,255,255,0.06)', fontSize: '0.75rem', opacity: 0.88 }}>
                ✨ Gemini Flash genererà domande e dilemmi su misura per il vostro gruppo!
              </p>
            )}
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

          {/* Hero START Button */}
          <div className={lobbyStyles.stickyStartBar}>
            <Button
              variant="primary"
              size="lg"
              onClick={onStart}
              disabled={!canStart}
              style={{
                width: '100%',
                minHeight: '3rem',
                padding: '0.8rem',
                fontSize: '1.08rem',
                fontWeight: 900,
                letterSpacing: '0.03em',
                background: canStart
                  ? 'linear-gradient(135deg, #f59e0b 0%, #ec4899 50%, #8b5cf6 100%)'
                  : undefined,
                boxShadow: canStart ? '0 0 20px rgba(245, 158, 11, 0.5)' : undefined,
                border: canStart ? '2px solid rgba(255, 255, 255, 0.4)' : undefined,
              }}
            >
              INIZIA LA FESTA 🚀 · Avvia partita
            </Button>

            {!canStart && (
              <p style={{ opacity: 0.75, margin: 0, fontSize: '0.78rem', textAlign: 'center' }}>
                {partyMode === 'infiltrato' && humanCount < 3
                  ? "L'Infiltrato richiede almeno 3 giocatori per divertirsi!"
                  : humanCount < 1
                    ? 'Serve almeno un giocatore reale.'
                    : `Servono almeno ${MIN_PLAYERS_TO_START} partecipanti: aggiungi amici o bot 🤖`}
              </p>
            )}

            {startError && <Alert>{startError}</Alert>}
          </div>
        </>
      ) : (
        <>
          {/* TAB 2: MODALITÀ CLASSICA (Dilemmi Filosofici, Percorso, Storie) */}
          <div style={{ width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
              <p style={{ opacity: 0.85, margin: 0, fontWeight: 700 }}>Tipo di partita</p>
              {renderInfoBtn('cls-tipo', 'Tipo di partita')}
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center', flexWrap: 'wrap' }} role="group" aria-label="Tipo di partita">
              <Pill
                selected={isClassica && gameMode === 'gruppo'}
                onClick={() => {
                  setTipoPartita('classica');
                  setGameMode('gruppo');
                }}
                aria-label="Gruppo: 3, 5 o 7 dilemmi, 3-8 persone"
              >
                <span style={{ fontWeight: 700 }}>{MODE_LABELS.gruppo.nome}</span>
              </Pill>
              <Pill
                selected={isDuello}
                onClick={() => {
                  setTipoPartita('classica');
                  setGameMode('duello');
                }}
                aria-label="1v1 Duello, 2 giocatori"
              >
                <span style={{ fontWeight: 700 }}>{MODE_LABELS.duello.nome}</span>
              </Pill>
              <Pill
                selected={isPercorso}
                onClick={() => {
                  setTipoPartita('percorso');
                  setGameMode('gruppo');
                }}
                aria-label="Percorso: salita a tappe, 1-3 ore"
              >
                <span style={{ fontWeight: 700 }}>🧗 Percorso</span>
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
                <span style={{ fontWeight: 700 }}>📖 Storie</span>
              </Pill>
            </div>
            {openInfo === 'cls-tipo' && (
              <div style={{ marginTop: '0.45rem', padding: '0.5rem 0.65rem', borderRadius: '0.55rem', background: 'rgba(255,255,255,0.06)', fontSize: '0.75rem', opacity: 0.9, lineHeight: 1.4 }}>
                <div><strong>{MODE_LABELS.gruppo.nome}</strong>: 3 · 5 · 7 dilemmi (3–8 giocatori)</div>
                <div><strong>{MODE_LABELS.duello.nome}</strong>: {MODE_LABELS.duello.descr}</div>
                <div><strong>🧗 Percorso</strong>: salita a tappe · 1–3h</div>
                <div><strong>📖 Storie</strong>: {storieSubtitle}</div>
              </div>
            )}
            {discardsSubmitted && (
              <p style={{ opacity: 0.75, margin: '0.5rem 0 0', fontSize: '0.8rem', textAlign: 'center', color: 'var(--gold)' }}>
                ⚠️ {isPercorso ? 'Percorso' : 'Storie'} non usa i {submittedCount} dilemmi scritti dal gruppo — restano per un'altra partita.
              </p>
            )}
          </div>

          {isClassica && (
            <>
              <div style={{ width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <p style={{ opacity: 0.85, margin: 0, fontWeight: 700 }}>Mood della serata</p>
                  {renderInfoBtn('cls-mood', 'Mood della serata')}
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center', flexWrap: 'wrap' }} role="group" aria-label="Mood della serata">
                  {MOODS.map((m) => (
                    <Pill
                      key={m}
                      selected={mood === m}
                      onClick={() => setMood(m)}
                      aria-label={`${MOOD_LABELS[m].nome}, ${MOOD_LABELS[m].descr}`}
                    >
                      <span style={{ fontWeight: 700 }}>{MOOD_LABELS[m].nome}</span>
                    </Pill>
                  ))}
                </div>
                {openInfo === 'cls-mood' && (
                  <div style={{ marginTop: '0.45rem', padding: '0.5rem 0.65rem', borderRadius: '0.55rem', background: 'rgba(255,255,255,0.06)', fontSize: '0.75rem', opacity: 0.9, lineHeight: 1.4 }}>
                    {MOODS.map((m) => (
                      <div key={m}><strong>{MOOD_LABELS[m].nome}</strong>: {MOOD_LABELS[m].descr}</div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ width: '100%' }}>
                <p style={{ opacity: 0.85, margin: '0 0 0.4rem', fontWeight: 700 }}>Durata</p>
                <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center', flexWrap: 'wrap' }} role="group" aria-label="Formato">
                  {SESSION_FORMATS.map((f) => (
                    <Pill
                      key={f}
                      selected={format === f}
                      onClick={() => setFormat(f)}
                      aria-label={`${FORMAT_LABELS[f].nome}, ${FORMAT_LABELS[f].round} round, ${FORMAT_LABELS[f].durata}`}
                    >
                      <span style={{ fontWeight: 700 }}>{FORMAT_LABELS[f].nome}</span>
                    </Pill>
                  ))}
                </div>
              </div>

              <div style={{ width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <p style={{ opacity: 0.85, margin: 0, fontWeight: 700 }}>Caos (twist a sorpresa)</p>
                  {renderInfoBtn('cls-caos', 'Caos')}
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center', flexWrap: 'wrap' }} role="group" aria-label="Caos">
                  {CAOS_LEVELS.map((c) => (
                    <Pill
                      key={c}
                      selected={caos === c}
                      onClick={() => setCaos(c)}
                      aria-label={`${CAOS_LABELS[c].nome}, ${CAOS_LABELS[c].descr}`}
                    >
                      <span style={{ fontWeight: 700 }}>{CAOS_LABELS[c].nome}</span>
                    </Pill>
                  ))}
                </div>
                {openInfo === 'cls-caos' && (
                  <div style={{ marginTop: '0.45rem', padding: '0.5rem 0.65rem', borderRadius: '0.55rem', background: 'rgba(255,255,255,0.06)', fontSize: '0.75rem', opacity: 0.9, lineHeight: 1.4 }}>
                    {CAOS_LEVELS.map((c) => (
                      <div key={c}><strong>{CAOS_LABELS[c].nome}</strong>: {CAOS_LABELS[c].descr}</div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {isPercorso && (() => {
            const activeMeta = getPercorsoMeta(percorsoId);
            const activeCounts = percorsoCounts?.[activeMeta.id] ?? tappaCounts;
            const corsie: CorsiaTono[] = ['risate', 'direzione', 'serio'];
            const corsiaAccent: Record<CorsiaTono, string> = {
              risate: '#f59e0b',
              direzione: '#38bdf8',
              serio: '#f472b6',
            };
            return (
            <>
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <p style={{ opacity: 0.85, margin: 0, fontWeight: 700 }}>
                  Scegli il Percorso (raggruppati per tono)
                </p>
                {corsie.map((corsia) => {
                  const meta = CORSIE_META[corsia];
                  const items = PERCORSI_CATALOG.filter((p) => p.corsia === corsia);
                  const accent = corsiaAccent[corsia];
                  return (
                    <div
                      key={corsia}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.4rem',
                        padding: '0.6rem',
                        borderRadius: 'var(--radius-md)',
                        border: `1px solid ${accent}44`,
                        background: `${accent}0d`,
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                        <span style={{ fontSize: '0.86rem', fontWeight: 800, color: accent }}>
                          {meta.emoji} {meta.nome}
                        </span>
                        <span style={{ fontSize: '0.72rem', opacity: 0.75 }}>{meta.sottotitolo}</span>
                      </div>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(10.5rem, 1fr))',
                          gap: '0.45rem',
                        }}
                        role="group"
                        aria-label={`Percorsi ${meta.nome}`}
                      >
                        {items.map((p) => {
                          const selected = activeMeta.id === p.id;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => setPercorsoId?.(p.id)}
                              aria-pressed={selected}
                              style={{
                                textAlign: 'left',
                                padding: '0.55rem 0.65rem',
                                borderRadius: 'var(--radius-sm)',
                                border: selected ? `1.5px solid ${accent}` : '1px solid var(--border-strong)',
                                background: selected ? `${accent}26` : 'rgba(0,0,0,0.22)',
                                color: 'var(--text)',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.15rem',
                              }}
                            >
                              <span style={{ fontSize: '0.84rem', fontWeight: 800 }}>
                                {p.emoji} {p.nome}
                              </span>
                              <span style={{ fontSize: '0.71rem', opacity: 0.8, lineHeight: 1.2 }}>
                                {p.sottotitolo}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                <p style={{ margin: 0, fontSize: '0.78rem', opacity: 0.85, textAlign: 'center' }}>
                  {activeMeta.emoji} <strong>{activeMeta.nome}</strong>: {activeMeta.descrizione}
                </p>
              </div>

              <div style={{ width: '100%' }}>
                <p style={{ opacity: 0.8, margin: '0 0 0.4rem' }}>Tappa di partenza</p>
                <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center', flexWrap: 'wrap' }} role="group" aria-label="Tappa di partenza">
                  {activeMeta.tappe.map((t) => (
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
                  Si sale fino a {activeMeta.tappe[activeMeta.tappe.length - 1]?.emoji} {activeMeta.tappe[activeMeta.tappe.length - 1]?.nome}.
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
                  ~{estimatePercorsoDilemmi(activeCounts, startTappa, durata)} domande · {DURATA_LABELS[durata].durata}
                </p>
              </div>
            </>
            );
          })()}

          {isStoria && (
            <div style={{ width: '100%' }}>
              <p style={{ opacity: 0.8, margin: '0 0 0.4rem' }}>Scegli la storia</p>
              {storieCatalog.length === 0 ? (
                <p style={{ opacity: 0.6, margin: 0, fontSize: '0.85rem', textAlign: 'center' }}>
                  Nessuna storia disponibile.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }} role="group" aria-label="Storie">
                  {[...storieCatalog]
                    .sort((a, b) => {
                      const rank = (s: StoriaCatalogItem) =>
                        s.familiarita === familiarita ? 0 : s.familiarita === 'tutti' || !s.familiarita ? 1 : 2;
                      return rank(a) - rank(b);
                    })
                    .map((s) => (
                    <Pill
                      key={s.id}
                      selected={storyId === s.id}
                      onClick={() => setStoryId(s.id)}
                      aria-label={`${s.title}: ${s.hook}`}
                      style={{ width: '100%', justifyContent: 'center', textAlign: 'center' }}
                    >
                      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem', lineHeight: 1.15 }}>
                        <span style={{ fontWeight: 700 }}>
                          {s.emoji} {s.title}
                          {s.familiarita === 'vecchi_amici' && familiarita === 'vecchi_amici' ? ' · 🫂 Per voi' : ''}
                        </span>
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

          <div className={lobbyStyles.stickyStartBar}>
            <Button variant="primary" size="lg" onClick={onStart} disabled={!canStart} style={{ width: '100%', minHeight: '3rem' }}>
              Avvia partita
            </Button>
            {!canStart && (
              <p style={{ opacity: 0.75, margin: 0, fontSize: '0.8rem', textAlign: 'center' }}>
                {gameMode === 'duello'
                  ? 'Il 1v1 richiede esattamente 2 giocatori.'
                  : humanCount < 1
                    ? 'Serve almeno una persona (i bot da soli non bastano).'
                    : `Servono almeno ${MIN_PLAYERS_TO_START} partecipanti: aggiungi giocatori o bot 🤖`}
              </p>
            )}
            {startError && <Alert>{startError}</Alert>}
          </div>
        </>
      )}
    </Card>
  );
}
