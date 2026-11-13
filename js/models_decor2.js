// 追加の小物・雑貨（オリジナル造形）
import { THREE, M, MW, MF, MG, MM, MGLASS, G, box, rbox, cyl, sph, cone, lathe, add, torus } from './mk.js?v=202611131634';
import { puffy } from './soft.js?v=202611131634';

const eyes = (g, y, z, dx, r) => [-1, 1].forEach(s => add(g, sph(r || .02, M('#2a2220', { roughness: .3 }), s * dx, y, z), sph((r || .02) * .35, M('#fff'), s * dx + .006, y + .008, z + (r || .02) * .8)));
export function build_cactus(d) {
  const g = G(), c = M(d.color, { roughness: .85 }), pot = M(d.color2, { roughness: .8 });
  add(g, lathe([[0, 0], [.13, 0], [.17, .1], [.19, .2], [.16, .22], [0, .2]], pot, 0, 0, 0), cyl(.17, .17, .02, M('#3a2a1a'), 0, .2, 0, 14));
  const body = sph(.15, c, 0, .4, 0, 1.5); add(g, body);
  [-1, 1].forEach(s => { add(g, cyl(.045, .045, .16, c, s * .17, .3, 0, 10), sph(.045, c, s * .17, .46, 0)); add(g, cyl(.04, .04, .08, c, s * .13, .32, 0, 8).rotateZ(Math.PI / 2)); g.children.at(-1).position.set(s * .1, .34, 0); });
  eyes(g, .43, .14, .055, .016); [-1, 1].forEach(s => add(g, sph(.02, M('#f7a8b8', { roughness: 1 }), s * .09, .39, .12, .6)));
  add(g, sph(.032, M('#f07090'), 0, .62, 0), sph(.02, M('#ffd84a'), 0, .62, .02));
  return g;
}
export function build_flowerpot(d) {
  const g = G(), pot = M(d.color2, { roughness: .8 }), lf = M('#58b062', { roughness: .7 });
  add(g, lathe([[0, 0], [.12, 0], [.17, .08], [.19, .24], [.16, .26], [0, .24]], pot, 0, 0, 0), cyl(.17, .17, .02, M('#3a2a1a'), 0, .24, 0, 14));
  const cols = [d.color, '#fff3a0', '#f7a8b8', d.color, '#ffffff'];
  for (let i = 0; i < 5; i++) { const a = i * 1.26, r = .06 + (i % 2) * .05, h = .38 + (i % 3) * .08; add(g, cyl(.007, .007, h - .24, lf, Math.sin(a) * r, .25, Math.cos(a) * r, 5)); for (let k = 0; k < 6; k++) { const b = k * 1.047, p = sph(.035, M(cols[i], { roughness: .7 }), Math.sin(a) * r + Math.sin(b) * .04, .24 + h - .24 + .02, Math.cos(a) * r + Math.cos(b) * .04, .6); add(g, p); } add(g, sph(.02, M('#ffcf3a'), Math.sin(a) * r, .24 + h - .22, Math.cos(a) * r)); }
  add(g, sph(.07, lf, -.06, .3, .05, .5), sph(.07, lf, .08, .3, -.04, .5));
  return g;
}
export function build_hourglass(d) {
  const g = G(), wd = MW(d.color2), glass = MGLASS(0xdff3ff, .28);
  add(g, cyl(.12, .12, .03, wd, 0, 0, 0, 16), cyl(.12, .12, .03, wd, 0, .37, 0, 16));
  [0, 1, 2].forEach(i => add(g, cyl(.01, .01, .34, wd, Math.sin(i * 2.094) * .1, .03, Math.cos(i * 2.094) * .1, 6)));
  add(g, lathe([[.0, 0], [.09, .02], [.1, .1], [.01, .17], [.1, .24], [.09, .32], [0, .34]], glass, 0, .04, 0, 16));
  add(g, cone(.055, .1, M(d.color, { roughness: .9 }), 0, .05, 0, 12), cone(.012, .1, M(d.color, { roughness: .9 }), 0, .17, 0, 6), sph(.045, M(d.color, { roughness: .9 }), 0, .26, 0, .6));
  return g;
}
export function build_calc(d) {
  const g = G(), c = M(d.color, { roughness: .4 });
  add(g, rbox(.3, .035, .42, .02, c, 0, 0, 0), rbox(.24, .01, .08, .006, M('#b8d8b0', { roughness: .2 }), 0, .035, -.14));
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) add(g, rbox(.045, .015, .045, .01, M(i === 3 ? '#f2877a' : '#f3f0ea', { roughness: .5 }), -.09 + i * .06, .035, -.04 + j * .06));
  return g;
}
export function build_penstand(d) {
  const g = G(), c = M(d.color, { roughness: .4 });
  add(g, cyl(.09, .1, .2, c, 0, 0, 0, 20), cyl(.085, .085, .01, M('#2a1a10'), 0, .2, 0, 20));
  ['#f2877a', '#4f8ae0', '#f2c14e', '#58b062', '#b39ddb'].forEach((col, i) => { const a = i * 1.26, p = cyl(.011, .011, .16, M(col), Math.sin(a) * .04, .2, Math.cos(a) * .04, 6); p.rotation.z = Math.sin(a) * .22; p.rotation.x = Math.cos(a) * .22; add(g, p); add(g, cone(.011, .03, M('#f3d9b0'), Math.sin(a) * .04 + Math.sin(a) * .035, .34, Math.cos(a) * .04 + Math.cos(a) * .035, 6)); g.children.at(-1).rotation.z = Math.sin(a) * .22; g.children.at(-1).rotation.x = Math.cos(a) * .22; });
  const sc = cyl(.012, .012, .02, M('#fff'), 0, .0, 0, 6); void sc;
  return g;
}
export function build_mug(d) {
  const g = G(), c = M(d.color, { roughness: .25 });
  add(g, lathe([[0, 0], [.07, 0], [.085, .02], [.085, .15], [.075, .15], [.075, .03], [0, .02]], c, 0, 0, 0, 20), cyl(.075, .075, .005, M('#6a3a22', { roughness: .15 }), 0, .13, 0, 20));
  const h = torus(.045, .012, c, .1, .08, 0); h.scale.set(.85, 1, 1); add(g, h);
  add(g, sph(.018, M(d.color2), 0, .08, .085, .9), cyl(.07, .07, .004, M(d.color2), 0, .01, 0, 20));
  return g;
}
export function build_birdcage(d) {
  const g = G(), br = MM(0xc9a24a, .35), cage = G(), bird = G();
  add(g, cyl(.2, .22, .04, MW('#7a4a2a'), 0, 0, 0, 20), cyl(.025, .035, .55, br, 0, .04, 0, 8), cyl(.2, .2, .04, MW('#7a4a2a'), 0, .58, 0, 20));
  add(g, cyl(.19, .19, .03, M('#7a4a2a'), 0, .62, 0, 20));
  const up = G(); up.position.y = .62;
  for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; add(up, cyl(.008, .008, .36, br, Math.sin(a) * .18, 0, Math.cos(a) * .18, 5)); }
  add(up, torus(.18, .01, br, 0, .36, 0).rotateX(Math.PI / 2)); up.children.at(-1).position.y = .36;
  add(up, sph(.18, br, 0, .36, 0, .5)); up.children.at(-1).material = MGLASS(0xffffff, .0001);
  add(up, cyl(.01, .01, .1, br, 0, .5, 0, 6), torus(.04, .008, br, 0, .6, 0), cyl(.01, .01, .34, br, 0, .02, 0, 6));
  const per = cyl(.01, .01, .3, MW('#7a4a2a'), 0, .12, 0, 6); per.rotation.z = Math.PI / 2; per.position.set(0, .12, 0); up.add(per);
  g.add(up);
  bird.add(sph(.065, M('#ffd84a', { roughness: .9 }), 0, 0, 0), sph(.05, M('#ffd84a', { roughness: .9 }), .04, .06, 0), cone(.014, .04, M('#ff9a3a'), .09, .055, 0, 6), sph(.01, M('#222'), .075, .075, .035));
  bird.children[3].rotation.z = -Math.PI / 2; bird.position.set(0, .8, 0); g.add(bird);
  g.userData.anim = t => { bird.position.y = .8 + Math.abs(Math.sin(t * 3)) * .02 * (Math.sin(t * .7) > .3 ? 1 : 0); bird.rotation.y = Math.sin(t * .9) * .5; }; g.userData.live = true;
  return g;
}
export function build_aquarium(d) {
  const g = G(), w = d.w, h = d.h, L = d.d, wd = MW(d.color2), fish = [];
  add(g, box(w, .42, L - .2, wd, 0, 0, 0), box(w - .12, .06, L - .3, MW(d.color), 0, .42, 0));
  const tank = G(); tank.position.y = .48;
  add(tank, box(w - .16, .06, L - .3, M('#3a3a42'), 0, 0, 0));
  add(tank, rbox(w - .24, .42, L - .38, .03, M('#8fd8f0', { transparent: true, opacity: .32, depthWrite: false, roughness: .1 }), 0, .06, 0), rbox(w - .22, .1, L - .36, .03, M('#e8d8b0', { roughness: 1 }), 0, .06, 0));
  add(tank, box(w - .2, h - .5, L - .34, MGLASS(0xdff6ff, .13), 0, .06, 0));
  tank.children.at(-1).castShadow = false;
  [[-.4, .12], [.25, -.05], [.5, .1]].forEach(([x, z], i) => { add(tank, sph(.08 + i * .02, M(['#5fb760', '#4da855', '#7bc47f'][i], { roughness: .8 }), x, .24 + i * .02, z, 1.8)); });
  add(tank, sph(.1, M('#9a8a7a', { roughness: .9 }), -.1, .14, .05, .7), sph(.07, M('#b0a090'), 0, .12, -.06, .7));
  [0, 1, 2].forEach(i => { const f = G(); f.add(sph(.045, M(i === 1 ? '#6ab0f0' : '#ff8a4a', { roughness: .5 }), 0, 0, 0), cone(.035, .06, M(i === 1 ? '#6ab0f0' : '#ff8a4a'), -.065, -.03, 0, 6), sph(.008, M('#222'), .03, .01, .03)); f.children[1].rotation.z = Math.PI / 2; f.children[1].position.set(-.07, 0, 0); f.children[0].scale.set(1.5, 1, .6); tank.add(f); fish.push(f); });
  add(tank, cyl(.012, .012, .35, M('#fff', { transparent: true, opacity: .4 }), w * .3, .08, .0, 6));
  add(g, tank);
  add(g, box(w - .1, .05, L - .24, M('#e9e9e4', { roughness: .4 }), 0, .48 + h - .46, 0), sph(.03, MG(0x80d0ff, 1.5), w / 2 - .25, .48 + h - .4, L / 2 - .2));
  g.userData.anim = t => fish.forEach((f, i) => { const a = t * (.6 + i * .2) + i * 2; f.position.set(Math.sin(a) * (w * .3), .2 + i * .1 + Math.sin(t * 2 + i) * .02, Math.cos(a) * (L * .12)); f.rotation.y = Math.atan2(Math.cos(a) * (w * .3), -Math.sin(a) * (L * .12)) - Math.PI / 2 + Math.PI; });
  g.userData.live = true; return g;
}
export function build_boardgame(d) {
  const g = G(), box1 = M(d.color, { roughness: .6 });
  add(g, rbox(.5, .06, .5, .015, box1, 0, 0, 0), rbox(.44, .01, .44, .005, M('#fff6e0'), 0, .06, 0));
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) if ((i + j) % 2) add(g, box(.1, .004, .1, M(d.color2), -.15 + i * .1, .07, -.15 + j * .1));
  ['#f2877a', '#4f8ae0', '#58b062'].forEach((c, i) => add(g, cyl(.025, .03, .05, M(c, { roughness: .4 }), -.12 + i * .1, .07, -.1 + (i % 2) * .2, 10), sph(.026, M(c, { roughness: .4 }), -.12 + i * .1, .125, -.1 + (i % 2) * .2)));
  const dc = rbox(.05, .05, .05, .01, M('#fff'), .17, .07, .17); dc.rotation.y = .5; add(g, dc, sph(.006, M('#222'), .17, .125, .195));
  return g;
}
export function build_catplush(d) {
  const g = G(), c = M(d.color, { roughness: 1 }), c2 = M(d.color2, { roughness: 1 });
  add(g, sph(.16, c, 0, .16, 0, 1.0), sph(.14, c, 0, .35, .02, .9));
  [-1, 1].forEach(s => { add(g, cone(.06, .1, c, s * .09, .42, .02, 4), cone(.03, .06, M('#f7a8b8', { roughness: 1 }), s * .09, .43, .05, 4)); add(g, sph(.045, c2, s * .07, .05, .13, .8)); });
  eyes(g, .36, .14, .06, .018); add(g, sph(.014, M('#f07090'), 0, .335, .155), sph(.03, M('#f7a8b8', { roughness: 1, transparent: true, opacity: .6 }), -.1, .32, .13, .6), sph(.03, M('#f7a8b8', { roughness: 1, transparent: true, opacity: .6 }), .1, .32, .13, .6));
  const tail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(.05, .1, -.14), new THREE.Vector3(.2, .12, -.2), new THREE.Vector3(.26, .25, -.12), new THREE.Vector3(.22, .36, -.05)]), 12, .035, 8), c); tail.castShadow = true; add(g, tail);
  add(g, sph(.045, c2, 0, .22, .12, .9));
  return g;
}
export function build_omamori(d) {
  const g = G(), c = M(d.color, { roughness: .6 }), gd = M('#e8c94a', { roughness: .4 });
  add(g, puffy(.2, .06, .3, MF(d.color, 'cloth'), 0, 0, 0, { puff: .5, pinch: .5, wr: .008, seed: 2, round: 2 }));
  add(g, rbox(.2, .015, .22, .005, c, 0, .0, 0)); g.children.at(-1).visible = false;
  add(g, rbox(.12, .01, .17, .004, M('#fffaf0'), 0, .06, -.01), box(.06, .004, .05, gd, 0, .07, -.04), sph(.012, gd, 0, .075, .04));
  add(g, box(.2, .005, .05, M(d.color2), 0, .03, .1), cyl(.012, .012, .1, M('#c9373a'), 0, .0, .22, 6).rotateX(Math.PI / 2));
  g.children.at(-1).position.set(0, .03, .2);
  add(g, sph(.03, M('#c9373a'), 0, .02, .27), cyl(.004, .004, .1, M('#c9373a'), .01, .0, .3, 4));
  return g;
}
