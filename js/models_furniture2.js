// 追加の家具・家電（オリジナル造形）。build_<shape>(def) -> Group（足元中心、正面 +z）
import { THREE, M, MW, MF, MG, MM, MGLASS, MT, G, box, rbox, cyl, sph, cone, lathe, add, lightAt, torus } from './mk.js?v=202611131634';
import { texOf } from './textures.js?v=202611131634';
import { puffy } from './soft.js?v=202611131634';

const legs4 = (g, w, L, h, mat, inset, r) => [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => add(g, cyl(r || .035, (r || .035) * .8, h, mat, a * (w / 2 - inset), 0, b * (L / 2 - inset), 10)));
const gold = () => MM(0xc9a24a, .35);

function mattress(g, w, L, y, c1, c2, z0) {
  add(g, rbox(w - .1, .16, L - .12, .07, MF(c2, 'cloth'), 0, y, z0 || 0));
  add(g, puffy(w - .14, .1, L * .62, MF(c1, 'cloth'), 0, y + .12, (z0 || 0) + L * .14, { puff: .55, pinch: .5, wr: .02, seed: 3, round: 1.6, sy: 6 }));
  add(g, puffy(w - .3, .1, .3, MF('#fffaf0', 'cloth'), 0, y + .14, (z0 || 0) - L / 2 + .26, { puff: .9, pinch: .8, wr: .01, seed: 5, round: 3 }));
}
export function build_bunk(d) {
  const g = G(), w = d.w, L = d.d, wood = MW(d.color2), lt = MW(d.color);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => add(g, box(.08, 1.85, .08, wood, a * (w / 2 - .05), 0, b * (L / 2 - .05))));
  [.22, 1.02].forEach((y, i) => { add(g, box(w - .02, .07, L - .02, lt, 0, y, 0)); mattress(g, w, L, y + .07, d.color, d.color2 === '#fff3e0' ? '#fff3e0' : '#fff6e8'); });
  [-1, 1].forEach(s => add(g, box(.04, .3, L - .2, lt, s * (w / 2 - .04), 1.2, 0)));
  add(g, box(w, .3, .04, lt, 0, 1.2, -L / 2 + .04));
  add(g, box(w, .25, .04, lt, 0, .35, -L / 2 + .04));
  [-1, 1].forEach(s => add(g, box(.045, 1.0, .045, wood, s * .17 + w / 2 - .22, .1, L / 2 + .02)));
  for (let i = 0; i < 6; i++) add(g, box(.3, .04, .05, wood, w / 2 - .22, .25 + i * .16, L / 2 + .02));
  return g;
}
export function build_loft(d) {
  const g = G(), w = d.w, L = d.d, wood = MW(d.color2), lt = MW(d.color);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => add(g, box(.09, 1.95, .09, wood, a * (w / 2 - .05), 0, b * (L / 2 - .05))));
  add(g, box(w, .07, L, lt, 0, 1.2, 0)); mattress(g, w, L, 1.27, d.color, '#fff6e8');
  [-1, 1].forEach(s => add(g, box(.04, .32, L - .3, lt, s * (w / 2 - .04), 1.34, 0)));
  add(g, box(w, .32, .04, lt, 0, 1.34, -L / 2 + .04));
  // 下に小さな机
  add(g, box(w - .2, .06, .5, lt, 0, .74, -L / 2 + .3), box(.06, .74, .5, wood, -w / 2 + .2, 0, -L / 2 + .3), box(.06, .74, .5, wood, w / 2 - .2, 0, -L / 2 + .3));
  add(g, rbox(.4, .1, .14, .03, M('#6aa6d6'), 0, .8, -L / 2 + .3), sph(.07, MG(0xfff0b0, 1.5), w / 2 - .4, .86, -L / 2 + .25));
  add(g, cyl(.15, .15, .05, MF('#f08a7e', 'cloth'), 0, .4, .1, 18), cyl(.03, .03, .4, wood, 0, 0, .1, 8));
  for (let i = 0; i < 7; i++) add(g, box(.3, .04, .05, wood, w / 2 - .02 - .0, .2 + i * .15, L / 2 + .02));
  [-1, 1].forEach(s => add(g, box(.05, 1.3, .05, wood, s * .17 + w / 2 - .3 + .1, .1, L / 2 + .02)));
  return g;
}
export function build_armchair(d) {
  const g = G(), c = MF(d.color, 'cloth'), c2 = MF(d.color2, 'cloth'), wd = MW('#7a4a2a');
  add(g, rbox(.84, .26, .8, .1, c, 0, .14, 0), puffy(.6, .16, .6, c2, 0, .38, .08, { puff: .6, pinch: .5, wr: .01, seed: 4, round: 2 }));
  add(g, rbox(.8, .6, .2, .1, c, 0, .3, -.32), puffy(.56, .38, .12, c2, 0, .5, -.2, { puff: .7, pinch: .6, wr: .01, seed: 6, round: 2 }));
  [-1, 1].forEach(s => add(g, rbox(.14, .38, .78, .07, c, s * .35, .14, 0)));
  legs4(g, .8, .74, .14, wd, .1, .035);
  return g;
}
export function build_beanbag(d) {
  const g = G(), c = MF(d.color, 'cloth');
  const b = sph(.42, c, 0, .3, 0, .78); b.scale.z = 1.0; add(g, b);
  const top = sph(.3, c, 0, .34, -.12, .62); add(g, top);
  const bk = sph(.3, c, 0, .5, -.22, .9); add(g, bk);
  add(g, cyl(.05, .05, .02, MF(d.color2, 'cloth'), 0, .6, .0, 12));
  return g;
}
export function build_dchair(d) {
  const g = G(), wd = MW(d.color2), seat = MF(d.color, 'cloth');
  add(g, rbox(.5, .07, .5, .03, wd, 0, .46, 0), rbox(.44, .07, .44, .03, seat, 0, .53, 0));
  legs4(g, .5, .5, .46, wd, .05, .03);
  [-1, 1].forEach(s => add(g, box(.04, .5, .04, wd, s * .22, .5, -.22)));
  add(g, rbox(.48, .09, .04, .02, wd, 0, .98, -.22), rbox(.42, .2, .04, .05, seat, 0, .72, -.2));
  return g;
}
export function build_rtable(d) {
  const g = G(), wd = MW(d.color), dk = MW(d.color2), h = d.h;
  add(g, cyl(.5, .5, .06, wd, 0, h - .06, 0, 36), cyl(.44, .44, .04, dk, 0, h - .1, 0, 28));
  add(g, lathe([[.2, 0], [.2, .03], [.07, .08], [.06, h * .6], [.1, h - .1]], dk, 0, 0, 0, 16));
  return g;
}
export function build_counter(d) {
  const g = G(), w = d.w, h = d.h, body = MW(d.color), dk = MW(d.color2), top = M('#f3f0ea', { roughness: .3 });
  add(g, box(w, h - .1, .64, body, 0, .08, 0), box(w, .08, .6, M('#4a3a30'), 0, 0, -.02), box(w + .04, .06, .7, top, 0, h - .06, .02));
  for (let i = 0; i < 3; i++) { const x = -w / 2 + w / 6 + i * w / 3; add(g, rbox(w / 3 - .08, h - .3, .03, .01, dk, x, .15, .33), box(.14, .025, .03, gold(), x, h - .3, .36)); }
  // シンク・蛇口・コンロ
  add(g, box(.5, .01, .34, MM(0xc8cdd2, .3), -w / 4, h, 0.0), cyl(.025, .025, .22, MM(0xb7bdc2, .25), -w / 4, h, -.2, 8), box(.03, .03, .14, MM(0xb7bdc2, .25), -w / 4, h + .2, -.14));
  [-1, 1].forEach(s => add(g, torus(.07, .012, M('#2a2a2a'), w / 4 + s * .14, h + .02, .0).rotateX(Math.PI / 2)));
  g.children.at(-1).position.y = h + .02; g.children.at(-2).position.y = h + .02;
  add(g, cyl(.11, .11, .13, M('#d85a4a', { roughness: .4 }), w / 4 - .14, h, -.04, 14), cyl(.12, .12, .02, MM(0xb0b5ba), w / 4 - .14, h + .13, -.04, 14));
  return g;
}
export function build_rack(d) {
  const g = G(), met = M('#3a3a42', { roughness: .4, metalness: .5 }), w = d.w;
  [-1, 1].forEach(s => { add(g, cyl(.018, .018, 1.55, met, s * (w / 2 - .12), .06, 0, 8), box(.06, .06, .6, met, s * (w / 2 - .12), 0, 0)); });
  const bar = cyl(.016, .016, w - .24, met, 0, 1.5, 0, 8); bar.rotation.z = Math.PI / 2; bar.position.y = 1.5; add(g, bar);
  const sh = box(w - .2, .035, .4, MW('#c9a06b'), 0, .35, 0); add(g, sh);
  const cols = ['#f08a7e', '#8fd3c0', '#f2c14e', '#7fb8d8', '#b39ddb', '#fff3e0'];
  for (let i = 0; i < 6; i++) { const x = -w / 2 + .22 + i * (w - .44) / 5; add(g, cyl(.01, .01, .05, MM(0xbbbbbb), x, 1.43, 0, 6)); add(g, rbox(.07, .62, .38, .03, MF(cols[i], 'cloth'), x, .83, 0)); add(g, rbox(.07, .08, .1, .02, MF(cols[(i + 2) % 6], 'cloth'), x, 1.3, 0)); }
  add(g, rbox(.3, .12, .26, .04, M('#d9a96b'), -.2, .38, 0), rbox(.26, .12, .24, .04, M('#9ad1c0'), .22, .38, 0));
  return g;
}
export function build_dresser(d) {
  const g = G(), w = d.w, wd = MW(d.color), dk = MW(d.color2), h = d.h;
  add(g, box(w, .62, .5, wd, 0, .2, 0), box(w + .04, .05, .54, dk, 0, .82, 0));
  legs4(g, w, .46, .2, dk, .08, .03);
  for (let i = 0; i < 2; i++) { add(g, box(w - .1, .26, .03, dk, 0, .26 + i * .3, .26), sph(.025, gold(), 0, .4 + i * .3, .29)); }
  const mir = G(); add(mir, rbox(.7, .8, .04, .06, MW(d.color2), 0, 0, 0), rbox(.6, .7, .01, .05, MM(0xe9f2f5, .06), 0, .05, .03)); mir.position.set(0, .87, -.1); g.add(mir);
  add(g, sph(.05, M('#f7a8b8'), -.3, .9, .05, 1), cyl(.045, .05, .1, MGLASS(0xffd0e0, .5), .28, .87, .08, 10), cyl(.01, .01, .1, M('#f7a8b8'), .15, .87, .1, 6));
  return g;
}
export function build_bench(d) {
  const g = G(), w = d.w, wd = MW(d.color), dk = MW(d.color2);
  add(g, rbox(w, .08, .42, .025, wd, 0, .4, 0), rbox(w - .1, .09, .36, .04, MF(d.color2, 'cloth'), 0, .48, 0));
  [-1, 1].forEach(s => { add(g, box(.06, .4, .4, dk, s * (w / 2 - .1), 0, 0)); });
  add(g, box(w - .3, .04, .04, dk, 0, .2, 0));
  return g;
}
export function build_stool(d) {
  const g = G(), wd = MW(d.color2);
  add(g, cyl(.22, .22, .06, MW(d.color), 0, .44, 0, 24));
  add(g, cyl(.19, .19, .05, MF(d.color2, 'cloth'), 0, .5, 0, 24));
  [0, 1, 2].forEach(i => { const a = i * 2.094, l = cyl(.025, .02, .46, wd, Math.sin(a) * .14, 0, Math.cos(a) * .14, 8); l.rotation.z = -Math.sin(a) * .12; l.rotation.x = Math.cos(a) * .12; add(g, l); });
  add(g, torus(.14, .012, wd, 0, .2, 0).rotateX(Math.PI / 2)); g.children.at(-1).position.y = .2;
  return g;
}
export function build_cubeshelf(d) {
  const g = G(), w = d.w, h = d.h, wd = MW(d.color), n = 2, bx = ['#f08a7e', '#8fd3c0', '#f2c14e', '#7fb8d8'];
  const cw = (w - .08) / 2, ch = (h - .08) / n;
  add(g, box(.04, h, .46, wd, -w / 2 + .02, 0, 0), box(.04, h, .46, wd, w / 2 - .02, 0, 0), box(w, h, .02, MW('#8a6a40'), 0, 0, -.22));
  for (let r = 0; r <= n; r++) add(g, box(w, .04, .46, wd, 0, r * (ch + .01) * 1, 0));
  add(g, box(.04, h - .04, .44, wd, 0, .04, 0));
  for (let r = 0; r < n; r++) for (let c = 0; c < 2; c++) if ((r + c) % 3 !== 2) add(g, rbox(cw - .1, ch - .14, .34, .03, MF(bx[(r * 2 + c) % 4], 'cloth'), -w / 2 + .04 + cw * (c + .5), .06 + r * (ch + .01), .02), box(.12, .03, .01, M('#fffaf0'), -w / 2 + .04 + cw * (c + .5), .1 + r * (ch + .01) + (ch - .14) * .5, .2));
  add(g, sph(.07, M('#d9895a'), -w / 4, h + .06, 0), sph(.1, M('#5fb760'), -w / 4, h + .17, 0, 1));
  return g;
}
export function build_hammock(d) {
  const g = G(), wd = MW(d.color2), cl = MF(d.color, 'cloth'), w = d.w, L = d.d;
  [-1, 1].forEach(s => { add(g, cyl(.04, .05, 1.1, wd, 0, 0, s * (L / 2 - .1), 10), box(.5, .05, .14, wd, 0, 0, s * (L / 2 - .1)), cyl(.015, .015, .06, MM(0x999999), 0, 1.08, s * (L / 2 - .1), 6)); });
  for (let i = 0; i <= 14; i++) { const t = i / 14, z = -L / 2 + .12 + t * (L - .24), y = .98 - Math.sin(Math.PI * t) * .42; const q = sph(.3, cl, 0, y - .02, z); q.scale.set(1, .3, .2); add(g, q); }
  [-1, 1].forEach(s => add(g, cyl(.012, .012, .5, MM(0xbbbbbb, .4), s * .05, .62, s * (L / 2 - .18), 6)));
  add(g, puffy(.38, .1, .3, MF('#fffaf0', 'cloth'), 0, .55, -L / 2 + .45, { puff: .9, pinch: .8, wr: .01, seed: 3, round: 3 }));
  return g;
}
export function build_chabudai(d) {
  const g = G(), wd = MW(d.color), dk = MW(d.color2);
  add(g, cyl(.46, .46, .06, wd, 0, .3, 0, 32), cyl(.4, .4, .03, dk, 0, .27, 0, 28));
  [0, 1, 2, 3].forEach(i => { const a = i * Math.PI / 2 + .78; const l = cyl(.03, .025, .3, dk, Math.sin(a) * .28, 0, Math.cos(a) * .28, 8); l.rotation.z = -Math.sin(a) * .2; l.rotation.x = Math.cos(a) * .2; add(g, l); });
  add(g, cyl(.08, .06, .07, M('#fffaf0', { roughness: .3 }), -.12, .36, .06, 14), cyl(.06, .06, .02, M('#6a8a4a'), .14, .36, -.08, 14));
  return g;
}

// ===== 家電 =====
export function build_microwave(d) {
  const g = G(), c = M(d.color, { roughness: .35 });
  add(g, rbox(.62, .36, .46, .06, c, 0, .0, 0), rbox(.38, .26, .01, .03, M('#222a30', { roughness: .15 }), -.07, .05, .235), rbox(.12, .26, .01, .02, M('#c9d2d6'), .2, .05, .235));
  add(g, sph(.025, MG(0x60e0a0, 2), .2, .3, .24), sph(.02, M('#9aa5aa'), .2, .13, .24), box(.015, .2, .02, MM(0xbbbbbb), -.27, .07, .245));
  return g;
}
export function build_ricecooker(d) {
  const g = G(), c = M(d.color, { roughness: .3 }), c2 = M(d.color2, { roughness: .4 });
  add(g, rbox(.46, .3, .42, .12, c, 0, 0, 0), puffy(.4, .12, .36, c, 0, .26, 0, { puff: .8, pinch: .6, wr: .008, seed: 2, round: 2 }), rbox(.3, .08, .02, .02, c2, 0, .1, .21), sph(.025, MG(0xff9a6a, 1.4), .1, .16, .212), sph(.04, c2, 0, .4, 0));
  return g;
}
export function build_console(d) {
  const g = G(), wd = MW('#e9dcc4'), scr = texOf('gamescr', 256, 160, (c, W, H) => { const gr = c.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#ff9ad0'); gr.addColorStop(1, '#6ad0ff'); c.fillStyle = gr; c.fillRect(0, 0, W, H); c.fillStyle = '#fff'; c.beginPath(); c.arc(W * .3, H * .55, 20, 0, 7); c.fill(); c.fillStyle = '#ffe07a'; c.fillRect(W * .5, H * .4, 50, 50); c.fillStyle = '#58c878'; c.fillRect(0, H * .8, W, H * .2); });
  add(g, rbox(.9, .06, .5, .02, wd, 0, .0, 0));
  add(g, rbox(.82, .5, .06, .03, M('#26262e', { roughness: .3 }), 0, .15, -.1), rbox(.74, .42, .01, .01, M('#fff', { map: scr, emissiveMap: scr, emissive: 0xffffff, emissiveIntensity: .8 }), 0, .19, -.065), cyl(.04, .1, .15, M('#26262e'), 0, .06, -.1, 10));
  add(g, rbox(.3, .06, .22, .02, M('#f3f0ea', { roughness: .4 }), -.2, .06, .12), box(.12, .015, .1, M('#222'), -.2, .125, .12), sph(.012, MG(0x60ff90, 2), -.32, .1, .24));
  [0, 1].forEach(i => { const p = rbox(.17, .05, .09, .03, M(i ? '#f06a80' : '#6ab0f0'), .2 + i * .16 - .08, .06, .17); add(g, p, sph(.012, M('#fff'), .15 + i * .16, .115, .17)); });
  return g;
}
export function build_speaker(d) {
  const g = G(), c = MW(d.color), dk = M('#222', { roughness: .6 });
  add(g, rbox(.34, .84, .32, .04, c, 0, .12, 0), cyl(.12, .12, .02, dk, 0, .66, .17, 20).rotateX(Math.PI / 2), cyl(.06, .06, .02, dk, 0, .3, .17, 20).rotateX(Math.PI / 2));
  g.children.at(-2).position.set(0, .8, .16); g.children.at(-1).position.set(0, .4, .16);
  add(g, sph(.035, MM(0xcccccc), 0, .8, .18), sph(.03, M(d.color2), 0, .4, .18), sph(.02, MG(0xff8a6a, 1.5), 0, .9, .16));
  [-1, 1].forEach(s => add(g, cyl(.03, .03, .12, dk, s * .12, 0, 0, 8)));
  return g;
}
export function build_humid(d) {
  const g = G(), c = M(d.color, { roughness: .35 }), steam = [];
  add(g, lathe([[0, 0], [.2, 0], [.26, .1], [.24, .36], [.18, .42], [0, .42]], c, 0, 0, 0, 24), cyl(.1, .12, .1, M(d.color2, { roughness: .3 }), 0, .42, 0, 16));
  add(g, sph(.02, MG(0x60d0ff, 2), .2, .2, .15));
  for (let i = 0; i < 4; i++) { const s = sph(.07, M('#ffffff', { transparent: true, opacity: .3, depthWrite: false, roughness: 1 }), 0, .6, 0); s.castShadow = false; steam.push(s); g.add(s); }
  g.userData.anim = t => steam.forEach((s, i) => { const k = ((t * .35 + i / 4) % 1); s.position.set(Math.sin(t + i) * .03, .55 + k * .5, 0); s.scale.setScalar(.6 + k * 1.2); s.material.opacity = .32 * (1 - k); });
  g.userData.live = true; return g;
}
export function build_heater(d) {
  const g = G(), c = M(d.color, { roughness: .4 }), glow = MG(0xff7a30, 1.8);
  add(g, rbox(.5, .62, .2, .06, c, 0, .05, 0), rbox(.36, .5, .02, .03, M('#2a2a2a'), 0, .1, .11));
  [0, 1, 2].forEach(i => add(g, cyl(.018, .018, .44, glow, (i - 1) * .1, .12, .09, 8)));
  for (let i = 0; i < 7; i++) add(g, box(.4, .012, .015, MM(0x999999), 0, .11 + i * .07, .125));
  add(g, box(.5, .06, .26, M(d.color2), 0, 0, 0), sph(.02, MG(0xffa050, 2), .18, .6, .1));
  lightAt(g, 0, .35, .4, 0xff8a40, 2.2, 3.5);
  return g;
}
export function build_washer(d) {
  const g = G(), c = M(d.color, { roughness: .28 });
  add(g, rbox(.86, .95, .8, .07, c, 0, .0, 0), box(.86, .08, .8, M('#cfd8dc'), 0, .95, 0));
  add(g, torus(.26, .035, MM(0xaab4ba, .3), 0, .45, .4), cyl(.24, .24, .02, MGLASS(0xaadcf0, .55), 0, .45, .4, 28).rotateX(Math.PI / 2));
  g.children.at(-1).position.set(0, .45, .395); g.children.at(-1).rotation.x = Math.PI / 2;
  add(g, sph(.05, M(d.color2), -.28, .84, .4), sph(.03, MG(0x60b8ff, 1.5), .2, .84, .4), sph(.03, M('#f08a7e'), .3, .84, .4));
  return g;
}
export function build_robovac(d) {
  const g = G(), c = M(d.color, { roughness: .3 }), rob = G();
  rob.add(cyl(.22, .22, .09, c, 0, 0, 0, 28), cyl(.2, .2, .01, M('#2a2a2a'), 0, .09, 0, 28), sph(.04, MG(0x60ffb0, 2), 0, .1, .1), cyl(.05, .05, .02, M(d.color2), -.08, .09, -.06, 14));
  rob.add(sph(.025, M('#333'), .15, .02, .15)); rob.position.y = 0; g.add(rob);
  g.userData.anim = t => { rob.rotation.y = t * .5; rob.position.set(Math.sin(t * .6) * .22, 0, Math.cos(t * .6) * .22); };
  g.userData.live = true; return g;
}
