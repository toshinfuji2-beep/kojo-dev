// 小物・照明・植物・勉強グッズ
import { THREE, M, MW, MF, MG, MM, MGLASS, MT, G, box, rbox, cyl, sph, cone, lathe, add, lightAt, torus } from './mk.js?v=202611131634';
import { artTex, texOf } from './textures.js?v=202611131634';
import { puffy, book, flatBook, leafMesh, leafTex } from './soft.js?v=202611131634';
import { CFG } from './data.js?v=202611131634';

export function build_lamp(d) {
  const g = G(), c = M(d.color, { roughness: .4 });
  add(g, cyl(.16, .18, .04, M('#2b2b2b'), 0, 0, 0, 16), cyl(.02, .02, .36, MM(0x444444), 0, .04, 0, 8));
  const arm = cyl(.015, .015, .34, MM(0x444444), .05, .36, 0, 8); arm.rotation.z = -.7; arm.position.set(.1, .5, 0); add(g, arm);
  const sh = cone(.14, .2, M(d.color, { roughness: .4, side: THREE.DoubleSide }), .22, .5, 0, 20); sh.rotation.z = -2.1; sh.position.set(.28, .62, 0); add(g, sh, sph(.05, MG(0xfff0b0, 3), .3, .54, 0));
  lightAt(g, .3, .5, 0, 0xffd89a, 3.5, 4.5);
  return g;
}
export function build_laptop(d) {
  const g = G(), al = MM(0xcfd5da, .35), scr = artTex('tv', { id: 'tv' }, 256, 160);
  add(g, rbox(.56, .03, .4, .01, al, 0, 0, .04));
  const lid = G(); lid.add(rbox(.56, .38, .02, .01, al, 0, 0, 0), rbox(.5, .32, .005, .005, M('#111', { map: scr, emissiveMap: scr, emissive: 0xffffff, emissiveIntensity: .8 }), 0, .03, .012)); lid.position.set(0, .03, -.16); lid.rotation.x = -.28; g.add(lid);
  const kb = texOf('kbd', 256, 100, (c, W, H) => { c.fillStyle = '#2a2d31'; c.fillRect(0, 0, W, H); for (let j = 0; j < 5; j++) for (let i = 0; i < 14; i++) { c.fillStyle = '#d9dde0'; c.fillRect(6 + i * 17.4, 5 + j * 15.4, 15, 12.5); } c.fillStyle = '#d9dde0'; c.fillRect(60, 84, 120, 12); });
  add(g, rbox(.42, .006, .17, .002, M('#2a2d31', { map: kb, roughness: .5 }), 0, .03, .045), rbox(.16, .004, .09, .003, MM(0xb7bdc2, .3), 0, .03, .16), cyl(.012, .012, .5, MM(0x9aa1a6, .3), 0, .03, -.15, 10).rotateZ(Math.PI / 2));
  g.children.at(-1).position.set(0, .035, -.155); return g;
}
export function build_alarm(d) {
  const g = G(); const r = .2;
  add(g, cyl(r, r, .12, M(d.color, { roughness: .3, metalness: .2 }), 0, .08, 0, 24).rotateX(Math.PI / 2));
  const body = g.children[0]; body.position.set(0, .26, 0);
  add(g, cyl(.17, .17, .005, M('#fff6e0'), 0, .26, .065, 24).rotateX(Math.PI / 2));
  g.children[1].position.set(0, .26, .065);
  [-1, 1].forEach(s => { add(g, sph(.07, MM(0xc9a24a), s * .14, .44, 0)); add(g, cyl(.012, .012, .1, MM(0x666666), s * .06 * 2, .3, 0, 6)); });
  add(g, box(.012, .1, .01, M('#222'), 0, .26, .07), box(.07, .012, .01, M('#222'), .03, .26, .072), box(.04, .04, .1, M('#555'), -.12, 0, 0), box(.04, .04, .1, M('#555'), .12, 0, 0));
  return g;
}
export function build_stack(d) {
  const g = G(), n = d.n || 6, pal = d.pal || [d.color], r = (i) => ((i * 7919) % 97) / 97; let y = 0;
  for (let i = 0; i < n; i++) {
    const th = .06 + r(i) * .05, w = .5 - r(i + 3) * .1, dd = .36 - r(i + 5) * .06, c = pal[i % pal.length];
    add(g, flatBook(w, th, dd, c, (r(i + 9) - .5) * .08, y, (r(i + 11) - .5) * .06, (r(i + 1) - .5) * .35)); y += th;
  }
  return g;
}
export function build_bookpile(d) {
  const g = G(), c = ['#6b2f2f', '#2f4a6b', '#c9a24a', '#3f6a4a', '#d8c8a8']; let y = 0;
  for (let i = 0; i < 5; i++) { const th = .05 + (i % 2) * .035; add(g, flatBook(.46 - i * .03, th, .34 - i * .02, c[i], (i % 2 ? .03 : -.03), y, 0, (i - 2) * .12)); y += th; }
  return g;
}
export function build_globe(d) {
  const g = G(), m = artTex('map', { id: 'map' }, 256, 128);
  add(g, cyl(.14, .16, .04, MW('#5a3219'), 0, 0, 0, 16), cyl(.02, .02, .14, MM(0xc9a24a), 0, .04, 0, 8));
  const s = sph(.22, MT(m, { roughness: .5 }), 0, .44, 0); s.rotation.z = .4; add(g, s, torus(.25, .012, MM(0xc9a24a), 0, .44, 0).rotateY(Math.PI / 2).rotateX(0));
  g.children.at(-1).rotation.set(0, 0, .4); return g;
}
export function build_daruma(d) {
  const g = G(); const r = M('#e53935', { roughness: .35 });
  add(g, sph(.27, r, 0, .3, 0, 1.1), sph(.17, M('#fbe9d0'), 0, .36, .17, .85), box(.12, .02, .02, M('#222'), -.07, .42, .33), box(.12, .02, .02, M('#222'), .07, .42, .33));
  add(g, sph(.03, M('#222'), -.07, .38, .33), sph(.03, M('#222'), .07, .38, .33), box(.1, .01, .02, M('#222'), 0, .28, .33), box(.22, .02, .02, M('#e8b130'), 0, .15, .26).rotateX(.3));
  add(g, cyl(.08, .08, .01, M('#e8b130'), 0, .2, .26, 6)); return g;
}
export function build_trophy(d) {
  const g = G(), gold = MM(0xf0c242, .22);
  add(g, box(.34, .1, .24, MW('#4a2a14'), 0, 0, 0), cyl(.03, .05, .12, gold, 0, .1, 0, 12), lathe([[.0, .0], [.06, .02], [.1, .1], [.17, .26], [.2, .38], [.19, .4], [.15, .3], [.03, .08]], gold, 0, .22, 0, 20));
  const h = (s) => { const t = torus(.08, .012, gold, s * .2, .5, 0); t.scale.set(.8, 1, 1); return t; }; add(g, h(-1), h(1)); return g;
}
export function build_cards(d) {
  const g = G(); for (let i = 0; i < 4; i++) add(g, box(.34, .03, .24, M(['#fff6a8', '#cfe9ff', '#ffd6d6', '#d9f5c9'][i]), 0, i * .032, 0).rotateY((i - 1.5) * .12));
  add(g, box(.36, .1, .03, M('#f2877a'), 0, .0, 0)); g.children.at(-1).visible = false; return g;
}
function leafMat(color, o) { return new THREE.MeshStandardMaterial(Object.assign({ color, map: leafTex(), roughness: .5, side: THREE.DoubleSide, emissive: new THREE.Color(color).multiplyScalar(.14) }, o)); }
export function build_plant(d) {
  const g = G(), tall = d.h > 1.5, pot = M(d.color2, { roughness: .8 }), lf = leafMat(d.color), lf2 = leafMat('#3f8a4a', { roughness: .55 });
  add(g, lathe([[.0, 0], [.17, 0], [.23, .08], [.26, .3], [.28, .33], [.25, .35], [.0, .33]], pot, 0, 0, 0), cyl(.24, .24, .02, M('#3a2a1a'), 0, .32, 0, 16));
  if (!tall) {
    // ロゼット状：根元から放射状に、重なりながら立ち上がる
    for (let i = 0; i < 18; i++) { const a = i * 2.399, k = i / 18, len = .34 + .22 * (1 - k * .5) + (i % 3) * .03, pitch = .35 + k * .75 + (i % 2) * .1; add(g, leafMesh(i % 3 ? lf : lf2, len, .62, a, pitch, Math.sin(a) * .03, .34, Math.cos(a) * .03, (i % 2 - .5) * .2)); }
    return g;
  }
  const trunk = MW('#6a4a2a'); add(g, cyl(.028, .045, 1.35, trunk, 0, .35, 0, 8)); const br = cyl(.02, .033, .85, trunk, 0, 0, 0, 8); br.rotation.z = -.28; br.position.set(.14, .8, .03); add(g, br);
  // 幹に沿ってらせん状に葉を付ける（下ほど大きく外向き、上ほど立ち上がる）
  const N = 30;
  for (let i = 0; i < N; i++) {
    const k = i / (N - 1), y = .75 + k * 1.1, a = i * 2.399, len = .62 - .22 * k + (i % 4) * .03, pitch = 1.25 - k * .75 + (i % 3) * .06;
    add(g, leafMesh(i % 4 ? lf : lf2, len, .78, a, pitch, Math.sin(a) * .035, y, Math.cos(a) * .035, (i % 2 - .5) * .3));
  }
  for (let i = 0; i < 7; i++) { const a = i * 1.1 + .4; add(g, leafMesh(lf, .5, .75, a, .35 + (i % 3) * .1, Math.sin(a) * .03, 1.85, Math.cos(a) * .03, 0)); }
  const side = [[-.26, 1.25], [-.1, 1.45]]; side.forEach(([x, y], j) => { for (let i = 0; i < 4; i++) { const a = i * 1.6 + j; add(g, leafMesh(lf2, .45, .75, a, .9 + i * .1, x, y, 0, 0)); } });
  return g;
}
export function build_cushion(d) {
  const g = G(), c = puffy(.46, .13, .46, MF(d.color, 'cloth'), 0, 0, 0, { puff: .9, pinch: .75, wr: .012, seed: 3, round: 3 }); c.rotation.y = .5; add(g, c, sph(.022, M(d.color2), 0, .155, 0)); return g;
}
export function build_bowl(d) {
  const g = G(); add(g, cyl(.17, .2, .05, M('#c9c3b8'), 0, 0, 0, 16), sph(.28, MGLASS(0xcdeeff, .22), 0, .32, 0), sph(.23, M('#8fd0ee', { transparent: true, opacity: .35, depthWrite: false }), 0, .28, 0, .8));
  const f = sph(.07, M(d.color2, { roughness: .4 }), .05, .3, .05); f.scale.set(1.5, .8, .6); add(g, f, cone(.05, .1, M(d.color2), -.07, .27, .05).rotateZ(1.5)); g.children.at(-1).rotation.z = 1.6; return g;
}
export function build_guitar(d) {
  const g = G(), wood = MW(d.color, { roughness: .35 }), dk = MW(d.color2);
  const b1 = sph(.2, wood, 0, .5, 0, 1); b1.scale.set(1, 1, .28); const b2 = sph(.25, wood, 0, .26, 0); b2.scale.set(1, 1.05, .28);
  add(g, b1, b2, cyl(.07, .07, .02, M('#1b1208'), 0, .4, .075, 16).rotateX(Math.PI / 2)); g.children.at(-1).position.set(0, .4, .075);
  add(g, box(.07, .7, .03, dk, 0, .6, 0), box(.1, .12, .02, dk, 0, 1.3, 0), box(.2, .03, .04, dk, 0, .22, .07));
  const st = box(.03, 1.0, .03, MM(0x333333), 0, 0, -.2); st.rotation.x = .2; add(g, st, box(.5, .03, .4, M('#333'), 0, 0, -.05)); return g;
}
export function build_plush(d) {
  const g = G(), c = M(d.color, { roughness: 1 }), c2 = M(d.color2, { roughness: 1 });
  add(g, sph(.2, c, 0, .22, 0, 1.1), sph(.15, c, 0, .5, 0.02), sph(.07, c, -.12, .62, 0), sph(.07, c, .12, .62, 0), sph(.07, c2, 0, .46, .14), sph(.02, M('#222'), -.05, .53, .15), sph(.02, M('#222'), .05, .53, .15), sph(.07, c, -.2, .26, .08), sph(.07, c, .2, .26, .08), sph(.08, c, -.1, .06, .1), sph(.08, c, .1, .06, .1), sph(.1, c2, 0, .22, .16, .8));
  return g;
}
export function build_vase(d) {
  const g = G(), glass = M('#9fc9dc', { transparent: true, opacity: .55, roughness: .1, depthWrite: false });
  add(g, lathe([[0, 0], [.12, 0], [.16, .1], [.12, .26], [.07, .34], [.09, .4], [.0, .4]], M(d.color || '#d9c8a0', { roughness: .3 }), 0, 0, 0, 20));
  for (let i = 0; i < 5; i++) { const a = i * 1.25, tilt = .1 + (i % 3) * .1, s = cyl(.008, .008, .5, M('#4f7a3a'), 0, .35, 0, 5); s.rotation.set(Math.cos(a) * tilt, 0, Math.sin(a) * tilt); s.position.set(Math.sin(a) * tilt * .3, .62, Math.cos(a) * tilt * .3); add(g, s);
    for (let p = 0; p < 5; p++) { const pt = sph(.07, M('#fffaf0', { roughness: .5 }), 0, 0, 0); pt.scale.set(.35, .15, 1); pt.position.set(Math.sin(a) * tilt * .6 + Math.cos(p * 1.256 + a) * .06, .98 + (i % 2) * .05, Math.cos(a) * tilt * .6 + Math.sin(p * 1.256 + a) * .06); pt.rotation.set(0, -(p * 1.256 + a), .6); add(g, pt); }
    add(g, sph(.018, M('#f0c040'), Math.sin(a) * tilt * .6, .99 + (i % 2) * .05, Math.cos(a) * tilt * .6)); }
  return g;
}
export function build_teaset(d) {
  const g = G(), w = M('#f6f1e6', { roughness: .25 }), bl = M('#4f7aa8', { roughness: .3 });
  add(g, cyl(.32, .32, .02, MW('#6a4326'), 0, 0, 0, 24), cyl(.34, .34, .02, MM(0xc9a24a, .4), 0, 0, 0, 24).scale.set(1, .2, 1) && null);
  add(g, lathe([[0, 0], [.1, 0], [.15, .08], [.15, .16], [.09, .21], [0, .22]], w, -.1, .02, -.03, 20), cyl(.06, .08, .03, bl, -.1, .22, -.03, 16));
  add(g, sph(.025, bl, -.1, .27, -.03), cone(.025, .12, w, -.26, .1, -.03, 8).rotateZ(1.2)); g.children.at(-1).position.set(-.27, .12, -.03);
  const hd = torus(.06, .012, w, .06, .12, -.03); hd.rotation.y = 0; add(g, hd); g.children.at(-1).position.set(.06, .14, -.03);
  [[.15, .1], [.12, -.12]].forEach(([x, z]) => { add(g, cyl(.09, .09, .01, w, x, .02, z, 16), lathe([[0, 0], [.05, 0], [.07, .09], [.065, .09], [0, .01]], w, x, .03, z, 16)); add(g, cyl(.055, .055, .005, M('#8a4a22'), x, .1, z, 14)); });
  return g;
}
export function build_pie(d) {
  const g = G(); add(g, cyl(.27, .22, .09, MM(0xb8b8b8, .5), 0, 0, 0, 24), cyl(.25, .25, .06, M('#d8963c', { roughness: .8 }), 0, .06, 0, 24), cyl(.26, .26, .03, M('#c2812c'), 0, .04, 0, 24));
  for (let i = -2; i <= 2; i++) { const s = box(.5, .012, .035, M('#e6aa52'), 0, .12, i * .08); s.rotation.y = .6; s.position.y = .125; add(g, s); const s2 = box(.5, .012, .035, M('#e6aa52'), 0, .13, i * .08); s2.rotation.y = -.6; s2.position.y = .135; add(g, s2); }
  add(g, sph(.045, M('#a82a3a', { roughness: .3 }), .08, .14, .02), sph(.045, M('#a82a3a', { roughness: .3 }), -.1, .14, -.06)); return g;
}
export function build_photo(d) {
  const g = G(); const t = artTex('portrait', { id: 'portrait' }, 128, 160);
  const f = rbox(.34, .42, .03, .01, MM(0xc9a24a, .4), 0, 0, 0); f.rotation.x = -.18; f.position.set(0, .22, 0);
  const p = rbox(.28, .35, .01, .004, MT(t), 0, 0, 0); p.rotation.x = -.18; p.position.set(0, .22, .02); add(g, f, p, box(.03, .3, .02, MW('#5a3219'), 0, 0, -.1).rotateX(.5)); g.children.at(-1).position.set(0, .14, -.08); return g;
}
// ===== 照明 =====
export function build_pendant(d) {
  const g = G(), top = CFG.WALL_H, y = 2.3;
  add(g, cyl(.012, .012, top - y - .1, M('#222'), 0, y + .1, 0, 6), cyl(.08, .08, .04, M('#2a2a2a'), 0, top - .04, 0, 12));
  add(g, lathe([[.07, 0], [.1, .04], [.28, .22], [.3, .27], [.28, .27], [.08, .08]], M(d.color, { roughness: .35, metalness: .4, side: THREE.DoubleSide }), 0, y - .05, 0, 24), sph(.07, MG(0xfff0c0, 3), 0, y + .05, 0));
  lightAt(g, 0, y - .05, 0, 0xffc880, 10, 8); return g;
}
export function build_globelight(d) {
  const g = G(), top = CFG.WALL_H, y = 2.35, w = d.w;
  add(g, box(w - .3, .05, .06, M('#2a2a2a'), 0, top - .1, 0), cyl(.06, .06, .04, M('#2a2a2a'), 0, top - .04, 0, 12));
  [-1, 1].forEach(s => { const x = s * (w / 2 - .35); add(g, cyl(.01, .01, top - y - .1, M('#222'), x, y + .2, 0, 6), cyl(.04, .04, .1, MM(0xc9a24a), x, y + .12, 0, 10), sph(.2, M('#fff6dc', { emissive: 0xffd890, emissiveIntensity: 1.1, transparent: true, opacity: .92, roughness: .2 }), x, y, 0)); });
  lightAt(g, 0, y, 0, 0xffc880, 11, 8); return g;
}
export function build_floorlamp(d) {
  const g = G();
  add(g, cyl(.2, .22, .04, MM(0x8a6a3a, .4), 0, 0, 0, 20), cyl(.02, .02, 1.45, MM(0xc9a24a), 0, .04, 0, 8), lathe([[.14, 0], [.26, .3], [.25, .3], [.13, .02]], M('#f3e2bd', { emissive: 0xffc878, emissiveIntensity: .8, side: THREE.DoubleSide, roughness: .9 }), 0, 1.35, 0, 24), sph(.06, MG(0xfff0c0, 3), 0, 1.5, 0));
  lightAt(g, 0, 1.45, 0, 0xffc880, 7, 7); return g;
}
