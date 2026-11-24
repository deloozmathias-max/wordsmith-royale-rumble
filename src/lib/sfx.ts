// Tiny synthesized sound effects (Web Audio, no files). Failures are silent.
let ctx: AudioContext | null = null;
function ac(): AudioContext | null {
  try {
    if (!ctx) {
      const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!C) return null;
      ctx = new C();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}
function tone(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.15, delay = 0) {
  const c = ac();
  if (!c) return;
  try {
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur);
  } catch {
    /* ignore */
  }
}
export const sfx = {
  tick: (last: boolean) => tone(last ? 1200 : 900, 0.06, "square", 0.06),
  lock: () => { tone(660, 0.12, "triangle"); tone(990, 0.18, "triangle", 0.15, 0.08); },
  error: () => { tone(160, 0.25, "sawtooth", 0.12); tone(120, 0.3, "sawtooth", 0.1, 0.05); },
  fanfare: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.35, "triangle", 0.15, i * 0.13)),
};
