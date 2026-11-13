// 追加の壁かけ（原点=左下、+z が部屋側）
import { THREE, M, MW, MF, MG, MM, MT, plane, G, box, rbox, cyl, sph, cone, add, lightAt, torus } from './mk.js?v=202611131634';
import { texOf } from './textures.js?v=202611131634';

function board(d, tex, frame, bw) {
  const g = G(), w = d.w, h = d.h; bw = bw || .06;
  add(g, rbox(w, h, .05, .02, frame, w / 2, 0, .025));
  const p = plane(w - 2 * bw, h - 2 * bw, MT(tex, { roughness: .7 }), w / 2, h / 2, .054); p.castShadow = false; g.add(p); return g;
}
export function art_timetable(d) {
  const t = texOf('timetable', 400, 300, (c, W, H) => {
    c.fillStyle = '#fffdf4'; c.fillRect(0, 0, W, H); const days = ['月', '火', '水', '木', '金'], subj = ['#f7c6a8', '#c9eee0', '#cde8f7', '#fbd5dc', '#fff0a8'], names = ['国', '数', '英', '理', '社'];
    c.fillStyle = '#6aa6d6'; c.fillRect(0, 0, W, 44); c.fillStyle = '#fff'; c.font = 'bold 26px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    days.forEach((x, i) => c.fillText(x, 40 + 52 + i * 64 - 26 + 6, 24)); c.fillStyle = '#6aa6d6'; c.fillText('★', 22, 24);
    for (let r = 0; r < 5; r++) { c.fillStyle = '#6aa6d6'; c.fillText(String(r + 1), 22, 44 + 28 + r * 50); for (let i = 0; i < 5; i++) { c.fillStyle = subj[(i + r * 2) % 5]; c.fillRect(46 + i * 64, 50 + r * 50, 60, 44); c.fillStyle = '#6a5a4a'; c.font = 'bold 24px sans-serif'; c.fillText(names[(i * 2 + r) % 5], 46 + i * 64 + 30, 50 + r * 50 + 24); } }
    c.strokeStyle = '#6aa6d6'; c.lineWidth = 4; c.strokeRect(2, 2, W - 4, H - 4);
  });
  const g = board(d, t, MW(d.color2), .04); [.12, d.w - .12].forEach(x => add(g, sph(.022, MM(0xd04040), x, d.h - .07, .06))); return g;
}
export function art_cork(d) {
  const t = texOf('cork', 300, 220, (c, W, H) => {
    c.fillStyle = '#c99a62'; c.fillRect(0, 0, W, H); for (let i = 0; i < 700; i++) { c.fillStyle = 'rgba(' + (i % 2 ? '120,80,40' : '240,200,150') + ',' + (.1 + (i % 7) * .03) + ')'; c.fillRect((i * 97) % W, (i * 53) % H, 2 + i % 4, 2 + i % 3); }
    const N = [['#fff7a8', 20, 20, 80, 70], ['#f7b6c8', 130, 30, 70, 80], ['#b6e3f4', 210, 16, 70, 60], ['#ffffff', 40, 120, 90, 70], ['#c9eec0', 160, 125, 80, 70]];
    N.forEach(([col, x, y, w, h], i) => { c.save(); c.translate(x + w / 2, y + h / 2); c.rotate((i - 2) * .06); c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(-w / 2 + 3, -h / 2 + 4, w, h); c.fillStyle = col; c.fillRect(-w / 2, -h / 2, w, h); c.fillStyle = 'rgba(120,100,80,.5)'; for (let k = 0; k < 4; k++) c.fillRect(-w / 2 + 8, -h / 2 + 18 + k * 12, w - 16 - (k % 2) * 16, 3); c.fillStyle = '#d04040'; c.beginPath(); c.arc(0, -h / 2 + 8, 5, 0, 7); c.fill(); c.restore(); });
  });
  return board(d, t, MW(d.color2), .06);
}
export function art_mirror(d) {
  const g = G(), w = d.w, h = d.h, fr = MW(d.color2);
  add(g, rbox(w, h, .06, .03, fr, w / 2, 0, .03));
  add(g, rbox(w - .14, h - .14, .01, .03, M('#e6f0f3', { roughness: .04, metalness: .95, envMapIntensity: 2.4 }), w / 2, .07, .065));
  add(g, sph(.045, M(d.color), w / 2, h - .02, .06), box(.1, .035, .02, M('#f3d9a0'), w * .3, h * .62, .077).rotateZ(.7)); g.children.at(-1).position.set(w * .25, h * .6, .075);
  return g;
}
export function art_hookshelf(d) {
  const g = G(), w = d.w, wd = MW(d.color);
  add(g, rbox(w, .22, .05, .02, wd, w / 2, .2, .025), rbox(w, .045, .16, .02, wd, w / 2, .42, .08));
  const cols = ['#f08a7e', '#8fd3c0', '#f2c14e', '#7fb8d8'];
  for (let i = 0; i < 4; i++) { const x = .18 + i * (w - .36) / 3; add(g, sph(.035, MM(0xc9a24a), x, .31, .075), cyl(.012, .012, .08, MM(0xc9a24a), x, .31, .05, 6).rotateX(Math.PI / 2)); g.children.at(-1).position.set(x, .31, .05); }
  add(g, rbox(.2, .22, .06, .03, MF(cols[1], 'cloth'), .22, .02, .1), torus(.07, .01, M('#f3d9a0'), .22, .18, .08).rotateX(0));
  add(g, rbox(.16, .26, .05, .03, MF(cols[0], 'cloth'), w - .22, .0, .09));
  add(g, sph(.08, M('#5fb760'), w * .5, .52, .09, .9), cyl(.06, .05, .08, M('#f3efe6'), w * .5, .46, .09, 12));
  return g;
}
export function art_neon(d) {
  const g = G(), w = d.w, h = d.h, col = d.color;
  add(g, rbox(w, h, .03, .02, M('#1c1f2a'), w / 2, 0, .015));
  const glow = M(col, { emissive: col, emissiveIntensity: 2.2, roughness: .4 }), tube = (pts, r) => { const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], .06))), 24, r || .014, 6), glow); m.castShadow = false; return m; };
  // 文字「GOAL」を細い線で組む
  const u = w / 4.4, y0 = h * .2, y1 = h * .8; let x = w * .06;
  const G_ = (x0) => tube([[x0 + u * .8, y1 - .02], [x0 + u * .4, y1], [x0, (y0 + y1) / 2], [x0 + u * .4, y0], [x0 + u * .8, y0 + .04], [x0 + u * .8, (y0 + y1) / 2 - .02], [x0 + u * .5, (y0 + y1) / 2 - .02]]);
  const O_ = (x0) => tube([[x0 + u * .4, y0], [x0 + u * .8, (y0 + y1) / 2], [x0 + u * .4, y1], [x0, (y0 + y1) / 2], [x0 + u * .4, y0]]);
  const A_ = (x0) => tube([[x0, y0], [x0 + u * .4, y1], [x0 + u * .8, y0]]), A2 = (x0) => tube([[x0 + u * .16, (y0 + y1) / 2 - .06], [x0 + u * .64, (y0 + y1) / 2 - .06]]);
  const L_ = (x0) => tube([[x0, y1], [x0, y0], [x0 + u * .75, y0]]);
  add(g, G_(x)); x += u * 1.15; add(g, O_(x)); x += u * 1.15; add(g, A_(x), A2(x)); x += u * 1.15; add(g, L_(x));
  add(g, tube([[w * .9, y1 + .02], [w * .93, y1 - .04], [w * .96, y1 + .02], [w * .93, y1 + .08], [w * .9, y1 + .02]], .01));
  lightAt(g, w / 2, h / 2, .35, new THREE.Color(col).getHex(), 2.2, 3.5);
  return g;
}
export function art_catcher(d) {
  // 星と羽の「ねがいごとリング」（オリジナル）
  const g = G(), w = d.w, h = d.h, cx = w / 2, R = w * .36, cy = h - R - .06, wd = MW(d.color), cols = ['#f7a8b8', '#fff3a0', '#b6e3f4', '#c9eec0'];
  add(g, sph(.025, M('#f3d9a0'), cx, h - .02, .03), cyl(.005, .005, .08, M('#f3d9a0'), cx, h - .08, .03, 4));
  add(g, torus(R, .016, wd, cx, cy, .04));
  const st = (x, y, r, col) => { const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? r * .45 : r; s[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, -Math.sin(a) * rr); } s.closePath(); const m = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: .02, bevelEnabled: false }), M(col, { emissive: col, emissiveIntensity: .25, roughness: .6 })); m.position.set(x, y, .035); m.castShadow = true; return m; };
  add(g, st(cx, cy, R * .55, '#ffe07a'));
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; add(g, cyl(.004, .004, R * .8, M('#fff6e0'), cx, cy, .045, 4)); const l = g.children.at(-1); l.rotation.z = a; l.position.set(cx, cy, .05); }
  [[-.55, .55], [0, .75], [.55, .55]].forEach(([k, len], i) => { const x = cx + k * R, y0 = cy - R * Math.sqrt(Math.max(0, 1 - k * k)) - .0; add(g, cyl(.004, .004, len * .8, M('#f3d9a0'), x, y0 - len * .8, .04, 4)); const col = cols[i]; add(g, sph(.03, M(col), x, y0 - len * .8, .04)); const f = sph(.05, M(col, { roughness: 1 }), x, y0 - len * .8 - .12, .04); f.scale.set(.5, 1.7, .25); add(g, f); });
  return g;
}
export function art_certificate(d) {
  const t = texOf('cert', 300, 220, (c, W, H) => {
    c.fillStyle = '#fffbea'; c.fillRect(0, 0, W, H); c.strokeStyle = '#d0a640'; c.lineWidth = 6; c.strokeRect(10, 10, W - 20, H - 20); c.lineWidth = 2; c.strokeRect(20, 20, W - 40, H - 40);
    c.fillStyle = '#6a4a2a'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = 'bold 34px serif'; c.fillText('賞　状', W / 2, 56); c.fillRect(70, 82, W - 140, 3);
    c.font = '20px serif'; c.fillText('よくがんばりました', W / 2, 120); c.fillRect(100, 150, W - 200, 2);
    c.fillStyle = '#d04040'; c.beginPath(); c.arc(W - 62, H - 52, 20, 0, 7); c.fill(); c.fillStyle = '#fff'; c.font = 'bold 18px serif'; c.fillText('合', W - 62, H - 52);
  });
  const g = board(d, t, MM(0xd0a640, .35), .05); return g;
}
