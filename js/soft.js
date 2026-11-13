// やわらかい造形のヘルパー：ふくらんだ布(枕・布団・クッション)、葉、カーテンのひだ、本
import * as THREE from 'three';
import { mkCanvas, rng, shade } from './textures.js?v=202611131634';

// 同じ位置の頂点の法線を平均して、面の継ぎ目の段差を消す
export function smoothNormals(geo) {
  geo.computeVertexNormals();
  const p = geo.attributes.position, n = geo.attributes.normal, map = new Map(), key = i => Math.round(p.getX(i) * 2000) + ',' + Math.round(p.getY(i) * 2000) + ',' + Math.round(p.getZ(i) * 2000);
  for (let i = 0; i < p.count; i++) { const k = key(i); let a = map.get(k); if (!a) { a = [0, 0, 0]; map.set(k, a); } a[0] += n.getX(i); a[1] += n.getY(i); a[2] += n.getZ(i); }
  for (let i = 0; i < p.count; i++) { const a = map.get(key(i)), l = Math.hypot(a[0], a[1], a[2]) || 1; n.setXYZ(i, a[0] / l, a[1] / l, a[2] / l); }
  n.needsUpdate = true; return geo;
}
// 簡易ノイズ
function noise2(x, z, s) { return Math.sin(x * 9.1 + s) * Math.cos(z * 7.3 - s * 1.7) * .5 + Math.sin(x * 21.7 + z * 13.1 + s * 2.3) * .25 + Math.sin(z * 31 - x * 11 + s) * .15; }

// ふくらんだ布のかたまり。底面(y=0)から上へ。puff=上面の膨らみ、pinch=縁のしぼり、wr=しわ、drape=側面の垂れ
const puffCache = new Map();
export function puffyGeo(w, h, d, o) {
  o = o || {}; const key = [w, h, d, JSON.stringify(o)].join('|'); let g = puffCache.get(key); if (g) return g;
  const sx = Math.max(6, Math.round(w * 14)), sy = o.sy || 4, sz = Math.max(6, Math.round(d * 14)), seed = o.seed || 0;
  g = new THREE.BoxGeometry(w, h, d, sx, sy, sz); const p = g.attributes.position;
  const puff = o.puff == null ? .5 : o.puff, pinch = o.pinch == null ? .5 : o.pinch, wr = o.wr == null ? .01 : o.wr, drape = o.drape || 0;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const nx = x / (w / 2), ny = y / (h / 2), nz = z / (d / 2);
    const prof = Math.sqrt(Math.max(0, (1 - Math.pow(Math.abs(nx), 4)) * (1 - Math.pow(Math.abs(nz), 4))));   // 中央ほど高い
    // 上下の面を縁で絞って枕型に
    const yy = ny * (h / 2);
    y = ny > 0 ? (yy * (.55 + .45 * prof) + h * puff * .35 * prof * ny) : yy;
    // 側面の縁を内側へ丸める
    const e = Math.pow(Math.abs(ny), 3) * .06; x *= 1 - e * (o.round == null ? 1 : o.round); z *= 1 - e * (o.round == null ? 1 : o.round);
    if (ny > 0) y += noise2(x, z, seed) * wr * (.4 + prof);
    if (drape) { const edge = Math.max(Math.abs(nx), Math.abs(nz)); if (edge > .9) y -= drape * Math.min(1, (edge - .9) * 10) * (1 + .3 * noise2(x * 3, z * 3, seed + 3)) * (ny < 0 ? 1 : .8); }
    p.setXYZ(i, x, y + h / 2, z);
  }
  smoothNormals(g); g.userData.shared = true; puffCache.set(key, g); return g;
}
export function puffy(w, h, d, mat, x, y, z, o) {
  const m = new THREE.Mesh(puffyGeo(w, h, d, o), mat); m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; m.receiveShadow = true; return m;
}

// ===== 葉 =====
let _leafG = null, _leafT = null;
export function leafGeo() {
  if (_leafG) return _leafG;
  const nu = 6, nt = 10, pos = [], uv = [], idx = [];
  for (let j = 0; j <= nt; j++) {
    const t = j / nt, prof = Math.pow(Math.sin(Math.PI * Math.pow(t, .75)), .85);    // 先がとがり根元がすぼまった葉の幅
    for (let i = 0; i <= nu; i++) {
      const u = i / nu * 2 - 1;
      const x = u * prof * .28, y = t, z = -Math.abs(u) * prof * .07 + t * t * .24;    // 中央の谷折れ＋先端の垂れ
      pos.push(x, y, z); uv.push(i / nu, t);
    }
  }
  for (let j = 0; j < nt; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, e = c + 1; idx.push(a, c, b, b, c, e); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  smoothNormals(g); return (_leafG = g);
}
export function leafTex() {
  if (_leafT) return _leafT;
  const cv = mkCanvas(128, 256), c = cv.getContext('2d'), r = rng('leaf');
  const g = c.createLinearGradient(0, 256, 0, 0); g.addColorStop(0, '#9ab07a'); g.addColorStop(.5, '#ffffff'); g.addColorStop(1, '#e6f0d4'); c.fillStyle = g; c.fillRect(0, 0, 128, 256);
  c.lineCap = 'round';
  for (let i = 0; i < 9; i++) for (const s of [-1, 1]) {   // 側脈
    const y0 = 230 - i * 24; c.strokeStyle = 'rgba(70,90,40,.28)'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(64, y0); c.quadraticCurveTo(64 + s * 30, y0 - 12, 64 + s * 56, y0 - 44); c.stroke();
    c.strokeStyle = 'rgba(255,255,230,.35)'; c.lineWidth = 1; c.beginPath(); c.moveTo(64, y0 + 1); c.quadraticCurveTo(64 + s * 30, y0 - 11, 64 + s * 56, y0 - 43); c.stroke();
  }
  c.strokeStyle = 'rgba(250,255,220,.8)'; c.lineWidth = 3.2; c.beginPath(); c.moveTo(64, 256); c.lineTo(64, 6); c.stroke();   // 中脈
  c.strokeStyle = 'rgba(60,80,30,.25)'; c.lineWidth = 1; c.beginPath(); c.moveTo(66, 256); c.lineTo(66, 6); c.stroke();
  const id = c.getImageData(0, 0, 128, 256), d = id.data; for (let i = 0; i < d.length; i += 4) { const n = (r() - .5) * 12; d[i] += n; d[i + 1] += n; d[i + 2] += n; } c.putImageData(id, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return (_leafT = t);
}
// 葉1枚を茎の上の点(0,y,0)から、方位 yaw・仰角 pitch(鉛直からの傾き)・長さ len で生やす
export function leafMesh(mat, len, wid, yaw, pitch, x, y, z, roll) {
  const m = new THREE.Mesh(leafGeo(), mat); m.scale.set(wid * len, len, len); m.rotation.order = 'YXZ'; m.rotation.set(pitch, yaw, roll || 0); m.position.set(x || 0, y, z || 0);
  m.castShadow = true; m.receiveShadow = true; return m;
}

// ===== カーテン（ひだ）=====
export function curtainGeo(w, h, folds, amp) {
  const g = new THREE.PlaneGeometry(w, h, Math.max(16, folds * 8), 10), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), t = (y + h / 2) / h;          // t=0 下, 1 上
    const a = amp * (1 - t * .25) * (.55 + .45 * t);
    p.setZ(i, Math.sin(x / w * Math.PI * 2 * folds) * a + Math.sin(x / w * Math.PI * 2 * folds * 2.3 + 1) * a * .15);
    p.setX(i, x * (1 - (1 - t) * .04 * Math.sin(x / w * 12)));
  }
  smoothNormals(g); return g;
}

// ===== 本 =====
const spineCache = new Map();
export function spineMat(color, variant) {
  const k = color + variant; let m = spineCache.get(k); if (m) return m;
  const cv = mkCanvas(32, 128), c = cv.getContext('2d'), r = rng('sp' + k);
  c.fillStyle = color; c.fillRect(0, 0, 32, 128);
  const g = c.createLinearGradient(0, 0, 32, 0); g.addColorStop(0, 'rgba(255,255,255,.14)'); g.addColorStop(.5, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.2)'); c.fillStyle = g; c.fillRect(0, 0, 32, 128);
  const band = r() > .5 ? '#f3e7c6' : '#e7c46a';
  c.fillStyle = band; c.fillRect(0, 10, 32, 3); c.fillRect(0, 116, 32, 3);
  const v = variant % 3; if (v === 0) { c.fillRect(6, 30, 20, 30); c.fillStyle = color; c.fillRect(8, 33, 16, 5); c.fillRect(8, 42, 12, 4); } else if (v === 1) { c.fillStyle = 'rgba(255,255,255,.85)'; c.fillRect(8, 24, 16, 52); c.fillStyle = shade(color, .7); for (let i = 0; i < 5; i++) c.fillRect(10, 28 + i * 9, 12 - (i % 2) * 4, 3); } else { c.fillRect(0, 56, 32, 10); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  m = new THREE.MeshStandardMaterial({ map: t, roughness: .6, metalness: 0 }); spineCache.set(k, m); return m;
}
const _bm = new Map();
function plainMat(c, rough) { const k = c + rough; let m = _bm.get(k); if (!m) { m = new THREE.MeshStandardMaterial({ color: c, roughness: rough }); _bm.set(k, m); } return m; }
const bookGeoCache = new Map();
function bookGeo(w, h, d) {
  const k = [w, h, d].map(v => v.toFixed(3)).join(','); let g = bookGeoCache.get(k);
  if (!g) { g = new THREE.BoxGeometry(w, h, d); bookGeoCache.set(k, g); } return g;
}
// 立てた本（背表紙が+z、ページ側が-z）。座標は底面中心
export function book(w, h, d, color, variant, x, y, z) {
  const cover = plainMat(color, .55), paper = plainMat('#f1e8d2', .9);
  const m = new THREE.Mesh(bookGeo(w, h, d), [cover, cover, paper, paper, spineMat(color, variant), paper]);
  m.position.set(x, y + h / 2, z); m.castShadow = true; m.receiveShadow = true; return m;
}
// 寝かせた本（背表紙が-x側）。ページは側面の3方向
export function flatBook(w, th, d, color, x, y, z, ry) {
  const cover = plainMat(color, .55), paper = plainMat('#f3ead4', .9);
  const m = new THREE.Mesh(bookGeo(w, th, d), [paper, cover, cover, cover, paper, paper]);
  m.position.set(x, y + th / 2, z); m.rotation.y = ry || 0; m.castShadow = true; m.receiveShadow = true;
  return m;
}
