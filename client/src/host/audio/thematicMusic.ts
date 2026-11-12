// Thematic royalty-free background music controller (CC-BY 4.0, Kevin MacLeod / incompetech.com).
// Selects a track that adapts to the current game mode, phase, and dilemma
// register/complexity, with smooth ducking and automatic fallback to the
// synthesized Web Audio loop if MP3 playback fails.

import type { GameStatePayload } from '../../shared/events';
import type { PassMode } from '../../passAndPlay/fallbackDeck';
import { isMuted, onMuteChange } from './engine';
import { startMusic, stopMusic, setMusicIntensity, type MusicIntensity } from './music';

export type MusicTheme = 'lobby' | 'sneaky' | 'party' | 'chill' | 'tension';

export interface ThematicTrackInfo {
  url: string;
  title: string;
  artist: string;
}

export const THEMATIC_TRACKS: Record<MusicTheme, ThematicTrackInfo> = {
  lobby: { url: '/audio/music/lobby.mp3', title: 'Lobby Time', artist: 'Kevin MacLeod (CC-BY 4.0)' },
  sneaky: { url: '/audio/music/sneaky.mp3', title: 'Sneaky Snitch', artist: 'Kevin MacLeod (CC-BY 4.0)' },
  party: { url: '/audio/music/party.mp3', title: 'Who Likes to Party', artist: 'Kevin MacLeod (CC-BY 4.0)' },
  chill: { url: '/audio/music/chill.mp3', title: 'Chill', artist: 'Kevin MacLeod (CC-BY 4.0)' },
  tension: { url: '/audio/music/tension.mp3', title: 'Quiet Panic', artist: 'Kevin MacLeod (CC-BY 4.0)' },
};

const THEME_VOLUME: Record<MusicIntensity, number> = { full: 0.24, soft: 0.09 };

let audioEl: HTMLAudioElement | null = null;
let currentTheme: MusicTheme | null = null;
let currentIntensity: MusicIntensity = 'full';
let active = false;
let fallbackSynth = false;
let unsubMute: (() => void) | null = null;

function hashIndex(id: string | undefined, mod: number): number {
  const s = id ?? '';
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % mod;
}

/** Pick a fitting background music theme for the live multiplayer game state. */
export function pickMusicThemeForGame(game: GameStatePayload | null): MusicTheme {
  if (!game || game.phase === 'LOBBY') return 'lobby';
  if (game.phase === 'FINAL_AWARDS' || game.phase === 'UNANIMOUS_REVEAL') return 'party';
  if (game.partyMode === 'infiltrato' || game.phase === 'ACCUSE') return 'sneaky';
  if (game.partyMode === 'coppie' || game.mode === 'duello') return 'chill';
  if (game.partyMode === 'flash' || game.partyMode === 'assurdo') return 'party';

  const d = game.dilemma;
  if (d) {
    if (d.complessita === 'power' || d.complessita === 'max' || game.phase === 'DEFENSE' || game.phase === 'VOTE_2') {
      return 'tension';
    }
    if (d.complessita === 'sorbetto') return 'party';
    if (d.complessita === 'alto') return 'chill';
    const pool: MusicTheme[] = ['chill', 'party', 'tension', 'lobby'];
    return pool[hashIndex(d.id, pool.length)];
  }
  return 'lobby';
}

/** Pick a fitting background music theme for Pass & Play ("Passa il Telefono"). */
export function pickMusicThemeForPass(mode: PassMode, cardId: string | undefined, phase: string): MusicTheme {
  if (phase === 'SETUP') return 'lobby';
  if (phase === 'FINAL_AWARDS') return 'party';
  if (mode === 'infiltrato') return 'sneaky';
  if (mode === 'coppie') return 'chill';
  if (mode === 'flash' || mode === 'assurdo') {
    if (phase === 'DEBATE') return 'tension';
    return 'party';
  }
  const pool: MusicTheme[] = ['chill', 'tension', 'lobby', 'party'];
  return cardId ? pool[hashIndex(cardId, pool.length)] : 'lobby';
}

function syncElementVolume(): void {
  if (!audioEl) return;
  audioEl.muted = isMuted();
  audioEl.volume = THEME_VOLUME[currentIntensity];
}

function ensureAudioElement(): HTMLAudioElement | null {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return null;
  if (!audioEl) {
    audioEl = new Audio();
    audioEl.loop = true;
    audioEl.preload = 'auto';
    audioEl.addEventListener('error', () => {
      // Fall back to synthesized Web Audio bed if MP3 fails (e.g. offline/jsdom)
      fallbackSynth = true;
      if (active) startMusic();
    });
  }
  if (!unsubMute) {
    unsubMute = onMuteChange(() => syncElementVolume());
  }
  return audioEl;
}

export function startThematicMusic(theme: MusicTheme): void {
  active = true;
  if (fallbackSynth) {
    if (currentTheme !== theme) currentTheme = theme;
    startMusic();
    return;
  }

  const el = ensureAudioElement();
  if (!el) {
    fallbackSynth = true;
    startMusic();
    return;
  }

  const track = THEMATIC_TRACKS[theme];
  if (currentTheme !== theme || !el.src.endsWith(track.url)) {
    currentTheme = theme;
    el.src = track.url;
  }
  syncElementVolume();

  try {
    const p = el.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => {
        // Autoplay or decode failed; fall back to synthesized bed
        fallbackSynth = true;
        if (active) startMusic();
      });
    }
  } catch {
    fallbackSynth = true;
    startMusic();
  }
}

export function setThematicIntensity(next: MusicIntensity): void {
  currentIntensity = next;
  syncElementVolume();
  setMusicIntensity(next);
}

export function stopThematicMusic(): void {
  active = false;
  stopMusic();
  if (audioEl) {
    try {
      audioEl.pause();
    } catch {
      /* ignore */
    }
  }
}
