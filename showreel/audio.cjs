// Procedural soundtrack, 120 BPM, synced to the reel's timeline. Writes reel.wav (48k stereo 16-bit).
const fs = require('fs');
const SR = 48000, DUR = 15, N = SR * DUR;
const L = new Float32Array(N), R = new Float32Array(N);
const SL = new Float32Array(N), SR_ = new Float32Array(N); // reverb send
let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const TAU = Math.PI * 2;
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

function put(t0, len, fn, { gain = 1, pan = 0, send = 0 } = {}) {
  const s0 = Math.floor(t0 * SR), n = Math.floor(len * SR);
  const gl = gain * Math.cos((pan + 1) * Math.PI / 4), gr = gain * Math.sin((pan + 1) * Math.PI / 4);
  const st = {};
  for (let i = 0; i < n; i++) {
    const k = s0 + i; if (k < 0 || k >= N) continue;
    const v = fn(i / SR, st);
    L[k] += v * gl; R[k] += v * gr;
    if (send) { SL[k] += v * gl * send; SR_[k] += v * gr * send; }
  }
}
const lp = (st, key, x, a) => (st[key] = (st[key] || 0) + a * (x - (st[key] || 0)));

// ── instruments ──
const kick = (t0, g = 1) => put(t0, .45, (t, st) => {
  st.ph = (st.ph || 0) + TAU * (45 + 110 * Math.exp(-t * 28)) / SR;
  return Math.tanh(1.6 * Math.sin(st.ph) * Math.exp(-t * 7)) + (t < .004 ? (rnd() - .5) * .6 : 0);
}, { gain: .9 * g });
const clap = (t0, g = 1) => put(t0, .3, (t, st) => {
  const env = (t < .03 ? Math.exp(-((t * 100) % 1) * 4) : 1) * Math.exp(-t * 16);
  const n = rnd() * 2 - 1; const hp = n - lp(st, 'l', n, .25);
  return lp(st, 'b', hp, .5) * env;
}, { gain: .5 * g, send: .35 });
const hat = (t0, g = 1, open = false) => put(t0, open ? .22 : .06, (t, st) => {
  const n = rnd() * 2 - 1; return (n - lp(st, 'l', n, .6)) * Math.exp(-t * (open ? 16 : 70));
}, { gain: .22 * g, pan: .25 });
const bass = (t0, len, m, g = 1) => put(t0, len, (t, st) => {
  const f = mtof(m); st.p = (st.p || 0) + f / SR; const saw = 2 * (st.p % 1) - 1;
  const env = Math.min(1, t * 200) * Math.exp(-t * 3.5) * Math.min(1, (len - t) * 60);
  const sub = Math.sin(TAU * st.p);
  return (lp(st, 'f', saw, .03 + .1 * Math.exp(-t * 14)) * .8 + sub * .6) * env;
}, { gain: .55 * g });
const pad = (t0, len, notes, g = 1) => notes.forEach((m, j) => [-.08, .08].forEach((dt, d) => put(t0, len, (t, st) => {
  const f = mtof(m) * (1 + dt * .01); st.p = (st.p || 0) + f / SR; const saw = 2 * (st.p % 1) - 1;
  const env = Math.min(1, t / .25) * Math.min(1, (len - t) / .4);
  return lp(st, 'f', saw, .025) * env;
}, { gain: .07 * g, pan: d ? .5 : -.5, send: .5 })));
const pluck = (t0, m, g = 1, pan = 0, sq = false) => put(t0, .5, (t, st) => {
  const f = mtof(m); st.p = (st.p || 0) + f / SR;
  const w = sq ? ((st.p % 1) < .5 ? 1 : -1) : Math.sin(TAU * st.p) + .3 * Math.sin(TAU * 2 * st.p);
  return lp(st, 'f', w, sq ? .35 : .5) * Math.exp(-t * (sq ? 14 : 9));
}, { gain: .3 * g, pan, send: .3 });
const whoosh = (t0, len, g = 1, up = true, pan = 0) => put(t0, len, (t, st) => {
  const x = t / len, env = Math.sin(Math.PI * Math.pow(x, up ? .7 : .3)) ** 2;
  const n = rnd() * 2 - 1, a = up ? .02 + .5 * x * x : .5 - .45 * x;
  const b = lp(st, 'a', n, a); return (b - lp(st, 'b', b, a * .3)) * env * 3;
}, { gain: .55 * g, pan, send: .4 });
const boom = (t0, g = 1) => {
  put(t0, 2.2, (t, st) => { st.ph = (st.ph || 0) + TAU * (32 + 80 * Math.exp(-t * 9)) / SR; return Math.tanh(2 * Math.sin(st.ph)) * Math.exp(-t * 2.2); }, { gain: .9 * g });
  put(t0, 1.2, (t, st) => { const n = rnd() * 2 - 1; return lp(st, 'l', n, .08) * Math.exp(-t * 5); }, { gain: .9 * g, send: .8 });
};
const riser = (t0, len, g = 1) => {
  whoosh(t0, len, .9 * g, true);
  put(t0, len, (t, st) => { const x = t / len; st.p = (st.p || 0) + (220 * Math.pow(4, x)) / SR; return Math.sin(TAU * st.p) * x * x * .5 * (1 + .3 * Math.sin(TAU * 14 * t)); }, { gain: .35 * g, send: .5 });
};
const tick = (t0, g = 1, pan = 0, f = 3000) => put(t0, .03, (t, st) => { st.p = (st.p || 0) + f / SR; return Math.sin(TAU * st.p) * Math.exp(-t * 260); }, { gain: .35 * g, pan });
const chip = (t0, len, f0, f1, g = 1) => put(t0, len, (t, st) => { const x = t / len; st.p = (st.p || 0) + (f0 * Math.pow(f1 / f0, x)) / SR; return ((st.p % 1) < .5 ? 1 : -1) * (1 - x); }, { gain: .16 * g, send: .15 });
const scratch = (t0, len, g = 1) => put(t0, len, (t, st) => {
  const n = rnd() * 2 - 1, b = lp(st, 'a', n, .35); const hp = b - lp(st, 'b', b, .08);
  const trem = .55 + .45 * Math.sin(TAU * 22 * t); return hp * trem * Math.sin(Math.PI * t / len) * 2.2;
}, { gain: .4 * g, pan: -.2, send: .2 });

// ── score ──
const B = .5; // beat
// INTRO
pluck(0, 81, 1.2); pluck(0, 69, .8); kick(0, .6);
for (let k = 0; k < 3; k++) put(.03 + k * .1, 1.2, (t, st) => { st.p = (st.p || 0) + (1760 + k * 220) / SR; return Math.sin(TAU * st.p) * Math.exp(-t * 4) * .2; }, { pan: k - 1, send: .8 });
whoosh(.3, .32, .8, true); tick(.5, 1.4, 0, 1200);
for (let i = 0; i < 6; i++) tick(.55 + i * .045, .8, -.5 + i * .2, 2200 + i * 150);
kick(1.0, .9); clap(1.0, .8); bass(1.0, .45, 33);
for (let i = 0; i < 6; i++) tick(1.0 + i * .045, .7, .5 - i * .2, 1800 - i * 100);
riser(1.2, .8, 1.1);
// GROOVE 2.0 → 12.0
const roots = [45, 41, 36, 43, 45];         // A F C G A (bars of 2s)
const chords = [[57, 60, 64, 67], [53, 57, 60, 64], [48, 55, 60, 64], [55, 59, 62, 67], [57, 60, 64, 69]];
boom(2.0, .8);
for (let bar = 0; bar < 5; bar++) {
  const t0 = 2 + bar * 2;
  pad(t0, 2.05, chords[bar], 1);
  for (let b = 0; b < 4; b++) {
    const tb = t0 + b * B;
    kick(tb);
    if (b % 2 === 1) clap(tb);
    for (let s = 0; s < 4; s++) hat(tb + s * B / 4, s === 2 ? 1 : .45, s === 2 && b === 3);
    bass(tb, .22, roots[bar] - 12 + (b === 3 ? 7 : 0)); bass(tb + .25, .2, roots[bar] - (b % 2 ? 0 : 12));
  }
}
// kinetic type stabs (pentatonic climb)
[69, 72, 74, 76, 79, 81, 84, 72, 74, 76, 79, 81, 84, 88].forEach((m, i) => { const t = i < 7 ? 2.0 + i * .09 : 2.75 + (i - 7) * .09; pluck(t, m, .9, (i % 2 ? .4 : -.4)); pluck(t, m - 12, .45); });
for (let i = 0; i < 38; i++) tick(3.3 + i * .011, .22, .3, 4000); // typing
// transitions
whoosh(3.55, .45, 1, true); whoosh(3.92, .35, .7, false);
pluck(4.0, 76, .8); pluck(4.5, 79, .5, .3); for (let i = 0; i < 3; i++) chip(4.55 + i * .12, .06, 900, 1100, .5); // bubble dots
scratch(5.62, .45, 1.1); whoosh(5.6, .45, .5);
scratch(6.05, .3, .5); scratch(6.55, .45, .45); scratch(6.62, .3, .35);
[76, 79, 81, 84, 88, 91, 93].forEach((m, i) => pluck(7.7 + i * .06, m, .5, 0, true)); // pixel dissolve arp
chip(8.0, .3, 220, 880, 1.2);  // jump
kick(8.58, .5); chip(8.58, .08, 140, 80, 1);   // land
chip(9.12, .28, 330, 990, .9); chip(9.5, .08, 160, 90, .8);
for (let i = 0; i < 12; i++) chip(8.2 + i * .14, .04, 1400 + (i % 3) * 300, 1600, .25); // altimeter
whoosh(9.68, .45, 1.3, true); boom(10.1, .35);
for (let k = 0; k < 6; k++) tick(10.25 + k * .27 + .15, 1, .4, 2600); // reel clicks
put(10.72, 1.0, (t, st) => { const x = t; const f = 300 + 900 * (1 / (1 + Math.exp(-(x - .5) * 14))); st.p = (st.p || 0) + f / SR; return Math.sin(TAU * st.p) * .12 * Math.sin(Math.PI * x); }, { send: .4 }); // curve follower
// collapse → silence suck → end
whoosh(11.75, .62, 1.2, false);
put(11.9, .45, (t, st) => { const x = t / .45; st.p = (st.p || 0) + (800 * Math.pow(.1, x)) / SR; return Math.sin(TAU * st.p) * .3 * x; }, { send: .5 });
// END CARD
boom(12.36, 1.1); pluck(12.36, 57, 1); pluck(12.36, 69, .8);
whoosh(12.6, .3, .5, true);
pluck(12.86, 81, .9);  // hyphen pop
[0, 1, 2, 3, 4, 5, 6, 7].forEach(d => tick(12.92 + d * .055, .7, (d % 2 ? .5 : -.5), 1500 + d * 120));
pad(12.4, 2.6, [45, 57, 64, 69, 71, 76], 1.6);
bass(12.36, 2.4, 33, .8);
[81, 84, 88].forEach((m, i) => pluck(13.75 + i * .08, m, .6, i - 1));
put(13.5, 1.5, (t, st) => { st.p = (st.p || 0) + 2637 / SR; return Math.sin(TAU * st.p) * .06 * Math.exp(-t * 1.5) * (1 + Math.sin(TAU * 6 * t)) * .5; }, { send: 1 });

// ── reverb (Schroeder, per channel) ──
function reverb(inp, off) {
  const out = new Float32Array(N);
  const combs = [1557, 1617, 1491, 1422, 1277, 1356].map(d => ({ d: Math.round((d + off) * SR / 44100), buf: null, i: 0, f: 0 }));
  combs.forEach(c => c.buf = new Float32Array(c.d));
  const aps = [556, 441, 341].map(d => ({ d: Math.round((d + off) * SR / 44100), buf: null, i: 0 })); aps.forEach(a => a.buf = new Float32Array(a.d));
  for (let n = 0; n < N; n++) {
    let s = 0; const x = inp[n];
    for (const c of combs) { const y = c.buf[c.i]; c.f = y * .8 + c.f * .2; c.buf[c.i] = x + c.f * .84; c.i = (c.i + 1) % c.d; s += y; }
    s /= combs.length;
    for (const a of aps) { const b = a.buf[a.i]; const y = -s + b; a.buf[a.i] = s + b * .5; a.i = (a.i + 1) % a.d; s = y; }
    out[n] = s;
  }
  return out;
}
const RL = reverb(SL, 0), RR = reverb(SR_, 23);
// ── master ──
const buf = Buffer.alloc(44 + N * 4);
let peak = 0; const mL = new Float32Array(N), mR = new Float32Array(N);
for (let n = 0; n < N; n++) {
  const fade = Math.min(1, n / (SR * .005)) * Math.min(1, (N - n) / (SR * .35));
  mL[n] = Math.tanh((L[n] + RL[n] * .9) * .9) * fade; mR[n] = Math.tanh((R[n] + RR[n] * .9) * .9) * fade;
  peak = Math.max(peak, Math.abs(mL[n]), Math.abs(mR[n]));
}
const norm = .89 / peak;
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28);
buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
for (let n = 0; n < N; n++) { buf.writeInt16LE(Math.round(mL[n] * norm * 32767), 44 + n * 4); buf.writeInt16LE(Math.round(mR[n] * norm * 32767), 46 + n * 4); }
fs.writeFileSync(__dirname + '/reel.wav', buf);
console.log('peak', peak.toFixed(3), 'norm', norm.toFixed(3));
