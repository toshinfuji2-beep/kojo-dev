// 第4弾：ナチュラルな壁かけ（原点=左下、+z が部屋側）。オリジナル造形
import { THREE, M, MW, MF, MM, MS, G, box, rbox, cyl, sph, lathe, add, torus, plane } from './mk.js?v=202611131634';
import { puffy } from './soft.js?v=202611131634';
import { texOf } from './textures.js?v=202611131634';

export function art_wallcab(d) {
  const g = G(), w = d.w, h = d.h, car = MW(d.color), door = M(d.color2, { roughness: .6 }), st = MS('#c9ced1', .4);
  add(g, rbox(w, h, .46, .02, car, w / 2, 0, .23));
  [0, 1].forEach(i => { add(g, rbox(w / 2 - .04, h - .08, .03, .015, door, w / 4 + i * w / 2, .04, .47), box(.025, .2, .03, st, i ? w / 2 + .1 : w / 2 - .1, h * .35, .5)); });
  add(g, box(w - .04, .02, .02, M('#9a948a', { roughness: 1 }), w / 2, .01, .49));
  return g;
}
export function art_hathook(d) {
  const g = G(), w = d.w, wd = MW(d.color), peg = MW(d.color2), straw = M('#e0c27a', { roughness: 1 });
  add(g, rbox(w, .16, .035, .015, wd, w / 2, .02, .018));
  [.2, .4, .6].forEach(x => add(g, cyl(.016, .016, .1, peg, x, 0, 0, 8).rotateX(Math.PI / 2), sph(.026, peg, x, .1, .1)));
  g.children.slice(-6).forEach((m, i) => { if (i % 2 === 0) m.position.set(.2 + i / 2 * .2, .1, .08); });
  const hat = new THREE.Group(); hat.position.set(.4, -.2, .18); hat.rotation.x = -.18; g.add(hat);
  hat.add(lathe([[0, 0], [.3, -.02], [.34, 0], [.3, .04], [.08, .07], [.0, .07]], straw, 0, 0, 0, 28), lathe([[.09, .06], [.1, .15], [.09, .2], [.0, .2]], straw, 0, 0, 0, 20), lathe([[.1, .06], [.1, .075], [.093, .075], [.093, .06]], M(d.color2, { roughness: .7 }), 0, .02, 0, 20));
  hat.rotation.x = Math.PI / 2 - .12; hat.position.set(.4, .02, .13);
  const hr = cyl(.01, .01, .04, M('#d9534f'), 0, 0, 0, 6); hat.add(hr);
  hat.position.y = -.12;
  return g;
}
export function art_towelbar(d) {
  const g = G(), w = d.w, st = MS('#c9ced1', .4), tw = MF(d.color, 'cloth'), tw2 = MF(d.color2, 'cloth');
  [.08, w - .08].forEach(x => add(g, box(.03, .03, .1, st, x, d.h - .12, .05)));
  add(g, cyl(.012, .012, w - .1, st, w / 2, d.h - .12 - (w - .1) / 2 + (w - .1) / 2 - 0, .1, 8).rotateZ(Math.PI / 2));
  g.children.at(-1).position.set(w / 2, d.h - .105, .1);
  add(g, puffy(.4, .62, .03, tw, w * .35, d.h - .74, .13, { puff: .3, wr: .004 }), puffy(.3, .4, .03, tw2, w * .72, d.h - .52, .14, { puff: .3, wr: .004 }));
  add(g, box(.4, .03, .032, M('#d9534f', { roughness: 1 }), w * .35, d.h - .45, .13));
  return g;
}
export function art_wreath(d) {
  const g = G(), w = d.w, c = w / 2, lf = M(d.color, { roughness: .8 }), lf2 = M('#6a9a5a', { roughness: .8 }), rb = M(d.color2, { roughness: .6 });
  add(g, torus(w * .36, .02, M('#6a5a3a', { roughness: 1 }), c, c, .06));
  for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2, r = w * .36 + (i % 2 ? .03 : -.03), l = sph(.05, i % 3 ? lf : lf2, c + Math.cos(a) * r, c + Math.sin(a) * r, .08 + (i % 3) * .01, 1); l.scale.set(1.5, .55, .35); l.rotation.z = a + Math.PI / 2 + (i % 2 ? .5 : -.5); add(g, l); }
  [0, 1, 2, 3, 4].forEach(i => { const a = i * 1.3 + .4; add(g, sph(.025, M('#f2f0e8', { roughness: .8 }), c + Math.cos(a) * w * .36, c + Math.sin(a) * w * .36, .13)); });
  add(g, sph(.045, rb, c + .02, c - w * .36, .12, .8), box(.05, .16, .02, rb, c - .05, c - w * .36 - .14, .1).rotateZ(.2), box(.05, .16, .02, rb, c + .08, c - w * .36 - .14, .1).rotateZ(-.2));
  return g;
}
export function art_menuboard(d) {
  const g = G(), w = d.w, h = d.h, fr = MW(d.color2);
  const t = texOf('menuboard', 300, 360, (c, W, H) => {
    c.fillStyle = '#2f3b36'; c.fillRect(0, 0, W, H); for (let i = 0; i < 120; i++) { c.fillStyle = 'rgba(255,255,255,' + (Math.sin(i * 7.3) * .02 + .03) + ')'; c.fillRect((i * 53) % W, (i * 97) % H, 30 + i % 40, 2); }
    c.fillStyle = '#f6f1e6'; c.textAlign = 'center'; c.font = 'bold 40px sans-serif'; c.fillText('きょうのごはん', W / 2, 62);
    c.font = '30px sans-serif'; c.textAlign = 'left'; ['・チョコケーキ', '・やきたてパン', '・ハーブティー'].forEach((s, i) => c.fillText(s, 40, 130 + i * 52));
    c.strokeStyle = '#f6f1e6'; c.lineWidth = 3; c.beginPath(); c.moveTo(40, 84); c.lineTo(W - 40, 84); c.stroke(); c.fillStyle = '#f2c14e'; c.beginPath(); c.arc(W / 2, 300, 24, 0, 7); c.fill(); c.fillStyle = '#e07a5f'; c.fillRect(W / 2 - 12, 290, 24, 20);
  });
  add(g, rbox(w, h, .05, .02, fr, w / 2, 0, .025));
  const p = plane(w - .12, h - .12, M('#fff', { map: t, roughness: .95 }), w / 2, h / 2, .054); p.castShadow = false; g.add(p);
  add(g, box(w - .16, .025, .04, MW(d.color), w / 2, .06, .07));
  return g;
}
