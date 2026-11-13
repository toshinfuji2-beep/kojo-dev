// 壁かけ（原点=左下、+z が部屋側）とラグ
import { THREE, M, MW, MF, MG, MM, MGLASS, MT, plane, G, box, rbox, cyl, sph, cone, lathe, add, lightAt, torus } from './mk.js?v=202611131634';
import { artTex, rugTexture } from './textures.js?v=202611131634';
import { curtainGeo } from './soft.js?v=202611131634';

function framed(d, tex, frameMat, bw) {
  const g = G(), w = d.w, h = d.h; bw = bw || .07;
  add(g, box(w, bw, .06, frameMat, w / 2, 0, .03), box(w, bw, .06, frameMat, w / 2, h - bw, .03), box(bw, h - 2 * bw, .06, frameMat, bw / 2, bw, .03), box(bw, h - 2 * bw, .06, frameMat, w - bw / 2, bw, .03));
  const p = plane(w - 2 * bw, h - 2 * bw, MT(tex, { roughness: .6 }), w / 2, h / 2, .02); g.add(p); return g;
}
export function art_poster(d) {
  const g = G(), t = artTex('poster', d, 200, 280), p = plane(d.w, d.h, MT(t), d.w / 2, d.h / 2, .012); p.castShadow = false; add(g, p);
  [.1, d.w - .1].forEach(x => add(g, sph(.025, MM(0xd04040), x, d.h - .06, .02))); return g;
}
export function art_map(d) { const g = framed(d, artTex('map', d, 400, 220), MW('#6a4326'), .05); return g; }
export function art_calendar(d) { const g = framed(d, artTex('calendar', d, 160, 200), M('#f4efe2'), .03); add(g, sph(.03, MM(0x888888), d.w / 2, d.h - .03, .05)); return g; }
export function art_painting(d) { return framed(d, artTex('painting', d, 300, 250), MW('#8a5a30'), .08); }
export function art_frame(d) { return framed(d, artTex(d.art2 || 'still', d, 240, 300), MM(0xd0a640, .35), .09); }
export function art_wclock(d) {
  // 振り子の壁時計：木のケース＋金縁の文字盤＋ガラス＋針＋ゆれる振り子
  const g = G(), w = d.w, h = d.h, wood = MW('#6a3e22'), dk = MW('#4a2a14'), r = w * .46, cy = h - r - .04, gold = MM(0xd8b04a, .28);
  add(g, rbox(w * .46, h - r * 1.15, .15, .03, wood, w / 2, .02, .075), rbox(w * .6, .07, .2, .02, dk, w / 2, .0, .1));
  const inner = rbox(w * .34, h - r * 1.15 - .12, .02, .01, MW('#3a2216'), w / 2, .08, .155); g.add(inner);
  add(g, cyl(r + .04, r + .04, .17, wood, w / 2, cy - .085, .085, 40).rotateX(Math.PI / 2)); g.children.at(-1).position.set(w / 2, cy, .085);
  const bez = torus(r + .005, .016, gold, w / 2, cy, .195); g.add(bez);
  const face = new THREE.Mesh(new THREE.CircleGeometry(r - .005, 48), MT(artTex('clockface', d, 256, 256), { roughness: .5 })); face.position.set(w / 2, cy, .182); face.receiveShadow = true; g.add(face);
  const gl = cyl(r, r, .006, MGLASS(0xffffff, .12), w / 2, cy - .003, .2, 40); gl.rotation.x = Math.PI / 2; gl.position.set(w / 2, cy, .2); gl.castShadow = false; g.add(gl);
  const pend = G(); pend.add(cyl(.008, .008, h * .3, gold, 0, -h * .3, 0, 6)); const bob = cyl(.065, .065, .014, gold, 0, 0, 0, 24); bob.rotation.x = Math.PI / 2; bob.position.set(0, -h * .3 - .01, 0); pend.add(bob);
  pend.position.set(w / 2, cy - r - .05, .185); g.add(pend);
  g.userData.anim = t => { pend.rotation.z = Math.sin(t * 3.1) * .22; }; g.userData.live = true; return g;
}
export function art_window(d) {
  const g = G(), w = d.w, h = d.h, fr = MW(d.color2 === '#ffffff' ? '#eee3cf' : d.color2), sky = artTex('sky', { id: 'sky' }, 256, 256);
  add(g, plane(w, h, M('#fff', { map: sky, emissiveMap: sky, emissive: 0xffffff, emissiveIntensity: 1.5, roughness: 1 }), w / 2, h / 2, .01));
  const bw = .08; add(g, box(w, bw, .14, fr, w / 2, 0, .07), box(w, bw, .14, fr, w / 2, h - bw, .07), box(bw, h, .14, fr, bw / 2, 0, .07), box(bw, h, .14, fr, w - bw / 2, 0, .07));
  add(g, box(.04, h, .05, fr, w / 2, 0, .06), box(w, .04, .05, fr, w / 2, h / 2 - .02, .06), box(w + .2, .06, .24, fr, w / 2, -.06, .12));
  const cur = new THREE.MeshStandardMaterial({ color: new THREE.Color('#c0503f'), roughness: 1, side: THREE.DoubleSide, map: MF('#c0503f', 'cloth').map, normalMap: MF('#c0503f', 'cloth').normalMap, normalScale: new THREE.Vector2(.8, .8) });
  const cw = Math.min(.5, w * .26);
  [0, 1].forEach(i => { const c = new THREE.Mesh(curtainGeo(cw, h + .16, 3, .045), cur); c.position.set(i ? w - cw / 2 - .005 : cw / 2 + .005, h / 2 - .03, .24); c.castShadow = true; c.receiveShadow = true; add(g, c); });
  // レースのカーテン（うっすら透ける）
  const sheer = new THREE.Mesh(curtainGeo(w - .12, h - .1, 5, .018), new THREE.MeshStandardMaterial({ color: 0xfffaf0, roughness: .9, transparent: true, opacity: .26, side: THREE.DoubleSide, depthWrite: false })); sheer.position.set(w / 2, h / 2, .17); sheer.castShadow = false; add(g, sheer);
  const rod = cyl(.02, .02, w + .3, MM(0x6a4a2a, .4), w / 2, h + .06, .24, 10).rotateZ(Math.PI / 2); rod.position.set(w / 2, h + .09, .24); add(g, rod, sph(.045, MM(0xc9a24a, .3), -.15, h + .09, .24), sph(.045, MM(0xc9a24a, .3), w + .15, h + .09, .24)); return g;
}
export function art_wshelf(d) {
  const g = G(), w = d.w, wood = MW(d.color);
  add(g, box(w, .06, .3, wood, w / 2, .15, .15), box(.05, .18, .24, wood, .2, 0, .12), box(.05, .18, .24, wood, w - .2, 0, .12));
  ['#b5483a', '#3f6e8c', '#d9a53c', '#4f7a4a'].forEach((c, i) => add(g, box(.07, .24 + (i % 2) * .05, .2, M(c), .3 + i * .075, .21, .15)));
  add(g, lathe([[0, 0], [.07, 0], [.09, .1], [.05, .18], [.06, .22], [0, .22]], M('#d9c8a0', { roughness: .3 }), w - .4, .21, .15, 16), sph(.08, M('#4da855'), w - .4, .5, .15), sph(.06, M('#e86a8a'), w - .33, .46, .15)); return g;
}
export function art_garland(d) {
  const g = G(), w = d.w, cols = ['#d9534f', '#f0c040', '#4f9a6a', '#4f7aa8', '#e08a4a'];
  const N = 9, sag = .22; const pts = []; for (let i = 0; i <= 40; i++) { const t = i / 40; pts.push(new THREE.Vector3(t * w, d.h - .06 - Math.sin(Math.PI * t) * sag, .04)); }
  add(g, new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, .008, 5), M('#5a4636')));
  for (let i = 0; i < N; i++) { const t = (i + .5) / N, x = t * w, y = d.h - .06 - Math.sin(Math.PI * t) * sag; const s = new THREE.Shape(); s.moveTo(-.1, 0); s.lineTo(.1, 0); s.lineTo(0, -.24); s.closePath(); const m = new THREE.Mesh(new THREE.ShapeGeometry(s), M(cols[i % 5], { side: THREE.DoubleSide, roughness: .9 })); m.position.set(x, y, .045); m.rotation.z = (Math.cos(Math.PI * t)) * .2; m.castShadow = true; g.add(m); }
  return g;
}
export function art_aircon(d) {
  const g = G(), w = d.w, c = M(d.color, { roughness: .35 }); add(g, rbox(w, d.h, .22, .08, c, w / 2, 0, .11), box(w - .2, .04, .06, M('#9aa5aa'), w / 2, .08, .22), box(.08, .03, .02, MG(0x60e080, 1.5), w - .2, d.h - .2, .23)); return g;
}
export function art_sconce(d) {
  const g = G(); add(g, box(.12, .3, .05, MM(0xc9a24a), .15, 0, .025), box(.04, .04, .22, MM(0xc9a24a), .15, .15, .12), sph(.11, M('#fff3d0', { emissive: 0xffd890, emissiveIntensity: 1.3, transparent: true, opacity: .93 }), .15, .35, .22));
  lightAt(g, .15, .35, .3, 0xffc880, 3.5, 5); return g;
}
// ===== ラグ =====
export function build_rug(d) {
  const g = G(), w = d.w, L = d.d, kind = d.rugKind || (d.check ? 'check' : 'plain'), tex = rugTexture(kind, d.color, d.color2);
  const mat = M('#fff', { map: tex, roughness: 1 }); let m;
  if (d.round) { m = new THREE.Mesh(new THREE.CylinderGeometry(w / 2 - .02, w / 2 - .02, .03, 48), [M(d.color, { roughness: 1 }), mat, mat]); }
  else m = new THREE.Mesh(new THREE.BoxGeometry(w - .04, .03, L - .04), [M(d.color, { roughness: 1 }), M(d.color, { roughness: 1 }), mat, M(d.color, { roughness: 1 }), M(d.color, { roughness: 1 }), M(d.color, { roughness: 1 })]);
  m.position.y = .015; m.receiveShadow = true; m.castShadow = false; g.add(m);
  if (d.round) m.rotation.y = 0; return g;
}
