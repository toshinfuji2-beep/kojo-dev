// 非売品（QRプレゼント・ミッションの報酬）の3Dモデル。ふつうの品と見分けられるよう、金色・特別な飾りつき（オリジナル造形）
// はずれ品（腐った魚）もここ
import { THREE, M, MW, MM, MT, G, box, rbox, cyl, sph, cone, lathe, add, torus, plane } from './mk.js?v=202611131634';
import { texOf } from './textures.js?v=202611131634';

const gold = () => MM(0xf3c33a, .18), gold2 = () => MM(0xd9a21f, .3);
// 星（押し出し）
function star(r, depth, mat) {
  const sh = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * .45 : r; i ? sh.lineTo(Math.cos(a) * rr, -Math.sin(a) * rr) : sh.moveTo(Math.cos(a) * rr, -Math.sin(a) * rr); }
  const m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: depth * .3, bevelSize: depth * .3, bevelSegments: 2 }), mat);
  m.geometry.center(); m.castShadow = true; return m;
}
// 金のトロフィー：大きめのカップ＋てっぺんの星＋台の金のプレート
export function build_ltdtrophy(d) {
  const g = G(), au = gold();
  add(g, rbox(.36, .08, .26, .02, MW('#3a2010'), 0, 0, 0), rbox(.3, .06, .2, .02, MW('#4a2a14'), 0, .08, 0), box(.16, .04, .005, gold2(), 0, .04, .132));
  add(g, cyl(.035, .06, .12, au, 0, .14, 0, 16), lathe([[0, 0], [.07, .02], [.12, .1], [.19, .26], [.22, .4], [.205, .42], [.16, .3], [.03, .08]], au, 0, .26, 0, 28));
  [-1, 1].forEach(s => { const t = torus(.085, .014, au, s * .22, .55, 0); t.scale.set(.75, 1, 1); add(g, t); });
  const st = star(.08, .025, au); st.position.set(0, .8, 0); add(g, st, cyl(.012, .012, .08, au, 0, .68, 0, 8));
  return g;
}
// 金の合格だるま：金色の体・白い顔・赤いまゆ
export function build_ltddaruma(d) {
  const g = G(), au = gold(), face = M('#fff8e6', { roughness: .4 }), ink = M('#2a2220');
  add(g, sph(.27, au, 0, .3, 0, 1.1), sph(.17, face, 0, .36, .17, .85));
  [-1, 1].forEach(s => add(g, sph(.03, ink, s * .07, .38, .33), box(.12, .025, .02, M('#c0392b'), s * .07, .43, .32)));
  add(g, box(.1, .012, .02, ink, 0, .28, .33), box(.22, .02, .02, M('#c0392b'), 0, .15, .26).rotateX(.3));
  const st = star(.05, .015, M('#c0392b')); st.position.set(0, .22, .26); add(g, st);
  return g;
}
// 金の地球儀：金の球に海と陸のしま模様の帯、金の台と輪
export function build_ltdglobe(d) {
  const g = G(), au = gold(), sea = MM(0xfff1b8, .25);
  add(g, cyl(.14, .17, .05, au, 0, 0, 0, 24), cyl(.02, .025, .14, au, 0, .05, 0, 10));
  const ball = sph(.2, sea, 0, .42, 0); ball.geometry = new THREE.SphereGeometry(.2, 32, 22); add(g, ball);
  for (let i = 0; i < 3; i++) { const b = torus(.2, .012, au, 0, .42, 0); b.rotation.x = Math.PI / 2; b.rotation.y = i * .9; b.rotation.z = .3; add(g, b); }
  const ring = torus(.25, .012, au, 0, .42, 0); ring.rotation.z = .4; add(g, ring);
  const st = star(.04, .012, au); st.position.set(0, .7, 0); add(g, st);
  return g;
}
// はずれ品：腐った魚。くすんだ緑の体・×の目・ほね・もわもわのにおい
export function build_rottenfish(d) {
  const g = G(), skin = M('#6f7d46', { roughness: .95 }), belly = M('#a39a62', { roughness: .95 }), dark = M('#4a5532', { roughness: .95 }), ink = M('#2a2a22'), spot = M('#5a4a2a', { roughness: 1 });
  const plate = cyl(.3, .26, .03, M('#e8e4d8', { roughness: .5 }), 0, 0, 0, 28); plate.scale.z = .7; add(g, plate);
  const body = sph(.14, skin, 0, .12, 0); body.scale.set(1.7, .7, .8); add(g, body);
  const bl = sph(.11, belly, 0, .09, .03); bl.scale.set(1.6, .45, .7); add(g, bl);
  const tail = cone(.09, .14, dark, .28, .06, 0, 4); tail.rotation.z = Math.PI / 2; tail.scale.set(.5, 1, 1); add(g, tail);
  add(g, cone(.05, .08, dark, -.02, .19, 0, 4));   // せびれ
  [[-.08, .15, .08, .03], [.06, .17, .07, .025], [.12, .12, .09, .02], [-.02, .1, .1, .022]].forEach(([x, y, z, r]) => { const s = sph(r, spot, x, y, z); s.scale.z = .4; add(g, s); });   // くさったしみ
  // ×の目
  [[-.17, .15, .085]].forEach(([x, y, z]) => { add(g, sph(.03, M('#f2efe2'), x, y, z, 1)); [.7, -.7].forEach(r => { const b = box(.045, .008, .006, ink, x, y - .004, z + .028); b.rotation.z = r; add(g, b); }); });
  // ほねが見えている（背中の一部）
  const bone = M('#f4f0e2', { roughness: .6 });
  for (let i = 0; i < 4; i++) add(g, box(.008, .05, .008, bone, -.04 + i * .05, .17, .07).rotateX(.3));
  add(g, box(.18, .01, .01, bone, .035, .19, .06));
  // ハエ1ぴき
  add(g, sph(.012, ink, .05, .36, .05), sph(.012, M('#cfe8ff', { transparent: true, opacity: .7 }), .04, .375, .05, .4), sph(.012, M('#cfe8ff', { transparent: true, opacity: .7 }), .06, .375, .05, .4));
  // もわもわ（ゆっくりゆれる）
  const fume = G(), fm = M('#7fb03a', { transparent: true, opacity: .8, roughness: 1 });
  [[-.1, .3], [.0, .38], [.1, .31], [-.04, .46], [.06, .5]].forEach(([x, y], i) => { const t = torus(.035 + (i % 3) * .008, .011, fm, x, y, 0); add(fume, t); });
  add(g, fume);
  g.userData.anim = t => { fume.position.y = Math.sin(t * 1.6) * .02; fume.children.forEach((c, i) => { c.rotation.y = t * (1 + i * .3); }); };
  return g;
}

// ===== 東進ハイスクール藤沢校のポスター（壁かけ）：緑の地に白い文字。ロゴは assets/toshin_logo.png があれば上に入れる =====
// ロゴの画像はこちらで描かない（本物を正しく使うため、校舎から画像をもらって assets/ に置く）。無いときは文字だけ
export function art_toshin(d) {
  let tex = null, cv0 = null;
  tex = texOf('toshin_poster', 300, 420, (c, w, h, cv) => {
    cv0 = cv;
    const draw = logo => {
      c.fillStyle = '#0b8a3e'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#ffffff'; c.lineWidth = 8; c.strokeRect(14, 14, w - 28, h - 28);
      c.fillStyle = '#ffffff'; c.textAlign = 'center'; c.textBaseline = 'middle';
      const font = s => '900 ' + s + 'px "Zen Maru Gothic","Hiragino Kaku Gothic ProN","Yu Gothic UI","Meiryo",sans-serif';
      const top = logo ? 190 : 140;
      if (logo) { const lw = 200, lh = lw * (logo.height / logo.width || .5); c.drawImage(logo, (w - lw) / 2, 40 + Math.max(0, (120 - lh) / 2), lw, Math.min(lh, 120)); }
      c.font = font(27); c.fillText('東進ハイスクール', w / 2, top);
      c.fillRect(50, top + 34, w - 100, 4);
      c.font = font(74); c.fillText('藤沢校', w / 2, top + 100);
      c.font = font(20); c.fillText('TOSHIN HIGH SCHOOL', w / 2, h - 52);
    };
    draw(null);
    const im = new Image(); im.onload = () => { draw(im); if (tex) tex.needsUpdate = true; }; im.src = 'assets/toshin_logo.png';
  });
  const g = G(), p = plane(d.w, d.h, MT(tex), d.w / 2, d.h / 2, .012); p.castShadow = false; add(g, p);
  [.1, d.w - .1].forEach(x => add(g, sph(.025, MM(0xd8d8d8), x, d.h - .06, .02))); return g;
}
