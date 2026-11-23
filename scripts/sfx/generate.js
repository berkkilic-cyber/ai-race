#!/usr/bin/env node
/**
 * Procedural sound effects for AI Race: a tiny deterministic synth (oscillators, seeded
 * noise, envelopes, one-pole and biquad filters, pitch sweeps) that writes 16-bit mono
 * 44.1 kHz WAV files to assets/sfx/. Same code, same bytes: no randomness outside the
 * seeded generator, no clock.
 *
 *   npm run sfx                 # writes assets/sfx/*.wav and prints a level table
 *   node scripts/sfx/generate.js --check   # only prints the table (no writes)
 *
 * The look is "neon": short synth blips, clean, slightly retro-terminal. Every sound is
 * normalised to a -6 dBFS peak; loudness differences between cues are set at play time
 * (src/ui/feel/cues.ts), not baked in. docs/FEEL.md describes each recipe.
 */
/* global __dirname, Buffer */
const fs = require('node:fs');
const path = require('node:path');

const RATE = 44100;
const PEAK_DBFS = -6;
const OUT = path.join(__dirname, '..', '..', 'assets', 'sfx');

// ───────────────────────────── primitives ─────────────────────────────

/** mulberry32: small seeded PRNG for noise, so every run writes identical files. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TAU = Math.PI * 2;
const semis = (n) => Math.pow(2, n / 12);
/** Note name to Hz (A4 = 440). */
function hz(note) {
  const m = /^([A-G])(#|b)?(\d)$/.exec(note);
  const base = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return 440 * semis(base + (Number(m[3]) - 4) * 12);
}

function buffer(seconds) {
  return new Float64Array(Math.round(seconds * RATE));
}

/**
 * Adds an oscillator voice into `out`.
 * opts: type (sine|square|triangle|saw|pulse), f0, f1 (sweep target), sweep ('exp'|'lin'),
 * start, dur (s), gain, duty (pulse), attack, decay curve via env(), vibrato {rate, depth}.
 */
function osc(out, o) {
  const { type = 'sine', f0, f1 = f0, sweep = 'exp', start = 0, dur, gain = 1, duty = 0.5, attack = 0.002, release = 0.02, curve = 'exp', hold = 0, detune = 0, vibrato = null } = o;
  const s0 = Math.round(start * RATE);
  const n = Math.round(dur * RATE);
  let phase = 0;
  for (let i = 0; i < n && s0 + i < out.length; i++) {
    const t = i / RATE;
    const k = n > 1 ? i / (n - 1) : 0;
    let f = sweep === 'exp' ? f0 * Math.pow(f1 / f0, k) : f0 + (f1 - f0) * k;
    if (vibrato) f *= 1 + vibrato.depth * Math.sin(TAU * vibrato.rate * t);
    f *= semis(detune / 100);
    phase += f / RATE;
    const p = phase - Math.floor(phase);
    let v;
    switch (type) {
      case 'square':
        v = p < 0.5 ? 1 : -1;
        break;
      case 'pulse':
        v = p < duty ? 1 : -1;
        break;
      case 'triangle':
        v = 4 * Math.abs(p - 0.5) - 1;
        break;
      case 'saw':
        v = 2 * p - 1;
        break;
      default:
        v = Math.sin(TAU * p);
    }
    out[s0 + i] += v * gain * env(t, dur, { attack, release, curve, hold });
  }
}

/**
 * Amplitude envelope: linear attack, then either an exponential decay to the end ('exp'),
 * a sustained plateau with a short release ('flat'), or a linear fall ('lin'). `hold`
 * keeps the level up for that long before an 'exp' decay starts.
 */
function env(t, dur, { attack, release, curve, hold }) {
  if (t < attack) return t / attack;
  const tail = dur - t;
  const rel = tail < release ? Math.max(0, tail / release) : 1;
  if (curve === 'flat') return rel;
  if (curve === 'lin') return Math.max(0, 1 - (t - attack) / (dur - attack)) * rel;
  const td = Math.max(0, t - attack - hold);
  return Math.exp((-5 * td) / Math.max(1e-3, dur - attack - hold)) * rel;
}

/** Seeded white noise burst. */
function noise(out, { start = 0, dur, gain = 1, seed = 1, attack = 0.001, release = 0.02, curve = 'exp', hold = 0 }) {
  const r = rng(seed);
  const s0 = Math.round(start * RATE);
  const n = Math.round(dur * RATE);
  for (let i = 0; i < n && s0 + i < out.length; i++) {
    out[s0 + i] += (r() * 2 - 1) * gain * env(i / RATE, dur, { attack, release, curve, hold });
  }
}

/** RBJ biquad (low/high/band pass) applied in place, optionally sweeping the cutoff exponentially. */
function biquad(buf, { type = 'lowpass', f0, f1 = f0, q = 0.707, start = 0, dur = buf.length / RATE }) {
  const s0 = Math.round(start * RATE);
  const n = Math.min(buf.length - s0, Math.round(dur * RATE));
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < n; i++) {
    const k = n > 1 ? i / (n - 1) : 0;
    const f = Math.min(RATE * 0.45, f0 * Math.pow(f1 / f0, k));
    const w = (TAU * f) / RATE;
    const cw = Math.cos(w);
    const alpha = Math.sin(w) / (2 * q);
    let b0;
    let b1;
    let b2;
    if (type === 'highpass') {
      b0 = (1 + cw) / 2;
      b1 = -(1 + cw);
      b2 = (1 + cw) / 2;
    } else if (type === 'bandpass') {
      b0 = alpha;
      b1 = 0;
      b2 = -alpha;
    } else {
      b0 = (1 - cw) / 2;
      b1 = 1 - cw;
      b2 = (1 - cw) / 2;
    }
    const a0 = 1 + alpha;
    const a1 = -2 * cw;
    const a2 = 1 - alpha;
    const x = buf[s0 + i];
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    buf[s0 + i] = y;
  }
  return buf;
}

/** Feedback delay (a short slap echo for the "terminal room" tail). */
function echo(buf, { time = 0.06, feedback = 0.3, mix = 0.3 }) {
  const d = Math.round(time * RATE);
  const out = Float64Array.from(buf);
  for (let i = d; i < out.length; i++) out[i] += out[i - d] * feedback;
  for (let i = 0; i < buf.length; i++) buf[i] = buf[i] * (1 - mix) + out[i] * mix;
  return buf;
}

/** Fades the first and last few ms so no file starts or ends on a click. */
function edges(buf, inMs = 1, outMs = 6) {
  const a = Math.round((inMs / 1000) * RATE);
  const b = Math.round((outMs / 1000) * RATE);
  for (let i = 0; i < a && i < buf.length; i++) buf[i] *= i / a;
  for (let i = 0; i < b && i < buf.length; i++) buf[buf.length - 1 - i] *= i / b;
  return buf;
}

/** Normalises the peak to PEAK_DBFS after removing DC (a gentle 30 Hz high pass). */
function master(buf) {
  biquad(buf, { type: 'highpass', f0: 30 });
  edges(buf);
  let peak = 0;
  for (const v of buf) peak = Math.max(peak, Math.abs(v));
  const target = Math.pow(10, PEAK_DBFS / 20);
  const g = peak > 0 ? target / peak : 0;
  for (let i = 0; i < buf.length; i++) buf[i] *= g;
  return buf;
}

// ───────────────────────────── recipes ─────────────────────────────

/** name -> () => Float64Array. Keep in step with src/ui/feel/sounds.ts and docs/FEEL.md. */
const SOUNDS = {
  // UI: a crisp 2.2 kHz pulse blip with a click of filtered noise on the attack.
  'ui-tap': () => {
    const b = buffer(0.045);
    osc(b, { type: 'pulse', duty: 0.25, f0: 2200, f1: 1900, dur: 0.045, gain: 0.6, attack: 0.001 });
    noise(b, { dur: 0.006, gain: 0.25, seed: 11 });
    return biquad(b, { f0: 6000 });
  },
  // Back / close: two falling triangle steps.
  'ui-back': () => {
    const b = buffer(0.08);
    osc(b, { type: 'triangle', f0: 1320, dur: 0.035, gain: 0.8 });
    osc(b, { type: 'triangle', f0: 880, start: 0.035, dur: 0.045, gain: 0.8 });
    return biquad(b, { f0: 5000 });
  },
  // Tab switch: a short upward square chirp, low passed.
  tab: () => {
    const b = buffer(0.055);
    osc(b, { type: 'square', f0: 1200, f1: 1800, dur: 0.055, gain: 0.5 });
    return biquad(b, { f0: 3500 });
  },
  // Buy: two rising pulse notes (a fifth), confident and short.
  buy: () => {
    const b = buffer(0.15);
    osc(b, { type: 'pulse', duty: 0.25, f0: hz('E6'), dur: 0.06, gain: 0.6, curve: 'flat', release: 0.01 });
    osc(b, { type: 'pulse', duty: 0.25, f0: hz('B6'), start: 0.055, dur: 0.095, gain: 0.6 });
    return biquad(b, { f0: 7000 });
  },
  // Cannot afford: a soft low double bump (triangle), no harshness.
  deny: () => {
    const b = buffer(0.16);
    osc(b, { type: 'triangle', f0: 233, f1: 207, dur: 0.07, gain: 0.9 });
    osc(b, { type: 'triangle', f0: 207, f1: 185, start: 0.08, dur: 0.08, gain: 0.9 });
    return biquad(b, { f0: 1600 });
  },
  // Region launch: a rising saw sweep through an opening filter, over a noise whoosh.
  'region-launch': () => {
    const b = buffer(0.27);
    osc(b, { type: 'saw', f0: 330, f1: 1320, dur: 0.24, gain: 0.5, curve: 'lin', attack: 0.01 });
    noise(b, { dur: 0.27, gain: 0.25, seed: 21, attack: 0.08, curve: 'lin' });
    biquad(b, { f0: 600, f1: 6000, q: 1.2 });
    return echo(b, { time: 0.045, feedback: 0.25, mix: 0.25 });
  },
  // Data centre built: a low sine thunk, a metallic click and a short powered-up hum chord.
  'datacentre-built': () => {
    const b = buffer(0.3);
    osc(b, { type: 'sine', f0: 160, f1: 60, dur: 0.12, gain: 1 });
    noise(b, { dur: 0.012, gain: 0.5, seed: 31 });
    biquad(b, { f0: 3000 });
    const h = buffer(0.3);
    osc(h, { type: 'square', f0: hz('A3'), start: 0.07, dur: 0.23, gain: 0.25, attack: 0.02 });
    osc(h, { type: 'square', f0: hz('E4'), start: 0.07, dur: 0.23, gain: 0.2, attack: 0.02 });
    biquad(h, { f0: 900 });
    for (let i = 0; i < b.length; i++) b[i] += h[i];
    return b;
  },
  // Model launch: a quick rising arpeggio (C E G C) in detuned pulses, the top note held.
  'model-launch': () => {
    const b = buffer(0.62);
    const notes = ['C5', 'E5', 'G5', 'C6'];
    notes.forEach((n, i) => {
      const last = i === notes.length - 1;
      const dur = last ? 0.38 : 0.09;
      osc(b, { type: 'pulse', duty: 0.3, f0: hz(n), start: i * 0.075, dur, gain: 0.45, hold: last ? 0.1 : 0, curve: last ? 'exp' : 'flat', release: 0.015 });
      osc(b, { type: 'pulse', duty: 0.3, f0: hz(n), start: i * 0.075, dur, gain: 0.3, detune: 9, hold: last ? 0.1 : 0, curve: last ? 'exp' : 'flat', release: 0.015 });
    });
    biquad(b, { f0: 6500 });
    return echo(b, { time: 0.09, feedback: 0.3, mix: 0.25 });
  },
  // Event card: a teletype rattle (three noise clicks) then a two-tone alert.
  'event-open': () => {
    const b = buffer(0.26);
    for (let i = 0; i < 3; i++) noise(b, { start: i * 0.022, dur: 0.008, gain: 0.5, seed: 41 + i });
    biquad(b, { type: 'bandpass', f0: 3200, q: 2 });
    osc(b, { type: 'square', f0: hz('A5'), start: 0.07, dur: 0.07, gain: 0.35, curve: 'flat', release: 0.01 });
    osc(b, { type: 'square', f0: hz('D6'), start: 0.14, dur: 0.12, gain: 0.35 });
    return biquad(b, { f0: 5000 });
  },
  // Event choice confirmed: a stamp (noise thud) under a short major blip.
  'event-confirm': () => {
    const b = buffer(0.16);
    noise(b, { dur: 0.03, gain: 0.6, seed: 51 });
    biquad(b, { f0: 900 });
    osc(b, { type: 'sine', f0: 120, f1: 70, dur: 0.06, gain: 0.7 });
    osc(b, { type: 'triangle', f0: hz('G5'), start: 0.02, dur: 0.14, gain: 0.5 });
    osc(b, { type: 'triangle', f0: hz('D6'), start: 0.02, dur: 0.14, gain: 0.3 });
    return b;
  },
  // Moment (boost) collected: a fast sparkly triad up, triangle with a slap echo.
  'moment-boost': () => {
    const b = buffer(0.2);
    ['E6', 'G#6', 'B6'].forEach((n, i) => osc(b, { type: 'triangle', f0: hz(n), start: i * 0.04, dur: 0.08, gain: 0.6 }));
    return echo(b, { time: 0.035, feedback: 0.3, mix: 0.3 });
  },
  // Moment (threat averted): a shield "fwump": sine falling with filtered noise, then a clean tick.
  'moment-averted': () => {
    const b = buffer(0.21);
    osc(b, { type: 'sine', f0: 700, f1: 250, dur: 0.14, gain: 0.8 });
    noise(b, { dur: 0.12, gain: 0.3, seed: 61 });
    biquad(b, { f0: 2500, f1: 600 });
    osc(b, { type: 'triangle', f0: hz('A5'), start: 0.13, dur: 0.08, gain: 0.5 });
    return b;
  },
  // Rival launch: a low two-tone warning (saw, alternating), filtered so it never shrieks.
  'rival-launch': () => {
    const b = buffer(0.36);
    [0, 1, 2, 3].forEach((i) => osc(b, { type: 'saw', f0: i % 2 ? 311 : 415, start: i * 0.085, dur: 0.09, gain: 0.5, curve: 'flat', release: 0.015 }));
    return biquad(b, { f0: 1400, q: 1.5 });
  },
  // Meter warning: a pulsing low square buzz (tremolo) that swells and cuts.
  'meter-warning': () => {
    const b = buffer(0.3);
    osc(b, { type: 'square', f0: 196, dur: 0.3, gain: 0.5, curve: 'flat', attack: 0.01, release: 0.04 });
    for (let i = 0; i < b.length; i++) b[i] *= 0.55 + 0.45 * Math.sign(Math.sin((TAU * 16 * i) / RATE));
    biquad(b, { f0: 1100 });
    return biquad(b, { type: 'highpass', f0: 120 });
  },
  // Win: rising major arpeggio into a held, slightly detuned chord with a short echo.
  'win-sting': () => {
    const b = buffer(0.9);
    ['C5', 'E5', 'G5', 'C6', 'E6'].forEach((n, i) => osc(b, { type: 'pulse', duty: 0.3, f0: hz(n), start: i * 0.07, dur: 0.12, gain: 0.4, curve: 'flat', release: 0.02 }));
    for (const [n, d] of [['C5', 0], ['E5', 6], ['G5', -6], ['C6', 4]]) osc(b, { type: 'saw', f0: hz(n), start: 0.35, dur: 0.55, gain: 0.18, detune: d, attack: 0.02, hold: 0.15 });
    biquad(b, { f0: 5000 });
    return echo(b, { time: 0.11, feedback: 0.3, mix: 0.25 });
  },
  // Lose: a falling minor arpeggio, its last note drooping in pitch, through a closing filter.
  'lose-sting': () => {
    const b = buffer(0.9);
    ['E5', 'C5', 'A4'].forEach((n, i) => osc(b, { type: 'pulse', duty: 0.4, f0: hz(n), start: i * 0.12, dur: 0.14, gain: 0.45, curve: 'flat', release: 0.02 }));
    osc(b, { type: 'saw', f0: hz('E4'), f1: hz('E4') * semis(-5), start: 0.36, dur: 0.54, gain: 0.35, attack: 0.01, hold: 0.1 });
    osc(b, { type: 'saw', f0: hz('A3'), f1: hz('A3') * semis(-5), start: 0.36, dur: 0.54, gain: 0.25, attack: 0.01, hold: 0.1, detune: 8 });
    return biquad(b, { f0: 4000, f1: 700 });
  },
  // Achievement: a bell (sine partials, inharmonic upper partial) on two notes.
  achievement: () => {
    const b = buffer(0.46);
    for (const [n, s] of [['B5', 0], ['E6', 0.09]]) {
      const f = hz(n);
      osc(b, { type: 'sine', f0: f, start: s, dur: 0.37, gain: 0.6 });
      osc(b, { type: 'sine', f0: f * 2.76, start: s, dur: 0.18, gain: 0.2 });
      osc(b, { type: 'sine', f0: f * 5.4, start: s, dur: 0.08, gain: 0.1 });
    }
    return echo(b, { time: 0.07, feedback: 0.25, mix: 0.2 });
  },
  // Garage tap: a very short soft triangle blip (pitch is varied at play time).
  'garage-tap': () => {
    const b = buffer(0.03);
    osc(b, { type: 'triangle', f0: 1050, f1: 900, dur: 0.03, gain: 0.8, attack: 0.001 });
    noise(b, { dur: 0.004, gain: 0.15, seed: 71 });
    return biquad(b, { f0: 4500 });
  },
  // Garage buy: a coin-ish square double blip, a fourth apart.
  'garage-buy': () => {
    const b = buffer(0.12);
    osc(b, { type: 'square', f0: hz('B5'), dur: 0.045, gain: 0.45, curve: 'flat', release: 0.008 });
    osc(b, { type: 'square', f0: hz('E6'), start: 0.04, dur: 0.08, gain: 0.45 });
    return biquad(b, { f0: 5000 });
  },
  // Garage golden moment: a shimmering upward run of triangle notes with an echo trail.
  'garage-golden': () => {
    const b = buffer(0.42);
    ['C6', 'E6', 'G6', 'C7', 'E7'].forEach((n, i) => osc(b, { type: 'triangle', f0: hz(n), start: i * 0.04, dur: 0.12, gain: 0.5, vibrato: { rate: 18, depth: 0.004 } }));
    return echo(b, { time: 0.06, feedback: 0.4, mix: 0.35 });
  },
  // Garage ship: a rocket (noise through a rising band pass) under a rising sweep, ending on a chord.
  'garage-ship': () => {
    const b = buffer(0.7);
    noise(b, { dur: 0.5, gain: 0.5, seed: 81, attack: 0.05, curve: 'lin' });
    biquad(b, { type: 'bandpass', f0: 400, f1: 3500, q: 1.5, dur: 0.5 });
    osc(b, { type: 'saw', f0: 200, f1: 800, dur: 0.4, gain: 0.25, curve: 'lin', attack: 0.02 });
    for (const n of ['G5', 'B5', 'D6']) osc(b, { type: 'pulse', duty: 0.3, f0: hz(n), start: 0.38, dur: 0.32, gain: 0.25 });
    biquad(b, { f0: 6000 });
    return echo(b, { time: 0.08, feedback: 0.25, mix: 0.2 });
  },

  // ── the Garage lab (task 28) ──
  // Stage unlocked: the place changes. A roll-up door rattles open (noise through a rising
  // band pass with a slat flutter), a low thump lands, then a wide major chord blooms with echo.
  'garage-stage': () => {
    const b = buffer(0.56);
    noise(b, { dur: 0.26, gain: 0.45, seed: 91, attack: 0.03, curve: 'lin' });
    for (let i = 0; i < Math.round(0.26 * RATE); i++) b[i] *= 0.6 + 0.4 * Math.sign(Math.sin((TAU * 28 * i) / RATE));
    biquad(b, { type: 'bandpass', f0: 500, f1: 2600, q: 1.4, dur: 0.26 });
    osc(b, { type: 'sine', f0: 140, f1: 55, start: 0.24, dur: 0.14, gain: 0.9 });
    for (const [n, d] of [['D5', 0], ['F#5', 5], ['A5', -5], ['D6', 3]]) osc(b, { type: 'pulse', duty: 0.3, f0: hz(n), start: 0.26, dur: 0.3, gain: 0.2, detune: d, attack: 0.015, hold: 0.06 });
    osc(b, { type: 'triangle', f0: hz('A6'), start: 0.32, dur: 0.24, gain: 0.25, vibrato: { rate: 9, depth: 0.004 } });
    biquad(b, { f0: 6500 });
    return echo(b, { time: 0.08, feedback: 0.3, mix: 0.25 });
  },
  // Training run ready: a soft two-note "ding-dong" (sine with a quiet octave), gentle.
  'training-ready': () => {
    const b = buffer(0.18);
    osc(b, { type: 'sine', f0: hz('G5'), dur: 0.09, gain: 0.6 });
    osc(b, { type: 'sine', f0: hz('G6'), dur: 0.05, gain: 0.12 });
    osc(b, { type: 'sine', f0: hz('D6'), start: 0.07, dur: 0.11, gain: 0.6 });
    return echo(b, { time: 0.04, feedback: 0.2, mix: 0.2 });
  },
  // Candidates revealed: three quick card flips (noise ticks) each with a rising blip.
  'training-reveal': () => {
    const b = buffer(0.24);
    ['C6', 'E6', 'A6'].forEach((n, i) => {
      noise(b, { start: i * 0.065, dur: 0.01, gain: 0.35, seed: 101 + i });
      osc(b, { type: 'pulse', duty: 0.25, f0: hz(n), start: i * 0.065 + 0.005, dur: 0.06, gain: 0.4 });
    });
    biquad(b, { f0: 6000 });
    return echo(b, { time: 0.05, feedback: 0.25, mix: 0.2 });
  },
  // Candidate kept: a "slot in" click (short sine thunk) and an upward fifth, confident.
  'model-keep': () => {
    const b = buffer(0.18);
    osc(b, { type: 'sine', f0: 220, f1: 110, dur: 0.04, gain: 0.8 });
    noise(b, { dur: 0.006, gain: 0.4, seed: 111 });
    osc(b, { type: 'square', f0: hz('D6'), start: 0.035, dur: 0.05, gain: 0.3, curve: 'flat', release: 0.008 });
    osc(b, { type: 'square', f0: hz('A6'), start: 0.08, dur: 0.1, gain: 0.3 });
    return biquad(b, { f0: 5000 });
  },
  // Candidates scrapped: a paper "fwip" (noise with a falling band pass) and a low falling blip.
  'model-scrap': () => {
    const b = buffer(0.18);
    noise(b, { dur: 0.12, gain: 0.5, seed: 121, attack: 0.01 });
    biquad(b, { type: 'bandpass', f0: 3500, f1: 700, q: 1.2, dur: 0.12 });
    osc(b, { type: 'triangle', f0: 520, f1: 260, start: 0.05, dur: 0.13, gain: 0.5 });
    return biquad(b, { f0: 4000 });
  },
  // Staff moved: a tiny wooden tick (band-passed click with a short triangle tap).
  'staff-move': () => {
    const b = buffer(0.045);
    noise(b, { dur: 0.004, gain: 0.5, seed: 131 });
    biquad(b, { type: 'bandpass', f0: 1800, q: 3 });
    osc(b, { type: 'triangle', f0: 1400, f1: 1250, dur: 0.04, gain: 0.5 });
    return b;
  },
  // A lab happening appears: a very soft high "bloop" (sine up), played quietly.
  'happening-pop': () => {
    const b = buffer(0.08);
    osc(b, { type: 'sine', f0: 700, f1: 1400, dur: 0.08, gain: 0.7, attack: 0.006 });
    return biquad(b, { f0: 3000 });
  },
  // A happening slipped away: a soft low falling two-step, muted.
  'happening-miss': () => {
    const b = buffer(0.14);
    osc(b, { type: 'triangle', f0: 392, f1: 349, dur: 0.06, gain: 0.7 });
    osc(b, { type: 'triangle', f0: 330, f1: 262, start: 0.06, dur: 0.08, gain: 0.6 });
    return biquad(b, { f0: 1400 });
  },
  // Milestone on a tier: a quick upward "level up" (four pulse steps) capped by a bell partial.
  milestone: () => {
    const b = buffer(0.23);
    ['E5', 'A5', 'C#6', 'E6'].forEach((n, i) => osc(b, { type: 'pulse', duty: 0.3, f0: hz(n), start: i * 0.035, dur: 0.05, gain: 0.35, curve: 'flat', release: 0.008 }));
    osc(b, { type: 'sine', f0: hz('A6'), start: 0.13, dur: 0.1, gain: 0.5 });
    osc(b, { type: 'sine', f0: hz('A6') * 2.76, start: 0.13, dur: 0.06, gain: 0.12 });
    return biquad(b, { f0: 7000 });
  },
  // Ship day, benchmark reveal: a leaderboard "ticker" climbing (fast square steps up) into a held note.
  'shipday-reveal': () => {
    const b = buffer(0.36);
    for (let i = 0; i < 8; i++) osc(b, { type: 'square', f0: hz('A4') * semis(i * 2), start: i * 0.03, dur: 0.028, gain: 0.25, curve: 'flat', release: 0.005 });
    osc(b, { type: 'pulse', duty: 0.3, f0: hz('E6'), start: 0.24, dur: 0.12, gain: 0.35 });
    osc(b, { type: 'pulse', duty: 0.3, f0: hz('E6'), start: 0.24, dur: 0.12, gain: 0.2, detune: 8 });
    return biquad(b, { f0: 5000 });
  },
  // Ship day, headline: the press. A heavy thud with paper noise, then a brassy two-note fanfare.
  'shipday-press': () => {
    const b = buffer(0.28);
    osc(b, { type: 'sine', f0: 110, f1: 50, dur: 0.1, gain: 1 });
    noise(b, { dur: 0.05, gain: 0.5, seed: 141 });
    biquad(b, { f0: 1600 });
    osc(b, { type: 'saw', f0: hz('C5'), start: 0.08, dur: 0.08, gain: 0.25, curve: 'flat', release: 0.01 });
    osc(b, { type: 'saw', f0: hz('G5'), start: 0.16, dur: 0.12, gain: 0.25 });
    return biquad(b, { f0: 3500 });
  },
  // Bonus multiplied: a cash-register "ka-ching" (noise tick, then a bright bell pair rising).
  'bonus-multiply': () => {
    const b = buffer(0.28);
    noise(b, { dur: 0.02, gain: 0.5, seed: 151 });
    biquad(b, { type: 'highpass', f0: 2500 });
    for (const [n, s] of [['E6', 0.02], ['B6', 0.08]]) {
      osc(b, { type: 'sine', f0: hz(n), start: s, dur: 0.2, gain: 0.55 });
      osc(b, { type: 'sine', f0: hz(n) * 2.76, start: s, dur: 0.08, gain: 0.15 });
    }
    osc(b, { type: 'triangle', f0: hz('E7'), start: 0.14, dur: 0.12, gain: 0.25, vibrato: { rate: 16, depth: 0.004 } });
    return echo(b, { time: 0.05, feedback: 0.3, mix: 0.25 });
  },
  // A helper collected something: a barely-there soft tick (played very quietly and rarely).
  'helper-tick': () => {
    const b = buffer(0.05);
    osc(b, { type: 'sine', f0: 1600, f1: 1500, dur: 0.05, gain: 0.6, attack: 0.004 });
    return biquad(b, { f0: 2500 });
  },
};

// ───────────────────────────── WAV I/O and levels ─────────────────────────────

function toWav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    data.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(1, 22); // mono
  h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

/** Reads a 16-bit mono WAV written by toWav back into levels (independent check of the files). */
function levels(file) {
  const buf = fs.readFileSync(file);
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') throw new Error(`${file}: not a WAV`);
  const channels = buf.readUInt16LE(22);
  const rate = buf.readUInt32LE(24);
  const bits = buf.readUInt16LE(34);
  const len = buf.readUInt32LE(40);
  const n = len / 2;
  let peak = 0;
  let sum = 0;
  let clipped = 0;
  for (let i = 0; i < n; i++) {
    const s = buf.readInt16LE(44 + i * 2);
    const v = Math.abs(s) / 32768;
    if (Math.abs(s) >= 32767) clipped++;
    peak = Math.max(peak, v);
    sum += v * v;
  }
  const rms = Math.sqrt(sum / Math.max(1, n));
  const db = (x) => (x > 0 ? 20 * Math.log10(x) : -Infinity);
  return { channels, rate, bits, ms: (n / rate) * 1000, peakDb: db(peak), rmsDb: db(rms), clipped, bytes: buf.length };
}

function main() {
  const checkOnly = process.argv.includes('--check');
  if (!checkOnly) {
    fs.mkdirSync(OUT, { recursive: true });
    for (const f of fs.readdirSync(OUT)) if (f.endsWith('.wav') && !(f.slice(0, -4) in SOUNDS)) fs.unlinkSync(path.join(OUT, f));
    for (const [name, make] of Object.entries(SOUNDS)) fs.writeFileSync(path.join(OUT, `${name}.wav`), toWav(master(make())));
  }
  let total = 0;
  let bad = 0;
  console.log('sound              ms    peak dBFS  rms dBFS  bytes   check');
  for (const name of Object.keys(SOUNDS)) {
    const l = levels(path.join(OUT, `${name}.wav`));
    total += l.bytes;
    const problems = [];
    if (l.channels !== 1 || l.rate !== RATE || l.bits !== 16) problems.push('format');
    if (l.clipped > 0) problems.push(`clipped ${l.clipped}`);
    if (l.peakDb > -5.5 || l.peakDb < -6.5) problems.push('peak');
    if (l.rmsDb < -40) problems.push('near silent');
    if (problems.length) bad++;
    console.log(`${name.padEnd(18)} ${l.ms.toFixed(0).padStart(4)}  ${l.peakDb.toFixed(1).padStart(9)}  ${l.rmsDb.toFixed(1).padStart(8)}  ${String(l.bytes).padStart(6)}  ${problems.join(', ') || 'ok'}`);
  }
  console.log(`${Object.keys(SOUNDS).length} sounds, ${(total / 1024).toFixed(0)} KB total${total > 900 * 1024 ? ' (OVER 900 KB)' : ''}`);
  if (bad || total > 900 * 1024) process.exitCode = 1;
}

module.exports = { SOUNDS, levels };
if (require.main === module) main();
