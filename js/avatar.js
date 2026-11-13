// me-（ちびキャラ）の3Dモデルを、設定(me)から作る。かわいさ優先：丸い形・縦長楕円の目＋ハイライト
// きせかえ（ふく・ぼうし・アクセ・かばん）もここで着せる。どれもオリジナルの造形
import * as THREE from 'three';
import { M, MF, MT, MM, G, cyl, sph, rbox, cone, lathe, torus } from './mk.js?v=202611131634';
import { texOf } from './textures.js?v=202611131634';
import { cleanMe, defaultMe, meKey, HAIR_COLORS, SKIN_COLORS, HOOD_COLORS, EYE_COLORS, CHEEK_COLORS } from './me.js?v=202611131634';

export function shiftColor(hex, dl, ds) { const c = new THREE.Color(hex), o = {}; c.getHSL(o); c.setHSL(o.h, Math.max(0, Math.min(1, o.s + (ds || 0))), Math.max(0, Math.min(1, o.l + dl))); return '#' + c.getHexString(); }
const soft = (c, o) => M(c, Object.assign({ roughness: .85 }, o || {}));
// 顔の表面の z（頭は半径 (.302,.268,.285) の楕円体）
const onFace = (x, y) => .285 * Math.sqrt(Math.max(.01, 1 - (x / .302) ** 2 - (y / .268) ** 2));
// ===== 体の形（2026-11-13 作り直し）：球の組み合わせではなく、肩・胸・腰のある胴＋長めの腕と脚 =====
// 胴は「高さ y ごとの半径」(TORSO) を回した形を、前後に少しうすく（BODY_D）したもの。服の飾りは onBody で表面に貼る
export const LEG = .13;     // 脚を前より長くしたぶん（体全体をこれだけ持ち上げる。足の裏が y=0）
export const HEAD_Y = .84;  // 体(body)の中での頭の中心の高さ
export const AV = { label: 1.5, fx: 1.68 };   // 名札・頭の上の♪の高さ（せのたかさ bodyH をかける）
const TORSO = [[.17, .165], [.2, .172], [.3, .172], [.42, .18], [.5, .178], [.55, .16], [.58, .12], [.595, .06]], BODY_D = .78;
const rAt = y => { const T = TORSO; if (y <= T[0][0]) return T[0][1]; for (let i = 1; i < T.length; i++) if (y <= T[i][0]) { const [y0, r0] = T[i - 1], [y1, r1] = T[i]; return r0 + (r1 - r0) * (y - y0) / (y1 - y0); } return .03; };
// 胴の前の表面の z
const onBody = (x, y) => { const r = rAt(y); return BODY_D * r * Math.sqrt(Math.max(.01, 1 - (x / r) ** 2)); };
// 胴の前の表面にそった細い帯（カーディガンの前立て・ジャージのファスナー）
function frontStrip(mat, hw, y0, y1) {
  const pos = [], idx = [], R = 12, C = 3;
  for (let i = 0; i <= R; i++) { const y = y0 + (y1 - y0) * i / R; for (let j = 0; j <= C; j++) { const x = -hw + 2 * hw * j / C; pos.push(x, y, onBody(x, y) + .004); } }
  for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) { const a = i * (C + 1) + j, b = a + C + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}
// スーツの胸もとの白いシャツ（逆三角形）を、胴の表面にそわせて作る
function shirtV(mat) {
  const pos = [], idx = [], R = 8, C = 4;
  for (let i = 0; i <= R; i++) {
    const t = i / R, y = .556 - t * .15, hw = .072 * (1 - t) + .002;
    for (let j = 0; j <= C; j++) { const x = -hw + 2 * hw * j / C; pos.push(x, y, onBody(x, y) + .004); }
  }
  for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) { const a = i * (C + 1) + j, b = a + C + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}
// 胴の表面にそって曲がるひも（かばんのベルト・つりひも・くさり）。pts は胴の座標の点の列
const tubeAlong = (pts, r, mat) => { const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), Math.max(12, pts.length * 4), r, 7), mat); m.castShadow = true; return m; };
// 横位置 x で、胴の前(下)→肩の上→背中へ回る線。a0/a1 は胴の断面での角度（0=正面の中央の高さ、π/2=肩の上、π=背中）
// 胴は角の丸い四角に近いので、まるい楕円ではなく「ふくらんだ楕円」(べき .6) でまわす
function overShoulder(x, a0, a1, off) {
  const f = Math.sqrt(Math.max(.05, 1 - (x / .182) ** 2)), ry = .212 * f + off, rz = BODY_D * .18 * f + off, pts = [], pw = v => Math.sign(v) * Math.pow(Math.abs(v), .6);
  for (let i = 0; i <= 14; i++) { const a = a0 + (a1 - a0) * i / 14; pts.push(new THREE.Vector3(x, .38 + ry * pw(Math.sin(a)), rz * pw(Math.cos(a)))); }
  return pts;
}
// すそ：胴からなめらかに広がる形（平たい円ばんが浮いて見えないように）
const hem = (mat, k) => { const m = lathe([[0, 0], [.168 * k, 0], [.181 * k, .012], [.186 * k, .035], [.18 * k, .06], [.174, .08], [0, .085]], mat, 0, .17, 0, 32); m.scale.z = BODY_D; return m; };
// 顔のパーツを顔の表面にぴったり付ける：表面の点に置き、表面の向き（法線）にそろえる。out=表面からの浮き(-で沈める)
const _Z = new THREE.Vector3(0, 0, 1);
const faceN = (x, y, z) => new THREE.Vector3(x / .302 ** 2, y / .268 ** 2, z / .285 ** 2).normalize();
function onSurf(m, x, y, out) { const z = onFace(x, y), rz = m.rotation.z; m.position.set(x, y, z + (out || 0)); m.quaternion.setFromUnitVectors(_Z, faceN(x, y, z)); if (rz) m.rotateZ(rz); return m; }
const arc = (R, r, mat, x, y, z, rz) => { const m = new THREE.Mesh(new THREE.TorusGeometry(R, r, 6, 14, Math.PI), mat); m.position.set(x, y, z); m.rotation.z = rz || 0; m.castShadow = true; return m; };
const ell = (r, mat, x, y, z, sx, sy, sz, rz) => { const m = sph(r, mat, x, y, z); m.scale.set(sx, sy, sz); if (rz) m.rotation.z = rz; return m; };
const ring = (R, r, mat, x, y, z) => { const m = torus(R, r, mat, x, y, z); m.rotation.x = Math.PI / 2; return m; };   // 水平の輪
const dome = (r, mat, sx, sy, sz) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 36, 18, 0, Math.PI * 2, 0, Math.PI / 2), mat); m.scale.set(sx, sy, sz); m.castShadow = true; return m; };
function stripeMat(hex) {
  const t = texOf('stripe' + hex, 16, 128, (c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#fbf8f1' : hex; c.fillRect(0, i * h / 8, w, h / 8); } });
  return MT(t, { roughness: .95 });
}
// 服の柄：knit（たてのあみ目）・aloha（花）・check（チェック）・dot（水玉）。hex＝地の色、hex2＝柄の色
function patMat(kind, hex, hex2) {
  const t = texOf('pat' + kind + hex + hex2, 128, 128, (c, w, h) => {
    c.fillStyle = hex; c.fillRect(0, 0, w, h);
    if (kind === 'knit') { c.fillStyle = 'rgba(0,0,0,.09)'; for (let x = 0; x < w; x += 8) c.fillRect(x, 0, 3, h); c.fillStyle = 'rgba(255,255,255,.12)'; for (let y = 0; y < h; y += 6) for (let x = 0; x < w; x += 8) c.fillRect(x + 4, y, 3, 3); }
    else if (kind === 'check') { c.fillStyle = hex2; c.globalAlpha = .45; for (let i = 0; i < w; i += 32) { c.fillRect(i, 0, 14, h); c.fillRect(0, i, w, 14); } c.globalAlpha = .25; c.fillStyle = '#000'; for (let i = 0; i < w; i += 32) { c.fillRect(i + 20, 0, 3, h); c.fillRect(0, i + 20, w, 3); } c.globalAlpha = 1; }
    else if (kind === 'dot') { c.fillStyle = hex2; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { c.beginPath(); c.arc(x * 32 + (y % 2) * 16 + 8, y * 32 + 8, 6, 0, Math.PI * 2); c.fill(); } }
    else if (kind === 'aloha') {
      [[24, 26], [88, 18], [56, 70], [16, 100], [104, 96]].forEach(([x, y], i) => {
        c.fillStyle = i % 2 ? '#fff6d8' : '#ffffff'; for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; c.beginPath(); c.ellipse(x + Math.cos(a) * 9, y + Math.sin(a) * 9, 8, 5, a, 0, Math.PI * 2); c.fill(); }
        c.fillStyle = '#ffd24a'; c.beginPath(); c.arc(x, y, 4, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(40,110,60,.55)'; c.beginPath(); c.ellipse(x + 16, y + 14, 12, 4, .7, 0, Math.PI * 2); c.fill();
      });
    }
  }, 2, 2);
  return MT(t, { roughness: .95 });
}

// ===== かみ：玉の寄せ集めではなく、頭をつつむ1枚のなめらかな「かみの面」から作る =====
// 向き th（0=正面、±π/2=横、±π=うしろ）ごとに「どこまで下に伸びるか」(L＝てっぺんからの角度。π/2 より先は下へまっすぐ垂れる)を決めると、
// 前髪の毛先・もみあげ・えりあしが1つの形でつながる。毛先のギザギザ・すじ・天使の輪（つやの帯）も面の上に作る
const HC = { x: 0, y: .045, z: -.035 }, HR = { x: .325, y: .3, z: .315 };
const smooth = (x, a, b) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const tri = x => 1 - Math.abs(2 * (x - Math.floor(x)) - 1);   // 0〜1 の三角波（毛先のギザギザ用）
const zig = (th, n, amp, ph) => amp * Math.pow(tri(th * n / (Math.PI * 2) + (ph || 0)), 1.6);
const frontW = (th, a, b) => 1 - smooth(Math.abs(th), a, b);   // 正面=1 → 横=0
function shellPos(th, ph, o, v) {
  const sc = o.scale || 1, s = Math.min(ph, Math.PI / 2), drop = Math.max(0, ph - Math.PI / 2) * HR.y * 1.25;
  const hr = drop > 0 ? 1 - (o.hug || 0) * Math.min(1, drop / .2) : 1;
  return v.set(HC.x + HR.x * sc * Math.sin(s) * Math.sin(th) * hr, HC.y + HR.y * sc * Math.cos(s) - drop, HC.z + HR.z * sc * Math.sin(s) * Math.cos(th) * hr);
}
// 面の上の点と、その外向き（パーツを髪にぴったり付けるため）
function onHair(th, ph, o) { const p = shellPos(th, ph, o || {}, new THREE.Vector3()), n = new THREE.Vector3((p.x - HC.x) / HR.x ** 2, (p.y - HC.y) / HR.y ** 2, (p.z - HC.z) / HR.z ** 2).normalize(); return { p, n }; }
function hairShell(hex, L, o) {
  o = o || {}; const NU = o.nu || 128, NV = o.nv || 34, pos = [], col = [], idx = [], v = new THREE.Vector3(), base = new THREE.Color(hex);
  const groove = o.groove == null ? .006 : o.groove, gn = o.gn || 28, tuck = o.tuck == null ? .7 : o.tuck;
  for (let i = 0; i <= NU; i++) {
    const th = -Math.PI + Math.PI * 2 * i / NU, Lt = L(th);
    for (let j = 0; j <= NV; j++) {
      const t = j / NV, ph = Lt * t; shellPos(th, ph, o, v);
      const up = Math.min(1, ph / 1.1), e = smooth(t, .72, 1);
      let g = 1 + groove * Math.cos(th * gn) * up;   // 毛のすじ
      if (o.curl) { const r = Math.sin(ph * 8); g += o.curl * (o.under ? smooth(ph, 1.0, 1.7) : 1) * Math.pow(Math.abs(r * Math.sin(th * 7 + (r > 0 ? 0 : Math.PI / 2))), .85) * Math.min(1, ph / .4); }   // ふわふわのカール
      if (o.part) g -= o.part * Math.exp(-((th / .07) ** 2)) * (1 - smooth(ph, .2, 1.1));   // 分け目
      const fl = (o.flip || 0) * (1 - frontW(th, .9, 1.3));   // 毛先の外はね(+)・内まき(-)。前髪にはかけない
      g += fl * e;
      if (o.under) g *= 1 - .1 * (1 - smooth(ph, 1.0, 1.75));   // 帽子の下：上の方を少しおさえて、帽子からはみ出さない
      v.x = HC.x + (v.x - HC.x) * g; v.z = HC.z + (v.z - HC.z) * g; if (ph < Math.PI / 2) v.y = HC.y + (v.y - HC.y) * g;
      if (fl > 0) v.y += fl * e * .7;
      // 顔の前にかかる毛先は、顔の表面にそっと沿わせる（浮かない・顔にめりこまない）
      if (Math.cos(th) > .2 && Math.abs(v.x) < .3 && Math.abs(v.y) < .265) {
        const zf = onFace(v.x, v.y) + .011;
        if (v.z < zf) v.z = zf; else v.z += (zf - v.z) * tuck * smooth(t, .45, 1) * Math.min(1, Math.cos(th) * 2);
      }
      pos.push(v.x, v.y, v.z);
      // 色：てっぺん寄りに天使の輪（つやの帯）、毛先は少し明るく、内側（下の方）は少し暗く
      const k = 1 + .05 * (1 - smooth(ph, .2, 1.3)) + .04 * e - .07 * smooth(ph, 1.6, 2.6);   // てっぺんが少し明るいだけ（帯にすると、部屋で見るとカチューシャのように見えるため）
      col.push(base.r * k, base.g * k, base.b * k);
    }
  }
  // 面の表を外向きにする（後処理の陰影(AO)は表の面だけで計算するので、裏向きだと頭のまわりに暗い輪ができる）
  for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) { const a = i * (NV + 1) + j, b = a + NV + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  const nr = geo.attributes.normal; for (let j = 0; j <= NV; j++) { const a = j, b = NU * (NV + 1) + j; const x = nr.getX(a) + nr.getX(b), y = nr.getY(a) + nr.getY(b), z = nr.getZ(a) + nr.getZ(b), l = Math.hypot(x, y, z) || 1; nr.setXYZ(a, x / l, y / l, z / l); nr.setXYZ(b, x / l, y / l, z / l); }   // うしろのつなぎ目をなめらかに
  const m = new THREE.Mesh(geo, hairShellMat()); m.castShadow = true; m.userData.hair = true; return m;
}
let _hsm = null;
const hairShellMat = () => _hsm || (_hsm = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .62, metalness: 0, side: THREE.DoubleSide }));
// 毛たば（しっぽ・おさげ）：曲線にそって太さが変わる管。先は細くとがらせ、すじを入れる
function lock(pts, r0, r1, mat, o) {
  o = o || {}; const cv = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2]))), N = 28, M = 16, fr = cv.computeFrenetFrames(N, false), pos = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, P = cv.getPointAt(t), bul = 1 + (o.bulge == null ? .35 : o.bulge) * Math.sin(Math.PI * Math.min(1, t * 1.3)), r = (r0 + (r1 - r0) * Math.pow(t, o.pw || 1.4)) * bul;
    for (let k = 0; k <= M; k++) { const a = k / M * Math.PI * 2, rr = r * (1 + .07 * Math.cos(a * 6 + t * 3)), Nn = fr.normals[i], B = fr.binormals[i]; pos.push(P.x + (Nn.x * Math.cos(a) + B.x * Math.sin(a)) * rr, P.y + (Nn.y * Math.cos(a) + B.y * Math.sin(a)) * rr, P.z + (Nn.z * Math.cos(a) + B.z * Math.sin(a)) * rr); }
  }
  const tip = cv.getPointAt(1).add(cv.getTangentAt(1).multiplyScalar(r1 * 1.5)), ti = pos.length / 3; pos.push(tip.x, tip.y, tip.z);
  for (let i = 0; i < N; i++) for (let k = 0; k < M; k++) { const a = i * (M + 1) + k, b = a + M + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }   // 表が外向き
  for (let k = 0; k < M; k++) idx.push(N * (M + 1) + k, N * (M + 1) + k + 1, ti);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat); m.castShadow = true; return m;
}
// みつあみ：曲線にそって、ななめの粒を左右交互に重ねる
function braid(pts, r0, mat, head) {
  const cv = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2]))), n = 9, up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < n; i++) {
    const t = (i + .5) / n, P = cv.getPointAt(t), T = cv.getTangentAt(t), r = r0 * (1 - t * .35), s = i % 2 ? 1 : -1;
    const b = sph(r, mat, 0, 0, 0); b.geometry = new THREE.SphereGeometry(r, 16, 12); b.scale.set(1.05, 1.5, .9);
    b.quaternion.setFromUnitVectors(up, T.clone().negate()); b.rotateZ(s * .55); b.position.copy(P).add(new THREE.Vector3(s * r * .28, 0, 0)); head.add(b);
  }
  return cv.getPointAt(1);
}
// ヘアゴム・ピン：髪の面の上にぴったり置く
function onHairPart(m, th, ph, o, out) { const { p, n } = onHair(th, ph, o); m.position.copy(p).addScaledVector(n, out || 0); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n); return m; }

function hairParts(style, hairHex, hair, hair2, head, pin, hat) {
  const add = (...a) => head.add(...a), under = [1, 2, 3, 4, 8, 9, 10, 13].includes(hat);   // 頭をおおう帽子をかぶっているか
  const shell = (L, o) => add(hairShell(hairHex, L, Object.assign({ under }, o)));
  // 長さの組み立て：正面の前髪(front) と 横〜うしろ(side→back) を、顔のまわりでなめらかにつなぐ
  const mixL = (front, side, back, a, b) => th => { const sd = side + (back - side) * smooth(Math.abs(th), 1.7, 2.7), f = typeof front === 'function' ? front(th) : front; const A0 = a || .75, B0 = Math.max(b || 1.65, A0 + .8), w = frontW(th, A0, B0); return sd + (f - sd) * w; };   // 前髪→横の髪は、こめかみで段にならないよう広い範囲でなめらかに
  const tieRing = (p, n, r) => { const m = new THREE.Mesh(new THREE.TorusGeometry(r || .05, .016, 8, 20), pin); m.position.copy(p); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n); m.castShadow = true; add(m); };
  const clip = (th, ph) => { if (under) return; const c = rbox(.075, .022, .02, .008, pin, 0, -.011, 0); const g = G(); g.add(c); onHairPart(g, th, ph, {}, .004); g.rotateZ(th > 0 ? .5 : -.5); add(g); };
  if (style === 7) {   // ぼうず：頭にぴったり、すじは細かく
    shell(mixL(1.12, 1.75, 2.15), { scale: .975, groove: .004, gn: 40, hug: .1, tuck: .6 }); return;
  }
  if (style === 0) {   // ボブ：まっすぐな前髪、あごの高さで外にはねる
    shell(mixL(th => 1.33 + zig(th, 14, .05), 2.2, 2.26, .85, 1.25), { flip: .05, hug: .04 }); clip(.72, 1.02);
  } else if (style === 1) {   // ショート：毛たばの前髪、えりあしはすっきり
    shell(mixL(th => 1.2 + zig(th, 9, .14, .5), 1.8, 2.2), { hug: .14, groove: .009 });
  } else if (style === 2) {   // ツンツン：まるい先の毛たばが立ち上がる
    shell(mixL(th => 1.1 + zig(th, 7, .24, .5), 1.75, 2.15), { hug: .12, groove: .009 });
    const spk = new THREE.LatheGeometry([[.075, -.04], [.072, .02], [.058, .09], [.036, .15], [.016, .185], [0, .195]].map(([r, y]) => new THREE.Vector2(r, y)), 14);
    // 帽子をかぶっているときは、帽子からつき出さないように立った毛たばは出さない
    [[0, .12], [.65, .42], [-.65, .42], [1.35, .62], [-1.35, .62], [2.2, .62], [-2.2, .62], [Math.PI, .58], [2.75, 1.0], [-2.75, 1.0], [.25, .5], [-.3, .52], [1.8, 1.0], [-1.8, 1.0]].filter(() => !under).forEach(([th, ph], i) => {
      const { p, n } = onHair(th, ph), d = n.clone().add(new THREE.Vector3(0, .45, -.35)).normalize(), m = new THREE.Mesh(spk, hair2);
      m.position.copy(p).addScaledVector(n, -.035); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d); m.scale.setScalar(i < 3 ? 1.1 : .95); m.castShadow = true; add(m);
    });
  } else if (style === 3 || style === 10) {   // ポニーテール／サイドテール：前髪は横に流して、髪はうしろでまとめる
    shell(mixL(th => 1.22 + th * .1 + zig(th, 8, .1), 1.78, 2.05), { hug: .1 });
    if (style === 3) {
      const { p, n } = onHair(Math.PI, 1.3); tieRing(p, n, .055);
      add(lock([[0, p.y, p.z + .01], [0, p.y + .03, p.z - .08], [0, p.y - .07, p.z - .15], [0, p.y - .24, p.z - .13], [0, p.y - .4, p.z - .08]], .085, .02, hair, { bulge: .5, pw: 1.8 }));
    } else {
      const { p, n } = onHair(2.0, 1.2); tieRing(p, n, .05);
      add(lock([[p.x - .01, p.y, p.z], [p.x + .08, p.y + .02, p.z - .03], [p.x + .13, p.y - .1, p.z - .03], [p.x + .12, p.y - .27, p.z], [p.x + .08, p.y - .42, p.z + .02]], .08, .018, hair, { bulge: .5, pw: 1.8 }));
    }
  } else if (style === 4) {   // ツインテール：まん中分け＋左右の高い位置でむすぶ
    shell(mixL(th => 1.2 + .14 * Math.min(1, Math.abs(th) / .8) + zig(th, 10, .08), 1.78, 2.05), { hug: .12, part: .02 });
    [-1, 1].forEach(s => {
      const { p, n } = onHair(s * 2.05, 1.18); tieRing(p, n, .045);
      add(lock([[p.x, p.y, p.z], [p.x + s * .09, p.y + .01, p.z - .04], [p.x + s * .14, p.y - .12, p.z - .03], [p.x + s * .14, p.y - .3, p.z], [p.x + s * .1, p.y - .44, p.z + .02]], .072, .016, hair, { bulge: .5, pw: 1.8 }));
    });
  } else if (style === 5) {   // おだんご：うしろ上でまとめて、ねじった丸いおだんご
    shell(mixL(th => 1.22 + th * .1 + zig(th, 8, .1), 1.78, 2.05), { hug: .1 });
    const { p, n } = onHair(Math.PI, .55), c = p.clone().addScaledVector(n, .085);
    const bun = sph(.105, hair, c.x, c.y, c.z); bun.geometry = new THREE.SphereGeometry(.105, 24, 18); add(bun);
    for (let k = 0; k < 3; k++) { const tr = new THREE.Mesh(new THREE.TorusGeometry(.078 - k * .02, .028, 10, 24), hair); tr.position.copy(c).addScaledVector(n, .035 + k * .025); tr.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n); tr.rotateX(.2 * k); add(tr); }
    tieRing(p.clone().addScaledVector(n, .012), n, .06);
  } else if (style === 6) {   // ロング：まっすぐ背中まで、毛先は少し内まき
    shell(th => { const base = mixL(th2 => 1.33 + zig(th2, 14, .05), 2.95, 3.05, .85, 1.25)(th); return base + (Math.abs(th) > 1.1 ? zig(th, 22, .07) : 0); }, { flip: -.02, hug: .06 });
    clip(.72, 1.02);
  } else if (style === 8) {   // ふわパーマ：全体がふんわり、カールのでこぼこ
    shell(mixL(th => 1.2 + zig(th, 11, .1), 2.05, 2.15), { curl: .05, groove: 0, flip: .02, scale: 1.04, nu: 150, nv: 40 });
  } else if (style === 9) {   // センター分け：まん中から左右に流れる前髪
    shell(mixL(th => .98 + .5 * Math.pow(Math.min(1, Math.abs(th) / .8), 1.3), 2.08, 2.12, 1.0, 1.4), { part: .03, hug: .05, flip: .015 });
  } else if (style === 11) {   // みつあみ（2本）：まん中分け、耳の下からおさげ
    shell(mixL(th => 1.2 + .14 * Math.min(1, Math.abs(th) / .8), 1.9, 2.15), { part: .025, hug: .1 });
    [-1, 1].forEach(s => {
      const end = braid([[s * .27, -.06, -.1], [s * .3, -.2, -.07], [s * .29, -.36, -.04], [s * .27, -.5, -.01]], .05, hair, head);
      tieRing(end, new THREE.Vector3(0, 1, 0), .028);
      add(lock([[end.x, end.y, end.z], [end.x, end.y - .04, end.z], [end.x, end.y - .09, end.z + .01]], .03, .012, hair, { bulge: .5 }));
    });
  } else if (style === 12) {   // マッシュ：まるいシルエット、まゆの上でまっすぐそろう
    shell(mixL(1.4, 1.8, 2.1, 1.0, 1.35), { scale: 1.05, flip: -.025, groove: .006, gn: 36, tuck: .6 });
  } else if (style === 13) {   // ハーフアップ：上半分をうしろで小さくまとめる
    shell(mixL(th => 1.33 + zig(th, 14, .05), 2.75, 2.85, .85, 1.25), { hug: .06, flip: -.015 });
    const { p, n } = onHair(Math.PI, .95), c = p.clone().addScaledVector(n, .05);
    const bun = sph(.07, hair, c.x, c.y, c.z); bun.geometry = new THREE.SphereGeometry(.07, 20, 14); add(bun);
    tieRing(p.clone().addScaledVector(n, .015), n, .045);
  } else if (style === 14) {   // くせ毛：大きくふくらんだ、くるくるのボリューム
    shell(mixL(th => 1.22 + zig(th, 9, .12), 2.05, 2.2), { curl: .085, groove: 0, flip: .03, scale: 1.17, nu: 170, nv: 46, hug: -.04 });
  } else if (style === 15) {   // ウルフ：トップは短め、えりあしだけ長く毛先がギザギザ
    shell(th => mixL(th2 => 1.18 + zig(th2, 10, .12), 1.95, 2.7)(th) + (Math.abs(th) > 1.7 ? zig(th, 13, .2) : 0), { hug: .12, groove: .009, flip: .02 });
  } else if (style === 16) {   // ぱっつんロング：まゆの上でまっすぐそろった前髪＋背中までのロング
    shell(mixL(1.38, 2.95, 3.05, .95, 1.3), { flip: -.02, hug: .05, groove: .005 });
  } else if (style === 17) {   // ななめ前髪：片がわに流れる前髪のショート
    shell(mixL(th => 1.08 + .28 * smooth(th, -.9, .9) + zig(th, 8, .07), 1.85, 2.2, .9, 1.3), { hug: .12, groove: .008 });
  } else if (style === 18) {   // ベリーショート：頭にそった短い髪、前髪はおでこの上
    shell(mixL(1.0, 1.62, 2.0), { scale: .985, hug: .12, groove: .006, gn: 34, tuck: .6 });
  } else if (style === 19) {   // ひくめおさげ：まん中分け、えりあしの低い位置で2つにむすぶ
    shell(mixL(th => 1.3 + .1 * Math.min(1, Math.abs(th) / .8) + zig(th, 12, .04), 1.95, 2.15), { part: .022, hug: .08 });
    [-1, 1].forEach(s => {
      const { p, n } = onHair(s * 2.55, 1.85); tieRing(p, n, .04);
      add(lock([[p.x, p.y, p.z], [p.x + s * .03, p.y - .06, p.z + .01], [p.x + s * .05, p.y - .18, p.z + .04], [p.x + s * .05, p.y - .3, p.z + .06]], .062, .02, hair, { bulge: .5, pw: 1.8 }));
    });
  }
}
// 目：まず「表面＝z0」として部品を作り、最後にグループごと顔の表面に貼る（黒目は少しだけ沈め、光は黒目のすぐ前に薄く）
// パーツの位置・大きさ（me.eyeX など -1〜1）を、頭の座標のずれに直す
const adjOf = me => ({ ex: (me.eyeX || 0) * .028, ey: (me.eyeY || 0) * .034, es: 1 + (me.eyeS || 0) * .22, by: (me.browY || 0) * .028, my: (me.mouthY || 0) * .03 });
function eyes(style, head, eyeHex, A) {
  A = A || adjOf({});
  [-1, 1].forEach(s => {
    const g = G();
    const dk = n => M(eyeHex || n, { roughness: .15 }), white = M('#ffffff', { roughness: .1, emissive: 0xffffff, emissiveIntensity: .5 });
    const oval = (r, mat, x, y, z, sx, sy, sz) => g.add(ell(r, mat, x, y, z, sx, sy, sz));
    const light = (r, x, y, z) => oval(r, white, x, y, z == null ? .011 : z, 1, 1, .28);   // 光：うすい円盤を黒目の前に
    const hi = (a, b) => { light(a, .014, .034); light(b, -.014, -.02); };
    const iris = (r, mat, y, sx, sy) => oval(r, mat, 0, y || 0, -.013, sx, sy, .42);   // 前面が表面から少し出るだけ
    if (style === 0) { iris(.05, dk('#2b1e22'), 0, .78, 1.22); hi(.019, .0095); }
    else if (style === 1) { iris(.06, dk('#3a2418'), 0, .8, 1.2); light(.024, .017, .04, .014); light(.012, -.016, -.025, .014); }
    else if (style === 2) { g.rotation.z = s * .24; iris(.052, dk('#3b2a22'), 0, .8, 1.2); hi(.02, .01); }
    else if (style === 3) { g.rotation.z = -s * .2; iris(.047, dk('#1d2540'), 0, .8, 1.1); light(.018, .013, .03); light(.009, -.013, -.018); }
    else if (style === 4) { g.add(arc(.04, .0095, dk('#2b1e22'), 0, -.005, -.004, 0)); }
    else if (style === 5) { oval(.064, M('#26305a', { roughness: .15 }), 0, 0, -.016, .86, 1.2, .42); oval(.044, M(eyeHex || '#5b8fe0', { roughness: .2 }), 0, -.012, -.004, .85, 1.0, .4); light(.027, .018, .04, .016); light(.013, -.02, -.03, .016); light(.007, .02, -.012, .017); }
    else if (style === 6) { iris(.05, dk('#2b1e22'), -.012, .86, .62); oval(.03, M('#2b1e22', { roughness: .4 }), 0, .012, -.004, 1.65, .26, .35); light(.008, .015, -.008, .008); }   // ねむそう
    else if (style === 7) { g.rotation.z = -s * .32; iris(.05, dk('#2b1e22'), 0, .98, .9); hi(.017, .008); }   // つり目
    else if (style === 8) {   // まつげ
      iris(.05, dk('#2b1e22'), 0, .8, 1.18); hi(.019, .0095);
      const lash = M('#2b1e22', { roughness: .4 }); g.add(ell(.012, lash, s * .045, .045, -.002, .5, 1.6, .35, -s * .7), ell(.011, lash, s * .028, .058, -.002, .5, 1.4, .35, -s * .35));
    }
    else if (style === 9) { oval(.03, M('#2b1e22', { roughness: .4 }), 0, 0, -.004, 1.5, .2, .3); }   // ほそ目：横一文字
    else if (style === 10) { iris(.062, dk('#2b1e22'), 0, .95, 1.05); light(.024, .02, .03, .014); light(.012, -.018, -.022, .014); light(.007, .024, -.01, .015); }   // まんまる
    else if (style === 11) { iris(.05, dk('#2b1e22'), -.006, .86, .78); oval(.034, M('#2b1e22', { roughness: .4 }), 0, .024, -.002, 1.5, .2, .3); light(.01, .014, .004, .01); }   // じとっ：上がまっすぐ
    else if (style === 12) {   // ウインク：左はつむって、右はぱっちり
      if (s < 0) g.add(arc(.038, .009, dk('#2b1e22'), 0, -.006, -.004, 0));
      else { iris(.052, dk('#2b1e22'), 0, .8, 1.2); hi(.02, .01); }
    }
    g.scale.multiplyScalar(A.es);
    head.add(onSurf(g, s * (.1 + A.ex), -.03 + A.ey, 0));
  });
}
function glasses(style, head, A) {
  if (!style) return;
  A = A || adjOf({});
  const col = ['', '#3a3a44', '#5b7fc4', '#f08aa0', '#d9b04a'][style], mat = soft(col, { roughness: .35 });
  const tgeo = new THREE.CylinderGeometry(.0055, .0055, .27, 6).rotateX(Math.PI / 2);
  [-1, 1].forEach(s => {
    const x = s * (.1 + A.ex), y = -.03 + A.ey, z = onFace(x, y) + .004;
    if (style === 2) { const w = .15, hh = .12, t = .012; head.add(rbox(w, t, t, .004, mat, x, y + hh / 2 - t, z), rbox(w, t, t, .004, mat, x, y - hh / 2, z), rbox(t, hh, t, .004, mat, x - w / 2 + t / 2, y - hh / 2, z), rbox(t, hh, t, .004, mat, x + w / 2 - t / 2, y - hh / 2, z)); }
    else { const R = style === 3 ? .075 : style === 4 ? .068 : .072, r = style === 3 ? .014 : style === 4 ? .006 : .008, m = new THREE.Mesh(new THREE.TorusGeometry(R, r, 8, 24), mat); m.position.set(x, y, z); if (style === 4) m.scale.y = .86; m.castShadow = true; head.add(m); }
    const tp = new THREE.Mesh(tgeo, mat); tp.position.set(s * .23, y, .14); tp.rotation.y = Math.PI - s * .463; head.add(tp);
  });
  head.add(rbox(.04 + A.ex * 2, .012, .012, .004, mat, 0, -.036 + A.ey, onFace(0, -.03 + A.ey) + .006));
}
function mouth(style, head, adj) {
  const mm = soft('#c4585e', { roughness: .5 }), dark = soft('#8a2f3a', { roughness: .5 }), tongue = soft('#ff8aa0', { roughness: .6 }), dy = adj ? adj.my : 0;
  // すべて顔の表面に貼る（onSurf）。線(arc)は表面すれすれ、口の中は少し沈める。dy＝くちの高さ（スライダー）
  const A = (R, r, x, y, rz, mat) => head.add(onSurf(arc(R, r, mat || mm, 0, 0, 0, rz), x, y + dy, -.002));
  const E = (r, mat, x, y, sx, sy, sz, out) => head.add(onSurf(ell(r, mat, 0, 0, 0, sx, sy, sz), x, y + dy, out == null ? -.006 : out));
  if (style === 0) [-1, 1].forEach(s => A(.0165, .0058, s * .0165, -.118, Math.PI));
  else if (style === 1) A(.04, .0065, 0, -.1, Math.PI);
  else if (style === 2) { E(.032, dark, 0, -.125, 1, .85, .3); E(.02, tongue, 0, -.14, 1, .6, .3, -.003); }
  else if (style === 3) E(.018, dark, 0, -.122, 1, 1.15, .35, -.004);
  else if (style === 4) A(.034, .0065, .012, -.106, Math.PI + .4);
  else if (style === 5) { A(.033, .0065, 0, -.102, Math.PI); E(.022, tongue, .014, -.138, .9, 1.1, .3, -.004); }
  else if (style === 6) { E(.04, dark, 0, -.118, 1.1, .6, .3); E(.034, M('#ffffff', { roughness: .3 }), 0, -.108, 1.05, .28, .25, -.002); }   // ニッ
  else if (style === 7) E(.03, mm, 0, -.112, 1.25, .2, .28, -.004);   // むっ
  else if (style === 8) A(.03, .0065, 0, -.128, 0);   // へ
  else if (style === 9) { E(.046, dark, 0, -.118, 1.12, .58, .3); E(.04, M('#ffffff', { roughness: .3 }), 0, -.102, 1.06, .24, .25, -.002); E(.022, tongue, 0, -.132, 1.2, .5, .3, -.004); }   // にこっ：歯と舌
  else if (style === 10) E(.014, soft('#e8707a', { roughness: .4 }), 0, -.118, 1.15, .9, .5, -.002);   // おちょぼ
  else if (style === 11) E(.022, dark, 0, -.124, .9, 1.25, .35, -.004);   // ぽかん
}
function brows(style, hairHex, head, adj) {
  if (!style) return;
  const mat = soft(shiftColor(hairHex, -.1), { roughness: .8 }), a = adj || adjOf({}), dx = a.ex * .8, dy = a.by + a.ey * .6;   // まゆは目といっしょに少し動く
  if (style === 5) { [-1, 1].forEach(s => head.add(onSurf(ell(.022, mat, 0, 0, 0, 1.1, .8, .3), s * (.115 + dx), .1 + dy, -.004))); return; }   // まろ
  const P = [null, [1.6, .3, .3, 0], [1.9, .5, .32, 0], [1.7, .34, .3, .24], [1.6, .28, .3, -.2], null, [1.15, .58, .32, 0], [1.6, .3, .3, -.42], [1.75, .36, .3, .44]][style];
  [-1, 1].forEach(s => head.add(onSurf(ell(.03, mat, 0, 0, 0, P[0], P[1], P[2], s * P[3]), s * (.1 + dx), .078 + dy, -.005)));
}
// 顔の形：別の形を足すと継ぎ目が「二重あご」に見えるので、頭そのもの（1つの面）の下半分を少しずつ変形させる
// 目・口がのる顔の正面（中央・上）はほとんど動かさない（パーツが浮いたり沈んだりしないように）
const _headGeo = new Map();
// 変形そのもの（球の座標 x,y,z → 変形後）。頭の面と、顔のパーツの位置の両方に同じ変形をかける
function deformRaw(k, x, y, z) {
    const lo = smooth(-y, .02, .27), mid = Math.max(0, 1 - Math.abs(-y - .14) / .12);   // lo＝下ほど1、mid＝ほほの高さで1
    if (k === 1) { x *= 1 - .16 * lo; y -= .025 * lo; z *= 1 - .05 * lo * (z < 0 ? 1 : .3); }      // たまご顔：あごが細くとがる
    else if (k === 2) { x *= 1 - .13 * lo; y -= .065 * lo; }                                         // ほそ面：あごが下にのびる
    else if (k === 3) { x *= 1 + .1 * lo; y += .035 * lo * lo; }                                      // しかく顔：えらが張って、あご先は平ら
    else if (k === 4) { x *= 1 + .1 * mid; z *= 1 + .04 * mid * (z > 0 ? 0 : 1); }                   // ふっくら：ほほがまるくふくらむ
  return [x, y, z];
}
function headGeo(k) {
  if (_headGeo.has(k)) return _headGeo.get(k);
  const g = new THREE.SphereGeometry(.285, 48, 32), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const [x, y, z] = deformRaw(k, p.getX(i), p.getY(i), p.getZ(i)); p.setXYZ(i, x, y, z); }
  g.computeVertexNormals(); _headGeo.set(k, g); return g;
}
// 顔のパーツ（目・口・ほっぺ・まゆ・鼻・ほくろ・めがね）を、変形した面にのせ直す。頭の座標は 球×(1.06,.94,1)
function followFace(k, head, from) {
  if (!k) return;
  for (let i = from; i < head.children.length; i++) { const o = head.children[i], [x, y, z] = deformRaw(k, o.position.x / 1.06, o.position.y / .94, o.position.z); o.position.set(x * 1.06, y * .94, z); }
}
function faceDeco(me, skinHex, head) {
  const sk2 = soft(shiftColor(skinHex, -.12, .05), { roughness: .6 });
  if (me.nose === 1) head.add(sph(.014, sk2, 0, -.07, onFace(0, -.07) - .003));
  else if (me.nose === 2) head.add(sph(.022, sk2, 0, -.072, onFace(0, -.072) - .006));
  else if (me.nose === 3) head.add(ell(.012, sk2, 0, -.065, onFace(0, -.065) - .002, .7, 1.9, .7));
  else if (me.nose === 4) head.add(sph(.02, soft('#ff9c8a', { roughness: .6 }), 0, -.072, onFace(0, -.072) - .005));
  else if (me.nose === 5) head.add(ell(.016, sk2, 0, -.058, onFace(0, -.058) - .001, .8, 2.3, 1.15));   // たかめ
  else if (me.nose === 6) head.add(ell(.024, sk2, 0, -.076, onFace(0, -.076) - .006, 1.35, .9, .8));   // だんご
  else if (me.nose === 7) { const c = cone(.016, .03, sk2, 0, -.068, onFace(0, -.068) + .006, 10); c.rotation.x = Math.PI / 2 + .35; head.add(c); }   // ツン
  const MP = [null, [-.115, -.098], [.115, -.098], [-.21, -.06], [.21, -.06], [-.07, -.16], [.07, -.16]][me.mole];
  if (MP) head.add(sph(.0105, soft('#6b4030'), MP[0], MP[1], onFace(MP[0], MP[1]) - .002));
  // ほっぺ
  const cc = CHEEK_COLORS[me.cheek];
  if (cc) { const pink = soft(cc, { transparent: true, opacity: me.cheek === 3 ? .38 : .62, roughness: 1 }); [-1, 1].forEach(s => { const ch = sph(.045, pink, 0, 0, 0); ch.scale.set(1.25, .78, .3); head.add(onSurf(ch, s * .185, -.115, -.008)); }); }
  else if (me.cheek === 4) { const fr = soft('#b9805a', { roughness: .8 }); [-1, 1].forEach(s => [[.16, -.1], [.19, -.115], [.175, -.13], [.205, -.095]].forEach(([x, y]) => head.add(sph(.0075, fr, s * x, y, onFace(x, y) - .001)))); }
}

// ===== ぼうし（頭の座標）=====
function hats(k, head, hairMat) {
  if (!k) return;
  const add = (...a) => head.add(...a);
  if (k === 1) {   // ニット帽
    const g = G(); g.position.set(0, .06, -.01); g.rotation.x = -.2; const knit = MF('#e8705e', 'cloth'), rib = MF('#d65a4a', 'cloth');
    g.add(dome(.34, knit, 1.03, .95, 1.02), ring(.345, .042, rib, 0, .01, 0), sph(.075, MF('#fbf3e6', 'cloth'), 0, .35, 0)); add(g);
  } else if (k === 2) {   // キャップ
    const g = G(); g.position.set(0, .07, -.015); g.rotation.x = -.1; const c = M('#3f6fc4', { roughness: .7 });
    // つばは帽子のふちにぴったりつなげる（すき間ができないように）
    const brim = cyl(.2, .2, .018, c, 0, -.004, .25, 24); brim.scale.set(1, 1, 1.15);
    g.add(dome(.33, c, 1.03, .8, 1.02), brim, ring(.338, .012, c, 0, .004, 0), sph(.025, c, 0, .265, 0)); add(g);
  } else if (k === 3) {   // むぎわら帽子
    // 頭がすっぽり入る太さのクラウン（かみがつき出さないように）
    const g = G(); g.position.set(0, .1, -.025); g.rotation.x = -.12; const st = M('#e8cf8a', { roughness: .95 });
    g.add(cyl(.25, .32, .22, st, 0, 0, 0, 32), sph(.25, st, 0, .22, 0, .22), cyl(.52, .52, .02, st, 0, 0, 0, 40), cyl(.322, .318, .05, M('#d9534f', { roughness: .8 }), 0, .012, 0, 32)); add(g);
  } else if (k === 4) {   // ベレー帽
    // 頭のてっぺんをふんわり包む形（浮いた円ばんにならないように）
    const g = G(); g.position.set(.015, .2, -.03); g.rotation.z = .2; g.rotation.x = -.1; const c = MF('#5a4a6a', 'cloth');
    const top = sph(.3, c, 0, .06, 0); top.geometry = new THREE.SphereGeometry(.3, 32, 20); top.scale.set(1.18, .5, 1.15);
    g.add(top, ring(.3, .02, c, 0, -.005, 0), cyl(.012, .012, .05, c, 0, .2, 0, 6)); g.children[1].scale.set(1.02, 1.05, 1); add(g);
  } else if (k === 5) {   // ねこみみ（かみの色）
    const inner = soft('#ffb3c1', { roughness: .9 });
    [-1, 1].forEach(s => { const e = cone(.095, .2, hairMat, s * .18, .26, -.02, 4); e.rotation.z = -s * .35; const i = cone(.055, .12, inner, s * .178, .29, .03, 4); i.rotation.z = -s * .35; add(e, i); });
  } else if (k === 6) {   // リボン（右上）
    // 髪の面の上にぴったり置く
    const g = G(); onHairPart(g, .8, .62, {}, .012); g.rotateZ(-.35); const r = soft('#ff7aa0', { roughness: .6 });
    g.add(ell(.06, r, -.055, 0, 0, 1.2, .78, .55), ell(.06, r, .055, 0, 0, 1.2, .78, .55), sph(.028, soft('#e85a86'), 0, 0, .012)); add(g);
  } else if (k === 7) {   // おうかん
    const g = G(); g.position.set(0, .27, -.02); const gold = M('#e8b830', { metalness: .85, roughness: .3 });
    const band = new THREE.Mesh(new THREE.CylinderGeometry(.15, .14, .09, 28, 1, true), Object.assign(gold.clone(), { side: THREE.DoubleSide })); band.position.y = .045; band.castShadow = true; g.add(band);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.add(cone(.03, .07, gold, Math.sin(a) * .148, .09, Math.cos(a) * .148, 6), sph(.016, gold, Math.sin(a) * .148, .17, Math.cos(a) * .148)); }
    g.add(sph(.022, M('#e0404a', { roughness: .2 }), 0, .045, .155), sph(.016, M('#3f7fe0', { roughness: .2 }), .08, .045, .13), sph(.016, M('#3f7fe0', { roughness: .2 }), -.08, .045, .13)); add(g);
  } else if (k === 8) {   // ハンチング：平たい帽子＋前の短いつば
    const g = G(); g.position.set(0, .1, -.01); g.rotation.x = -.18; const c = MF('#8a6a4a', 'cloth');
    const brim = cyl(.16, .16, .016, c, 0, -.004, .24, 24); brim.scale.set(1, 1, .8); g.add(dome(.33, c, 1.04, .6, 1.08), brim, ring(.338, .012, c, 0, .004, 0)); add(g);
  } else if (k === 9) {   // バケットハット：下にかたむいたつば
    const g = G(); g.position.set(0, .07, -.02); g.rotation.x = -.1; const c = MF('#e8dcc0', 'cloth');
    g.add(dome(.335, c, 1.04, .78, 1.04), lathe([[.335, .01], [.43, -.07], [.432, -.085], [.33, -.005]], Object.assign(c.clone(), { side: THREE.DoubleSide }), 0, 0, 0, 32), ring(.338, .016, MF('#7a6a4a', 'cloth'), 0, .02, 0)); add(g);
  } else if (k === 10) {   // シルクハット：高いつつ＋つば＋赤い帯
    const g = G(); g.position.set(0, .2, -.03); g.rotation.x = -.08; const bk = M('#1e1e24', { roughness: .4 });
    g.add(cyl(.2, .2, .32, bk, 0, 0, 0, 32), cyl(.32, .32, .02, bk, 0, 0, 0, 36), cyl(.202, .202, .05, M('#c0392b', { roughness: .5 }), 0, .02, 0, 32)); add(g);
  } else if (k === 11) {   // カチューシャ
    const band = new THREE.Mesh(new THREE.TorusGeometry(.33, .016, 8, 32, Math.PI), M('#ff7aa0', { roughness: .4 })); band.position.set(0, .03, .03); band.rotation.x = -.25; band.castShadow = true; add(band);
  } else if (k === 12) {   // うさみみ
    const wt = soft('#fbf8f1', { roughness: .9 }), pk = soft('#ffb3c1', { roughness: .9 });
    [-1, 1].forEach(s => { const e = ell(.06, wt, s * .12, .42, -.02, .7, 2.6, .5, -s * .18), i = ell(.035, pk, s * .12, .42, .005, .6, 2.3, .3, -s * .18); add(e, i); });
  } else if (k === 13) {   // サンタぼうし
    const g = G(); g.position.set(0, .1, -.02); g.rotation.x = -.15; const r = M('#d0343c', { roughness: .7 }), wt = MF('#fbf8f1', 'cloth');
    const cn = cone(.31, .42, r, 0, .02, 0, 28); cn.rotation.z = .25; g.add(dome(.33, r, 1.03, .55, 1.03), cn, ring(.34, .045, wt, 0, .01, 0), sph(.06, wt, .12, .44, 0)); add(g);
  } else if (k === 14) {   // はちまき：おでこの白い帯、うしろで結ぶ
    const wt = MF('#fbf8f1', 'cloth'), b = ring(.322, .03, wt, 0, .12, -.01); b.scale.set(1.02, 1, 1.02); add(b, sph(.03, MF('#d0343c', 'cloth'), 0, .12, .33, .7), ell(.03, wt, .05, .09, -.33, 1, 2, .5, .4), ell(.03, wt, -.05, .09, -.33, 1, 2, .5, -.4));
  }
}
// ===== アクセサリー（顔の物は頭、首・胸の物は胴の座標）=====
function accs(k, head, fr) {
  if (!k) return;
  if (k === 1) {   // マフラー
    const sc = MF('#d9534f', 'cloth'); fr.add(ring(.13, .048, sc, 0, .6, 0)); const tail = rbox(.075, .19, .035, .015, sc, .07, .41, .17); tail.rotation.z = .12; fr.add(tail, rbox(.075, .02, .036, .006, MF('#f3e6d0', 'cloth'), .072, .44, .172));
  } else if (k === 2) {   // ヘッドホン
    const dk = M('#3a3a44', { roughness: .4 }), pad = M('#8fd3c0', { roughness: .6 });
    const band = new THREE.Mesh(new THREE.TorusGeometry(.345, .018, 8, 28, Math.PI), dk); band.position.y = .0; band.castShadow = true; head.add(band);
    [-1, 1].forEach(s => { const c = cyl(.075, .075, .06, dk, 0, 0, 0, 20); c.position.set(s * .335, -.03, 0); c.rotation.z = Math.PI / 2; const p = cyl(.06, .06, .02, pad, 0, 0, 0, 20); p.position.set(s * .305, -.03, 0); p.rotation.z = Math.PI / 2; head.add(c, p); });
  } else if (k === 3) {   // 星のペンダント
    // くさり：首の両わきから胸の星まで、胴の表面にそって下がる
    const gold = M('#e8b830', { metalness: .85, roughness: .3 }), cp = [];
    for (let i = 0; i <= 12; i++) { const x = -.075 + .15 * i / 12, y = .5 + .045 * (x / .075) ** 2; cp.push(new THREE.Vector3(x, y, Math.max(onBody(x, y), .03) + .005)); }
    fr.add(tubeAlong(cp, .005, gold));
    const sh = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 - Math.PI / 2, r = i % 2 ? .02 : .045; i ? sh.lineTo(Math.cos(a) * r, -Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, -Math.sin(a) * r); }
    const st = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: .012, bevelEnabled: false }), gold); st.position.set(0, .455, onBody(0, .455) - .002); st.rotation.x = -.42; st.castShadow = true; fr.add(st);   // 胸のふくらみの傾きにそろえる
  } else if (k === 4) {   // ばんそうこう（右ほほ）
    const b = rbox(.09, .034, .01, .006, soft('#f2d3b0', { roughness: .8 }), 0, -.017, 0), g = G(); g.add(b); g.rotation.z = .45; head.add(onSurf(g, .175, -.12, .001));
  } else if (k === 5) {   // はなまるバッジ（左むね）
    const x = -.1, y = .45, z = onBody(x, y) + .004, g = G(); g.position.set(x, y, z); g.rotation.y = -.5;
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.add(sph(.02, soft('#ff8aa0', { roughness: .6 }), Math.cos(a) * .028, Math.sin(a) * .028, 0, .5)); }
    g.add(sph(.02, soft('#ffd84a', { roughness: .5 }), 0, 0, .006, .6)); fr.add(g);
  } else if (k === 6) {   // サングラス（顔）
    const fm = M('#1e1e24', { roughness: .3 }), ln = M('#2a3040', { roughness: .1, metalness: .3 });
    [-1, 1].forEach(s => { const x = s * .1, y = -.03; head.add(onSurf(ell(.058, ln, 0, 0, 0, 1.2, .85, .2), x, y, .01)); });
    head.add(rbox(.07, .012, .012, .004, fm, 0, -.01, onFace(0, -.01) + .012));
    [-1, 1].forEach(s => { const tp = cyl(.006, .006, .26, fm, 0, 0, 0, 6); tp.rotation.x = Math.PI / 2; tp.position.set(s * .23, -.03, .13); tp.rotation.y = s * .46; head.add(tp); });
  } else if (k === 7) {   // パールネックレス（首のまわり、胸の上を通る）
    const pearl = M('#f8f4ec', { roughness: .2, metalness: .1 });
    for (let i = 0; i <= 14; i++) { const x = -.085 + .17 * i / 14, y = .53 + .05 * (x / .085) ** 2; fr.add(sph(.011, pearl, x, y, Math.max(onBody(x, y), .03) + .008)); }
  } else if (k === 8) {   // ちょうネクタイ（首もと）
    const r = M('#c0392b', { roughness: .5 }), z = onBody(0, .555) + .012;
    fr.add(ell(.024, r, -.026, .555, z, 1.3, .8, .5), ell(.024, r, .026, .555, z, 1.3, .8, .5), sph(.012, r, 0, .555, z + .004));
  } else if (k === 9) {   // マスク（顔）
    const ms = soft('#f6f6f2', { roughness: .9 }); head.add(onSurf(ell(.12, ms, 0, 0, 0, 1.1, .62, .22), 0, -.12, .004));
    [-1, 1].forEach(s => head.add(onSurf(ell(.012, ms, 0, 0, 0, 3.2, .4, .4), s * .2, -.08, .0)));
  } else if (k === 10) {   // きんメダル（首から下げる）
    const rib = MF('#c0392b', 'cloth'), au = MM(0xf3c33a, .2);
    [-1, 1].forEach(s => fr.add(tubeAlong([[s * .07, .585], [s * .05, .52], [s * .015, .45]].map(([x, y]) => new THREE.Vector3(x, y, onBody(x, y) + .008)), .01, rib)));
    const md = cyl(.04, .04, .012, au, 0, 0, 0, 24); md.rotation.x = Math.PI / 2 - .35; md.position.set(0, .42, onBody(0, .42) + .02); fr.add(md);
  } else if (k === 11) {   // カチューシャ（アクセ）：ぼうしといっしょに付けられる。こん色に小さなリボン
    const c = M('#2f3b5a', { roughness: .4 }), band = new THREE.Mesh(new THREE.TorusGeometry(.33, .015, 8, 32, Math.PI), c); band.position.set(0, .03, .03); band.rotation.x = -.25; band.castShadow = true; head.add(band);
    const rb = M('#ff7aa0', { roughness: .5 }); head.add(ell(.035, rb, .2, .27, .1, 1.2, .8, .5, -.6), ell(.035, rb, .25, .22, .1, 1.2, .8, .5, -.9), sph(.016, rb, .225, .245, .12));
  }
}
// ===== かばん（胴の座標・背中が -z）=====
function bags(k, fr) {
  if (k === 1) return;
  const back = G(); back.position.z = .04; fr.add(back);   // 背中のかばんは、うすくなった胴に合わせて少し前へ
  // 肩ベルト：胸の下から肩の上を通って、背中のかばんまで胴にそわせる
  const straps = m => [-1, 1].forEach(s => fr.add(tubeAlong(overShoulder(s * .11, -.7, Math.PI + .4, .01), .013, m)));
  if (k === 0) {   // リュック（ふだん）
    const bag = MF('#f7a090', 'cloth'), bag2 = MF('#e88a7c', 'cloth');
    const bk = sph(.15, bag, 0, .38, -.2); bk.scale.set(1, 1.1, .7); back.add(bk, sph(.075, bag2, 0, .33, -.3, .8)); straps(bag2);
  } else if (k === 2) {   // ショルダーバッグ
    // ななめがけのベルト：背中→左肩の上→胸をななめに→右の腰のかばんへ。胴の表面にそわせる
    const lt = M('#a8683c', { roughness: .6 }), sp = overShoulder(-.1, Math.PI + .5, Math.PI / 2, .01);
    for (let i = 1; i <= 8; i++) { const t = i / 8, x = -.1 + .3 * t, y = .53 - .27 * t; sp.push(new THREE.Vector3(x, y, Math.max(onBody(x, y) + .011, .065))); }
    fr.add(tubeAlong(sp, .011, lt));
    fr.add(rbox(.15, .12, .06, .025, lt, .21, .15, .07), rbox(.152, .05, .062, .02, M('#8a5230', { roughness: .6 }), .21, .22, .07));
  } else if (k === 3) {   // トートバッグ
    const cv = MF('#efe4cc', 'cloth'), h = torus(.05, .008, M('#8a6a4a'), -.24, .34, .03); fr.add(rbox(.17, .19, .05, .012, cv, -.24, .13, .03), h, rbox(.172, .05, .052, .008, MF('#7fb0d8', 'cloth'), -.24, .2, .03));
  } else if (k === 4) {   // ランドセル
    const red = M('#c8343c', { roughness: .45 }), red2 = M('#a8262e', { roughness: .45 });
    back.add(rbox(.27, .3, .14, .045, red, 0, .23, -.25), rbox(.28, .22, .025, .02, red2, 0, .3, -.325), sph(.018, M('#e8b830', { metalness: .8, roughness: .3 }), 0, .32, -.34)); straps(red2);
  } else if (k === 5) {   // くまリュック
    const br = MF('#b98656', 'cloth'), lt = MF('#f1d9b5', 'cloth'), dk = M('#2a2220', { roughness: .3 });
    const b = sph(.15, br, 0, .38, -.21); b.scale.set(1, 1.05, .75); back.add(b);
    [-1, 1].forEach(s => back.add(sph(.05, br, s * .1, .52, -.22), sph(.025, lt, s * .1, .52, -.255), sph(.012, dk, s * .045, .41, -.32)));
    back.add(sph(.055, lt, 0, .35, -.31, .8), sph(.016, dk, 0, .37, -.355)); straps(br);
  } else if (k === 6) {   // ボストンバッグ（手に持つ）
    const nv = MF('#3a5a8a', 'cloth'), lt = M('#a8683c', { roughness: .6 });
    const b = cyl(.075, .075, .22, nv, 0, 0, 0, 20); b.rotation.z = Math.PI / 2; b.position.set(.26, .1, .02); fr.add(b, torus(.05, .01, lt, .26, .2, .02), rbox(.03, .16, .005, .004, lt, .26, .03, .095));
  } else if (k === 7 || k === 8) {   // ポシェット（まるい小さなかばん）／サコッシュ（うすい四角）：ななめがけ
    const col = k === 7 ? M('#f08aa0', { roughness: .5 }) : MF('#6b7a52', 'cloth'), sp = overShoulder(-.1, Math.PI + .5, Math.PI / 2, .01);
    for (let i = 1; i <= 8; i++) { const t = i / 8, x = -.1 + .28 * t, y = .53 - .23 * t; sp.push(new THREE.Vector3(x, y, Math.max(onBody(x, y) + .011, .065))); }
    fr.add(tubeAlong(sp, .008, col));
    if (k === 7) { const p = sph(.07, col, .19, .25, .1); p.scale.set(1, 1, .45); fr.add(p, sph(.014, MM(0xd9a21f, .3), .19, .27, .132)); }
    else fr.add(rbox(.14, .11, .025, .01, col, .17, .21, onBody(.17, .26) + .012), rbox(.14, .012, .027, .004, MF('#2f2f36', 'cloth'), .17, .3, onBody(.17, .26) + .012));
  } else if (k === 9) {   // エコバッグ（かたにかける）
    const eb = MF('#9fd4a0', 'cloth'), h = torus(.06, .008, eb, -.24, .36, .03); fr.add(rbox(.18, .2, .04, .01, eb, -.25, .12, .03), h, sph(.03, MF('#f6efe0', 'cloth'), -.25, .22, .052, .4));
  } else if (k === 10) {   // スクールバッグ（こん色・かたにかける・校章）
    const nv = M('#26304a', { roughness: .5 }), sp = overShoulder(-.1, Math.PI + .5, Math.PI / 2, .01);
    for (let i = 1; i <= 8; i++) { const t = i / 8, x = -.1 + .3 * t, y = .53 - .25 * t; sp.push(new THREE.Vector3(x, y, Math.max(onBody(x, y) + .011, .065))); }
    fr.add(tubeAlong(sp, .011, nv), rbox(.24, .17, .07, .02, nv, .24, .1, .06), rbox(.06, .06, .006, .03, MM(0xd9a21f, .3), .24, .16, .097));
  }
}

// せのたかさ(0.9〜1.1)を、見た目では大きめの差にする（ちびキャラは小さく映るので、そのままだと部屋の中で差がわからない）
export const bodyH = h => 1 + ((+h || 1) - 1) * 2.6;
// せのたかさで「のびる高さ」（頭の大きさは変えない）。0.9〜1.1 → およそ -0.23〜+0.23
export const heightExtra = h => (bodyH(h) - 1) * .9;
const cache = new Map();
// me設定から、歩ける・立ち姿のちびキャラを作る。名前付きの部位：body / head / legL legR / armL armR
export function buildMe(meIn) {
  const me = cleanMe(meIn) || defaultMe(), key = meKey(me); let t = cache.get(key);
  if (!t) { t = build(me); cache.set(key, t); }
  const g = t.clone(true); g.userData.h = (AV.fx + heightExtra(me.height)) / AV.fx; return g;   // h＝頭の上の♪・名札の高さの倍率
}
function build(me) {
  const hairHex = HAIR_COLORS[me.hairC], hair = soft(hairHex, { roughness: .8 }), hair2 = soft(shiftColor(hairHex, .07), { roughness: .8 }), pin = M('#ffe07a', { roughness: .4, emissive: 0xffd24a, emissiveIntensity: .25 });
  const skinHex = SKIN_COLORS[me.skin], skin = soft(skinHex, { roughness: .7 });
  const tc = HOOD_COLORS[me.hood], top = me.top;
  const suit = top === 7 || top === 8, suitHex = '#323c58';   // スーツ（担任助手だけ）はこん色で固定
  // 9 以降の服：色は「ふくの色」（hood）が基本。決まった色の服（デニム・トレンチ・体操服・白衣・サンタ）と柄（ニット・アロハ・チェック・ドット）
  const NT = { 9: { pat: 'knit' }, 24: { fixed: '#1f2230' }, 25: { fixed: '#2f3b5a' }, 26: { fixed: '#2f3b5a' }, 27: { fixed: '#2f3b5a' }, 11: { pat: 'aloha' }, 12: { pat: 'check' }, 13: { fixed: '#5b7fb4' }, 15: { fixed: '#c9a77a' }, 16: { pat: 'dot', base: '#f6f1e6' }, 19: { fixed: '#fbf8f1' }, 20: { fixed: '#fbfbf6' }, 22: { fixed: '#d0343c' }, 23: { pat: 'dot' } }[top] || {};
  const base = suit ? suitHex : NT.base || NT.fixed || tc;
  const cloth = suit ? MF(suitHex, 'cloth') : top === 2 ? stripeMat(tc) : NT.pat ? patMat(NT.pat, base, NT.base ? tc : '#fbf8f1') : MF(base, 'cloth');
  const cloth2 = suit ? MF(shiftColor(suitHex, -.04), 'cloth') : top === 2 ? MF(tc, 'cloth') : NT.base ? MF(tc, 'cloth') : MF(shiftColor(base, -.07), 'cloth');
  const pocket = MF(shiftColor(tc, .08, -.1), 'cloth'), white = MF('#fbf8f1', 'cloth');
  const denim = MF('#5b7fb4', 'cloth');
  // ボトムス（bottom）：0＝服に合わせる（いままでどおり）。スカートのときは脚が肌（タイツ）
  // ボトムス：0＝服に合わせる（制服は決まったズボン・スカート）
  const BT0 = [null, { c: '#4a6fa8' }, { c: '#c9b083' }, { c: '#2f2f36' }, { c: '#7f9cc8', short: true }, { c: '#3b4a72', skirt: 'pleat' }, { c: '#b8404a', skirt: 'check' }, { c: '#8a6a9a', skirt: 'long' }, { c: '#6b7a52', cargo: true }, { c: '#3a4a7a', side: true }][me.bottom | 0];
  const BT = BT0 || { 24: { c: '#1f2230' }, 25: { c: '#7a7f8c' }, 26: { c: '#56627e', skirt: 'check', uni: true }, 27: { c: '#7a7f8c' } }[top] || null;
  const longTop = top === 15 || top === 16 || top === 20;   // 丈の長い服：ボトムスはその内側にはく
  const tights = soft(shiftColor(skinHex, -.04), { roughness: .5 });
  const pants = BT ? (BT.skirt ? tights : MF(BT.c, 'cloth')) : top === 5 || top === 23 ? skin : top === 8 ? tights : top === 7 || top === 16 ? cloth : top === 3 ? denim : MF('#8fa8d8', 'cloth');
  // くつ（shoes）：0＝スニーカー（スーツのときは革ぐつ）
  const SH = [suit ? { c: top === 8 ? '#2a2a33' : '#4a3226', sole: '#1e1e24', h: .055, gloss: true } : { c: '#fff7f0', sole: '#f3c9c0', h: .055 }, { c: '#2a2a33', sole: '#f4f0e6', h: .055 }, { c: '#4a3226', sole: '#1e1e24', h: .045, gloss: true }, { c: '#6b4a2e', sole: '#3a2a1a', h: .13 }, { c: '#c9a27a', sole: '#8a6a4a', sandal: true }, { c: '#f2c94c', sole: '#c89a2a', h: .17, gloss: true }, { c: '#c8343c', sole: '#f4f0e6', h: .09, toe: '#f4f0e6' }, { c: '#fbf8f1', sole: '#e8e4d8', h: .05, toe: tc }, { c: '#f3c33a', sole: '#c89a2a', h: .055, gold: true }][me.shoes | 0] || { c: '#fff7f0', sole: '#f3c9c0', h: .055 };
  const shoe = SH.gold ? MM(0xf3c33a, .25) : soft(SH.c, { roughness: SH.gloss ? .35 : .7 }), sole = soft(SH.sole);
  const shortSleeve = top === 1 || top === 2 || top === 3 || top === 10 || top === 11 || top === 19, sleeveless = top === 18;
  const g = G(), fig = G(); fig.name = 'fig'; g.add(fig);
  // からだつき：ほっそり 0.8 〜 ぽっちゃり 1.35（ふつう 0.4 のときは前と同じ 1.02）
  // せのたかさ：全体を大きくするのではなく「高さだけ」変える。頭・横はば・手足の太さはそのまま、脚(6割)と胴(4割)がのびる
  const w = .8 + .55 * me.plump, E = heightExtra(me.height), EL = E * .6, ET = E * .4, ty = 1 + ET / .425;
  const body = G(); body.name = 'body'; body.position.y = LEG + EL; fig.add(body);   // 脚が長くなったぶん、体を持ち上げる（足の裏が y=0）
  const fr = G(); fr.name = 'frame'; fr.scale.set(w, ty, w); fr.position.y = .17 * (1 - ty); body.add(fr);   // 胴の下(y=.17)はそのまま、上へのびる
  // 脚：腰(y=.2)から足もとまで。太ももから足首へ少し細くなる。くつは丸みのある箱（胴ののびに引っぱられないよう、体(body)に直接つける）
  const legLen = .2 + LEG + EL - .045, fy = -(.2 + LEG + EL);
  [-1, 1].forEach(s => {
    const l = G(); l.name = s < 0 ? 'legL' : 'legR'; l.position.set(s * .072 * w, .2, 0); l.scale.set(w, 1, w);
    if (BT && BT.short) l.add(cyl(.045, .05, legLen, skin, 0, -legLen, 0, 16), cyl(.06, .064, .13, pants, 0, -.12, 0, 16), sph(.064, pants, 0, 0, 0, .8));   // ショートパンツ：ひざから下は肌
    else l.add(cyl(.049, .058, legLen, pants, 0, -legLen, 0, 16), sph(.058, pants, 0, 0, 0, .8));
    if (BT && BT.cargo) l.add(rbox(.03, .07, .05, .01, MF(shiftColor(BT.c, -.08), 'cloth'), s * .052, -.16, 0));   // カーゴのよこポケット
    if (BT && BT.side) l.add(cyl(.0075, .0075, legLen - .02, white, s * .052, -legLen + .02, 0, 6));               // ジャージのよこのライン
    if (SH.sandal) {   // サンダル：うすい底＋ベルト、足は肌
      const foot = ell(.045, skin, 0, fy + .03, .03, .95, .55, 1.45); l.add(foot, rbox(.104, .018, .16, .008, sole, 0, fy, .024), rbox(.106, .014, .03, .006, shoe, 0, fy + .03, .05), rbox(.106, .014, .03, .006, shoe, 0, fy + .03, -.01));
    } else {
      const hh = SH.h || .055, sh = rbox(.1, Math.min(hh, .07), .15, .026, shoe, 0, fy, .022), so = rbox(.104, .016, .154, .008, sole, 0, fy - .002, .022);
      l.add(sh, so);
      if (hh > .07) l.add(cyl(.056, .06, hh - .02, shoe, 0, fy + .02, -.005, 16));                              // ブーツ・長ぐつ・ハイカットのつつ
      if (SH.toe) l.add(rbox(.098, .03, .05, .014, soft(SH.toe), 0, fy + .006, .072));                          // つま先の色
    }
    body.add(l);
  });
  // スカート（ボトムス）：腰から。ロングはひざ下まで
  if (BT && BT.skirt && !longTop) {   // 丈の長い服（コート・白衣・ゆかた）を着ているときは、スカートはその内側（ロングでも服より短いので見えない）
    const skMat = BT.skirt === 'check' ? patMat('check', BT.c, '#fbf8f1') : MF(BT.c, 'cloth');
    const len = BT.skirt === 'long' ? .22 + EL * .5 : .13;
    const pts = BT.skirt === 'pleat' ? [[0, 0], [.225, 0], [.222, .02], [.19, len], [0, len + .01]] : [[0, 0], [.215, 0], [.212, .02], [.186, len], [0, len + .01]];
    const sk = lathe(pts, skMat, 0, .25 - len, 0, BT.skirt === "pleat" ? 18 : 28); sk.scale.set(w, 1, .86 * w); body.add(sk);
  }
  // 胴：肩・胸・腰のある形（回転体を前後にうすく）。首はすこし見える
  const torso = lathe(TORSO.map(([y, r]) => [r, y - .17]).concat([[0, .425]]), cloth, 0, .17, 0, 36); torso.scale.z = BODY_D; fr.add(torso);
  fr.add(lathe([[0, 0], [.165, 0], [.165, .004], [0, .004]], cloth, 0, .17, 0, 36));   // 胴の底（下から見たとき穴にならないように）
  fr.children[fr.children.length - 1].scale.z = BODY_D;
  body.add(cyl(.05, .056, .12, skin, 0, .56 + ET, 0, 16));   // 首（胴がのびたぶん上へ）
  const neckY = .588;
  // ふくごとの飾り
  // 服の飾りは、どれも胴の表面にぴったり付ける（onBody で表面の位置、表面の傾きにそろえる）
  if (top === 0) {   // パーカー（ふだん）
    fr.add(hem(cloth2, 1));
    // おなかのポケット：すその曲面にそった帯
    const pk = new THREE.Mesh(new THREE.LatheGeometry([[.182, .03], [.183, .045], [.18, .07], [.176, .095]].map(([r, y]) => new THREE.Vector2(r, y)), 20, -.6, 1.2), Object.assign(pocket.clone(), { side: THREE.DoubleSide })); pk.position.y = .2; pk.scale.z = BODY_D; pk.castShadow = true; fr.add(pk);
    const pe = new THREE.Mesh(new THREE.TorusGeometry(.176, .006, 6, 20, 1.2), pocket); pe.rotation.set(Math.PI / 2, 0, Math.PI / 2 - .6); pe.position.y = .295; pe.scale.y = BODY_D; fr.add(pe);
    // フードのひも：首もとから表面にそって下がる
    [-1, 1].forEach(s => { const x = s * .035; fr.add(tubeAlong([.56, .52, .48, .45].map(y => new THREE.Vector3(x, y, onBody(x, y) + .006)), .006, white), sph(.011, white, x, .445, onBody(x, .445) + .006)); });
    const hd = sph(.15, cloth2, 0, .57, -.085); hd.scale.set(1.3, .72, .75); fr.add(hd);
  } else if (top === 1 || top === 2) {   // Tシャツ・ボーダー
    fr.add(hem(cloth2, 1), ring(.068, .013, cloth2, 0, neckY, .0));
  } else if (top === 3) {   // オーバーオール
    fr.add(hem(denim, 1), rbox(.18, .16, .035, .02, denim, 0, .26, onBody(0, .34) - .014));
    // つりひも：胸あての上から肩をこえて背中へ
    [-1, 1].forEach(s => { fr.add(tubeAlong(overShoulder(s * .07, .5, Math.PI + .35, .006), .011, denim), sph(.013, M('#e8b830', { metalness: .8, roughness: .3 }), s * .07, .41, onBody(s * .07, .41) + .008)); });
  } else if (top === 4) {   // カーディガン
    fr.add(frontStrip(white, .028, .19, .57), hem(cloth2, 1));
    [.48, .41, .34, .27].forEach(y => fr.add(sph(.011, M('#c9a27a', { roughness: .4 }), .0, y, onBody(0, y) + .009)));
  } else if (top === 5) {   // ワンピース
    const belt = ring(.183, .012, white, 0, .31, 0); belt.scale.y = BODY_D;   // 胴の断面(だ円)に合わせる
    const sk = lathe([[0, 0], [.235, 0], [.232, .025], [.19, .17], [0, .18]], cloth, 0, .12, 0, 28); sk.scale.z = .86;
    fr.add(sk, ring(.068, .015, white, 0, neckY, 0), belt);
  } else if (top === 6) {   // ジャージ
    fr.add(frontStrip(white, .007, .19, .575), hem(cloth2, 1), ring(.078, .022, cloth2, 0, neckY - .004, 0));
  } else if (suit) {   // スーツ（7=パンツ・8=スカート）：白いシャツのV・えり・ボタン。パンツはネクタイ、スカートはリボン
    fr.add(hem(cloth2, 1), shirtV(white));
    [-1, 1].forEach(s => fr.add(tubeAlong([[.072, .57], [.058, .51], [.034, .455], [.006, .405]].map(([x, y]) => new THREE.Vector3(s * x, y, onBody(s * x, y) + .008)), .015, cloth2)));
    const btn = M('#1c2236', { roughness: .4 });
    [.355, .29].forEach(y => fr.add(sph(.011, btn, 0, y, onBody(0, y) + .006)));
    if (top === 7) {
      const tie = M('#b8404a', { roughness: .55 });
      fr.add(tubeAlong([.54, .5, .455, .418].map(y => new THREE.Vector3(0, y, onBody(0, y) + .006)), .013, tie), sph(.018, tie, 0, .548, onBody(0, .548) + .01, .8));
    } else {
      const rb = M('#e8505b', { roughness: .55 }), z = onBody(0, .545) + .012;
      fr.add(ell(.02, rb, -.022, .545, z, 1.3, .8, .5), ell(.02, rb, .022, .545, z, 1.3, .8, .5), sph(.01, rb, 0, .545, z + .004));
      const sk = lathe([[0, 0], [.205, 0], [.203, .02], [.19, .12], [0, .13]], cloth2, 0, .115, 0, 28); sk.scale.z = .86; fr.add(sk);   // タイトスカート
    }
  }
  // ===== 9 以降の服の飾り（どれも胴の表面 onBody にそわせる） =====
  if (top >= 9) {
    const btnW = M('#f4f0e6', { roughness: .4 }), btnG = MM(0xd9a21f, .3), dk = M('#2a2a33', { roughness: .5 });
    const collar = mat => [-1, 1].forEach(s => fr.add(ell(.045, mat, s * .045, .56, onBody(s * .045, .56) + .004, 1.15, .42, .45, s * .55)));
    const buttons = (ys, mat, x) => ys.forEach(y => fr.add(sph(.009, mat, x || 0, y, onBody(x || 0, y) + .006)));
    const lapels = mat => [-1, 1].forEach(s => fr.add(tubeAlong([[.072, .57], [.058, .51], [.034, .455], [.006, .405]].map(([x, y]) => new THREE.Vector3(s * x, y, onBody(s * x, y) + .008)), .015, mat)));
    const band = (y, r, mat) => { const b = ring(rAt(y) + .008, r, mat, 0, y, 0); b.scale.y = BODY_D; fr.add(b); };
    const coatSkirt = mat => { const sk = lathe([[0, 0], [.2, 0], [.204, .012], [.2, .03], [.188, .09], [.174, .16], [.166, .205], [.165, .215], [0, .215]], mat, 0, -.045, 0, 32); sk.scale.z = BODY_D; fr.add(sk); };   // 胴の太さ(.165)からそのまま広がる（腰で段にならない）
    if (top === 9) { fr.add(hem(cloth2, 1.02), ring(.075, .024, cloth2, 0, neckY, 0)); }                                   // セーター
    else if (top === 10) { fr.add(hem(cloth2, 1)); collar(cloth2); buttons([.535, .5], btnW); }                           // ポロシャツ
    else if (top === 11) { fr.add(hem(cloth, 1)); collar(cloth2); buttons([.52, .45, .38, .31], btnW); }                  // アロハシャツ
    else if (top === 12) { fr.add(hem(cloth2, 1)); collar(cloth2); buttons([.53, .46, .39, .32, .25], btnW); }           // チェックシャツ
    else if (top === 13) {                                                                                                // デニムジャケット：中に白いシャツ
      fr.add(frontStrip(white, .05, .19, .575), hem(cloth2, 1.02)); collar(cloth2);
      [-1, 1].forEach(s => fr.add(rbox(.06, .05, .012, .008, cloth2, s * .085, .43, onBody(s * .085, .455) - .002))); buttons([.48, .4, .32], btnG, .055);
    } else if (top === 14) {                                                                                              // ダウンジャケット：もこもこの帯
      [.25, .33, .41, .49].forEach(y => band(y, .016, cloth2)); fr.add(frontStrip(MF(shiftColor(base, -.15), 'cloth'), .008, .19, .58), hem(cloth2, 1.04), ring(.08, .03, cloth2, 0, neckY - .004, 0));
    } else if (top === 15) {                                                                                              // トレンチコート
      coatSkirt(cloth); band(.3, .014, cloth2); lapels(cloth2);
      [-1, 1].forEach(s => buttons([.47, .4, .33], MM(0x4a3226, .4), s * .04)); fr.add(rbox(.03, .02, .012, .004, btnG, 0, .295, onBody(0, .3) + .01));
    } else if (top === 16) {                                                                                              // ゆかた：長いすそ・帯・えりの合わせ
      const sk = lathe([[0, 0], [.19, 0], [.192, .012], [.186, .1], [.174, .3], [.166, .4], [.165, .41], [0, .41]], cloth, 0, -.24, 0, 32); sk.scale.z = BODY_D; fr.add(sk);
      const obi = cyl(.183, .183, .085, MF(shiftColor(tc, -.2), 'cloth'), 0, .255, 0, 32); obi.scale.z = BODY_D; fr.add(obi);
      fr.add(tubeAlong([[-.065, .585], [-.03, .52], [.02, .44], [.07, .36]].map(([x, y]) => new THREE.Vector3(x, y, onBody(x, y) + .006)), .014, cloth2));
      fr.add(tubeAlong([[.065, .585], [.035, .53], [.0, .48]].map(([x, y]) => new THREE.Vector3(x, y, onBody(x, y) + .005)), .013, cloth2));
    } else if (top === 17) {                                                                                              // ブレザー：白いシャツ・えり・ネクタイ
      fr.add(hem(cloth2, 1.02), shirtV(white)); lapels(cloth2); buttons([.355, .29], btnG);
      const tie = M('#b8404a', { roughness: .55 }); fr.add(tubeAlong([.54, .5, .455, .418].map(y => new THREE.Vector3(0, y, onBody(0, y) + .006)), .013, tie), sph(.018, tie, 0, .548, onBody(0, .548) + .01, .8));
    } else if (top === 18) { fr.add(hem(cloth2, 1), ring(.085, .01, cloth2, 0, neckY - .012, 0)); }                     // タンクトップ（そでなし）
    else if (top === 19) {                                                                                                // 体操服：えり・そでの色・名前ふだ
      fr.add(hem(cloth2, 1), ring(.072, .016, MF(tc, 'cloth'), 0, neckY, 0), rbox(.09, .05, .006, .008, M('#ffffff'), -.07, .43, onBody(-.07, .455) + .002), rbox(.07, .006, .007, .002, MF(tc, 'cloth'), -.07, .448, onBody(-.07, .455) + .005));
    } else if (top === 20) {                                                                                              // 白衣
      coatSkirt(cloth); lapels(cloth2); [-1, 1].forEach(s => fr.add(rbox(.07, .06, .01, .008, cloth2, s * .09, .2, onBody(s * .09, .23) + .002)));
      fr.add(cyl(.006, .006, .06, M('#3f6fc4'), -.065, .44, onBody(-.065, .47) + .006, 6)); buttons([.4, .32, .24], btnW);
    } else if (top === 21) {                                                                                              // エプロン
      const ap = MF(shiftColor(tc, -.22, .12), 'cloth'); fr.add(hem(cloth2, 1), rbox(.22, .4, .012, .02, ap, 0, .03, onBody(0, .3) + .006), rbox(.09, .06, .006, .008, MF(tc, 'cloth'), 0, .2, onBody(0, .3) + .014));
      [-1, 1].forEach(s => fr.add(tubeAlong([[s * .09, .43], [s * .07, .52], [s * .05, .585]].map(([x, y]) => new THREE.Vector3(x, y, onBody(x, y) + .006)), .008, ap)));
    } else if (top === 22) {                                                                                              // サンタ服：白いふち・ベルト
      const fur = MF('#fbf8f1', 'cloth'); band(.19, .028, fur); fr.add(frontStrip(fur, .025, .2, .57), ring(.082, .03, fur, 0, neckY - .004, 0)); band(.3, .02, dk);
      fr.add(rbox(.05, .04, .012, .006, btnG, 0, .28, onBody(0, .3) + .02));
    } else if (top === 23) {                                                                                              // ドットワンピース
      const belt = ring(.183, .012, white, 0, .31, 0); belt.scale.y = BODY_D; const sk = lathe([[0, 0], [.235, 0], [.232, .025], [.19, .17], [0, .18]], cloth, 0, .12, 0, 28); sk.scale.z = .86;
      fr.add(sk, ring(.068, .015, white, 0, neckY, 0), belt);
    } else if (top === 24) {                                                                                              // 学ラン：立ちえり・金ボタン
      fr.add(hem(cloth2, 1.02), cyl(.072, .078, .05, cloth, 0, neckY - .022, 0, 24), cyl(.0725, .0725, .006, white, 0, neckY + .026, 0, 24));
      buttons([.53, .46, .39, .32, .25], btnG);
    } else if (top >= 25 && top <= 27) {                                                                                  // ブレザー制服：白いシャツ・えり・校章・ネクタイ（25）かリボン（26・27）
      fr.add(hem(cloth2, 1.02), shirtV(white)); lapels(cloth2); buttons([.355, .29], btnG, .03);
      fr.add(sph(.014, btnG, -.085, .47, onBody(-.085, .47) + .004, .5));
      if (top === 25) {
        const tie = patMat('check', '#9a2f3a', '#2f3b5a'); fr.add(tubeAlong([.54, .5, .455, .418].map(y => new THREE.Vector3(0, y, onBody(0, y) + .006)), .013, tie), sph(.018, M('#9a2f3a', { roughness: .55 }), 0, .548, onBody(0, .548) + .01, .8));
      } else {
        const rb = M('#c0392b', { roughness: .55 }), z = onBody(0, .545) + .012;
        fr.add(ell(.024, rb, -.026, .545, z, 1.3, .8, .5), ell(.024, rb, .026, .545, z, 1.3, .8, .5), sph(.012, rb, 0, .545, z + .004));
      }
    }
  }
  // 腕：肩から手首まで長く。半そでは ひじから先が肌。手は小さめ
  [-1, 1].forEach(s => {
    const a = G(); a.name = s < 0 ? 'armL' : 'armR'; a.position.set(s * .192, .535, 0);
    a.add(sph(.056, sleeveless ? skin : cloth, 0, 0, 0));
    if (sleeveless) a.add(cyl(.046, .038, .24, skin, 0, -.24, 0, 14));                                                 // そでなし：腕はぜんぶ肌
    else if (shortSleeve) a.add(cyl(.054, .05, .09, cloth, 0, -.09, 0, 14), cyl(.042, .037, .15, skin, 0, -.24, 0, 14));
    else a.add(cyl(.052, .044, .22, cloth, 0, -.22, 0, 14), cyl(.046, .046, .02, cloth2, 0, -.225, 0, 14));
    a.add(ell(.042, skin, 0, -.255, .004, .9, 1.1, .8), sph(.017, skin, s * .03, -.24, .022, 1));
    if (top === 6) a.add(cyl(.008, .008, .2, white, s * .048, -.21, 0, 6));
    if (top === 16) a.add(cyl(.07, .085, .16, cloth, 0, -.21, -.01, 16));                                                // ゆかたの広いそで
    if (top === 19) a.add(cyl(.055, .055, .016, MF(tc, 'cloth'), 0, -.09, 0, 14));                                       // 体操服のそでの色
    if (top === 22) a.add(cyl(.054, .054, .03, MF('#fbf8f1', 'cloth'), 0, -.235, 0, 14));                               // サンタのそでの白いふち
    if (top === 9) a.add(cyl(.048, .048, .03, cloth2, 0, -.235, 0, 14));                                                 // セーターのそで口
    a.rotation.z = s * .1; fr.add(a);
  });
  bags(me.bag, fr);
  const head = G(); head.name = 'head'; head.position.y = HEAD_Y + ET; head.userData.baseY = HEAD_Y + ET; const hw = (1 + (w - 1) * .35) * .93; head.scale.set(hw, .93, hw); body.add(head);
  const hs = new THREE.Mesh(headGeo(me.face | 0), skin); hs.scale.set(1.06, .94, 1); hs.castShadow = true; head.add(hs);
  [-1, 1].forEach(s => head.add(sph(.045, skin, s * .29, -.02, 0, 1.0)));
  const A = adjOf(me);
  const nFace = head.children.length;
  eyes(me.eye, head, EYE_COLORS[me.eyeC], A); mouth(me.mouth, head, A); brows(me.brow, me.browC ? HAIR_COLORS[me.browC - 1] : hairHex, head, A); faceDeco(me, skinHex, head); glasses(me.glasses, head, A);
  followFace(me.face | 0, head, nFace);   // 顔の形を変えても、パーツが面に埋もれたり浮いたりしないように
  hairParts(me.hair, hairHex, hair, hair2, head, pin, me.hat);
  hats(me.hat, head, hair); accs(me.acc, head, fr);
  // 髪の面は影を受けない（毛のすじに自分の影が細かく落ちて、頭のまわりに濃い帯ができるため）
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = !o.userData.hair; } });
  return g;
}
