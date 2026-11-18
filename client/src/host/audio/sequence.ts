// The "musichetta" as pure data: multiple themed progressions (bass + chord/pad +
// melody/arpeggio) with no Web Audio dependency — `music.ts` reads this and renders
// each theme into a cached AudioBuffer on the audio thread.

export type SynthOscType = 'sine' | 'triangle' | 'square' | 'sawtooth';

export interface NoteEvent {
  /** Pitch in Hz. */
  freq: number;
  /** How long the note rings, in beats. */
  durationBeats: number;
  /** Relative loudness within the music bed, 0..1. */
  gain: number;
  /** Oscillator waveform; defaults to 'triangle'. */
  oscType?: SynthOscType;
  /** Optional low-pass cutoff in Hz to keep rich waveforms warm and unobtrusive. */
  filterHz?: number;
}

export type SynthThemeId =
  | 'ambient-warm'
  | 'velvet-spark'
  | 'noir-mystery'
  | 'cyber-scifi'
  | 'adventure-pulse'
  | 'dramatic-piano'
  | 'ethics-tension'
  | 'quirky-bounce'
  | 'arcade-rush'
  | 'focus-drive'
  | 'duel-faceoff'
  | 'chaos-twist';

interface Chord {
  /** Low root, sustained under the chord. */
  bass: number;
  /** Triad or 4-note chord tones for harmony/arpeggio. */
  arp: readonly number[];
}

interface ThemeSpec {
  bpm: number;
  beatsPerChord: number;
  progression: readonly Chord[];
  arpPattern: readonly number[];
  bassType: SynthOscType;
  arpType: SynthOscType;
  padType?: SynthOscType;
  bassFilterHz?: number;
  arpFilterHz?: number;
  arpDurationBeats?: number;
  pulseEveryBeat?: boolean;
}

const THEME_SPECS: Record<SynthThemeId, ThemeSpec> = {
  'ambient-warm': {
    bpm: 84,
    beatsPerChord: 4,
    progression: [
      { bass: 87.31, arp: [174.61, 220.0, 261.63, 329.63] }, // Fmaj7
      { bass: 130.81, arp: [261.63, 329.63, 392.0, 493.88] }, // Cmaj7
      { bass: 146.83, arp: [293.66, 349.23, 440.0, 523.25] }, // Dm7
      { bass: 116.54, arp: [233.08, 293.66, 349.23, 440.0] }, // Bbmaj7
    ],
    arpPattern: [0, 2, 1, 3],
    bassType: 'sine',
    arpType: 'triangle',
    padType: 'sine',
    arpDurationBeats: 1.4,
  },
  'velvet-spark': {
    bpm: 98,
    beatsPerChord: 4,
    progression: [
      { bass: 110.0, arp: [220.0, 261.63, 329.63, 493.88] }, // Am9
      { bass: 146.83, arp: [293.66, 349.23, 440.0, 659.25] }, // Dm9
      { bass: 98.0, arp: [196.0, 246.94, 329.63, 349.23] }, // G13
      { bass: 130.81, arp: [261.63, 329.63, 392.0, 493.88] }, // Cmaj7
    ],
    arpPattern: [0, 3, 2, 1],
    bassType: 'triangle',
    arpType: 'sine',
    padType: 'triangle',
    bassFilterHz: 420,
    arpDurationBeats: 1.1,
  },
  'noir-mystery': {
    bpm: 108,
    beatsPerChord: 4,
    progression: [
      { bass: 130.81, arp: [261.63, 311.13, 392.0, 466.16] }, // Cm7
      { bass: 103.83, arp: [207.65, 261.63, 311.13, 392.0] }, // Abmaj7
      { bass: 87.31, arp: [174.61, 207.65, 261.63, 311.13] }, // Fm7
      { bass: 98.0, arp: [196.0, 246.94, 293.66, 349.23] }, // G7
    ],
    arpPattern: [0, 1, 3, 2],
    bassType: 'triangle',
    arpType: 'triangle',
    arpFilterHz: 1100,
    arpDurationBeats: 0.45,
    pulseEveryBeat: true,
  },
  'cyber-scifi': {
    bpm: 114,
    beatsPerChord: 4,
    progression: [
      { bass: 82.41, arp: [164.81, 246.94, 329.63, 392.0] }, // Em
      { bass: 65.41, arp: [130.81, 196.0, 261.63, 329.63] }, // C
      { bass: 73.42, arp: [146.83, 220.0, 293.66, 369.99] }, // D
      { bass: 123.47, arp: [246.94, 293.66, 369.99, 493.88] }, // Bm
    ],
    arpPattern: [0, 1, 2, 3],
    bassType: 'sawtooth',
    arpType: 'sawtooth',
    bassFilterHz: 320,
    arpFilterHz: 1400,
    arpDurationBeats: 0.65,
    pulseEveryBeat: true,
  },
  'adventure-pulse': {
    bpm: 118,
    beatsPerChord: 4,
    progression: [
      { bass: 73.42, arp: [293.66, 349.23, 440.0, 587.33] }, // Dm
      { bass: 116.54, arp: [233.08, 293.66, 349.23, 466.16] }, // Bb
      { bass: 87.31, arp: [174.61, 220.0, 261.63, 349.23] }, // F
      { bass: 130.81, arp: [261.63, 329.63, 392.0, 523.25] }, // C
    ],
    arpPattern: [0, 2, 3, 2],
    bassType: 'triangle',
    arpType: 'triangle',
    padType: 'sine',
    arpDurationBeats: 0.85,
    pulseEveryBeat: true,
  },
  'dramatic-piano': {
    bpm: 74,
    beatsPerChord: 4,
    progression: [
      { bass: 110.0, arp: [220.0, 261.63, 329.63, 440.0] }, // Am
      { bass: 87.31, arp: [174.61, 220.0, 261.63, 349.23] }, // F
      { bass: 130.81, arp: [261.63, 329.63, 392.0, 523.25] }, // C
      { bass: 82.41, arp: [164.81, 207.65, 246.94, 329.63] }, // E
    ],
    arpPattern: [0, 1, 2, 3],
    bassType: 'sine',
    arpType: 'sine',
    padType: 'triangle',
    arpDurationBeats: 1.6,
  },
  'ethics-tension': {
    bpm: 100,
    beatsPerChord: 4,
    progression: [
      { bass: 82.41, arp: [164.81, 246.94, 329.63, 369.99] }, // Em9
      { bass: 92.5, arp: [185.0, 220.0, 261.63, 329.63] }, // F#m7b5
      { bass: 98.0, arp: [196.0, 246.94, 293.66, 369.99] }, // Gmaj7
      { bass: 123.47, arp: [246.94, 311.13, 369.99, 440.0] }, // B7
    ],
    arpPattern: [0, 2, 3, 1],
    bassType: 'triangle',
    arpType: 'triangle',
    arpFilterHz: 1200,
    arpDurationBeats: 0.7,
    pulseEveryBeat: true,
  },
  'quirky-bounce': {
    bpm: 124,
    beatsPerChord: 4,
    progression: [
      { bass: 130.81, arp: [261.63, 329.63, 392.0, 493.88] }, // Cmaj7
      { bass: 98.0, arp: [196.0, 246.94, 293.66, 440.0] }, // G6
      { bass: 110.0, arp: [220.0, 261.63, 329.63, 392.0] }, // Am7
      { bass: 87.31, arp: [174.61, 220.0, 261.63, 392.0] }, // Fadd9
    ],
    arpPattern: [0, 2, 3, 1],
    bassType: 'triangle',
    arpType: 'sine',
    arpDurationBeats: 0.5,
  },
  'arcade-rush': {
    bpm: 132,
    beatsPerChord: 4,
    progression: [
      { bass: 164.81, arp: [329.63, 392.0, 493.88, 659.25] }, // Em
      { bass: 196.0, arp: [392.0, 493.88, 587.33, 783.99] }, // G
      { bass: 146.83, arp: [293.66, 369.99, 440.0, 587.33] }, // D
      { bass: 110.0, arp: [220.0, 277.18, 329.63, 440.0] }, // A
    ],
    arpPattern: [0, 1, 2, 3],
    bassType: 'sawtooth',
    arpType: 'triangle',
    bassFilterHz: 480,
    arpFilterHz: 1800,
    arpDurationBeats: 0.45,
    pulseEveryBeat: true,
  },
  'focus-drive': {
    bpm: 104,
    beatsPerChord: 4,
    progression: [
      { bass: 146.83, arp: [293.66, 349.23, 440.0, 523.25] }, // Dm7
      { bass: 98.0, arp: [196.0, 246.94, 293.66, 349.23] }, // G7
      { bass: 130.81, arp: [261.63, 329.63, 392.0, 493.88] }, // Cmaj7
      { bass: 110.0, arp: [220.0, 261.63, 329.63, 440.0] }, // Am
    ],
    arpPattern: [0, 2, 1, 3],
    bassType: 'sine',
    arpType: 'triangle',
    arpDurationBeats: 0.75,
  },
  'duel-faceoff': {
    bpm: 110,
    beatsPerChord: 4,
    progression: [
      { bass: 123.47, arp: [246.94, 293.66, 369.99, 440.0] }, // Bm7
      { bass: 98.0, arp: [196.0, 246.94, 293.66, 369.99] }, // Gmaj7
      { bass: 146.83, arp: [293.66, 369.99, 440.0, 554.37] }, // Dmaj7
      { bass: 110.0, arp: [220.0, 277.18, 329.63, 440.0] }, // A
    ],
    arpPattern: [0, 3, 1, 2],
    bassType: 'triangle',
    arpType: 'triangle',
    arpFilterHz: 1500,
    arpDurationBeats: 0.6,
    pulseEveryBeat: true,
  },
  'chaos-twist': {
    bpm: 126,
    beatsPerChord: 4,
    progression: [
      { bass: 110.0, arp: [220.0, 261.63, 329.63, 415.3] }, // Am(maj7)
      { bass: 155.56, arp: [311.13, 392.0, 466.16, 587.33] }, // Ebmaj7
      { bass: 146.83, arp: [293.66, 349.23, 440.0, 523.25] }, // Dm7
      { bass: 82.41, arp: [164.81, 207.65, 293.66, 329.63] }, // E7
    ],
    arpPattern: [0, 3, 2, 1],
    bassType: 'sawtooth',
    arpType: 'triangle',
    bassFilterHz: 420,
    arpFilterHz: 1600,
    arpDurationBeats: 0.5,
    pulseEveryBeat: true,
  },
};

export function themeMeta(theme: SynthThemeId): { loopSteps: number; secondsPerBeat: number } {
  const spec = THEME_SPECS[theme];
  return {
    loopSteps: spec.progression.length * spec.beatsPerChord,
    secondsPerBeat: 60 / spec.bpm,
  };
}

export function themeNoteAt(theme: SynthThemeId, step: number): NoteEvent[] {
  const spec = THEME_SPECS[theme];
  const loopSteps = spec.progression.length * spec.beatsPerChord;
  const s = ((step % loopSteps) + loopSteps) % loopSteps;
  const chord = spec.progression[Math.floor(s / spec.beatsPerChord) % spec.progression.length];
  const beat = s % spec.beatsPerChord;
  const notes: NoteEvent[] = [];

  if (beat === 0) {
    notes.push({
      freq: chord.bass,
      durationBeats: spec.beatsPerChord,
      gain: 0.42,
      oscType: spec.bassType,
      filterHz: spec.bassFilterHz,
    });
    if (spec.padType) {
      notes.push({
        freq: chord.arp[1],
        durationBeats: spec.beatsPerChord * 0.9,
        gain: 0.14,
        oscType: spec.padType,
        filterHz: 900,
      });
    }
  } else if (spec.pulseEveryBeat && beat === 2) {
    notes.push({
      freq: chord.bass * 2,
      durationBeats: 0.5,
      gain: 0.18,
      oscType: spec.bassType,
      filterHz: spec.bassFilterHz ?? 500,
    });
  }

  const toneIdx = spec.arpPattern[beat % spec.arpPattern.length] % chord.arp.length;
  notes.push({
    freq: chord.arp[toneIdx],
    durationBeats: spec.arpDurationBeats ?? 0.9,
    gain: 0.28,
    oscType: spec.arpType,
    filterHz: spec.arpFilterHz,
  });

  return notes;
}

// Legacy Am–F–C–G constants kept for existing sequence.test.ts compatibility.
const BEATS_PER_CHORD = 4;
const PROGRESSION: readonly { bass: number; arp: readonly [number, number, number] }[] = [
  { bass: 110.0, arp: [220.0, 261.63, 329.63] },
  { bass: 87.31, arp: [174.61, 220.0, 261.63] },
  { bass: 130.81, arp: [261.63, 329.63, 392.0] },
  { bass: 98.0, arp: [196.0, 246.94, 293.66] },
];
const ARP_PATTERN: readonly number[] = [0, 2, 1, 2];

/** Total beats in one loop of the legacy musichetta. */
export const LOOP_STEPS = PROGRESSION.length * BEATS_PER_CHORD;

/** Seconds per beat (~100 bpm) — slow and unobtrusive. */
export const SECONDS_PER_BEAT = 0.6;

/** The notes that start on `step` (wraps modulo the loop, so a counter can grow freely). */
export function noteAt(step: number): NoteEvent[] {
  const s = ((step % LOOP_STEPS) + LOOP_STEPS) % LOOP_STEPS;
  const chord = PROGRESSION[Math.floor(s / BEATS_PER_CHORD) % PROGRESSION.length];
  const beat = s % BEATS_PER_CHORD;
  const notes: NoteEvent[] = [];
  if (beat === 0) {
    notes.push({ freq: chord.bass, durationBeats: BEATS_PER_CHORD, gain: 0.5 });
  }
  notes.push({ freq: chord.arp[ARP_PATTERN[beat]], durationBeats: 0.9, gain: 0.32 });
  return notes;
}
