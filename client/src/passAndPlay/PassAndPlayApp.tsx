import { useEffect, useReducer, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Celebration,
  Logo,
  Pill,
  SplitBar,
  TextInput,
  VoteOption,
  Alert,
} from '../shared/ui';
import { fetchWithTimeout } from '../shared/api';
import { useOnlineStatus } from '../shared/useOnlineStatus';
import { useIntensityTheme } from '../shared/useIntensityTheme';
import { vibrateInfiltrator, vibrateTick } from '../shared/haptics';
import { playFanfare, playGong, playTick } from '../host/audio/synthSfx';
import { unlockAudio } from '../host/audio/engine';
import { MuteButton } from '../host/MuteButton';
import {
  pickMusicThemeForPass,
  setThematicIntensity,
  startThematicMusic,
  stopThematicMusic,
} from '../host/audio/thematicMusic';
import {
  FAMILIARITA_VALUES,
  FAMILIARITA_LABELS,
  type Familiarita,
} from '../shared/events';
import {
  FALLBACK_DECKS,
  type PassAssurdoCard,
  type PassCard,
  type PassCoppieCard,
  type PassFlashCard,
  type PassInfiltratoCard,
  type PassMode,
} from './fallbackDeck';
import {
  PASS_AVATARS,
  computePassAwards,
  createInitialPassState,
  getCurrentCard,
  getCurrentTurnPlayer,
  isAssurdoCard,
  isCoppieCard,
  isFlashOrClassicoCard,
  isInfiltratoCard,
  minPlayersForMode,
  passReducer,
  type PassPlayer,
} from './passAndPlayEngine';
import styles from './PassAndPlayApp.module.css';

const STORAGE_PLAYERS_KEY = 'schierati:passPlayers';
const STORAGE_ACTIVE_STATE_KEY = 'schierati:passActiveState';
const STORAGE_DECK_CACHE_PREFIX = 'schierati:passDeckCache:';
const MAX_CACHED_CARDS_PER_MODE = 60;

const MODE_OPTIONS: Array<{ id: PassMode; label: string; desc: string }> = [
  { id: 'flash', label: '⚡ Flash', desc: 'Dilemmi secchi, voto segreto e dibattito lampo' },
  { id: 'infiltrato', label: '🕵️ L’Infiltrato', desc: '1 domanda diversa: scopri chi sta bluffando' },
  { id: 'assurdo', label: '🤪 Assurdo', desc: 'La Gogna sugli amici e sfide di dignità' },
  { id: 'coppie', label: '🔥 Coppie', desc: 'Allineamento, verità e obblighi per 2+' },
  { id: 'classico', label: '🎭 Classico', desc: 'Doppio voto e persuasione dal vivo' },
];

const ROUND_COUNTS = [3, 5, 8] as const;

function loadSavedPlayers(): PassPlayer[] {
  try {
    const raw = localStorage.getItem(STORAGE_PLAYERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (p): p is PassPlayer =>
          typeof p === 'object' &&
          p !== null &&
          typeof (p as PassPlayer).id === 'string' &&
          typeof (p as PassPlayer).name === 'string' &&
          typeof (p as PassPlayer).avatar === 'string',
      )
      .slice(0, 10);
  } catch {
    return [];
  }
}

function savePlayers(players: PassPlayer[]): void {
  try {
    localStorage.setItem(STORAGE_PLAYERS_KEY, JSON.stringify(players));
  } catch {
    // ignore storage quota errors
  }
}

function shuffleSlice<T>(items: T[], count: number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, count);
}

function loadCachedDeck(mode: PassMode): PassCard[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_DECK_CACHE_PREFIX}${mode}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as PassCard[]) : [];
  } catch {
    return [];
  }
}

function saveCachedDeck(mode: PassMode, cards: PassCard[]): void {
  try {
    const existing = loadCachedDeck(mode);
    const byId = new Map<string, PassCard>();
    for (const c of [...cards, ...existing]) {
      if (c && typeof c.id === 'string' && !byId.has(c.id)) byId.set(c.id, c);
    }
    localStorage.setItem(
      `${STORAGE_DECK_CACHE_PREFIX}${mode}`,
      JSON.stringify([...byId.values()].slice(0, MAX_CACHED_CARDS_PER_MODE)),
    );
  } catch {
    // ignore storage quota errors
  }
}

function loadActivePassState(): ReturnType<typeof createInitialPassState> | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_ACTIVE_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ReturnType<typeof createInitialPassState>;
    if (
      parsed &&
      typeof parsed === 'object' &&
      parsed.phase !== 'SETUP' &&
      Array.isArray(parsed.players) &&
      Array.isArray(parsed.cards) &&
      parsed.cards.length > 0
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export default function PassAndPlayApp() {
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const [state, dispatch] = useReducer(
    passReducer,
    undefined,
    () => loadActivePassState() ?? createInitialPassState(),
  );

  // Setup local state
  const [selectedMode, setSelectedMode] = useState<PassMode>('flash');
  const [familiarita, setFamiliarita] = useState<Familiarita>('vecchi_amici');
  const [intensity, setIntensity] = useState<'complicita' | 'piccante'>('complicita');
  const [roundCount, setRoundCount] = useState<number>(5);
  const [theme, setTheme] = useState('');
  const [players, setPlayers] = useState<PassPlayer[]>(() => loadSavedPlayers());
  const [nameInput, setNameInput] = useState('');
  const [loadingDeck, setLoadingDeck] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [openInfo, setOpenInfo] = useState<string | null>(null);
  const toggleInfo = (id: string) => setOpenInfo((cur) => (cur === id ? null : id));

  // Suspense & debate local timers
  const [suspenseLeft, setSuspenseLeft] = useState(3);
  const [debateLeft, setDebateLeft] = useState(30);
  const [debatePaused, setDebatePaused] = useState(false);

  const activePassMode = state.phase === 'SETUP' ? selectedMode : state.mode;
  useIntensityTheme({
    partyMode: activePassMode === 'classico' ? null : activePassMode,
    partyIntensity: activePassMode === 'coppie' ? intensity : null,
    mood: activePassMode === 'classico' ? 'profonda' : undefined,
  });

  // Sync saved players back to setup on rematch
  useEffect(() => {
    if (state.phase === 'SETUP' && state.players.length > 0 && players.length === 0) {
      setPlayers(state.players);
    }
  }, [state.phase, state.players, players.length]);

  // 3-2-1 suspense beat before revealing the split
  useEffect(() => {
    if (state.phase !== 'REVEAL_SUSPENSE') return;
    setSuspenseLeft(3);
    playTick();
    const t1 = window.setTimeout(() => {
      setSuspenseLeft(2);
      playTick();
    }, 750);
    const t2 = window.setTimeout(() => {
      setSuspenseLeft(1);
      playTick();
    }, 1500);
    const t3 = window.setTimeout(() => {
      playGong();
      dispatch({ type: 'FINISH_SUSPENSE' });
    }, 2250);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [state.phase]);

  // Debate countdown timer
  useEffect(() => {
    if (state.phase !== 'DEBATE') return;
    setDebateLeft(state.debateDurationSec);
    setDebatePaused(false);
  }, [state.phase, state.roundIndex, state.debateDurationSec]);

  useEffect(() => {
    if (state.phase !== 'DEBATE' || debatePaused || debateLeft <= 0) return;
    const id = window.setTimeout(() => setDebateLeft((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearTimeout(id);
  }, [state.phase, debatePaused, debateLeft]);

  // Fanfare on final awards
  useEffect(() => {
    if (state.phase === 'FINAL_AWARDS') playFanfare();
  }, [state.phase]);

  // Thematic background music for Pass & Play
  const currentCardId = getCurrentCard(state)?.id;
  useEffect(() => {
    if (state.phase === 'SETUP') {
      stopThematicMusic();
      return;
    }
    startThematicMusic(pickMusicThemeForPass(state.mode, currentCardId, state.phase));
    setThematicIntensity(state.phase === 'DEBATE' ? 'soft' : 'full');
  }, [state.phase, state.mode, currentCardId]);

  useEffect(() => () => stopThematicMusic(), []);

  const handleAddPlayer = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = nameInput.trim().slice(0, 18);
    if (!trimmed) return;
    if (players.length >= 10) {
      setSetupError('Massimo 10 giocatori in modalità Passa il Telefono.');
      return;
    }
    if (players.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
      setSetupError('Questo nome è già nel gruppo!');
      return;
    }
    const next: PassPlayer = {
      id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: trimmed,
      avatar: PASS_AVATARS[players.length % PASS_AVATARS.length],
    };
    const updated = [...players, next];
    setPlayers(updated);
    savePlayers(updated);
    setNameInput('');
    setSetupError(null);
  };

  const handleRemovePlayer = (id: string) => {
    const updated = players.filter((p) => p.id !== id);
    setPlayers(updated);
    savePlayers(updated);
  };

  // Persist active game state across accidental reloads / mobile tab discards
  useEffect(() => {
    try {
      if (state.phase === 'SETUP') {
        sessionStorage.removeItem(STORAGE_ACTIVE_STATE_KEY);
      } else {
        sessionStorage.setItem(STORAGE_ACTIVE_STATE_KEY, JSON.stringify(state));
      }
    } catch {
      // ignore storage errors
    }
  }, [state]);

  const handleStartGame = async () => {
    const minP = minPlayersForMode(selectedMode);
    if (players.length < minP) {
      setSetupError(`Servono almeno ${minP} giocatori per questa modalità.`);
      return;
    }
    setSetupError(null);
    setLoadingDeck(true);

    let cards: PassCard[] = [];
    if (online) {
      try {
        const res = await fetchWithTimeout(
          '/api/pass-and-play/deck',
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              mode: selectedMode,
              count: roundCount,
              intensity,
              familiarita,
              theme: theme.trim() || undefined,
            }),
          },
          4500,
        );
        if (res.ok) {
          const json = (await res.json()) as { cards?: PassCard[] };
          if (Array.isArray(json.cards) && json.cards.length > 0) {
            cards = json.cards;
            saveCachedDeck(selectedMode, cards);
          }
        }
      } catch {
        // Offline / network fallback handled below
      }
    }

    if (cards.length === 0) {
      const mergedById = new Map<string, PassCard>();
      for (const c of [...loadCachedDeck(selectedMode), ...FALLBACK_DECKS[selectedMode]]) {
        if (!mergedById.has(c.id)) mergedById.set(c.id, c);
      }
      const fallbackPool = [...mergedById.values()];
      const byIntensity =
        selectedMode === 'coppie'
          ? fallbackPool.filter((c) => !('intensity' in c) || c.intensity === intensity)
          : fallbackPool;
      const intensityPool = byIntensity.length > 0 ? byIntensity : fallbackPool;
      const filtered =
        familiarita === 'vecchi_amici'
          ? intensityPool.filter((c) => c.familiarita !== 'nuove_conoscenze')
          : familiarita === 'nuove_conoscenze'
            ? intensityPool.filter((c) => c.familiarita !== 'vecchi_amici')
            : intensityPool;
      cards = shuffleSlice(filtered.length > 0 ? filtered : intensityPool, roundCount);
    }

    setLoadingDeck(false);
    unlockAudio();
    dispatch({ type: 'START_GAME', mode: selectedMode, players, cards });
  };

  const currentCard = getCurrentCard(state);
  const currentPlayer = getCurrentTurnPlayer(state);
  const playerName = (id: string) => state.players.find((p) => p.id === id)?.name ?? 'Amico';

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <button
          type="button"
          className={styles.backBtn}
          onClick={() => {
            if (state.phase === 'SETUP') navigate(-1);
            else dispatch({ type: 'RESET_TO_SETUP' });
          }}
        >
          {state.phase === 'SETUP' ? '← Indietro' : '✕ Esci'}
        </button>
        {state.phase === 'SETUP' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {!online && <Pill selected>✈️ Offline pronto</Pill>}
            <Logo size={22} />
          </div>
        ) : state.phase !== 'FINAL_AWARDS' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className={styles.roundBadge}>
              Round {state.roundIndex + 1}/{state.cards.length}
            </span>
            <MuteButton />
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className={styles.roundBadge}>Fine Serata</span>
            <MuteButton />
          </div>
        )}
      </header>

      {/* SETUP */}
      {state.phase === 'SETUP' && (
        <Card glow="accent" className={styles.setupCard}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <h1 className={styles.title}>📱 Passa il Telefono</h1>
            <button
              type="button"
              aria-label="Dettagli modalità"
              aria-expanded={openInfo === 'header'}
              className={`${styles.infoBtn} ${openInfo === 'header' ? styles.infoBtnActive : ''}`}
              onClick={() => toggleInfo('header')}
            >
              ⓘ
            </button>
          </div>
          {openInfo === 'header' && (
            <p className={styles.infoBox} style={{ marginTop: '-0.3rem', textAlign: 'center' }}>
              Un solo dispositivo per tutto il tavolo. Niente codici, niente QR.
            </p>
          )}

          <div className={styles.setupGrid}>
            <div className={styles.setupCol}>
              <div>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionLabel} style={{ marginBottom: 0 }}>Con chi giochi?</div>
                  <button
                    type="button"
                    aria-label="Dettagli gruppo"
                    aria-expanded={openInfo === 'familiarita'}
                    className={`${styles.infoBtn} ${openInfo === 'familiarita' ? styles.infoBtnActive : ''}`}
                    onClick={() => toggleInfo('familiarita')}
                  >
                    ⓘ
                  </button>
                </div>
                <div className={styles.pillRow}>
                  {FAMILIARITA_VALUES.map((fam) => (
                    <Pill key={fam} selected={familiarita === fam} onClick={() => setFamiliarita(fam)}>
                      {FAMILIARITA_LABELS[fam].nome}
                    </Pill>
                  ))}
                </div>
                {openInfo === 'familiarita' && (
                  <div className={styles.infoBox}>
                    {FAMILIARITA_VALUES.map((fam) => (
                      <div key={fam}>
                        <strong>{FAMILIARITA_LABELS[fam].nome}</strong>: {FAMILIARITA_LABELS[fam].descr}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className={styles.sectionLabel}>1. Scegli la modalità</div>
                <div className={styles.modeGrid}>
                  {MODE_OPTIONS.map((m) => (
                    <div key={m.id} className={styles.modeCell}>
                      <button
                        type="button"
                        className={`${styles.modeBtn} ${selectedMode === m.id ? styles.modeBtnActive : ''}`}
                        onClick={() => setSelectedMode(m.id)}
                      >
                        <span className={styles.modeBtnTitle}>{m.label}</span>
                      </button>
                      <button
                        type="button"
                        aria-label="Dettagli opzione"
                        aria-expanded={openInfo === `mode-${m.id}`}
                        className={`${styles.infoBtn} ${openInfo === `mode-${m.id}` ? styles.infoBtnActive : ''}`}
                        onClick={() => toggleInfo(`mode-${m.id}`)}
                      >
                        ⓘ
                      </button>
                    </div>
                  ))}
                </div>
                {openInfo?.startsWith('mode-') && (
                  <p className={styles.infoBox}>
                    {MODE_OPTIONS.find((m) => `mode-${m.id}` === openInfo)?.desc}
                  </p>
                )}
              </div>

              {selectedMode === 'coppie' && (
                <div>
                  <div className={styles.sectionLabel}>Intensità</div>
                  <div className={styles.pillRow}>
                    <Pill selected={intensity === 'complicita'} onClick={() => setIntensity('complicita')}>
                      🥂 Complicità
                    </Pill>
                    <Pill selected={intensity === 'piccante'} onClick={() => setIntensity('piccante')}>
                      🌶️ Piccante
                    </Pill>
                  </div>
                </div>
              )}

              <div>
                <div className={styles.sectionLabel}>2. Quanti round?</div>
                <div className={styles.pillRow}>
                  {ROUND_COUNTS.map((n) => (
                    <Pill key={n} selected={roundCount === n} onClick={() => setRoundCount(n)}>
                      {n} round
                    </Pill>
                  ))}
                </div>
              </div>
            </div>

            <div className={styles.setupCol}>
              {selectedMode !== 'classico' && (
                <div>
                  <label htmlFor="pass-theme-input" className={styles.sectionLabel} style={{ display: 'block' }}>
                    Tema della serata (opzionale)
                  </label>
                  <TextInput
                    id="pass-theme-input"
                    name="passTheme"
                    style={{ width: '100%' }}
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    placeholder="Es. vacanza al mare, coinquilini, ex..."
                    maxLength={60}
                  />
                </div>
              )}

              <div>
                <label htmlFor="pass-player-input" className={styles.sectionLabel} style={{ display: 'block' }}>
                  3. Chi gioca? ({players.length}/10 · min {minPlayersForMode(selectedMode)})
                </label>
                <form onSubmit={handleAddPlayer} className={styles.rosterInputRow}>
                  <TextInput
                    id="pass-player-input"
                    name="playerName"
                    style={{ width: '100%' }}
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="Nome amico..."
                    maxLength={18}
                  />
                  <Button type="submit" variant="ghost">
                    + Aggiungi
                  </Button>
                </form>
                {players.length > 0 && (
                  <div className={styles.chips} style={{ marginTop: '0.65rem' }}>
                    {players.map((p) => (
                      <span key={p.id} className={styles.chip}>
                        <span>{p.avatar}</span>
                        <span>{p.name}</span>
                        <button
                          type="button"
                          className={styles.chipRemove}
                          aria-label={`Rimuovi ${p.name}`}
                          onClick={() => handleRemovePlayer(p.id)}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {setupError && <Alert tone="danger">{setupError}</Alert>}

              <Button
                variant="primary"
                size="lg"
                disabled={loadingDeck || players.length < minPlayersForMode(selectedMode)}
                onClick={() => void handleStartGame()}
              >
                {loadingDeck ? 'Preparo le carte...' : 'Inizia la serata ▶'}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* CARD INTRO */}
      {state.phase === 'CARD_INTRO' && currentCard && (
        <Card glow="accent" className={styles.card}>
          <p className={styles.subtitle}>Leggete ad alta voce al tavolo</p>
          {state.mode === 'infiltrato' ? (
            <>
              <h2 className={styles.title}>🕵️ Giro delle Domande Segrete</h2>
              <p className={styles.subtitle}>
                Tutti riceveranno la stessa domanda, tranne <strong>1 Infiltrato</strong> che
                riceverà una domanda simile ma diversa. Passate il telefono in cerchio!
              </p>
            </>
          ) : (
            <>
              <h2 className={styles.title}>
                {isFlashOrClassicoCard(currentCard)
                  ? currentCard.text
                  : isAssurdoCard(currentCard) || isCoppieCard(currentCard)
                    ? currentCard.prompt
                    : ''}
              </h2>
              {isFlashOrClassicoCard(currentCard) && (
                <div className={styles.spuntiGrid}>
                  <div className={styles.spuntiBox}>
                    <strong>A:</strong> {currentCard.optionA}
                  </div>
                  <div className={styles.spuntiBox}>
                    <strong>B:</strong> {currentCard.optionB}
                  </div>
                </div>
              )}
            </>
          )}

          <Button variant="primary" size="lg" onClick={() => dispatch({ type: 'BEGIN_ROUND' })}>
            {state.mode === 'coppie' &&
            isCoppieCard(currentCard) &&
            currentCard.cardType !== 'allineamento'
              ? 'Mostra la sfida ▶'
              : 'Inizia il giro segreto 🔒'}
          </Button>
        </Card>
      )}

      {/* PRIVACY CURTAIN */}
      {state.phase === 'PASS_CURTAIN' && currentPlayer && (
        <Card glow="accent" className={styles.curtain}>
          <div className={styles.curtainAvatar} aria-hidden="true">
            {currentPlayer.avatar}
          </div>
          <p className={styles.subtitle}>Passa il telefono a</p>
          <h2 className={styles.curtainName}>{currentPlayer.name}</h2>
          <p className={styles.subtitle}>
            Assicurati che nessun altro stia guardando lo schermo.
          </p>
          <Button
            variant="primary"
            size="lg"
            onClick={() => {
              vibrateTick();
              dispatch({ type: 'UNLOCK_TURN' });
            }}
          >
            Sono {currentPlayer.name} · Sblocca 🔓
          </Button>
        </Card>
      )}

      {/* SECRET TURN */}
      {state.phase === 'SECRET_TURN' && currentPlayer && currentCard && (
        <Card className={styles.card}>
          <div style={{ textAlign: 'center', fontSize: '0.9rem', color: 'var(--gold)', fontWeight: 700 }}>
            {currentPlayer.avatar} Turno segreto di {currentPlayer.name}
          </div>

          {(state.secretKind === 'vote1' ||
            state.secretKind === 'vote2' ||
            state.secretKind === 'coppie_align') && (
            <>
              <h2 className={styles.title}>
                {isFlashOrClassicoCard(currentCard)
                  ? currentCard.text
                  : (currentCard as PassAssurdoCard | PassCoppieCard).prompt}
              </h2>
              <div className={styles.optionsStack}>
                <VoteOption
                  faction="a"
                  letter="A"
                  label={
                    (currentCard as PassFlashCard | PassAssurdoCard | PassCoppieCard).optionA ??
                    'Opzione A'
                  }
                  onClick={() => {
                    vibrateTick();
                    dispatch({ type: 'SUBMIT_VOTE', choice: 'A' });
                  }}
                />
                <VoteOption
                  faction="b"
                  letter="B"
                  label={
                    (currentCard as PassFlashCard | PassAssurdoCard | PassCoppieCard).optionB ??
                    'Opzione B'
                  }
                  onClick={() => {
                    vibrateTick();
                    dispatch({ type: 'SUBMIT_VOTE', choice: 'B' });
                  }}
                />
              </div>
            </>
          )}

          {(state.secretKind === 'gogna' || state.secretKind === 'infiltrato_accuse') && (
            <>
              <h2 className={styles.title}>
                {state.secretKind === 'gogna'
                  ? (currentCard as PassAssurdoCard).prompt
                  : 'Chi è secondo te L’Infiltrato?'}
              </h2>
              <div className={styles.optionsStack}>
                {state.players
                  .filter((p) =>
                    state.secretKind === 'infiltrato_accuse' && state.players.length > 2
                      ? p.id !== currentPlayer.id
                      : true,
                  )
                  .map((p) => (
                    <VoteOption
                      key={p.id}
                      faction="accent"
                      label={`${p.avatar} ${p.name}`}
                      onClick={() => {
                        vibrateTick();
                        dispatch({ type: 'SUBMIT_TARGET', targetId: p.id });
                      }}
                    />
                  ))}
              </div>
            </>
          )}

          {state.secretKind === 'infiltrato_read' && isInfiltratoCard(currentCard) && (
            <>
              <p className={styles.subtitle}>
                Leggi la tua domanda e memorizzala. Non mostrarla a nessuno!
              </p>
              <div className={styles.penaltyBox}>
                <strong>La tua domanda segreta:</strong>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, marginTop: '0.5rem' }}>
                  {currentPlayer.id === state.infiltratoId
                    ? currentCard.impostorQuestion
                    : currentCard.groupQuestion}
                </div>
              </div>
              <Button
                variant="primary"
                size="lg"
                onClick={() => {
                  if (currentPlayer.id === state.infiltratoId) vibrateInfiltrator();
                  else vibrateTick();
                  dispatch({ type: 'ACK_SECRET' });
                }}
              >
                Ho memorizzato, nascondi 🙈
              </Button>
            </>
          )}
        </Card>
      )}

      {/* REVEAL SUSPENSE */}
      {state.phase === 'REVEAL_SUSPENSE' && (
        <Card className={styles.curtain}>
          <p className={styles.subtitle}>Tutti hanno votato. Tra poco il verdetto...</p>
          <div className={styles.suspenseNum}>{suspenseLeft}</div>
        </Card>
      )}

      {/* DEBATE */}
      {state.phase === 'DEBATE' && currentCard && (
        <Card className={styles.card}>
          {state.mode === 'infiltrato' && (
            <>
              <h2 className={styles.title}>🗣️ Giro di risposte & Dibattito</h2>
              <p className={styles.subtitle}>
                Ognuno dice ad alta voce la propria risposta alla domanda segreta. Chi sembra
                fuori luogo?
              </p>
              <div className={styles.timerBox}>
                <span>Timer dibattito</span>
                <span className={styles.timerValue}>{debateLeft}s</span>
                <Button size="md" variant="ghost" onClick={() => setDebatePaused((p) => !p)}>
                  {debatePaused ? 'Riprendi' : 'Pausa'}
                </Button>
              </div>
              <Button
                variant="primary"
                size="lg"
                onClick={() => dispatch({ type: 'START_ACCUSE' })}
              >
                Vota l’Infiltrato in segreto 🕵️
              </Button>
              <Button
                variant="ghost"
                onClick={() => dispatch({ type: 'REVEAL_INFILTRATO_NOW' })}
              >
                Punta il dito al 3 · Rivela subito
              </Button>
            </>
          )}

          {state.mode === 'coppie' && isCoppieCard(currentCard) && (
            <>
              <span className={styles.roundBadge} style={{ alignSelf: 'center' }}>
                {currentCard.cardType === 'verita' ? '💬 Verità' : '⚡ Obbligo'}
              </span>
              <h2 className={styles.title}>{currentCard.prompt}</h2>
              {currentCard.penalty && (
                <div className={styles.penaltyBox}>{currentCard.penalty}</div>
              )}
              <Button variant="primary" size="lg" onClick={() => dispatch({ type: 'NEXT_ROUND' })}>
                Fatto · Prossima Carta ▶
              </Button>
            </>
          )}

          {state.mode !== 'infiltrato' &&
            state.mode !== 'coppie' &&
            state.roundOutcome && (
              <>
                <h2 className={styles.title}>
                  {isFlashOrClassicoCard(currentCard)
                    ? currentCard.text
                    : (currentCard as PassAssurdoCard).prompt}
                </h2>
                <SplitBar split={{ A: state.roundOutcome.countA, B: state.roundOutcome.countB }} />

                <div className={styles.timerBox}>
                  <span>Difendete la scelta!</span>
                  <span className={styles.timerValue}>{debateLeft}s</span>
                  <Button size="md" variant="ghost" onClick={() => setDebatePaused((p) => !p)}>
                    {debatePaused ? 'Riprendi' : 'Pausa'}
                  </Button>
                </div>

                {isFlashOrClassicoCard(currentCard) &&
                  (currentCard.spuntiA?.length || currentCard.spuntiB?.length) && (
                    <div className={styles.spuntiGrid}>
                      {currentCard.spuntiA && currentCard.spuntiA.length > 0 && (
                        <div className={styles.spuntiBox}>
                          <strong>Spunti A ({currentCard.optionA}):</strong>
                          <ul>
                            {currentCard.spuntiA.map((sp) => (
                              <li key={sp}>{sp}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {currentCard.spuntiB && currentCard.spuntiB.length > 0 && (
                        <div className={styles.spuntiBox}>
                          <strong>Spunti B ({currentCard.optionB}):</strong>
                          <ul>
                            {currentCard.spuntiB.map((sp) => (
                              <li key={sp}>{sp}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                {isAssurdoCard(currentCard) && currentCard.sentenza && (
                  <div className={styles.penaltyBox}>{currentCard.sentenza}</div>
                )}

                {state.mode === 'classico' ? (
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={() => dispatch({ type: 'START_REVOTE' })}
                  >
                    Passa al Voto Finale 🗳️
                  </Button>
                ) : (
                  <div className={styles.optionsStack}>
                    <Button
                      variant="primary"
                      size="lg"
                      onClick={() => dispatch({ type: 'NEXT_ROUND' })}
                    >
                      Prossimo Round ▶
                    </Button>
                    {state.mode === 'flash' && (
                      <Button variant="ghost" onClick={() => dispatch({ type: 'START_REVOTE' })}>
                        Qualcuno ha cambiato idea? Rivota 🔄
                      </Button>
                    )}
                  </div>
                )}
              </>
            )}
        </Card>
      )}

      {/* ROUND RESULT */}
      {state.phase === 'ROUND_RESULT' && state.roundOutcome && currentCard && (
        <Card glow="accent" className={styles.card}>
          {state.roundOutcome.kind === 'swing' && (
            <>
              <h2 className={styles.title}>
                {state.roundOutcome.swingDelta && state.roundOutcome.swingDelta > 0
                  ? `🦋 ${state.roundOutcome.swingDelta} ${state.roundOutcome.swingDelta === 1 ? 'persona ha' : 'persone hanno'} cambiato idea!`
                  : '🗿 Nessuno ha cambiato idea!'}
              </h2>
              <SplitBar split={{ A: state.roundOutcome.countA, B: state.roundOutcome.countB }} />
              {typeof state.roundOutcome.prevCountA === 'number' && (
                <p className={styles.subtitle}>
                  Prima era {state.roundOutcome.prevCountA} A vs {state.roundOutcome.prevCountB} B
                </p>
              )}
            </>
          )}

          {state.roundOutcome.kind === 'gogna' && (
            <>
              <h2 className={styles.title}>
                🎯 Alla Gogna:{' '}
                {(state.roundOutcome.gognaWinnerIds ?? []).map(playerName).join(' & ')}!
              </h2>
              <p className={styles.subtitle}>
                Con {state.roundOutcome.gognaTopVotes ?? 0} voti dal tavolo
              </p>
              {(currentCard as PassAssurdoCard).penalty && (
                <div className={styles.penaltyBox}>{(currentCard as PassAssurdoCard).penalty}</div>
              )}
            </>
          )}

          {state.roundOutcome.kind === 'infiltrato' && (
            <>
              <h2 className={styles.title}>
                {state.roundOutcome.infiltratoCaught
                  ? '🔍 Infiltrato smascherato!'
                  : '🕵️ L’Infiltrato l’ha fatta franca!'}
              </h2>
              <p className={styles.subtitle}>
                L’Infiltrato era:{' '}
                <strong>
                  {state.roundOutcome.infiltratoId
                    ? playerName(state.roundOutcome.infiltratoId)
                    : '—'}
                </strong>
              </p>
              <div className={styles.spuntiGrid}>
                <div className={styles.spuntiBox}>
                  <strong>Domanda del gruppo:</strong>
                  <div>{(currentCard as PassInfiltratoCard).groupQuestion}</div>
                </div>
                <div className={styles.spuntiBox}>
                  <strong>Domanda dell’infiltrato:</strong>
                  <div>{(currentCard as PassInfiltratoCard).impostorQuestion}</div>
                </div>
              </div>
            </>
          )}

          {state.roundOutcome.kind === 'coppie_align' && (
            <>
              <h2 className={styles.title}>
                {state.roundOutcome.coppieMatched
                  ? '💘 Sintonia perfetta!'
                  : '⚡ Scintille! Siete divisi!'}
              </h2>
              <SplitBar split={{ A: state.roundOutcome.countA, B: state.roundOutcome.countB }} />
            </>
          )}

          <Button variant="primary" size="lg" onClick={() => dispatch({ type: 'NEXT_ROUND' })}>
            {state.roundIndex + 1 >= state.cards.length ? 'Vedi Premi Finali 🏆' : 'Prossimo Round ▶'}
          </Button>
        </Card>
      )}

      {/* FINAL AWARDS */}
      {state.phase === 'FINAL_AWARDS' && (
        <Card glow="accent" className={styles.card}>
          <Celebration />
          <h2 className={styles.title}>🏆 Premi della Serata</h2>
          <div className={styles.optionsStack}>
            {computePassAwards(state).map((aw) => (
              <div key={aw.id} className={styles.awardItem}>
                <span className={styles.awardEmoji}>{aw.emoji}</span>
                <div>
                  <div style={{ fontWeight: 800 }}>
                    {aw.title} · {aw.winnerName}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {aw.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <Button
            variant="primary"
            size="lg"
            onClick={() => dispatch({ type: 'RESET_TO_SETUP' })}
          >
            Rigioca con gli stessi amici 🔄
          </Button>
          <Button variant="ghost" onClick={() => navigate('/')}>
            Torna alla Home
          </Button>
        </Card>
      )}
    </main>
  );
}
