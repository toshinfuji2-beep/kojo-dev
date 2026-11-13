// 家具ビルダー（すべてオリジナル造形）。build_<shape>(def) -> Group（足元中心、正面 +z）
import { THREE, M, MW, MF, MG, MM, MGLASS, MT, brickMat, G, box, rbox, cyl, sph, cone, lathe, add, lightAt, torus } from './mk.js?v=202611131634';
import { artTex } from './textures.js?v=202611131634';
import { puffy, book } from './soft.js?v=202611131634';

const WOOD = '#a9774d';
export function build_bed(d) {
  const g = G(), w = d.w, L = d.d, wood = MW('#7a4a2a'), sheet = MF(d.color2, 'cloth'), blanket = MF(d.color, 'cloth');
  add(g, box(w, .28, L, wood, 0, .08, 0), box(.1, .08, .1, wood, -w / 2 + .05, 0, -L / 2 + .05), box(.1, .08, .1, wood, w / 2 - .05, 0, -L / 2 + .05), box(.1, .08, .1, wood, -w / 2 + .05, 0, L / 2 - .05), box(.1, .08, .1, wood, w / 2 - .05, 0, L / 2 - .05));
  add(g, rbox(w - .1, .22, L - .16, .08, sheet, 0, .36, .02));
  add(g, puffy(w - .04, .12, L * .64, blanket, 0, .5, L * .16, { puff: .55, pinch: .5, wr: .022, drape: .1, seed: 2, round: 1.6, sy: 6 }));
  const np = w > 1.4 ? 2 : 1, pw = (w - .2) / np;
  for (let i = 0; i < np; i++) add(g, puffy(pw - .06, .13, .4, MF('#fffaf0', 'cloth'), -w / 2 + .1 + pw * (i + .5), .55, -L / 2 + .36, { puff: .9, pinch: .8, wr: .012, seed: 5 + i, round: 3 }));
  add(g, box(w, .8, .1, wood, 0, .08, -L / 2 + .04), box(w + .04, .06, .14, MW('#5a3219'), 0, .86, -L / 2 + .04), box(w, .38, .08, wood, 0, .08, L / 2 - .04));
  return g;
}
export function build_sofa(d) {
  const g = G(), w = d.w, L = d.d, lea = MF(d.color, 'leather'), lea2 = MF(d.color2, 'leather'), arm = .26, h = d.h;
  const seats = Math.max(1, Math.round(w / .95)), sw = (w - arm * 2) / seats;
  add(g, rbox(w, .3, L, .06, lea, 0, .1, 0));
  for (let i = 0; i < seats; i++) { add(g, puffy(sw - .03, .15, L * .7, lea2, -w / 2 + arm + sw * (i + .5), .4, L * .14, { puff: .45, pinch: .45, wr: .008, seed: i, round: 2 })); const bc = puffy(sw - .06, .2, .17, lea2, -w / 2 + arm + sw * (i + .5), .62, -L / 2 + .33, { puff: .7, pinch: .6, wr: .008, seed: i + 7, round: 2 }); bc.rotation.x = -1.25; bc.position.y = .6; add(g, bc); }
  add(g, rbox(w - .1, h - .38, .26, .1, lea, 0, .36, -L / 2 + .15));
  for (let i = 0; i < seats; i++) for (let k = 0; k < 2; k++) for (let j = 0; j < 3; j++) add(g, sph(.022, MM(0x8a6a3a, .4), -w / 2 + arm + sw * (i + .5) + (j - 1) * sw * .27, .62 + k * .16, -L / 2 + .295));
  [-1, 1].forEach(s => add(g, rbox(arm, .5, L, .1, lea, s * (w / 2 - arm / 2), .12, 0)));
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => add(g, cyl(.04, .03, .12, MW('#3a2312'), a * (w / 2 - .12), 0, b * (L / 2 - .1), 10)));
  return g;
}
export function build_spindle(d) {
  const g = G(), wood = MW(d.color2 || '#7a4a2a'), s = .27;
  add(g, cyl(.3, .3, .06, MW(d.color), 0, .5, 0, 24));
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => { const l = cyl(.032, .022, .52, wood, a * s * .72, 0, b * s * .72, 8); l.rotation.z = -a * .05; l.rotation.x = b * .05; add(g, l); });
  [-1, 1].forEach(a => add(g, cyl(.03, .03, .5, wood, a * .22, .52, -.2, 8)));
  for (let i = -2; i <= 2; i++) add(g, cyl(.014, .014, .34, wood, i * .085, .64, -.21, 6));
  add(g, box(.5, .08, .045, wood, 0, .96, -.21), box(.46, .035, .04, wood, 0, .62, -.21));
  return g;
}
export function build_desk(d) {
  const g = G(), w = d.w, L = d.d, h = d.h, top = MW(d.color), dark = MW(d.color2);
  add(g, box(w, .08, L, top, 0, h - .08, 0), box(w - .04, .03, L - .04, dark, 0, h - .115, 0));
  add(g, box(.06, h - .1, L - .1, dark, -w / 2 + .07, 0, 0));
  const dw = Math.min(.8, w * .4); add(g, box(dw, h - .1, L - .1, dark, w / 2 - dw / 2 - .02, 0, 0));
  for (let i = 0; i < 3; i++) { const y = .1 + i * (h - .3) / 3; add(g, box(dw - .08, (h - .3) / 3 - .05, .03, top, w / 2 - dw / 2 - .02, y, L / 2 - .045), sph(.025, MM(0xd4a84a), w / 2 - dw / 2 - .02, y + (h - .3) / 6 - .025, L / 2 - .01)); }
  add(g, box(w - dw - .1, .06, .03, dark, -(dw / 2) + .02, .5, -L / 2 + .06));
  return g;
}
export function build_shelf(d) {
  const g = G(), w = d.w, L = d.d, h = d.h, wood = MW(d.color), rn = (a) => { let s = a; return () => (s = (s * 9301 + 49297) % 233280) / 233280; }, r = rn(w * 7 + 3);
  const cols = ['#b5483a', '#3f6e8c', '#d9a53c', '#4f7a4a', '#7a5a8c', '#c9bda4', '#8a4a2a', '#2f4f6a', '#a63d52', '#2e6b62'];
  add(g, box(.07, h, L, wood, -w / 2 + .035, 0, 0), box(.07, h, L, wood, w / 2 - .035, 0, 0), box(w, h, .03, MW('#5a3a1e'), 0, 0, -L / 2 + .015), box(w + .06, .06, L + .04, wood, 0, h, 0), box(w, .1, L, wood, 0, 0, 0));
  const n = Math.round(h / .5), gap = (h - .1) / n;
  for (let s = 0; s < n; s++) {
    const y = .1 + s * gap; if (s) add(g, box(w - .12, .035, L - .06, wood, 0, y, .01));
    let x = -w / 2 + .1; while (x < w / 2 - .14) { const bw = .06 + r() * .06, bh = (gap - .1) * (.62 + r() * .38); if (x + bw > w / 2 - .08) break; if (r() < .1) { x += .12; continue; } { const bk = book(bw, bh, L * .7, cols[(r() * cols.length) | 0], (r() * 3) | 0, x + bw / 2, y + .035, -.02); if (r() < .12) { bk.rotation.z = (r() - .5) * .22; } add(g, bk); } x += bw + .004; }
  }
  return g;
}
export function build_drawers(d) {
  const g = G(), h = d.h, w = d.w, L = d.d, wood = MW(d.color), dk = MW(d.color2);
  add(g, box(w, h - .12, L, dk, 0, .1, 0), box(w + .06, .05, L + .05, wood, 0, h - .05, 0), box(w, .1, L, wood, 0, .02, 0));
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => add(g, cyl(.05, .035, .08, wood, a * (w / 2 - .08), 0, b * (L / 2 - .08), 8)));
  const n = 3, dh = (h - .3) / n;
  for (let i = 0; i < n; i++) { const y = .14 + i * dh; add(g, box(w - .12, dh - .05, .03, wood, 0, y, L / 2 - .005), box(w - .2, dh - .13, .01, dk, 0, y + .04, L / 2 + .012)); [-1, 1].forEach(s => add(g, sph(.035, MM(0xc9a24a), s * w * .2, y + dh / 2 - .025, L / 2 + .04))); }
  return g;
}
export function build_kotatsu(d) {
  const g = G(), w = d.w, L = d.d, top = MW(d.color2);
  add(g, box(w, .06, L, top, 0, d.h - .06, 0));
  add(g, rbox(w + .3, .1, L + .3, .05, MF(d.color, 'cloth'), 0, d.h - .15, 0), rbox(w + .34, .32, L + .34, .12, MF(d.color, 'cloth'), 0, .08, 0));
  add(g, rbox(w - .08, .03, L - .08, .02, MG(0xffb870, .5), 0, .02, 0));
  return g;
}
export function build_table(d) {
  const g = G(), w = d.w, L = d.d, h = d.h, wood = MW(d.color), dk = MW(d.color2), t = h > .7 ? .09 : .07, lr = h > .7 ? .06 : .05;
  add(g, rbox(w, t, L, .02, wood, 0, h - t, 0), box(w - .24, .09, L - .24, dk, 0, h - t - .09, 0));
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => { const x = a * (w / 2 - .14), z = b * (L / 2 - .14); add(g, lathe([[lr, 0], [lr * .8, .02], [lr * .6, h * .45], [lr * .9, h * .5], [lr * .62, h * .55], [lr, h - t - .01]], dk, x, 0, z, 12)); });
  if (h < .7) add(g, box(w - .5, .03, L - .4, dk, 0, h * .3, 0));
  return g;
}
export function build_board(d) {
  const g = G(), w = d.w, fr = MM(0xb8c0c6, .4);
  add(g, box(w, 1.0, .06, M('#fbfbf8', { roughness: .25 }), 0, .85, 0), box(w + .08, .05, .08, fr, 0, 1.85, 0), box(w + .08, .05, .08, fr, 0, .83, 0), box(.05, 1.07, .08, fr, -w / 2 - .02, .8, 0), box(.05, 1.07, .08, fr, w / 2 + .02, .8, 0));
  add(g, box(w * .7, .04, .1, fr, 0, .8, .06), box(.06, .85, .06, fr, -w / 2 + .15, 0, 0), box(.06, .85, .06, fr, w / 2 - .15, 0, 0), box(.1, .05, .5, fr, -w / 2 + .15, 0, 0), box(.1, .05, .5, fr, w / 2 - .15, 0, 0));
  add(g, box(w * .3, .02, .01, M('#3f6ee0'), -w * .15, 1.4, .035), box(w * .2, .02, .01, M('#d84a3a'), -w * .2, 1.25, .035), box(w * .35, .02, .01, M('#2a2a2a'), w * .1, 1.1, .035));
  return g;
}
export function build_piano(d) {
  const g = G(), w = d.w, blk = M('#1c1a1f', { roughness: .25, metalness: .1 });
  add(g, box(w, 1.25, .62, blk, 0, .12, -.15), box(w + .06, .06, .7, blk, 0, 1.37, -.15), box(w - .2, .08, .35, blk, 0, 1.0, .25), box(.1, .12, .62, blk, -w / 2 + .1, 0, -.1), box(.1, .12, .62, blk, w / 2 - .1, 0, -.1));
  add(g, box(w - .2, .05, .32, M('#fbf8ee'), 0, .98, .26));
  for (let i = 0; i < 14; i++) add(g, box(.04, .06, .18, M('#111'), -w / 2 + .3 + i * (w - .6) / 13 * .98, 1.02, .2));
  add(g, box(.5, .4, .02, M('#2a2830'), 0, .95, -.3, 0), cyl(.04, .04, .22, MM(0xc9a24a), 0, .05, .3, 10));
  return g;
}
export function build_cabinet(d) {
  const g = G(), w = d.w, h = d.h, wood = MW(d.color), dk = MW(d.color2);
  add(g, box(w, .85, .6, wood, 0, .1, 0), box(w + .08, .06, .66, dk, 0, .95, .02), box(w, .1, .6, dk, 0, 0, 0));
  [0, 1].forEach(i => add(g, box(w / 2 - .06, .6, .03, dk, -w / 4 + i * w / 2, .22, .31), sph(.03, MM(0xc9a24a), -w / 4 + .12 + i * (w / 2 - .24), .55, .34)));
  const uh = h - 1.01, up = 1.01;
  add(g, box(.06, uh, .4, wood, -w / 2 + .03, up, -.08), box(.06, uh, .4, wood, w / 2 - .03, up, -.08), box(w, uh, .03, MW('#6a4326'), 0, up, -.27), box(w + .06, .1, .46, dk, 0, h - .1, -.06), box(w - .1, .04, .4, wood, 0, up, -.08));
  const plates = ['#f3efe6', '#7aa0c8', '#f3efe6', '#d9a58a', '#f3efe6', '#7aa0c8'];
  for (let s = 0; s < 3; s++) {
    const y = up + .03 + s * (uh - .1) / 3; if (s) add(g, box(w - .1, .03, .38, wood, 0, y, -.08));
    const nn = Math.max(3, Math.round(w / .32));
    for (let i = 0; i < nn; i++) { const p = cyl(.13, .13, .02, M(plates[(i + s) % 6], { roughness: .3 }), -w / 2 + .26 + i * (w - .52) / (nn - 1), y + .17, -.15, 20); p.rotation.x = Math.PI / 2 - .12; add(g, p); if (s === 0 && i % 2 === 0) add(g, cyl(.08, .08, .02, M('#c9a24a', { metalness: .5, roughness: .4 }), -w / 2 + .26 + i * (w - .52) / (nn - 1), y + .17, -.14, 16)).children.at(-1).rotation.x = Math.PI / 2 - .12; }
  }
  add(g, box(w - .1, uh - .1, .02, MGLASS(), 0, up + .04, .13));
  return g;
}
export function build_fireplace(d) {
  const g = G(), w = d.w, h = d.h, br = brickMat(w / 1.5, h / 2.4), hearth = M('#6a625a', { roughness: .8 });
  add(g, box(w + .3, .12, .95, hearth, 0, 0, .0));
  add(g, box(.6, 1.35, .62, br, -w / 2 + .3, .12, -.13), box(.6, 1.35, .62, br, w / 2 - .3, .12, -.13), box(w, .32, .62, br, 0, 1.47, -.13));
  add(g, box(w - .1, .18, .16, MW('#5a3219'), 0, 1.79, .26), box(w + .2, .09, .78, MW('#7a4a2a'), 0, 1.79, .0));
  add(g, box(w * .66, h - 1.88, .5, br, 0, 1.88, -.2), box(w - 1.2, 1.35, .4, M('#16100c'), 0, .12, -.2));
  add(g, box(w - 1.15, .08, .45, M('#2b241e'), 0, .12, -.16));
  const wood = MW('#6a4326'); [-.22, 0, .22].forEach((x, i) => { const l = cyl(.08, .08, .6, wood, x, .24 + (i === 1 ? .12 : 0), -.1 + (i - 1) * .04, 10); l.rotation.z = Math.PI / 2; l.rotation.y = .3 * (i - 1); add(g, l); });
  const flames = [], cols = [0xff7a1a, 0xffa530, 0xffd24a];
  [[-.18, .45], [.12, .52], [0, .6]].forEach(([x, hh], i) => { const f = cone(.13 - i * .02, hh, MG(cols[i], 2.2), x, .38, -.1, 10); f.castShadow = false; flames.push(f); g.add(f); });
  g.userData.anim = t => flames.forEach((f, i) => { f.scale.set(1 + .12 * Math.sin(t * 11 + i * 2), 1 + .22 * Math.sin(t * 8 + i * 1.7) + .06 * Math.sin(t * 21), 1 + .1 * Math.sin(t * 13 + i)); f.rotation.z = .08 * Math.sin(t * 6 + i); });
  g.userData.live = true;
  lightAt(g, 0, .75, .15, 0xff8a3a, 14, 9, true);
  return g;
}
function tvUnit(w, base) {
  const g = G(); const scr = artTex('tv', { id: 'tv' }, 256, 144);
  add(g, rbox(w * .86, w * .5, .08, .02, M('#1d1d22', { roughness: .35 }), 0, base + .06, 0), rbox(w * .86 - .1, w * .5 - .1, .01, .01, M('#222', { map: scr, emissiveMap: scr, emissive: 0xffffff, emissiveIntensity: .75, roughness: .2 }), 0, base + .11, .045));
  add(g, box(.5, .05, .24, M('#1d1d22'), 0, base, 0));
  return g;
}
export function build_tvboard(d) {
  const g = G(), w = d.w, wood = MW(d.color), dk = MW(d.color2), h = .56;
  add(g, box(w, h - .1, .6, wood, 0, .1, 0), box(w + .04, .06, .64, dk, 0, h - .06, 0), box(w - .06, .08, .56, dk, 0, .02, 0));
  [0, 1].forEach(i => add(g, box(w / 2 - .1, h - .26, .03, dk, -w / 4 + i * w / 2, .16, .31), sph(.025, MM(0xc9a24a), -w / 4 + (i ? -1 : 1) * .1 + i * w / 2, h * .55, .34)));
  const tv = tvUnit(w, h); tv.position.z = -.05; g.add(tv); return g;
}
export function build_tv(d) {
  const g = G(), w = d.w; add(g, cyl(.14, .22, .06, M('#2a2a30'), 0, 0, 0, 16), box(.12, .22, .1, M('#2a2a30'), 0, .05, -.02)); const tv = tvUnit(w, .24); g.add(tv); return g;
}
export function build_fridge(d) {
  const g = G(), c = M(d.color, { roughness: .3 });
  add(g, rbox(.84, 1.95, .8, .12, c, 0, .05, 0), rbox(.8, .02, .02, .01, M('#6a7a82'), 0, 1.15, .4), box(.04, .5, .05, MM(0xdddddd), -.3, 1.3, .44), box(.04, .35, .05, MM(0xdddddd), -.3, .62, .44), box(.7, .06, .5, M('#555'), 0, 0, 0));
  return g;
}
export function build_fan(d) {
  const g = G(), c = M(d.color), w = M(d.color2); add(g, cyl(.22, .26, .06, c, 0, 0, 0, 20), cyl(.03, .03, .85, MM(0xaaaaaa), 0, .06, 0, 8), cyl(.28, .28, .14, c, 0, 1.0, 0, 20));
  const fan = G(); for (let i = 0; i < 3; i++) { const b = sph(.16, w, 0, .12, 0); b.scale.set(.35, 1, .1); b.rotation.z = i * 2.09; b.position.set(Math.sin(i * 2.09) * -.12, .12 + Math.cos(i * 2.09) * .12, 0); fan.add(b); } fan.position.set(0, 1.0, .1); g.add(fan);
  add(g, torus(.3, .012, MM(0xcccccc), 0, 1.12, .1)); return g;
}
export function build_record(d) {
  const g = G(), wood = MW('#7a4a2a'), rec = artTex('record', { id: 'rec' }, 128, 128);
  add(g, rbox(.8, .16, .62, .03, wood, 0, .02, 0), box(.84, .02, .66, MW('#3a2312'), 0, .18, 0), cyl(.25, .25, .02, MM(0x777777), -.08, .2, .02, 24), cyl(.23, .23, .012, MT(rec), -.08, .22, .02, 28), cyl(.02, .02, .05, MM(0xcccccc), -.08, .22, .02, 8));
  add(g, cyl(.035, .035, .04, MM(0xc9a24a), .28, .2, -.2, 12));
  const arm = box(.015, .015, .34, MM(0xc9a24a), .28, .24, -.04); arm.rotation.y = .3; add(g, arm);
  for (let i = 0; i < 3; i++) add(g, sph(.018, M('#d9c8a0'), .1 + i * .08, .205, .27));
  return g;
}
