// The "musichetta" as pure data: a gentle Am–F–C–G loop with a soft bass on each
// chord change and a light arpeggio on every beat. No Web Audio here — `music.ts`
// reads this and schedules it. Pure + deterministic so it can be unit-tested.

export interface NoteEvent {
  /** Pitch in Hz. */
  freq: number;
  /** How long the note rings, in beats. */
  durationBeats: number;
  /** Relative loudness within the music bed, 0..1. */
  gain: number;
}

const BEATS_PER_CHORD = 4;

interface Chord {
  /** Low root, one beat long under the whole chord. */
  bass: number;
  /** Triad (root · third · fifth) the arpeggio walks. */
  arp: readonly [number, number, number];
}

// Am – F – C – G, a warm, recognizable loop. Frequencies in Hz (equal temperament).
const PROGRESSION: readonly Chord[] = [
  { bass: 110.0, arp: [220.0, 261.63, 329.63] }, // Am · A2 / A3 C4 E4
  { bass: 87.31, arp: [174.61, 220.0, 261.63] }, // F  · F2 / F3 A3 C4
  { bass: 130.81, arp: [261.63, 329.63, 392.0] }, // C  · C3 / C4 E4 G4
  { bass: 98.0, arp: [196.0, 246.94, 293.66] }, // G  · G2 / G3 B3 D4
];

// Which triad tone the arpeggio plays on each beat: root, fifth, third, fifth.
const ARP_PATTERN: readonly number[] = [0, 2, 1, 2];

/** Total beats in one loop of the musichetta. */
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
