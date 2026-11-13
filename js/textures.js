// 手続きテクスチャ（壁・床・ラグ・布・革・木目・額絵）。すべて Canvas 生成、画像ファイルなし。
import * as THREE from 'three';

export function rng(seed) {
  let h = 2166136261; for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return function () { h |= 0; h = h + 0x6D2B79F5 | 0; let t = Math.imul(h ^ h >>> 15, 1 | h); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function shade(hex, f) {
  let h = hex.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join('');
  let r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  if (f < 1) { r *= f; g *= f; b *= f; } else { const t = f - 1; r += (255 - r) * t; g += (255 - g) * t; b += (255 - b) * t; }
  return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
}
export function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
const cache = new Map();
function cached(key, fn) { let v = cache.get(key); if (!v) { v = fn(); cache.set(key, v); } return v; }

// 全面に細かいノイズ（質感）
function grain(c, w, h, amt, seed) {
  const r = rng(seed || 'g'), x = c.getContext('2d'), id = x.getImageData(0, 0, w, h), d = id.data;
  for (let i = 0; i < d.length; i += 4) { const n = (r() - .5) * amt; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  x.putImageData(id, 0, 0);
}
export function canvasToTex(cv, rx, ry) {
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4; if (rx) t.repeat.set(rx, ry || rx); return t;
}
// キー付きの共有テクスチャ
export function texOf(key, w, h, draw, rx, ry) {
  return cached('T' + key, () => { const cv = mkCanvas(w, h); draw(cv.getContext('2d'), w, h, cv); return canvasToTex(cv, rx, ry); });
}

// ===== 壁（512x870 = 横2単位 x 高さ3.4単位）=====
function brickWall(c, W, H, col, mortar, seed, tint) {
  const r = rng(seed), ch = H / 24, bw = W / 4;
  c.fillStyle = mortar; c.fillRect(0, 0, W, H);
  for (let j = 0; j < 24; j++) for (let i = -1; i < 4; i++) {
    const x = i * bw + (j % 2 ? bw / 2 : 0), y = j * ch, k = .82 + r() * .3;
    c.fillStyle = shade(col, k); c.fillRect(x + 2, y + 2, bw - 4, ch - 4);
    c.fillStyle = 'rgba(255,255,255,' + (.05 + r() * .06) + ')'; c.fillRect(x + 2, y + 2, bw - 4, 3);
    c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(x + 2, y + ch - 6, bw - 4, 4);
    for (let n = 0; n < 6; n++) { c.fillStyle = 'rgba(' + tint + ',' + (r() * .18) + ')'; c.fillRect(x + 2 + r() * bw, y + 3 + r() * ch * .6, 2 + r() * 8, 2); }
  }
}
const WALLS = {
  plaster: (c, W, H) => {
    c.fillStyle = '#efe4d0'; c.fillRect(0, 0, W, H);
    const r = rng('pl');
    for (let i = 0; i < 160; i++) { c.fillStyle = 'rgba(' + (r() > .5 ? '255,250,240' : '150,120,90') + ',' + (.04 + r() * .06) + ')'; c.beginPath(); c.ellipse(r() * W, r() * H, 20 + r() * 70, 14 + r() * 40, r() * 3, 0, 7); c.fill(); }
  },
  brickRed: (c, W, H) => brickWall(c, W, H, '#a8503a', '#cdbba2', 'br', '60,20,10'),
  brickWhite: (c, W, H) => brickWall(c, W, H, '#efe9de', '#c9c1b2', 'bw', '120,110,90'),
  brickGray: (c, W, H, p) => brickWall(c, W, H, p.a, p.b, 'bg', '60,60,70'),
  // ボタニカル：葉っぱを散らした壁紙（上下左右につながるように、はみ出した分を反対側にも描く）
  leaf: (c, W, H, p) => {
    c.fillStyle = p.a; c.fillRect(0, 0, W, H); const r = rng('lf' + p.b);
    for (let i = 0; i < 46; i++) {
      const x = r() * W, y = r() * H, a = r() * Math.PI * 2, L = 30 + r() * 26, k = .85 + r() * .3;
      for (const dx of [0, -W, W]) for (const dy of [0, -H, H]) {
        c.save(); c.translate(x + dx, y + dy); c.rotate(a); c.fillStyle = shade(p.b, k); c.globalAlpha = .9;
        c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(L * .5, -L * .32, L, 0); c.quadraticCurveTo(L * .5, L * .32, 0, 0); c.fill();
        c.strokeStyle = shade(p.b, .7); c.lineWidth = 1.5; c.beginPath(); c.moveTo(-6, 0); c.lineTo(L * .85, 0); c.stroke(); c.restore();
      }
    }
    c.globalAlpha = 1;
  },
  wainscot: (c, W, H) => {
    c.fillStyle = '#efe4cf'; c.fillRect(0, 0, W, H);
    const r = rng('wn'), top = H * (1 - 1.15 / 3.4);
    for (let i = 0; i < 90; i++) { c.fillStyle = 'rgba(160,130,90,' + (r() * .05) + ')'; c.beginPath(); c.ellipse(r() * W, r() * top, 30 + r() * 60, 20 + r() * 30, 0, 0, 7); c.fill(); }
    c.fillStyle = '#7a4a2a'; c.fillRect(0, top, W, H - top);
    const pw = W / 2;
    for (let i = 0; i < 2; i++) {
      const x = i * pw + 18, y = top + 46, w = pw - 36, h = H - top - 80;
      c.fillStyle = '#6a3e22'; c.fillRect(x, y, w, h); c.fillStyle = '#8a5a34'; c.fillRect(x + 8, y + 8, w - 16, h - 16);
      c.strokeStyle = 'rgba(40,20,5,.35)'; c.lineWidth = 2; c.strokeRect(x + 8, y + 8, w - 16, h - 16);
      for (let k = 0; k < 22; k++) { c.strokeStyle = 'rgba(60,30,10,' + (.08 + r() * .1) + ')'; c.beginPath(); const yy = y + 12 + r() * (h - 24); c.moveTo(x + 8, yy); c.lineTo(x + w - 8, yy + (r() - .5) * 4); c.stroke(); }
    }
    c.fillStyle = '#5a3219'; c.fillRect(0, top - 8, W, 16); c.fillStyle = '#9c6b40'; c.fillRect(0, top - 8, W, 4);
  },
  stripe: (c, W, H, p) => {
    c.fillStyle = p.a; c.fillRect(0, 0, W, H); c.fillStyle = p.b;
    for (let i = 0; i < 8; i++) c.fillRect(i * W / 8 + W / 32, 0, W / 16, H);
  },
  gingham: (c, W, H, p) => {
    c.fillStyle = p.a; c.fillRect(0, 0, W, H); const s = 32;
    c.fillStyle = p.b; c.globalAlpha = .45; for (let x = 0; x < W; x += s * 2) c.fillRect(x, 0, s, H); for (let y = 0; y < H; y += s * 2) c.fillRect(0, y, W, s); c.globalAlpha = 1;
  },
  cloud: (c, W, H, p) => {
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, p.a); g.addColorStop(1, '#eaf6ff'); c.fillStyle = g; c.fillRect(0, 0, W, H); const r = rng('cl'); c.fillStyle = p.b; c.globalAlpha = .85;
    for (let k = 0; k < 6; k++) { const x = r() * W, y = 60 + k * 140 + r() * 40; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(x + i * 22 - 33, y + (i % 2 ? -10 : 0), 22 + (i % 3) * 6, 0, 7); c.fill(); } c.fillRect(x - 55, y, 88, 18); }
    c.globalAlpha = 1;
  },
  plain: (c, W, H, p) => {
    c.fillStyle = p.a; c.fillRect(0, 0, W, H); const r = rng('pn' + p.a);
    for (let i = 0; i < 90; i++) { c.fillStyle = 'rgba(255,255,255,' + (r() * .05) + ')'; c.beginPath(); c.ellipse(r() * W, r() * H, 30 + r() * 60, 20 + r() * 30, 0, 0, 7); c.fill(); }
  },
  dot: (c, W, H, p) => {
    c.fillStyle = p.a; c.fillRect(0, 0, W, H); c.fillStyle = p.b;
    for (let y = 0; y < 18; y++) for (let x = 0; x < 8; x++) { c.beginPath(); c.arc(x * 64 + (y % 2 ? 32 : 0), y * 48 + 20, 7, 0, 7); c.fill(); }
  },
  // 縦の板張り（全面）
  boardV: (c, W, H, p) => {
    const r = rng('bv' + p.a), n = 6, bw = W / n;
    for (let i = 0; i < n; i++) {
      c.fillStyle = shade(p.a, .96 + r() * .07); c.fillRect(i * bw, 0, bw, H);
      for (let k = 0; k < 9; k++) { c.strokeStyle = 'rgba(120,100,70,' + (.03 + r() * .05) + ')'; c.lineWidth = 1 + r(); c.beginPath(); const x = i * bw + 6 + r() * (bw - 12); c.moveTo(x, 0); c.bezierCurveTo(x + (r() - .5) * 6, H * .33, x + (r() - .5) * 6, H * .66, x + (r() - .5) * 4, H); c.stroke(); }
      c.fillStyle = 'rgba(70,58,40,.32)'; c.fillRect(i * bw, 0, 3, H); c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(i * bw + 3, 0, 2, H);
    }
  },
  // 白くぬった縦の羽目板：うっすら木目が透け、板の継ぎ目に細い溝（V溝）と小さな節
  boardW: (c, W, H, p) => {
    const r = rng('bW' + p.a), n = 8, bw = W / n;
    for (let i = 0; i < n; i++) {
      c.fillStyle = shade(p.a, .955 + r() * .06); c.fillRect(i * bw, 0, bw, H);
      for (let k = 0; k < 16; k++) {
        c.strokeStyle = r() > .35 ? 'rgba(130,108,78,' + (.035 + r() * .05) + ')' : 'rgba(255,255,255,' + (.2 + r() * .15) + ')'; c.lineWidth = .8 + r() * 1.4;
        const x = i * bw + 4 + r() * (bw - 8), w1 = (r() - .5) * 7, w2 = (r() - .5) * 7; c.beginPath(); c.moveTo(x, 0); c.bezierCurveTo(x + w1, H * .3, x + w2, H * .65, x + (r() - .5) * 5, H); c.stroke();
      }
      if (r() > .4) { const kx = i * bw + bw * (.3 + r() * .4), ky = H * (.15 + r() * .7); c.strokeStyle = 'rgba(120,95,65,.16)'; c.lineWidth = 1.2; for (let q = 1; q < 4; q++) { c.beginPath(); c.ellipse(kx, ky, 2 + q * 2, 5 + q * 4, 0, 0, 7); c.stroke(); } }
      c.fillStyle = 'rgba(95,80,58,.4)'; c.fillRect(i * bw, 0, 2.5, H); c.fillStyle = 'rgba(70,58,40,.14)'; c.fillRect(i * bw + 2.5, 0, 3, H); c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(i * bw + 5.5, 0, 2, H);
    }
  },
  // 正方形の白タイル（目地あり）
  tileWall: (c, W, H, p) => {
    const s = W / 8, r = rng('tw' + p.a); c.fillStyle = p.b; c.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += s) for (let x = 0; x < W; x += s) {
      const g = c.createLinearGradient(x, y, x + s, y + s); g.addColorStop(0, shade(p.a, 1.04)); g.addColorStop(1, shade(p.a, .95 + r() * .03));
      c.fillStyle = g; c.fillRect(x + 3, y + 3, s - 6, s - 6); c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(x + 4, y + 4, s - 10, 3);
    }
  },
  // 腰壁：上は塗り壁(a)、下は縦板(b)、境目に木の見切り
  wainscot2: (c, W, H, p) => {
    const r = rng('w2' + p.a), top = H * (1 - 1.15 / 3.4);
    c.fillStyle = p.a; c.fillRect(0, 0, W, top);
    for (let i = 0; i < 90; i++) { c.fillStyle = 'rgba(255,255,255,' + (r() * .06) + ')'; c.beginPath(); c.ellipse(r() * W, r() * top, 30 + r() * 60, 20 + r() * 30, 0, 0, 7); c.fill(); }
    const n = 10, bw = W / n;
    for (let i = 0; i < n; i++) { c.fillStyle = shade(p.b, .97 + r() * .05); c.fillRect(i * bw, top, bw, H - top); c.fillStyle = 'rgba(80,66,46,.28)'; c.fillRect(i * bw, top, 3, H - top); c.fillStyle = 'rgba(255,255,255,.4)'; c.fillRect(i * bw + 3, top, 2, H - top); }
    c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(0, top + 8, W, 8);
    c.fillStyle = '#a8784c'; c.fillRect(0, top - 10, W, 20); c.fillStyle = '#c99c6c'; c.fillRect(0, top - 10, W, 5); c.fillStyle = 'rgba(60,35,15,.35)'; c.fillRect(0, top + 7, W, 3);
  },
  star: (c, W, H, p) => {
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1d2650'); g.addColorStop(1, '#3a4a80'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    const r = rng('st'); c.fillStyle = p.b;
    for (let i = 0; i < 60; i++) { c.globalAlpha = .4 + r() * .6; c.beginPath(); c.arc(r() * W, r() * H, .8 + r() * 2.4, 0, 7); c.fill(); }
    c.globalAlpha = 1;
  }
};
export function wallCanvas(d) {
  return cached('W' + d.id, () => {
    const cv = mkCanvas(512, 870), c = cv.getContext('2d'); (WALLS[d.pat] || WALLS.plain)(c, 512, 870, { a: d.color, b: d.color2 });
    if (d.pat === 'plain' || d.pat === 'plaster' || d.pat === 'wainscot2' || d.pat === 'boardV' || d.pat === 'boardW') grain(cv, 512, 870, 6, d.id); return cv;
  });
}

// ===== 床（512x512 = 2x2単位）=====
function planks(c, W, base, n, seed, dark) {
  const r = rng(seed), ph = W / n;
  for (let j = 0; j < n; j++) {
    let x = -r() * 200; while (x < W) {
      const len = 160 + r() * 240, k = (dark ? .78 : .86) + r() * .26;
      c.fillStyle = shade(base, k); c.fillRect(x, j * ph, len, ph);
      for (let q = 0; q < 7; q++) { c.strokeStyle = 'rgba(70,35,10,' + (.05 + r() * .09) + ')'; c.lineWidth = 1; c.beginPath(); const yy = j * ph + r() * ph; c.moveTo(x, yy); c.lineTo(x + len, yy + (r() - .5) * 3); c.stroke(); }
      c.fillStyle = 'rgba(40,20,5,.55)'; c.fillRect(x, j * ph, 2, ph); x += len;
    }
    c.fillStyle = 'rgba(40,20,5,.5)'; c.fillRect(0, j * ph, W, 2);
    c.fillStyle = 'rgba(255,240,210,.12)'; c.fillRect(0, j * ph + 2, W, 2);
  }
}
const FLOORS = {
  wood: (c, W, p) => planks(c, W, p.a, 8, 'wd' + p.a, false),
  dark: (c, W, p) => planks(c, W, p.a, 8, 'dk' + p.a, true),
  // ヘリンボーン：板1枚ごとに色むら（明るさ＋ほんのり色相）、木目の筋、板の継ぎ目の影
  herring: (c, W, p) => {
    const r = rng('hb' + p.a), B = W / 4, pp = W / 8; c.fillStyle = '#3a200e'; c.fillRect(0, 0, W, W);
    const tint = (k, w) => { const b = shade(p.a, k); return b; };
    for (let b = 0; b < 4; b++) for (let half = 0; half < 2; half++) {
      const xl = b * B + half * B / 2, xr = xl + B / 2, xm = b * B + B / 2, s = half ? -1 : 1;
      c.save(); c.beginPath(); c.rect(xl, 0, B / 2, W); c.clip();
      for (let k = -6; k < 16; k++) {
        const f = (x, kk) => kk * pp + s * (x - xm) * -1, kc = .74 + r() * .5;
        c.fillStyle = tint(kc); c.beginPath();
        c.moveTo(xl, f(xl, k) + 1); c.lineTo(xr, f(xr, k) + 1); c.lineTo(xr, f(xr, k + 1) - 1); c.lineTo(xl, f(xl, k + 1) - 1); c.fill();
        if (r() > .55) { c.fillStyle = 'rgba(255,200,120,' + (.06 + r() * .1) + ')'; c.fill(); }
        c.save(); c.clip();
        for (let q = 0; q < 5; q++) { c.strokeStyle = 'rgba(' + (r() > .5 ? '80,40,10' : '255,225,180') + ',' + (.06 + r() * .12) + ')'; c.lineWidth = .8 + r(); c.beginPath(); const yy = f(xl, k + r()); c.moveTo(xl, yy); c.lineTo(xr, yy + s * -1 * (xr - xl) + (r() - .5) * 4); c.stroke(); }
        c.restore();
        c.strokeStyle = 'rgba(50,25,8,.4)'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(xl, f(xl, k + 1)); c.lineTo(xr, f(xr, k + 1)); c.stroke();
      }
      c.restore();
    }
  },
  tatami: (c, W, p) => {
    c.fillStyle = p.a; c.fillRect(0, 0, W, W); const r = rng('tt');
    for (let i = 0; i < 170; i++) { c.strokeStyle = 'rgba(' + (r() > .5 ? '90,100,40' : '255,255,220') + ',' + (.06 + r() * .1) + ')'; c.lineWidth = 1; const y = r() * W; c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    c.fillStyle = '#2f3a1c'; c.fillRect(0, 0, W, 6); c.fillRect(0, W / 2 - 3, W, 6); c.fillRect(0, W - 6, W, 6); c.fillRect(0, 0, 4, W); c.fillRect(W / 2, 0, 5, W / 2 - 3);
  },
  checker: (c, W, p) => {
    const n = 8, s = W / n; for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { c.fillStyle = (i + j) % 2 ? p.b : p.a; c.fillRect(i * s, j * s, s, s); }
    c.strokeStyle = 'rgba(80,50,30,.25)'; c.lineWidth = 2; for (let i = 0; i <= n; i++) { c.beginPath(); c.moveTo(i * s, 0); c.lineTo(i * s, W); c.moveTo(0, i * s); c.lineTo(W, i * s); c.stroke(); }
  },
  tile: (c, W, p) => {
    c.fillStyle = p.b; c.fillRect(0, 0, W, W); const n = 4, s = W / n;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { c.fillStyle = p.a; c.fillRect(i * s + 3, j * s + 3, s - 6, s - 6); c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(i * s + 3, j * s + 3, s - 6, 5); }
  },
  carpet: (c, W, p) => { c.fillStyle = p.a; c.fillRect(0, 0, W, W); },
  stone: (c, W, p) => {
    c.fillStyle = p.b; c.fillRect(0, 0, W, W); const r = rng('sn');
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { c.fillStyle = shade(p.a, .86 + r() * .25); c.beginPath(); c.roundRect(i * 128 + 4, j * 128 + 4, 120, 120, 14); c.fill(); }
  },
  // 小さな石を敷きつめた床（玄関・土間ふう）
  cobble: (c, W, p) => {
    c.fillStyle = p.b; c.fillRect(0, 0, W, W); const r = rng('cb'), n = 10, s = W / n;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const ox = (j % 2 ? s / 2 : 0), w = s * (.78 + r() * .14), h = s * (.74 + r() * .16), x = i * s + ox + (s - w) / 2 + (r() - .5) * 4, y = j * s + (s - h) / 2 + (r() - .5) * 4;
      for (const dx of [0, -W]) { c.fillStyle = shade(p.a, .84 + r() * .24); c.beginPath(); c.roundRect(x + dx, y, w, h, s * .3); c.fill(); c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.roundRect(x + dx + 3, y + 2, w - 8, h * .35, s * .2); c.fill(); }
    }
  },
  // 六角タイル（つなぎ目が出ないように横7・縦10段）
  hex: (c, W, p) => {
    c.fillStyle = p.b; c.fillRect(0, 0, W, W); const r = rng('hx'), dx = W / 7, dy = W / 10, hw = dx / 2 - 2.5, R = dy / 1.5 - 2.5;
    for (let j = -1; j <= 10; j++) for (let i = -1; i <= 7; i++) {
      const cx = i * dx + (j % 2 ? dx / 2 : 0), cy = j * dy; c.fillStyle = shade(p.a, .95 + r() * .07);
      c.beginPath(); c.moveTo(cx, cy - R); c.lineTo(cx + hw, cy - R / 2); c.lineTo(cx + hw, cy + R / 2); c.lineTo(cx, cy + R); c.lineTo(cx - hw, cy + R / 2); c.lineTo(cx - hw, cy - R / 2); c.closePath(); c.fill();
    }
  }
};
export function floorCanvas(d) {
  return cached('F' + d.id, () => {
    const cv = mkCanvas(512, 512), c = cv.getContext('2d'); (FLOORS[d.pat] || FLOORS.wood)(c, 512, { a: d.color, b: d.color2 });
    grain(cv, 512, 512, d.pat === 'carpet' ? 22 : 8, d.id); return cv;
  });
}

// ===== 生地・革・木目（家具用） =====
export function fabricTex(color, kind) {
  return texOf('fab' + kind + color, 128, 128, (c, W) => {
    c.fillStyle = color; c.fillRect(0, 0, W, W);
    if (kind === 'leather') { const r = rng('lt' + color); for (let i = 0; i < 400; i++) { c.fillStyle = 'rgba(0,0,0,' + (r() * .12) + ')'; c.beginPath(); c.arc(r() * W, r() * W, 1 + r() * 3, 0, 7); c.fill(); } for (let i = 0; i < 12; i++) { c.fillStyle = 'rgba(255,255,255,' + (r() * .06) + ')'; c.beginPath(); c.ellipse(r() * W, r() * W, 20, 8, r() * 3, 0, 7); c.fill(); } }
    else { c.strokeStyle = 'rgba(0,0,0,.09)'; for (let i = 0; i < W; i += 3) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, W); c.stroke(); c.beginPath(); c.moveTo(0, i); c.lineTo(W, i); c.stroke(); } }
  }, 2, 2);
}
export function woodTex(color) {
  return texOf('wood' + color, 256, 256, (c, W) => {
    c.fillStyle = color; c.fillRect(0, 0, W, W); const r = rng('wt' + color);
    for (let i = 0; i < 46; i++) { c.strokeStyle = r() > .5 ? 'rgba(60,30,8,' + (.05 + r() * .12) + ')' : 'rgba(255,230,190,' + (.04 + r() * .07) + ')'; c.lineWidth = .6 + r() * 2; c.beginPath(); const y = r() * W; c.moveTo(0, y); c.bezierCurveTo(W / 3, y + (r() - .5) * 14, W * .66, y + (r() - .5) * 14, W, y + (r() - .5) * 8); c.stroke(); }
  });
}

// ===== ラグ =====
export function rugTexture(kind, a, b) {
  return texOf('rug' + kind + a + b, 512, 512, (c, W) => {
    const r = rng('rg' + kind);
    if (kind === 'check') {
      c.fillStyle = b; c.fillRect(0, 0, W, W); c.fillStyle = a; const n = 8, s = W / n;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) if ((i + j) % 2) c.fillRect(i * s, j * s, s, s);
      c.strokeStyle = shade(a, .7); c.lineWidth = 10; c.strokeRect(5, 5, W - 10, W - 10); return;
    }
    if (kind === 'plain') {
      c.fillStyle = a; c.fillRect(0, 0, W, W);
      for (let i = 0; i < 1400; i++) { c.fillStyle = r() > .5 ? b : shade(a, .88); c.globalAlpha = .35; c.fillRect(r() * W, r() * W, 3 + r() * 6, 3); }
      c.globalAlpha = 1; c.strokeStyle = b; c.lineWidth = 8; c.strokeRect(22, 22, W - 44, W - 44); return;
    }
    // persian：赤地に紺の縁取り、中央メダリオン
    c.fillStyle = '#8c2a2a'; c.fillRect(0, 0, W, W);
    c.fillStyle = '#1f2f54'; c.fillRect(18, 18, W - 36, W - 36); c.fillStyle = '#e9d7a6'; c.fillRect(30, 30, W - 60, W - 60);
    c.fillStyle = '#7e2424'; c.fillRect(44, 44, W - 88, W - 88);
    c.strokeStyle = '#e9d7a6'; c.lineWidth = 3;
    for (let i = 0; i < 16; i++) { const t = 44 + (i + .5) * (W - 88) / 16; c.beginPath(); c.arc(t, 37, 4, 0, 7); c.stroke(); c.beginPath(); c.arc(t, W - 37, 4, 0, 7); c.stroke(); c.beginPath(); c.arc(37, t, 4, 0, 7); c.stroke(); c.beginPath(); c.arc(W - 37, t, 4, 0, 7); c.stroke(); }
    for (let gy = 0; gy < 6; gy++) for (let gx = 0; gx < 6; gx++) {
      const x = 74 + gx * 72.5, y = 74 + gy * 72.5; c.fillStyle = (gx + gy) % 2 ? '#2b3f6e' : '#c9a24a';
      c.beginPath(); c.moveTo(x, y - 12); c.lineTo(x + 12, y); c.lineTo(x, y + 12); c.lineTo(x - 12, y); c.fill();
    }
    c.save(); c.translate(W / 2, W / 2);
    c.fillStyle = '#1f2f54'; c.beginPath(); c.moveTo(0, -150); c.lineTo(110, 0); c.lineTo(0, 150); c.lineTo(-110, 0); c.fill();
    c.fillStyle = '#c9a24a'; c.beginPath(); c.moveTo(0, -112); c.lineTo(82, 0); c.lineTo(0, 112); c.lineTo(-82, 0); c.fill();
    c.fillStyle = '#8c2a2a'; c.beginPath(); c.moveTo(0, -78); c.lineTo(56, 0); c.lineTo(0, 78); c.lineTo(-56, 0); c.fill();
    c.fillStyle = '#e9d7a6'; c.beginPath(); c.arc(0, 0, 24, 0, 7); c.fill(); c.fillStyle = '#1f2f54'; c.beginPath(); c.arc(0, 0, 11, 0, 7); c.fill();
    c.restore(); grain(c.canvas, W, W, 18, 'rug');
  });
}

// ===== 壁かけ・小物の絵 =====
const DRAW = {
  poster: (c, W, H, d) => { c.fillStyle = d.color2; c.fillRect(0, 0, W, H); c.fillStyle = d.color; c.fillRect(14, 14, W - 28, H - 28); c.fillStyle = '#fff'; c.font = 'bold ' + (W * .2) + 'px sans-serif'; c.textAlign = 'center'; c.fillText('合格', W / 2, H * .45); c.fillText('祈願', W / 2, H * .72); c.beginPath(); c.arc(W / 2, H * .85, W * .06, 0, 7); c.fill(); },
  map: (c, W, H) => { c.fillStyle = '#c8e4ee'; c.fillRect(0, 0, W, H); c.fillStyle = '#9bbf7a'; [[.2, .35, .13, .2], [.45, .3, .09, .13], [.5, .6, .09, .16], [.75, .4, .16, .17], [.85, .75, .07, .06]].forEach(([x, y, rx, ry]) => { c.beginPath(); c.ellipse(W * x, H * y, W * rx, H * ry, .3, 0, 7); c.fill(); }); c.strokeStyle = 'rgba(80,110,130,.3)'; for (let i = 1; i < 6; i++) { c.beginPath(); c.moveTo(0, H * i / 6); c.lineTo(W, H * i / 6); c.stroke(); } },
  calendar: (c, W, H, d) => { c.fillStyle = '#fffaf0'; c.fillRect(0, 0, W, H); c.fillStyle = d.color2; c.fillRect(0, 0, W, H * .22); c.fillStyle = '#fff'; c.font = 'bold ' + (H * .12) + 'px sans-serif'; c.textAlign = 'center'; c.fillText('11月', W / 2, H * .16); c.fillStyle = '#6b5646'; for (let j = 0; j < 5; j++) for (let i = 0; i < 7; i++) { c.fillRect(W * .1 + i * W * .125, H * .3 + j * H * .13, W * .07, H * .06); } },
  painting: (c, W, H, d) => { const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#9fd0ea'); g.addColorStop(.55, '#e9f0d8'); g.addColorStop(.56, '#7fae62'); g.addColorStop(1, '#4f8a4a'); c.fillStyle = g; c.fillRect(0, 0, W, H); c.fillStyle = '#6f8f64'; c.beginPath(); c.moveTo(0, H * .6); c.quadraticCurveTo(W * .3, H * .38, W * .55, H * .58); c.quadraticCurveTo(W * .8, H * .45, W, H * .6); c.lineTo(W, H * .7); c.lineTo(0, H * .7); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.ellipse(W * .3, H * .2, W * .12, H * .06, 0, 0, 7); c.fill(); c.fillStyle = '#c45a3a'; c.fillRect(W * .62, H * .52, W * .1, H * .1); c.fillStyle = '#7a3a22'; c.beginPath(); c.moveTo(W * .6, H * .52); c.lineTo(W * .67, H * .43); c.lineTo(W * .74, H * .52); c.fill(); },
  still: (c, W, H) => { c.fillStyle = '#d8c9a4'; c.fillRect(0, 0, W, H); c.fillStyle = '#7b5a3a'; c.fillRect(0, H * .72, W, H * .28); c.fillStyle = '#3c6a8a'; c.beginPath(); c.ellipse(W * .4, H * .6, W * .15, H * .2, 0, 0, 7); c.fill(); c.fillStyle = '#c0392b'; c.beginPath(); c.arc(W * .68, H * .68, W * .08, 0, 7); c.fill(); c.fillStyle = '#e1b12c'; c.beginPath(); c.arc(W * .8, H * .7, W * .06, 0, 7); c.fill(); },
  portrait: (c, W, H) => { c.fillStyle = '#6d7b5d'; c.fillRect(0, 0, W, H); c.fillStyle = '#3d2b20'; c.beginPath(); c.ellipse(W / 2, H * .42, W * .22, H * .24, 0, 0, 7); c.fill(); c.fillStyle = '#e8c9a8'; c.beginPath(); c.ellipse(W / 2, H * .46, W * .17, H * .2, 0, 0, 7); c.fill(); c.fillStyle = '#4a3a5a'; c.beginPath(); c.moveTo(W * .15, H); c.quadraticCurveTo(W / 2, H * .55, W * .85, H); c.fill(); },
  clockface: (c, W, H) => { c.fillStyle = '#fff6e0'; c.beginPath(); c.arc(W / 2, H / 2, W / 2 - 2, 0, 7); c.fill(); c.strokeStyle = '#3a2a1a'; c.lineWidth = 3; for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6, r1 = W * .4, r2 = W * (i % 3 ? .44 : .38); c.beginPath(); c.moveTo(W / 2 + Math.sin(a) * r1, H / 2 - Math.cos(a) * r1); c.lineTo(W / 2 + Math.sin(a) * r2, H / 2 - Math.cos(a) * r2); c.stroke(); } c.lineWidth = 5; c.beginPath(); c.moveTo(W / 2, H / 2); c.lineTo(W / 2 + W * .16, H / 2 - H * .12); c.stroke(); c.lineWidth = 3; c.beginPath(); c.moveTo(W / 2, H / 2); c.lineTo(W / 2 - W * .02, H / 2 - H * .32); c.stroke(); },
  // 夕暮れの窓の外：上は青い空、地平線にかけてほんのり紫〜あんず色。うっすら雲と一番星
  sky: (c, W, H) => { const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#3f5f9e'); g.addColorStop(.5, '#7f90c4'); g.addColorStop(.8, '#d9a8b0'); g.addColorStop(1, '#f2c39a'); c.fillStyle = g; c.fillRect(0, 0, W, H); c.fillStyle = 'rgba(255,225,215,.35)'; [[.25, .62], [.72, .72], [.5, .5]].forEach(([x, y]) => { c.beginPath(); c.ellipse(W * x, H * y, W * .2, H * .035, 0, 0, 7); c.fill(); }); c.fillStyle = 'rgba(255,255,255,.9)'; [[.2, .12], [.7, .2], [.45, .08]].forEach(([x, y]) => { c.beginPath(); c.arc(W * x, H * y, 1.6, 0, 7); c.fill(); }); },
  tv: (c, W, H) => { const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#3b5f8a'); g.addColorStop(1, '#8fb4d6'); c.fillStyle = g; c.fillRect(0, 0, W, H); c.fillStyle = 'rgba(255,255,255,.7)'; c.fillRect(W * .12, H * .62, W * .3, H * .08); c.fillRect(W * .12, H * .75, W * .5, H * .05); c.fillStyle = 'rgba(255,255,255,.12)'; c.beginPath(); c.moveTo(0, 0); c.lineTo(W * .5, 0); c.lineTo(0, H * .6); c.fill(); },
  record: (c, W, H) => { c.fillStyle = '#16120f'; c.fillRect(0, 0, W, H); c.strokeStyle = 'rgba(255,255,255,.07)'; for (let r = 20; r < W / 2 - 4; r += 5) { c.beginPath(); c.arc(W / 2, H / 2, r, 0, 7); c.stroke(); } c.fillStyle = '#c0392b'; c.beginPath(); c.arc(W / 2, H / 2, W * .15, 0, 7); c.fill(); },
  book: (c, W, H, d) => { c.fillStyle = d.color; c.fillRect(0, 0, W, H); c.fillStyle = d.color2; c.fillRect(W * .12, H * .12, W * .76, H * .3); }
};
export function artTex(kind, d, W = 256, H = 256) {
  return texOf('art' + kind + (d ? d.id : ''), W, H, (c, w, h) => DRAW[kind](c, w, h, d || {}));
}
export function swatchCanvas(d, size) {
  const cv = mkCanvas(size, size), c = cv.getContext('2d'), src = d.cat === 'wallpaper' ? wallCanvas(d) : floorCanvas(d);
  if (d.cat === 'wallpaper') c.drawImage(src, 0, 80, 512, 512, 0, 0, size, size); else c.drawImage(src, 0, 0, 512, 512, 0, 0, size, size);
  return cv;
}

// ===== PBRテクスチャ（Poly Haven CC0 / assets/tex/*.jpg）=====
export const texHook = { onLoad() { } };
const TL = new THREE.TextureLoader();
// 読み込めたら cb(texture)。失敗しても何も起きない（手続きテクスチャのまま）。
export function loadTex(url, srgb, rx, ry, cb) {
  const t = TL.load(url, () => { cb && cb(t); texHook.onLoad(); }, undefined, () => { });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.repeat.set(rx || 1, ry || rx || 1);
  return t;
}
// 家具用の共有テクスチャ：読み込みまでは中立値の1x1を仮置きし、届いたら差し替える
const shared = new Map();
export function sharedTex(name, suf, rep) {
  const k = name + suf + rep; let t = shared.get(k); if (t) return t;
  const cv = mkCanvas(1, 1), c = cv.getContext('2d'); c.fillStyle = suf === 'nor' ? 'rgb(128,128,255)' : '#fff'; c.fillRect(0, 0, 1, 1);
  t = new THREE.Texture(cv); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.colorSpace = THREE.NoColorSpace; t.repeat.set(rep, rep);
  shared.set(k, t);
  const img = new Image(); img.onload = () => { t.dispose(); t.image = img; t.needsUpdate = true; texHook.onLoad(); }; img.src = 'assets/tex/' + name + '_' + suf + '.jpg';
  return t;
}
// 床：s = 1枚のテクスチャが覆う実寸（単位）。diff=true なら写真の色（輝度のみ）を使い color で着色
export const FLOOR_PBR = {
  wood: { n: 'floor_wood', diff: true, s: 3 }, dark: { n: 'floor_dark', diff: true, s: 3 }, herring: { n: 'floor_herring', diff: true, s: 3 },
  tatami: { n: 'tatami', diff: true, s: 2 }, carpet: { n: 'carpet', diff: true, s: 1.6 }, stone: { n: 'floor_stone', diff: true, s: 3 },
  tile: { n: 'floor_tile', diff: true, s: 3 }, checker: { n: 'floor_tile', s: 3, ns: .5 }
};
export const WALL_PBR = {
  plain: { n: 'wall_plaster', diff: true }, plaster: { n: 'wall_plaster', diff: true },
  brickRed: { n: 'wall_brick', diff: true, white: true, rx: 1.4, ry: 2.4 }, brickWhite: { n: 'wall_brickw', diff: true, white: true, rx: 1.4, ry: 2.4 },
  stripe: { n: 'wall_plaster', ns: .35 }, dot: { n: 'wall_plaster', ns: .35 }, star: { n: 'wall_plaster', ns: .2 }, wainscot: { n: 'wall_plaster', ns: .35 },
  boardV: { n: 'wall_plaster', ns: .25 }, boardW: { n: 'wall_plaster', ns: .22 }, wainscot2: { n: 'wall_plaster', ns: .3 }, leaf: { n: 'wall_plaster', ns: .25 },
  brickGray: { n: 'wall_brickw', diff: true, rx: 1.4, ry: 2.4 }
};
