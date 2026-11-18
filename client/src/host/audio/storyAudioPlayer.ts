// Story and dilemma proprietary neural audio player.
// Plays studio-rendered MP3 assets (it-IT-DiegoNeural) via Web Audio API (or HTML5 Audio fallback).
// Running through Web Audio bypasses mobile browser autoplay restrictions once the AudioContext
// is unlocked by a user gesture.
// Automatically ducks background music, respects the master mute toggle,
// and falls back seamlessly to the Web Speech API if an asset is not found.

import { useEffect, useState } from 'react';
import type { GamePhase, StoriaView } from '../../shared/events';
import { getCtx, getMaster, getSharedAudio, isMuted } from './engine';
import { setThematicIntensity } from './thematicMusic';
import { speak, cancelNarration, isNarrationSpeaking, notifySpeaking } from './narrator';

export type PlaybackRate = 0.75 | 1 | 1.25 | 1.5;

export interface AudioPlayerState {
  isPlaying: boolean;
  isPaused: boolean;
  playbackRate: PlaybackRate;
}

let currentSource: AudioBufferSourceNode | null = null;
let currentBuffer: AudioBuffer | null = null;
let currentAudio: HTMLAudioElement | null = null;
let playGen = 0;
let isAudioPlaying = false;
let isAudioPaused = false;
let currentRate: PlaybackRate = 1;
let bufferStartCtxTime = 0;
let pausedOffset = 0;
let lastTarget: { url: string | null; fallbackText?: string | null; onDone?: () => void } | null = null;
let usingSpeechFallback = false;

// In-memory cache for decoded AudioBuffers to eliminate network/decode latency on repeats
const bufferCache = new Map<string, AudioBuffer>();

type AudioListener = (playing: boolean) => void;
const audioListeners = new Set<AudioListener>();

type PlayerStateListener = (state: AudioPlayerState) => void;
const playerStateListeners = new Set<PlayerStateListener>();

function snapshotState(): AudioPlayerState {
  return {
    isPlaying: isAudioPlaying || isNarrationSpeaking(),
    isPaused: isAudioPaused,
    playbackRate: currentRate,
  };
}

function emitPlayerState(): void {
  const snap = snapshotState();
  for (const listener of playerStateListeners) {
    try {
      listener(snap);
    } catch {
      /* ignore */
    }
  }
}

function notifyAudioPlaying(playing: boolean): void {
  notifySpeaking(playing);
  if (isAudioPlaying !== playing) {
    isAudioPlaying = playing;
    for (const listener of audioListeners) {
      try {
        listener(playing);
      } catch {
        /* ignore */
      }
    }
  }
  emitPlayerState();
}

export function subscribeAudioPlayerState(listener: PlayerStateListener): () => void {
  playerStateListeners.add(listener);
  listener(snapshotState());
  return () => {
    playerStateListeners.delete(listener);
  };
}

export function useAudioPlayerState(): AudioPlayerState {
  const [state, setState] = useState<AudioPlayerState>(snapshotState);
  useEffect(() => subscribeAudioPlayerState(setState), []);
  return state;
}

export function subscribeAudioPlayback(listener: AudioListener): () => void {
  audioListeners.add(listener);
  listener(isAudioPlaying || isNarrationSpeaking());
  return () => {
    audioListeners.delete(listener);
  };
}

export function isAnyNarrationActive(): boolean {
  return isAudioPlaying || isNarrationSpeaking();
}

/** Deterministic epilogue index based on decisionsA */
export function epilogueIndexForDecisions(decisionsA: number): number {
  if (decisionsA >= 3) return 2;
  if (decisionsA >= 2) return 1;
  return 0;
}

export interface DilemmaAudioTarget {
  id?: string;
  text: string;
  optionA: string;
  optionB: string;
}

/** Resolves the pre-rendered or on-demand audio asset URL for a story beat or dilemma. */
export function getStoryAudioUrl(
  phase: GamePhase,
  storia: StoriaView | null,
  dilemma?: DilemmaAudioTarget | null,
): string | null {
  if (storia) {
    const base = `/audio/stories/${storia.storyId}`;
    switch (phase) {
      case 'STORY_INTRO':
        return `${base}/intro.mp3`;
      case 'SCENE_INTRO':
        return `${base}/scene_${storia.sceneIndex}.mp3`;
      case 'DILEMMA_REVEAL':
      case 'VOTE_1': {
        const idx = Math.max(0, storia.sceneIndex - 1);
        return `${base}/bivio_${idx}.mp3`;
      }
      case 'SCENE_CONSEQUENCE': {
        const idx = Math.max(0, storia.sceneIndex - 1);
        const decision = storia.decision ?? 'A';
        return `${base}/consequence_${idx}_${decision}.mp3`;
      }
      case 'STORY_EPILOGUE': {
        const epIdx = epilogueIndexForDecisions(storia.decisionsA);
        return `${base}/epilogue_${epIdx}.mp3`;
      }
      default:
        return null;
    }
  }

  // Classic or Percorso dilemma: on-demand dynamic neural TTS endpoint (Diego voice)
  if (dilemma && (phase === 'DILEMMA_REVEAL' || phase === 'VOTE_1')) {
    const text = `${dilemma.text} — ${dilemma.optionA}, oppure ${dilemma.optionB}.`;
    return `/api/audio/tts?text=${encodeURIComponent(text)}`;
  }

  return null;
}

/** Pre-downloads and decodes an audio asset into memory cache so it plays with 0ms latency. */
export function prefetchStoryAudio(url: string | null): void {
  if (!url || bufferCache.has(url)) return;
  const ctx = getCtx();
  if (!ctx) return;
  fetch(url)
    .then((res) => {
      if (!res.ok) return null;
      return res.arrayBuffer();
    })
    .then((arr) => {
      if (!arr) return;
      return ctx.decodeAudioData(arr);
    })
    .then((decoded) => {
      if (decoded) bufferCache.set(url, decoded);
    })
    .catch(() => {
      /* ignore prefetch failures */
    });
}

export function stopStoryAudio(): void {
  playGen += 1;
  isAudioPaused = false;
  pausedOffset = 0;
  currentBuffer = null;
  usingSpeechFallback = false;
  if (currentSource) {
    try {
      currentSource.onended = null;
      currentSource.stop();
      currentSource.disconnect();
    } catch {
      /* ignore */
    }
    currentSource = null;
  }
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch {
      /* ignore */
    }
    currentAudio = null;
  }
  notifyAudioPlaying(false);
  cancelNarration();
  setThematicIntensity('full');
}

export function pauseStoryAudio(): void {
  if (!isAudioPlaying && !isNarrationSpeaking()) return;
  if (currentSource) {
    const ctx = getCtx();
    if (ctx) {
      pausedOffset = Math.max(0, pausedOffset + (ctx.currentTime - bufferStartCtxTime) * currentRate);
    }
    try {
      currentSource.onended = null;
      currentSource.stop();
      currentSource.disconnect();
    } catch {
      /* ignore */
    }
    currentSource = null;
    isAudioPaused = true;
    notifyAudioPlaying(false);
    setThematicIntensity('full');
    return;
  }
  if (currentAudio) {
    try {
      currentAudio.pause();
    } catch {
      /* ignore */
    }
    isAudioPaused = true;
    notifyAudioPlaying(false);
    setThematicIntensity('full');
    return;
  }
  if (usingSpeechFallback && typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.pause();
      isAudioPaused = true;
      notifyAudioPlaying(false);
      setThematicIntensity('full');
    } catch {
      /* ignore */
    }
  }
}

export function resumeStoryAudio(): void {
  if (!isAudioPaused) return;
  if (isMuted()) return;

  if (currentBuffer) {
    const ctx = getCtx();
    const master = getMaster();
    if (ctx && master) {
      if (ctx.state === 'suspended') void ctx.resume();
      const offset = Math.min(pausedOffset, Math.max(0, currentBuffer.duration - 0.05));
      const gen = playGen;
      try {
        const source = ctx.createBufferSource();
        source.buffer = currentBuffer;
        source.playbackRate.value = currentRate;
        const voiceGain = ctx.createGain();
        voiceGain.gain.value = 1.05;
        source.connect(voiceGain);
        voiceGain.connect(master);
        source.onended = () => {
          if (gen !== playGen) return;
          isAudioPaused = false;
          pausedOffset = 0;
          currentSource = null;
          currentBuffer = null;
          notifyAudioPlaying(false);
          setThematicIntensity('full');
          lastTarget?.onDone?.();
        };
        currentSource = source;
        bufferStartCtxTime = ctx.currentTime;
        isAudioPaused = false;
        notifyAudioPlaying(true);
        setThematicIntensity('soft');
        source.start(0, offset);
        return;
      } catch {
        /* fall through */
      }
    }
  }

  if (currentAudio) {
    isAudioPaused = false;
    currentAudio.playbackRate = currentRate;
    void currentAudio.play();
    notifyAudioPlaying(true);
    setThematicIntensity('soft');
    return;
  }

  if (usingSpeechFallback && typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      isAudioPaused = false;
      window.speechSynthesis.resume();
      notifyAudioPlaying(true);
      setThematicIntensity('soft');
    } catch {
      /* ignore */
    }
  }
}

export function setStoryPlaybackRate(rate: PlaybackRate): void {
  if (currentRate === rate) return;
  const ctx = getCtx();
  if (currentSource && ctx && isAudioPlaying && !isAudioPaused) {
    pausedOffset = Math.max(0, pausedOffset + (ctx.currentTime - bufferStartCtxTime) * currentRate);
    bufferStartCtxTime = ctx.currentTime;
    currentSource.playbackRate.value = rate;
  }
  if (currentAudio) {
    currentAudio.playbackRate = rate;
  }
  currentRate = rate;
  emitPlayerState();
}

export function restartStoryAudio(
  url?: string | null,
  fallbackText?: string | null,
  onDone?: () => void,
): void {
  const targetUrl = url !== undefined ? url : (lastTarget?.url ?? null);
  const targetText = fallbackText !== undefined ? fallbackText : lastTarget?.fallbackText;
  const targetDone = onDone !== undefined ? onDone : lastTarget?.onDone;
  playStoryAudio(targetUrl, targetText, targetDone);
}

export function playStoryAudio(
  url: string | null,
  fallbackText?: string | null,
  onDone?: () => void,
): void {
  stopStoryAudio();
  const gen = ++playGen;
  lastTarget = { url, fallbackText, onDone };

  if (isMuted()) {
    onDone?.();
    return;
  }

  if (!url) {
    if (fallbackText) {
      usingSpeechFallback = true;
      setThematicIntensity('soft');
      speak(fallbackText, () => {
        usingSpeechFallback = false;
        isAudioPaused = false;
        setThematicIntensity('full');
        emitPlayerState();
        onDone?.();
      }, currentRate);
    } else {
      onDone?.();
    }
    return;
  }

  const cleanup = () => {
    if (gen !== playGen) return;
    isAudioPaused = false;
    pausedOffset = 0;
    currentBuffer = null;
    usingSpeechFallback = false;
    notifyAudioPlaying(false);
    setThematicIntensity('full');
    currentSource = null;
    currentAudio = null;
    onDone?.();
  };

  const ctx = getCtx();
  const master = getMaster();

  // Primary player: Web Audio API (unlocked AudioContext plays freely on mobile without gesture)
  if (ctx && master) {
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }

    const startBuffer = (buffer: AudioBuffer) => {
      if (gen !== playGen) return;
      try {
        currentBuffer = buffer;
        pausedOffset = 0;
        isAudioPaused = false;
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = currentRate;
        const voiceGain = ctx.createGain();
        voiceGain.gain.value = 1.05; // clear, crisp narrator presence over the ducked background music
        source.connect(voiceGain);
        voiceGain.connect(master);
        source.onended = cleanup;
        currentSource = source;
        bufferStartCtxTime = ctx.currentTime;

        notifyAudioPlaying(true);
        setThematicIntensity('soft');
        source.start(0);
      } catch (err) {
        console.warn('[storyAudio] WebAudio buffer source failed:', err);
        fallbackHtmlAudioOrSpeech();
      }
    };

    if (bufferCache.has(url)) {
      startBuffer(bufferCache.get(url)!);
      return;
    }

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .then((arr) => ctx.decodeAudioData(arr))
      .then((decoded) => {
        bufferCache.set(url, decoded);
        if (gen === playGen) {
          startBuffer(decoded);
        }
      })
      .catch((err) => {
        console.warn('[storyAudio] WebAudio fetch/decode failed, trying fallback:', err);
        if (gen === playGen) {
          fallbackHtmlAudioOrSpeech();
        }
      });
    return;
  }

  // Secondary fallback: HTML Audio Element or Web Speech
  fallbackHtmlAudioOrSpeech();

  function fallbackHtmlAudioOrSpeech(): void {
    if (gen !== playGen) return;

    try {
      const audio = getSharedAudio() ?? new Audio();
      currentAudio = audio;
      audio.src = url!;
      audio.playbackRate = currentRate;

      audio.onplay = () => {
        if (gen === playGen) {
          notifyAudioPlaying(true);
          setThematicIntensity('soft');
        }
      };

      audio.onended = cleanup;

      audio.onerror = () => {
        if (gen !== playGen) return;
        notifyAudioPlaying(false);
        if (fallbackText) {
          speak(fallbackText, cleanup);
        } else {
          cleanup();
        }
      };

      const p = audio.play();
      if (p && typeof p.catch === 'function') {
        p.catch((err) => {
          console.warn('[storyAudio] HTMLAudio play blocked, using Web Speech:', err);
          notifyAudioPlaying(false);
          if (gen === playGen && fallbackText) {
            speak(fallbackText, cleanup);
          } else {
            cleanup();
          }
        });
      }
    } catch {
      if (fallbackText) {
        speak(fallbackText, cleanup);
      } else {
        cleanup();
      }
    }
  }
}

export function replayStoryAudio(
  url: string | null,
  fallbackText?: string | null,
  onDone?: () => void,
): void {
  playStoryAudio(url, fallbackText, onDone);
}
