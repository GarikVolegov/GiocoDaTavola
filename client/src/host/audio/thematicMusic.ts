// Thematic background music controller combining royalty-free MP3 tracks
// (CC-BY 4.0, Kevin MacLeod / incompetech.com) with 12 procedural Web Audio
// soundtracks (`synth:*`). Selects a track that adapts to the chosen mode,
// partyMode, intensity, register, caos, percorso, story genre, and phase,
// rotating across rounds so the music stays themed and often different.

import {
  getPercorsoMeta,
  type GameStatePayload,
  type InfiltratoTono,
  type PartyIntensity,
  type StoryGenre,
} from '../../shared/events';
import type { PassMode } from '../../passAndPlay/fallbackDeck';
import { isMuted, onMuteChange } from './engine';
import { startMusic, stopMusic, setMusicIntensity, type MusicIntensity } from './music';
import type { SynthThemeId } from './sequence';

export type Mp3MusicTheme = 'lobby' | 'sneaky' | 'party' | 'chill' | 'tension';
export type SynthMusicTheme = `synth:${SynthThemeId}`;
export type MusicTheme = Mp3MusicTheme | SynthMusicTheme;

export interface ThematicTrackInfo {
  url: string;
  title: string;
  artist: string;
  fallbackSynth: SynthThemeId;
}

export const THEMATIC_TRACKS: Record<Mp3MusicTheme, ThematicTrackInfo> = {
  lobby: {
    url: '/audio/music/lobby.mp3',
    title: 'Lobby Time',
    artist: 'Kevin MacLeod (CC-BY 4.0)',
    fallbackSynth: 'focus-drive',
  },
  sneaky: {
    url: '/audio/music/sneaky.mp3',
    title: 'Sneaky Snitch',
    artist: 'Kevin MacLeod (CC-BY 4.0)',
    fallbackSynth: 'noir-mystery',
  },
  party: {
    url: '/audio/music/party.mp3',
    title: 'Who Likes to Party',
    artist: 'Kevin MacLeod (CC-BY 4.0)',
    fallbackSynth: 'arcade-rush',
  },
  chill: {
    url: '/audio/music/chill.mp3',
    title: 'Chill',
    artist: 'Kevin MacLeod (CC-BY 4.0)',
    fallbackSynth: 'ambient-warm',
  },
  tension: {
    url: '/audio/music/tension.mp3',
    title: 'Quiet Panic',
    artist: 'Kevin MacLeod (CC-BY 4.0)',
    fallbackSynth: 'ethics-tension',
  },
};

const THEME_VOLUME: Record<MusicIntensity, number> = { full: 0.24, soft: 0.08 };

let audioEl: HTMLAudioElement | null = null;
let currentTheme: MusicTheme | null = null;
let currentMp3Theme: Mp3MusicTheme | null = null;
let currentIntensity: MusicIntensity = 'full';
let active = false;
const failedMp3Themes = new Set<Mp3MusicTheme>();
let unsubMute: (() => void) | null = null;

function isSynthTheme(theme: MusicTheme): theme is SynthMusicTheme {
  return theme.startsWith('synth:');
}

function synthIdFromTheme(theme: SynthMusicTheme): SynthThemeId {
  return theme.slice('synth:'.length) as SynthThemeId;
}

function hashIndex(id: string | undefined, mod: number): number {
  const s = id ?? '';
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % mod;
}

function pickFromPool(pool: readonly MusicTheme[], seed: number): MusicTheme {
  return pool[((seed % pool.length) + pool.length) % pool.length];
}

function phaseOffset(phase: string): number {
  if (phase === 'DEFENSE' || phase === 'INTERVENTI' || phase === 'DEBATE') return 1;
  if (phase === 'VOTE_2' || phase === 'PREDICT') return 2;
  if (phase === 'ACCUSE' || phase === 'SPEAKER_VOTE') return 3;
  return 0;
}

function pickForPartyMode(
  mode: string,
  seed: number,
  phase: string,
  options?: { intensity?: PartyIntensity | null; cardType?: string | null },
): MusicTheme {
  if (mode === 'infiltrato') {
    if (phase === 'ACCUSE' || phase === 'DEFENSE' || phase === 'DEBATE') {
      return pickFromPool(['tension', 'synth:noir-mystery', 'sneaky'], seed);
    }
    return pickFromPool(['sneaky', 'synth:noir-mystery', 'tension', 'synth:ethics-tension'], seed);
  }
  if (mode === 'coppie') {
    if (options?.intensity === 'piccante') {
      return pickFromPool(['synth:velvet-spark', 'chill', 'synth:duel-faceoff'], seed);
    }
    return pickFromPool(['chill', 'synth:ambient-warm', 'synth:velvet-spark'], seed);
  }
  if (mode === 'flash' || mode === 'preferiresti') {
    if (phase === 'DEFENSE' || phase === 'DEBATE') {
      return pickFromPool(['tension', 'synth:arcade-rush'], seed);
    }
    return pickFromPool(['party', 'synth:arcade-rush', 'synth:quirky-bounce'], seed);
  }
  if (mode === 'assurdo') {
    if (options?.cardType === 'gogna') {
      return pickFromPool(['tension', 'synth:chaos-twist', 'party'], seed);
    }
    return pickFromPool(['party', 'synth:quirky-bounce', 'synth:chaos-twist'], seed);
  }
  return pickFromPool(['party', 'synth:quirky-bounce', 'sneaky', 'chill', 'synth:arcade-rush'], seed);
}

function pickForStoryGenre(genre: StoryGenre | undefined, seed: number, phase: string): MusicTheme {
  const offset = seed + (phase === 'SCENE_CONSEQUENCE' ? 1 : phase === 'DEFENSE' ? 2 : 0);
  switch (genre) {
    case 'scifi':
      return pickFromPool(['synth:cyber-scifi', 'tension', 'synth:noir-mystery', 'sneaky'], offset);
    case 'giallo':
      return pickFromPool(['sneaky', 'synth:noir-mystery', 'tension', 'synth:ethics-tension'], offset);
    case 'avventura':
      return pickFromPool(['synth:adventure-pulse', 'tension', 'chill', 'synth:focus-drive'], offset);
    case 'dramma':
      return pickFromPool(['synth:dramatic-piano', 'chill', 'tension', 'synth:ambient-warm'], offset);
    default:
      return pickFromPool(['synth:adventure-pulse', 'synth:cyber-scifi', 'tension', 'chill'], offset);
  }
}

/** Pick a fitting background music theme for the live multiplayer game state. */
export function pickMusicThemeForGame(game: GameStatePayload | null): MusicTheme {
  if (!game || game.phase === 'LOBBY') return 'lobby';
  if (game.phase === 'FINAL_AWARDS' || game.phase === 'UNANIMOUS_REVEAL') return 'party';
  if (game.phase === 'DUO_PORTRAIT') return 'synth:ambient-warm';

  const round = Math.max(0, (game.dilemmaIndex ?? 1) - 1);
  const seed = round + phaseOffset(game.phase);

  // 1. Party modes (including Serata Mix adapting to the active card's mode)
  if (game.partyMode) {
    const effectiveMode =
      game.partyMode === 'mix' && game.partyCard?.mode && game.partyCard.mode !== 'mix'
        ? game.partyCard.mode
        : game.partyMode;
    return pickForPartyMode(effectiveMode, seed, game.phase, {
      intensity: game.partyCard?.intensity ?? null,
      cardType: game.partyCard?.cardType ?? null,
    });
  }
  if (game.phase === 'ACCUSE') return 'sneaky';

  // 2. Storie (interactive sci-fi / mystery / adventure / drama narratives)
  if (game.storia) {
    const genre = game.storieCatalog?.find((s) => s.id === game.storia?.storyId)?.genre;
    return pickForStoryGenre(genre, game.storia.sceneIndex ?? 0, game.phase);
  }

  // 3. Percorso in 2 (Duello)
  if (game.mode === 'duello') {
    if (game.phase === 'DUO_ARGUE') return 'synth:duel-faceoff';
    return pickFromPool(['chill', 'synth:duel-faceoff', 'synth:ambient-warm', 'synth:velvet-spark'], seed);
  }

  // 4. Percorsi (risate / direzione / serio)
  if (game.percorso) {
    const meta = getPercorsoMeta(game.percorso.percorsoId);
    const percorsoSeed = seed + hashIndex(game.percorso.percorsoId, 4);
    if (game.phase === 'TAPPA_RECAP') {
      return meta.corsia === 'serio' ? 'synth:ambient-warm' : 'synth:adventure-pulse';
    }
    if (meta.corsia === 'risate') {
      return pickFromPool(['party', 'synth:quirky-bounce', 'lobby', 'synth:ambient-warm'], percorsoSeed);
    }
    if (meta.corsia === 'direzione') {
      return pickFromPool(['synth:focus-drive', 'chill', 'synth:adventure-pulse', 'tension'], percorsoSeed);
    }
    return pickFromPool(['synth:dramatic-piano', 'chill', 'synth:ethics-tension', 'tension'], percorsoSeed);
  }

  // 5. Special minigame phases (Group Mind / Write / Hot Take)
  if (game.phase === 'GROUP_MIND' || game.phase === 'WRITE' || game.phase === 'HOT_TAKE_VOTE') {
    return pickFromPool(['lobby', 'synth:quirky-bounce', 'party'], seed);
  }

  // 6. Twists, devil's advocate, high chaos, and final stakes
  if (game.isDevilRound || game.twist) {
    return pickFromPool(['synth:chaos-twist', 'tension'], seed);
  }
  if (game.finalStakesRound) {
    return pickFromPool(['tension', 'synth:adventure-pulse'], seed);
  }

  // 7. Classic dilemma complexity + content register + caos dial
  const d = game.dilemma;
  if (d) {
    if (d.complessita === 'power' || d.complessita === 'max' || game.phase === 'DEFENSE' || game.phase === 'VOTE_2') {
      return round === 0 ? 'tension' : pickFromPool(['tension', 'synth:ethics-tension', 'synth:dramatic-piano'], round);
    }
    if (d.complessita === 'sorbetto') {
      return round === 0 ? 'party' : pickFromPool(['party', 'synth:quirky-bounce', 'lobby'], round);
    }
    if (d.complessita === 'alto') {
      return round === 0 ? 'chill' : pickFromPool(['chill', 'synth:ambient-warm', 'synth:focus-drive'], round);
    }
    if (game.caos === 'alto') {
      return pickFromPool(['synth:chaos-twist', 'party', 'tension', 'synth:quirky-bounce'], seed + hashIndex(d.id, 4));
    }
    if (game.register === 'business' || game.register === 'carriera') {
      return pickFromPool(['synth:focus-drive', 'chill', 'tension', 'lobby'], seed + hashIndex(d.id, 4));
    }
    if (game.register === 'vita') {
      return pickFromPool(['chill', 'synth:ambient-warm', 'party', 'lobby'], seed + hashIndex(d.id, 4));
    }
    const pool: MusicTheme[] = ['chill', 'party', 'tension', 'lobby', 'synth:focus-drive', 'synth:ambient-warm'];
    return pool[hashIndex(d.id, pool.length)];
  }

  return 'lobby';
}

export interface PassMusicOptions {
  intensity?: PartyIntensity | null;
  infiltratoTono?: InfiltratoTono | null;
  roundIndex?: number;
}

/** Pick a fitting background music theme for Pass & Play ("Passa il Telefono"). */
export function pickMusicThemeForPass(
  mode: PassMode,
  cardId: string | undefined,
  phase: string,
  options?: PassMusicOptions,
): MusicTheme {
  if (phase === 'SETUP') return 'lobby';
  if (phase === 'FINAL_AWARDS') return 'party';

  const round = options?.roundIndex ?? 0;
  const seed = round + (cardId ? hashIndex(cardId, 4) : 0) + phaseOffset(phase);

  if (mode === 'infiltrato') {
    if (round === 0 && phase === 'CARD_INTRO') return 'sneaky';
    if (options?.infiltratoTono === 'profondo') {
      return pickFromPool(['synth:noir-mystery', 'tension', 'synth:dramatic-piano', 'sneaky'], seed);
    }
    if (phase === 'DEBATE') return pickFromPool(['tension', 'synth:noir-mystery'], seed);
    return pickFromPool(['sneaky', 'synth:noir-mystery', 'tension', 'synth:ethics-tension'], seed);
  }

  if (mode === 'coppie') {
    if (round === 0 && phase === 'CARD_INTRO' && options?.intensity !== 'piccante') return 'chill';
    return pickForPartyMode('coppie', seed, phase, { intensity: options?.intensity ?? null });
  }

  if (mode === 'flash' || mode === 'assurdo' || mode === 'preferiresti') {
    if (phase === 'DEBATE') return 'tension';
    if (round === 0 && phase === 'CARD_INTRO') return 'party';
    return pickForPartyMode(mode, seed, phase);
  }

  if (mode === 'cruciverba') {
    if (phase === 'DEBATE') return pickFromPool(['synth:focus-drive', 'tension', 'synth:ambient-warm'], seed);
    return pickFromPool(['synth:ambient-warm', 'chill', 'synth:focus-drive'], seed);
  }

  if (mode === 'tribunale') {
    if (phase === 'DEBATE' || phase === 'SECRET_TURN') return pickFromPool(['tension', 'synth:ethics-tension'], seed);
    return pickFromPool(['party', 'tension', 'synth:focus-drive'], seed);
  }

  // Classico in Pass & Play
  if (phase === 'DEBATE') return pickFromPool(['tension', 'synth:ethics-tension'], seed);
  const pool: MusicTheme[] = ['chill', 'tension', 'lobby', 'party', 'synth:focus-drive', 'synth:ambient-warm'];
  return cardId ? pool[(hashIndex(cardId, pool.length) + round) % pool.length] : 'lobby';
}

function syncElementVolume(): void {
  if (!audioEl) return;
  audioEl.muted = isMuted();
  audioEl.volume = THEME_VOLUME[currentIntensity];
}

function pauseAudioElement(): void {
  if (!audioEl) return;
  try {
    audioEl.pause();
  } catch {
    /* ignore */
  }
}

function ensureAudioElement(): HTMLAudioElement | null {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return null;
  if (!audioEl) {
    audioEl = new Audio();
    audioEl.loop = true;
    audioEl.preload = 'auto';
    audioEl.addEventListener('error', () => {
      if (currentMp3Theme) {
        failedMp3Themes.add(currentMp3Theme);
        if (active && currentTheme === currentMp3Theme) {
          startMusic(THEMATIC_TRACKS[currentMp3Theme].fallbackSynth);
        }
      }
    });
  }
  if (!unsubMute) {
    unsubMute = onMuteChange(() => syncElementVolume());
  }
  return audioEl;
}

export function startThematicMusic(theme: MusicTheme): void {
  active = true;
  currentTheme = theme;

  if (isSynthTheme(theme)) {
    currentMp3Theme = null;
    pauseAudioElement();
    startMusic(synthIdFromTheme(theme));
    return;
  }

  // MP3 theme requested
  const track = THEMATIC_TRACKS[theme];
  if (failedMp3Themes.has(theme)) {
    currentMp3Theme = null;
    pauseAudioElement();
    startMusic(track.fallbackSynth);
    return;
  }

  const el = ensureAudioElement();
  if (!el) {
    startMusic(track.fallbackSynth);
    return;
  }

  // Stop synth bed before starting MP3
  stopMusic();
  currentMp3Theme = theme;

  if (!el.src.endsWith(track.url)) {
    el.src = track.url;
  }
  syncElementVolume();

  try {
    const p = el.play();
    if (p && typeof p.catch === 'function') {
      p.catch((err: unknown) => {
        const name = (err as { name?: string } | null)?.name;
        // AbortError happens normally when switching tracks quickly; don't fall back.
        if (name === 'AbortError') return;
        // Autoplay blocked or decode issue: play matching synth for now without
        // permanently poisoning MP3 playback for subsequent user-unlocked calls.
        if (active && currentTheme === theme) {
          startMusic(track.fallbackSynth);
        }
      });
    }
  } catch {
    startMusic(track.fallbackSynth);
  }
}

export function setThematicIntensity(next: MusicIntensity): void {
  currentIntensity = next;
  syncElementVolume();
  setMusicIntensity(next);
}

export function stopThematicMusic(): void {
  active = false;
  currentMp3Theme = null;
  stopMusic();
  pauseAudioElement();
}
