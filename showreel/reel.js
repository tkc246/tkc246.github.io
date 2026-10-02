'use strict';
// ───────────────────────── tkc-works SHOWREEL 2026 (v2: atelier edition) ─────────────────────────
// 15s / 1920x1080 / 60fps. Fully deterministic: render(t) is a pure function of time.
// World: the renewed tkc-works.net — a dark atelier lit by warm lamps, brass plates, cream type.
const W = 1920, H = 1080, FPS = 60, DUR = 15, CX = W / 2, CY = H / 2, TAU = Math.PI * 2;
const QS = new URLSearchParams(location.search);
const SUB = +(QS.get('sub') || 5);      // motion-blur sub-samples
const SHUTTER = 0.5;                    // 180° shutter

const cv = document.getElementById('c'), out = cv.getContext('2d');
const mk = (w = W, h = H) => { const k = document.createElement('canvas'); k.width = w; k.height = h; return k; };
const sc = mk(), ctx = sc.getContext('2d');      // scene buffer
const sc2 = mk(), ctx2 = sc2.getContext('2d');   // "next scene" buffer for pattern transitions

const COL = {
  bg: '#34312C', bgTop: '#3D3934', bgDeep: '#1F1D1A', dark: '#26231F', night: '#161411',
  fg: '#F6F0E6', muted: '#B3A897', dim: '#82786A', line: 'rgba(255,236,210,0.12)',
  lamp: '#FFC879', amber: '#E8A55A', brass: '#CDA862', brassHi: '#EBD198', brassLo: '#8C6C34', wood: '#9A6236',
};
const FT = {
  en: '"Outfit", "Zen Kaku Gothic New", sans-serif', jp: '"Zen Kaku Gothic New", sans-serif', dot: '"DotGothic16", monospace',
};

// ───────── math ─────────
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const P = (t, a, b) => clamp((t - a) / (b - a));
const E = {
  outExpo: t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t),
  inExpo: t => t <= 0 ? 0 : Math.pow(2, 10 * t - 10),
  inOutExpo: t => t <= 0 ? 0 : t >= 1 ? 1 : t < .5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inCubic: t => t * t * t,
  inQuad: t => t * t,
  inOutCubic: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  inOutQuart: t => t < .5 ? 8 * t ** 4 : 1 - Math.pow(-2 * t + 2, 4) / 2,
  inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  inBack: (t, s = 1.70158) => (s + 1) * t * t * t - s * t * t,
};
function rng(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const h2 = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };
// lamp flicker: mostly steady, with occasional dips (deterministic in t)
const flick = (t, seed) => { const k = Math.floor(t * 18 + seed * 7); const d = h2(k, seed) < .1 ? .55 : 1; return d * (.88 + .12 * Math.sin(t * 9 + seed * 3)); };

// ───────── drawing helpers ─────────
function setFont(c, w, s, f, ls = 0) { c.font = `${w} ${s}px ${f}`; c.letterSpacing = ls + 'px'; }
function layoutChars(c, str, sp = 0) {
  let x = 0; const a = [];
  for (const ch of str) { const w = c.measureText(ch).width; a.push({ ch, x, w }); x += w + sp; }
  return { chars: a, width: x - sp };
}
function rrect(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); }
function iconCard(c, img, x, y, size, o = {}) {
  const { rot = 0, sx = 1, sy = 1, alpha = 1, shadow = true, pixel = false } = o;
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(sx, sy); c.globalAlpha *= alpha;
  const r = size * .225, h = size / 2;
  if (shadow) {
    c.save(); c.shadowColor = 'rgba(0,0,0,0.55)'; c.shadowBlur = 70; c.shadowOffsetY = 34;
    c.fillStyle = '#111'; rrect(c, -h, -h, size, size, r); c.fill(); c.restore();
  }
  c.save(); rrect(c, -h, -h, size, size, r); c.clip();
  if (pixel) c.imageSmoothingEnabled = false;
  c.drawImage(img, -h, -h, size, size); c.restore();
  c.restore();
}
function polyCum(pts) { const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return cum; }
function strokePartial(c, pts, p, jit = 0, seed = 0) {
  if (p <= 0) return null;
  const cum = pts.cum || (pts.cum = polyCum(pts)); const L = cum[cum.length - 1] * clamp(p);
  const J = i => jit ? [(h2(i, seed) - .5) * jit, (h2(i + 99, seed) - .5) * jit] : [0, 0];
  c.beginPath(); let j = J(0); c.moveTo(pts[0][0] + j[0], pts[0][1] + j[1]);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    if (cum[i] <= L) { j = J(i); c.lineTo(b[0] + j[0], b[1] + j[1]); }
    else { const k = (L - cum[i - 1]) / (cum[i] - cum[i - 1] || 1); c.lineTo(lerp(a[0], b[0], k), lerp(a[1], b[1], k)); break; }
  }
  c.stroke();
}
// the atelier backdrop: warm gradient + a lamp glow somewhere
function atelierBg(c, gx = W * .78, gy = -H * .1, gk = 1) {
  const g = c.createLinearGradient(0, 0, W * .4, H); g.addColorStop(0, COL.bgTop); g.addColorStop(1, COL.dark);
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  lampGlow(c, gx, gy, 1000, .2 * gk);
}
function lampGlow(c, x, y, r, a) {
  if (a <= 0) return;
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(255,200,121,${a})`); g.addColorStop(1, 'rgba(255,200,121,0)');
  c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
}
// floating dust motes in lamplight
const MOTES = (() => { const r = rng(21); return Array.from({ length: 70 }, () => ({ x: r(), y: r(), s: .6 + r() * 2.2, v: .015 + r() * .04, ph: r() * TAU })); })();
function dust(c, t, a = 1) {
  for (const m of MOTES) {
    const y = ((m.y - t * m.v) % 1 + 1) % 1, x = m.x + Math.sin(t * .5 + m.ph) * .012;
    const al = (.18 + .3 * Math.max(0, Math.sin(t * 1.3 + m.ph))) * a;
    c.fillStyle = `rgba(255,214,160,${al})`; c.beginPath(); c.arc(x * W, y * H, m.s, 0, TAU); c.fill();
  }
}
// brass number plate ("No.01")
function brassPlate(c, x, y, txt, size = 22) {
  setFont(c, 800, size, FT.en, size * .08);
  const tw = c.measureText(txt).width, pw = tw + size * 1.1, ph = size * 1.7;
  const g = c.createLinearGradient(x, y, x + pw, y + ph); g.addColorStop(0, COL.brassHi); g.addColorStop(.45, COL.brass); g.addColorStop(1, COL.brassLo);
  c.save(); c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 14; c.shadowOffsetY = 6;
  c.fillStyle = g; rrect(c, x, y, pw, ph, size * .3); c.fill(); c.restore();
  c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(x + 4, y + 1, pw - 8, 1.5);
  c.fillStyle = '#2A2216'; c.fillText(txt, x + size * .55, y + ph * .5 + size * .36);
  return pw;
}

// ───────── assets ─────────
const IMG = {};
const loadImg = (k, src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => { IMG[k] = i; res(); }; i.onerror = rej; i.src = src; });
let DIO = null; // diorama with feathered edges
function makeDiorama() {
  const img = IMG.dio, w = img.naturalWidth, h = img.naturalHeight, k = mk(w, h), g = k.getContext('2d');
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = 'destination-in';
  const gx = g.createLinearGradient(0, 0, w, 0); gx.addColorStop(0, 'rgba(0,0,0,0)'); gx.addColorStop(.16, '#000'); gx.addColorStop(.84, '#000'); gx.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gx; g.fillRect(0, 0, w, h);
  const gy = g.createLinearGradient(0, 0, 0, h); gy.addColorStop(0, 'rgba(0,0,0,0)'); gy.addColorStop(.12, '#000'); gy.addColorStop(.86, '#000'); gy.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gy; g.fillRect(0, 0, w, h);
  DIO = k;
}
const DIO_LAMPS = [[.20, .335, 120], [.497, .345, 80], [.385, .37, 70], [.805, .44, 100], [.595, .59, 80], [.40, .60, 70], [.38, .685, 110]];
const GRAIN = [];
function makeGrain() {
  for (let n = 0; n < 4; n++) {
    const k = mk(256, 256), g = k.getContext('2d'), id = g.createImageData(256, 256), r = rng(n * 31 + 7);
    for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (r() - .5) * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
    g.putImageData(id, 0, 0); GRAIN.push(k);
  }
}

// ═════════════════════════ SCENE 1 — LIGHTS ON (0–2s) ═════════════════════════
function s1(c, t) {
  // the room is dark until the lamp catches
  const on = E.outCubic(P(t, .32, .7));
  c.fillStyle = COL.night; c.fillRect(0, 0, W, H);
  c.save(); c.globalAlpha = on; atelierBg(c, CX, CY, 1.2); c.restore();

  const SZ = 236, SZ2 = 122;
  setFont(c, 900, SZ, FT.en, 0);
  const L1 = layoutChars(c, 'APP', -SZ * .05);
  const asc = c.measureText('A').actualBoundingBoxAscent;
  setFont(c, 900, SZ2, FT.en, 0);
  const L2 = layoutChars(c, 'DEVELOPMENT', 2);
  const asc2 = c.measureText('D').actualBoundingBoxAscent;
  const x1 = CX - L1.width / 2, base1 = CY - 34, x2 = CX - L2.width / 2, base2 = CY + 34 + asc2;
  const O = L2.chars[5], ox = x2 + O.x + O.w / 2, oy = base2 - asc2 / 2;

  const zp = E.inExpo(P(t, 1.5, 2.0)), zm = E.inOutCubic(P(t, 1.45, 2.0));
  const s = (1 - .06 * E.outCubic(P(t, 1.25, 1.5))) * (1 + 90 * zp);
  c.save();
  c.translate(lerp(ox, CX, zm), lerp(oy, CY, zm)); c.scale(s, s); c.translate(-ox, -oy);

  // the bulb: pops, flickers, catches
  const fl = t < .5 ? [1, .15, 1, .3, .9, .2, 1, 1][Math.floor(t / .0625)] : 1;
  for (let k = 0; k < 3; k++) {
    const p = P(t, .4 + k * .1, 1.3 + k * .1); if (p <= 0 || p >= 1) continue;
    c.strokeStyle = `rgba(255,200,121,${(1 - p) * .4})`; c.lineWidth = 2;
    c.beginPath(); c.arc(CX, CY, 30 + 640 * E.outExpo(p), 0, TAU); c.stroke();
  }
  let w, h;
  if (t < .5) { const r = 40 * E.outBack(P(t, 0, .22), 2.4); w = h = r; }
  else { const e = E.outExpo(P(t, .5, .9)); w = lerp(40, 1560, e); h = lerp(40, 8, e); }
  if (w > 0) {
    c.save(); c.globalAlpha = fl;
    c.shadowColor = 'rgba(255,190,100,.95)'; c.shadowBlur = 40 + 30 * (t < .5 ? 1 : 1 - P(t, .5, .9));
    c.fillStyle = COL.lamp; rrect(c, CX - w / 2, CY - h / 2, w, h, h / 2); c.fill(); c.restore();
    lampGlow(c, CX, CY, 260, .5 * fl * (1 - .6 * P(t, .5, .9)));
  }
  // APP rises from behind the line
  c.save(); c.beginPath(); c.rect(0, 0, W, CY - h / 2 - 3); c.clip();
  setFont(c, 900, SZ, FT.en, 0); c.fillStyle = COL.fg;
  L1.chars.forEach((ch, i) => {
    const e = E.outExpo(P(t, .55 + i * .07, 1.1 + i * .07));
    c.fillText(ch.ch, x1 + ch.x, base1 + (1 - e) * 300);
  });
  c.restore();
  // DEVELOPMENT drops from under the line (outlined, cream)
  c.save(); c.beginPath(); c.rect(0, CY + h / 2 + 3, W, H); c.clip();
  setFont(c, 900, SZ2, FT.en, 0); c.strokeStyle = COL.fg; c.lineWidth = 5; c.lineJoin = 'round'; c.fillStyle = '#2C2925';
  L2.chars.forEach((ch, i) => {
    const e = E.outExpo(P(t, 1.0 + i * .03, 1.45 + i * .03));
    c.strokeText(ch.ch, x2 + ch.x, base2 - (1 - e) * 180);
    c.fillText(ch.ch, x2 + ch.x, base2 - (1 - e) * 180);
  });
  c.restore();
  // portal: a lamp lights inside the O
  const dr = asc2 * .2 * E.outBack(P(t, 1.36, 1.56), 2);
  if (dr > 0) {
    const g = c.createRadialGradient(ox, oy, 0, ox, oy, dr);
    g.addColorStop(0, '#FFE2B0'); g.addColorStop(.6, COL.lamp); g.addColorStop(1, COL.amber);
    c.save(); c.shadowColor = 'rgba(255,190,100,.9)'; c.shadowBlur = 30; c.fillStyle = g; c.beginPath(); c.arc(ox, oy, dr, 0, TAU); c.fill(); c.restore();
  }
  c.restore();
  if (t > 1.975) { c.fillStyle = COL.lamp; c.fillRect(0, 0, W, H); }
}

// ═════════════════════════ SCENE 2 — CONCEPT (2–4s) ═════════════════════════
function s2(c, t) {
  atelierBg(c, W * .5, H * .45, 1.1);
  const SZ = 196; setFont(c, 900, SZ, FT.jp);
  const l1 = layoutChars(c, 'つくることで、', -4), l2 = layoutChars(c, 'もっと楽しく。', -4);
  const b1 = 470, b2 = 740, xa = CX - l1.width / 2 - 110, xb = CX - l2.width / 2 + 110;
  const hits = [...Array(7)].map((_, i) => 2.0 + i * .09).concat([...Array(7)].map((_, i) => 2.75 + i * .09));
  const items = [...l1.chars.map(ch => ({ ...ch, x: xa + ch.x, b: b1 })), ...l2.chars.map(ch => ({ ...ch, x: xb + ch.x, b: b2 }))];
  items.forEach((it, i) => { it.h = hits[i]; it.cx = it.x + it.w / 2; it.cy = it.b - SZ * .38; });

  // brass dot grid, rippled by each hit
  c.fillStyle = 'rgba(205,168,98,0.16)';
  for (let gy = 24; gy < H; gy += 48) for (let gx = 24; gx < W; gx += 48) {
    let dx = 0, dy = 0;
    for (const it of items) {
      const dt = t - it.h; if (dt < 0 || dt > 1.3) continue;
      const vx = gx - it.cx, vy = gy - it.cy, d = Math.hypot(vx, vy) || 1;
      const a = 28 * Math.exp(-dt * 2.4) * Math.exp(-(((d - dt * 1500) / 80) ** 2));
      dx += vx / d * a; dy += vy / d * a;
    }
    c.fillRect(gx + dx - 1.5, gy + dy - 1.5, 3, 3);
  }
  for (const [k, it] of items.entries()) {
    if (k % 3) continue;
    const p = P(t, it.h, it.h + .6); if (p <= 0 || p >= 1) continue;
    c.strokeStyle = `rgba(255,200,121,${.55 * (1 - p)})`; c.lineWidth = 3 * (1 - p);
    c.beginPath(); c.arc(it.cx, it.cy, lerp(60, 330, E.outExpo(p)), 0, TAU); c.stroke();
  }
  // glyphs: drop in with a warm afterglow
  const R = rng(5);
  items.forEach(it => {
    const r0 = (R() - .5) * .8;
    if (t < it.h) return;
    const e = E.outExpo(P(t, it.h, it.h + .42));
    const s = lerp(2.3, 1, e), rot = lerp(r0, 0, E.outBack(P(t, it.h, it.h + .5), 2.2));
    const glow = 1 - E.outCubic(P(t, it.h, it.h + .8));
    c.save(); c.translate(it.cx, it.cy); c.rotate(rot); c.scale(s, s); c.translate(-it.cx, -it.cy);
    c.globalAlpha = clamp((t - it.h) * 14);
    setFont(c, 900, SZ, FT.jp);
    if (glow > .01) { c.save(); c.globalAlpha *= glow * .8; c.fillStyle = COL.amber; c.fillText(it.ch, it.x + 18 * glow, it.b + 18 * glow); c.restore(); }
    c.shadowColor = `rgba(255,190,100,${.15 + .6 * glow})`; c.shadowBlur = 30 + 40 * glow;
    c.fillStyle = COL.fg; c.fillText(it.ch, it.x, it.b);
    c.restore();
  });
  if (t > 3.3) {
    setFont(c, 600, 28, FT.en, 9);
    const txt = 'BUILDING APPS THAT MAKE LIFE MORE FUN.';
    const n = Math.min(txt.length, Math.floor((t - 3.3) / .011));
    const tw = c.measureText(txt).width, sx = CX - tw / 2, y = 930;
    c.fillStyle = COL.brass; c.fillText(txt.slice(0, n), sx, y);
    const cw = c.measureText(txt.slice(0, n)).width;
    if (Math.floor(t * 8) % 2 === 0 || n < txt.length) { c.fillStyle = COL.lamp; c.fillRect(sx + cw + 4, y - 24, 14, 30); }
  }
  // the flash of the portal settles back into lamplight
  const fl = 1 - E.outCubic(P(t, 2.0, 2.4));
  if (fl > 0) { c.fillStyle = `rgba(255,200,121,${fl})`; c.fillRect(0, 0, W, H); }
}

// ═════════════════════════ APP SCENES — the floor guide card ═════════════════════════
function floorCard(c, u) {
  // the site's card: faint fill, hairline border, lifts into place
  const e = E.outExpo(P(u, -.05, .5));
  if (e <= 0) return;
  c.save(); c.globalAlpha = e; c.translate(0, (1 - e) * 40);
  c.fillStyle = 'rgba(255,244,228,0.035)'; c.strokeStyle = COL.line; c.lineWidth = 2;
  rrect(c, 160, 150, 1600, 780, 44); c.fill(); c.stroke();
  c.restore();
}
function appText(c, u, o) {
  const X = 900;
  // FLOOR  No.0X
  const ep = E.outBack(P(u, .06, .4), 2);
  setFont(c, 500, 18, FT.en, 6); c.fillStyle = COL.dim; c.globalAlpha = clamp(u * 5);
  c.fillText('FLOOR', X, 262); c.globalAlpha = 1;
  if (ep > 0) { c.save(); c.translate(X + 128, 252); c.scale(ep, ep); brassPlate(c, 0, -22, `No.0${o.idx}`, 22); c.restore(); }
  // name
  const NS = o.nameSize || 108, NB = 440;
  setFont(c, o.nameWeight || 900, NS, o.nameFont || FT.jp);
  const L = layoutChars(c, o.name, o.nameSp || 0);
  if (o.mode === 'step') {
    L.chars.forEach((ch, i) => {
      const st = .22 + i * (1 / 12); if (o.uq < st) return;
      const big = o.uq - st < .09, cx = X + ch.x + ch.w / 2, cy = NB - NS * .38;
      c.save(); c.translate(cx, cy + (big ? -14 : 0)); c.scale(big ? 1.3 : 1, big ? 1.3 : 1); c.translate(-cx, -cy);
      c.fillStyle = o.accent; c.fillText(ch.ch, X + ch.x + 6, NB + 6);
      c.fillStyle = COL.fg; c.fillText(ch.ch, X + ch.x, NB); c.restore();
    });
  } else {
    c.save(); c.beginPath(); c.rect(X - 30, NB - NS * 1.25, 1000, NS * 1.6); c.clip();
    c.fillStyle = COL.fg;
    L.chars.forEach((ch, i) => {
      const e = E.outExpo(P(u, .16 + i * .04, .7 + i * .04));
      const cx = X + ch.x + ch.w / 2, cy = NB - NS * .38;
      c.save(); c.translate(cx, cy + (1 - e) * NS * 1.4);
      if (o.mode === 'boil') c.rotate((h2(i, o.boil) - .5) * .09);
      c.fillText(ch.ch, -ch.w / 2, NS * .38); c.restore();
    });
    c.restore();
  }
  o.nameW = L.width; o.nameB = NB;
  // description
  setFont(c, 500, 32, FT.jp, 1.5);
  o.desc.forEach((line, i) => {
    const e = E.outCubic(P(u, .38 + i * .07, .85 + i * .07));
    c.globalAlpha = e; c.fillStyle = COL.muted; c.fillText(line, X, 530 + i * 54 + (1 - e) * 28);
  });
  c.globalAlpha = 1;
  // store pills (as on the site)
  setFont(c, 700, 22, FT.en, 1);
  let tx = X; const ty = 530 + o.desc.length * 54 + 34;
  ['App Store', 'Google Play'].forEach((tag, i) => {
    const tw = c.measureText(tag).width + 76, e = E.outBack(P(u, .55 + i * .08, .9 + i * .08), 2.2);
    if (e > 0) {
      c.save(); c.translate(tx + tw / 2, ty + 28); c.scale(e, e);
      c.fillStyle = COL.fg; rrect(c, -tw / 2, -28, tw, 56, 28); c.fill();
      c.fillStyle = COL.bgDeep;
      if (i === 0) { c.beginPath(); c.arc(-tw / 2 + 32, 1, 9, 0, TAU); c.fill(); c.beginPath(); c.ellipse(-tw / 2 + 35, -11, 3, 6, .5, 0, TAU); c.fill(); }
      else { c.beginPath(); c.moveTo(-tw / 2 + 25, -11); c.lineTo(-tw / 2 + 42, 0); c.lineTo(-tw / 2 + 25, 11); c.closePath(); c.fill(); }
      c.fillText(tag, -tw / 2 + 54, 8); c.restore();
    }
    tx += tw + 16;
  });
}

// ═════════════════════════ APP 1 — しのばせトーク (4–6s) ═════════════════════════
const WORDS = ['りんご', 'ねこ', 'うみ', 'ひみつ', 'ことば', 'おまつり', 'たこやき', 'ゆうびん', 'ほし', 'でんしゃ', 'さくら', 'かくれんぼ', 'おばけ', 'ぱんだ', 'すいか', 'にんじゃ', 'かみなり', 'ないしょ', 'ふうせん', 'もみじ', 'あいことば', 'くじら', 'とけい', 'ねずみ'];
const WR = rng(11);
const WPOS = WORDS.map(w => ({ w, x: WR() * (W - 200), y: 90 + WR() * (H - 120), s: 44 + WR() * 64, r: (WR() - .5) * .35, sp: .4 + WR() }));
function app1(c, t) {
  const u = t - 4;
  atelierBg(c);
  const words = (alpha, color, mag, lx, ly) => {
    c.fillStyle = color; c.globalAlpha = alpha;
    for (const p of WPOS) {
      let x = p.x, y = p.y - u * 34 * p.sp, s = p.s;
      if (mag) { x = lx + (x - lx) * 1.35; y = ly + (y - ly) * 1.35; s *= 1.35; }
      c.save(); c.translate(x, y); c.rotate(p.r); setFont(c, 900, s, FT.jp); c.fillText(p.w, 0, 0); c.restore();
    }
    c.globalAlpha = 1;
  };
  words(.05, COL.fg);
  floorCard(c, u);
  // magnifier sweeping the bottom: hidden words glow inside the lens
  const lp = clamp((u + .1) / 2.1);
  const lx = 1780 - 1500 * E.inOutSine(lp), ly = 960 + 30 * Math.sin(u * 4.2), LR = 130;
  c.save(); c.beginPath(); c.arc(lx, ly, LR, 0, TAU); c.fillStyle = 'rgba(255,214,160,.08)'; c.fill(); c.clip();
  lampGlow(c, lx, ly, LR, .25); words(.85, COL.lamp, true, lx, ly); c.restore();
  c.save(); c.strokeStyle = COL.brass; c.lineCap = 'round';
  const ang = .78; c.lineWidth = 30; c.beginPath();
  c.moveTo(lx + Math.cos(ang) * (LR + 12), ly + Math.sin(ang) * (LR + 12));
  c.lineTo(lx + Math.cos(ang) * (LR + 170), ly + Math.sin(ang) * (LR + 170)); c.stroke();
  c.lineWidth = 12; c.beginPath(); c.arc(lx, ly, LR, 0, TAU); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 7; c.beginPath(); c.arc(lx, ly, LR - 34, 3.5, 4.5); c.stroke();
  c.restore();
  // icon: iris reveal + overshoot
  const e1 = E.outExpo(P(u, 0, .6)), e2 = E.outBack(P(u, 0, .7), 1.8);
  const cx = 500, cy = 540 + (1 - e1) * 420 + Math.sin(u * 2.4) * 7;
  lampGlow(c, cx, cy - 40, 420, .16 * e1);
  c.save(); c.beginPath(); c.arc(cx + 80, cy - 60, 620 * E.outExpo(P(u, .02, .55)), 0, TAU); c.clip();
  iconCard(c, IMG.ic1, cx, cy, 440, { rot: lerp(-.22, 0, e2), sx: lerp(.72, 1, e2), sy: lerp(.72, 1, e2) });
  c.restore();
  // typing bubble
  const pb = E.outBack(P(u, .5, .8), 2.4);
  if (pb > 0) {
    c.save(); c.translate(690, 300); c.scale(pb, pb);
    c.fillStyle = '#2A2723'; c.strokeStyle = COL.fg; c.lineWidth = 5; c.lineJoin = 'round';
    c.beginPath(); c.roundRect(-10, -110, 190, 96, 48); c.moveTo(30, -18); c.lineTo(8, 22); c.lineTo(70, -18); c.closePath();
    c.fill(); c.stroke(); c.fillStyle = '#2A2723'; c.fillRect(24, -24, 52, 14);
    for (let i = 0; i < 3; i++) {
      const b = Math.max(0, Math.sin(u * 11 - i * .9)) * 12;
      c.fillStyle = i === 1 ? COL.lamp : COL.fg; c.beginPath(); c.arc(42 + i * 43, -62 - b, 10, 0, TAU); c.fill();
    }
    c.restore();
  }
  appText(c, u, { idx: 1, name: 'しのばせトーク', accent: COL.amber, desc: ['スマホ1台で遊べる、', '言葉当てパーティーゲーム'] });
}

// ═════════════════════════ APP 2 — おえかき探偵団 (6–8s) ═════════════════════════
const DOODLE = (() => {
  const d = {}, OX = -40;
  d.card = []; for (let i = 0; i <= 140; i++) { const a = -Math.PI / 2 + i / 140 * TAU * 1.03, n = 5;
    const co = Math.cos(a), si = Math.sin(a);
    d.card.push([540 + OX + 242 * Math.sign(co) * Math.abs(co) ** (2 / n), 540 + 242 * Math.sign(si) * Math.abs(si) ** (2 / n)]); }
  d.ring = []; for (let i = 0; i <= 160; i++) { const a = 2.3 + i / 160 * TAU * 1.12; const r = 305 + 16 * Math.sin(a * 3) + i * .15;
    d.ring.push([540 + OX + Math.cos(a) * r * 1.03, 540 + Math.sin(a) * r * .97]); }
  d.q = []; for (let i = 0; i <= 40; i++) { const a = Math.PI * 1.05 + i / 40 * Math.PI * 1.45; d.q.push([1640 + Math.cos(a) * 52, 250 + Math.sin(a) * 52]); }
  d.q.push([1640, 330]); d.q.push([1640, 360]);
  d.qdot = [[1638, 398], [1642, 402], [1640, 396]];
  d.star = []; for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + i / 10 * TAU, r = i % 2 ? 30 : 70; d.star.push([250 + Math.cos(a) * r, 860 + Math.sin(a) * r]); }
  d.sp = [[[268, 228], [228, 184]], [[310, 210], [302, 156]], [[236, 272], [184, 256]]];
  d.fill = []; for (let k = 0; k <= 9; k++) { const y = -10 + k * 56; d.fill.push([k % 2 ? 500 : -20, y + (k % 2 ? 36 : 0)]); }
  return d;
})();
const icoMask = mk(480, 480), icoCtx = icoMask.getContext('2d');
function app2(c, t) {
  const u = t - 6, boil = Math.floor(t * 12);
  atelierBg(c, W * .2, -H * .1);
  c.strokeStyle = 'rgba(255,236,210,0.04)'; c.lineWidth = 2; c.beginPath();
  for (let x = 0; x < W; x += 60) { c.moveTo(x, 0); c.lineTo(x, H); }
  for (let y = 0; y < H; y += 60) { c.moveTo(0, y); c.lineTo(W, y); }
  c.stroke();
  floorCard(c, u);
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = 'rgba(246,240,230,.85)'; c.lineWidth = 6;
  const fy = Math.sin(u * 2.2) * 6, IX = 500;
  const fp = E.inOutCubic(P(u, .12, .62));
  lampGlow(c, IX, 500, 420, .15 * fp);
  if (fp > 0) {
    icoCtx.clearRect(0, 0, 480, 480); icoCtx.globalCompositeOperation = 'source-over';
    icoCtx.lineWidth = 120; icoCtx.lineCap = 'round'; icoCtx.lineJoin = 'round'; icoCtx.strokeStyle = '#000';
    strokePartial(icoCtx, DOODLE.fill, fp);
    icoCtx.globalCompositeOperation = 'destination-in'; icoCtx.fillStyle = '#000'; rrect(icoCtx, 0, 0, 480, 480, 108); icoCtx.fill();
    icoCtx.globalCompositeOperation = 'source-in'; icoCtx.drawImage(IMG.ic2, 0, 0, 480, 480);
    icoCtx.globalCompositeOperation = 'source-over';
    c.save(); c.shadowColor = `rgba(0,0,0,${.55 * fp})`; c.shadowBlur = 60; c.shadowOffsetY = 30;
    c.drawImage(icoMask, IX - 240, 540 - 240 + fy); c.restore();
  }
  c.save(); c.translate(0, fy); c.globalAlpha = 1 - P(u, .55, .75) * .6;
  strokePartial(c, DOODLE.card, E.inOutCubic(P(u, .02, .38)), 5, boil); c.restore();
  c.globalAlpha = 1;
  strokePartial(c, DOODLE.ring, E.inOutCubic(P(u, .5, 1.0)), 6, boil + 3);
  c.strokeStyle = COL.lamp; c.lineWidth = 8;
  strokePartial(c, DOODLE.q, E.outCubic(P(u, .6, .92)), 5, boil + 5);
  if (u > .95) strokePartial(c, DOODLE.qdot, 1, 4, boil + 6);
  c.strokeStyle = 'rgba(246,240,230,.85)'; c.lineWidth = 6;
  strokePartial(c, DOODLE.star, E.inOutCubic(P(u, .78, 1.12)), 5, boil + 7);
  DOODLE.sp.forEach((s, i) => strokePartial(c, s, E.outCubic(P(u, .95 + i * .05, 1.1 + i * .05)), 4, boil + 9 + i));
  c.restore();
  const o = { idx: 2, name: 'おえかき探偵団', accent: COL.amber, mode: 'boil', boil,
    desc: ['ヒントを頼りに絵を描いて、', 'みんなでお題を推理する新感覚パーティーゲーム'] };
  appText(c, u, o);
  const ul = []; for (let i = 0; i <= 50; i++) { const k = i / 50; ul.push([900 + k * o.nameW, o.nameB + 30 + Math.sin(k * 14) * 6]); }
  c.save(); c.strokeStyle = COL.lamp; c.lineWidth = 7; c.lineCap = 'round';
  strokePartial(c, ul, E.inOutCubic(P(u, .7, 1.05)), 4, boil + 20); c.restore();
}

// ═════════════════════════ APP 3 — のぼるひと (8–10s) ═════════════════════════
const CLOUDS = (() => { const r = rng(3); return Array.from({ length: 7 }, () => ({ x: 240 + r() * 1400, y: r() * (H + 300), s: 16 + Math.floor(r() * 3) * 6, sp: .25 + r() * .3 })); })();
const CLOUD_SHAPE = ['..XXXX....', '.XXXXXXX..', 'XXXXXXXXXX', '.XXXXXXXX.'];
const pxCanvas = mk(128, 128), pxCtx = pxCanvas.getContext('2d');
function app3(c, t) {
  const u = t - 8, uq = Math.floor(u * 12) / 12;
  atelierBg(c, CX, -H * .2, 1.2);
  const climb = 1700 * E.inOutCubic(P(u, -.3, 2.1)) + u * 90;
  c.fillStyle = 'rgba(255,236,210,0.06)';
  for (const cl of CLOUDS) {
    const y = ((cl.y + climb * cl.sp) % (H + 300)) - 150;
    CLOUD_SHAPE.forEach((row, ry) => [...row].forEach((ch, rx) => { if (ch === 'X') c.fillRect(cl.x + rx * cl.s, y + ry * cl.s, cl.s, cl.s); }));
  }
  // wooden tower walls scrolling down as we climb
  const B = 60, off = climb % B, base = Math.floor(climb / B);
  const brick = ['#6E4526', '#5E3A20', '#7C4F2C', '#553419'];
  const wall = (x0, cols, side) => {
    for (let r = -1; r < H / B + 1; r++) {
      const wr = r - base, y = r * B + off;
      for (let k = 0; k < cols; k++) {
        const x = x0 + k * B + ((wr & 1) ? B / 2 : 0) * side;
        c.fillStyle = brick[Math.floor(h2(wr, k + side * 7) * 4)]; c.fillRect(x, y, B, B);
        c.fillStyle = 'rgba(255,214,160,.16)'; c.fillRect(x, y, B, 5);
        c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(x, y + B - 5, B, 5); c.fillRect(x + B - 4, y, 4, B);
      }
    }
  };
  wall(-30, 2, 1); wall(W - 90, 2, -1);
  c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(90, 0, 8, H); c.fillRect(W - 98, 0, 8, H);
  floorCard(c, u);
  // altitude meter
  const alt = Math.floor(1280 * E.inOutCubic(P(u, 0, 1.8)));
  setFont(c, 400, 42, FT.dot, 2); c.textAlign = 'right'; c.fillStyle = COL.lamp;
  c.fillText(`▲ ${String(alt).padStart(4, '0')} m`, 1700, 262); c.textAlign = 'left';
  c.fillStyle = COL.line; c.fillRect(1700 - 230, 280, 230, 6);
  c.fillStyle = COL.lamp; c.fillRect(1700 - 230, 280, 230 * (alt / 1280), 6);
  // the climber: stepped (on-twos) jump with squash & stretch, de-pixelating as it lands
  let y = 0, sx = 1, sy = 1;
  if (uq < .42) { const p = uq / .42; y = lerp(650, -80, E.outCubic(p)); sx = .9; sy = 1.12; }
  else if (uq < .58) { const p = (uq - .42) / .16; y = lerp(-80, 0, E.inQuad(p)); sx = .95; sy = 1.06; }
  else if (uq < .84) { const p = (uq - .58) / .26, s = Math.sin(p * Math.PI) * (1 - p * .3); sy = 1 - .17 * s; sx = 1 + .13 * s; }
  else if (uq >= 1.12 && uq < 1.5) { const p = (uq - 1.12) / .38; y = -120 * Math.sin(p * Math.PI); sy = 1 + .07 * Math.cos(p * TAU); sx = 2 - sy; }
  else if (uq >= 1.5 && uq < 1.7) { const p = (uq - 1.5) / .2, s = Math.sin(p * Math.PI); sy = 1 - .12 * s; sx = 1 + .1 * s; }
  const SZ = 420, cx = 500, ground = 560 + SZ / 2;
  lampGlow(c, cx, ground - SZ / 2, 420, .14);
  const sh = clamp(1 + Math.min(0, y) / 300) * clamp((.5 - uq) < 0 ? 1 : uq / .5);
  c.fillStyle = `rgba(0,0,0,${.45 * sh})`; c.beginPath(); c.ellipse(cx, ground + 36, 210 * sh * sx, 22 * sh, 0, 0, TAU); c.fill();
  for (const [t0, t1] of [[.58, .95], [1.5, 1.85]]) {
    const p = P(uq, t0, t1); if (p <= 0 || p >= 1) continue;
    c.fillStyle = `rgba(255,214,160,${1 - p})`;
    for (let i = 0; i < 6; i++) { const d = (i % 3 + 1) * 66 * E.outCubic(p), side = i < 3 ? -1 : 1; const s = 20 - p * 13;
      c.fillRect(cx + side * (230 + d) - s / 2, ground + 18 - (i % 3) * 20 * (1 - p), s, s); }
  }
  const lv = [6, 10, 16, 26, 42, 72, 0][Math.min(6, Math.floor(P(uq, 0, .55) * 7))];
  let src = IMG.ic3;
  if (lv) { pxCtx.clearRect(0, 0, 128, 128); pxCtx.drawImage(IMG.ic3, 0, 0, lv, lv);
    src = mk(lv, lv); src.getContext('2d').drawImage(pxCanvas, 0, 0, lv, lv, 0, 0, lv, lv); }
  c.save(); c.translate(cx, ground + y); c.scale(sx, sy);
  iconCard(c, src, 0, -SZ / 2, SZ, { pixel: !!lv });
  c.restore();
  appText(c, u, { idx: 3, name: 'のぼるひと', nameFont: FT.dot, nameWeight: 400, nameSize: 124, nameSp: 4, mode: 'step', uq,
    accent: COL.wood, desc: ['どこまで高く登れるかに挑む、', 'シンプル操作のタワークライムゲーム'] });
}

// ═════════════════════════ SCENE 6 — THE ATELIER (10–12.5s) ═════════════════════════
const STATEMENT = [['小さな', 'アトリエ', 'から、'], ['みんなで', '遊べる'], ['「楽しい」', 'を、'], ['ひとつずつ。']];
function s6(c, t) {
  const v = t - 10;
  atelierBg(c, W * .72, H * .3, 1.3);
  const cp = P(t, 11.95, 12.36), cs = 1 - E.inBack(cp, 2.2);
  if (cs > .002) {
    c.save(); c.translate(CX, CY); c.scale(cs, cs); c.translate(-CX, -CY); c.globalAlpha = 1 - E.inCubic(cp);
    // the diorama, slowly pushing in
    const dh = 1000, dw = dh * DIO.width / DIO.height, push = 1 + .07 * E.inOutSine(P(v, -.3, 2.4));
    const dx = 1330 - 20 * v, dy = 545;
    c.save(); c.translate(dx, dy); c.scale(push, push);
    c.drawImage(DIO, -dw / 2, -dh / 2, dw, dh);
    c.globalCompositeOperation = 'screen';
    DIO_LAMPS.forEach(([lx, ly, r], i) => lampGlow(c, -dw / 2 + lx * dw, -dh / 2 + ly * dh, r * 1.1, .42 * flick(t, i + 1)));
    c.restore();
    // ABOUT + statement, lighting word by word
    setFont(c, 600, 18, FT.en, 7); c.fillStyle = COL.brass; c.globalAlpha *= 1;
    c.fillText('ABOUT', 170, 270);
    setFont(c, 900, 70, FT.jp, 3);
    let wi = 0;
    STATEMENT.forEach((line, li) => {
      let x = 170; const y = 375 + li * 100;
      line.forEach(w => {
        const lit = E.outCubic(P(v, .15 + wi * .14, .4 + wi * .14)), hl = w === '「楽しい」';
        c.save();
        if (hl && lit > 0) { c.shadowColor = `rgba(255,200,121,${.6 * lit})`; c.shadowBlur = 30; }
        c.fillStyle = hl ? `rgb(${lerp(130, 255, lit)},${lerp(120, 200, lit)},${lerp(106, 121, lit)})` : `rgb(${lerp(130, 246, lit)},${lerp(120, 240, lit)},${lerp(106, 230, lit)})`;
        c.fillText(w, x, y); c.restore();
        x += c.measureText(w).width; wi++;
      });
    });
    // stats
    const stats = [[3, 2, '', 'APPS'], [2, 2, '', 'PLATFORMS'], [26, 2, "'", 'SINCE 2026']];
    stats.forEach(([n, pad, pre, label], i) => {
      const e = E.outExpo(P(v, .9 + i * .1, 1.7 + i * .1)), x = 170 + i * 230, y = 850;
      c.save(); c.globalAlpha *= clamp(e * 3);
      c.fillStyle = COL.line; c.fillRect(x, y - 78, 190 * e, 2);
      setFont(c, 900, 60, FT.en, -1.5);
      c.fillStyle = COL.lamp; c.fillText(pre, x, y);
      c.fillStyle = COL.fg; c.fillText(String(Math.round(n * e)).padStart(pad, '0'), x + (pre ? c.measureText(pre).width : 0), y);
      setFont(c, 500, 15, FT.en, 4); c.fillStyle = COL.dim; c.fillText(label, x, y + 32);
      c.restore();
    });
    c.restore();
  }
  dust(c, t, 1.2);
  // the lamp returns (bookend)
  const dr = 20 * E.outBack(P(t, 12.18, 12.36), 2.5);
  if (dr > 0) { c.save(); c.shadowColor = 'rgba(255,190,100,.95)'; c.shadowBlur = 40; c.fillStyle = COL.lamp; c.beginPath(); c.arc(CX, CY, dr, 0, TAU); c.fill(); c.restore(); lampGlow(c, CX, CY, 220, .4); }
}

// ═════════════════════════ END CARD (12.5–15s) ═════════════════════════
function endCard(c, t) {
  const w = t - 12.5;
  atelierBg(c, W * .8, -H * .1, 1.2);
  dust(c, t, .8);
  const push = 1 + .03 * E.outCubic(P(w, .3, 2.5));
  c.save(); c.translate(CX, 540); c.scale(push, push); c.translate(-CX, -540);
  // eyebrow
  const ee = E.outExpo(P(w, .9, 1.5));
  setFont(c, 600, 22, FT.en, 9);
  const eb = 'APP DEVELOPMENT · SINCE 2026', ebw = c.measureText(eb).width;
  c.save(); c.globalAlpha = ee; c.fillStyle = COL.brass; c.textAlign = 'center'; c.fillText(eb, CX + 4, 332); c.restore();
  c.fillStyle = COL.brass; c.fillRect(CX - ebw / 2 - 30 - 70 * ee, 324, 70 * ee, 2); c.fillRect(CX + ebw / 2 + 30, 324, 70 * ee, 2);
  // wordmark, letter by letter, around the lamp-hyphen
  const SZ = 210; setFont(c, 900, SZ, FT.en, 0);
  const L = layoutChars(c, 'tkc-works', -SZ * .05), base = 545, x0 = CX - L.width / 2;
  const hy = L.chars[3], hm = c.measureText('-');
  const hx = x0 + hy.x + (hm.actualBoundingBoxRight - hm.actualBoundingBoxLeft) / 2;
  const hcy = base - (hm.actualBoundingBoxAscent - hm.actualBoundingBoxDescent) / 2;
  const hw = hm.actualBoundingBoxRight + hm.actualBoundingBoxLeft, hh = hm.actualBoundingBoxAscent + hm.actualBoundingBoxDescent;
  const mp = P(w, .12, .38), em = E.inOutCubic(mp);
  const dx = lerp(CX, hx, em), dy = lerp(CY, hcy, em) - Math.sin(mp * Math.PI) * 90;
  const mo = E.outBack(P(w, .34, .56), 2.2);
  const bw = lerp(40, hw, mo), bh = lerp(40, hh, clamp(mo));
  c.save(); c.shadowColor = 'rgba(255,190,100,.7)'; c.shadowBlur = lerp(40, 26, clamp(mo));
  c.fillStyle = COL.lamp; rrect(c, dx - bw / 2, dy - bh / 2, bw, bh, Math.min(bw, bh) / 2 * (1 - clamp(mo) * .7)); c.fill(); c.restore();
  L.chars.forEach((ch, i) => {
    if (i === 3) return;
    const dir = i < 3 ? -1 : 1, d = Math.abs(i - 3), dl = .42 + d * .055;
    if (w < dl) return;
    const e = E.outExpo(P(w, dl, dl + .6)), eb2 = E.outBack(P(w, dl, dl + .5), 2.6);
    const bx = x0 + ch.x + ch.w / 2;
    c.save(); c.globalAlpha = P(w, dl, dl + .1);
    c.translate(bx + dir * (1 - e) * 420, base - (1 - eb2) * 40); c.rotate(dir * (1 - eb2) * .35);
    c.scale(1 + (1 - e) * .5, 1 - (1 - e) * .2);
    c.fillStyle = COL.fg; c.fillText(ch.ch, -ch.w / 2, 0); c.restore();
  });
  // catch copy: characters surface from a blur, as on the site
  setFont(c, 700, 44, FT.jp, 0);
  const CC = layoutChars(c, 'つくることで、もっと楽しく。', 44 * .14), cx0 = CX - CC.width / 2;
  CC.chars.forEach((ch, i) => {
    const e = E.outCubic(P(w, 1.0 + i * .035, 1.6 + i * .035)); if (e <= 0) return;
    c.save(); c.globalAlpha = e; c.filter = e < .98 ? `blur(${(1 - e) * 8}px)` : 'none';
    c.fillStyle = COL.fg; c.fillText(ch.ch, cx0 + ch.x, 660 + (1 - e) * 18); c.restore();
  });
  // app icons
  [IMG.ic1, IMG.ic2, IMG.ic3].forEach((im, i) => {
    const e = E.outBack(P(w, 1.4 + i * .08, 1.8 + i * .08), 2.4);
    if (e > 0) iconCard(c, im, CX + (i - 1) * 140, 790 + (1 - clamp(e)) * 40, 96, { sx: e, sy: e });
  });
  const ce = E.outCubic(P(w, 1.7, 2.1));
  setFont(c, 500, 26, FT.en, 4); c.fillStyle = COL.muted; c.globalAlpha = ce; c.textAlign = 'center';
  c.fillText('tkc-works.net', CX, 920 + (1 - ce) * 20);
  c.textAlign = 'left'; c.globalAlpha = 1;
  c.restore();
}

// ═════════════════════════ TRANSITIONS & MASTER ═════════════════════════
function barFill(c, i) {
  if (i % 2) { const g = c.createLinearGradient(0, 0, W, 0); g.addColorStop(0, COL.brassLo); g.addColorStop(.5, COL.brass); g.addColorStop(1, COL.brassLo); return g; }
  return COL.bgDeep;
}
function barsCover(c, t) {
  const n = 9, bh = H / n;
  for (let i = 0; i < n; i++) { const e = E.inOutQuart(P(t, 3.62 + i * .016, 3.77 + i * .016));
    c.fillStyle = barFill(c, i); c.fillRect(-W + W * e, i * bh - 1, W, bh + 2); }
}
function barsUncover(c, t) {
  const n = 9, bh = H / n;
  for (let i = 0; i < n; i++) { const e = E.inOutQuart(P(t, 3.92 + i * .016, 4.1 + i * .016));
    c.fillStyle = barFill(c, i); c.fillRect(W * e, i * bh - 1, W, bh + 2); }
}
const SCRIB = []; for (let k = 0; k <= 8; k++) SCRIB.push([k % 2 ? 2180 : -260, -130 + k * 165]);
function scribbleWipe(c, t) {
  ctx2.save(); app2(ctx2, t); ctx2.restore();
  c.save(); c.strokeStyle = c.createPattern(sc2, 'no-repeat'); c.lineWidth = 320; c.lineCap = 'round'; c.lineJoin = 'round';
  strokePartial(c, SCRIB, E.inOutCubic(P(t, 5.65, 6.04))); c.restore();
}
function pixelDissolve(c, t) {
  ctx2.save(); app3(ctx2, t); ctx2.restore();
  const S = 80, cols = W / S, rows = Math.ceil(H / S), r = rng(9);
  c.save(); c.beginPath();
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const tc = 7.7 + .28 * ((x / cols) * .75 + (y / rows) * .25) + r() * .06, p = P(t, tc, tc + .07);
    if (p > 0) { const s = S * p; c.rect(x * S + (S - s) / 2, y * S + (S - s) / 2, s, s); }
  }
  c.clip(); c.drawImage(sc2, 0, 0); c.restore();
}

function render(c, t) {
  c.save();
  if (t < 2) s1(c, t);
  else if (t < 3.92) { s2(c, t); if (t >= 3.6) barsCover(c, t); }
  else if (t < 5.65) { app1(c, t); if (t < 4.3) barsUncover(c, t); }
  else if (t < 6.05) { app1(c, t); scribbleWipe(c, t); }
  else if (t < 7.7) app2(c, t);
  else if (t < 8.12) { app2(c, t); pixelDissolve(c, t); }
  else if (t < 9.75) app3(c, t);
  else if (t < 10.12) {
    const o = H * E.inOutExpo(P(t, 9.75, 10.12));
    c.save(); c.translate(0, o); app3(c, t); c.restore();
    c.save(); c.translate(0, o - H); s6(c, t); c.restore();
  }
  else if (t < 12.36) s6(c, t);
  else if (t < 12.72) {
    s6(c, t);
    const r = 1150 * E.outExpo(P(t, 12.36, 12.72));
    c.save(); c.beginPath(); c.arc(CX, CY, r, 0, TAU); c.clip(); endCard(c, t); c.restore();
    c.strokeStyle = `rgba(255,200,121,${.6 * (1 - P(t, 12.36, 12.72))})`; c.lineWidth = 3; c.beginPath(); c.arc(CX, CY, r, 0, TAU); c.stroke();
  }
  else endCard(c, t);
  if (t >= 2 && t < 10) dust(c, t, .7);
  c.restore();
}

// ───────── HUD (drawn sharp, after motion blur) ─────────
const SCENES = [[0, '00 — LIGHTS ON'], [2, '01 — CONCEPT'], [3.92, '02 — FLOOR No.01 / しのばせトーク'], [6.05, '03 — FLOOR No.02 / おえかき探偵団'],
  [8.12, '04 — FLOOR No.03 / のぼるひと'], [10.0, '05 — ATELIER'], [12.5, '']];
function hud(c, t, f) {
  const a = .75 * E.outCubic(P(t, .45, .8)), fade = 1 - P(t, 12.4, 12.7);
  const M = 56, Lb = 30;
  c.save(); c.strokeStyle = `rgba(205,168,98,${a * .6})`; c.lineWidth = 2; c.beginPath();
  for (const [x, y, sx, sy] of [[M, M, 1, 1], [W - M, M, -1, 1], [M, H - M, 1, -1], [W - M, H - M, -1, -1]]) {
    c.moveTo(x, y + sy * Lb); c.lineTo(x, y); c.lineTo(x + sx * Lb, y); }
  c.stroke();
  c.fillStyle = `rgba(246,240,230,${a})`;
  setFont(c, 600, 17, FT.en, 4); c.fillText('TKC-WORKS  ·  SHOWREEL 2026', 96, 100);
  c.globalAlpha = fade;
  const ss = String(Math.floor(t)).padStart(2, '0'), ff = String(f % FPS).padStart(2, '0');
  const tc = `TC 00:00:${ss}:${ff}`; c.textAlign = 'right'; c.fillText(tc, W - 96, 100);
  const tcw = c.measureText(tc).width; c.textAlign = 'left';
  if (Math.floor(t * 2) % 2 === 0) { c.save(); c.shadowColor = 'rgba(255,190,100,.9)'; c.shadowBlur = 10; c.fillStyle = `rgba(255,200,121,${a})`; c.beginPath(); c.arc(W - 96 - tcw - 22, 94, 6, 0, TAU); c.fill(); c.restore(); }
  let sIdx = 0; SCENES.forEach((s, i) => { if (t >= s[0]) sIdx = i; });
  const lab = SCENES[sIdx][1], n = Math.floor((t - SCENES[sIdx][0]) / .014);
  c.fillStyle = `rgba(246,240,230,${a})`; setFont(c, 600, 17, FT.en, 4);
  c.fillText([...lab].slice(0, n).join(''), 96, H - 90);
  c.fillStyle = `rgba(246,240,230,${a * .2})`; c.fillRect(W - 96 - 240, H - 98, 240, 2);
  c.fillStyle = `rgba(255,200,121,${a})`; c.fillRect(W - 96 - 240, H - 98, 240 * (t / DUR), 2);
  setFont(c, 500, 14, FT.en, 3); c.textAlign = 'right'; c.fillStyle = `rgba(246,240,230,${a * .7})`;
  c.fillText(`${String(f).padStart(3, '0')} / ${DUR * FPS}`, W - 96, H - 112); c.textAlign = 'left';
  c.restore();
}
let VIG = null;
function post(c, t, f) {
  hud(c, t, f);
  c.fillStyle = VIG; c.fillRect(0, 0, W, H);
  c.save(); c.globalCompositeOperation = 'overlay'; c.globalAlpha = .08;
  const tile = GRAIN[f % GRAIN.length], ox = (f * 137) % 256, oy = (f * 71) % 256;
  for (let y = -oy; y < H; y += 256) for (let x = -ox; x < W; x += 256) c.drawImage(tile, x, y);
  c.restore();
}

function drawFrame(f, sub = SUB) {
  const t = f / FPS;
  out.globalCompositeOperation = 'source-over'; out.globalAlpha = 1;
  for (let i = 0; i < sub; i++) {
    const ts = clamp(t + (sub > 1 ? (i / (sub - 1) - .5) : 0) * SHUTTER / FPS, 0, DUR - 1e-4);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
    render(ctx, ts);
    out.globalAlpha = 1 / (i + 1); out.drawImage(sc, 0, 0);
  }
  out.globalAlpha = 1; post(out, t, f);
}

async function init() {
  await Promise.all([loadImg('dio', '../assets/hero-diorama.jpg'), loadImg('ic1', '../assets/shinobase-talk-icon.png'),
    loadImg('ic2', '../assets/oekaki-tanteidan-icon.png'), loadImg('ic3', '../assets/noboruhito-icon.png')]);
  const jp = 'つくることで、もっと楽しく。しのばせトークおえかき探偵団のぼるひとスマホ1台で遊べる、言葉当てパーティーゲームヒントを頼りに絵を描いて、みんなでお題を推理する新感覚パーティーゲームどこまで高く登れるかに挑む、シンプル操作のタワークライムゲーム小さなアトリエから、みんなで遊べる「楽しい」を、ひとつずつ。' + WORDS.join('') + '—×·／';
  await Promise.all([
    document.fonts.load('900 100px "Outfit"', 'APPDEVELOMNTtkc-works0123456789\''), document.fonts.load('800 100px "Outfit"', 'No.0123'),
    document.fonts.load('700 100px "Outfit"', 'App Store Google Play'), document.fonts.load('600 100px "Outfit"', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ·—'),
    document.fonts.load('500 100px "Outfit"', 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-./'),
    document.fonts.load('900 100px "Zen Kaku Gothic New"', jp), document.fonts.load('700 100px "Zen Kaku Gothic New"', jp), document.fonts.load('500 100px "Zen Kaku Gothic New"', jp),
    document.fonts.load('400 100px "DotGothic16"', 'のぼるひと▲m0123456789'),
  ]);
  await document.fonts.ready;
  makeDiorama(); makeGrain();
  VIG = out.createRadialGradient(CX, CY, H * .5, CX, CY, H * 1.15);
  VIG.addColorStop(0, 'rgba(10,8,6,0)'); VIG.addColorStop(1, 'rgba(10,8,6,0.35)');
  window.READY = true;
}
window.renderFrame = (f, sub) => { drawFrame(f, sub); return cv.toDataURL('image/jpeg', .95); };
init().then(() => {
  if (QS.has('render')) return;
  const t0 = performance.now();
  const loop = () => { const f = Math.floor(((performance.now() - t0) / 1000 % DUR) * FPS); drawFrame(f, 1); requestAnimationFrame(loop); };
  loop();
});
