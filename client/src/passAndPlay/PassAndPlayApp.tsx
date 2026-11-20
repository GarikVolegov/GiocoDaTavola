import { useEffect, useReducer, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import {
  Button,
  Card,
  CruciverbaGrid,
  Logo,
  Pill,
  TextInput,
  Alert,
  VoteOption,
} from '../shared/ui';
import { fetchWithTimeout } from '../shared/api';
import { addSeenDilemmaIds, getSeenDilemmaIds } from '../shared/seenDilemmas';
import { useOnlineStatus } from '../shared/useOnlineStatus';
import { useIntensityTheme } from '../shared/useIntensityTheme';
import { vibrateInfiltrator, vibrateTick } from '../shared/haptics';
import { playFanfare, playGong, playSiren } from '../host/audio/synthSfx';
import { play as playSfx } from '../host/audio/sfx';
import { unlockAudio } from '../host/audio/engine';
import { MuteButton } from '../host/MuteButton';
import {
  pickMusicThemeForPass,
  setThematicIntensity,
  startThematicMusic,
  stopThematicMusic,
} from '../host/audio/thematicMusic';
import {
  DURATE,
  DURATA_LABELS,
  FAMILIARITA_VALUES,
  FAMILIARITA_LABELS,
  PERCORSI_CATALOG,
  STORY_GENRE_LABELS,
  type CoppieIntensity,
  type Durata,
  type Familiarita,
  type InfiltratoTono,
  type StoriaCatalogItem,
} from '../shared/events';
import {
  FALLBACK_DECKS,
  SOLO_FALLBACK_DECKS,
  type PassAssurdoCard,
  type PassCard,
  type PassCardOriginMode,
  type PassFlashCard,
  type PassInfiltratoCard,
  type PassMode,
} from './fallbackDeck';
import {
  PASS_AVATARS,
  PASS_STATE_VERSION,
  buildPassCouples,
  computePassAwards,
  createInitialPassState,
  effectivePassCardMode,
  getCurrentCard,
  getCurrentReaderPlayer,
  getCurrentTurnPlayer,
  isAssurdoCard,
  isBufalaCard,
  isCoppieCard,
  isCruciverbaCard,
  isFlashOrClassicoCard,
  isGhigliottinaCard,
  isInfiltratoCard,
  isIntesaCard,
  isTribunaleCard,
  isPreferirestiCard,
  isStimaCard,
  minPlayersForMode,
  passReducer,
  toCruciverbaGridState,
  type CruciverbaMode,
  type PassPlayer,
} from './passAndPlayEngine';
import PassFinaleView from './PassFinaleView';
import styles from './PassAndPlayApp.module.css';

const STORAGE_PLAYERS_KEY = 'schierati:passPlayers';
const STORAGE_ACTIVE_STATE_KEY = 'schierati:passActiveState';
const STORAGE_DECK_CACHE_PREFIX = 'schierati:passDeckCache:';
const MAX_CACHED_CARDS_PER_MODE = 60;

function isGroupDrinkPenalty(text?: string | null): boolean {
  if (!text) return false;
  return /minoranza|beve|bevete|sorso|sorsi|al tavolo|penitenza collettiva/i.test(text);
}

const MODE_OPTIONS: Array<{ id: PassMode; label: string; desc: string }> = [
  { id: 'flash', label: '⚡ Flash', desc: 'Zero passaggi · Scelta immediata tra due posizioni e confronto al volo' },
  { id: 'classico', label: '🎭 Classico', desc: 'Dilemmi schietti · Scegli la tua posizione e approfondisci con il rilancio' },
  { id: 'infiltrato', label: '🕵️ L’Infiltrato', desc: '1 giro segreto per la domanda, poi 3-2-1 punta il dito!' },
  { id: 'assurdo', label: '🤪 Assurdo', desc: 'Prove di dignità e gogna al tavolo' },
  { id: 'coppie', label: '🔥 Coppie', desc: 'Per fidanzati: intesa, verità e sfide di coppia' },
  {
    id: 'cruciverba',
    label: '🧩 Cruciverba',
    desc: 'Cruciverba cooperativo senza timer · Chi legge dà gli indizi',
  },
  {
    id: 'tribunale',
    label: '⚖️ Tribunale',
    desc: 'Arringhe faccia a faccia senza timer e verdetto della giuria',
  },
  {
    id: 'preferiresti',
    label: '🔀 Preferiresti',
    desc: 'Quattro alternative assurde tra cui scegliere subito',
  },
  {
    id: 'ghigliottina',
    label: '🔗 Ghigliottina',
    desc: '5 parole indizio e 1 parola segreta che le lega tutte (come in TV!)',
  },
  {
    id: 'stima',
    label: '💰 Quanto Vale?',
    desc: 'Indovina numeri, altezze e prezzi reali: chi ci va più vicino vince!',
  },
  {
    id: 'bufala',
    label: '🎭 Vero o Bufala?',
    desc: 'Fatto incredibile o leggenda metropolitana? Decidi subito!',
  },
  {
    id: 'intesa',
    label: '🚫 Parola Vietata',
    desc: 'Descrivi la parola segreta al volo senza pronunciare le 4 parole vietate!',
  },
  {
    id: 'percorso',
    label: '🧗 Percorso',
    desc: 'Viaggio a tappe dalle scelte leggere fino ai bilanci profondi',
  },
  {
    id: 'storia',
    label: '📖 Storie',
    desc: 'Racconti interattivi a bivi con conseguenze ed epilogo finale',
  },
  {
    id: 'mix',
    label: '🎲 Serata Mix · Tutti i giochi casuali',
    desc: '12 giochi a rotazione: Flash, Preferiresti, Ghigliottina, Quanto Vale?, Vero o Bufala, Parola Vietata, Cruciverba, Tribunale, Coppie, Classico, Assurdo e Infiltrato!',
  },
];

function getModeDescription(mode: PassMode, playMode: 'solo' | 'gruppo'): string {
  if (playMode === 'solo') {
    if (mode === 'preferiresti') return 'Due scenari strani e surreali: scelta secca A o B';
    if (mode === 'assurdo') return 'Scenari bizzarri e scelte assurde a 2 opzioni';
    if (mode === 'cruciverba') return 'Cruciverba veloce: scegli tra 4 parole o risolvi dagli indizi';
    if (mode === 'ghigliottina') return '5 parole indizio, 1 parola che le lega: scrivila o scegli tra 4!';
    if (mode === 'stima') return 'Punta col cursore sul numero reale e scopri la tua precisione!';
    if (mode === 'bufala') return 'Vero o Bufala? Metti alla prova il tuo fiuto in 1 tocco';
    if (mode === 'mix') {
      return 'Mix veloce da 8 giochi: dilemmi strani, Preferiresti a 2 scelte, Assurdo, Cruciverba, Ghigliottina, Quanto Vale? e Vero o Bufala!';
    }
    if (mode === 'flash') return 'Dilemmi strani e personali con scelta secca a 2 opzioni';
    if (mode === 'classico') return 'Domande profonde e fuori dal comune per esplorare come ragioni';
  }
  return MODE_OPTIONS.find((m) => m.id === mode)?.desc ?? '';
}

const FALLBACK_STORIES_CATALOG: StoriaCatalogItem[] = [
  {
    id: 'bussola-notturna',
    title: 'La Stazione di Mezza Notte',
    genre: 'dramma',
    emoji: '🧭',
    hook: 'Dieci anni di vita davanti a una valigia pronta e un biglietto di sola andata.',
    durataStimaMin: 15,
    scene: 2,
  },
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

function deckCacheKey(mode: PassMode, isSolo: boolean): string {
  return `${STORAGE_DECK_CACHE_PREFIX}${isSolo ? 'solo:' : ''}${mode}`;
}

function loadCachedDeck(mode: PassMode, isSolo = false): PassCard[] {
  try {
    const raw = localStorage.getItem(deckCacheKey(mode, isSolo));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as PassCard[]) : [];
  } catch {
    return [];
  }
}

function saveCachedDeck(mode: PassMode, cards: PassCard[], isSolo = false): void {
  try {
    const existing = loadCachedDeck(mode, isSolo);
    const byId = new Map<string, PassCard>();
    for (const c of [...cards, ...existing]) {
      if (c && typeof c.id === 'string' && !byId.has(c.id)) byId.set(c.id, c);
    }
    localStorage.setItem(
      deckCacheKey(mode, isSolo),
      JSON.stringify([...byId.values()].slice(0, MAX_CACHED_CARDS_PER_MODE)),
    );
  } catch {
    // ignore storage quota errors
  }
}

function fallbackPoolForMode(sub: PassCardOriginMode, isSolo: boolean): PassCard[] {
  if (isSolo) {
    if (sub === 'flash') return SOLO_FALLBACK_DECKS.flash;
    if (sub === 'classico') return SOLO_FALLBACK_DECKS.classico;
    if (sub === 'preferiresti') return SOLO_FALLBACK_DECKS.preferiresti;
    if (sub === 'assurdo') return SOLO_FALLBACK_DECKS.assurdo;
    if (sub === 'percorso') return SOLO_FALLBACK_DECKS.percorso;
  }
  return FALLBACK_DECKS[sub];
}

function pickPassCards(
  fallbackPool: PassCard[],
  count: number,
  seenSet: Set<string>,
  familiarita: Familiarita,
  coppieIntensity?: CoppieIntensity,
): PassCard[] {
  const unseenPool = fallbackPool.filter((c) => !seenSet.has(c.id));
  const basePool = unseenPool.length >= count ? unseenPool : fallbackPool;
  const byIntensity = coppieIntensity
    ? basePool.filter((c) => !('intensity' in c) || c.intensity === coppieIntensity)
    : basePool;
  const intensityPool = byIntensity.length > 0 ? byIntensity : basePool;
  const filtered =
    familiarita === 'vecchi_amici'
      ? intensityPool.filter((c) => c.familiarita !== 'nuove_conoscenze')
      : familiarita === 'nuove_conoscenze'
        ? intensityPool.filter((c) => c.familiarita !== 'vecchi_amici')
        : intensityPool;
  const primary = shuffleSlice(filtered.length > 0 ? filtered : intensityPool, count);
  if (primary.length < count) {
    const pickedIds = new Set(primary.map((c) => c.id));
    const extraFromIntensity = shuffleSlice(
      intensityPool.filter((c) => !pickedIds.has(c.id)),
      count - primary.length,
    );
    for (const c of extraFromIntensity) {
      primary.push(c);
      pickedIds.add(c.id);
    }
    if (primary.length < count) {
      const extraFromAll = shuffleSlice(
        fallbackPool.filter((c) => !pickedIds.has(c.id)),
        count - primary.length,
      );
      primary.push(...extraFromAll);
    }
  }
  return primary;
}

function buildOfflineMixDeck(
  roundCount: number,
  playerCount: number,
  seenSet: Set<string>,
  familiarita: Familiarita,
  intensity: CoppieIntensity,
): PassCard[] {
  const subModes: PassCardOriginMode[] =
    playerCount >= 2
      ? [
          'flash',
          'preferiresti',
          'assurdo',
          'coppie',
          'cruciverba',
          'classico',
          'ghigliottina',
          'stima',
          'bufala',
          'intesa',
        ]
      : ['flash', 'preferiresti', 'assurdo', 'cruciverba', 'classico', 'ghigliottina', 'stima', 'bufala'];
  if (playerCount >= 3) {
    subModes.push('infiltrato', 'tribunale');
  }

  const isSolo = playerCount === 1;
  const cachedMixBySub = new Map<PassCardOriginMode, PassCard[]>();
  for (const c of loadCachedDeck('mix', isSolo)) {
    const sub = effectivePassCardMode('mix', c);
    const list = cachedMixBySub.get(sub) ?? [];
    list.push(c);
    cachedMixBySub.set(sub, list);
  }

  const shuffledModes = shuffleSlice(subModes, subModes.length);
  const buckets = shuffledModes
    .map((sub) => {
      const byId = new Map<string, PassCard>();
      for (const c of [
        ...(cachedMixBySub.get(sub) ?? []),
        ...loadCachedDeck(sub, isSolo),
        ...fallbackPoolForMode(sub, isSolo),
      ]) {
        if (playerCount < 2 && sub === 'assurdo' && isAssurdoCard(c) && c.cardType !== 'dignita') {
          continue;
        }
        const normalized =
          isSolo && sub === 'preferiresti' && isPreferirestiCard(c)
            ? { ...c, options: c.options.slice(0, 2) }
            : c;
        if (!byId.has(normalized.id)) byId.set(normalized.id, normalized);
      }
      const picked = pickPassCards(
        [...byId.values()],
        Math.max(1, roundCount),
        seenSet,
        familiarita,
        sub === 'coppie' ? intensity : undefined,
      ).map((c) => ({ ...c, cardMode: sub }) as PassCard);
      return { sub, cards: picked, cursor: 0 };
    })
    .filter((b) => b.cards.length > 0);

  const mixed: PassCard[] = [];
  let lastSub: PassCardOriginMode | null = null;
  while (mixed.length < roundCount) {
    const eligible = buckets.filter((b) => b.cursor < b.cards.length && b.sub !== lastSub);
    const pool = eligible.length > 0 ? eligible : buckets.filter((b) => b.cursor < b.cards.length);
    if (pool.length === 0) break;
    // Prefer buckets furthest behind in cursor count so games cycle evenly, with randomized tie-breaking
    const minCursor = Math.min(...pool.map((b) => b.cursor));
    const nextCandidates = pool.filter((b) => b.cursor === minCursor);
    const chosen = nextCandidates[Math.floor(Math.random() * nextCandidates.length)];
    mixed.push(chosen.cards[chosen.cursor++]);
    lastSub = chosen.sub;
  }
  return mixed;
}

function loadActivePassState(): ReturnType<typeof createInitialPassState> | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_ACTIVE_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ReturnType<typeof createInitialPassState>;
    if (
      parsed &&
      typeof parsed === 'object' &&
      parsed.version === PASS_STATE_VERSION &&
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
  const { isSignedIn, getToken } = useAuth();
  const [state, dispatch] = useReducer(
    passReducer,
    undefined,
    () => loadActivePassState() ?? createInitialPassState(),
  );

  // Setup local state
  const [playMode, setPlayMode] = useState<'solo' | 'gruppo'>(() =>
    loadSavedPlayers().length === 1 ? 'solo' : 'gruppo',
  );
  const [soloName, setSoloName] = useState<string>(() => loadSavedPlayers()[0]?.name || 'Tu');
  const [cruciverbaMode, setCruciverbaMode] = useState<CruciverbaMode>(() =>
    loadSavedPlayers().length === 1 ? 'scelte' : 'indizi',
  );
  const [soloFast, setSoloFast] = useState<boolean>(true);
  const [setupTab, setSetupTab] = useState<'party' | 'classica'>('party');
  const [classicSub, setClassicSub] = useState<'classico' | 'percorso' | 'storia'>('classico');
  const [percorsoId, setPercorsoId] = useState<string>(PERCORSI_CATALOG[0]?.id ?? 'bussola');
  const [startTappa, setStartTappa] = useState<number>(1);
  const [durata, setDurata] = useState<Durata>('corto');
  const [storiesCatalog, setStoriesCatalog] = useState<StoriaCatalogItem[]>(FALLBACK_STORIES_CATALOG);
  const [storyId, setStoryId] = useState<string>(FALLBACK_STORIES_CATALOG[0]?.id ?? 'bussola-notturna');
  const [selectedMode, setSelectedMode] = useState<PassMode>('mix');
  const [showSingleModes, setShowSingleModes] = useState(false);
  const [familiarita, setFamiliarita] = useState<Familiarita>('vecchi_amici');
  const [intensity, setIntensity] = useState<CoppieIntensity>('complicita');
  const [infiltratoTono, setInfiltratoTono] = useState<InfiltratoTono>('risate');
  const [roundCount, setRoundCount] = useState<number>(5);
  const [theme, setTheme] = useState('');
  const [showAdvancedSetup, setShowAdvancedSetup] = useState(false);
  const [players, setPlayers] = useState<PassPlayer[]>(() => loadSavedPlayers());
  const [nameInput, setNameInput] = useState('');
  const [loadingDeck, setLoadingDeck] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [recordSavedCode, setRecordSavedCode] = useState<string | null>(null);
  const recordedSessionKeyRef = useRef<string | null>(null);

  // Transient live-turn selections (no countdown timers)
  const [pickingCruciverbaSolver, setPickingCruciverbaSolver] = useState(false);
  const [selectedCoppieMatches, setSelectedCoppieMatches] = useState<string[]>([]);
  const [swapCoupleId, setSwapCoupleId] = useState<string | null>(null);
  const [ghigliottinaInput, setGhigliottinaInput] = useState('');
  const [ghigliottinaShowChoices, setGhigliottinaShowChoices] = useState(false);
  const [stimaValue, setStimaValue] = useState(0);
  const [stimaGroupRevealed, setStimaGroupRevealed] = useState(false);

  const effectivePlayers: PassPlayer[] =
    playMode === 'solo'
      ? [
          {
            id: 'solo_player',
            name: soloName.trim() || 'Tu',
            avatar: PASS_AVATARS[0],
          },
        ]
      : players;

  useEffect(() => {
    if (!online) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetchWithTimeout('/api/pass-and-play/stories', {}, 3000);
        if (!res.ok) return;
        const json = (await res.json()) as { stories?: StoriaCatalogItem[] };
        if (!cancelled && Array.isArray(json.stories) && json.stories.length > 0) {
          setStoriesCatalog(json.stories);
          setStoryId((cur) =>
            json.stories!.some((s) => s.id === cur) ? cur : json.stories![0].id,
          );
        }
      } catch {
        // Fallback story catalog already present
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [online]);

  const currentPassCard = getCurrentCard(state);
  const activePassMode: PassMode =
    state.phase === 'SETUP'
      ? selectedMode
      : effectivePassCardMode(state.mode, currentPassCard);
  useIntensityTheme({
    partyMode:
      activePassMode === 'classico' ||
      activePassMode === 'cruciverba' ||
      activePassMode === 'tribunale' ||
      activePassMode === 'percorso' ||
      activePassMode === 'storia'
        ? null
        : activePassMode,
    partyIntensity: activePassMode === 'coppie' ? intensity : null,
    mood:
      activePassMode === 'classico' ||
      activePassMode === 'percorso' ||
      activePassMode === 'storia'
        ? 'profonda'
        : activePassMode === 'cruciverba'
          ? 'leggera'
          : undefined,
  });

  // Reset transient per-round UI helpers on round/phase/turn changes
  useEffect(() => {
    setPickingCruciverbaSolver(false);
    setSelectedCoppieMatches([]);
    setGhigliottinaInput('');
    setGhigliottinaShowChoices(false);
    setStimaGroupRevealed(false);
    if (currentPassCard && isStimaCard(currentPassCard)) {
      const mid = (currentPassCard.min + currentPassCard.max) / 2;
      const step = Math.max(1, currentPassCard.step);
      const snapped =
        Math.round((mid - currentPassCard.min) / step) * step + currentPassCard.min;
      setStimaValue(Math.min(currentPassCard.max, Math.max(currentPassCard.min, snapped)));
    }
  }, [state.roundIndex, state.phase, state.cruciverbaState?.turnsTaken, currentPassCard]);

  // Sync saved players back to setup on rematch
  useEffect(() => {
    if (state.phase === 'SETUP' && state.players.length > 0 && players.length === 0) {
      if (state.players.length === 1) {
        setPlayMode('solo');
        setSoloName(state.players[0].name);
      } else {
        setPlayers(state.players);
      }
    }
  }, [state.phase, state.players, players.length]);

  // Themed SFX on phase transitions
  useEffect(() => {
    if (state.phase === 'FINAL_AWARDS') {
      playFanfare();
      return;
    }
    if (state.phase === 'DEBATE') {
      if (effectivePassCardMode(state.mode, currentPassCard) === 'infiltrato') playSiren();
      else playSfx('reveal');
      return;
    }
    if (state.phase === 'ROUND_RESULT' && state.roundOutcome) {
      const o = state.roundOutcome;
      if (o.infiltratoCaught || o.coppieMatched) {
        playFanfare();
      } else if (o.kind === 'gogna') {
        playGong();
      } else {
        playSfx('reveal');
      }
    }
  }, [state.phase, state.mode, state.roundIndex, state.roundOutcome, currentPassCard]);

  // Unlock audio on first gesture in case user reloads mid-game
  useEffect(() => {
    const onGesture = () => unlockAudio();
    window.addEventListener('pointerdown', onGesture, { once: true });
    window.addEventListener('keydown', onGesture, { once: true });
    return () => {
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
    };
  }, []);

  // Persist completed Pass & Play run for signed-in users
  useEffect(() => {
    if (state.phase === 'SETUP') {
      recordedSessionKeyRef.current = null;
      setRecordSavedCode(null);
      return;
    }
    if (state.phase !== 'FINAL_AWARDS' || !online || !isSignedIn || state.cards.length === 0) {
      return;
    }
    const sessionKey = `${state.mode}:${state.cards.map((c) => c.id).join(',')}:${state.players.length}`;
    if (recordedSessionKeyRef.current === sessionKey) return;
    recordedSessionKeyRef.current = sessionKey;

    let cancelled = false;
    void (async () => {
      try {
        const token = await getToken();
        if (!token || cancelled) return;
        const awards = computePassAwards(state);
        const res = await fetchWithTimeout('/api/me/pass-and-play-record', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            partyMode: state.mode,
            rounds: state.cards.length,
            playerCount: state.players.length,
            nickname: state.players[0]?.name || 'Capo Tavolo',
            score: awards.length,
          }),
        });
        if (!res.ok) return;
        const json = (await res.json()) as { ok?: boolean; gameCode?: string };
        if (!cancelled && json.ok) {
          setRecordSavedCode(json.gameCode ?? 'OK');
        }
      } catch {
        // Best-effort history recording; never interrupt the party screen
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [state.phase, state.mode, state.cards, state.players, online, isSignedIn, getToken, state]);

  // Thematic background music for Pass & Play
  const currentCardId = currentPassCard?.id;
  useEffect(() => {
    if (state.phase === 'SETUP') {
      stopThematicMusic();
      return;
    }
    startThematicMusic(
      pickMusicThemeForPass(
        effectivePassCardMode(state.mode, currentPassCard),
        currentCardId,
        state.phase,
        {
          intensity: intensity === 'profondo' ? null : intensity,
          infiltratoTono,
          roundIndex: state.roundIndex,
        },
      ),
    );
    setThematicIntensity(state.phase === 'DEBATE' ? 'soft' : 'full');
  }, [state.phase, state.mode, currentPassCard, currentCardId, intensity, infiltratoTono, state.roundIndex]);

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
    if (effectivePlayers.length < minP) {
      setSetupError(`Servono almeno ${minP} giocatori per questa modalità.`);
      return;
    }
    if (selectedMode === 'coppie' && effectivePlayers.length % 2 !== 0) {
      setSetupError('Coppie è pensata per fidanzati: aggiungi o rimuovi 1 giocatore per formare coppie complete (2, 4, 6 o 8).');
      return;
    }
    setSetupError(null);
    setLoadingDeck(true);

    const isSoloGame = effectivePlayers.length === 1;
    const seenIds = getSeenDilemmaIds();
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
              playerCount: effectivePlayers.length,
              intensity,
              infiltratoTono,
              familiarita,
              theme: theme.trim() || undefined,
              percorsoId: selectedMode === 'percorso' ? percorsoId : undefined,
              startTappa: selectedMode === 'percorso' ? startTappa : undefined,
              durata: selectedMode === 'percorso' ? durata : undefined,
              storyId: selectedMode === 'storia' ? storyId : undefined,
              excludeIds: seenIds.slice(-200),
            }),
          },
          4500,
        );
        if (res.ok) {
          const json = (await res.json()) as { cards?: PassCard[] };
          if (Array.isArray(json.cards) && json.cards.length > 0) {
            cards = json.cards;
            if (selectedMode !== 'storia' && selectedMode !== 'percorso') {
              saveCachedDeck(selectedMode, cards, isSoloGame);
            }
          }
        }
      } catch {
        // Offline / network fallback handled below
      }
    }

    if (cards.length === 0) {
      const seenSet = new Set(seenIds);
      if (selectedMode === 'mix') {
        cards = buildOfflineMixDeck(
          roundCount,
          effectivePlayers.length,
          seenSet,
          familiarita,
          intensity,
        );
      } else if (selectedMode === 'storia') {
        cards = [...FALLBACK_DECKS.storia];
      } else if (selectedMode === 'percorso') {
        cards = [...fallbackPoolForMode('percorso', isSoloGame)];
      } else {
        const mergedById = new Map<string, PassCard>();
        const pool = [
          ...loadCachedDeck(selectedMode, isSoloGame),
          ...fallbackPoolForMode(selectedMode, isSoloGame),
        ];
        for (const c of pool) {
          if (
            effectivePlayers.length < 2 &&
            selectedMode === 'assurdo' &&
            isAssurdoCard(c) &&
            c.cardType !== 'dignita'
          ) {
            continue;
          }
          const normalized =
            isSoloGame && isPreferirestiCard(c)
              ? { ...c, options: c.options.slice(0, 2) }
              : c;
          if (!mergedById.has(normalized.id)) mergedById.set(normalized.id, normalized);
        }
        cards = pickPassCards(
          [...mergedById.values()],
          roundCount,
          seenSet,
          familiarita,
          selectedMode === 'coppie' ? intensity : undefined,
        );
      }
    }

    addSeenDilemmaIds(cards.map((c) => c.id));
    setLoadingDeck(false);
    unlockAudio();
    dispatch({
      type: 'START_GAME',
      mode: selectedMode,
      players: effectivePlayers,
      cards,
      cruciverbaMode,
      soloFast: isSoloGame ? soloFast : false,
    });
  };

  const renderCruciverbaModeToggle = () => (
    <div style={{ marginTop: '0.35rem' }}>
      <div className={styles.sectionLabel}>Modalità Cruciverba</div>
      <div className={styles.segmentGrid2} role="group" aria-label="Modalità Cruciverba">
        <button
          type="button"
          aria-pressed={cruciverbaMode === 'indizi'}
          className={`${styles.segmentBtn} ${cruciverbaMode === 'indizi' ? styles.segmentBtnActive : ''}`}
          onClick={() => setCruciverbaMode('indizi')}
        >
          📝 Con indizi
        </button>
        <button
          type="button"
          aria-pressed={cruciverbaMode === 'scelte'}
          className={`${styles.segmentBtn} ${cruciverbaMode === 'scelte' ? styles.segmentBtnActive : ''}`}
          onClick={() => setCruciverbaMode('scelte')}
        >
          🎯 4 scelte
        </button>
      </div>
    </div>
  );

  const currentCard = getCurrentCard(state);
  const currentPlayer = getCurrentTurnPlayer(state);
  const readerPlayer = getCurrentReaderPlayer(state);
  const playerName = (id: string) => state.players.find((p) => p.id === id)?.name ?? 'Amico';
  const playerAvatar = (id: string) => state.players.find((p) => p.id === id)?.avatar ?? '🎲';
  const nextInfiltratoPlayer =
    state.turnIndex + 1 < state.players.length ? state.players[state.turnIndex + 1] : null;
  const advancedSummary =
    playMode === 'solo'
      ? `${roundCount} round · ${soloFast ? '⚡ Veloce' : '🧭 Riflessione'}${theme.trim() ? ` · "${theme.trim()}"` : ''}`
      : `${roundCount} round · ${FAMILIARITA_LABELS[familiarita === 'nuove_conoscenze' ? 'nuove_conoscenze' : 'vecchi_amici'].nome}${theme.trim() ? ` · "${theme.trim()}"` : ''}`;

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <button
          type="button"
          className={styles.backBtn}
          onClick={() => {
            if (state.phase === 'SETUP') {
              if (window.history.length > 1) navigate(-1);
              else navigate('/');
            } else {
              dispatch({ type: 'RESET_TO_SETUP' });
            }
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {state.players.length === 1 && (
              <Pill
                selected={Boolean(state.soloFast)}
                onClick={() => dispatch({ type: 'SET_SOLO_FAST', enabled: !state.soloFast })}
                aria-label="Cambia ritmo partita da solo"
              >
                {state.soloFast ? '⚡ Veloce' : '🧭 Riflessione'}
              </Pill>
            )}
            <span className={styles.roundBadge}>
              Round {state.roundIndex + 1}/{state.cards.length}
            </span>
            <MuteButton inline />
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className={styles.roundBadge}>Fine Serata</span>
            <MuteButton inline />
          </div>
        )}
      </header>

      {/* SETUP IN 2 PASSI */}
      {state.phase === 'SETUP' && (
        <Card glow="accent" className={styles.setupCard}>
          <div className={styles.setupHeader}>
            <h1 className={styles.title}>📱 Passa il Telefono</h1>
            <p className={styles.setupSub}>
              {playMode === 'solo'
                ? 'Dilemmi strani e personali solo per te · 2 scelte secche, ritmo rapido'
                : 'Guardate gli amici, non lo schermo · Un lettore a turno, esiti con 1 tocco'}
            </p>
          </div>

          <div className={styles.setupGrid}>
            <div className={styles.setupCol}>
              {/* 1A. SOLO VS GRUPPO */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div className={styles.sectionLabel}>Come giochi?</div>
                <div className={styles.segmentGrid2}>
                  <button
                    type="button"
                    aria-pressed={playMode === 'solo'}
                    className={`${styles.segmentBtn} ${playMode === 'solo' ? styles.segmentBtnActive : ''}`}
                    onClick={() => {
                      setPlayMode('solo');
                      setCruciverbaMode('scelte');
                      if (minPlayersForMode(selectedMode) > 1) {
                        setSelectedMode('mix');
                      }
                    }}
                  >
                    👤 Da solo
                  </button>
                  <button
                    type="button"
                    aria-pressed={playMode === 'gruppo'}
                    className={`${styles.segmentBtn} ${playMode === 'gruppo' ? styles.segmentBtnActive : ''}`}
                    onClick={() => {
                      setPlayMode('gruppo');
                      setCruciverbaMode('indizi');
                    }}
                  >
                    👥 In gruppo
                  </button>
                </div>
              </div>

              {/* 1B. PARTY MODE VS MODALITÀ CLASSICA TABS */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div className={styles.sectionLabel}>1. Modalità di gioco</div>
                <div className={styles.segmentGrid2}>
                  <button
                    type="button"
                    aria-pressed={setupTab === 'party'}
                    className={`${styles.segmentBtn} ${setupTab === 'party' ? styles.segmentBtnActive : ''}`}
                    onClick={() => {
                      setSetupTab('party');
                      if (selectedMode === 'percorso' || selectedMode === 'storia') {
                        setSelectedMode('mix');
                      }
                    }}
                  >
                    🔥 Party Mode
                  </button>
                  <button
                    type="button"
                    aria-pressed={setupTab === 'classica'}
                    className={`${styles.segmentBtn} ${setupTab === 'classica' ? styles.segmentBtnActive : ''}`}
                    onClick={() => {
                      setSetupTab('classica');
                      setSelectedMode(classicSub);
                    }}
                  >
                    🏛️ Modalità Classica
                  </button>
                </div>

                {setupTab === 'party' ? (
                  <>
                    <button
                      type="button"
                      aria-pressed={selectedMode === 'mix'}
                      onClick={() => {
                        setSelectedMode('mix');
                        setShowSingleModes(false);
                      }}
                      style={{
                        width: '100%',
                        minHeight: '3.25rem',
                        padding: '0.75rem 0.9rem',
                        borderRadius: 'var(--radius-md, 10px)',
                        border:
                          selectedMode === 'mix'
                            ? '2px solid var(--gold)'
                            : '1px solid rgba(229, 193, 88, 0.35)',
                        background:
                          selectedMode === 'mix'
                            ? 'linear-gradient(135deg, rgba(229, 193, 88, 0.22) 0%, rgba(20, 26, 52, 0.85) 100%)'
                            : 'rgba(255, 255, 255, 0.04)',
                        color: 'var(--text)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.3rem',
                        boxShadow:
                          selectedMode === 'mix' ? '0 0 0 1px rgba(229, 193, 88, 0.28)' : undefined,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.5rem',
                          width: '100%',
                        }}
                      >
                        <span
                          style={{
                            fontFamily: 'var(--font-display)',
                            fontWeight: 900,
                            fontSize: '0.95rem',
                            color: 'var(--gold)',
                            textTransform: 'uppercase',
                          }}
                        >
                          🎲 Serata Mix · Tutti i giochi casuali
                        </span>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            padding: '0.12rem 0.45rem',
                            borderRadius: '4px',
                            background: 'rgba(229, 193, 88, 0.2)',
                            color: 'var(--gold)',
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          Consigliata
                        </span>
                      </div>
                      <span style={{ fontSize: '0.78rem', opacity: 0.88, lineHeight: 1.35 }}>
                        {playMode === 'solo'
                          ? '8 giochi per te: dilemmi strani, Ghigliottina, Quanto Vale?, Vero o Bufala e Cruciverba!'
                          : '12 giochi a sorpresa ogni round (inclusi Ghigliottina, Quanto Vale?, Bufale e Parola Vietata)!'}
                      </span>
                    </button>

                    <button
                      type="button"
                      className={styles.optionsToggleBtn}
                      aria-expanded={showSingleModes || selectedMode !== 'mix'}
                      onClick={() => setShowSingleModes((v) => !v)}
                    >
                      <span>🎯 Scegli singolo gioco</span>
                      <span className={styles.optionsSummary}>
                        {selectedMode !== 'mix'
                          ? `${MODE_OPTIONS.find((m) => m.id === selectedMode)?.label ?? selectedMode} ▲`
                          : showSingleModes
                            ? 'Nascondi ▲'
                            : 'Mostra ▼'}
                      </span>
                    </button>

                    {(showSingleModes || selectedMode !== 'mix') && (
                      <>
                        <div className={styles.modeGrid}>
                          {MODE_OPTIONS.filter(
                            (m) =>
                              m.id !== 'mix' &&
                              m.id !== 'percorso' &&
                              m.id !== 'storia' &&
                              (playMode === 'gruppo' || minPlayersForMode(m.id) <= 1),
                          ).map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              className={`${styles.modeBtn} ${selectedMode === m.id ? styles.modeBtnActive : ''}`}
                              onClick={() => setSelectedMode(m.id)}
                            >
                              <span className={styles.modeBtnTitle}>{m.label}</span>
                            </button>
                          ))}
                        </div>
                        {selectedMode !== 'mix' && (
                          <p className={styles.modeDescBox}>
                            {getModeDescription(selectedMode, playMode)}
                          </p>
                        )}
                        {selectedMode === 'cruciverba' && renderCruciverbaModeToggle()}
                      </>
                    )}
                  </>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                    <div className={styles.segmentGrid3}>
                      <button
                        type="button"
                        className={`${styles.segmentBtn} ${classicSub === 'classico' ? styles.segmentBtnActive : ''}`}
                        onClick={() => {
                          setClassicSub('classico');
                          setSelectedMode('classico');
                        }}
                      >
                        🎭 Dilemmi
                      </button>
                      <button
                        type="button"
                        className={`${styles.segmentBtn} ${classicSub === 'percorso' ? styles.segmentBtnActive : ''}`}
                        onClick={() => {
                          setClassicSub('percorso');
                          setSelectedMode('percorso');
                        }}
                      >
                        🧗 Percorso
                      </button>
                      <button
                        type="button"
                        className={`${styles.segmentBtn} ${classicSub === 'storia' ? styles.segmentBtnActive : ''}`}
                        onClick={() => {
                          setClassicSub('storia');
                          setSelectedMode('storia');
                        }}
                      >
                        📖 Storie
                      </button>
                    </div>

                    {classicSub === 'percorso' && (
                      <div className={styles.optionsPanel}>
                        <div className={styles.sectionLabel}>Tema del percorso</div>
                        <div className={styles.modeGrid}>
                          {PERCORSI_CATALOG.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              className={`${styles.modeBtn} ${percorsoId === p.id ? styles.modeBtnActive : ''}`}
                              onClick={() => setPercorsoId(p.id)}
                            >
                              <span className={styles.modeBtnTitle}>
                                {p.emoji} {p.nome}
                              </span>
                            </button>
                          ))}
                        </div>
                        <div className={styles.sectionLabel}>Tappa di partenza</div>
                        <div className={styles.segmentGrid2}>
                          {[1, 2, 3, 4].map((t) => (
                            <button
                              key={t}
                              type="button"
                              className={`${styles.segmentBtn} ${startTappa === t ? styles.segmentBtnActive : ''}`}
                              onClick={() => setStartTappa(t)}
                            >
                              Tappa {t}
                            </button>
                          ))}
                        </div>
                        <div className={styles.sectionLabel}>Lunghezza</div>
                        <div className={styles.segmentGrid3}>
                          {DURATE.map((d) => (
                            <button
                              key={d}
                              type="button"
                              className={`${styles.segmentBtn} ${durata === d ? styles.segmentBtnActive : ''}`}
                              onClick={() => setDurata(d)}
                            >
                              {DURATA_LABELS[d].nome}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {classicSub === 'storia' && (
                      <div className={styles.optionsPanel}>
                        <div className={styles.sectionLabel}>Scegli la storia</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          {storiesCatalog.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              className={`${styles.modeBtn} ${storyId === s.id ? styles.modeBtnActive : ''}`}
                              onClick={() => setStoryId(s.id)}
                              style={{ textAlign: 'left', flexDirection: 'column', alignItems: 'flex-start', gap: '0.2rem' }}
                            >
                              <span className={styles.modeBtnTitle}>
                                {s.emoji} {s.title} · {STORY_GENRE_LABELS[s.genre]}
                              </span>
                              <span style={{ fontSize: '0.75rem', opacity: 0.85, fontWeight: 400 }}>
                                {s.hook} ({s.scene} bivi)
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {classicSub === 'classico' && (
                      <p className={styles.modeDescBox}>
                        Dilemmi classici schietti con domanda di rilancio e riflessione finale, senza timer.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <button
                  type="button"
                  className={styles.optionsToggleBtn}
                  aria-expanded={showAdvancedSetup}
                  onClick={() => setShowAdvancedSetup((v) => !v)}
                >
                  <span>⚙️ Opzioni serata</span>
                  <span className={styles.optionsSummary}>
                    {advancedSummary} {showAdvancedSetup ? '▲' : '▼'}
                  </span>
                </button>

                {showAdvancedSetup && (
                  <div className={styles.optionsPanel} style={{ marginTop: '0.55rem' }}>
                    {selectedMode !== 'percorso' && selectedMode !== 'storia' && (
                      <div>
                        <div className={styles.sectionLabel}>Quanti round?</div>
                        <div className={styles.segmentGrid3}>
                          {ROUND_COUNTS.map((n) => (
                            <button
                              key={n}
                              type="button"
                              className={`${styles.segmentBtn} ${roundCount === n ? styles.segmentBtnActive : ''}`}
                              onClick={() => setRoundCount(n)}
                            >
                              {n} round
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {playMode === 'gruppo' && (
                      <div>
                        <div className={styles.sectionLabel}>Con chi giochi?</div>
                        <div className={styles.segmentGrid2}>
                          {FAMILIARITA_VALUES.map((fam) => (
                            <button
                              key={fam}
                              type="button"
                              className={`${styles.segmentBtn} ${familiarita === fam ? styles.segmentBtnActive : ''}`}
                              onClick={() => setFamiliarita(fam)}
                            >
                              {FAMILIARITA_LABELS[fam].nome}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedMode === 'mix' && renderCruciverbaModeToggle()}

                    {playMode === 'gruppo' && (selectedMode === 'coppie' || selectedMode === 'mix') && (
                      <div>
                        <div className={styles.sectionLabel}>Intensità Coppie</div>
                        <div className={styles.segmentGrid3}>
                          <button
                            type="button"
                            className={`${styles.segmentBtn} ${intensity === 'complicita' ? styles.segmentBtnActive : ''}`}
                            onClick={() => setIntensity('complicita')}
                          >
                            🥂 Complicità
                          </button>
                          <button
                            type="button"
                            className={`${styles.segmentBtn} ${intensity === 'piccante' ? styles.segmentBtnActive : ''}`}
                            onClick={() => setIntensity('piccante')}
                          >
                            🌶️ Piccante
                          </button>
                          <button
                            type="button"
                            className={`${styles.segmentBtn} ${intensity === 'profondo' ? styles.segmentBtnActive : ''}`}
                            onClick={() => setIntensity('profondo')}
                          >
                            🌊 Profondo
                          </button>
                        </div>
                      </div>
                    )}

                    {playMode === 'gruppo' && (selectedMode === 'infiltrato' || selectedMode === 'mix') && (
                      <div>
                        <div className={styles.sectionLabel}>Tono Infiltrato</div>
                        <div className={styles.segmentGrid3}>
                          <button
                            type="button"
                            className={`${styles.segmentBtn} ${infiltratoTono === 'risate' ? styles.segmentBtnActive : ''}`}
                            onClick={() => setInfiltratoTono('risate')}
                          >
                            😂 Risate
                          </button>
                          <button
                            type="button"
                            className={`${styles.segmentBtn} ${infiltratoTono === 'profondo' ? styles.segmentBtnActive : ''}`}
                            onClick={() => setInfiltratoTono('profondo')}
                          >
                            🌊 Profondo
                          </button>
                          <button
                            type="button"
                            className={`${styles.segmentBtn} ${infiltratoTono === 'misto' ? styles.segmentBtnActive : ''}`}
                            onClick={() => setInfiltratoTono('misto')}
                          >
                            🎲 Misto
                          </button>
                        </div>
                      </div>
                    )}

                    {selectedMode !== 'classico' && (
                      <div>
                        <label htmlFor="pass-theme-input" className={styles.sectionLabel} style={{ display: 'block' }}>
                          Tema personalizzato (opzionale)
                        </label>
                        <TextInput
                          id="pass-theme-input"
                          name="passTheme"
                          style={{ width: '100%' }}
                          value={theme}
                          onChange={(e) => setTheme(e.target.value)}
                          placeholder="Es. vacanza, coinquilini, ex..."
                          maxLength={60}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className={styles.setupCol}>
              {playMode === 'solo' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  <div>
                    <label htmlFor="pass-solo-name" className={styles.sectionLabel} style={{ display: 'block' }}>
                      2. Chi gioca? (Da solo · senza timer)
                    </label>
                    <TextInput
                      id="pass-solo-name"
                      name="soloName"
                      style={{ width: '100%' }}
                      value={soloName}
                      onChange={(e) => setSoloName(e.target.value)}
                      placeholder="Il tuo nome..."
                      maxLength={18}
                    />
                  </div>
                  <div>
                    <div className={styles.sectionLabel}>Ritmo da solo</div>
                    <div className={styles.segmentGrid2} role="group" aria-label="Ritmo da solo">
                      <button
                        type="button"
                        aria-pressed={soloFast}
                        className={`${styles.segmentBtn} ${soloFast ? styles.segmentBtnActive : ''}`}
                        onClick={() => setSoloFast(true)}
                      >
                        ⚡ Veloce (1 tocco)
                      </button>
                      <button
                        type="button"
                        aria-pressed={!soloFast}
                        className={`${styles.segmentBtn} ${!soloFast ? styles.segmentBtnActive : ''}`}
                        onClick={() => setSoloFast(false)}
                      >
                        🧭 Con riflessione
                      </button>
                    </div>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    {soloFast
                      ? 'Ritmo lampo: 1 tocco e passi subito alla domanda successiva; profilo finale alla fine.'
                      : 'Scegli con calma e confrontati con la Bussola del Mondo e l’Avvocato del Diavolo ad ogni round.'}
                  </p>
                </div>
              ) : (
                <div>
                  <label htmlFor="pass-player-input" className={styles.sectionLabel} style={{ display: 'block' }}>
                    2. Chi gioca? ({players.length}/10 · min {minPlayersForMode(selectedMode)})
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

                  {selectedMode === 'coppie' && players.length >= 2 && (
                    <div
                      style={{
                        marginTop: '0.7rem',
                        padding: '0.65rem 0.75rem',
                        borderRadius: '12px',
                        background: 'rgba(236, 72, 153, 0.1)',
                        border: '1px solid rgba(236, 72, 153, 0.35)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.4rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#fbcfe8', textTransform: 'uppercase' }}>
                          💕 Coppie di fidanzati
                        </span>
                        {players.length >= 4 && players.length % 2 === 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setSwapCoupleId(null);
                              const copy = [...players];
                              for (let i = copy.length - 1; i > 0; i--) {
                                const j = Math.floor(Math.random() * (i + 1));
                                [copy[i], copy[j]] = [copy[j], copy[i]];
                              }
                              setPlayers(copy);
                              savePlayers(copy);
                            }}
                            style={{
                              background: 'rgba(255,255,255,0.08)',
                              border: '1px solid rgba(255,255,255,0.2)',
                              color: '#fff',
                              borderRadius: '8px',
                              padding: '0.2rem 0.5rem',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            🔀 Mescola
                          </button>
                        )}
                      </div>
                      {players.length % 2 !== 0 ? (
                        <p style={{ margin: 0, fontSize: '0.78rem', color: '#fbcfe8', fontWeight: 600 }}>
                          Coppie è pensata per fidanzati: aggiungi o rimuovi 1 giocatore per formare coppie complete (2, 4, 6 o 8).
                        </p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                          {buildPassCouples(players).map((c, idx) => (
                            <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                              <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>Coppia {idx + 1}</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                {[c.memberAId, c.memberBId].map((pid) => {
                                  const pl = players.find((p) => p.id === pid);
                                  if (!pl) return null;
                                  const isSel = swapCoupleId === pid;
                                  return (
                                    <button
                                      key={pid}
                                      type="button"
                                      onClick={() => {
                                        if (!swapCoupleId) setSwapCoupleId(pid);
                                        else if (swapCoupleId === pid) setSwapCoupleId(null);
                                        else {
                                          const iA = players.findIndex((x) => x.id === swapCoupleId);
                                          const iB = players.findIndex((x) => x.id === pid);
                                          if (iA !== -1 && iB !== -1) {
                                            const copy = [...players];
                                            [copy[iA], copy[iB]] = [copy[iB], copy[iA]];
                                            setPlayers(copy);
                                            savePlayers(copy);
                                          }
                                          setSwapCoupleId(null);
                                        }
                                      }}
                                      style={{
                                        padding: '0.2rem 0.5rem',
                                        borderRadius: '8px',
                                        border: isSel ? '1.5px solid #fbbf24' : '1px solid rgba(255,255,255,0.2)',
                                        background: isSel ? 'rgba(251, 191, 36, 0.25)' : 'rgba(0,0,0,0.25)',
                                        color: '#fff',
                                        fontSize: '0.78rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                      }}
                                    >
                                      {pl.avatar} {pl.name}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {setupError && <Alert tone="danger">{setupError}</Alert>}

              <Button
                variant="primary"
                size="lg"
                disabled={
                  loadingDeck ||
                  effectivePlayers.length < minPlayersForMode(selectedMode) ||
                  (selectedMode === 'coppie' && effectivePlayers.length % 2 !== 0)
                }
                onClick={() => void handleStartGame()}
              >
                {loadingDeck ? 'Preparo le carte...' : 'Inizia la partita ▶'}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {state.phase !== 'SETUP' && (
        <div
          className={`${styles.stage} ${state.phase === 'FINAL_AWARDS' ? styles.stageTop : ''}`}
        >
          {/* PRIVACY CURTAIN (L'INFILTRATO & PAROLA VIETATA) */}
          {state.phase === 'PASS_CURTAIN' && currentPlayer && (
            <Card glow="accent" className={styles.curtain}>
              <div className={styles.curtainAvatar} aria-hidden="true">
                {currentPlayer.avatar}
              </div>
              <p className={styles.subtitle}>Passa il telefono a</p>
              <h2 className={styles.curtainName}>{currentPlayer.name}</h2>
              <p className={styles.subtitle}>
                {state.secretKind === 'intesa_speaker'
                  ? `Nessun altro deve guardare: solo ${currentPlayer.name} vedrà la parola segreta!`
                  : `Assicurati che nessun altro guardi lo schermo (${state.turnIndex + 1}/${state.players.length})`}
              </p>
              <Button
                variant="primary"
                size="lg"
                onClick={() => {
                  vibrateTick();
                  dispatch({ type: 'UNLOCK_TURN' });
                }}
              >
                {state.secretKind === 'intesa_speaker'
                  ? `Sono ${currentPlayer.name} · Vedi parola segreta 👀`
                  : `Sono ${currentPlayer.name} · Leggi domanda 👀`}
              </Button>
            </Card>
          )}

          {/* SECRET TURN (SOLO LETTURA DOMANDA INFILTRATO) */}
          {state.phase === 'SECRET_TURN' && currentPlayer && currentCard && isInfiltratoCard(currentCard) && (
            <Card className={styles.card}>
              <div className={styles.readerPill}>
                <span>{currentPlayer.avatar}</span>
                <span>Solo per {currentPlayer.name}</span>
              </div>
              <p className={styles.subtitle}>Memorizzala e non mostrarla a nessuno!</p>
              <div className={styles.secretBox}>
                {currentPlayer.id === state.infiltratoId
                  ? currentCard.impostorQuestion
                  : currentCard.groupQuestion}
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
                {nextInfiltratoPlayer
                  ? `Fatto, passa a ${nextInfiltratoPlayer.name} 🙈`
                  : 'Tutti pronti · Via al tavolo! 🗣️'}
              </Button>
            </Card>
          )}

          {/* DEBATE / LIVE TABLE PHASE */}
          {state.phase === 'DEBATE' && currentCard && (
            <Card glow="accent" className={styles.card}>
              {readerPlayer &&
                state.players.length > 1 &&
                effectivePassCardMode(state.mode, currentCard) !== 'intesa' && (
                  <div className={styles.readerPill}>
                    <span>📱 Legge {readerPlayer.avatar}</span>
                    <span>{readerPlayer.name}</span>
                  </div>
                )}

              {state.players.length === 1 && state.lastSoloToast && (
                <div
                  data-testid="solo-last-toast"
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    padding: '0.35rem 0.7rem',
                    borderRadius: '999px',
                    background: 'rgba(251, 191, 36, 0.14)',
                    border: '1px solid rgba(251, 191, 36, 0.35)',
                    color: '#fde68a',
                    textAlign: 'center',
                    alignSelf: 'center',
                  }}
                >
                  🧭 Scelta precedente: «{state.lastSoloToast.chosenLabel}» · {state.lastSoloToast.crowdPct}% come te
                </div>
              )}

              {/* ⚡ FLASH / 🎭 CLASSICO / 🧗 PERCORSO / 📖 STORIA (Scelta diretta senza lettere o pulsanti meta) */}
              {(effectivePassCardMode(state.mode, currentCard) === 'flash' ||
                effectivePassCardMode(state.mode, currentCard) === 'classico' ||
                effectivePassCardMode(state.mode, currentCard) === 'percorso' ||
                effectivePassCardMode(state.mode, currentCard) === 'storia') &&
                isFlashOrClassicoCard(currentCard) && (
                  <>
                    {(currentCard as PassFlashCard).tappaNome && (
                      <span className={styles.twistBadge}>
                        🧗 {(currentCard as PassFlashCard).tappaNome}
                      </span>
                    )}
                    {(currentCard as PassFlashCard).storyScene && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', width: '100%' }}>
                        <span className={styles.twistBadge}>
                          📖 {(currentCard as PassFlashCard).storyScene!.title} ·{' '}
                          {(currentCard as PassFlashCard).storyScene!.actTitle}
                        </span>
                        {(currentCard as PassFlashCard).storyScene!.premessa && (
                          <div className={styles.spuntiBox} style={{ textAlign: 'left' }}>
                            <strong>Prologo · {(currentCard as PassFlashCard).storyScene!.protagonist}</strong>
                            <div>{(currentCard as PassFlashCard).storyScene!.premessa}</div>
                          </div>
                        )}
                        <p className={styles.subtitle} style={{ textAlign: 'left', margin: 0 }}>
                          {(currentCard as PassFlashCard).storyScene!.sceneNarration}
                        </p>
                      </div>
                    )}
                    <h2 className={styles.promptHero}>{currentCard.text}</h2>
                    <p className={styles.liveCue}>
                      {state.players.length > 1
                        ? 'Discutete dal vivo e toccate la scelta del tavolo:'
                        : 'Scegli subito la tua posizione:'}
                    </p>
                    <div className={styles.optionsStack}>
                      <VoteOption
                        faction="a"
                        label={currentCard.optionA}
                        onClick={() => {
                          vibrateTick();
                          dispatch({ type: 'RESOLVE_FLASH', result: 'A' });
                        }}
                      />
                      <VoteOption
                        faction="b"
                        label={currentCard.optionB}
                        onClick={() => {
                          vibrateTick();
                          dispatch({ type: 'RESOLVE_FLASH', result: 'B' });
                        }}
                      />
                    </div>
                  </>
                )}

              {/* 🔀 PREFERIRESTI CHE... (Scelte dirette senza lettere) */}
              {effectivePassCardMode(state.mode, currentCard) === 'preferiresti' &&
                isPreferirestiCard(currentCard) && (
                  <>
                    <h2 className={styles.promptHero}>{currentCard.prompt}</h2>
                    {currentCard.penalty &&
                      !(state.players.length === 1 && isGroupDrinkPenalty(currentCard.penalty)) && (
                        <div className={styles.penaltyBox}>{currentCard.penalty}</div>
                      )}
                    <p className={styles.liveCue}>
                      {state.players.length > 1
                        ? 'Toccate l’alternativa che ha convinto il tavolo:'
                        : 'Scegli quale preferiresti:'}
                    </p>
                    <div className={styles.optionsStack}>
                      {currentCard.options
                        .slice(0, state.players.length === 1 ? 2 : 4)
                        .map((opt, idx) => {
                          const choice = (['A', 'B', 'C', 'D'] as const)[idx];
                          return (
                            <VoteOption
                              key={choice}
                              faction={idx % 2 === 0 ? 'a' : 'b'}
                              label={opt}
                              onClick={() => {
                                vibrateTick();
                                dispatch({ type: 'RESOLVE_PREFERIRESTI', choice });
                              }}
                            />
                          );
                        })}
                    </div>
                  </>
                )}

              {/* 🕵️ L'INFILTRATO: DIBATTITO LIBERO + 1-TAP ACCUSA */}
              {effectivePassCardMode(state.mode, currentCard) === 'infiltrato' && (
                <>
                  <h2 className={styles.promptHero}>🗣️ Tutti rispondono a voce!</h2>
                  <p className={styles.liveCue}>
                    Finito il giro, contate «3, 2, 1… punta il dito!» poi tocca chi avete accusato:
                  </p>
                  <div className={styles.playerTapGrid}>
                    {state.players.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className={styles.playerTapBtn}
                        onClick={() => {
                          vibrateTick();
                          dispatch({ type: 'RESOLVE_INFILTRATO_ACCUSATION', accusedId: p.id });
                        }}
                      >
                        <span>{p.avatar}</span>
                        <span>{p.name}</span>
                      </button>
                    ))}
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      vibrateTick();
                      dispatch({ type: 'RESOLVE_INFILTRATO_ACCUSATION', accusedId: null });
                    }}
                  >
                    🤷 Indecisi / Nessuno · Rivela l’Infiltrato
                  </Button>
                </>
              )}

              {/* 🤪 ASSURDO */}
              {effectivePassCardMode(state.mode, currentCard) === 'assurdo' &&
                isAssurdoCard(currentCard) && (
                  <>
                    <h2 className={styles.promptHero}>{currentCard.prompt}</h2>
                    {currentCard.cardType === 'gogna' ? (
                      <>
                        <p className={styles.liveCue}>
                          3, 2, 1… puntate il dito! Chi è stato scelto?
                        </p>
                        <div className={styles.playerTapGrid}>
                          {state.players.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              className={styles.playerTapBtn}
                              onClick={() => {
                                vibrateTick();
                                dispatch({ type: 'RESOLVE_GOGNA', targetId: p.id });
                              }}
                            >
                              <span>{p.avatar}</span>
                              <span>{p.name}</span>
                            </button>
                          ))}
                        </div>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            vibrateTick();
                            dispatch({ type: 'RESOLVE_GOGNA', targetId: null });
                          }}
                        >
                          🤝 Pareggio / Svela penitenza
                        </Button>
                      </>
                    ) : (
                      <>
                        <p className={styles.liveCue}>
                          {state.players.length > 1 ? 'Scegliete al tavolo:' : 'Come ti schieri?'}
                        </p>
                        <div className={styles.optionsStack}>
                          <VoteOption
                            faction="a"
                            label={currentCard.optionA ?? 'Accetto!'}
                            onClick={() => {
                              vibrateTick();
                              dispatch({ type: 'RESOLVE_DIGNITA', outcome: 'YES' });
                            }}
                          />
                          <VoteOption
                            faction="b"
                            label={currentCard.optionB ?? 'Mai nella vita'}
                            onClick={() => {
                              vibrateTick();
                              dispatch({ type: 'RESOLVE_DIGNITA', outcome: 'NO' });
                            }}
                          />
                        </div>
                      </>
                    )}
                  </>
                )}

              {/* 🔥 COPPIE (ZERO PASSAGGI & ANCHE DISPARI) */}
              {effectivePassCardMode(state.mode, currentCard) === 'coppie' &&
                isCoppieCard(currentCard) &&
                state.coppieState && (
                  <>
                    <span className={styles.roundBadge} style={{ alignSelf: 'center' }}>
                      {currentCard.cardType === 'allineamento'
                        ? '💘 Allineamento'
                        : currentCard.cardType === 'verita'
                          ? '💬 Verità'
                          : '⚡ Obbligo'}
                    </span>

                    {currentCard.cardType === 'allineamento' ? (
                      <>
                        <h2 className={styles.promptHero}>{currentCard.prompt}</h2>
                        {state.couples.length > 1 ? (
                          <>
                            <p className={styles.liveCue}>
                              3, 2, 1… indicatevi occhi negli occhi! Tocca le coppie che hanno fatto Match:
                            </p>
                            <div className={styles.playerTapGrid}>
                              {state.couples.map((c) => {
                                const isMatched = selectedCoppieMatches.includes(c.id);
                                return (
                                  <button
                                    key={c.id}
                                    type="button"
                                    className={`${styles.playerTapBtn} ${isMatched ? styles.playerTapBtnSelected : ''}`}
                                    onClick={() => {
                                      vibrateTick();
                                      setSelectedCoppieMatches((prev) =>
                                        prev.includes(c.id)
                                          ? prev.filter((id) => id !== c.id)
                                          : [...prev, c.id],
                                      );
                                    }}
                                  >
                                    <span>{isMatched ? '💘' : '💕'}</span>
                                    <span>{c.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                            <Button
                              variant="primary"
                              size="lg"
                              onClick={() => {
                                vibrateTick();
                                dispatch({
                                  type: 'RESOLVE_COPPIE_ALIGN',
                                  matchedCoupleIds: selectedCoppieMatches,
                                });
                              }}
                            >
                              {selectedCoppieMatches.length > 0
                                ? `Conferma ${selectedCoppieMatches.length} Match ▶`
                                : 'Nessun match · Continua ▶'}
                            </Button>
                          </>
                        ) : (
                          <>
                            {(() => {
                              const singleCouple = state.couples[0];
                              const pairId = singleCouple?.id ?? 'dynamic_pair';
                              const [idA, idB] = state.coppieState.featuredPairIds;
                              const pairLabel =
                                singleCouple?.label ?? `${playerName(idA)} ❤️ ${playerName(idB)}`;
                              return (
                                <>
                                  <p className={styles.liveCue}>
                                    💕 {pairLabel}: 3, 2, 1… indicatevi!
                                  </p>
                                  <div className={styles.verdictGrid2}>
                                    <Button
                                      variant="primary"
                                      onClick={() => {
                                        vibrateTick();
                                        dispatch({
                                          type: 'RESOLVE_COPPIE_ALIGN',
                                          matchedCoupleIds: [pairId],
                                        });
                                      }}
                                    >
                                      💘 Match!
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      onClick={() => {
                                        vibrateTick();
                                        dispatch({
                                          type: 'RESOLVE_COPPIE_ALIGN',
                                          matchedCoupleIds: [],
                                        });
                                      }}
                                    >
                                      ⚡ Scoppiati!
                                    </Button>
                                  </div>
                                </>
                              );
                            })()}
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        <p className={styles.liveCue}>
                          💕 Tocca a {playerAvatar(state.coppieState.featuredPairIds[0])}{' '}
                          {playerName(state.coppieState.featuredPairIds[0])} &{' '}
                          {playerAvatar(state.coppieState.featuredPairIds[1])}{' '}
                          {playerName(state.coppieState.featuredPairIds[1])}
                        </p>
                        <h2 className={styles.promptHero}>{currentCard.prompt}</h2>
                        {currentCard.penalty && (
                          <div className={styles.penaltyBox}>{currentCard.penalty}</div>
                        )}
                        <div className={styles.verdictGrid2}>
                          <Button
                            variant="primary"
                            onClick={() => {
                              vibrateTick();
                              dispatch({ type: 'RESOLVE_COPPIE_CHALLENGE', completed: true });
                            }}
                          >
                            ✅ Fatta!
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => {
                              vibrateTick();
                              dispatch({ type: 'RESOLVE_COPPIE_CHALLENGE', completed: false });
                            }}
                          >
                            🍺 Penitenza / Passo
                          </Button>
                        </div>
                      </>
                    )}
                  </>
                )}

              {/* 🧩 CRUCIVERBA SHOW: QUIZMASTER VOCALE (30s, ZERO TASTIERA) */}
              {effectivePassCardMode(state.mode, currentCard) === 'cruciverba' &&
                state.cruciverbaState &&
                (() => {
                  const cs = state.cruciverbaState;
                  const targetWord =
                    cs.board.words.find(
                      (w) => w.id === cs.activeWordId && cs.wordStatus[w.id] === 'pending',
                    ) ??
                    cs.board.words.find((w) => cs.wordStatus[w.id] === 'pending') ??
                    cs.board.words[0];
                  const revealedSet = new Set(cs.revealedCells);
                  const slots = targetWord
                    ? Array.from({ length: targetWord.word.length }, (_, i) => {
                        const r = targetWord.direction === 'V' ? targetWord.row + i : targetWord.row;
                        const c = targetWord.direction === 'H' ? targetWord.col + i : targetWord.col;
                        return revealedSet.has(`${r},${c}`) ? targetWord.word[i] : '';
                      })
                    : [];
                  return (
                    <>
                      <div className={styles.timerBox}>
                        <span>🧩 {cs.board.theme}</span>
                      </div>

                      <CruciverbaGrid
                        state={toCruciverbaGridState(cs)}
                        selectedWordId={targetWord?.id}
                        onSelectWord={(wId) => dispatch({ type: 'CRUCIVERBA_SELECT_WORD', wordId: wId })}
                        size="sm"
                      />

                      <div className={styles.wordPillsRow}>
                        {cs.board.words.map((w) => {
                          const st = cs.wordStatus[w.id];
                          const isActive = targetWord?.id === w.id;
                          return (
                            <button
                              key={w.id}
                              type="button"
                              disabled={st !== 'pending'}
                              className={`${styles.wordPill} ${
                                st !== 'pending'
                                  ? styles.wordPillSolved
                                  : isActive
                                    ? styles.wordPillActive
                                    : ''
                              }`}
                              onClick={() => dispatch({ type: 'CRUCIVERBA_SELECT_WORD', wordId: w.id })}
                            >
                              {w.number}
                              {w.direction === 'H' ? '→' : '↓'}{' '}
                              {st === 'solved' ? '✓' : st === 'revealed' ? '👁' : `${w.word.length}`}
                            </button>
                          );
                        })}
                      </div>

                      {targetWord && (
                        <>
                          {cs.mode === 'scelte' ? (
                            <p className={styles.liveCue}>
                              🎯 Scegli la parola giusta ({targetWord.number}
                              {targetWord.direction === 'H' ? '→' : '↓'} · {targetWord.word.length} lettere):
                            </p>
                          ) : (
                            <>
                              <p className={styles.liveCue}>
                                {state.players.length === 1
                                  ? `Leggi l’indizio e trova la parola (${targetWord.word.length} lettere):`
                                  : `Leggi l’indizio al tavolo (${targetWord.word.length} lettere):`}
                              </p>
                              <h2 className={styles.promptHero}>{targetWord.clue}</h2>
                            </>
                          )}
                          <div className={styles.letterSlotsRow} aria-label="Lettere sbloccate">
                            {slots.map((ch, idx) => (
                              <span
                                key={`${targetWord.id}-${idx}`}
                                className={`${styles.letterTile} ${ch ? styles.letterTileFilled : ''}`}
                              >
                                {ch || '·'}
                              </span>
                            ))}
                          </div>
                        </>
                      )}

                      {cs.lastFeedback && <Alert>{cs.lastFeedback}</Alert>}

                      {cs.mode === 'scelte' && targetWord ? (
                        <>
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                              gap: '0.5rem',
                              width: '100%',
                            }}
                            role="group"
                            aria-label="Scelte parola cruciverba"
                          >
                            {(
                              cs.wordChoices[targetWord.id] ??
                              targetWord.choices ??
                              [targetWord.word]
                            ).map((choice) => {
                              const wrongSet = new Set(cs.wrongChoices[targetWord.id] ?? []);
                              const isWrong = wrongSet.has(choice.toUpperCase());
                              return (
                                <button
                                  key={choice}
                                  type="button"
                                  disabled={isWrong || cs.wordStatus[targetWord.id] !== 'pending'}
                                  className={styles.segmentBtn}
                                  style={
                                    isWrong
                                      ? {
                                          opacity: 0.48,
                                          borderColor: 'rgba(244, 63, 94, 0.55)',
                                          background: 'rgba(244, 63, 94, 0.14)',
                                          textDecoration: 'line-through',
                                          cursor: 'not-allowed',
                                        }
                                      : undefined
                                  }
                                  onClick={() => {
                                    vibrateTick();
                                    dispatch({
                                      type: 'CRUCIVERBA_GUESS_CHOICE',
                                      wordId: targetWord.id,
                                      choice,
                                      solverId:
                                        state.players.length === 1 ? state.players[0].id : null,
                                    });
                                  }}
                                >
                                  {choice}
                                </button>
                              );
                            })}
                          </div>
                          <div className={styles.verdictGrid2}>
                            <Button
                              variant="ghost"
                              onClick={() => {
                                vibrateTick();
                                dispatch({ type: 'CRUCIVERBA_PASS', reason: 'hint' });
                              }}
                            >
                              💡 1 lettera
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() => dispatch({ type: 'CRUCIVERBA_END_NOW' })}
                            >
                              Svela tutto
                            </Button>
                          </div>
                        </>
                      ) : !pickingCruciverbaSolver ? (
                        <>
                          <Button
                            variant="primary"
                            size="lg"
                            disabled={!targetWord || cs.wordStatus[targetWord.id] !== 'pending'}
                            onClick={() => {
                              vibrateTick();
                              if (state.players.length === 1 && targetWord) {
                                dispatch({
                                  type: 'CRUCIVERBA_SOLVE_WORD',
                                  wordId: targetWord.id,
                                  solverId: state.players[0].id,
                                });
                              } else {
                                setPickingCruciverbaSolver(true);
                              }
                            }}
                          >
                            {state.players.length === 1
                              ? '✓ L’ho indovinata!'
                              : '✓ Indovinata dal tavolo!'}
                          </Button>
                          <div className={styles.verdictGrid2}>
                            <Button
                              variant="ghost"
                              onClick={() => {
                                vibrateTick();
                                dispatch({ type: 'CRUCIVERBA_PASS', reason: 'hint' });
                              }}
                            >
                              💡 1 lettera
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() => dispatch({ type: 'CRUCIVERBA_END_NOW' })}
                            >
                              Svela tutto
                            </Button>
                          </div>
                        </>
                      ) : (
                        targetWord && (
                          <>
                            <p className={styles.liveCue}>Chi l’ha detta per primo?</p>
                            <div className={styles.playerTapGrid}>
                              {state.players.map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  className={styles.playerTapBtn}
                                  onClick={() => {
                                    vibrateTick();
                                    dispatch({
                                      type: 'CRUCIVERBA_SOLVE_WORD',
                                      wordId: targetWord.id,
                                      solverId: p.id,
                                    });
                                    setPickingCruciverbaSolver(false);
                                  }}
                                >
                                  <span>{p.avatar}</span>
                                  <span>{p.name}</span>
                                </button>
                              ))}
                            </div>
                            <div className={styles.verdictGrid2}>
                              <Button
                                variant="primary"
                                onClick={() => {
                                  vibrateTick();
                                  dispatch({
                                    type: 'CRUCIVERBA_SOLVE_WORD',
                                    wordId: targetWord.id,
                                    solverId: null,
                                  });
                                  setPickingCruciverbaSolver(false);
                                }}
                              >
                                🙌 In coro (Tavolo)
                              </Button>
                              <Button
                                variant="ghost"
                                onClick={() => setPickingCruciverbaSolver(false)}
                              >
                                Annulla
                              </Button>
                            </div>
                          </>
                        )
                      )}
                    </>
                  );
                })()}

              {/* ⚖️ TRIBUNALE: 20s ARRINGHE + VOTO GIURIA 1-TAP */}
              {effectivePassCardMode(state.mode, currentCard) === 'tribunale' &&
                state.tribunaleState &&
                (() => {
                  const ts = state.tribunaleState;
                  const accName = playerName(ts.accusaId);
                  const difName = playerName(ts.difesaId);
                  const activeSpeakerName = ts.speakerIndex === 0 ? accName : difName;
                  return (
                    <>
                      <h2 className={styles.promptHero}>⚖️ {ts.caseData.title}</h2>
                      <p className={styles.subtitle}>{ts.caseData.scenario}</p>
                      <div className={styles.abPair}>
                        <div
                          className={styles.abCardA}
                          style={{
                            borderColor:
                              !ts.verdictReady && ts.speakerIndex === 0 ? '#fbbf24' : undefined,
                          }}
                        >
                          <div style={{ fontSize: '0.75rem', opacity: 0.85, marginBottom: '0.2rem' }}>
                            ⚔️ {playerAvatar(ts.accusaId)} {accName}
                          </div>
                          {ts.caseData.accusaRole}
                        </div>
                        <div
                          className={styles.abCardB}
                          style={{
                            borderColor:
                              !ts.verdictReady && ts.speakerIndex === 1 ? '#fbbf24' : undefined,
                          }}
                        >
                          <div style={{ fontSize: '0.75rem', opacity: 0.85, marginBottom: '0.2rem' }}>
                            🛡️ {playerAvatar(ts.difesaId)} {difName}
                          </div>
                          {ts.caseData.difesaRole}
                        </div>
                      </div>

                      {!ts.verdictReady ? (
                        <>
                          <div className={styles.timerBox}>
                            <span>🎙️ Arringa di {activeSpeakerName}</span>
                          </div>
                          <Button
                            variant="primary"
                            size="lg"
                            onClick={() => {
                              vibrateTick();
                              dispatch({ type: 'TRIBUNALE_NEXT_SPEAKER' });
                            }}
                          >
                            {ts.speakerIndex === 0
                              ? `Passa a ${difName} ▶`
                              : 'Giuria: al voto! ⚖️'}
                          </Button>
                        </>
                      ) : (
                        <>
                          <p className={styles.liveCue}>
                            Giuria: alzate la mano per chi ha convinto di più!
                          </p>
                          <div className={styles.verdictGrid2}>
                            <Button
                              variant="primary"
                              onClick={() => {
                                vibrateTick();
                                dispatch({ type: 'TRIBUNALE_RESOLVE', winner: 'ACCUSA' });
                              }}
                            >
                              ⚔️ Vince {accName}
                            </Button>
                            <Button
                              variant="primary"
                              onClick={() => {
                                vibrateTick();
                                dispatch({ type: 'TRIBUNALE_RESOLVE', winner: 'DIFESA' });
                              }}
                            >
                              🛡️ Vince {difName}
                            </Button>
                          </div>
                          <Button
                            variant="ghost"
                            onClick={() => {
                              vibrateTick();
                              dispatch({ type: 'TRIBUNALE_RESOLVE', winner: 'TIE' });
                            }}
                          >
                            🤝 Patteggiamento (Pari)
                          </Button>
                        </>
                      )}
                    </>
                  );
                })()}

              {/* 🔗 LA GHIGLIOTTINA */}
              {effectivePassCardMode(state.mode, currentCard) === 'ghigliottina' &&
                isGhigliottinaCard(currentCard) && (
                  <>
                    <span className={styles.twistBadge}>🔗 LA GHIGLIOTTINA</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '100%' }}>
                      {currentCard.clues.map((clue) => (
                        <div
                          key={clue}
                          style={{
                            padding: '0.55rem 0.9rem',
                            borderRadius: '10px',
                            background: 'rgba(15, 23, 42, 0.72)',
                            border: '1px solid rgba(251, 191, 36, 0.35)',
                            fontSize: '1.1rem',
                            fontWeight: 900,
                            letterSpacing: '0.06em',
                            textAlign: 'center',
                            color: '#fde68a',
                          }}
                        >
                          {clue}
                        </div>
                      ))}
                    </div>

                    {state.players.length === 1 ? (
                      <>
                        <p className={styles.liveCue}>
                          Quale parola lega tutti e 5 gli indizi? Scegli tra 4 o scrivila:
                        </p>
                        <div className={styles.verdictGrid2}>
                          {(state.ghigliottinaState?.shuffledChoices ?? currentCard.choices).map((choice) => (
                            <Button
                              key={choice}
                              variant="ghost"
                              onClick={() => {
                                vibrateTick();
                                dispatch({ type: 'RESOLVE_GHIGLIOTTINA', guess: choice });
                              }}
                            >
                              {choice}
                            </Button>
                          ))}
                        </div>
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (!ghigliottinaInput.trim()) return;
                            vibrateTick();
                            dispatch({ type: 'RESOLVE_GHIGLIOTTINA', guess: ghigliottinaInput });
                          }}
                          style={{ display: 'flex', gap: '0.5rem', width: '100%' }}
                        >
                          <TextInput
                            id="pass-ghigliottina-input"
                            name="ghigliottinaGuess"
                            value={ghigliottinaInput}
                            onChange={(e) => setGhigliottinaInput(e.target.value)}
                            placeholder="Oppure scrivi la parola..."
                            style={{ width: '100%' }}
                          />
                          <Button type="submit" variant="primary" disabled={!ghigliottinaInput.trim()}>
                            Invia
                          </Button>
                        </form>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          onClick={() => setGhigliottinaShowChoices((v) => !v)}
                        >
                          {ghigliottinaShowChoices ? 'Nascondi le 4 opzioni ▲' : 'Mostra le 4 opzioni aiuto ▼'}
                        </Button>
                        {ghigliottinaShowChoices && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', justifyContent: 'center' }}>
                            {(state.ghigliottinaState?.shuffledChoices ?? currentCard.choices).map((c) => (
                              <span
                                key={c}
                                style={{
                                  padding: '0.35rem 0.75rem',
                                  borderRadius: '999px',
                                  background: 'rgba(255,255,255,0.08)',
                                  border: '1px solid rgba(255,255,255,0.2)',
                                  fontWeight: 800,
                                  fontSize: '0.88rem',
                                }}
                              >
                                {c}
                              </span>
                            ))}
                          </div>
                        )}
                        <p className={styles.liveCue}>Chi ha indovinato al volo la parola?</p>
                        <div className={styles.verdictGrid2}>
                          {state.players.map((p) => (
                            <Button
                              key={p.id}
                              variant="primary"
                              onClick={() => {
                                vibrateTick();
                                dispatch({ type: 'RESOLVE_GHIGLIOTTINA', winnerId: p.id });
                              }}
                            >
                              {p.avatar} {p.name}
                            </Button>
                          ))}
                        </div>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            vibrateTick();
                            dispatch({ type: 'RESOLVE_GHIGLIOTTINA', winnerId: null });
                          }}
                        >
                          👀 Svela parola (nessuno)
                        </Button>
                      </>
                    )}
                  </>
                )}

              {/* 💰 QUANTO VALE? (STIMA) */}
              {effectivePassCardMode(state.mode, currentCard) === 'stima' &&
                isStimaCard(currentCard) && (
                  <>
                    <span className={styles.twistBadge}>💰 QUANTO VALE?</span>
                    <h2 className={styles.promptHero}>{currentCard.prompt}</h2>
                    {state.players.length === 1 ? (
                      <>
                        <div
                          style={{
                            fontSize: '2.1rem',
                            fontWeight: 900,
                            color: '#fbbf24',
                            textAlign: 'center',
                          }}
                        >
                          {stimaValue}{' '}
                          <span style={{ fontSize: '1rem', opacity: 0.8 }}>{currentCard.unit}</span>
                        </div>
                        <input
                          type="range"
                          aria-label="La tua stima"
                          min={currentCard.min}
                          max={currentCard.max}
                          step={currentCard.step}
                          value={stimaValue}
                          onChange={(e) => setStimaValue(Number(e.target.value))}
                          style={{ width: '100%', accentColor: '#fbbf24' }}
                        />
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            width: '100%',
                            fontSize: '0.78rem',
                            color: 'var(--text-muted)',
                          }}
                        >
                          <span>
                            {currentCard.min} {currentCard.unit}
                          </span>
                          <span>
                            {currentCard.max} {currentCard.unit}
                          </span>
                        </div>
                        <Button
                          variant="primary"
                          size="lg"
                          onClick={() => {
                            vibrateTick();
                            dispatch({ type: 'RESOLVE_STIMA', soloGuess: stimaValue });
                          }}
                        >
                          Conferma stima 🎯
                        </Button>
                      </>
                    ) : !stimaGroupRevealed ? (
                      <>
                        <p className={styles.liveCue}>
                          Scala {currentCard.min}–{currentCard.max} {currentCard.unit}. Ognuno dica la propria stima ad alta voce!
                        </p>
                        <Button
                          variant="primary"
                          size="lg"
                          onClick={() => {
                            vibrateTick();
                            setStimaGroupRevealed(true);
                          }}
                        >
                          👀 Svela risposta esatta
                        </Button>
                      </>
                    ) : (
                      <>
                        <div
                          style={{
                            fontSize: '2.2rem',
                            fontWeight: 900,
                            color: '#34d399',
                            textAlign: 'center',
                          }}
                        >
                          {currentCard.answer} {currentCard.unit}
                        </div>
                        <p className={styles.subtitle}>{currentCard.funFact}</p>
                        <p className={styles.liveCue}>Chi ci è andato più vicino?</p>
                        <div className={styles.verdictGrid2}>
                          {state.players.map((p) => (
                            <Button
                              key={p.id}
                              variant="primary"
                              onClick={() => {
                                vibrateTick();
                                dispatch({ type: 'RESOLVE_STIMA', winnerId: p.id });
                              }}
                            >
                              🏆 {p.name}
                            </Button>
                          ))}
                        </div>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            vibrateTick();
                            dispatch({ type: 'RESOLVE_STIMA', winnerId: null });
                          }}
                        >
                          Nessuno vicino
                        </Button>
                      </>
                    )}
                  </>
                )}

              {/* 🎭 VERO O BUFALA? */}
              {effectivePassCardMode(state.mode, currentCard) === 'bufala' &&
                isBufalaCard(currentCard) && (
                  <>
                    <span className={styles.twistBadge}>
                      🎭 VERO O BUFALA? · {currentCard.category}
                    </span>
                    <h2 className={styles.promptHero}>{currentCard.statement}</h2>
                    <p className={styles.liveCue}>
                      {state.players.length === 1
                        ? 'Fatto incredibile o leggenda metropolitana?'
                        : 'Che verdetto dà il tavolo a maggioranza?'}
                    </p>
                    <div className={styles.verdictGrid2}>
                      <Button
                        variant="primary"
                        size="lg"
                        onClick={() => {
                          vibrateTick();
                          dispatch({ type: 'RESOLVE_BUFALA', guessIsTrue: true });
                        }}
                      >
                        ✅ È VERO!
                      </Button>
                      <Button
                        variant="primary"
                        size="lg"
                        onClick={() => {
                          vibrateTick();
                          dispatch({ type: 'RESOLVE_BUFALA', guessIsTrue: false });
                        }}
                      >
                        🤡 È UNA BUFALA!
                      </Button>
                    </div>
                    {state.players.length > 1 && (
                      <Button
                        variant="ghost"
                        onClick={() => {
                          vibrateTick();
                          dispatch({ type: 'RESOLVE_BUFALA', guessIsTrue: null });
                        }}
                      >
                        ⚖️ Tavolo diviso
                      </Button>
                    )}
                  </>
                )}

              {/* 🚫 PAROLA VIETATA (INTESA / TABOO) */}
              {effectivePassCardMode(state.mode, currentCard) === 'intesa' &&
                isIntesaCard(currentCard) &&
                (() => {
                  const speakerId = state.intesaState?.speakerId ?? state.players[0]?.id ?? '';
                  const speaker = state.players.find((p) => p.id === speakerId);
                  const guessers = state.players.filter((p) => p.id !== speakerId);
                  return (
                    <>
                      <span className={styles.twistBadge}>
                        🚫 PAROLA VIETATA · {currentCard.category}
                      </span>
                      <div className={styles.readerPill}>
                        <span>🎙️ Descrive {speaker?.avatar}</span>
                        <span>{speaker?.name ?? 'Giocatore'}</span>
                      </div>
                      <div
                        style={{
                          padding: '1rem 1.2rem',
                          borderRadius: '14px',
                          background: 'rgba(15, 23, 42, 0.8)',
                          border: '2px solid rgba(251, 191, 36, 0.5)',
                          textAlign: 'center',
                          width: '100%',
                        }}
                      >
                        <div style={{ fontSize: '0.75rem', opacity: 0.7, textTransform: 'uppercase' }}>
                          Parola da far indovinare
                        </div>
                        <div
                          style={{
                            fontSize: '2rem',
                            fontWeight: 900,
                            color: '#fbbf24',
                            letterSpacing: '0.04em',
                            marginTop: '0.2rem',
                          }}
                        >
                          {currentCard.word}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', justifyContent: 'center' }}>
                        {currentCard.forbidden.map((fw) => (
                          <span
                            key={fw}
                            style={{
                              padding: '0.35rem 0.7rem',
                              borderRadius: '999px',
                              background: 'rgba(244, 63, 94, 0.2)',
                              border: '1px solid rgba(244, 63, 94, 0.45)',
                              color: '#fda4af',
                              fontWeight: 800,
                              fontSize: '0.88rem',
                            }}
                          >
                            🚫 {fw}
                          </span>
                        ))}
                      </div>
                      <p className={styles.liveCue}>
                        Descrivi a voce senza dire le parole vietate! Chi l’ha indovinata?
                      </p>
                      <div className={styles.verdictGrid2}>
                        {guessers.map((g) => (
                          <Button
                            key={g.id}
                            variant="primary"
                            onClick={() => {
                              vibrateTick();
                              dispatch({
                                type: 'RESOLVE_INTESA',
                                outcome: 'guessed',
                                winnerId: g.id,
                              });
                            }}
                          >
                            🎉 {g.name}
                          </Button>
                        ))}
                      </div>
                      <div className={styles.verdictGrid2}>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            vibrateTick();
                            dispatch({ type: 'RESOLVE_INTESA', outcome: 'taboo' });
                          }}
                        >
                          🚨 Parola vietata!
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            vibrateTick();
                            dispatch({ type: 'RESOLVE_INTESA', outcome: 'skipped' });
                          }}
                        >
                          ⏭️ Passa
                        </Button>
                      </div>
                    </>
                  );
                })()}
            </Card>
          )}

          {/* ROUND RESULT (RIVELAZIONE / CONFRONTO SOLO / PENITENZA GRUPPO) */}
          {state.phase === 'ROUND_RESULT' && state.roundOutcome && currentCard && (
            <Card glow="accent" className={styles.card}>
              {(state.roundOutcome.kind === 'split' || state.roundOutcome.kind === 'swing') && (
                <>
                  <h2 className={styles.promptHero}>
                    {state.roundOutcome.liveVerdictLabel ?? 'Scelta fatta'}
                  </h2>

                  {state.players.length === 1 && state.roundOutcome.soloMode && (
                    <div
                      data-testid="solo-crowd-compass"
                      style={{
                        width: '100%',
                        padding: '0.8rem 0.9rem',
                        borderRadius: '14px',
                        background: 'rgba(15, 23, 42, 0.55)',
                        border: '1px solid rgba(251, 191, 36, 0.35)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.55rem',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          🧭 Tu vs La Bussola del Mondo
                        </span>
                        {typeof state.roundOutcome.crowdPctForChoice === 'number' && (
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              padding: '0.18rem 0.5rem',
                              borderRadius: '999px',
                              background:
                                state.roundOutcome.crowdPctForChoice >= 55
                                  ? 'rgba(16, 185, 129, 0.22)'
                                  : state.roundOutcome.crowdPctForChoice <= 45
                                    ? 'rgba(245, 158, 11, 0.25)'
                                    : 'rgba(56, 189, 248, 0.2)',
                              color:
                                state.roundOutcome.crowdPctForChoice >= 55
                                  ? '#6ee7b7'
                                  : state.roundOutcome.crowdPctForChoice <= 45
                                    ? '#fcd34d'
                                    : '#7dd3fc',
                            }}
                          >
                            {state.roundOutcome.soloFlipped
                              ? `🦋 Prospettiva ribaltata · ${state.roundOutcome.crowdPctForChoice}%`
                              : state.roundOutcome.crowdPctForChoice >= 55
                                ? `🎯 In Sintonia · ${state.roundOutcome.crowdPctForChoice}%`
                                : state.roundOutcome.crowdPctForChoice <= 45
                                  ? `⚡ Controcorrente · ${state.roundOutcome.crowdPctForChoice}%`
                                  : `⚖️ Sul Filo · ${state.roundOutcome.crowdPctForChoice}%`}
                          </span>
                        )}
                      </div>

                      {isPreferirestiCard(currentCard) && state.roundOutcome.crowdSplitPcts ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          {currentCard.options
                            .slice(0, state.players.length === 1 ? 2 : 4)
                            .map((opt, idx) => {
                            const pct = state.roundOutcome?.crowdSplitPcts?.[idx] ?? 25;
                            const isMine = state.roundOutcome?.chosenOptionIndex === idx;
                            return (
                              <div key={opt} style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: isMine ? 800 : 500 }}>
                                  <span>
                                    {isMine ? '👈 ' : ''}
                                    {opt}
                                  </span>
                                  <span>{pct}%</span>
                                </div>
                                <div style={{ height: '7px', borderRadius: '999px', background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                                  <div
                                    style={{
                                      width: `${pct}%`,
                                      height: '100%',
                                      background: isMine ? '#fbbf24' : 'rgba(148, 163, 184, 0.55)',
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <>
                          <div style={{ fontSize: '0.86rem', opacity: 0.92 }}>
                            Il <strong>{state.roundOutcome.crowdPctForChoice ?? state.roundOutcome.countA}%</strong> dei giocatori ha scelto la tua stessa posizione.
                          </div>
                          {isFlashOrClassicoCard(currentCard) && state.roundOutcome.crowdSplitPcts && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                              <div style={{ height: '9px', borderRadius: '999px', overflow: 'hidden', display: 'flex', background: 'rgba(255,255,255,0.1)' }}>
                                <div
                                  style={{
                                    width: `${state.roundOutcome.crowdSplitPcts[0]}%`,
                                    background: state.roundOutcome.chosenSide === 'A' ? '#fbbf24' : '#38bdf8',
                                  }}
                                />
                                <div
                                  style={{
                                    width: `${state.roundOutcome.crowdSplitPcts[1]}%`,
                                    background: state.roundOutcome.chosenSide === 'B' ? '#fbbf24' : '#fb7185',
                                  }}
                                />
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', opacity: 0.8, gap: '0.5rem' }}>
                                <span>
                                  {state.roundOutcome.chosenSide === 'A' ? '👈 ' : ''}
                                  {currentCard.optionA}: {state.roundOutcome.crowdSplitPcts[0]}%
                                </span>
                                <span style={{ textAlign: 'right' }}>
                                  {state.roundOutcome.chosenSide === 'B' ? '👈 ' : ''}
                                  {currentCard.optionB}: {state.roundOutcome.crowdSplitPcts[1]}%
                                </span>
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {state.roundOutcome.counterArgument && (
                        <div
                          data-testid="solo-devils-advocate"
                          style={{
                            marginTop: '0.2rem',
                            padding: '0.55rem 0.65rem',
                            borderRadius: '10px',
                            background: 'rgba(244, 63, 94, 0.12)',
                            border: '1px solid rgba(244, 63, 94, 0.3)',
                            fontSize: '0.84rem',
                            lineHeight: 1.4,
                          }}
                        >
                          <strong style={{ display: 'block', marginBottom: '0.15rem', color: '#fda4af' }}>
                            😈 L’Avvocato del Diavolo
                          </strong>
                          <span>{state.roundOutcome.counterArgument}</span>
                        </div>
                      )}

                      {state.roundOutcome.chosenSide && !state.roundOutcome.soloFlipped && (
                        <Button
                          variant="ghost"
                          onClick={() => {
                            vibrateTick();
                            dispatch({ type: 'SOLO_FLIP_AFTER_OBJECTION' });
                          }}
                        >
                          🔄 Questa obiezione mi ha convinto: cambio scelta
                        </Button>
                      )}
                    </div>
                  )}

                  {isFlashOrClassicoCard(currentCard) && currentCard.storyScene && (
                    <>
                      <div className={styles.spuntiBox} style={{ textAlign: 'left' }}>
                        <strong>Conseguenza</strong>
                        <div>
                          {state.roundOutcome.chosenSide === 'B'
                            ? currentCard.storyScene.consequenceB
                            : currentCard.storyScene.consequenceA}
                        </div>
                      </div>
                      {currentCard.storyScene.epiloghi &&
                        currentCard.storyScene.epiloghi.length > 0 && (() => {
                          const choicesA = state.storyChoicesA ?? 0;
                          const epi =
                            currentCard.storyScene!.epiloghi!.find(
                              (e) => choicesA >= e.minA && choicesA <= e.maxA,
                            ) ??
                            currentCard.storyScene!.epiloghi![
                              currentCard.storyScene!.epiloghi!.length - 1
                            ];
                          return (
                            <div className={styles.penaltyBox}>
                              <strong>📖 Epilogo della storia</strong>
                              <div>{epi.text}</div>
                            </div>
                          );
                        })()}
                    </>
                  )}
                  {isFlashOrClassicoCard(currentCard) && currentCard.domandaRilancio && (
                    <div className={styles.spuntiBox} style={{ textAlign: 'left' }}>
                      <strong>💬 Rilancio</strong>
                      <div>{currentCard.domandaRilancio}</div>
                    </div>
                  )}
                  {isFlashOrClassicoCard(currentCard) && currentCard.lezioneReale && (
                    <div className={styles.spuntiBox} style={{ textAlign: 'left' }}>
                      <strong>🧭 Spunto di riflessione</strong>
                      <div>{currentCard.lezioneReale}</div>
                    </div>
                  )}
                  {'penalty' in currentCard &&
                    currentCard.penalty &&
                    !(state.players.length === 1 && isGroupDrinkPenalty(currentCard.penalty)) && (
                      <div className={styles.penaltyBox}>{currentCard.penalty}</div>
                    )}
                </>
              )}

              {state.roundOutcome.kind === 'gogna' && (
                <>
                  <h2 className={styles.promptHero}>
                    {(state.roundOutcome.gognaWinnerIds?.length ?? 0) > 0
                      ? `🎯 Alla Gogna: ${(state.roundOutcome.gognaWinnerIds ?? []).map(playerName).join(' & ')}!`
                      : '🤝 Pareggio al tavolo!'}
                  </h2>
                  {(currentCard as PassAssurdoCard).penalty && (
                    <div className={styles.penaltyBox}>
                      {(currentCard as PassAssurdoCard).penalty}
                    </div>
                  )}
                </>
              )}

              {state.roundOutcome.kind === 'dignita' && (
                <>
                  <h2 className={styles.promptHero}>
                    {state.roundOutcome.liveVerdictLabel ?? 'Verdetto'}
                  </h2>
                  {state.players.length === 1 && state.roundOutcome.soloMode && (
                    <div
                      data-testid="solo-crowd-compass"
                      style={{
                        width: '100%',
                        padding: '0.8rem 0.9rem',
                        borderRadius: '14px',
                        background: 'rgba(15, 23, 42, 0.55)',
                        border: '1px solid rgba(251, 191, 36, 0.35)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.45rem',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#fbbf24', textTransform: 'uppercase' }}>
                        🧭 Tu vs La Bussola del Mondo · {state.roundOutcome.crowdPctForChoice ?? 50}% con te
                      </span>
                      {state.roundOutcome.counterArgument && (
                        <div style={{ fontSize: '0.84rem', color: '#fda4af' }}>
                          <strong>😈 L’Avvocato del Diavolo:</strong> {state.roundOutcome.counterArgument}
                        </div>
                      )}
                    </div>
                  )}
                  {(currentCard as PassAssurdoCard).sentenza &&
                    !(
                      state.players.length === 1 &&
                      isGroupDrinkPenalty((currentCard as PassAssurdoCard).sentenza)
                    ) && (
                      <div className={styles.penaltyBox}>
                        {(currentCard as PassAssurdoCard).sentenza}
                      </div>
                    )}
                </>
              )}

              {state.roundOutcome.kind === 'infiltrato' && (
                <>
                  <h2 className={styles.promptHero}>
                    {state.roundOutcome.infiltratoCaught
                      ? '🔍 Infiltrato smascherato!'
                      : '🕵️ L’Infiltrato l’ha fatta franca!'}
                  </h2>
                  <p className={styles.subtitle}>
                    L’Infiltrato era:{' '}
                    <strong>
                      {state.roundOutcome.infiltratoId
                        ? `${playerAvatar(state.roundOutcome.infiltratoId)} ${playerName(state.roundOutcome.infiltratoId)}`
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
                  <h2 className={styles.promptHero}>
                    {state.roundOutcome.coppieMatched
                      ? '💘 Sintonia perfetta!'
                      : '⚡ Scintille!'}
                  </h2>
                  {state.roundOutcome.coupleOutcomes && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                      {state.roundOutcome.coupleOutcomes.map((co) => (
                        <div
                          key={co.coupleId}
                          className={styles.spuntiBox}
                          style={{ borderColor: co.matched ? '#34d399' : undefined }}
                        >
                          <strong>
                            {co.memberAName} ❤️ {co.memberBName}
                          </strong>
                          : {co.matched ? '💞 Match! (+100 pt)' : '💥 Scoppiati!'}
                        </div>
                      ))}
                    </div>
                  )}
                  {state.couples.length > 1 && (
                    <div className={styles.penaltyBox}>
                      {[...state.couples]
                        .sort((a, b) => b.score - a.score)
                        .map((c, idx) => (
                          <div key={c.id}>
                            {idx === 0 ? '🥇' : '💕'} {c.label}: {c.score} pt
                          </div>
                        ))}
                    </div>
                  )}
                </>
              )}

              {state.roundOutcome.kind === 'cruciverba' && isCruciverbaCard(currentCard) && (
                <>
                  <h2 className={styles.promptHero}>
                    🧩 {state.roundOutcome.cruciverbaSolvedCount}/{state.roundOutcome.cruciverbaTotalCount} Parole Risolte!
                  </h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', textAlign: 'left' }}>
                    {currentCard.words.map((w) => (
                      <div key={w.id} className={styles.spuntiBox}>
                        <strong>
                          {w.number}
                          {w.direction === 'H' ? '→' : '↓'} {w.word}
                        </strong>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {state.cruciverbaState?.solvedBy[w.id]
                            ? state.players.length === 1
                              ? '✓ Indovinata da te'
                              : `Indovinata da ${state.cruciverbaState.solvedBy[w.id]}`
                            : state.players.length === 1
                              ? 'Svelata con indizio'
                              : 'Svelata al tavolo'}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {state.roundOutcome.kind === 'tribunale' && isTribunaleCard(currentCard) && (
                <>
                  <h2 className={styles.promptHero}>
                    {state.roundOutcome.tribunaleWinner === 'TIE'
                      ? '🤝 Patteggiamento!'
                      : `⚖️ Vince ${(state.roundOutcome.tribunaleWinnerIds ?? []).map(playerName).join(' & ')}!`}
                  </h2>
                  {state.roundOutcome.tribunaleLoserId && (
                    <div className={styles.penaltyBox}>
                      <strong>🔨 Sentenza per {playerName(state.roundOutcome.tribunaleLoserId)}:</strong>{' '}
                      {currentCard.penalty}
                    </div>
                  )}
                </>
              )}

              {state.roundOutcome.kind === 'ghigliottina' && isGhigliottinaCard(currentCard) && (
                <>
                  <span className={styles.twistBadge}>🔗 LA GHIGLIOTTINA</span>
                  <h2 className={styles.promptHero} style={{ color: '#fbbf24' }}>
                    {currentCard.answer}
                  </h2>
                  <p className={styles.liveCue}>{state.roundOutcome.liveVerdictLabel}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '100%' }}>
                    {currentCard.clues.map((clue, i) => (
                      <div key={clue} className={styles.spuntiBox} style={{ textAlign: 'left' }}>
                        <strong>{clue}</strong>: {currentCard.connections[i]}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {state.roundOutcome.kind === 'stima' && isStimaCard(currentCard) && (
                <>
                  <span className={styles.twistBadge}>💰 QUANTO VALE?</span>
                  <h2 className={styles.promptHero} style={{ color: '#34d399' }}>
                    {currentCard.answer} {currentCard.unit}
                  </h2>
                  <p className={styles.liveCue}>
                    {state.roundOutcome.soloMode && state.roundOutcome.stimaSoloGuess !== undefined
                      ? `La tua stima: ${state.roundOutcome.stimaSoloGuess} ${currentCard.unit} · ${
                          state.roundOutcome.stimaExact
                            ? '🎯 Centro Perfetto!'
                            : `Precisione ${state.roundOutcome.stimaPrecisionPct ?? 0}%`
                        }`
                      : state.roundOutcome.liveVerdictLabel}
                  </p>
                  <div className={styles.spuntiBox} style={{ textAlign: 'left' }}>
                    💡 {currentCard.funFact}
                  </div>
                </>
              )}

              {state.roundOutcome.kind === 'bufala' && isBufalaCard(currentCard) && (
                <>
                  <span className={styles.twistBadge}>🎭 VERO O BUFALA?</span>
                  <h2
                    className={styles.promptHero}
                    style={{ color: currentCard.isTrue ? '#34d399' : '#fda4af' }}
                  >
                    {currentCard.isTrue ? '✅ ERA VERO!' : '🤡 ERA UNA BUFALA!'}
                  </h2>
                  <p className={styles.liveCue}>{state.roundOutcome.liveVerdictLabel}</p>
                  <div className={styles.spuntiBox} style={{ textAlign: 'left' }}>
                    {currentCard.explanation}
                  </div>
                </>
              )}

              {state.roundOutcome.kind === 'intesa' && isIntesaCard(currentCard) && (
                <>
                  <span className={styles.twistBadge}>🚫 PAROLA VIETATA</span>
                  <h2 className={styles.promptHero} style={{ color: '#fbbf24' }}>
                    {currentCard.word}
                  </h2>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', justifyContent: 'center' }}>
                    {currentCard.forbidden.map((fw) => (
                      <span
                        key={fw}
                        style={{
                          padding: '0.3rem 0.65rem',
                          borderRadius: '999px',
                          background: 'rgba(244, 63, 94, 0.2)',
                          border: '1px solid rgba(244, 63, 94, 0.45)',
                          color: '#fda4af',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                        }}
                      >
                        🚫 {fw}
                      </span>
                    ))}
                  </div>
                  <p className={styles.liveCue}>{state.roundOutcome.liveVerdictLabel}</p>
                </>
              )}

              <Button variant="primary" size="lg" onClick={() => dispatch({ type: 'NEXT_ROUND' })}>
                {state.roundIndex + 1 >= state.cards.length
                  ? 'Scopri il Gran Finale 🏆'
                  : 'Prossimo Round ▶'}
              </Button>
            </Card>
          )}

          {/* FINAL AWARDS */}
          {state.phase === 'FINAL_AWARDS' && (
            <PassFinaleView
              state={state}
              recordSavedCode={recordSavedCode}
              onReplay={() => dispatch({ type: 'RESET_TO_SETUP' })}
              onHome={() => navigate('/')}
            />
          )}
        </div>
      )}
    </main>
  );
}
