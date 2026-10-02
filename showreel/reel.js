'use strict';
// ───────────────────────── tkc-works SHOWREEL 2026 ─────────────────────────
// 15s / 1920x1080 / 60fps. Fully deterministic: render(t) is a pure function of time.
const W = 1920, H = 1080, FPS = 60, DUR = 15, CX = W / 2, CY = H / 2, TAU = Math.PI * 2;
const QS = new URLSearchParams(location.search);
const SUB = +(QS.get('sub') || 5);      // motion-blur sub-samples
const SHUTTER = 0.5;                    // 180° shutter

const cv = document.getElementById('c'), out = cv.getContext('2d');
const mk = (w = W, h = H) => { const k = document.createElement('canvas'); k.width = w; k.height = h; return k; };
const sc = mk(), ctx = sc.getContext('2d');      // scene buffer
const sc2 = mk(), ctx2 = sc2.getContext('2d');   // "next scene" buffer for pattern transitions

const COL = {
  ink: '#1A120D', brown: '#5A2E17', brown2: '#6B4A2F', red: '#A61E22', hyphen: '#A3201F',
  orange: '#B8481E', ochre: '#C8843A', cream: '#FAF6EC', paper: '#F2E9D6', sketch: '#F7F1E3',
  muted: '#7C7060', yellow: '#F7CB55', yellow2: '#EDA937',
};
const FT = {
  disp: '"Unbounded", sans-serif', jp: '"Noto Sans JP", sans-serif',
  mono: '"JetBrains Mono", "Noto Sans JP", monospace', dot: '"DotGothic16", monospace',
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
  outElastic: t => t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - .75) * (TAU / 3)) + 1,
};
function cubicBezier(x1, y1, x2, y2) {
  const bx = t => 3 * x1 * t * (1 - t) ** 2 + 3 * x2 * t * t * (1 - t) + t ** 3;
  const by = t => 3 * y1 * t * (1 - t) ** 2 + 3 * y2 * t * t * (1 - t) + t ** 3;
  const f = x => {
    if (x <= 0) return 0; if (x >= 1) return 1;
    let lo = 0, hi = 1, t = x;
    for (let i = 0; i < 28; i++) { t = (lo + hi) / 2; if (bx(t) < x) lo = t; else hi = t; }
    return by(t);
  };
  f.bx = bx; f.by = by; return f;
}
function rng(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const h2 = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };

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
    c.save(); c.shadowColor = 'rgba(40,20,5,0.35)'; c.shadowBlur = 60; c.shadowOffsetY = 30;
    c.fillStyle = '#2a1a10'; rrect(c, -h, -h, size, size, r); c.fill(); c.restore();
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
  let head = pts[0], ang = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    if (cum[i] <= L) { j = J(i); c.lineTo(b[0] + j[0], b[1] + j[1]); head = b; }
    else { const k = (L - cum[i - 1]) / (cum[i] - cum[i - 1] || 1); head = [lerp(a[0], b[0], k), lerp(a[1], b[1], k)]; c.lineTo(head[0], head[1]); break; }
  }
  c.stroke(); return { head, ang };
}

// ───────── assets ─────────
const IMG = {};
const loadImg = (k, src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => { IMG[k] = i; res(); }; i.onerror = rej; i.src = src; });
let LOGO = null;
function analyzeLogo() {
  const img = IMG.logo, w = img.naturalWidth, h = img.naturalHeight;
  const k = mk(w, h), g = k.getContext('2d'); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, w, h).data;
  const cnt = new Array(w).fill(0);
  const colOn = new Array(w).fill(false), top = new Array(w).fill(h), bot = new Array(w).fill(0);
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) {
    const i = (y * w + x) * 4;
    if (d[i + 3] > 60) { colOn[x] = true; cnt[x]++; top[x] = Math.min(top[x], y); bot[x] = Math.max(bot[x], y); }
  }
  let runs = [], s = -1;
  for (let x = 0; x <= w; x++) {
    if (x < w && colOn[x]) { if (s < 0) s = x; }
    else if (s >= 0) { runs.push({ x0: s, x1: x - 1 }); s = -1; }
  }
  // merge hairline gaps
  const m = []; for (const r of runs) { const l = m[m.length - 1]; if (l && r.x0 - l.x1 <= 3) l.x1 = r.x1; else m.push({ ...r }); }
  // split glyphs that touch (e.g. "kc") at their thinnest column
  const sp = [];
  for (const r of m) {
    if (r.x1 - r.x0 > 170) { let bx = r.x0, bv = 1e9; const a = r.x0 + Math.floor((r.x1 - r.x0) * .35), b = r.x0 + Math.floor((r.x1 - r.x0) * .65);
      for (let x = a; x <= b; x++) if (cnt[x] < bv) { bv = cnt[x]; bx = x; }
      sp.push({ x0: r.x0, x1: bx }, { x0: bx + 1, x1: r.x1 }); } else sp.push(r);
  }
  m.length = 0; m.push(...sp);
  for (const r of m) { r.y0 = h; r.y1 = 0; for (let x = r.x0; x <= r.x1; x++) { r.y0 = Math.min(r.y0, top[x]); r.y1 = Math.max(r.y1, bot[x]); } }
  LOGO = { runs: m, w, h };
}
const GRAIN = [];
function makeGrain() {
  for (let n = 0; n < 4; n++) {
    const k = mk(256, 256), g = k.getContext('2d'), id = g.createImageData(256, 256), r = rng(n * 31 + 7);
    for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (r() - .5) * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
    g.putImageData(id, 0, 0); GRAIN.push(k);
  }
}

// ═════════════════════════ SCENE 1 — INTRO (0–2s) ═════════════════════════
function s1(c, t) {
  c.fillStyle = COL.ink; c.fillRect(0, 0, W, H);
  const SZ = 236, SZ2 = 122;
  setFont(c, 800, SZ, FT.disp);
  const L1 = layoutChars(c, 'APP', 4);
  const asc = c.measureText('A').actualBoundingBoxAscent;
  setFont(c, 800, SZ2, FT.disp);
  const L2 = layoutChars(c, 'DEVELOPMENT', 2);
  const asc2 = c.measureText('D').actualBoundingBoxAscent;
  const x1 = CX - L1.width / 2, base1 = CY - 34;
  const x2 = CX - L2.width / 2, base2 = CY + 34 + asc2;
  // the portal is the "O" of DEVELOPMENT
  const O = L2.chars[5], ox = x2 + O.x + O.w / 2, oy = base2 - asc2 / 2;

  // camera: anticipation pull-back, then dive into the "O"
  const zp = E.inExpo(P(t, 1.5, 2.0)), zm = E.inOutCubic(P(t, 1.45, 2.0));
  const s = (1 - .06 * E.outCubic(P(t, 1.25, 1.5))) * (1 + 90 * zp);
  c.save();
  c.translate(lerp(ox, CX, zm), lerp(oy, CY, zm)); c.scale(s, s); c.translate(-ox, -oy);

  // ripples from the first beat
  for (let k = 0; k < 3; k++) {
    const p = P(t, .03 + k * .1, .95 + k * .1); if (p <= 0 || p >= 1) continue;
    c.strokeStyle = `rgba(250,246,236,${(1 - p) * .55})`; c.lineWidth = 2;
    c.beginPath(); c.arc(CX, CY, 30 + 620 * E.outExpo(p), 0, TAU); c.stroke();
  }
  // dot → squash → line
  let w, h;
  if (t < .5) {
    const r = 44 * E.outBack(P(t, 0, .3), 2.4);
    const sq = Math.sin(P(t, .34, .5) * Math.PI / 2);
    w = r * (1 + .36 * sq); h = r * (1 - .3 * sq);
  } else {
    const e = E.outExpo(P(t, .5, .9)); w = lerp(59.8, 1560, e); h = lerp(30.8, 10, e);
  }
  c.fillStyle = t < 1.0 ? COL.cream : COL.red;
  rrect(c, CX - w / 2, CY - h / 2, w, h, h / 2); c.fill();

  // APP rises from behind the line
  c.save(); c.beginPath(); c.rect(0, 0, W, CY - h / 2 - 3); c.clip();
  setFont(c, 800, SZ, FT.disp); c.fillStyle = COL.cream;
  L1.chars.forEach((ch, i) => {
    const e = E.outExpo(P(t, .55 + i * .07, 1.1 + i * .07));
    c.fillText(ch.ch, x1 + ch.x, base1 + (1 - e) * 300);
  });
  c.restore();
  // DEVELOPMENT drops from under the line (outlined)
  c.save(); c.beginPath(); c.rect(0, CY + h / 2 + 3, W, H); c.clip();
  setFont(c, 800, SZ2, FT.disp); c.strokeStyle = COL.cream; c.lineWidth = 5; c.lineJoin = 'round'; c.fillStyle = COL.ink;
  L2.chars.forEach((ch, i) => {
    const e = E.outExpo(P(t, 1.0 + i * .03, 1.45 + i * .03));
    c.strokeText(ch.ch, x2 + ch.x, base2 - (1 - e) * 180);
    c.fillText(ch.ch, x2 + ch.x, base2 - (1 - e) * 180);
  });
  c.restore();
  // portal: cream disc inside the O's counter
  const dr = asc2 * .2 * E.outBack(P(t, 1.36, 1.56), 2);
  if (dr > 0) { c.fillStyle = COL.cream; c.beginPath(); c.arc(ox, oy, dr, 0, TAU); c.fill(); }
  c.restore();
  if (t > 1.975) { c.fillStyle = COL.cream; c.fillRect(0, 0, W, H); }
}

// ═════════════════════════ SCENE 2 — KINETIC TYPE (2–4s) ═════════════════════════
function s2(c, t) {
  c.fillStyle = COL.cream; c.fillRect(0, 0, W, H);
  const SZ = 196; setFont(c, 900, SZ, FT.jp);
  const l1 = layoutChars(c, 'つくることで、', -6), l2 = layoutChars(c, 'もっと楽しく。', -6);
  const b1 = 470, b2 = 740, xa = CX - l1.width / 2 - 110, xb = CX - l2.width / 2 + 110;
  const hits = [...Array(7)].map((_, i) => 2.0 + i * .09).concat([...Array(7)].map((_, i) => 2.75 + i * .09));
  const items = [...l1.chars.map(ch => ({ ...ch, x: xa + ch.x, b: b1 })), ...l2.chars.map(ch => ({ ...ch, x: xb + ch.x, b: b2 }))];
  items.forEach((it, i) => { it.h = hits[i]; it.cx = it.x + it.w / 2; it.cy = it.b - SZ * .38; });

  // reactive dot grid — each hit sends a shockwave through it
  c.fillStyle = 'rgba(90,46,23,0.2)';
  for (let gy = 24; gy < H; gy += 48) for (let gx = 24; gx < W; gx += 48) {
    let dx = 0, dy = 0;
    for (const it of items) {
      const dt = t - it.h; if (dt < 0 || dt > 1.3) continue;
      const vx = gx - it.cx, vy = gy - it.cy, d = Math.hypot(vx, vy) || 1;
      const a = 30 * Math.exp(-dt * 2.4) * Math.exp(-(((d - dt * 1500) / 80) ** 2));
      dx += vx / d * a; dy += vy / d * a;
    }
    c.fillRect(gx + dx - 2, gy + dy - 2, 4, 4);
  }
  // impact rings
  for (const [k, it] of items.entries()) {
    if (k % 3) continue;
    const p = P(t, it.h, it.h + .55); if (p <= 0 || p >= 1) continue;
    c.strokeStyle = `rgba(166,30,34,${.8 * (1 - p)})`; c.lineWidth = 7 * (1 - p);
    c.beginPath(); c.arc(it.cx, it.cy, lerp(60, 330, E.outExpo(p)), 0, TAU); c.stroke();
  }
  // glyphs: slam in with riso mis-registration
  const R = rng(5);
  items.forEach((it, i) => {
    const r0 = (R() - .5) * .9;
    if (t < it.h) return;
    const e = E.outExpo(P(t, it.h, it.h + .42));
    const s = lerp(2.4, 1, e), rot = lerp(r0, 0, E.outBack(P(t, it.h, it.h + .5), 2.2));
    const off = 8 + 44 * (1 - E.outExpo(P(t, it.h, it.h + .6)));
    c.save(); c.translate(it.cx, it.cy); c.rotate(rot); c.scale(s, s); c.translate(-it.cx, -it.cy);
    c.globalAlpha = clamp((t - it.h) * 14);
    setFont(c, 900, SZ, FT.jp);
    c.fillStyle = COL.ochre; c.fillText(it.ch, it.x - off * .6, it.b + off * .2);
    c.fillStyle = COL.red; c.fillText(it.ch, it.x + off, it.b + off * .5);
    c.fillStyle = COL.ink; c.fillText(it.ch, it.x, it.b);
    c.restore();
  });
  // typed subtitle
  if (t > 3.3) {
    setFont(c, 700, 30, FT.mono, 8);
    const txt = 'BUILDING APPS THAT MAKE LIFE MORE FUN.';
    const n = Math.min(txt.length, Math.floor((t - 3.3) / .011));
    const tw = c.measureText(txt).width, sx = CX - tw / 2, y = 930;
    c.fillStyle = COL.brown; c.fillText(txt.slice(0, n), sx, y);
    const cw = c.measureText(txt.slice(0, n)).width;
    if (Math.floor(t * 8) % 2 === 0 || n < txt.length) { c.fillStyle = COL.red; c.fillRect(sx + cw + 4, y - 26, 16, 32); }
  }
}

// ═════════════════════════ APP SCENES — shared text block ═════════════════════════
function appText(c, u, o) {
  const X = 940;
  // index
  setFont(c, 700, 24, FT.mono, 6);
  c.globalAlpha = E.outCubic(P(u, .08, .3)); c.fillStyle = o.accent;
  c.fillText(`WORK 0${o.idx} / 03`, X, 300);
  c.globalAlpha = 1;
  const lw = 160 * E.outExpo(P(u, .12, .6));
  c.fillRect(X + 290, 291, lw, 3);
  // name
  const NS = o.nameSize || 112, NB = 445;
  setFont(c, o.nameWeight || 900, NS, o.nameFont || FT.jp);
  const L = layoutChars(c, o.name, o.nameSp || 0);
  c.fillStyle = o.ink;
  if (o.mode === 'step') {
    L.chars.forEach((ch, i) => {
      const st = .22 + i * (1 / 12); if (o.uq < st) return;
      const big = o.uq - st < .09;
      const cx = X + ch.x + ch.w / 2, cy = NB - NS * .38;
      c.save(); c.translate(cx, cy + (big ? -14 : 0)); c.scale(big ? 1.3 : 1, big ? 1.3 : 1); c.translate(-cx, -cy);
      c.fillStyle = o.accent; c.fillText(ch.ch, X + ch.x + 6, NB + 6);
      c.fillStyle = o.ink; c.fillText(ch.ch, X + ch.x, NB); c.restore();
    });
  } else {
    c.save(); c.beginPath(); c.rect(X - 30, NB - NS * 1.25, 1000, NS * 1.6); c.clip();
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
  setFont(c, 500, 34, FT.jp, 1);
  o.desc.forEach((line, i) => {
    const e = E.outCubic(P(u, .38 + i * .07, .85 + i * .07));
    c.globalAlpha = e; c.fillStyle = o.muted; c.fillText(line, X, 540 + i * 54 + (1 - e) * 28);
  });
  c.globalAlpha = 1;
  // tags
  setFont(c, 700, 20, FT.mono, 3);
  let tx = X; const ty = 540 + o.desc.length * 54 + 40;
  o.tags.forEach((tag, i) => {
    const tw = c.measureText(tag).width + 40, e = E.outBack(P(u, .55 + i * .07, .9 + i * .07), 2.2);
    if (e > 0) {
      c.save(); c.translate(tx + tw / 2, ty + 22); c.scale(e, e);
      c.strokeStyle = o.accent; c.lineWidth = 2.5; rrect(c, -tw / 2, -22, tw, 44, 22); c.stroke();
      if (i === o.tags.length - 1) { c.fillStyle = o.accent; c.fill(); c.fillStyle = o.tagFg || COL.cream; } else c.fillStyle = o.accent;
      c.textAlign = 'center'; c.fillText(tag, 0, 8); c.restore();
    }
    tx += tw + 14;
  });
}

// ═════════════════════════ APP 1 — しのばせトーク (4–6s) ═════════════════════════
const WORDS = ['りんご', 'ねこ', 'うみ', 'ひみつ', 'ことば', 'おまつり', 'たこやき', 'ゆうびん', 'ほし', 'でんしゃ', 'さくら', 'かくれんぼ', 'おばけ', 'ぱんだ', 'すいか', 'にんじゃ', 'かみなり', 'ないしょ', 'ふうせん', 'もみじ', 'あいことば', 'くじら', 'とけい', 'ねずみ'];
const WR = rng(11);
const WPOS = WORDS.map(w => ({ w, x: WR() * (W - 200), y: 90 + WR() * (H - 120), s: 44 + WR() * 64, r: (WR() - .5) * .35, sp: .4 + WR() }));
function app1(c, t) {
  const u = t - 4;
  c.fillStyle = COL.paper; c.fillRect(0, 0, W, H);
  const words = (alpha, color, mag, lx, ly) => {
    c.fillStyle = color; c.globalAlpha = alpha;
    for (const p of WPOS) {
      let x = p.x, y = p.y - u * 34 * p.sp, s = p.s;
      if (mag) { x = lx + (x - lx) * 1.35; y = ly + (y - ly) * 1.35; s *= 1.35; }
      c.save(); c.translate(x, y); c.rotate(p.r); setFont(c, 900, s, FT.jp); c.fillText(p.w, 0, 0); c.restore();
    }
    c.globalAlpha = 1;
  };
  words(.075, COL.brown);
  // the magnifier: hidden words surface inside the lens
  const lp = clamp((u + .1) / 2.1);
  const lx = 1780 - 1500 * E.inOutSine(lp), ly = 905 + 40 * Math.sin(u * 4.2), LR = 150;
  c.save(); c.beginPath(); c.arc(lx, ly, LR, 0, TAU); c.fillStyle = '#FBF7EE'; c.fill(); c.clip();
  words(.55, COL.red, true, lx, ly); c.restore();
  c.save(); c.strokeStyle = COL.brown; c.lineCap = 'round';
  const ang = .78; c.lineWidth = 36; c.beginPath();
  c.moveTo(lx + Math.cos(ang) * (LR + 14), ly + Math.sin(ang) * (LR + 14));
  c.lineTo(lx + Math.cos(ang) * (LR + 200), ly + Math.sin(ang) * (LR + 200)); c.stroke();
  c.lineWidth = 16; c.beginPath(); c.arc(lx, ly, LR, 0, TAU); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 10; c.beginPath(); c.arc(lx, ly, LR - 42, 3.5, 4.5); c.stroke();
  c.restore();

  // icon card: iris-reveal + overshoot
  const e1 = E.outExpo(P(u, 0, .6)), e2 = E.outBack(P(u, 0, .7), 1.8);
  const cx = 540, cy = 540 + (1 - e1) * 420 + Math.sin(u * 2.4) * 7;
  c.save(); c.beginPath(); c.arc(cx + 80, cy - 60, 620 * E.outExpo(P(u, .02, .55)), 0, TAU); c.clip();
  iconCard(c, IMG.ic1, cx, cy, 480, { rot: lerp(-.22, 0, e2), sx: lerp(.72, 1, e2), sy: lerp(.72, 1, e2) });
  c.restore();
  // typing bubble
  const pb = E.outBack(P(u, .5, .8), 2.4);
  if (pb > 0) {
    c.save(); c.translate(740, 300); c.scale(pb, pb);
    c.fillStyle = COL.cream; c.strokeStyle = COL.brown; c.lineWidth = 6; c.lineJoin = 'round';
    c.beginPath(); c.roundRect(-10, -110, 190, 96, 48); c.moveTo(30, -18); c.lineTo(8, 22); c.lineTo(70, -18); c.closePath();
    c.fill(); c.stroke(); c.fillStyle = COL.cream; c.fillRect(24, -26, 52, 16);
    for (let i = 0; i < 3; i++) {
      const b = Math.max(0, Math.sin(u * 11 - i * .9)) * 12;
      c.fillStyle = i === 1 ? COL.red : COL.brown; c.beginPath(); c.arc(42 + i * 43, -62 - b, 11, 0, TAU); c.fill();
    }
    c.restore();
  }
  appText(c, u, {
    idx: 1, name: 'しのばせトーク', accent: COL.red, ink: COL.brown, muted: COL.muted,
    desc: ['スマホ1台で遊べる、', '言葉当てパーティーゲーム'], tags: ['iOS', 'ANDROID', 'PARTY GAME'],
  });
}

// ═════════════════════════ APP 2 — おえかき探偵団 (6–8s) ═════════════════════════
const DOODLE = (() => {
  const d = {};
  // squircle card outline
  d.card = []; for (let i = 0; i <= 140; i++) { const a = -Math.PI / 2 + i / 140 * TAU * 1.03, n = 5;
    const co = Math.cos(a), si = Math.sin(a);
    d.card.push([540 + 262 * Math.sign(co) * Math.abs(co) ** (2 / n), 540 + 262 * Math.sign(si) * Math.abs(si) ** (2 / n)]); }
  // loose circle around the card
  d.ring = []; for (let i = 0; i <= 160; i++) { const a = 2.3 + i / 160 * TAU * 1.12; const r = 330 + 18 * Math.sin(a * 3) + i * .15;
    d.ring.push([540 + Math.cos(a) * r * 1.03, 540 + Math.sin(a) * r * .97]); }
  // question mark
  d.q = []; for (let i = 0; i <= 40; i++) { const a = Math.PI * 1.05 + i / 40 * Math.PI * 1.45; d.q.push([1700 + Math.cos(a) * 58, 190 + Math.sin(a) * 58]); }
  d.q.push([1700, 278]); d.q.push([1700, 310]);
  d.qdot = [[1698, 352], [1702, 356], [1700, 350]];
  // star
  d.star = []; for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + i / 10 * TAU, r = i % 2 ? 34 : 80; d.star.push([230 + Math.cos(a) * r, 900 + Math.sin(a) * r]); }
  // sparks
  d.sp = [[[248, 168], [205, 120]], [[292, 150], [282, 92]], [[214, 214], [158, 196]]];
  // arrow from text to card
  d.arrow = []; for (let i = 0; i <= 30; i++) { const k = i / 30; d.arrow.push([lerp(1040, 830, k), 905 - Math.sin(k * Math.PI) * 70 + k * -40]); }
  d.ahead = [[858, 828], [826, 866], [872, 884]];
  // scribble fill mask for icon reveal
  d.fill = []; for (let k = 0; k <= 9; k++) { const y = -10 + k * 60; d.fill.push([k % 2 ? 540 : -20, y + (k % 2 ? 40 : 0)]); }
  return d;
})();
const icoMask = mk(520, 520), icoCtx = icoMask.getContext('2d');
function app2(c, t) {
  const u = t - 6, boil = Math.floor(t * 12);
  c.fillStyle = COL.sketch; c.fillRect(0, 0, W, H);
  c.strokeStyle = 'rgba(90,46,23,0.07)'; c.lineWidth = 2; c.beginPath();
  for (let x = 0; x < W; x += 60) { c.moveTo(x, 0); c.lineTo(x, H); }
  for (let y = 0; y < H; y += 60) { c.moveTo(0, y); c.lineTo(W, y); }
  c.stroke();
  c.strokeStyle = 'rgba(166,30,34,0.28)'; c.lineWidth = 3; c.beginPath(); c.moveTo(120, 0); c.lineTo(120, H); c.stroke();

  c.save(); c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = COL.brown2; c.lineWidth = 7;
  const fy = Math.sin(u * 2.2) * 6;
  // icon: pencil outline then scribble-filled reveal
  const fp = E.inOutCubic(P(u, .12, .62));
  if (fp > 0) {
    icoCtx.clearRect(0, 0, 520, 520); icoCtx.globalCompositeOperation = 'source-over';
    icoCtx.lineWidth = 130; icoCtx.lineCap = 'round'; icoCtx.lineJoin = 'round'; icoCtx.strokeStyle = '#000';
    strokePartial(icoCtx, DOODLE.fill, fp);
    icoCtx.globalCompositeOperation = 'destination-in'; icoCtx.fillStyle = '#000'; rrect(icoCtx, 0, 0, 520, 520, 117); icoCtx.fill();
    icoCtx.globalCompositeOperation = 'source-in'; icoCtx.drawImage(IMG.ic2, 0, 0, 520, 520);
    icoCtx.globalCompositeOperation = 'source-over';
    c.save();
    c.shadowColor = `rgba(40,20,5,${.3 * fp})`; c.shadowBlur = 50; c.shadowOffsetY = 26;
    c.drawImage(icoMask, 540 - 260, 540 - 260 + fy); c.restore();
  }
  c.save(); c.translate(0, fy); c.globalAlpha = 1 - P(u, .55, .75) * .6;
  strokePartial(c, DOODLE.card, E.inOutCubic(P(u, .02, .38)), 5, boil); c.restore();
  c.globalAlpha = 1;
  strokePartial(c, DOODLE.ring, E.inOutCubic(P(u, .5, 1.0)), 6, boil + 3);
  c.strokeStyle = COL.orange; c.lineWidth = 9;
  strokePartial(c, DOODLE.q, E.outCubic(P(u, .6, .92)), 5, boil + 5);
  if (u > .95) strokePartial(c, DOODLE.qdot, 1, 4, boil + 6);
  c.strokeStyle = COL.brown2; c.lineWidth = 7;
  strokePartial(c, DOODLE.star, E.inOutCubic(P(u, .78, 1.12)), 5, boil + 7);
  DOODLE.sp.forEach((s, i) => strokePartial(c, s, E.outCubic(P(u, .95 + i * .05, 1.1 + i * .05)), 4, boil + 9 + i));
  const ar = strokePartial(c, DOODLE.arrow, E.inOutCubic(P(u, 1.05, 1.35)), 5, boil + 12);
  if (u > 1.35) strokePartial(c, DOODLE.ahead, E.outCubic(P(u, 1.35, 1.45)), 4, boil + 13);
  c.restore();

  const o = {
    idx: 2, name: 'おえかき探偵団', accent: COL.orange, ink: COL.brown, muted: COL.muted, mode: 'boil', boil,
    desc: ['ヒントを頼りに絵を描いて、', 'みんなでお題を推理する新感覚パーティーゲーム'], tags: ['iOS', 'ANDROID', 'DRAW × DEDUCE'],
  };
  appText(c, u, o);
  // wobbly underline under the name
  const ul = []; for (let i = 0; i <= 50; i++) { const k = i / 50; ul.push([940 + k * o.nameW, o.nameB + 34 + Math.sin(k * 14) * 7]); }
  c.save(); c.strokeStyle = COL.orange; c.lineWidth = 8; c.lineCap = 'round';
  strokePartial(c, ul, E.inOutCubic(P(u, .7, 1.05)), 4, boil + 20); c.restore();
}

// ═════════════════════════ APP 3 — のぼるひと (8–10s) ═════════════════════════
let BG3 = null;
const CLOUDS = (() => { const r = rng(3); return Array.from({ length: 7 }, () => ({ x: 240 + r() * 1400, y: r() * (H + 300), s: 16 + Math.floor(r() * 3) * 6, sp: .25 + r() * .3 })); })();
const CLOUD_SHAPE = ['..XXXX....', '.XXXXXXX..', 'XXXXXXXXXX', '.XXXXXXXX.'];
const pxCanvas = mk(128, 128), pxCtx = pxCanvas.getContext('2d');
function app3(c, t) {
  const u = t - 8, uq = Math.floor(u * 12) / 12;
  c.fillStyle = BG3; c.fillRect(0, 0, W, H);
  const climb = 1700 * E.inOutCubic(P(u, -.3, 2.1)) + u * 90;
  // pixel clouds (parallax)
  c.fillStyle = 'rgba(255,250,235,0.75)';
  for (const cl of CLOUDS) {
    const y = ((cl.y + climb * cl.sp) % (H + 300)) - 150;
    CLOUD_SHAPE.forEach((row, ry) => [...row].forEach((ch, rx) => { if (ch === 'X') c.fillRect(cl.x + rx * cl.s, y + ry * cl.s, cl.s, cl.s); }));
  }
  // tower walls scrolling down as we climb
  const B = 60, off = climb % B, base = Math.floor(climb / B);
  const brick = ['#C8843A', '#B5702C', '#D9974A', '#A9652A'];
  const wall = (x0, cols, side) => {
    for (let r = -1; r < H / B + 1; r++) {
      const wr = r - base, y = r * B + off;
      for (let k = 0; k < cols; k++) {
        const x = x0 + k * B + ((wr & 1) ? B / 2 : 0) * side;
        c.fillStyle = brick[Math.floor(h2(wr, k + side * 7) * 4)]; c.fillRect(x, y, B, B);
        c.fillStyle = 'rgba(255,240,200,.35)'; c.fillRect(x, y, B, 6);
        c.fillStyle = 'rgba(60,30,10,.35)'; c.fillRect(x, y + B - 6, B, 6); c.fillRect(x + B - 4, y, 4, B);
      }
    }
  };
  wall(-30, 3, 1); wall(W - 150, 3, -1);
  c.fillStyle = 'rgba(60,30,10,.5)'; c.fillRect(150, 0, 8, H); c.fillRect(W - 158, 0, 8, H);

  // altitude meter
  const alt = Math.floor(1280 * E.inOutCubic(P(u, 0, 1.8)));
  setFont(c, 400, 46, FT.dot, 2); c.textAlign = 'right'; c.fillStyle = COL.brown;
  c.fillText(`▲ ${String(alt).padStart(4, '0')} m`, W - 210, 210); c.textAlign = 'left';
  c.fillRect(W - 210 - 230, 228, 230 * (alt / 1280), 8);

  // the climber: stepped (on-twos) jump with squash & stretch, de-pixelating as it lands
  let y = 0, sx = 1, sy = 1;
  if (uq < .42) { const p = uq / .42; y = lerp(650, -80, E.outCubic(p)); sx = .9; sy = 1.12; }
  else if (uq < .58) { const p = (uq - .42) / .16; y = lerp(-80, 0, E.inQuad(p)); sx = .95; sy = 1.06; }
  else if (uq < .84) { const p = (uq - .58) / .26, s = Math.sin(p * Math.PI) * (1 - p * .3); sy = 1 - .17 * s; sx = 1 + .13 * s; }
  else if (uq >= 1.12 && uq < 1.5) { const p = (uq - 1.12) / .38; y = -120 * Math.sin(p * Math.PI); sy = 1 + .07 * Math.cos(p * TAU); sx = 2 - sy; }
  else if (uq >= 1.5 && uq < 1.7) { const p = (uq - 1.5) / .2, s = Math.sin(p * Math.PI); sy = 1 - .12 * s; sx = 1 + .1 * s; }
  const SZ = 460, cx = 540, ground = 560 + SZ / 2;
  // ground shadow
  const sh = clamp(1 + Math.min(0, y) / 300) * clamp((.5 - uq) < 0 ? 1 : uq / .5);
  c.fillStyle = `rgba(90,46,23,${.28 * sh})`; c.beginPath(); c.ellipse(cx, ground + 40, 230 * sh * sx, 26 * sh, 0, 0, TAU); c.fill();
  // landing dust (stepped pixels)
  for (const [t0, t1] of [[.58, .95], [1.5, 1.85]]) {
    const p = P(uq, t0, t1); if (p <= 0 || p >= 1) continue;
    c.fillStyle = `rgba(255,248,230,${1 - p})`;
    for (let i = 0; i < 6; i++) { const d = (i % 3 + 1) * 70 * E.outCubic(p), side = i < 3 ? -1 : 1; const s = 22 - p * 14;
      c.fillRect(cx + side * (250 + d) - s / 2, ground + 20 - (i % 3) * 22 * (1 - p), s, s); }
  }
  const lv = [6, 10, 16, 26, 42, 72, 0][Math.min(6, Math.floor(P(uq, 0, .55) * 7))];
  let src = IMG.ic3;
  if (lv) { pxCtx.clearRect(0, 0, 128, 128); pxCtx.imageSmoothingEnabled = true; pxCtx.drawImage(IMG.ic3, 0, 0, lv, lv);
    src = mk(lv, lv); src.getContext('2d').drawImage(pxCanvas, 0, 0, lv, lv, 0, 0, lv, lv); }
  c.save(); c.translate(cx, ground + y); c.scale(sx, sy);
  iconCard(c, src, 0, -SZ / 2, SZ, { pixel: !!lv });
  c.restore();

  appText(c, u, {
    idx: 3, name: 'のぼるひと', nameFont: FT.dot, nameWeight: 400, nameSize: 128, nameSp: 4, mode: 'step', uq,
    accent: COL.red, ink: COL.brown, muted: '#6E5434',
    desc: ['どこまで高く登れるかに挑む、', 'シンプル操作のタワークライムゲーム'], tags: ['iOS', 'ANDROID', 'TOWER CLIMB'],
  });
}

// ═════════════════════════ SCENE 6 — CRAFT (10–12.5s) ═════════════════════════
const EASE = cubicBezier(.85, 0, .15, 1);
const SKILLS = ['GAME DESIGN', 'UI / UX DESIGN', 'iOS & ANDROID', 'ANIMATION', 'ICON & ARTWORK', 'RELEASE & SUPPORT'];
function s6(c, t) {
  const v = t - 10;
  c.fillStyle = COL.ink; c.fillRect(0, 0, W, H);
  c.strokeStyle = 'rgba(250,246,236,0.045)'; c.lineWidth = 1; c.beginPath();
  for (let x = 0; x <= W; x += 80) { c.moveTo(x + .5, 0); c.lineTo(x + .5, H); }
  for (let y = 0; y <= H; y += 80) { c.moveTo(0, y + .5); c.lineTo(W, y + .5); }
  c.stroke();

  const cp = P(t, 11.95, 12.36), cs = 1 - E.inBack(cp, 2.2);
  if (cs > .002) {
    c.save(); c.translate(CX, CY); c.scale(cs, cs); c.translate(-CX, -CY); c.globalAlpha = 1 - E.inCubic(cp);
    // — easing graph —
    const GX = 230, GY = 250, GS = 540, OX = GX, OY = GY + GS;
    const pA = E.outExpo(P(v, 0, .45));
    c.strokeStyle = 'rgba(250,246,236,.45)'; c.lineWidth = 2; c.beginPath();
    c.moveTo(OX, OY); c.lineTo(OX + GS * pA, OY); c.moveTo(OX, OY); c.lineTo(OX, OY - GS * pA); c.stroke();
    c.setLineDash([4, 8]); c.strokeStyle = 'rgba(250,246,236,.15)'; c.beginPath();
    c.moveTo(OX, OY - GS * pA); c.lineTo(OX + GS * pA, OY - GS * pA); c.lineTo(OX + GS * pA, OY); c.stroke(); c.setLineDash([]);
    setFont(c, 500, 16, FT.mono, 4); c.fillStyle = `rgba(250,246,236,${.5 * pA})`;
    c.fillText('TIME →', OX + GS - 74, OY + 32); c.save(); c.translate(OX - 22, OY); c.rotate(-Math.PI / 2); c.fillText('VALUE →', 0, 0); c.restore();
    const pH = E.outBack(P(v, .15, .45), 2);
    const p1 = [OX + .85 * GS, OY], p2 = [OX + .15 * GS, OY - GS];
    c.strokeStyle = COL.orange; c.lineWidth = 2; c.beginPath();
    c.moveTo(OX, OY); c.lineTo(lerp(OX, p1[0], clamp(pH)), OY);
    c.moveTo(OX + GS, OY - GS); c.lineTo(lerp(OX + GS, p2[0], clamp(pH)), OY - GS); c.stroke();
    if (pH > 0) { c.fillStyle = COL.orange; for (const p of [p1, p2]) { c.beginPath(); c.arc(p[0], p[1], 10 * pH, 0, TAU); c.fill(); } }
    const pC = E.inOutCubic(P(v, .2, .72));
    if (pC > 0) { c.strokeStyle = COL.cream; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath();
      for (let i = 0; i <= 100; i++) { const tt = i / 100 * pC; const x = OX + EASE.bx(tt) * GS, y = OY - EASE.by(tt) * GS; i ? c.lineTo(x, y) : c.moveTo(x, y); }
      c.stroke(); }
    const q = P(v, .72, 1.72), eq = EASE(q);
    if (v > .68) {
      const dx = OX + q * GS, dy = OY - eq * GS;
      c.setLineDash([6, 6]); c.strokeStyle = 'rgba(166,30,34,.7)'; c.lineWidth = 2; c.beginPath();
      c.moveTo(dx, OY); c.lineTo(dx, dy); c.lineTo(OX + GS + 90, dy); c.stroke(); c.setLineDash([]);
      c.save(); c.shadowColor = COL.red; c.shadowBlur = 30; c.fillStyle = '#E0383C';
      c.beginPath(); c.arc(dx, dy, 14, 0, TAU); c.fill(); c.restore();
    }
    setFont(c, 500, 22, FT.mono, 1);
    const lbl = 'cubic-bezier(.85, 0, .15, 1)', ln = Math.floor(clamp((v - .35) / .45) * lbl.length);
    c.fillStyle = COL.ochre; c.fillText(lbl.slice(0, ln), OX, OY + 80);
    // rail with onion-skin spacing
    const RX = OX + GS + 90;
    c.strokeStyle = `rgba(250,246,236,${.25 * pA})`; c.lineWidth = 2; c.beginPath(); c.moveTo(RX, OY); c.lineTo(RX, OY - GS * pA); c.stroke();
    if (v > .68) {
      for (let k = 0; k <= 16; k++) { const qk = k / 16; if (qk > q) break; const yk = OY - EASE(qk) * GS;
        c.strokeStyle = 'rgba(250,246,236,.32)'; c.lineWidth = 2; c.strokeRect(RX - 20, yk - 20, 40, 40); }
      c.save(); c.translate(RX, OY - eq * GS); c.rotate(eq * Math.PI / 2); c.fillStyle = COL.red; c.fillRect(-26, -26, 52, 52); c.restore();
    }
    // — skills reel —
    const RX2 = 1110, RC = 560, IH = 118;
    const ri = E.outExpo(P(v, .05, .5));
    c.globalAlpha *= 1;
    setFont(c, 700, 20, FT.mono, 6); c.fillStyle = COL.ochre;
    c.save(); c.globalAlpha *= ri; c.fillText('WHAT I DO', RX2, 330); c.fillRect(RX2, 346, 120 * ri, 3); c.restore();
    const st = Math.max(0, (v - .25) / .27), s = Math.min(SKILLS.length - 1, Math.floor(st) + E.inOutExpo(clamp((st % 1 - .55) / .45)));
    c.save(); c.beginPath(); c.rect(RX2 - 60, 400, 820, 330); c.clip(); c.globalAlpha *= ri;
    SKILLS.forEach((sk, i) => {
      const d = i - s, y = RC + d * IH + 22 + (1 - ri) * 80, a = clamp(1 - Math.abs(d) * .7);
      if (a <= 0) return;
      c.save(); c.globalAlpha *= Math.max(.12, a);
      setFont(c, 700, 20, FT.mono, 2); c.fillStyle = COL.ochre; c.fillText('0' + (i + 1), RX2, y - 26);
      setFont(c, 800, 58, FT.disp, 0); c.fillStyle = COL.cream; c.fillText(sk, RX2 + 60, y);
      c.restore();
    });
    c.restore();
    c.fillStyle = COL.red; c.fillRect(RX2 - 34, RC - 30, 8, 72 * ri);
    // stats
    const stats = [[3, 2, 'APPS RELEASED'], [2, 2, 'PLATFORMS'], [900, 3, 'FRAMES / REEL']];
    stats.forEach(([n, pad, label], i) => {
      const e = E.outExpo(P(v, .55 + i * .1, 1.35 + i * .1)), x = RX2 + i * 250, y = 900;
      c.save(); c.globalAlpha *= clamp(e * 3);
      c.fillStyle = 'rgba(250,246,236,.25)'; c.fillRect(x, y - 92, 210 * e, 1);
      setFont(c, 800, 62, FT.disp); c.fillStyle = COL.cream; c.fillText(String(Math.round(n * e)).padStart(pad, '0'), x, y);
      setFont(c, 500, 15, FT.mono, 3); c.fillStyle = 'rgba(250,246,236,.6)'; c.fillText(label, x, y + 34);
      c.restore();
    });
    c.restore();
  }
  // the dot returns (bookend)
  const dr = 22 * E.outBack(P(t, 12.18, 12.36), 2.5);
  if (dr > 0) { c.fillStyle = COL.hyphen; c.beginPath(); c.arc(CX, CY, dr, 0, TAU); c.fill(); }
}

// ═════════════════════════ END CARD (12.5–15s) ═════════════════════════
function endCard(c, t) {
  const w = t - 12.5;
  c.fillStyle = COL.cream; c.fillRect(0, 0, W, H);
  const rg = c.createRadialGradient(W * .85, -H * .1, 0, W * .85, -H * .1, 900);
  rg.addColorStop(0, 'rgba(184,72,30,0.16)'); rg.addColorStop(1, 'rgba(184,72,30,0)');
  c.fillStyle = rg; c.fillRect(0, 0, W, H);

  const push = 1 + .03 * E.outCubic(P(w, .3, 2.5));
  c.save(); c.translate(CX, 540); c.scale(push, push); c.translate(-CX, -540);
  const img = IMG.logo, LW = 1120, k = LW / LOGO.w, LH = LOGO.h * k, lx = CX - LW / 2, ly = 430 - LH / 2;
  const runs = LOGO.runs, HI = runs.findIndex(r => r.y0 > 70), hr = runs[HI];
  const hx = lx + (hr.x0 + hr.x1 + 1) / 2 * k, hy = ly + (hr.y0 + hr.y1 + 1) / 2 * k;
  const hw = (hr.x1 - hr.x0 + 1) * k, hh = (hr.y1 - hr.y0 + 1) * k;
  // the dot travels to become the hyphen
  const mp = P(w, .12, .38), em = E.inOutCubic(mp);
  const dx = lerp(CX, hx, em), dy = lerp(CY, hy, em) - Math.sin(mp * Math.PI) * 90;
  const mo = E.outBack(P(w, .34, .56), 2.2);
  if (w < .62) {
    const bw = lerp(44, hw, mo), bh = lerp(44, hh, clamp(mo));
    c.fillStyle = COL.hyphen; rrect(c, dx - bw / 2, dy - bh / 2, bw, bh, Math.min(bw, bh) / 2); c.fill();
  }
  runs.forEach((r, i) => {
    const sw = r.x1 - r.x0 + 1;
    if (i === HI) {
      if (w >= .5) { c.save(); c.globalAlpha = P(w, .5, .62); c.drawImage(img, r.x0, 0, sw, LOGO.h, lx + r.x0 * k, ly, sw * k, LH); c.restore(); }
      return;
    }
    const dir = i < HI ? -1 : 1, d = Math.abs(i - HI), dl = .42 + d * .055;
    const e = E.outExpo(P(w, dl, dl + .6)), eb = E.outBack(P(w, dl, dl + .5), 2.6);
    if (w < dl) return;
    const bx = lx + (r.x0 + sw / 2) * k, by = ly + LH;
    c.save(); c.globalAlpha = P(w, dl, dl + .1);
    c.translate(bx + dir * (1 - e) * 420, by - (1 - eb) * 40); c.rotate(dir * (1 - eb) * .35);
    c.scale(1 + (1 - e) * .5, 1 - (1 - e) * .2);
    c.drawImage(img, r.x0, 0, sw, LOGO.h, -sw * k / 2, -LH, sw * k, LH); c.restore();
  });
  // tagline
  setFont(c, 700, 28, FT.mono, 10);
  const tag = 'APP DEVELOPMENT', tw = c.measureText(tag).width, te = E.outExpo(P(w, 1.0, 1.55));
  c.save(); c.beginPath(); c.rect(CX - tw / 2 * te - 6, 560, tw * te + 12, 70); c.clip();
  c.fillStyle = COL.brown; c.textAlign = 'center'; c.fillText(tag, CX + 5, 606); c.restore();
  const sl = 90 * E.outExpo(P(w, 1.12, 1.6));
  c.fillStyle = COL.orange; c.fillRect(CX - tw / 2 - 30 - sl, 595, sl, 3); c.fillRect(CX + tw / 2 + 30, 595, sl, 3);
  // app icons
  [IMG.ic1, IMG.ic2, IMG.ic3].forEach((im, i) => {
    const e = E.outBack(P(w, 1.25 + i * .08, 1.65 + i * .08), 2.4);
    if (e > 0) iconCard(c, im, CX + (i - 1) * 150, 760 + (1 - clamp(e)) * 40, 108, { sx: e, sy: e, shadow: true });
  });
  // contact
  const ce = E.outCubic(P(w, 1.55, 1.95));
  setFont(c, 500, 24, FT.mono, 3); c.fillStyle = COL.muted; c.globalAlpha = ce; c.textAlign = 'center';
  c.fillText('tkc-works.net   ·   info@tkc-works.net', CX, 920 + (1 - ce) * 20);
  c.textAlign = 'left'; c.globalAlpha = 1;
  c.restore();
}

// ═════════════════════════ TRANSITIONS & MASTER ═════════════════════════
function barsCover(c, t) {
  const n = 9, bh = H / n;
  for (let i = 0; i < n; i++) { const e = E.inOutQuart(P(t, 3.62 + i * .016, 3.77 + i * .016));
    c.fillStyle = i % 2 ? COL.red : COL.ink; c.fillRect(-W + W * e, i * bh - 1, W, bh + 2); }
}
function barsUncover(c, t) {
  const n = 9, bh = H / n;
  for (let i = 0; i < n; i++) { const e = E.inOutQuart(P(t, 3.92 + i * .016, 4.1 + i * .016));
    c.fillStyle = i % 2 ? COL.red : COL.ink; c.fillRect(W * e, i * bh - 1, W, bh + 2); }
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
    c.save(); c.beginPath(); c.arc(CX, CY, 1150 * E.outExpo(P(t, 12.36, 12.72)), 0, TAU); c.clip(); endCard(c, t); c.restore();
  }
  else endCard(c, t);
  c.restore();
}

// ───────── HUD (drawn sharp, after motion blur) ─────────
const SCENES = [[0, '00 — INTRO'], [2, '01 — CONCEPT'], [3.92, '02 — WORK / しのばせトーク'], [6.05, '03 — WORK / おえかき探偵団'],
  [8.12, '04 — WORK / のぼるひと'], [10.0, '05 — CRAFT & TIMING'], [12.5, '']];
function hud(c, t, f) {
  const dark = t < 1.98 || (t >= 9.95 && t < 12.5);
  const rgb = dark ? '250,246,236' : '43,33,24';
  const a = .8 * E.outCubic(P(t, .25, .6)), fade = 1 - P(t, 12.4, 12.7);
  const M = 56, L = 30;
  c.save(); c.strokeStyle = `rgba(${rgb},${a * .7})`; c.lineWidth = 2; c.beginPath();
  for (const [x, y, sx, sy] of [[M, M, 1, 1], [W - M, M, -1, 1], [M, H - M, 1, -1], [W - M, H - M, -1, -1]]) {
    c.moveTo(x, y + sy * L); c.lineTo(x, y); c.lineTo(x + sx * L, y); }
  c.stroke();
  c.fillStyle = `rgba(${rgb},${a})`;
  setFont(c, 700, 17, FT.mono, 4); c.fillText('TKC-WORKS  ·  SHOWREEL 2026', 96, 100);
  c.globalAlpha = fade;
  const ss = String(Math.floor(t)).padStart(2, '0'), ff = String(f % FPS).padStart(2, '0');
  const tc = `TC 00:00:${ss}:${ff}`; c.textAlign = 'right'; c.fillText(tc, W - 96, 100);
  const tcw = c.measureText(tc).width; c.textAlign = 'left';
  if (Math.floor(t * 2) % 2 === 0) { c.fillStyle = `rgba(214,48,52,${a})`; c.beginPath(); c.arc(W - 96 - tcw - 22, 94, 7, 0, TAU); c.fill(); }
  let sIdx = 0; SCENES.forEach((s, i) => { if (t >= s[0]) sIdx = i; });
  const lab = SCENES[sIdx][1], n = Math.floor((t - SCENES[sIdx][0]) / .014);
  c.fillStyle = `rgba(${rgb},${a})`; setFont(c, 700, 17, FT.mono, 4);
  c.fillText([...lab].slice(0, n).join(''), 96, H - 90);
  c.fillStyle = `rgba(${rgb},${a * .25})`; c.fillRect(W - 96 - 240, H - 98, 240, 3);
  c.fillStyle = `rgba(${rgb},${a})`; c.fillRect(W - 96 - 240, H - 98, 240 * (t / DUR), 3);
  setFont(c, 500, 14, FT.mono, 3); c.textAlign = 'right';
  c.fillText(`${String(f).padStart(3, '0')} / ${DUR * FPS}`, W - 96, H - 112); c.textAlign = 'left';
  c.restore();
}
let VIG = null;
function post(c, t, f) {
  hud(c, t, f);
  c.fillStyle = VIG; c.fillRect(0, 0, W, H);
  c.save(); c.globalCompositeOperation = 'overlay'; c.globalAlpha = .075;
  const tile = GRAIN[f % GRAIN.length], ox = (f * 137) % 256, oy = (f * 71) % 256;
  for (let y = -oy; y < H; y += 256) for (let x = -ox; x < W; x += 256) c.drawImage(tile, x, y);
  c.restore();
}

function drawFrame(f, sub = SUB) {
  const t = f / FPS;
  out.globalCompositeOperation = 'source-over'; out.globalAlpha = 1;
  for (let i = 0; i < sub; i++) {
    const ts = clamp(t + (sub > 1 ? (i / (sub - 1) - .5) : 0) * SHUTTER / FPS, 0, DUR - 1e-4);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    render(ctx, ts);
    out.globalAlpha = 1 / (i + 1); out.drawImage(sc, 0, 0);
  }
  out.globalAlpha = 1; post(out, t, f);
}

async function init() {
  await Promise.all([loadImg('logo', '../assets/logo.png'), loadImg('ic1', '../assets/shinobase-talk-icon.png'),
    loadImg('ic2', '../assets/oekaki-tanteidan-icon.png'), loadImg('ic3', '../assets/noboruhito-icon.png')]);
  const jp = 'つくることで、もっと楽しく。しのばせトークおえかき探偵団のぼるひとスマホ1台で遊べる、言葉当てパーティーゲームヒントを頼りに絵を描いて、みんなでお題を推理する新感覚パーティーゲームどこまで高く登れるかに挑む、シンプル操作のタワークライムゲーム' + WORDS.join('') + '—×·／';
  await Promise.all([
    document.fonts.load('800 100px "Unbounded"', 'APPDEVELOMNT0123456789&'), document.fonts.load('700 100px "Unbounded"', 'ABC'),
    document.fonts.load('900 100px "Noto Sans JP"', jp), document.fonts.load('500 100px "Noto Sans JP"', jp), document.fonts.load('700 100px "Noto Sans JP"', jp),
    document.fonts.load('700 100px "JetBrains Mono"', 'ABC0123—×·'), document.fonts.load('500 100px "JetBrains Mono"', 'ABC0123—×·'),
    document.fonts.load('400 100px "DotGothic16"', 'のぼるひと▲m0123456789'),
  ]);
  await document.fonts.ready;
  analyzeLogo(); makeGrain();
  BG3 = ctx.createLinearGradient(0, 0, 0, H); BG3.addColorStop(0, COL.yellow); BG3.addColorStop(1, COL.yellow2);
  VIG = out.createRadialGradient(CX, CY, H * .55, CX, CY, H * 1.15);
  VIG.addColorStop(0, 'rgba(20,10,4,0)'); VIG.addColorStop(1, 'rgba(20,10,4,0.16)');
  window.READY = true;
}
window.renderFrame = (f, sub) => { drawFrame(f, sub); return cv.toDataURL('image/jpeg', .95); };
window.LOGO_INFO = () => LOGO;
init().then(() => {
  if (QS.has('render')) return;
  const t0 = performance.now();
  const loop = () => { const f = Math.floor(((performance.now() - t0) / 1000 % DUR) * FPS); drawFrame(f, 1); requestAnimationFrame(loop); };
  loop();
});
