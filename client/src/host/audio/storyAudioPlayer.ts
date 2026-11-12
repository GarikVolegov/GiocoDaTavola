// Story and dilemma proprietary neural audio player.
// Plays studio-rendered MP3 assets (it-IT-DiegoNeural) via Web Audio API (or HTML5 Audio fallback).
// Running through Web Audio bypasses mobile browser autoplay restrictions once the AudioContext
// is unlocked by a user gesture.
// Automatically ducks background music, respects the master mute toggle,
// and falls back seamlessly to the Web Speech API if an asset is not found.

import type { GamePhase, StoriaView } from '../../shared/events';
import { getCtx, getMaster, getSharedAudio, isMuted } from './engine';
import { setMusicIntensity } from './music';
import { speak, cancelNarration, isNarrationSpeaking, notifySpeaking } from './narrator';

let currentSource: AudioBufferSourceNode | null = null;
let currentAudio: HTMLAudioElement | null = null;
let playGen = 0;
let isAudioPlaying = false;

// In-memory cache for decoded AudioBuffers to eliminate network/decode latency on repeats
const bufferCache = new Map<string, AudioBuffer>();

type AudioListener = (playing: boolean) => void;
const audioListeners = new Set<AudioListener>();

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
    const text = `Al bivio… ${dilemma.text} — Opzione A: ${dilemma.optionA}. — Opzione B: ${dilemma.optionB}.`;
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
  if (currentSource) {
    try {
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
  setMusicIntensity('full');
}

export function playStoryAudio(
  url: string | null,
  fallbackText?: string | null,
  onDone?: () => void,
): void {
  const gen = ++playGen;
  stopStoryAudio();

  if (isMuted()) {
    onDone?.();
    return;
  }

  if (!url) {
    if (fallbackText) {
      setMusicIntensity('soft');
      speak(fallbackText, () => {
        setMusicIntensity('full');
        onDone?.();
      });
    } else {
      onDone?.();
    }
    return;
  }

  const cleanup = () => {
    if (gen !== playGen) return;
    notifyAudioPlaying(false);
    setMusicIntensity('full');
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
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        const voiceGain = ctx.createGain();
        voiceGain.gain.value = 1.05; // clear, crisp narrator presence over the ducked background music
        source.connect(voiceGain);
        voiceGain.connect(master);
        source.onended = cleanup;
        currentSource = source;

        notifyAudioPlaying(true);
        setMusicIntensity('soft');
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

      audio.onplay = () => {
        if (gen === playGen) {
          notifyAudioPlaying(true);
          setMusicIntensity('soft');
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
