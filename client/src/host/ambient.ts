// A soft, distinctive ambient bed for the host's waiting screens, generated with the
// Web Audio API — no binary asset. A quiet low chord under a slow tremolo (LFO on the
// gain) gives a gentle, recognizable loop. Host-only; safe no-ops when audio is
// unavailable. Drop-in alternative: swap for an <audio loop> on a file in public/.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let voices: { osc: OscillatorNode; lfo: OscillatorNode }[] = [];
let running = false;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.06; // low — a bed under the room, not a foreground sound
    master.connect(ctx.destination);
  }
  return ctx;
}

// Resume the AudioContext after a user gesture (browser autoplay policy).
export function unlockAmbient(): void {
  const c = getCtx();
  if (c && c.state === 'suspended') void c.resume();
}

export function startAmbient(): void {
  const c = getCtx();
  if (!c || !master || running) return;
  void c.resume();
  const freqs = [110, 164.81, 220]; // A2 · E3 · A3
  voices = freqs.map((f) => {
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = f;
    const g = c.createGain();
    g.gain.value = 1 / freqs.length;
    const lfo = c.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.15; // slow swell
    const lfoGain = c.createGain();
    lfoGain.gain.value = 0.35;
    lfo.connect(lfoGain);
    lfoGain.connect(g.gain);
    osc.connect(g);
    g.connect(master as GainNode);
    osc.start();
    lfo.start();
    return { osc, lfo };
  });
  running = true;
}

export function stopAmbient(): void {
  for (const v of voices) {
    try {
      v.osc.stop();
      v.lfo.stop();
    } catch {
      /* already stopped */
    }
  }
  voices = [];
  running = false;
}
