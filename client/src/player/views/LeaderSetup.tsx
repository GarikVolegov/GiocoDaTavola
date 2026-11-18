import { useState, type Dispatch, type SetStateAction } from 'react';
import {
  MODE_LABELS,
  CONTENT_REGISTERS,
  REGISTER_LABELS,
  SESSION_FORMATS,
  FORMAT_DILEMMA_COUNT,
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
  MIN_INFILTRATO_HUMANS,
  MIN_SQUADRE_PLAYERS,
  type GameMode,
  type ContentRegister,
  type SessionFormat,
  type Durata,
  type TappaCounts,
  type PercorsoCounts,
  type CoppieIntensity,
  type InfiltratoTono,
  type StoriaCatalogItem,
  type Mood,
  type Familiarita,
  type Caos,
  type PartyMode,
} from '../../shared/events';
import { Card, Pill, TextInput } from '../../shared/ui';
import lobbyStyles from './LobbyScreen.module.css';

export type TipoPartita = 'classica' | 'percorso' | 'storia';

const PARTY_MODE_CARDS: Array<{
  id: Exclude<PartyMode, 'mix'>;
  label: string;
  desc: string;
  soloOk: boolean;
}> = [
  { id: 'flash', label: '⚡ Flash', desc: 'Zero fretta · Scegli la tua posizione e confrontati dal vivo', soloOk: true },
  { id: 'classico', label: '🎭 Classico', desc: 'Dilemmi classici con discussione aperta, secondo voto e rilancio finale', soloOk: true },
  { id: 'infiltrato', label: '🕵️ L’Infiltrato', desc: 'Domande segrete sui telefoni, 1 parola a testa e accusa al volo', soloOk: false },
  { id: 'assurdo', label: '🤪 Assurdo', desc: 'Prove di dignità e gogna al tavolo senza timer', soloOk: true },
  { id: 'coppie', label: '🔥 Coppie', desc: 'Coppie da 2 su nomi reali e sfide a punti', soloOk: false },
  { id: 'preferiresti', label: '🔀 Preferiresti', desc: 'Quattro alternative assurde tra cui scegliere e confrontarsi', soloOk: true },
  { id: 'cruciverba', label: '🧩 Cruciverba', desc: 'Cruciverba cooperativo a turni senza fretta né timer', soloOk: true },
  { id: 'tribunale', label: '⚖️ Tribunale', desc: 'Arringhe faccia a faccia tra Accusa e Difesa davanti alla giuria', soloOk: false },
];

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
  playMode?: 'solo' | 'gruppo';
  setPlayMode?: Dispatch<SetStateAction<'solo' | 'gruppo'>>;
  canStart?: boolean;
  onStart?: () => void;
  startError?: string | null;
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
  players?: Array<{ id: string; nickname: string }>;
  couplePairs?: Array<[string, string]>;
  onShuffleCouples?: () => void;
  onSwapCoupleMembers?: (idA: string, idB: string) => void;
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
  serataLunga: _serataLunga,
  setSerataLunga: _setSerataLunga,
  format,
  setFormat,
  percorsoId = 'bussola',
  setPercorsoId,
  percorsoCounts: _percorsoCounts,
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
  tappaCounts: _tappaCounts,
  humanCount: _humanCount,
  playMode = 'gruppo',
  setPlayMode,
  partyMode = 'mix',
  setPartyMode,
  partyIntensity = 'complicita',
  setPartyIntensity,
  infiltratoTono = 'misto',
  setInfiltratoTono,
  familiarita = 'vecchi_amici',
  setFamiliarita,
  theme = '',
  setTheme,
  players = [],
  couplePairs = [],
  onShuffleCouples,
  onSwapCoupleMembers,
}: LeaderSetupProps) {
  const [activeTab, setActiveTab] = useState<'party' | 'classica'>('party');
  const [showSingleModes, setShowSingleModes] = useState(false);
  const [showAdvancedSetup, setShowAdvancedSetup] = useState(false);
  const [swapSelectionId, setSwapSelectionId] = useState<string | null>(null);

  const isClassica = tipoPartita === 'classica';
  const isDuello = isClassica && gameMode === 'duello';
  const isPercorso = tipoPartita === 'percorso';
  const isStoria = tipoPartita === 'storia';
  const showSpecial = isPercorso || (isClassica && gameMode === 'gruppo');
  const discardsSubmitted = (isPercorso || isStoria) && submittedCount > 0;
  const activeMeta = getPercorsoMeta(percorsoId);
  const storieGenres = [...new Set(storieCatalog.map((s) => s.genre))];
  const storieSubtitle =
    storieGenres.length > 0 ? storieGenres.map((g) => STORY_GENRE_LABELS[g]).join(' · ') : 'bivi da dibattere';

  const selectPartyMode = (mode: PartyMode) => {
    setPartyMode?.(mode);
    setTipoPartita('classica');
    setGameMode('gruppo');
    setInfiltratoOn(mode === 'infiltrato');
    if (mode === 'mix') setShowSingleModes(false);
  };

  const switchToClassic = () => {
    setActiveTab('classica');
    setPartyMode?.(null);
  };

  const switchToParty = () => {
    setActiveTab('party');
    if (!partyMode) setPartyMode?.('mix');
  };

  const visiblePartyModes = PARTY_MODE_CARDS.filter((m) => playMode === 'gruppo' || m.soloOk);
  const activePartyMeta = partyMode && partyMode !== 'mix'
    ? PARTY_MODE_CARDS.find((m) => m.id === partyMode)
    : null;

  const roundCount = FORMAT_DILEMMA_COUNT[format];
  const famLabel =
    familiarita === 'nuove_conoscenze'
      ? FAMILIARITA_LABELS.nuove_conoscenze.nome
      : FAMILIARITA_LABELS.vecchi_amici.nome;
  const advancedSummary =
    activeTab === 'classica' && (isPercorso || isStoria)
      ? famLabel
      : `${roundCount} round · ${famLabel}`;

  return (
    <Card
      glow="accent"
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.9rem',
        alignItems: 'stretch',
        padding: '1rem',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Componi la partita</h2>
      </div>

      {/* 1A. DA SOLO VS IN GRUPPO */}
      {setPlayMode && (
        <div role="group" aria-label="Modalità di partecipazione" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div className={lobbyStyles.sectionLabel}>Come giochi?</div>
          <div className={lobbyStyles.segmentGrid2}>
            <button
              type="button"
              aria-pressed={playMode === 'solo'}
              className={`${lobbyStyles.segmentBtn} ${playMode === 'solo' ? lobbyStyles.segmentBtnActive : ''}`}
              onClick={() => {
                setPlayMode('solo');
                if (partyMode === 'infiltrato' || partyMode === 'coppie' || partyMode === 'tribunale') {
                  setPartyMode?.('mix');
                }
                if (gameMode === 'duello') setGameMode('gruppo');
                setInfiltratoOn(false);
                setSquadreOn(false);
              }}
            >
              👤 Da solo
            </button>
            <button
              type="button"
              aria-pressed={playMode === 'gruppo'}
              className={`${lobbyStyles.segmentBtn} ${playMode === 'gruppo' ? lobbyStyles.segmentBtnActive : ''}`}
              onClick={() => setPlayMode('gruppo')}
            >
              👥 In gruppo
            </button>
          </div>
        </div>
      )}

      {/* 1B. MODALITÀ DI GIOCO: PARTY MODE VS MODALITÀ CLASSICA */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div className={lobbyStyles.sectionLabel}>1. Modalità di gioco</div>
        <div className={lobbyStyles.segmentGrid2}>
          <button
            type="button"
            aria-pressed={activeTab === 'party'}
            className={`${lobbyStyles.segmentBtn} ${activeTab === 'party' ? lobbyStyles.segmentBtnActive : ''}`}
            onClick={switchToParty}
          >
            🔥 Party Mode
          </button>
          <button
            type="button"
            aria-pressed={activeTab === 'classica'}
            className={`${lobbyStyles.segmentBtn} ${activeTab === 'classica' ? lobbyStyles.segmentBtnActive : ''}`}
            onClick={switchToClassic}
          >
            🏛️ Modalità Classica
          </button>
        </div>

        {activeTab === 'party' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }} role="group" aria-label="Modalità party">
            <button
              type="button"
              aria-pressed={partyMode === 'mix'}
              onClick={() => selectPartyMode('mix')}
              style={{
                width: '100%',
                minHeight: '3.25rem',
                padding: '0.75rem 0.9rem',
                borderRadius: 'var(--radius-md, 10px)',
                border: partyMode === 'mix' ? '2px solid var(--gold)' : '1px solid rgba(229, 193, 88, 0.35)',
                background:
                  partyMode === 'mix'
                    ? 'linear-gradient(135deg, rgba(229, 193, 88, 0.22) 0%, rgba(20, 26, 52, 0.85) 100%)'
                    : 'rgba(255, 255, 255, 0.04)',
                color: 'var(--text)',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.3rem',
                boxShadow: partyMode === 'mix' ? '0 0 0 1px rgba(229, 193, 88, 0.28)' : undefined,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', width: '100%' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '0.92rem', color: 'var(--gold)', textTransform: 'uppercase' }}>
                  🎲 Serata Mix · Tutti i giochi casuali
                </span>
                <span style={{ fontSize: '0.68rem', padding: '0.12rem 0.45rem', borderRadius: '4px', background: 'rgba(229, 193, 88, 0.2)', color: 'var(--gold)', fontWeight: 700, flexShrink: 0 }}>
                  Consigliata
                </span>
              </div>
              <span style={{ fontSize: '0.78rem', opacity: 0.88, lineHeight: 1.35 }}>
                Ogni round un giochino diverso a sorpresa senza timer!
              </span>
            </button>

            <button
              type="button"
              className={lobbyStyles.optionsToggleBtn}
              aria-expanded={showSingleModes || (partyMode !== null && partyMode !== 'mix')}
              onClick={() => setShowSingleModes((v) => !v)}
            >
              <span>🎯 Scegli singolo gioco</span>
              <span className={lobbyStyles.optionsSummary}>
                {activePartyMeta
                  ? `${activePartyMeta.label} ▲`
                  : showSingleModes
                    ? 'Nascondi ▲'
                    : 'Mostra ▼'}
              </span>
            </button>

            {(showSingleModes || (partyMode !== null && partyMode !== 'mix')) && (
              <>
                <div className={lobbyStyles.modeGrid}>
                  {visiblePartyModes.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      aria-pressed={partyMode === m.id}
                      className={`${lobbyStyles.modeBtn} ${partyMode === m.id ? lobbyStyles.modeBtnActive : ''}`}
                      onClick={() => selectPartyMode(m.id)}
                    >
                      <span className={lobbyStyles.modeBtnTitle}>{m.label}</span>
                    </button>
                  ))}
                </div>
                {activePartyMeta && <p className={lobbyStyles.modeDescBox}>{activePartyMeta.desc}</p>}
              </>
            )}

            {partyMode === 'infiltrato' && (
              <div className={lobbyStyles.segmentGrid3}>
                {([
                  { id: 'risate', label: '😂 Risate' },
                  { id: 'profondo', label: '🌊 Profondo' },
                  { id: 'misto', label: '🎲 Misto' },
                ] as const).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={infiltratoTono === t.id}
                    className={`${lobbyStyles.segmentBtn} ${infiltratoTono === t.id ? lobbyStyles.segmentBtnActive : ''}`}
                    onClick={() => setInfiltratoTono?.(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}

            {partyMode === 'coppie' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div className={lobbyStyles.segmentGrid3}>
                  {([
                    { id: 'complicita', label: '🥂 Complicità' },
                    { id: 'piccante', label: '🌶️ Piccante 18+' },
                    { id: 'profondo', label: '🌊 Profondo' },
                  ] as const).map((it) => (
                    <button
                      key={it.id}
                      type="button"
                      aria-pressed={partyIntensity === it.id}
                      className={`${lobbyStyles.segmentBtn} ${partyIntensity === it.id ? lobbyStyles.segmentBtnActive : ''}`}
                      onClick={() => setPartyIntensity?.(it.id)}
                    >
                      {it.label}
                    </button>
                  ))}
                </div>

                <div
                  style={{
                    padding: '0.6rem 0.7rem',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(236, 72, 153, 0.08)',
                    border: '1px solid rgba(236, 72, 153, 0.3)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.45rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#fbcfe8', textTransform: 'uppercase' }}>
                      💕 Coppie della serata
                    </span>
                    {players.length >= 4 && players.length % 2 === 0 && onShuffleCouples && (
                      <button
                        type="button"
                        onClick={() => {
                          setSwapSelectionId(null);
                          onShuffleCouples();
                        }}
                        style={{
                          background: 'rgba(255,255,255,0.08)',
                          border: '1px solid rgba(255,255,255,0.2)',
                          color: '#fff',
                          borderRadius: '8px',
                          padding: '0.25rem 0.55rem',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        🔀 Mescola
                      </button>
                    )}
                  </div>

                  {players.length < 2 || players.length % 2 !== 0 ? (
                    <p style={{ margin: 0, fontSize: '0.78rem', color: '#fda4af', fontWeight: 700 }}>
                      Servono 2, 4, 6 o 8 giocatori (ora {players.length}).
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      {couplePairs.map(([idA, idB], idx) => {
                        const nameA = players.find((p) => p.id === idA)?.nickname ?? idA;
                        const nameB = players.find((p) => p.id === idB)?.nickname ?? idB;
                        const renderMemberChip = (pid: string, name: string) => {
                          const selected = swapSelectionId === pid;
                          return (
                            <button
                              key={pid}
                              type="button"
                              onClick={() => {
                                if (!onSwapCoupleMembers) return;
                                if (!swapSelectionId) setSwapSelectionId(pid);
                                else if (swapSelectionId === pid) setSwapSelectionId(null);
                                else {
                                  onSwapCoupleMembers(swapSelectionId, pid);
                                  setSwapSelectionId(null);
                                }
                              }}
                              style={{
                                padding: '0.25rem 0.55rem',
                                borderRadius: '8px',
                                border: selected ? '1.5px solid #fbbf24' : '1px solid rgba(255,255,255,0.18)',
                                background: selected ? 'rgba(251, 191, 36, 0.25)' : 'rgba(0,0,0,0.28)',
                                color: '#fff',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                cursor: onSwapCoupleMembers ? 'pointer' : 'default',
                              }}
                            >
                              {name}
                            </button>
                          );
                        };
                        return (
                          <div
                            key={`${idA}-${idB}`}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '0.4rem',
                              fontSize: '0.76rem',
                            }}
                          >
                            <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>
                              Coppia {idx + 1}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              {renderMemberChip(idA, nameA)}
                              <span>❤️</span>
                              {renderMemberChip(idB, nameB)}
                            </div>
                          </div>
                        );
                      })}
                      {players.length >= 4 && (
                        <span style={{ fontSize: '0.7rem', opacity: 0.72 }}>
                          Tocca 2 nomi per scambiarli di coppia prima di iniziare.
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
            <div
              className={playMode === 'solo' ? lobbyStyles.segmentGrid3 : lobbyStyles.modeGrid}
              role="group"
              aria-label="Tipo di partita"
            >
              <button
                type="button"
                aria-pressed={isClassica && gameMode === 'gruppo'}
                className={`${lobbyStyles.segmentBtn} ${isClassica && gameMode === 'gruppo' ? lobbyStyles.segmentBtnActive : ''}`}
                onClick={() => {
                  setTipoPartita('classica');
                  setGameMode('gruppo');
                }}
                aria-label="Gruppo: dilemmi classici, 1-8 persone"
              >
                🎭 Dilemmi
              </button>
              <button
                type="button"
                aria-pressed={isPercorso}
                className={`${lobbyStyles.segmentBtn} ${isPercorso ? lobbyStyles.segmentBtnActive : ''}`}
                onClick={() => {
                  setTipoPartita('percorso');
                  setGameMode('gruppo');
                }}
                aria-label="Percorso: salita a tappe, senza timer"
              >
                🧗 Percorso
              </button>
              <button
                type="button"
                aria-pressed={isStoria}
                className={`${lobbyStyles.segmentBtn} ${isStoria ? lobbyStyles.segmentBtnActive : ''}`}
                onClick={() => {
                  setTipoPartita('storia');
                  setGameMode('gruppo');
                  if (!storyId && storieCatalog[0]) setStoryId(storieCatalog[0].id);
                }}
                aria-label={`Storie: ${storieSubtitle}, con bivi da dibattere`}
              >
                📖 Storie
              </button>
              {playMode !== 'solo' && (
                <button
                  type="button"
                  aria-pressed={isDuello}
                  className={`${lobbyStyles.segmentBtn} ${isDuello ? lobbyStyles.segmentBtnActive : ''}`}
                  onClick={() => {
                    setTipoPartita('classica');
                    setGameMode('duello');
                  }}
                  aria-label="1v1 Duello, 2 giocatori"
                >
                  ⚔️ 1v1 Duello
                </button>
              )}
            </div>

            {isPercorso && (
              <div className={lobbyStyles.optionsPanel}>
                <div className={lobbyStyles.sectionLabel}>Tema del percorso</div>
                <div className={lobbyStyles.modeGrid}>
                  {PERCORSI_CATALOG.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      aria-pressed={activeMeta.id === p.id}
                      className={`${lobbyStyles.modeBtn} ${activeMeta.id === p.id ? lobbyStyles.modeBtnActive : ''}`}
                      onClick={() => setPercorsoId?.(p.id)}
                    >
                      <span className={lobbyStyles.modeBtnTitle}>
                        {p.emoji} {p.nome}
                      </span>
                    </button>
                  ))}
                </div>

                <div className={lobbyStyles.sectionLabel}>Tappa di partenza</div>
                <div className={lobbyStyles.segmentGrid2} role="group" aria-label="Tappa di partenza">
                  {activeMeta.tappe.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      aria-pressed={startTappa === t.id}
                      className={`${lobbyStyles.segmentBtn} ${startTappa === t.id ? lobbyStyles.segmentBtnActive : ''}`}
                      onClick={() => setStartTappa(t.id)}
                    >
                      {t.emoji} {t.nome}
                    </button>
                  ))}
                </div>

                <div className={lobbyStyles.sectionLabel}>Lunghezza</div>
                <div className={lobbyStyles.segmentGrid3} role="group" aria-label="Durata percorso">
                  {DURATE.map((d) => (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={durata === d}
                      className={`${lobbyStyles.segmentBtn} ${durata === d ? lobbyStyles.segmentBtnActive : ''}`}
                      onClick={() => setDurata(d)}
                    >
                      {DURATA_LABELS[d].nome}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isStoria && (
              <div className={lobbyStyles.optionsPanel}>
                <div className={lobbyStyles.sectionLabel}>Scegli la storia</div>
                {storieCatalog.length === 0 ? (
                  <p style={{ opacity: 0.65, margin: 0, fontSize: '0.82rem', textAlign: 'center' }}>
                    Nessuna storia disponibile.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }} role="group" aria-label="Storie">
                    {[...storieCatalog]
                      .sort((a, b) => {
                        const rank = (s: StoriaCatalogItem) =>
                          s.familiarita === familiarita ? 0 : s.familiarita === 'tutti' || !s.familiarita ? 1 : 2;
                        return rank(a) - rank(b);
                      })
                      .map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          aria-pressed={storyId === s.id}
                          className={`${lobbyStyles.modeBtn} ${storyId === s.id ? lobbyStyles.modeBtnActive : ''}`}
                          onClick={() => setStoryId(s.id)}
                          style={{ textAlign: 'left', flexDirection: 'column', alignItems: 'flex-start', gap: '0.2rem' }}
                        >
                          <span className={lobbyStyles.modeBtnTitle}>
                            {s.emoji} {s.title} · {STORY_GENRE_LABELS[s.genre]}
                          </span>
                          <span style={{ fontSize: '0.75rem', opacity: 0.85, fontWeight: 400 }}>
                            {s.hook} ({s.scene} bivi)
                          </span>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )}

            {isClassica && (
              <p className={lobbyStyles.modeDescBox}>
                {isDuello
                  ? `${MODE_LABELS.duello.nome}: ${MODE_LABELS.duello.descr}`
                  : 'Dilemmi classici schietti con discussione aperta, secondo voto e rilancio finale, senza timer.'}
              </p>
            )}

            {discardsSubmitted && (
              <p style={{ opacity: 0.75, margin: 0, fontSize: '0.78rem', textAlign: 'center', color: 'var(--gold)' }}>
                {isPercorso ? 'Percorso' : 'Storie'} non usa i {submittedCount} dilemmi scritti dal gruppo.
              </p>
            )}
          </div>
        )}
      </div>

      {/* 1C. OPZIONI SERATA COLLASSATE */}
      <div>
        <button
          type="button"
          className={lobbyStyles.optionsToggleBtn}
          aria-expanded={showAdvancedSetup}
          onClick={() => setShowAdvancedSetup((v) => !v)}
        >
          <span>⚙️ Opzioni serata</span>
          <span className={lobbyStyles.optionsSummary}>
            {advancedSummary} {showAdvancedSetup ? '▲' : '▼'}
          </span>
        </button>

        {showAdvancedSetup && (
          <div className={lobbyStyles.optionsPanel} style={{ marginTop: '0.55rem' }}>
            {!(activeTab === 'classica' && (isPercorso || isStoria)) && (
              <div>
                <div className={lobbyStyles.sectionLabel}>Quanti round?</div>
                <div className={lobbyStyles.segmentGrid3} role="group" aria-label="Formato">
                  {SESSION_FORMATS.map((f) => (
                    <button
                      key={f}
                      type="button"
                      aria-pressed={format === f}
                      className={`${lobbyStyles.segmentBtn} ${format === f ? lobbyStyles.segmentBtnActive : ''}`}
                      onClick={() => setFormat(f)}
                    >
                      {FORMAT_DILEMMA_COUNT[f]} round
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className={lobbyStyles.sectionLabel}>Con chi giochi?</div>
              <div className={lobbyStyles.segmentGrid2} role="group" aria-label="Con chi giochi">
                {FAMILIARITA_VALUES.map((fam) => (
                  <button
                    key={fam}
                    type="button"
                    aria-pressed={familiarita === fam}
                    className={`${lobbyStyles.segmentBtn} ${familiarita === fam ? lobbyStyles.segmentBtnActive : ''}`}
                    onClick={() => setFamiliarita?.(fam)}
                  >
                    {FAMILIARITA_LABELS[fam].nome}
                  </button>
                ))}
              </div>
            </div>

            {activeTab === 'party' && (partyMode === 'coppie' || partyMode === 'mix') && (
              <div>
                <div className={lobbyStyles.sectionLabel}>Intensità Coppie</div>
                <div className={lobbyStyles.segmentGrid3}>
                  {([
                    { id: 'complicita', label: '🥂 Complicità' },
                    { id: 'piccante', label: '🌶️ Piccante 18+' },
                    { id: 'profondo', label: '🌊 Profondo' },
                  ] as const).map((it) => (
                    <button
                      key={it.id}
                      type="button"
                      aria-pressed={partyIntensity === it.id}
                      className={`${lobbyStyles.segmentBtn} ${partyIntensity === it.id ? lobbyStyles.segmentBtnActive : ''}`}
                      onClick={() => setPartyIntensity?.(it.id)}
                    >
                      {it.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'party' && (partyMode === 'infiltrato' || partyMode === 'mix') && (
              <div>
                <div className={lobbyStyles.sectionLabel}>Tono Infiltrato</div>
                <div className={lobbyStyles.segmentGrid3}>
                  {([
                    { id: 'risate', label: '😂 Risate' },
                    { id: 'profondo', label: '🌊 Profondo' },
                    { id: 'misto', label: '🎲 Misto' },
                  ] as const).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      aria-pressed={infiltratoTono === t.id}
                      className={`${lobbyStyles.segmentBtn} ${infiltratoTono === t.id ? lobbyStyles.segmentBtnActive : ''}`}
                      onClick={() => setInfiltratoTono?.(t.id)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'party' && (
              <div>
                <label htmlFor="party-theme-input" className={lobbyStyles.sectionLabel} style={{ display: 'block' }}>
                  Tema personalizzato (opzionale)
                </label>
                <TextInput
                  id="party-theme-input"
                  name="partyTheme"
                  value={theme}
                  onChange={(e) => setTheme?.(e.target.value)}
                  placeholder="Es. vacanza, coinquilini, ex..."
                  maxLength={60}
                  style={{ width: '100%' }}
                />
              </div>
            )}

            {activeTab === 'classica' && isClassica && (
              <>
                <div>
                  <div className={lobbyStyles.sectionLabel}>Mood della serata</div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }} role="group" aria-label="Mood della serata">
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
                </div>

                <div>
                  <div className={lobbyStyles.sectionLabel}>Caos (twist a sorpresa)</div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }} role="group" aria-label="Caos">
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
                </div>

                <div>
                  <div className={lobbyStyles.sectionLabel}>Argomenti</div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }} role="group" aria-label="Registro">
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

                <div>
                  <Pill
                    selected={delicatoOptIn}
                    onClick={() => setDelicatoOptIn((v) => !v)}
                    aria-label="Includi temi delicati (eutanasia, lutto)"
                  >
                    ⚠️ Temi delicati {delicatoOptIn ? 'ON' : 'OFF'}
                  </Pill>
                </div>

                {showSpecial && playMode !== 'solo' && (
                  <div>
                    <div className={lobbyStyles.sectionLabel}>Modalità speciale</div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                      <Pill
                        selected={infiltratoOn}
                        onClick={() => {
                          setInfiltratoOn((v) => !v);
                          setSquadreOn(false);
                        }}
                        aria-label="L'Infiltrato (un giocatore segreto)"
                      >
                        🕵️ L&apos;Infiltrato {infiltratoOn ? 'ON' : 'OFF'}
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
                    <p style={{ opacity: 0.6, margin: '0.35rem 0 0', fontSize: '0.78rem' }}>
                      {squadreOn
                        ? `Blu contro Arancio: servono ≥${MIN_SQUADRE_PLAYERS} giocatori`
                        : `Un giocatore segreto deve ribaltare il gruppo · servono ≥${MIN_INFILTRATO_HUMANS} persone`}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
