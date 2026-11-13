// モデル用ヘルパー：共有マテリアル・プリミティブ生成。y 引数は「底の高さ」（球は中心）。
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { fabricTex, woodTex, wallCanvas, canvasToTex, shade, sharedTex } from './textures.js?v=202611131634';

const mats = new Map();
export function M(color, o) {
  const k = color + JSON.stringify(o || ''); let m = mats.get(k);
  if (!m) { m = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: .78, metalness: 0 }, o)); mats.set(k, m); }
  return m;
}
// 木：手続き木目の色 + PBR(Poly Haven)の法線・粗さ
export const MW = (color, o) => { const k = 'w' + color + JSON.stringify(o || ''); let m = mats.get(k); if (!m) { m = new THREE.MeshStandardMaterial(Object.assign({ color: 0xffffff, map: woodTex(color), roughness: .95, normalMap: sharedTex('furn_wood', 'nor', 1.5), roughnessMap: sharedTex('furn_wood', 'rough', 1.5), normalScale: new THREE.Vector2(.55, .55), envMapIntensity: .9 }, o)); mats.set(k, m); } return m; };
// 布・革：生地の凹凸（法線）と粗さの揺らぎ
export const MF = (color, kind, o) => { const k = 'f' + kind + color + JSON.stringify(o || ''); let m = mats.get(k); if (!m) { const lea = kind === 'leather', n = lea ? 'leather' : 'fabric'; m = new THREE.MeshStandardMaterial(Object.assign({ color: 0xffffff, map: fabricTex(color, kind || 'cloth'), roughness: lea ? .85 : 1, normalMap: sharedTex(n, 'nor', lea ? 2 : 4), roughnessMap: sharedTex(n, 'rough', lea ? 2 : 4), normalScale: new THREE.Vector2(lea ? .7 : .9, lea ? .7 : .9) }, o)); mats.set(k, m); } return m; };
// つや消しステンレス・トタン／釉薬の陶器（ナチュラルな質感）
export const MS = (color, r) => M(color, { metalness: .72, roughness: r == null ? .5 : r, envMapIntensity: 1.1 });
export const MC = (color, o) => M(color, Object.assign({ roughness: .3, envMapIntensity: 1.1 }, o));
export const MG = (color, i) => M(color, { emissive: color, emissiveIntensity: i || 1.4, roughness: .4 });          // 発光
export const MM = (color, r) => M(color, { metalness: .9, roughness: r == null ? .32 : r, envMapIntensity: 1.8 });                          // 金属
export const MGLASS = (color, op) => { const k = 'glass' + color + op; let m = mats.get(k); if (!m) { m = new THREE.MeshPhysicalMaterial({ color: color || 0xdff3ff, transparent: true, opacity: op || .22, roughness: .04, metalness: 0, clearcoat: 1, clearcoatRoughness: .03, envMapIntensity: 2.2, depthWrite: false }); mats.set(k, m); } return m; };
export function MT(map, o) { const k = 't' + map.uuid + JSON.stringify(o || ''); let m = mats.get(k); if (!m) { m = new THREE.MeshStandardMaterial(Object.assign({ color: 0xffffff, map, roughness: .8 }, o)); mats.set(k, m); } return m; }
let brickT = null;
export function brickMat(rx, ry) {
  const k = 'brk' + rx + ',' + ry; let m = mats.get(k);
  if (!m) { const t = canvasToTex(wallCanvas({ id: '_brk', pat: 'brickRed', color: '#a8503a', color2: '#cdbba2' }), rx, ry); m = new THREE.MeshStandardMaterial({ map: t, roughness: .95 }); mats.set(k, m); } return m;
}
export const G = () => new THREE.Group();
function fin(m, x, y, z) { m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; m.receiveShadow = true; return m; }
// 角を僅かに面取りした箱（薄い板は面取りを小さく）。同寸法のジオメトリは共有
const rbCache = new Map();
function rbGeo(w, h, d, r) {
  const k = [w, h, d, r].map(v => v.toFixed(3)).join(','); let g = rbCache.get(k);
  if (!g) { g = new RoundedBoxGeometry(w, h, d, 2, r); rbCache.set(k, g); } return g;
}
export const box = (w, h, d, mat, x, y, z) => {
  const r = Math.min(.016, Math.min(w, h, d) * .32);
  return fin(new THREE.Mesh(r < .0025 ? new THREE.BoxGeometry(w, h, d) : rbGeo(w, h, d, r), mat), x, (y || 0) + h / 2, z);
};
export const rbox = (w, h, d, r, mat, x, y, z) => fin(new THREE.Mesh(rbGeo(w, h, d, Math.min(r, w / 2 - .001, h / 2 - .001, d / 2 - .001)), mat), x, (y || 0) + h / 2, z);
export const cyl = (rt, rb, h, mat, x, y, z, seg) => fin(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 20), mat), x, (y || 0) + h / 2, z);
export const sph = (r, mat, x, y, z, sy) => { const m = fin(new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), mat), x, y, z); if (sy) m.scale.y = sy; return m; };
export const cone = (r, h, mat, x, y, z, seg) => fin(new THREE.Mesh(new THREE.ConeGeometry(r, h, seg || 16), mat), x, (y || 0) + h / 2, z);
export const torus = (R, r, mat, x, y, z) => fin(new THREE.Mesh(new THREE.TorusGeometry(R, r, 10, 28), mat), x, y, z);
// 回転体：pts は [半径, 高さ] の配列（下から上）
export function lathe(pts, mat, x, y, z, seg) {
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg || 24), mat); return fin(m, x, y, z);
}
export function plane(w, h, mat, x, y, z) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.receiveShadow = true; m.position.set(x || 0, y || 0, z || 0); return m; }
export function add(g, ...ms) { ms.forEach(m => m && g.add(m)); return g; }
// 光のにじみ（加算ブレンドの丸いぼかし。点光源を増やさずに灯りの雰囲気を出す）
let haloT = null; const haloM = new Map();
export function halo(color, size, x, y, z, op) {
  if (!haloT) { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d'), gr = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.4)'); gr.addColorStop(.55, 'rgba(255,255,255,.08)'); gr.addColorStop(.8, 'rgba(255,255,255,.015)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gr; c.fillRect(0, 0, 128, 128); haloT = new THREE.CanvasTexture(cv); haloT.colorSpace = THREE.SRGBColorSpace; }
  const k = color + op; let m = haloM.get(k);
  if (!m) { m = new THREE.SpriteMaterial({ map: haloT, color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: op == null ? .55 : op, fog: false }); haloM.set(k, m); }
  const s = new THREE.Sprite(m); s.scale.set(size, size, 1); s.position.set(x, y, z); s.raycast = () => { }; s.renderOrder = 4; return s;
}
export function lightAt(g, x, y, z, color, intensity, dist, flicker) { g.userData.light = { x, y, z, color, intensity, dist: dist || 6, flicker: !!flicker }; }
export { THREE, shade };
