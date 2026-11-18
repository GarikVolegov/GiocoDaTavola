import { unlockAudio } from '../../host/audio/engine';
import { unlockSpeech } from '../../host/audio/narrator';
import {
  pauseStoryAudio,
  playStoryAudio,
  restartStoryAudio,
  resumeStoryAudio,
  setStoryPlaybackRate,
  useAudioPlayerState,
  type PlaybackRate,
} from '../../host/audio/storyAudioPlayer';

const SPEEDS: PlaybackRate[] = [1, 1.25, 1.5, 0.75];

interface CompactAudioPlayerProps {
  audioUrl: string | null;
  fallbackText?: string | null;
  label?: string;
}

/**
 * Ultra-compact single-pill audio player (play/pause, restart, speed) designed
 * to occupy minimal vertical space on mobile voting & story screens.
 */
export function CompactAudioPlayer({
  audioUrl,
  fallbackText,
  label = 'Ascolta',
}: CompactAudioPlayerProps) {
  const { isPlaying, isPaused, playbackRate } = useAudioPlayerState();

  const handlePlayPause = () => {
    unlockAudio();
    unlockSpeech();
    if (isPlaying) {
      pauseStoryAudio();
    } else if (isPaused) {
      resumeStoryAudio();
    } else {
      playStoryAudio(audioUrl, fallbackText);
    }
  };

  const handleRestart = () => {
    unlockAudio();
    unlockSpeech();
    restartStoryAudio(audioUrl, fallbackText);
  };

  const handleCycleSpeed = () => {
    const idx = SPEEDS.indexOf(playbackRate);
    const next = SPEEDS[(idx + 1) % SPEEDS.length];
    setStoryPlaybackRate(next);
  };

  const active = isPlaying || isPaused;

  return (
    <div
      role="region"
      aria-label="Lettore audio"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        height: '2.25rem',
        padding: '0 0.35rem',
        borderRadius: '999px',
        background: active ? 'rgba(229, 193, 88, 0.14)' : 'rgba(255, 255, 255, 0.08)',
        border: `1px solid ${active ? 'var(--gold)' : 'rgba(255, 255, 255, 0.18)'}`,
        fontSize: '0.8rem',
        lineHeight: 1,
      }}
    >
      <button
        type="button"
        onClick={handlePlayPause}
        aria-label={isPlaying ? 'Pausa' : isPaused ? 'Riprendi' : label}
        style={{
          background: 'none',
          border: 'none',
          color: active ? 'var(--gold)' : 'inherit',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.3rem',
          padding: '0.25rem 0.45rem',
          fontSize: '0.8rem',
          fontWeight: 700,
          borderRadius: '999px',
        }}
      >
        <span aria-hidden="true">{isPlaying ? '⏸' : '▶'}</span>
        <span>{isPlaying ? 'Pausa' : isPaused ? 'Riprendi' : label}</span>
      </button>

      <span
        aria-hidden="true"
        style={{ width: '1px', height: '1rem', background: 'rgba(255, 255, 255, 0.16)' }}
      />

      <button
        type="button"
        onClick={handleRestart}
        aria-label="Riparti da capo"
        title="Riparti da capo"
        style={{
          background: 'none',
          border: 'none',
          color: 'inherit',
          cursor: 'pointer',
          padding: '0.25rem 0.35rem',
          fontSize: '0.9rem',
          fontWeight: 700,
          opacity: 0.88,
          borderRadius: '999px',
        }}
      >
        ↺
      </button>

      <button
        type="button"
        onClick={handleCycleSpeed}
        aria-label={`Velocità ${playbackRate}x`}
        title="Cambia velocità"
        style={{
          background: 'rgba(255, 255, 255, 0.09)',
          border: 'none',
          color: playbackRate !== 1 ? 'var(--gold)' : 'inherit',
          cursor: 'pointer',
          padding: '0.22rem 0.45rem',
          fontSize: '0.75rem',
          fontWeight: 800,
          fontVariantNumeric: 'tabular-nums',
          borderRadius: '999px',
        }}
      >
        {playbackRate}x
      </button>
    </div>
  );
}
