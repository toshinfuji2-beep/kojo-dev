// 第4弾：ナチュラルなキッチン・食卓まわり（オリジナル造形。つや消し・木目・やわらかい角）
import { THREE, M, MW, MF, MG, MM, MS, MC, MGLASS, G, box, rbox, cyl, sph, cone, lathe, add, lightAt, torus, halo } from './mk.js?v=202611131634';
import { puffy } from './soft.js?v=202611131634';
import { texOf } from './textures.js?v=202611131634';

const arc = (R, r, a, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.TorusGeometry(R, r, 8, 18, a), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; };
const STEEL = '#c9ced1', DARK = '#3a3430';
const hbar = (w, mat, x, y, z) => cyl(.014, .014, w, mat, x, y - w / 2, z, 8).rotateZ(Math.PI / 2);   // 横棒（x方向）

// ----- 大きなもの -----
export function build_fridge2(d) {
  const g = G(), w = d.w - .1, H = d.h, body = M(d.color, { roughness: .55 }), st = MS(STEEL, .42), dw = (w - .04) / 2;
  add(g, rbox(w, H - .1, .76, .04, body, 0, .1, 0), box(w - .12, .1, .6, M(DARK), 0, 0, 0));
  [-1, 1].forEach(s => {
    add(g, rbox(dw, 1.3, .05, .03, body, s * (dw / 2 + .01), .74, .39), box(.026, .56, .035, st, s * .06, 1.2, .43));
  });
  add(g, rbox(w - .04, .5, .05, .03, body, 0, .16, .39), hbar(.7, st, 0, .6, .43));
  add(g, box(w - .04, .012, .02, M('#9a948a', { roughness: 1 }), 0, .72, .415));
  return g;
}
export function build_gasrange(d) {
  const g = G(), w = d.w, h = d.h, car = MW(d.color), door = M(d.color2, { roughness: .6 }), st = MS(STEEL, .4), iron = M('#2a2826', { roughness: .6, metalness: .4 });
  add(g, box(w - .1, .08, .58, M(DARK), 0, 0, 0), rbox(w - .02, h - .13, .66, .02, car, 0, .08, 0));
  // 左：ひきだし2つ、右：オーブン
  [0, 1].forEach(i => add(g, rbox(.9, .34, .03, .015, door, -.5, .14 + i * .38, .34), box(.2, .022, .03, st, -.5, .4 + i * .38 - .08, .37)));
  add(g, rbox(.9, .72, .03, .02, st, .5, .14, .34), box(.82, .4, .012, M('#1a1a1e', { roughness: .15, metalness: .3 }), .5, .24, .357), hbar(.7, MS('#2a2a2a'), .5, .66, .39));
  add(g, box(w, .05, .7, st, 0, h - .05, 0), box(w - .06, .22, .05, st, 0, h, -.32));
  [-.36, -.12, .12, .36].forEach((x, i) => add(g, cyl(.035, .035, .04, iron, x, h - .02, .0, 12).rotateX(Math.PI / 2)));
  g.children.slice(-4).forEach((k, i) => k.position.set(-.45 + i * .3, h + .1, -.285));
  [-.5, .5].forEach(x => {
    add(g, torus(.1, .014, iron, x, h + .012, .02).rotateX(Math.PI / 2), cyl(.05, .06, .025, iron, x, h, .02, 14), box(.34, .012, .016, iron, x, h + .03, .02), box(.016, .012, .34, iron, x, h + .03, .02));
  });
  return g;
}
export function build_sinkunit(d) {
  const g = G(), w = d.w, h = d.h, car = MW(d.color), door = M(d.color2, { roughness: .6 }), st = MS(STEEL, .36), pad = MS('#b9bec2', .5);
  add(g, box(w - .1, .08, .58, M(DARK), 0, 0, 0), rbox(w - .02, h - .13, .66, .02, car, 0, .08, 0));
  [-1, 1].forEach(s => add(g, rbox(.92, .76, .03, .015, door, s * .5, .14, .34), box(.03, .2, .03, st, s * .5 - s * .38, .5, .37)));
  add(g, box(w, .05, .7, M('#e9e6df', { roughness: .45 }), 0, h - .05, 0));
  add(g, rbox(.78, .02, .5, .01, st, -.5, h, .0), box(.66, .012, .38, MS('#8e9499', .55), -.5, h + .018, 0), cyl(.03, .03, .02, M('#2a2a2a'), -.5, h + .028, .04, 10));
  add(g, cyl(.03, .035, .06, st, -.5, h, -.27, 10), cyl(.016, .016, .3, st, -.5, h + .05, -.27, 8), arc(.12, .016, Math.PI, st, -.38, h + .35, -.27).rotateY(0), cyl(.016, .016, .08, st, -.26, h + .3, -.27, 8));
  g.children.at(-2).rotation.z = 0;
  [0, 1, 2, 3].forEach(i => add(g, box(.5, .008, .02, pad, .52, h + .004, -.12 + i * .08)));
  return g;
}
export function build_wagon(d) {
  const g = G(), wd = MW(d.color), dk = MW(d.color2), st = MS(STEEL, .45), h = d.h;
  [-1, 1].forEach(sx => [-1, 1].forEach(sz => add(g, cyl(.028, .028, h - .08, dk, sx * .34, .1, sz * .24, 10), cyl(.04, .04, .03, M('#2a2826'), sx * .34, .05, sz * .24, 12).rotateX(Math.PI / 2))));
  g.children.slice(-8).forEach((m, i) => { if (i % 2) m.position.y = .05; });
  [.12, .42, h - .05].forEach((y, i) => add(g, rbox(.82, .04, .62, .015, i === 2 ? wd : dk, 0, y, 0), i < 2 ? box(.82, .05, .012, dk, 0, y + .04, .31) : null));
  add(g, hbar(.8, st, 0, h + .1, .31 - .62 * 0), cyl(.016, .016, .14, st, -.4, h - .04, .31, 8), cyl(.016, .016, .14, st, .4, h - .04, .31, 8));
  g.children.at(-3).position.set(0, h + .1, .31);
  add(g, rbox(.3, .12, .22, .03, M('#d9b886', { roughness: 1 }), -.2, .16, 0), sph(.05, M('#e8a04a', { roughness: .8 }), .2, .2, .0), sph(.05, M('#d9843a', { roughness: .8 }), .27, .2, .06));
  return g;
}
export function build_birchtable(d) {
  const g = G(), w = d.w, h = d.h, top = MW(d.color), bark = M(d.color2, { roughness: .95 }), dash = M('#2a2622', { roughness: 1 });
  add(g, rbox(w - .1, .08, .8, .03, top, 0, h - .08, 0));
  [-1, 1].forEach(sx => [-1, 1].forEach(sz => {
    const x = sx * (w / 2 - .22), z = sz * .28; add(g, cyl(.065, .075, h - .08, bark, x, 0, z, 14));
    for (let i = 0; i < 4; i++) add(g, box(.05 + (i % 2) * .03, .012, .02, dash, x + .06 * Math.cos(i * 2.1 + sx), .1 + i * .16, z + .06 * Math.sin(i * 2.1 + sz)).rotateY(i * 2.1));
  }));
  add(g, cyl(.04, .04, w - .5, MW(d.color), 0, .25, 0, 8).rotateZ(Math.PI / 2));
  g.children.at(-1).position.y = .25 + (w - .5) / 2 - (w - .5) / 2 + 0;
  g.children.at(-1).position.y = .27;
  return g;
}
export function build_ladderchair(d) {
  const g = G(), wd = MW(d.color), pad = MF(d.color2, 'cloth'), h = d.h;
  [-1, 1].forEach(sx => { add(g, cyl(.028, .022, .5, wd, sx * .24, 0, .22, 8), cyl(.028, .022, .5, wd, sx * .24, 0, -.2, 8), cyl(.026, .026, h - .5, wd, sx * .24, .5, -.21, 8)); });
  add(g, rbox(.6, .05, .56, .02, wd, 0, .5, .0));
  add(g, puffy(.5, .06, .46, pad, 0, .55, 0, { puff: .5 }));
  [.62, .76, .9].forEach(y => add(g, box(.5, .03, .025, wd, 0, y, -.21)));
  [.5, .56].forEach(y => add(g, hbar(.48, wd, 0, y, -.2)));
  g.children.slice(-2).forEach((m, i) => m.position.set(0, .3 + i * .14, -.2));
  return g;
}
export function build_rattanchair(d) {
  const g = G(), rt = M(d.color, { roughness: 1 }), rt2 = M('#e0c288', { roughness: 1 }), wd = MW('#8a5a34'), cu = MF(d.color2, 'cloth');
  [-1, 1].forEach(sx => [-1, 1].forEach(sz => { const l = cyl(.022, .016, .5, wd, sx * .22, 0, sz * .2, 8); l.rotation.z = -sx * .08; add(g, l); }));
  add(g, cyl(.31, .29, .06, rt, 0, .5, 0, 24), torus(.3, .022, rt2, 0, .53, 0).rotateX(Math.PI / 2));
  add(g, puffy(.5, .09, .46, cu, 0, .55, 0, { puff: .6 }));
  const bk = new THREE.Group(); bk.position.set(0, .6, -.24); bk.rotation.x = -.18; g.add(bk);
  [.36, .27, .18, .09].forEach((R, i) => { const t = torus(R, .02, i % 2 ? rt2 : rt, 0, .38, 0); bk.add(t); });
  const disc = cyl(.36, .36, .018, rt, 0, 0, 0, 28).rotateX(Math.PI / 2); disc.position.set(0, .38, -.005); bk.add(disc);
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = cyl(.008, .008, .66, rt2, 0, 0, 0, 5); r.position.set(0, .38, .012); r.rotation.z = a; bk.add(r); }
  const rest = torus(.37, .028, rt2, 0, .38, 0); bk.add(rest);
  return g;
}
export function build_woodstove(d) {
  const g = G(), iron = M(d.color, { roughness: .55, metalness: .55, envMapIntensity: .9 }), h = d.h, WH = 3.4;
  [-1, 1].forEach(sx => [-1, 1].forEach(sz => add(g, cyl(.035, .03, .16, iron, sx * .3, 0, sz * .22, 8))));
  add(g, rbox(.78, .6, .6, .05, iron, 0, .16, 0), rbox(.84, .05, .66, .02, iron, 0, h - .1, 0), rbox(.64, .13, .5, .03, iron, 0, .76, 0));
  add(g, rbox(.5, .36, .03, .03, M('#17120f', { roughness: .5, metalness: .4 }), 0, .27, .31), rbox(.36, .2, .02, .02, MG(d.color2, 2.2), 0, .35, .33));
  add(g, cyl(.03, .03, .06, iron, .2, .4, .34, 8).rotateX(Math.PI / 2));
  add(g, cyl(.075, .075, WH - h + .05, iron, 0, h - .1, -.12, 14), cyl(.095, .095, .06, iron, 0, WH - .06, -.12, 14));
  const fl = sph(.07, MG('#ffb347', 2.4), 0, .33, .31, 1.2); add(g, fl);
  add(g, halo(0xff9a4a, 1.1, 0, .5, .45, .6));
  g.userData.anim = t => { fl.scale.set(1 + .1 * Math.sin(t * 9), 1.2 + .2 * Math.sin(t * 7), 1); };
  lightAt(g, 0, .4, .5, 0xff8a3a, 5, 5, true); return g;
}
export function build_linensofa(d) {
  const g = G(), w = d.w, lin = MF(d.color, 'cloth'), lin2 = MF(d.color2, 'cloth'), wd = MW('#9a6a40');
  [-1, 1].forEach(sx => [-1, 1].forEach(sz => add(g, cyl(.03, .022, .2, wd, sx * (w / 2 - .12), 0, sz * .3, 8))));
  add(g, puffy(w - .1, .2, .8, lin, 0, .14, 0, { puff: .3 }));
  [-1, 1].forEach(s => add(g, puffy(w / 2 - .22, .17, .62, lin2, s * (w / 4 - .02), .32, .08, { puff: .75 })));
  add(g, puffy(w - .1, .5, .22, lin, 0, .34, -.32, { puff: .35 }));
  [-1, 1].forEach(s => { add(g, puffy(.16, .46, .76, lin, s * (w / 2 - .09), .16, 0, { puff: .5 })); add(g, puffy(w / 2 - .26, .4, .18, lin2, s * (w / 4 - .02), .46, -.18, { puff: .8 }).rotateX(-.2)); });
  add(g, puffy(.3, .28, .1, MF('#c9a27a', 'cloth'), -w / 2 + .38, .5, -.02, { puff: .9 }).rotateZ(.3));
  return g;
}
export function build_sidetable(d) {
  const g = G(), wd = MW(d.color), dk = MW(d.color2), h = d.h;
  [0, 1, 2].forEach(i => { const a = i * 2.094 + .5, l = cyl(.022, .016, h - .05, dk, Math.sin(a) * .22, 0, Math.cos(a) * .22, 8); l.rotation.set(Math.cos(a) * .1, 0, -Math.sin(a) * .1); add(g, l); });
  add(g, cyl(.34, .34, .05, wd, 0, h - .05, 0, 28), cyl(.26, .26, .025, dk, 0, .2, 0, 24));
  return g;
}
export function build_ladderrack(d) {
  const g = G(), wd = MW(d.color), h = d.h;
  [-1, 1].forEach(sx => { const r = box(.045, h, .06, wd, sx * .4, 0, 0); r.rotation.x = -.14; r.position.z = -.13; add(g, r); const b = box(.045, h * .9, .06, wd, sx * .4, 0, 0); b.rotation.x = .14; b.position.z = .27; add(g, b); });
  [[.32, .5], [.7, .44], [1.08, .38], [1.44, .3]].forEach(([y, dd], i) => add(g, rbox(.84, .04, dd, .012, i === 3 ? MW(d.color2) : wd, 0, y, -.05 + .02 * i)));
  add(g, sph(.07, M('#d9895a'), -.2, .75, -.05), cyl(.06, .05, .12, M('#e8dcc6', { roughness: .4 }), .22, .36, -.05, 14), sph(.09, M('#5fa860', { roughness: .9 }), .22, .52, -.05, .8));
  return g;
}
export function build_fullmirror(d) {
  const g = G(), wd = MW(d.color), h = d.h;
  add(g, rbox(.64, h - .1, .06, .03, wd, 0, .1, 0), box(.54, h - .24, .01, M('#e8f1f4', { metalness: .9, roughness: .06, envMapIntensity: 2.2 }), 0, .17, .036));
  const l = box(.05, h - .2, .05, wd, -.2, .1, -.12); l.rotation.x = .2; const r2 = box(.05, h - .2, .05, wd, .2, .1, -.12); r2.rotation.x = .2; add(g, l, r2);
  add(g, rbox(.6, .04, .3, .015, wd, 0, 0, -.1));
  return g;
}
export function build_coatstand(d) {
  const g = G(), wd = MW(d.color), h = d.h;
  add(g, cyl(.26, .3, .05, wd, 0, 0, 0, 20), cyl(.03, .03, h, wd, 0, 0, 0, 10));
  [0, 1, 2, 3].forEach(i => { const a = i * Math.PI / 2 + .4; const p = cyl(.016, .016, .22, wd, Math.sin(a) * .11, h - .2, Math.cos(a) * .11, 6); p.rotation.set(Math.cos(a) * .9, 0, -Math.sin(a) * .9); add(g, p); add(g, sph(.026, wd, Math.sin(a) * .21, h - .1, Math.cos(a) * .21)); });
  add(g, puffy(.34, .7, .16, MF(d.color2, 'cloth'), .05, h - .82, .17, { puff: .6, drape: .1 }), sph(.07, M('#c9a24a'), .17, h - .12, .06));
  add(g, puffy(.2, .4, .06, MF('#c9593f', 'cloth'), -.16, h - .56, -.1, { puff: .7 }));
  return g;
}
export function build_retrofan(d) {
  const g = G(), body = M(d.color, { roughness: .4 }), cr = MM('#d8dcde', .35), h = d.h;
  add(g, cyl(.22, .26, .06, body, 0, 0, 0, 24), cyl(.04, .04, h - .66, cr, 0, .06, 0, 10));
  const head = new THREE.Group(); head.position.set(0, h - .34, 0); g.add(head);
  head.add(cyl(.1, .1, .22, body, 0, -.11, -.1, 16).rotateX(Math.PI / 2));
  [.34, .3].forEach((R, i) => head.add(torus(R, .008, cr, 0, 0, .07 + i * .03)));
  for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6, b = cyl(.005, .005, .62, cr, 0, 0, .1, 5); b.rotation.z = a; head.add(b); }
  const bl = new THREE.Group(); bl.position.set(0, 0, .04); head.add(bl);
  for (let i = 0; i < 4; i++) { const b = sph(.12, M('#e8f4f0', { roughness: .5 }), 0, .15, 0, 1); b.scale.set(.5, 1.15, .1); const pv = new THREE.Group(); pv.rotation.z = i * Math.PI / 2; pv.add(b); bl.add(pv); }
  bl.add(sph(.045, cr, 0, 0, .02));
  g.userData.anim = t => { bl.rotation.z = t * 9; head.rotation.y = Math.sin(t * .5) * .5; };
  return g;
}

// ----- 家電（小）-----
export function build_toaster(d) {
  const g = G(), st = MS(d.color, .35), blk = M('#2a2826', { roughness: .6 });
  add(g, rbox(.5, .26, .3, .07, st, 0, 0, 0), box(.38, .012, .05, blk, 0, .26, -.06), box(.38, .012, .05, blk, 0, .26, .06));
  add(g, rbox(.34, .1, .04, .02, M('#e6b870', { roughness: 1 }), 0, .24, -.06), rbox(.34, .1, .04, .02, M('#d99a52', { roughness: 1 }), 0, .24, .06));
  add(g, box(.04, .03, .05, blk, .27, .18, .0), cyl(.022, .022, .03, blk, -.1, .09, .16, 10).rotateX(Math.PI / 2), cyl(.022, .022, .03, blk, .1, .09, .16, 10).rotateX(Math.PI / 2));
  return g;
}
export function build_radio(d) {
  const g = G(), wd = MW(d.color), cr = MM('#d8dcde', .35);
  add(g, rbox(.62, .34, .24, .03, wd, 0, 0, 0), box(.3, .24, .012, M('#c9b48a', { roughness: 1 }), -.12, .05, .125));
  for (let i = 0; i < 6; i++) add(g, box(.28, .008, .014, M('#4a3a2a'), -.12, .08 + i * .035, .13));
  add(g, box(.18, .08, .012, MG('#ffd890', 1.4), .17, .2, .125), cyl(.04, .04, .03, M(d.color2), .14, .06, .135, 14).rotateX(Math.PI / 2), cyl(.04, .04, .03, M(d.color2), .24, .06, .135, 14).rotateX(Math.PI / 2));
  const an = cyl(.006, .006, .45, cr, .24, .34, -.05, 5); an.rotation.z = -.5; add(g, an);
  add(g, halo(0xffc070, .5, .17, .24, .2, .35));
  return g;
}
export function build_diffuser(d) {
  const g = G(), cer = MC(d.color), wd = MW(d.color2), mist = [];
  add(g, lathe([[0, 0], [.1, 0], [.13, .08], [.12, .18], [.09, .22], [0, .22]], cer, 0, 0, 0, 20), cyl(.095, .095, .04, wd, 0, .22, 0, 20), cyl(.02, .03, .02, MG('#ffd890', .8), 0, .26, 0, 10));
  for (let i = 0; i < 4; i++) { const m = sph(.05, M('#ffffff', { transparent: true, opacity: .2, depthWrite: false }), 0, .3, 0); mist.push(m); add(g, m); }
  g.userData.anim = t => mist.forEach((m, i) => { const k = (t * .3 + i / 4) % 1; m.position.set(Math.sin(t + i) * .03, .3 + k * .4, 0); m.scale.setScalar(.5 + k * 1.4); m.material = m.material.clone(); m.material.opacity = .22 * (1 - k); });
  return g;
}

// ----- キッチン小物 -----
export function build_dishrack(d) {
  const g = G(), st = MS(d.color, .4), wr = MM('#c9ced1', .45);
  add(g, rbox(.7, .03, .46, .012, st, 0, 0, 0));
  for (let i = 0; i < 5; i++) add(g, cyl(.2, .2, .012, M(i % 2 ? '#f6f1e6' : d.color2, { roughness: .3 }), -.2 + i * .1, .03, 0, 20).rotateZ(Math.PI / 2));
  g.children.slice(-5).forEach((m, i) => m.position.set(-.24 + i * .12, .24, 0));
  [-.28, .28].forEach(z => add(g, hbar(.7, wr, 0, .03, z)));
  [-.3, .3].forEach(x => [-.28, .28].forEach(z => add(g, cyl(.01, .01, .06, wr, x, .01, z, 5))));
  add(g, cyl(.05, .04, .08, M('#f6f1e6', { roughness: .3 }), .3, .03, .12, 14));
  return g;
}
export function build_pitcher(d) {
  const g = G(), c = MC(d.color);
  add(g, lathe([[0, 0], [.1, 0], [.12, .08], [.12, .26], [.1, .3], [.09, .28], [.1, .26], [.1, .08], [.09, .02]], c, 0, 0, 0, 20));
  add(g, cyl(.1, .1, .01, c, 0, 0, 0, 20), arc(.07, .018, Math.PI * 1.1, c, .13, .17, 0).rotateZ(-Math.PI / 2 - .55));
  g.children.at(-1).rotation.set(0, 0, -Math.PI / 2 - .5);
  add(g, torus(.105, .008, M(d.color2, { roughness: .4 }), 0, .28, 0).rotateX(Math.PI / 2), sph(.11, M('#bfe3f2', { roughness: .1, transparent: true, opacity: .0 }), 0, .1, 0));
  return g;
}
export function build_kscale(d) {
  const g = G(), c = M(d.color, { roughness: .4 }), st = MS(STEEL, .4);
  add(g, rbox(.5, .12, .36, .05, c, 0, 0, 0), rbox(.42, .025, .3, .01, st, 0, .12, 0), cyl(.075, .075, .012, M('#fffdf4', { roughness: .4 }), 0, .122, .13, 24).rotateX(-0.001));
  add(g, cyl(.07, .07, .012, M('#fffdf4', { roughness: .4 }), 0, .1, .185, 24).rotateX(Math.PI / 2 - .9));
  g.children.at(-1).position.set(0, .065, .18);
  add(g, box(.008, .06, .006, M('#d9534f'), 0, .065, .195).rotateZ(.5));
  return g;
}
export function build_coffeemill(d) {
  const g = G(), wd = MW(d.color), mt = MM(d.color2, .35);
  add(g, rbox(.28, .26, .28, .03, wd, 0, 0, 0), rbox(.2, .07, .02, .01, wd, 0, .05, .15), sph(.018, mt, 0, .08, .17), cyl(.1, .13, .06, mt, 0, .26, 0, 16));
  add(g, cyl(.012, .012, .12, mt, 0, .32, 0, 6), cyl(.012, .012, .2, mt, .1, .44, 0, 6).rotateZ(Math.PI / 2), sph(.03, wd, .22, .44, 0));
  g.children.at(-2).position.set(.1, .44, 0);
  return g;
}
export function build_chocake(d) {
  const g = G(), pl = MC('#f6f1e6'), ch = M(d.color, { roughness: .6 }), gl = M(d.color2, { roughness: .25 });
  add(g, cyl(.2, .2, .015, pl, 0, 0, 0, 24), cyl(.05, .07, .06, pl, 0, .015, 0, 16), cyl(.19, .19, .015, pl, 0, .075, 0, 24));
  add(g, cyl(.16, .16, .1, ch, 0, .09, 0, 24), cyl(.165, .165, .02, gl, 0, .19, 0, 24));
  for (let i = 0; i < 9; i++) { const a = i * .7; add(g, cyl(.016, .016, .06 + (i % 3) * .03, gl, Math.sin(a) * .16, .13 - (i % 3) * .03, Math.cos(a) * .16, 6)); }
  [0, 1, 2].forEach(i => { const a = i * 2.1 + .3; add(g, sph(.034, M('#d4344a', { roughness: .3 }), Math.sin(a) * .09, .225, Math.cos(a) * .09, 1.1)); });
  add(g, cone(.022, .04, M('#e8f0e0'), 0, .2, 0, 6));
  return g;
}
export function build_bread(d) {
  const g = G(), bk = M(d.color2, { roughness: 1 }), cr = M(d.color, { roughness: .85 }), cl = M('#f6efe0', { roughness: 1 });
  add(g, lathe([[0, 0], [.16, 0], [.22, .14], [.2, .16], [.19, .14], [.15, .02]], bk, 0, 0, 0, 20), cyl(.2, .2, .012, cl, 0, .1, 0, 20));
  const b = cyl(.04, .04, .5, cr, 0, .12, 0, 10).rotateZ(Math.PI / 2); b.rotation.set(0, .5, Math.PI / 2 - .35); b.position.set(-.04, .22, -.02); add(g, b);
  add(g, sph(.1, cr, .08, .17, .06, .75), box(.1, .006, .02, M('#f0d9a8'), .08, .245, .06).rotateY(.4));
  return g;
}
export function build_teapot(d) {
  const g = G(), c = MC(d.color), c2 = MC(d.color2);
  add(g, lathe([[0, 0], [.08, 0], [.13, .06], [.14, .13], [.1, .2], [.0, .21]], c, 0, 0, 0, 22), lathe([[0, 0], [.08, .01], [.09, .03], [0, .05]], c, 0, .205, 0, 16), sph(.022, c2, 0, .26, 0));
  const sp = cyl(.02, .035, .16, c, .17, .08, 0, 10); sp.rotation.z = -.9; add(g, sp);
  const h = arc(.07, .016, Math.PI * 1.2, c, -.14, .12, 0); h.rotation.z = Math.PI / 2 + .1; add(g, h);
  add(g, torus(.115, .008, c2, 0, .15, 0).rotateX(Math.PI / 2));
  return g;
}
export function build_kettle(d) {
  const g = G(), st = MS(d.color, .38), blk = M(d.color2, { roughness: .6 });
  add(g, lathe([[0, 0], [.14, 0], [.17, .08], [.15, .2], [.09, .26], [.0, .27]], st, 0, 0, 0, 24), cyl(.035, .035, .03, blk, 0, .27, 0, 10));
  const sp = cyl(.02, .04, .16, st, .18, .13, 0, 10); sp.rotation.z = -.75; add(g, sp);
  add(g, arc(.15, .018, Math.PI * .85, blk, 0, .26, 0).rotateZ(Math.PI * .075));
  return g;
}
export function build_pot(d) {
  const g = G(), c = M(d.color, { roughness: .35 }), dk = M('#2a2826', { roughness: .6 });
  add(g, lathe([[0, 0], [.17, 0], [.19, .06], [.19, .17], [.0, .17]], c, 0, 0, 0, 24), lathe([[0, 0], [.2, 0], [.2, .02], [.12, .06], [.0, .07]], c, 0, .16, 0, 24), sph(.03, dk, 0, .24, 0));
  [-1, 1].forEach(s => add(g, rbox(.08, .035, .05, .015, dk, s * .22, .13, 0)));
  add(g, torus(.19, .01, dk, 0, .165, 0).rotateX(Math.PI / 2));
  return g;
}
export function build_donabe(d) {
  const g = G(), c = MC(d.color, { roughness: .45 }), br = MC(d.color2, { roughness: .35 });
  add(g, lathe([[0, 0], [.14, 0], [.2, .06], [.2, .16], [.0, .16]], c, 0, 0, 0, 24), lathe([[0, 0], [.21, 0], [.22, .015], [.2, .035], [.09, .1], [.0, .11]], br, 0, .15, 0, 24), sph(.035, br, 0, .27, 0));
  [-1, 1].forEach(s => add(g, rbox(.08, .035, .05, .015, br, s * .24, .12, 0)));
  return g;
}
export function build_cuttingboard(d) {
  const g = G(), wd = MW(d.color);
  add(g, rbox(.62, .035, .4, .015, wd, 0, 0, 0), cyl(.025, .025, .04, M('#17120f'), .24, 0, 0, 10));
  g.children.at(-1).scale.set(1, 1, 1);
  add(g, rbox(.22, .03, .12, .01, M('#f0d9a8', { roughness: 1 }), -.1, .035, .02), sph(.045, M('#d9843a', { roughness: .8 }), .12, .08, -.06), box(.34, .012, .03, MS('#d0d4d6', .35), -.02, .036, .13), box(.16, .02, .035, M('#3a2a1e'), -.27, .036, .13));
  return g;
}
export function build_spicerack(d) {
  const g = G(), wd = MW(d.color);
  [-1, 1].forEach(s => add(g, box(.04, .5, .2, wd, s * .3, 0, 0)));
  [.02, .24, .46].forEach(y => add(g, box(.64, .03, .2, wd, 0, y, 0)));
  const cols = ['#d9534f', '#e8c94a', '#6aa860', '#c9a27a', '#f2877a', '#7fb8d8', '#e8dcc6', '#8a5a34'];
  cols.forEach((c, i) => { const x = -.22 + (i % 4) * .15, y = i < 4 ? .05 : .27; add(g, cyl(.045, .045, .13, MGLASS(0xdff3ff, .3), x, y, 0, 12), cyl(.04, .04, .09, M(c, { roughness: .95 }), x, y + .005, 0, 12), cyl(.047, .047, .03, M(d.color2, { roughness: .6 }), x, y + .13, 0, 12)); });
  return g;
}

// ----- 暮らしの小物 -----
export function build_tinbin(d) {
  const g = G(), st = MS(d.color, .55), dk = MS('#8c9498', .6);
  add(g, lathe([[0, 0], [.22, 0], [.26, .55], [.0, .55]], st, 0, 0, 0, 24));
  [.14, .34].forEach(y => add(g, torus(.235 + y * .1, .014, dk, 0, y, 0).rotateX(Math.PI / 2)));
  add(g, torus(.26, .02, dk, 0, .55, 0).rotateX(Math.PI / 2), lathe([[0, .03], [.27, 0], [.28, .03], [.0, .1]], st, 0, .55, 0, 24), sph(.03, dk, 0, .66, 0));
  [-1, 1].forEach(s => add(g, box(.05, .025, .04, dk, s * .265, .42, 0)));
  return g;
}
export function build_slippers(d) {
  const g = G(), so = M('#e8dcc6', { roughness: 1 }), up = MF(d.color, 'cloth');
  [-1, 1].forEach(s => { add(g, rbox(.17, .035, .38, .017, so, s * .13, 0, 0), puffy(.16, .08, .2, up, s * .13, .035, .08, { puff: .8 })); });
  return g;
}
export function build_broom(d) {
  const g = G(), wd = MW(d.color2), st = M(d.color, { roughness: 1 }), tw = M('#6a5a3a', { roughness: 1 }), h = d.h;
  const grp = new THREE.Group(); grp.rotation.z = .1; grp.position.set(-.1, 0, 0); g.add(grp);
  grp.add(cyl(.018, .018, h - .35, wd, 0, .35, 0, 8), cyl(.07, .07, .05, tw, 0, .36, 0, 10), cone(.075, .36, st, 0, 0, 0, 12).rotateX(Math.PI), cyl(.02, .02, .05, wd, 0, h - .03, 0, 6));
  grp.children[2].position.y = .18;
  for (let i = 0; i < 3; i++) grp.add(box(.17, .01, .02, M('#b09a6a', { roughness: 1 }), 0, .05 + i * .03, 0).rotateY(i * 1.05));
  return g;
}
export function build_candleglass(d) {
  const g = G(), gl = MGLASS(d.color, .3), wax = M(d.color2, { roughness: .5 });
  add(g, cyl(.1, .1, .02, M('#e8dcc6'), 0, 0, 0, 20), lathe([[.09, .02], [.1, .1], [.1, .26], [.092, .26], [.092, .1]], gl, 0, 0, 0, 20), cyl(.085, .085, .18, wax, 0, .03, 0, 18));
  const fl = sph(.025, MG('#ffcf7a', 3), 0, .27, 0, 1.8); add(g, fl, cyl(.003, .003, .03, M('#2a1a10'), 0, .21, 0, 5));
  add(g, halo(0xffb860, .5, 0, .28, 0, .55));
  g.userData.anim = t => { fl.scale.set(1 + .08 * Math.sin(t * 10), 1.8 + .25 * Math.sin(t * 8) + .06 * Math.sin(t * 23), 1); };
  lightAt(g, 0, .3, 0, 0xffb05a, 1.6, 3.2, true); return g;
}
export function build_anthurium(d) {
  const g = G(), pot = MC('#f3efe6', { roughness: .45 }), lf = M('#3f8a4a', { roughness: .55 }), rd = M(d.color, { roughness: .3 });
  add(g, lathe([[0, 0], [.1, 0], [.13, .06], [.13, .2], [.1, .21], [0, .19]], pot, 0, 0, 0, 20), cyl(.11, .11, .01, M('#3a2a1a'), 0, .2, 0, 14));
  for (let i = 0; i < 5; i++) { const a = i * 1.26, l = sph(.1, lf, Math.sin(a) * .1, .36 + (i % 2) * .04, Math.cos(a) * .1, .12); l.scale.set(1, 1.1, .1); l.rotation.set(-.3, a, 0); add(g, l, cyl(.008, .008, .2 + (i % 2) * .04, lf, Math.sin(a) * .05, .2, Math.cos(a) * .05, 5)); }
  [[-.07, .52], [.07, .58]].forEach(([x, y], i) => { add(g, cyl(.006, .006, y - .2, lf, x * .6, .2, 0, 5)); const s = sph(.06, rd, x, y, .03, 1); s.scale.set(1, 1.2, .18); s.rotation.z = i ? -.2 : .2; add(g, s, cone(.012, .1, M('#f4d65a', { roughness: .7 }), x + .01, y + .03, .06, 6)); });
  return g;
}
export function build_mossball(d) {
  const g = G(), mo = M(d.color, { roughness: 1 }), sa = MC(d.color2, { roughness: .5 });
  add(g, cyl(.16, .17, .03, sa, 0, 0, 0, 22), sph(.12, mo, 0, .13, 0, 1));
  for (let i = 0; i < 18; i++) { const a = i * 2.4, e = (i % 6) / 6 * 1.3 - .1; add(g, sph(.03 + (i % 3) * .008, M(i % 2 ? '#7aa84a' : '#5a8a3a', { roughness: 1 }), Math.cos(a) * Math.cos(e) * .11, .13 + Math.sin(e) * .11, Math.sin(a) * Math.cos(e) * .11)); }
  for (let i = 0; i < 4; i++) { const a = i * 1.6; add(g, cyl(.004, .004, .1, M('#4a8a3a'), Math.sin(a) * .04, .22, Math.cos(a) * .04, 4), sph(.02, M('#4a8a3a'), Math.sin(a) * .05, .32, Math.cos(a) * .05, .4)); }
  return g;
}
export function build_dryvase(d) {
  const g = G(), c = MC(d.color, { roughness: .6 }), st = M('#b8a070', { roughness: 1 });
  add(g, lathe([[0, 0], [.09, 0], [.12, .1], [.07, .22], [.04, .3], [.05, .34], [0, .33]], c, 0, 0, 0, 18));
  for (let i = 0; i < 9; i++) {
    const a = i * 2.3, sw = .1 + (i % 4) * .05, hh = .4 + (i % 5) * .08, s = cyl(.004, .004, hh, st, Math.sin(a) * .02, .3, Math.cos(a) * .02, 4);
    s.rotation.set(Math.cos(a) * sw, 0, -Math.sin(a) * sw); add(g, s);
    const tx = Math.sin(a) * (.02 + Math.sin(sw) * hh), tz = Math.cos(a) * (.02 + Math.sin(sw) * hh), ty = .3 + Math.cos(sw) * hh;
    add(g, sph(i % 3 ? .03 : .045, M(i % 3 === 0 ? '#f0e6d0' : i % 3 === 1 ? '#d9a560' : '#c9b080', { roughness: 1 }), tx, ty, tz, i % 3 ? 1.6 : 1.2));
  }
  return g;
}
export function build_bookend(d) {
  const g = G(), me = MS(d.color2, .5), cols = ['#c9593f', '#4f7aa8', '#e8c94a', '#6aa860', '#f0e6d0', '#8a5a34'];
  add(g, rbox(.64, .02, .22, .008, me, 0, 0, 0), box(.02, .26, .2, me, -.32, .02, 0), box(.02, .26, .2, me, .32, .02, 0));
  let x = -.29; cols.forEach((c, i) => { const w = .06 + (i % 3) * .02, h = .2 + (i % 2) * .05; if (i === 5) { const b = box(w, h, .16, M(c, { roughness: .8 }), x + w / 2 + .03, .02, 0); b.rotation.z = -.2; add(g, b); } else add(g, box(w, h, .16, M(c, { roughness: .8 }), x + w / 2, .02, 0)); x += w + .005; });
  return g;
}
export function build_blanket(d) {
  const g = G(); const t = texOf('plaid' + d.color + d.color2, 128, 128, (c, W) => { c.fillStyle = d.color; c.fillRect(0, 0, W, W); c.fillStyle = d.color2; c.globalAlpha = .6; for (let i = 0; i < 4; i++) { c.fillRect(i * 32 + 8, 0, 8, W); c.fillRect(0, i * 32 + 8, W, 8); } c.globalAlpha = 1; });
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: 1, color: 0xffffff });
  [0, 1, 2].forEach(i => add(g, puffy(.62 - i * .03, .07, .46, m, i % 2 ? .01 : -.01, i * .065, 0, { puff: .5, seed: i }).rotateY(i * .06)));
  add(g, puffy(.1, .02, .4, M('#f0e6d0', { roughness: 1 }), .25, .2, 0, { puff: .3 }));
  return g;
}
export function build_storagebasket(d) {
  const g = G(), wv = M(d.color, { roughness: 1 }), wv2 = M(d.color2, { roughness: 1 });
  add(g, lathe([[0, 0], [.28, 0], [.33, .42], [.0, .42]], wv, 0, 0, 0, 24));
  for (let i = 0; i < 7; i++) add(g, torus(.285 + i * .007, .011, i % 2 ? wv2 : wv, 0, .03 + i * .058, 0).rotateX(Math.PI / 2));
  add(g, lathe([[0, 0], [.34, 0], [.34, .035], [.0, .06]], wv2, 0, .42, 0, 24), cyl(.34, .34, .03, wv2, 0, .42, 0, 24), sph(.04, MW('#8a5a34'), 0, .5, 0, .7));
  add(g, puffy(.4, .12, .12, MF('#f0e6d0', 'cloth'), 0, .46, .14, { puff: .9 }).rotateZ(.05));
  return g;
}
export function build_bookstand(d) {
  const g = G(), wd = MW(d.color), pg = M('#fffaf0', { roughness: .9 });
  add(g, rbox(.5, .03, .28, .01, wd, 0, 0, 0));
  const tilt = new THREE.Group(); tilt.position.set(0, .03, -.02); tilt.rotation.x = -.45; g.add(tilt);
  tilt.add(rbox(.5, .22, .02, .008, wd, 0, 0, -.01), rbox(.48, .03, .06, .01, wd, 0, 0, .03));
  tilt.add(box(.22, .2, .008, pg, -.12, .04, .005), box(.22, .2, .008, pg, .12, .04, .005), box(.012, .2, .014, M('#c9593f'), 0, .04, .004));
  for (let i = 0; i < 5; i++) { tilt.add(box(.18, .004, .006, M('#8a7a6a'), -.12, .12 + i * .02 - .06, .011), box(.18, .004, .006, M('#8a7a6a'), .12, .12 + i * .02 - .06, .011)); }
  return g;
}
export function build_deskmat(d) {
  const g = G(), mat = M(d.color, { roughness: .9 });
  add(g, rbox(.94, .02, .62, .008, mat, 0, 0, 0), box(.28, .005, .2, M(d.color2, { roughness: .95 }), .3, .02, .05));
  add(g, cyl(.008, .008, .3, M('#f2c14e'), -.2, .022, .1, 6).rotateZ(Math.PI / 2 + .3));
  g.children.at(-1).rotation.set(Math.PI / 2, 0, .4); g.children.at(-1).position.set(-.2, .03, .1);
  return g;
}
export function build_timer(d) {
  const g = G(), c = M(d.color, { roughness: .35 });
  const t = texOf('timerface', 128, 64, (cx, W, H) => { cx.fillStyle = '#16201a'; cx.fillRect(0, 0, W, H); cx.fillStyle = '#9dffb0'; cx.font = 'bold 44px monospace'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText('25:00', W / 2, H / 2 + 2); });
  add(g, rbox(.28, .24, .24, .05, c, 0, 0, 0));
  const f = new THREE.Mesh(new THREE.PlaneGeometry(.2, .1), new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: .9, roughness: .5 })); f.position.set(0, .15, .126); g.add(f);
  [-1, 0, 1].forEach(s => add(g, cyl(.022, .022, .02, M(d.color2, { roughness: .5 }), s * .07, .04, .125, 12).rotateX(Math.PI / 2)));
  return g;
}
export function build_lantern(d) {
  const g = G(), me = M(d.color, { roughness: .5, metalness: .55 }), gl = MGLASS(0xfff0d0, .25);
  add(g, cyl(.12, .13, .03, me, 0, 0, 0, 12), cyl(.1, .1, .2, gl, 0, .03, 0, 12), cyl(.11, .1, .04, me, 0, .23, 0, 12), cone(.12, .07, me, 0, .27, 0, 12));
  [0, 1, 2, 3].forEach(i => { const a = i * Math.PI / 2 + .78; add(g, cyl(.007, .007, .2, me, Math.sin(a) * .1, .03, Math.cos(a) * .1, 5)); });
  add(g, arc(.09, .009, Math.PI, me, 0, .33, 0));
  const fl = sph(.026, MG('#ffcf7a', 3), 0, .13, 0, 1.8); add(g, fl, cyl(.04, .04, .1, M('#f6efe0', { roughness: .6 }), 0, .03, 0, 12), halo(0xffb860, .6, 0, .16, 0, .5));
  g.userData.anim = t => { fl.scale.set(1 + .08 * Math.sin(t * 10), 1.8 + .25 * Math.sin(t * 8), 1); };
  lightAt(g, 0, .16, 0, 0xffb05a, 1.8, 3.4, true); return g;
}
export function build_macrame(d) {
  const g = G(), WH = 3.4, rope = M(d.color, { roughness: 1 }), pot = MC(d.color2, { roughness: .5 }), lf = M('#4da855', { roughness: .8 });
  add(g, cyl(.05, .05, .03, M('#2a2a2a'), 0, WH - .03, 0, 10));
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + .3; const r = cyl(.007, .007, 1.0, rope, Math.sin(a) * .09, 2.05, Math.cos(a) * .09, 4); r.rotation.set(Math.cos(a) * .12, 0, -Math.sin(a) * .12); add(g, r); }
  add(g, lathe([[0, 0], [.1, 0], [.14, .06], [.15, .16], [.0, .16]], pot, 0, 1.9, 0, 18), sph(.12, lf, 0, 2.1, 0, .6));
  for (let i = 0; i < 6; i++) { const a = i * 1.05, L = .3 + (i % 3) * .2; add(g, cyl(.006, .006, L, lf, Math.sin(a) * .15, 1.9 - L + .05, Math.cos(a) * .15, 4)); for (let k = 0; k < 4; k++) add(g, sph(.04, lf, Math.sin(a) * .15, 1.9 - k * L / 4 - .02, Math.cos(a) * .15, .5)); }
  return g;
}
