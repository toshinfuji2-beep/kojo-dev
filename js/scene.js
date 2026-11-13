// レンダラ・カメラ・ライト・ポスト処理・部屋（床と奥2面の壁）
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CFG, ITEM, houseBox, roomAt, wallPlan } from './data.js?v=202611131634';
import { wallCanvas, floorCanvas, canvasToTex, texHook, loadTex, FLOOR_PBR, WALL_PBR } from './textures.js?v=202611131634';

export const WH = CFG.WALL_H;
// 夕方〜夜の電球色（2700Kあたりのアンバー）。部屋の中はあたたかく、影はやわらかく。窓の外の青さは窓の絵(textures.js sky)で出す
const DAY = { exp: 1.02, env: .36, hemi: .3, hemiC: 0xffdcae, sun: 2.35, sunC: 0xffc88a, fill: .34, fillC: 0xb4c0e4 };
const PITCH = 34 * Math.PI / 180, BASE_YAW = 45 * Math.PI / 180, MAXYAW = 35 * Math.PI / 180, FOV = 22;
export const isSmall = () => (('ontouchstart' in window) || navigator.maxTouchPoints > 0) || Math.min(innerWidth, innerHeight) < 500;
export const cam = { yaw: 0, zoom: 1, panx: 0, pany: 0, h: 0, tgt: 0, dirty: true, mode: 'iso', ca: null, cp: 0, cty: 0 };
// カメラの向き：iso=いつもの斜め（ドラッグで回せる）/ top=真上 / wallL・wallR=その壁を正面から（壁かけを置きやすい）
const VIEWS = { iso: null, top: { a: 0, p: 88.5 * Math.PI / 180, ty: 0 }, wallL: { a: Math.PI / 2, p: 6 * Math.PI / 180, ty: CFG.WALL_H * .5 }, wallR: { a: 0, p: 6 * Math.PI / 180, ty: CFG.WALL_H * .5 } };
export function setCamMode(m) { if (!(m in VIEWS)) m = 'iso'; cam.mode = m; cam.yaw = 0; cam.zoom = 1; cam.panx = cam.pany = 0; cam.dirty = true; }
// ドラッグで自由に回す（free）：横=左右の向き（右の壁の正面〜左の壁の正面）、縦=見下ろす角度（ほぼ真横〜真上）
const A_MIN = 0, A_MAX = Math.PI / 2, P_MIN = 6 * Math.PI / 180, P_MAX = 88.5 * Math.PI / 180;
const tyOf = p => { const d = p * 180 / Math.PI; return d <= 34 ? CFG.WALL_H * (.5 - .15 * (d - 6) / 28) : CFG.WALL_H * .35 * (1 - (d - 34) / 54.5); };   // 見る高さ：横から=壁の中ほど、真上=床
export function orbit(dx, dy) {
  if (cam.mode !== 'free') { cam.fa = cam.ca != null ? cam.ca : BASE_YAW; cam.fp = cam.ca != null ? cam.cp : PITCH; cam.mode = 'free'; }
  cam.fa = Math.max(A_MIN, Math.min(A_MAX, cam.fa + dx)); cam.fp = Math.max(P_MIN, Math.min(P_MAX, cam.fp + dy)); cam.dirty = true;
}
export const E = {};   // renderer, scene, camera, itemsG, fxG, ...
let mobile = false, quality = 'std', pool = [], gridLines = null, roomG = null, sun = null, fill = null, ownedTex = [];
let cutX = null, cutZ = null, hBox = { x0: 0, z0: 0, x1: 6, z1: 6 }, rBox = { x0: 0, z0: 0, x1: 6, z1: 6 }, curRooms = [];
let composer = null, gtao = null, bloom = null, gtaoScale = 1, blob = null;

function bgTexture() {
  const cv = document.createElement('canvas'); cv.width = 16; cv.height = 512;
  const c = cv.getContext('2d'), g = c.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#e9e6f2'); g.addColorStop(.5, '#fbe6cf'); g.addColorStop(1, '#f6cf9c');
  c.fillStyle = g; c.fillRect(0, 0, 16, 512);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function blobTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const c = cv.getContext('2d'), g = c.createRadialGradient(128, 128, 20, 128, 128, 128);
  g.addColorStop(0, 'rgba(70,40,15,.6)'); g.addColorStop(.55, 'rgba(70,40,15,.24)'); g.addColorStop(1, 'rgba(70,40,15,0)');
  c.fillStyle = g; c.fillRect(0, 0, 256, 256); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

const DBG = new URLSearchParams(location.search);
export function initScene(canvas, stage) {
  mobile = isSmall();
  const r = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = DAY.exp;
  r.shadowMap.enabled = true; r.shadowMap.type = DBG.get('sm') === 'pcf' ? THREE.PCFSoftShadowMap : THREE.VSMShadowMap;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(FOV, 1, 1, 600);
  scene.background = bgTexture(); scene.backgroundIntensity = 1.35;
  Object.assign(E, { renderer: r, scene, camera, stage, canvas });
  // 環境光（室内の反射・拡散）
  const pm = new THREE.PMREMGenerator(r); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
  scene.environmentIntensity = DAY.env;
  E.hemi = new THREE.HemisphereLight(DAY.hemiC, 0xa07850, DAY.hemi); scene.add(E.hemi);
  sun = new THREE.DirectionalLight(DAY.sunC, DAY.sun); sun.castShadow = true; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02; sun.shadow.radius = 5; sun.shadow.blurSamples = 25; scene.add(sun, sun.target); E.sun = sun;
  fill = new THREE.DirectionalLight(DAY.fillC, DAY.fill); scene.add(fill, fill.target);
  roomG = new THREE.Group(); E.itemsG = new THREE.Group(); E.fxG = new THREE.Group(); E.othersG = new THREE.Group(); E.roomPick = roomG; scene.add(roomG, E.itemsG, E.fxG, E.othersG);   // itemsG / fxG = 今いる部屋のローカル座標、othersG = ほかの部屋の家具（家の座標）
  blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.renderOrder = -1; scene.add(blob);
  for (let i = 0; i < 6; i++) { const p = new THREE.PointLight(0xffb060, 0, 7, 1.8); p.visible = false; scene.add(p); pool.push(p); }
  texHook.onLoad = () => { cam.dirty = true; };
  try {
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    composer = new EffectComposer(r, rt);
    composer.addPass(new RenderPass(scene, camera));
    gtao = new GTAOPass(scene, camera, 512, 512);
    gtao.updateGtaoMaterial({ radius: .5, distanceExponent: 1.2, thickness: 1.5, scale: 1.8, samples: 16, distanceFallOff: 1 });
    gtao.updatePdMaterial({ lumaPhi: 24, depthPhi: 3, normalPhi: 8, radius: 9, rings: 3, samples: 16 });
    // 法線は深度から再構成（法線RTを使うと環境によって壁に黒い四角が出るため）＋数値誤差のNaN対策
    { const m = gtao.gtaoMaterial; m.fragmentShader = m.fragmentShader.replace('sqrt(1. - cosHorizons * cosHorizons)', 'sqrt(max(vec2(0.), 1. - cosHorizons * cosHorizons))').replace('acos(cosHorizons.y) - acos(cosHorizons.x)', 'acos(clamp(cosHorizons.y, -1., 1.)) - acos(clamp(cosHorizons.x, -1., 1.))').replace('float nx = dot', 'cosHorizons = clamp(cosHorizons, -1., 1.); float nx = dot'); m.defines.NORMAL_VECTOR_TYPE = 0; m.needsUpdate = true; }
    gtao.blendIntensity = 1.0;
    const so = gtao.setSize.bind(gtao); gtao.setSize = (w, h) => so(Math.max(2, w * gtaoScale | 0), Math.max(2, h * gtaoScale | 0));
    if (DBG.get('only') !== '1') composer.addPass(gtao);
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .26, .6, 1.1); if (DBG.get('only') !== '1') composer.addPass(bloom);
    composer.addPass(new OutputPass());
  } catch (e) { console.error('composer', e); composer = null; }
  setQuality(quality);
  if (gtao && DBG.get('ao') === '0') gtao.enabled = false;
  if (bloom && DBG.get('bloom') === '0') bloom.enabled = false;
  resize();
}
export function qualityDefault() { return mobile ? 'std' : 'high'; }
export function setQuality(q) {
  quality = q; const hi = q === 'high', r = E.renderer;
  const dpr = window.devicePixelRatio || 1, cap = mobile ? (hi ? 1.5 : 1.25) : (hi ? 2 : 1.25);
  r.setPixelRatio(Math.min(dpr, cap));
  const sz = mobile ? (hi ? 1024 : 512) : (hi ? 2048 : 1024);
  if (sun.shadow.mapSize.x !== sz) { sun.shadow.mapSize.set(sz, sz); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
  if (gtao) {
    gtao.enabled = !(mobile && !hi); gtaoScale = (mobile || !hi) ? .5 : 1;
    gtao.updateGtaoMaterial({ samples: hi ? 16 : 8 });
  }
  if (bloom) bloom.strength = mobile ? .2 : .28;
  resize(); cam.dirty = true;
}
export function resize() {
  const s = E.stage.getBoundingClientRect(), w = Math.max(1, Math.round(s.width)), h = Math.max(1, Math.round(s.height));
  E.renderer.setSize(w, h, false); E.W = w; E.H = h; E.camera.aspect = w / h;
  if (composer) { composer.setPixelRatio(E.renderer.getPixelRatio()); composer.setSize(w, h); }
  cam.dirty = true;
}
export function renderFrame() {
  if (composer && DBG.get('post') !== '0') composer.render(); else E.renderer.render(E.scene, E.camera);
}

// ===== カメラ（小さめ画角の透視。部屋がぴったり収まる距離＋レンズシフトで中央寄せ） =====
export function resetCam() { cam.yaw = 0; cam.zoom = 1; cam.panx = cam.pany = 0; cam.dirty = true; }
export function addYaw(d) { if (cam.mode !== 'iso') return; cam.yaw =Math.max(-MAXYAW, Math.min(MAXYAW, cam.yaw + d)); cam.dirty = true; }
export function setZoom(z) { cam.zoom = Math.max(.55, Math.min(3.2, z)); cam.dirty = true; }
const _v = new THREE.Vector3(), _t = new THREE.Vector3(), _dir = new THREE.Vector3();
let fitD = 0;
function place(c, D) { c.position.copy(_t).addScaledVector(_dir, D); c.up.set(0, 1, 0); c.lookAt(_t); c.updateMatrixWorld(true); }
function bounds(c, b) {
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const X of [b.x0, b.x1]) for (const Y of [-.3, WH]) for (const Z of [b.z0, b.z1 + .5]) { _v.set(X, Y, Z).project(c); x0 = Math.min(x0, _v.x); x1 = Math.max(x1, _v.x); y0 = Math.min(y0, _v.y); y1 = Math.max(y1, _v.y); }
  return [x0, x1, y0, y1];
}
export function updateCamera(dt, snap) {
  const c = E.camera, free = cam.mode === 'free', v = VIEWS[cam.mode], bx = cam.mode === 'wallL' || cam.mode === 'wallR' ? rBox : hBox, span = Math.max(bx.x1 - bx.x0, bx.z1 - bx.z0);   // 壁正面ビューは今いる部屋、ほかは家全体
  const ta = free ? cam.fa : v ? v.a : BASE_YAW + cam.yaw, tp = free ? cam.fp : v ? v.p : PITCH, tty = free ? tyOf(cam.fp) : v ? v.ty : WH * .35;
  // 向きの切り替えはなめらかに（角度・高さを目標へ近づける。ドラッグ中は手に速くついてくる）
  let turning = false;
  if (cam.ca == null || snap) { cam.ca = ta; cam.cp = tp; cam.cty = tty; }
  else { const k = Math.min(1, dt * (free ? 20 : 7)); [['ca', ta], ['cp', tp], ['cty', tty]].forEach(([key, t]) => { const d = t - cam[key]; if (Math.abs(d) < 1e-3) cam[key] = t; else { cam[key] += d * k; turning = true; } }); }
  const a = cam.ca, P = cam.cp;
  // 手前の壁（玄関つき）：低い角度でこちらを向くと部屋の中を隠すので、その間は低く沈める（真上・斜めは腰の高さの断面のまま）
  if (cutZ) {
    const sm = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }, kp = sm((26 * Math.PI / 180 - P) / (10 * Math.PI / 180)), kz = kp * sm((Math.cos(a) - .2) / .3), kx = kp * sm((Math.sin(a) - .2) / .3);
    cutZ.scale.y = Math.max(.001, 1 - kz); cutZ.visible = kz < .98; cutX.scale.y = Math.max(.001, 1 - kx); cutX.visible = kx < .98;
  }
  E.othersG.visible = !(cam.mode === 'wallL' || cam.mode === 'wallR');
  _t.set((bx.x0 + bx.x1) / 2, cam.cty, (bx.z0 + bx.z1) / 2); _dir.set(Math.sin(a) * Math.cos(P), Math.sin(P), Math.cos(a) * Math.cos(P));
  c.aspect = E.W / E.H; c.fov = FOV; c.zoom = 1; c.near = 1; c.far = 600; c.updateProjectionMatrix();
  const fy = mobile ? .94 : .9, fx = .94;
  let D = fitD || span * 6; for (let i = 0; i < 6; i++) { place(c, D); const [x0, x1, y0, y1] = bounds(c, bx); D *= Math.max((x1 - x0) / 2 / fx, (y1 - y0) / 2 / fy); }
  cam.tgt = D; if (!cam.h || snap) cam.h = D; else { cam.h += (D - cam.h) * Math.min(1, dt * 9); if (Math.abs(cam.h - D) < .01) cam.h = D; }
  fitD = D;
  const Dc = cam.h; place(c, Dc); c.near = Math.max(1, Dc * .3); c.far = Dc * 3; c.updateProjectionMatrix();
  const [x0, x1, y0, y1] = bounds(c, bx);
  c.zoom = cam.zoom; c.updateProjectionMatrix();
  const e = c.projectionMatrix.elements; e[8] = cam.zoom * (x0 + x1) / 2 - 2 * cam.panx; e[9] = cam.zoom * (y0 + y1) / 2 + 2 * cam.pany + .035;
  c.projectionMatrixInverse.copy(c.projectionMatrix).invert();
  return cam.h !== D || turning;
}
export function rayAt(px, py) {
  const rc = new THREE.Raycaster(), v = new THREE.Vector2(px / E.W * 2 - 1, -(py / E.H) * 2 + 1); rc.setFromCamera(v, E.camera); return rc;
}
export function project(p) { const v = p.clone().project(E.camera); return [(v.x + 1) / 2 * E.W, (1 - v.y) / 2 * E.H]; }

// ===== ライト =====
export function setPointLights(list) {
  const cap = mobile ? 2 : (quality === 'high' ? 5 : 3);
  const sel = list.slice(0, cap);
  pool.forEach((p, i) => { const l = sel[i]; if (!l) { p.visible = false; p.intensity = 0; return; } p.visible = true; p.position.copy(l.pos); p.color.set(l.color); p.intensity = l.intensity * nb(); p.distance = l.dist * (night ? 1.25 : 1); });
  cam.dirty = true;
}
export function flickerLights(t, list) { pool.forEach((p, i) => { const l = list[i]; if (l && l.flicker && p.visible) p.intensity = l.intensity * nb() * (.9 + .1 * Math.sin(t * 9 + i) + .05 * Math.sin(t * 23)); }); }
// 電気を消す：部屋全体の明かりを落とし、ランプ・キャンドルなどの灯りだけが目立つ夜の雰囲気に
let night = false; const nb = () => night ? 1.9 : 1;
export function setNight(on) {
  night = !!on; const s = E.scene;
  if (night) { s.environmentIntensity = .12; E.hemi.intensity = .1; E.hemi.color.set(0x8a96c8); sun.intensity = .4; sun.color.set(0x8fa6ff); fill.intensity = .14; s.backgroundIntensity = .5; E.renderer.toneMappingExposure = 1.05; }
  else { s.environmentIntensity = DAY.env; E.hemi.intensity = DAY.hemi; E.hemi.color.set(DAY.hemiC); sun.intensity = DAY.sun; sun.color.set(DAY.sunC); fill.intensity = DAY.fill; s.backgroundIntensity = 1.35; E.renderer.toneMappingExposure = DAY.exp; }
  cam.dirty = true;
}

// ===== 部屋 =====
function stdMat(o) { return new THREE.MeshStandardMaterial(Object.assign({ roughness: .9, metalness: 0 }, o)); }
function dispose(g) { g.traverse(o => { if (o.geometry) o.geometry.dispose(); }); ownedTex.forEach(t => t.dispose()); ownedTex = []; }
function rep(cv, rx, ry) { const t = canvasToTex(cv, rx, ry); ownedTex.push(t); return t; }
// PBRテクスチャ（Poly Haven）を読み込めたものから順にマテリアルへ差し替える。失敗しても手続きテクスチャのまま。
function pbr(mat, spec, rx, ry, tint) {
  if (!spec) return;
  const set = (key, suf, srgb, extra) => loadTex('assets/tex/' + spec.n + '_' + suf + '.jpg', srgb, rx, ry, t => {
    ownedTex.push(t); mat[key] = t; if (extra) extra(t); mat.needsUpdate = true; cam.dirty = true;
  });
  set('normalMap', 'nor', false); set('roughnessMap', 'rough', false);
  if (spec.diff) set('map', 'diff', true, () => { if (tint != null) mat.color.set(tint); });
  if (spec.ns) mat.normalScale.set(spec.ns, spec.ns);
  mat.roughness = 1;
}
// ===== 家全体（全部の部屋の床・壁・玄関）=====
// rooms = 間取り（x,z,w,d つき）、open = 壁をなくす組、cur = 今いる部屋の番号。
//   今いる部屋の奥2面と、家の奥側(-x,-z)の外壁は天井まで。ほかは腰の高さ(CUT)で切った断面。
//   今いる部屋のローカル座標で家具・アバターを扱えるよう、itemsG / fxG を今いる部屋の角に置く。
export function buildHouse(rooms, open, cur) {
  if (cur >= rooms.length || cur < 0) cur = 0;
  while (roomG.children.length) { const c = roomG.children[0]; roomG.remove(c); dispose(c); }
  const box = houseBox(rooms), cr = rooms[cur]; hBox = box; rBox = { x0: cr.x, z0: cr.z, x1: cr.x + cr.w, z1: cr.z + cr.d };
  const T = .3, CUT = 1.1, OPEN = .7, ST = .16, OT = .3;
  E.itemsG.position.set(cr.x, 0, cr.z); E.fxG.position.set(cr.x, 0, cr.z); E.itemsG.updateMatrixWorld(true); E.fxG.updateMatrixWorld(true);
  cutX = new THREE.Group(); cutZ = new THREE.Group(); roomG.add(cutX, cutZ);
  const side = stdMat({ color: 0xa88e72, roughness: .85 }), plain = stdMat({ color: 0xe2d6c0, roughness: .8 }), cap = stdMat({ color: 0xf1e7d2, roughness: .6 });
  const trim = stdMat({ color: 0xf3ebda, roughness: .45 });
  const add = (g, w, h, d, x, y, z, m, shadow) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m || plain); b.position.set(x, y, z); b.receiveShadow = true; b.castShadow = shadow === true; g.add(b); return b; };
  const R = rooms.map((rm, i) => {   // 部屋ごとの床と壁紙
    const fd = ITEM[rm.floor] || ITEM.fl_wood, wd = ITEM[rm.wall] || ITEM.wp_cream, fs = FLOOR_PBR[fd.pat];
    const fm = stdMat({ map: rep(floorCanvas(fd), rm.w / 2, rm.d / 2), roughness: fd.pat === 'carpet' ? 1 : .7 });
    if (fs) { const tint = fs.diff ? new THREE.Color(fd.color).multiplyScalar(1.12) : null; fm.color.set(tint || 0xffffff); pbr(fm, fs, rm.w / (fs.s || 2), rm.d / (fs.s || 2), tint); }
    const floor = new THREE.Mesh(new THREE.BoxGeometry(rm.w, T, rm.d), [side, side, fm, side, side, side]);
    floor.position.set(rm.x + rm.w / 2, -T / 2, rm.z + rm.d / 2); floor.receiveShadow = true; floor.name = 'floor'; floor.userData.roomIdx = i; roomG.add(floor);
    const ws = WALL_PBR[wd.pat], cv = wallCanvas(wd), cache = new Map();
    // len = 壁の長さ、hf = 壁の高さが天井までの何割か（模様の大きさをそろえる）
    const wm = (len, hf) => {
      const key = len + '|' + hf; let m = cache.get(key); if (m) return m;
      m = stdMat({ map: rep(cv, len / 2, hf), roughness: wd.pat === 'tileWall' ? .35 : .9 });
      if (ws) { const tint = ws.diff ? new THREE.Color(ws.white ? 0xffffff : wd.color).multiplyScalar(ws.white ? 1 : 1.08) : null; if (tint) m.color.copy(tint); pbr(m, ws, len / 2 * (ws.rx || 1), (ws.ry || 1.6) * hf, tint); }
      cache.set(key, m); return m;
    };
    return { wm, moldCol: wd.pat === 'wainscot' ? stdMat({ color: 0x5a3219 }) : trim };
  });
  // 壁の板：ax='z'(z方向に伸びる壁、厚みは x 方向) / ax='x'。c0〜c1 = 厚みの範囲、a0〜a1 = 長さの範囲、y0〜y1 = 高さの範囲
  // faces = { px,nx,pz,nz }（壁紙の面）。ほかの面は plain、上面は cap
  const slab = (g, ax, c0, c1, a0, a1, y0, y1, faces) => {
    const M = [plain, plain, cap, plain, plain, plain];
    if (ax === 'z') { M[0] = faces.px || plain; M[1] = faces.nx || plain; } else { M[4] = faces.pz || plain; M[5] = faces.nz || plain; }
    if (y1 >= WH - .01) M[2] = plain;
    const b = new THREE.Mesh(new THREE.BoxGeometry(ax === 'z' ? c1 - c0 : a1 - a0, y1 - y0, ax === 'z' ? a1 - a0 : c1 - c0), M);
    b.position.set(ax === 'z' ? (c0 + c1) / 2 : (a0 + a1) / 2, (y0 + y1) / 2, ax === 'z' ? (a0 + a1) / 2 : (c0 + c1) / 2); b.receiveShadow = true; b.castShadow = false; g.add(b); return b;
  };
  // 巾木・廻り縁（壁紙の面に沿って）。fc = 面の位置、s = 面の向き(+1/-1)
  const trims = (g, ax, fc, s, a0, a1, full, ri) => {
    const l = a1 - a0, c = (a0 + a1) / 2, m = R[ri].moldCol;
    if (ax === 'z') { add(g, .06, .16, l, fc + s * .03, .08, c, trim); if (full) add(g, .1, .1, l, fc + s * .05, WH - .05, c, m); }
    else { add(g, l, .16, .06, c, .08, fc + s * .03, trim); if (full) add(g, l, .1, .1, c, WH - .05, fc + s * .05, m); }
  };
  const wood = stdMat({ color: 0x7a4b2a, roughness: .55 });
  const plan = wallPlan(rooms, open);
  plan.forEach(sg => {
    const { ax, pos, a0, a1, kind } = sg, len = a1 - a0, isX = ax === 'z';   // isX: 壁の向きが x 軸に垂直(厚みが x 方向)
    let full, c0, c1, faces = {}, ri = -1, fc = 0, s = 1, lo = -1;
    if (kind === 'out' || kind === 'ent') {
      const sd = sg.side; full = (sd === 'l' || sd === 't') && kind === 'out'; ri = sg.room;
      if (sd === 'l' || sd === 't') { c0 = pos - OT; c1 = pos; s = 1; fc = pos; } else { c0 = pos; c1 = pos + OT; s = -1; fc = pos; }
    } else { full = sg.hi === cur; c0 = pos - ST; c1 = pos; ri = sg.hi; s = 1; fc = pos; lo = sg.lo; }
    const g = full ? roomG : (isX ? cutX : cutZ), top = full ? WH : CUT, hf = top / WH;
    const face = (rIdx, len2, positive) => { const m = R[rIdx].wm(len2, hf); const f = {}; if (isX) f[positive ? 'px' : 'nx'] = m; else f[positive ? 'pz' : 'nz'] = m; return f; };
    const seam = (rIdx, a, b, positive, fcc) => {   // 壁紙の面を faces に足し、巾木をつける
      Object.assign(faces, face(rIdx, b - a, positive)); trims(g, isX ? 'z' : 'x', fcc, positive ? 1 : -1, a, b, full, rIdx);
    };
    if (kind === 'door' && !full) return;                                  // 腰の壁の入口 = 切れ目
    if (kind === 'door') {                                                  // 天井までの壁の入口：開口＋ドア枠
      const lt = 2.36; faces = {}; Object.assign(faces, face(sg.hi, len, true), face(lo, len, false));
      slab(g, ax, c0, c1, a0, a1, lt, WH, faces);
      [a0, a1].forEach((e, k) => { const o = k ? -.05 : .05; if (isX) add(g, .22, 2.3, .1, pos - ST / 2, 1.15, e + o, wood, true); else add(g, .1, 2.3, .22, e + o, 1.15, pos - ST / 2, wood, true); });
      if (isX) add(g, .22, .12, len + .1, pos - ST / 2, lt - .06, (a0 + a1) / 2, wood, true); else add(g, len + .1, .12, .22, (a0 + a1) / 2, lt - .06, pos - ST / 2, wood, true);
      return;
    }
    if (kind === 'ent') {
      const cx = (a0 + a1) / 2, pieces = [[a0, cx - OPEN], [cx + OPEN, a1]];
      pieces.forEach(([p, q]) => { const f = {}; Object.assign(f, face(ri, q - p, false)); slab(g, ax, c0, c1, p, q, 0, CUT, f); trims(g, 'x', fc, -1, p, q, false, ri); });
      const zf = pos;   // 手前の壁の線
      [-1, 1].forEach(sd => add(cutZ, .1, 2.3, .36, cx + sd * (OPEN + .05), 1.15, zf + .15, wood, true));   // ドア枠（柱）
      add(cutZ, OPEN * 2 + .2, .12, .36, cx, 2.36, zf + .15, wood, true);                                    // ドア枠（まぐさ）
      // 木のドア：外側へ開いている（部屋の中をじゃましない）。ちょうつがいは奥側の柱
      const dc = document.createElement('canvas'); dc.width = 128; dc.height = 256; { const c = dc.getContext('2d'), gg = c.createLinearGradient(0, 0, 128, 0); gg.addColorStop(0, '#b97f4c'); gg.addColorStop(.5, '#c98e57'); gg.addColorStop(1, '#b57a47'); c.fillStyle = gg; c.fillRect(0, 0, 128, 256);
        c.strokeStyle = 'rgba(80,45,20,.22)'; c.lineWidth = 1; for (let i = 1; i < 6; i++) { c.beginPath(); c.moveTo(i * 21.3, 0); c.lineTo(i * 21.3, 256); c.stroke(); }
        c.strokeStyle = 'rgba(70,38,15,.55)'; c.lineWidth = 4; c.strokeRect(16, 16, 96, 90); c.strokeRect(16, 126, 96, 114); c.strokeStyle = 'rgba(255,225,180,.35)'; c.lineWidth = 2; c.strokeRect(20, 20, 88, 82); c.strokeRect(20, 130, 88, 106); }
      const dtex = canvasToTex(dc, 1, 1); ownedTex.push(dtex);
      const leaf = new THREE.Group(); leaf.position.set(cx - OPEN + .02, 0, zf + .12); leaf.rotation.y = -1.3; cutZ.add(leaf);
      const dm = stdMat({ map: dtex, roughness: .6 }), lw = OPEN * 2 - .06;
      add(leaf, lw, 2.22, .07, lw / 2, 1.12, 0, [wood, wood, wood, wood, dm, dm], true);
      const brass = stdMat({ color: 0xd9b45a, roughness: .3, metalness: .8 });
      [0, 1].forEach(i => { const k = new THREE.Mesh(new THREE.SphereGeometry(.05, 12, 8), brass); k.position.set(lw - .15, 1.05, i ? -.06 : .06); k.castShadow = true; leaf.add(k); });
      // 土間（タイル）・玄関マット・外の段差。床に平らなので、手前の壁を沈めても残る
      const tc = document.createElement('canvas'); tc.width = 128; tc.height = 64; { const c = tc.getContext('2d'); c.fillStyle = '#a9a39a'; c.fillRect(0, 0, 128, 64);
        for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) { c.fillStyle = (i + j) % 2 ? '#d3cdc0' : '#c4beb0'; c.fillRect(i * 32 + 2, j * 32 + 2, 28, 28); } }
      const ttex = canvasToTex(tc, 1, 1); ownedTex.push(ttex);
      add(roomG, 2, .04, 1, cx, .02, zf - .5, stdMat({ map: ttex, roughness: .5 }));
      const mc = document.createElement('canvas'); mc.width = mc.height = 64; { const c = mc.getContext('2d'); c.fillStyle = '#8f3f35'; c.fillRect(0, 0, 64, 64); c.strokeStyle = '#e9d6b0'; c.lineWidth = 3; c.strokeRect(5, 5, 54, 54);
        c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 1; for (let i = 8; i < 60; i += 4) { c.beginPath(); c.moveTo(i, 8); c.lineTo(i, 56); c.stroke(); } }
      const mtex = canvasToTex(mc, 1, 1); ownedTex.push(mtex);
      add(roomG, 1.2, .03, .7, cx, .055, zf - .55, stdMat({ map: mtex, roughness: 1 }));
      add(roomG, OPEN * 2 + .3, .1, .5, cx, .05, zf + .4, stdMat({ color: 0xbdb5a8, roughness: .8 }), true);
      return;
    }
    // 外壁・部屋どうしの壁
    if (kind === 'out') seam(ri, a0, a1, s > 0, fc); else { seam(sg.hi, a0, a1, true, pos); seam(lo, a0, a1, false, pos - ST); }
    slab(g, ax, c0, c1, a0, a1, 0, top, faces);
  });
  // 外壁の角（出っぱった角のすき間をふさぐ）
  rooms.forEach(rm => {
    [[0, 0, -1, -1], [1, 0, 1, -1], [0, 1, -1, 1], [1, 1, 1, 1]].forEach(([ix, iz, sx, sz]) => {
      const cx = rm.x + ix * rm.w, cz = rm.z + iz * rm.d;
      if (roomAt(rooms, cx + (sx > 0 ? 0 : -1), cz + (sz > 0 ? 0 : -1)) >= 0 || roomAt(rooms, cx + (sx > 0 ? 0 : -1), cz + (sz > 0 ? -1 : 0)) >= 0 || roomAt(rooms, cx + (sx > 0 ? -1 : 0), cz + (sz > 0 ? 0 : -1)) >= 0) return;
      const full = ix === 0 && iz === 0, h = full ? WH : CUT;
      add(full ? roomG : (ix ? cutX : cutZ), OT, h, OT, cx + sx * OT / 2, h / 2, cz + sz * OT / 2, plain);
    });
  });
  // グリッド（配置中のみ表示。今いる部屋だけ）
  const pts = []; for (let i = 0; i <= cr.w; i++) pts.push(i, .012, 0, i, .012, cr.d); for (let i = 0; i <= cr.d; i++) pts.push(0, .012, i, cr.w, .012, i);
  gridLines = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .28 }));
  gridLines.visible = false; gridLines.position.set(cr.x, 0, cr.z); roomG.add(gridLines);
  // 今いる部屋の床のふちをうっすら光らせる（部屋が2つ以上のとき）
  if (rooms.length > 1) {
    const gm = new THREE.MeshBasicMaterial({ color: 0xfff1b8, transparent: true, opacity: .8, depthWrite: false }), th = .16;
    [[cr.w, th, cr.x + cr.w / 2, cr.z + th / 2], [cr.w, th, cr.x + cr.w / 2, cr.z + cr.d - th / 2], [th, cr.d - 2 * th, cr.x + th / 2, cr.z + cr.d / 2], [th, cr.d - 2 * th, cr.x + cr.w - th / 2, cr.z + cr.d / 2]].forEach(([w, d, x, z]) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), gm); m.rotation.x = -Math.PI / 2; m.position.set(x, .02, z); m.renderOrder = 2; roomG.add(m);
    });
  }
  // 接地影（家の下の淡い影）
  const S = Math.max(box.w, box.d), bcx = (box.x0 + box.x1) / 2, bcz = (box.z0 + box.z1) / 2;
  blob.scale.set(box.w + S * 1.1, box.d + S * 1.1, 1); blob.position.set(bcx + S * .12, -T - .02, bcz + S * .12);
  // 影の範囲と光の向き（日光は窓のある壁側〜手前から、寒色フィルは反対側から）
  const sc = sun.shadow.camera, r = S * .95 + Math.abs(box.w - box.d) * .3; sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.near = .5; sc.far = S * 4; sc.updateProjectionMatrix();
  sun.position.set(bcx + S * 1.05, S * 1.25, bcz + S * .75); sun.target.position.set(bcx, 0, bcz); sun.target.updateMatrixWorld();
  fill.position.set(bcx - S * .4, S * .8, bcz + S * .9); fill.target.position.set(bcx, 0, bcz); fill.target.updateMatrixWorld();
  curRooms = rooms;
  fitD = 0; cam.h = 0; cam.dirty = true;
}
export const showGrid = on => { if (gridLines && gridLines.visible !== on) { gridLines.visible = on; cam.dirty = true; } };
