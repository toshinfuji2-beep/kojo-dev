// 第3弾：ナチュラルな壁かけ（原点=左下、+z が部屋側）と小物（足元中心・正面+z）。オリジナル造形
import { THREE, M, MW, MF, MG, MM, MGLASS, MT, plane, G, box, rbox, cyl, sph, lathe, add, lightAt, torus } from './mk.js?v=202611131634';
import { artTex } from './textures.js?v=202611131634';
import { curtainGeo } from './soft.js?v=202611131634';

// 2点を結ぶ細い棒（xy 平面内、z は一定）
function stick(x1, y1, x2, y2, z, r, mat) {
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, 6), mat);
  m.position.set((x1 + x2) / 2, (y1 + y2) / 2, z); m.rotation.z = -Math.atan2(dx, dy); m.castShadow = true; m.receiveShadow = true; return m;
}
// 片側だけの円柱（壁にぴったり付く半円の鉢など）
function halfCyl(rt, rb, h, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 20, 1, false, -Math.PI / 2, Math.PI), mat);
  m.position.set(x, y + h / 2, z); m.castShadow = true; m.receiveShadow = true; return m;
}

// ===== 壁かけ =====
export function art_wplanter(d) {
  const g = G(), w = d.w, cx = w / 2, pot = M(d.color, { roughness: .85 }), lf = M(d.color2, { roughness: .75 }), lf2 = M('#4a8c4d', { roughness: .75 });
  add(g, box(.08, .26, .02, MM(0x6a5a4a, .5), cx, .38, .01), halfCyl(.2, .15, .26, pot, cx, .42, 0), halfCyl(.21, .21, .03, pot, cx, .66, 0));
  const top = .69;
  for (let i = 0; i < 11; i++) { const a = i / 10 * Math.PI, rr = .08 + (i % 3) * .05; add(g, sph(.075 + (i % 2) * .02, i % 2 ? lf : lf2, cx + Math.cos(a) * rr * 1.5, top + .02 + Math.sin(a) * .07 + (i % 3) * .03, .06 + Math.sin(a) * rr * .8, .6)); }
  // たれ下がるつる
  [-.24, -.1, .05, .2].forEach((ox, s) => {
    const len = 5 + (s % 2) * 3;
    for (let k = 0; k < len; k++) add(g, sph(.038, k % 2 ? lf : lf2, cx + ox + Math.sin(k * .9 + s) * .035, top - .06 - k * .075, .15 + Math.sin(k * .7) * .03, .55));
  });
  return g;
}
export function art_dryflower(d) {
  const g = G(), w = d.w, h = d.h, cx = w / 2, stem = M(d.color2, { roughness: .95 }), tie = M('#f2ebdc', { roughness: 1 });
  add(g, sph(.02, MM(0x8a7a6a), cx, h - .03, .02), stick(cx, h - .03, cx, h - .14, .03, .006, M('#c9b89a')));
  const tieY = h - .2, cols = [d.color, '#d9a0a0', '#f3ead8', '#c9a27a', '#e6c3a0', '#b9a0b8', d.color, '#f3ead8', '#d9a0a0'];
  cols.forEach((col, i) => {
    const a = (i - 4) * .1, L = .42 + (i % 3) * .07, bx = cx + Math.sin(a) * L, by = tieY - Math.cos(a) * L, z = .05 + (i % 2) * .04;
    add(g, stick(cx, tieY, bx, by, z, .006, stem), sph(.042 + (i % 2) * .012, M(col, { roughness: .9 }), bx, by, z, .8));
    if (i % 2 === 0) for (let k = 0; k < 4; k++) add(g, sph(.016, M('#fbf7ee', { roughness: 1 }), bx + (k - 1.5) * .025, by + .05 + (k % 2) * .02, z + .02));
  });
  for (let i = 0; i < 5; i++) add(g, stick(cx, tieY, cx + (i - 2) * .025, tieY + .08, .06, .005, stem));
  add(g, cyl(.035, .035, .055, tie, cx, tieY - .03, .06, 12), torus(.03, .008, M('#c98a7a', { roughness: 1 }), cx, tieY - .005, .06));
  g.children.at(-1).rotation.x = Math.PI / 2;
  return g;
}
export function art_bracket(d) {
  const g = G(), metal = MM(new THREE.Color(d.color2).getHex(), .45), shadeM = M(d.color, { side: THREE.DoubleSide, roughness: .5 });
  add(g, rbox(.1, .16, .03, .01, metal, .12, .2, .015));
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(.12, .28, .03), new THREE.Vector3(.12, .56, .06), new THREE.Vector3(.42, .55, .32));
  const arm = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, .014, 6), metal); arm.castShadow = true; g.add(arm);
  add(g, cyl(.02, .02, .06, metal, .42, .5, .32, 8), lathe([[.165, 0], [.16, .02], [.07, .17], [.03, .2], [0, .2]], shadeM, .42, .3, .32, 28));
  add(g, sph(.05, M('#fff6dc', { emissive: 0xffe2a0, emissiveIntensity: 2.2 }), .42, .33, .32));
  lightAt(g, .42, .26, .34, 0xffd59a, 3.2, 5.5); return g;
}
export function art_switch(d) {
  const g = G(); add(g, rbox(.3, .2, .02, .015, M(d.color, { roughness: .4 }), .18, .03, .01));
  [.13, .23].forEach(x => add(g, rbox(.06, .12, .02, .008, M(d.color2, { roughness: .35 }), x, .07, .03), box(.012, .012, .005, MG('#7ad07a', .8), x, .16, .04)));
  return g;
}
export function art_cafewin(d) {
  const g = G(), w = d.w, h = d.h, fr = MW(d.color2), sky = artTex('sky', { id: 'sky' }, 256, 256), bw = .07;
  add(g, plane(w, h, M('#fff', { map: sky, emissiveMap: sky, emissive: 0xffffff, emissiveIntensity: 1.4, roughness: 1 }), w / 2, h / 2, .01));
  add(g, box(w, bw, .12, fr, w / 2, 0, .06), box(w, bw, .12, fr, w / 2, h - bw, .06), box(bw, h, .12, fr, bw / 2, 0, .06), box(bw, h, .12, fr, w - bw / 2, 0, .06));
  add(g, box(.035, h, .04, fr, w / 2, 0, .05), box(w, .035, .04, fr, w / 2, h * .55, .05), box(w + .16, .05, .2, fr, w / 2, -.05, .1));
  const lace = new THREE.MeshStandardMaterial({ color: 0xfffcf4, roughness: .95, transparent: true, opacity: .88, side: THREE.DoubleSide, map: MF('#fffcf4', 'cloth').map });
  const ch = h * .46, cur = new THREE.Mesh(curtainGeo(w - .12, ch, 6, .022), lace); cur.position.set(w / 2, bw + ch / 2 + .01, .14); cur.castShadow = true; cur.receiveShadow = true; g.add(cur);
  const rod = stick(.04, bw + ch + .03, w - .04, bw + ch + .03, .14, .01, MM(0x9a8a70, .4)); g.add(rod);
  return g;
}
export function art_hookrack(d) {
  const g = G(), w = d.w, h = d.h, wood = MW(d.color), metal = MM(new THREE.Color(d.color2).getHex(), .4), straw = M('#d9b870', { roughness: 1 }), handle = MW('#c9a27a');
  add(g, box(w - .1, .07, .04, wood, w / 2, h - .2, .02));
  [.3, .55, .8].forEach(x => { const hk = cyl(.01, .01, .07, metal, 0, 0, 0, 6); hk.rotation.x = Math.PI / 2; hk.position.set(x, h - .165, .07); g.add(hk); });
  // ほうき（左）
  add(g, stick(.3, h - .17, .3, .32, .1, .016, handle), lathe([[0, 0], [.1, 0], [.075, .22], [.03, .33], [0, .33]], straw, .3, 0, .1, 18), torus(.034, .008, M('#8a5a3a'), .3, .26, .1));
  g.children.at(-1).rotation.x = Math.PI / 2;
  // ちりとり（右）
  const pan = G(); pan.position.set(.8, h - .62, .1); pan.add(stick(0, .42, 0, .1, 0, .013, handle), box(.24, .03, .2, M('#e8e2d6', { roughness: .6 }), 0, 0, .08), box(.24, .1, .015, M('#e8e2d6', { roughness: .6 }), 0, 0, -.015)); pan.rotation.x = -.15; g.add(pan);
  // 小さなブラシ（中）
  add(g, stick(.55, h - .17, .55, h - .45, .08, .01, handle), rbox(.1, .14, .05, .015, straw, .55, h - .62, .08));
  return g;
}
export function art_spotrail(d) {
  const g = G(), w = d.w, rail = M(d.color, { roughness: .4 }), body = M(d.color, { roughness: .35 }), dark = M(d.color2, { roughness: .5 });
  add(g, box(.08, .08, .14, rail, .15, .32, .07), box(.08, .08, .14, rail, w - .15, .32, .07), box(w - .1, .04, .06, rail, w / 2, .34, .14));
  [.35, .9, 1.45].forEach((x, i) => {
    const s = G(); s.position.set(x, .3, .14); s.add(cyl(.012, .012, .06, dark, 0, -.02, 0, 6));
    const head = G(); head.position.y = -.04; head.add(cyl(.065, .07, .2, body, 0, -.2, 0, 18), cyl(.056, .056, .012, MG('#fff3d0', 1.8), 0, -.207, 0, 18), torus(.066, .008, dark, 0, -.005, 0));
    head.children.at(-1).rotation.x = Math.PI / 2; head.rotation.x = -.75; head.rotation.z = (i - 1) * .25; s.add(head); g.add(s);
  });
  lightAt(g, w / 2, .05, .55, 0xfff0d8, 2.6, 6); return g;
}

// ===== 小物 =====
export function build_candle(d) {
  const g = G(), wax = M(d.color, { roughness: .55 }), tray = MW(d.color2), wick = M('#2a2420'), flame = M('#ffd27a', { emissive: 0xffa030, emissiveIntensity: 3, roughness: 1 });
  add(g, cyl(.17, .17, .018, tray, 0, 0, 0, 24));
  [[-.06, 0, .07, .22], [.09, .04, .055, .14], [.02, -.09, .045, .1]].forEach(([x, z, r, hh]) => {
    add(g, cyl(r, r, hh, wax, x, .018, z, 20), cyl(r * .85, r * .85, .004, M('#efe4cc', { roughness: .5 }), x, .018 + hh, z, 20), cyl(.004, .004, .025, wick, x, .018 + hh, z, 5), sph(.016, flame, x, .018 + hh + .045, z, 1.9));
  });
  lightAt(g, 0, .34, 0, 0xffa64d, 1.6, 3.5, true); return g;
}
export function build_jar(d) {
  const g = G(), glass = MGLASS(new THREE.Color(d.color).getHex(), .3), lid = MW(d.color2);
  const one = (x, z, s, fill) => {
    add(g, cyl(.095 * s, .095 * s, .2 * s, M(fill, { roughness: 1 }), x, .01, z, 18));
    add(g, lathe([[0, 0], [.1, 0], [.11, .02], [.11, .3], [.09, .33], [.08, .36], [0, .36]].map(([r, y]) => [r * s, y * s]), glass, x, 0, z, 24));
    add(g, cyl(.085 * s, .085 * s, .05 * s, lid, x, .36 * s, z, 18));
  };
  one(-.08, 0, 1, '#d9c39a'); one(.13, .06, .7, '#8a5a3a');
  return g;
}
export function build_basket(d) {
  const g = G(), weave = MF(d.color, 'cloth', { side: THREE.DoubleSide }), rim = M(d.color2, { roughness: .9 });
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(.2, .16, .22, 28, 1, true), weave); wall.position.y = .11; wall.castShadow = true; wall.receiveShadow = true; g.add(wall);
  add(g, cyl(.16, .16, .015, weave, 0, 0, 0, 24), torus(.2, .014, rim, 0, .22, 0)); g.children.at(-1).rotation.x = Math.PI / 2;
  [.06, .15].forEach(y => { add(g, torus(.17 + y * .2, .006, rim, 0, y, 0)); g.children.at(-1).rotation.x = Math.PI / 2; });
  const hd = new THREE.Mesh(new THREE.TorusGeometry(.18, .012, 8, 24, Math.PI), rim); hd.position.y = .22; hd.castShadow = true; g.add(hd);
  add(g, sph(.08, MF('#f2ebdc', 'cloth'), -.06, .2, .02), sph(.07, MF('#c9d6b8', 'cloth'), .07, .19, -.03));
  return g;
}
export function build_bottles(d) {
  const g = G(), cork = MW('#c9a27a');
  [[-.12, -.03, 1, d.color], [.05, .06, .82, d.color2], [.15, -.07, .64, '#b8d4c8']].forEach(([x, z, s, col]) => {
    const pts = [[0, 0], [.06, 0], [.065, .02], [.065, .28], [.03, .36], [.022, .38], [.022, .46], [0, .46]].map(([r, y]) => [r, y * s]);
    add(g, lathe(pts, MGLASS(new THREE.Color(col).getHex(), .38), x, 0, z, 20), cyl(.02, .02, .03, cork, x, .46 * s - .01, z, 8));
  });
  return g;
}
