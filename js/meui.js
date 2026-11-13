// me-作成画面・顔サムネ・4桁番号(PIN)パッド
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { $, h, fmt, modal, closeModal, toast } from './ui.js?v=202611131634';
import { buildMe, heightExtra } from './avatar.js?v=202611131634';
import { nickProblem, ME_COUNT, HAIR_COLORS, SKIN_COLORS, HOOD_COLORS, EYE_COLORS, HAIR_NAMES, EYE_NAMES, EYEC_NAMES, NOSE_NAMES, MOUTH_NAMES, BROW_NAMES, CHEEK_NAMES, MOLE_NAMES, GLASSES_NAMES, FACE_NAMES, ADJ_KEYS, BROWC_NAMES, HEIGHT_MIN, HEIGHT_MAX, WEAR, WEAR_KEYS, WEAR_LABEL, isFreeWear, isStaffWear, defaultMe, cleanMe, meKey, randomMe, cleanNick } from './me.js?v=202611131634';

// ===== 3Dの共通部品：ライト付きシーン・サムネ用レンダラ =====
function lit(r) {
  const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xfff0dc, 0x8a6240, .5));
  const pm = new THREE.PMREMGenerator(r); sc.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; sc.environmentIntensity = .85; pm.dispose();
  const dl = new THREE.DirectionalLight(0xffe6c0, 1.9); dl.position.set(2, 4, 5); sc.add(dl);
  const fl = new THREE.DirectionalLight(0xb9d0ff, .55); fl.position.set(-3, 2, 2); sc.add(fl);
  return sc;
}
function mkRenderer(canvas, alpha) {
  const r = new THREE.WebGLRenderer(Object.assign({ antialias: true, alpha: true, preserveDrawingBuffer: !!alpha }, canvas ? { canvas } : {}));
  r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = .95; r.setClearColor(0x000000, 0); r.setPixelRatio(1); return r;
}
let TH = null;
const thumbCache = new Map();
const KINDS = { face: { w: 128, h: 128, cy: .96, d: 1.82, fov: 24, yaw: .12 }, hair: { w: 128, h: 128, cy: .95, d: 1.82, fov: 24, yaw: .75 }, head: { w: 128, h: 128, cy: 1.0, d: 2.15, fov: 24, yaw: .45 }, full: { w: 150, h: 210, cy: .62, d: 3.9, fov: 24, yaw: .3 }, body: { w: 128, h: 128, cy: .55, d: 2.9, fov: 24, yaw: .35 }, back: { w: 128, h: 128, cy: .55, d: 2.9, fov: 24, yaw: 2.5 }, legs: { w: 128, h: 128, cy: .3, d: 2.6, fov: 24, yaw: .35 }, feet: { w: 128, h: 128, cy: .08, d: 1.3, fov: 26, yaw: .6 },
  // 確認用（?test=megrid）：大きめの全身・頭（正面・横・うしろ）
  bF: { w: 220, h: 300, cy: .6, d: 3.85, fov: 24, yaw: 0 }, bS: { w: 220, h: 300, cy: .6, d: 3.85, fov: 24, yaw: 1.5 }, bB: { w: 220, h: 300, cy: .6, d: 3.85, fov: 24, yaw: 3.14 },
  hF: { w: 220, h: 220, cy: .97, d: 1.95, fov: 24, yaw: 0 }, h3: { w: 220, h: 220, cy: .97, d: 1.95, fov: 24, yaw: .75 }, hS: { w: 220, h: 220, cy: .97, d: 1.95, fov: 24, yaw: 1.5 }, hB: { w: 220, h: 220, cy: .97, d: 1.95, fov: 24, yaw: 2.9 } };
// e＝せのたかさでのびた高さ(heightExtra)。顔の絵はその分だけ上を見る（大きさは同じ）。全身の絵は、のびた分の半分上を見て、背が高いときは少し引く
function frameCam(cam, k, e) { const full = k.cy < .7, cy = k.cy + (k.cy < .2 ? 0 : full ? e / 2 : e), d = k.d * (full ? 1 + Math.max(0, e) * .8 : 1); cam.fov = k.fov; cam.aspect = k.w / k.h; cam.position.set(0, cy + .03, d); cam.lookAt(0, cy - .02, 0); cam.updateProjectionMatrix(); }
// me を絵（dataURL）にする。kind: face(顔の正面) / hair(少し横から) / full(全身)。同じ設定は使い回す
export function meThumb(me, kind) {
  kind = kind || 'face'; const m = cleanMe(me) || defaultMe(), key = kind + meKey(m), hit = thumbCache.get(key); if (hit) return hit;
  const k = KINDS[kind]; if (!TH) { const r = mkRenderer(null, true); TH = { r, sc: lit(r), cam: new THREE.PerspectiveCamera(24, 1, .1, 50) }; }
  const { r, sc, cam } = TH; r.setSize(k.w, k.h, false);
  const g = buildMe(m); g.rotation.y = k.yaw; sc.add(g); frameCam(cam, k, heightExtra(m.height)); r.render(sc, cam);
  const url = r.domElement.toDataURL('image/png'); sc.remove(g); thumbCache.set(key, url); return url;
}
const q = []; let qBusy = false;
export function meThumbInto(img, me, kind) {
  const m = cleanMe(me) || defaultMe(), hit = thumbCache.get((kind || 'face') + meKey(m)); if (hit) { img.src = hit; return; }
  q.push([img, m, kind]); if (!qBusy) { qBusy = true; setTimeout(pump, 0); }
}
function pump() {
  const t0 = performance.now();
  while (q.length && performance.now() - t0 < 14) { const [img, m, kind] = q.shift(); try { img.src = meThumb(m, kind); } catch (e) { console.error('meThumb', e); } }
  if (q.length) setTimeout(pump, 0); else qBusy = false;
}
export const faceImg = (me, kind, cls) => { const im = new Image(); im.alt = ''; im.className = cls || 'face'; meThumbInto(im, me, kind); return im; };

// ===== 番号パッド =====
// 4けたを入れる。数字キーパッド（大きいボタン）。Promise<'1234' | null(やめた)>
export function pinPad(title, hint, opt) {
  opt = opt || {};
  return new Promise(res => {
    let v = '', done = false;
    const dots = h('div', { cls: 'pin-dots' }, [0, 1, 2, 3].map(() => h('i')));
    const msg = h('div', { cls: 'pin-msg', text: hint || '' });
    const paint = () => { [...dots.children].forEach((d, i) => d.classList.toggle('on', i < v.length)); };
    const finish = r => { if (done) return; done = true; window.removeEventListener('keydown', onKey, true); closeModal(); res(r); };
    const push = d => { if (v.length >= 4 || done) return; v += d; paint(); if (v.length === 4) setTimeout(() => finish(v), 120); };
    const back = () => { v = v.slice(0, -1); paint(); };
    const onKey = e => { if (e.key >= '0' && e.key <= '9') { push(e.key); e.preventDefault(); e.stopPropagation(); } else if (e.key === 'Backspace') { back(); e.preventDefault(); } else if (e.key === 'Escape') { finish(null); e.stopPropagation(); } };
    const keys = h('div', { cls: 'pin-keys' });
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].forEach(k => keys.appendChild(k === '' ? h('span') : h('button', { cls: 'pin-key' + (k === '⌫' ? ' bk' : ''), text: k, 'aria-label': k === '⌫' ? '1つ消す' : k, onclick: () => (k === '⌫' ? back() : push(k)) })));
    const body = h('div', { cls: 'pin' }, [opt.step ? h('div', { cls: 'pin-step' }, [h('b', { text: opt.step }), h('span', { text: '番号' })]) : null, opt.face ? h('div', { cls: 'pin-who' }, [opt.face, h('b', { text: opt.who || '' })]) : null, dots, msg, keys]);
    modal(title, body, [h('button', { cls: 'btn', text: 'やめる', onclick: () => finish(null) })], 'pinbox');
    window.addEventListener('keydown', onKey, true);
  });
}
// 番号を新しく決める（2回入れて同じならOK）。Promise<'1234' | null>
export async function pinSet(opt) {
  for (;;) {
    const a = await pinPad('4けたの番号を決める', 'ピコを使うときに必要です。忘れたら担任助手がリセットできます', opt); if (a == null) return null;
    const b = await pinPad('もう一度入力', '同じ番号をもう一度', opt); if (b == null) return null;
    if (a === b) return a;
    toast('番号がちがったよ。もういちど', 'ng');
  }
}

// ===== me-作成画面 =====
const EYE_SW = EYE_COLORS.map(c => c || 'linear-gradient(135deg,#2b1e22 50%,#5b8fe0 50%)');
const BROW_SW = ['linear-gradient(135deg,#6b4a2a 50%,#fff 50%)'].concat(HAIR_COLORS);   // 0＝かみと同じ
const ALL_TABS = [
  ['なまえ', [['nick', 'ニックネーム（1〜8もじ）']]],
  ['かみ', [['hair', 'かみがた', HAIR_NAMES, 'hair'], ['hairC', 'かみの色', HAIR_COLORS]]],
  ['かお・め', [['face', 'かおの形', FACE_NAMES, 'face'], ['skin', 'はだの色', SKIN_COLORS], ['eye', 'め', EYE_NAMES, 'face'], ['eyeC', 'めの色', EYE_SW, null, EYEC_NAMES]]],
  ['はな・くち', [['nose', 'はな', NOSE_NAMES, 'face'], ['mouth', 'くち', MOUTH_NAMES, 'face']]],
  ['まゆ・ほっぺ', [['brow', 'まゆ', BROW_NAMES, 'face'], ['browC', 'まゆの色', BROW_SW, null, BROWC_NAMES], ['cheek', 'ほっぺ', CHEEK_NAMES, 'face'], ['mole', 'ほくろ', MOLE_NAMES, 'face']]],
  ['いち・大きさ', ADJ_KEYS.map(([k, label]) => [k, label])],
  ['めがね', [['glasses', 'めがね', GLASSES_NAMES, 'face']]],
  ['からだ', [['height', 'せのたかさ'], ['plump', 'からだつき']]],
  // きせかえは種類ごとのタブ（きせかえ画面・担任助手の me- の画面だけに出す）
  ['ふく', [['top', WEAR_LABEL.top, null, 'body'], ['hood', 'ふくの色（むりょう）', HOOD_COLORS]]],
  ['ボトムス', [['bottom', WEAR_LABEL.bottom, null, 'legs']]],
  ['くつ', [['shoes', WEAR_LABEL.shoes, null, 'feet']]],
  ['ぼうし', [['hat', WEAR_LABEL.hat, null, 'head']]],
  ['アクセ', [['acc', WEAR_LABEL.acc, null, 'body']]],
  ['かばん', [['bag', WEAR_LABEL.bag, null, 'back']]]
];
let MK = null;   // 作成画面（1つだけ）
// opts: {name, me(編集のとき), nextLabel, onDone(me), onCancel(),
//        shop: {owned(k,i), price(k,i), picos(), buy(k,i)=>Promise<bool>}（家の中で開いたときだけ。きせかえを買える）}
export function openMeMaker(opts) {
  closeMeMaker();
  // きせかえは「つくる・つくりなおす」画面には出さない（プロフィールの「きせかえ」から wearOnly で開く）。担任助手の me-（allWear）はぜんぶ
  const isWear = t => t[1].some(([k]) => WEAR_KEYS.includes(k)), TABS = opts.wearOnly ? ALL_TABS.filter(isWear) : opts.allWear ? ALL_TABS : ALL_TABS.filter(t => !isWear(t));
  const me = cleanMe(opts.me) || Object.assign(defaultMe(), opts.start || {}); let nick = cleanNick(opts.nick), tabI = opts.tab | 0, yaw = .4, dirty = true, alive = true;
  const shop = opts.shop || null, worn0 = {}; WEAR_KEYS.forEach(k => { worn0[k] = me[k]; });
  // 持っている＝むりょう・買った・いま着ている物
  // allWear：担任助手のme-は、きせかえをぜんぶ無料で選べる
  const owned = (k, i) => !!opts.allWear || isFreeWear(k, i) || worn0[k] === i || !!(shop && shop.owned(k, i));
  const root = h('div', { id: 'mk' }); $('app').appendChild(root);
  if (opts.top) root.style.zIndex = 48;   // 担任助手モード（シート）の上に開くとき
  const cv = h('canvas', { cls: 'mk-cv' });
  // おまかせ（見た目をランダム）は、きせかえだけの画面では出さない
  const rnd = h('button', { cls: 'btn sm', hidden: opts.wearOnly ? '' : null, text: 'おまかせ', onclick: () => { const keep = { hood: me.hood }; WEAR_KEYS.forEach(k => { keep[k] = me[k]; }); Object.assign(me, randomMe(), keep); refresh(); } });
  const prev = h('div', { cls: 'mk-prev' }, [h('div', { cls: 'mk-cvbox' }, [cv, h('div', { cls: 'mk-hint', text: 'ドラッグでくるくる' })]), h('div', { cls: 'mk-who' }, [h('b', { id: 'mkNick', text: nick || 'なまえ未定' }), rnd])]);
  const tabs = h('div', { cls: 'mk-tabs' }), box = h('div', { cls: 'mk-opts' });
  const foot = h('div', { cls: 'mk-foot' }, [h('button', { cls: 'btn', text: opts.cancelLabel || 'やめる', onclick: () => { closeMeMaker(); opts.onCancel && opts.onCancel(); } }), h('span', { cls: 'sp' }), h('button', { cls: 'btn coral big', text: opts.nextLabel || 'これでけってい', onclick: () => { nick = cleanNick(nick); const np = nickProblem(nick); if (np) { tabI = 0; paintOpts(); toast(np, 'ng'); return; }
    let rev = false; WEAR_KEYS.forEach(k => { if (!owned(k, me[k])) { me[k] = worn0[k]; rev = true; } }); if (rev) toast('買っていない物（試着だけ）は元に戻しました');
    const m = cleanMe(me); closeMeMaker(); opts.onDone && opts.onDone(m, nick); } })]);
  // 進み具合（新しく作るときだけ）：1/3 なまえ → 2/3 見た目 → 3/3 番号
  const steps = /番号/.test(opts.nextLabel || '') ? h('div', { cls: 'mk-steps', role: 'list' }) : null;
  const paintSteps = () => { if (!steps) return; steps.innerHTML = ''; const cur = tabI === 0 ? 0 : 1; [['1/3', 'なまえ', 0], ['2/3', '見た目', 1], ['3/3', '番号', 2]].concat(opts.stepTeam ? [['4/4', 'チーミ', 3]] : []).forEach(([n, t, i]) => { if (i) steps.appendChild(h('i', { cls: 'st-line' + (i <= cur ? ' on' : '') })); steps.appendChild(h('button', { cls: 'st' + (i === cur ? ' now' : i < cur ? ' done' : ''), role: 'listitem', disabled: i >= 2 ? '' : null, onclick: () => { tabI = i === 0 ? 0 : Math.max(1, tabI); paintOpts(); box.scrollTop = 0; } }, [h('b', { text: i < cur ? '✓' : opts.stepTeam ? n.replace(/\/\d/, '/4') : n }), h('span', { text: t })])); }); };
  root.appendChild(h('div', { cls: 'mk-main' }, [prev, h('div', { cls: 'mk-side' }, [opts.banner ? h('div', { cls: 'mk-banner', text: opts.banner }) : null, steps, tabs, box, foot])]));
  // 3Dプレビュー
  const r = mkRenderer(cv, false), sc = lit(r), cam = new THREE.PerspectiveCamera(26, 1, .1, 50); let ch = null;
  const rebuild = () => { if (ch) sc.remove(ch); ch = buildMe(me); sc.add(ch); dirty = true; };
  const resize = () => { const w = cv.parentNode.clientWidth, hh = cv.parentNode.clientHeight; if (!w || !hh) return; r.setPixelRatio(Math.min(2, devicePixelRatio || 1)); r.setSize(w, hh, false); cam.aspect = w / hh; const E = heightExtra(me.height), cy = .62 + E / 2, asp = w / hh; cam.fov = 26; const dist = Math.max(1.7, 1.25 / asp) / (2 * Math.tan(13 * Math.PI / 180)) * 1.12 * (1 + Math.max(0, E) * .8); cam.position.set(0, cy + .1, dist); cam.lookAt(0, cy - .02, 0); cam.updateProjectionMatrix(); dirty = true; };
  const ro = new ResizeObserver(resize); ro.observe(cv.parentNode);
  let drag = null;
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); drag = { x: e.clientX, y0: yaw }; });
  cv.addEventListener('pointermove', e => { if (!drag) return; yaw = drag.y0 + (e.clientX - drag.x) * .012; dirty = true; });
  const up = () => { drag = null; }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  let t0 = performance.now();
  const loop = t => { if (!alive) return; requestAnimationFrame(loop); const dt = (t - t0) / 1000; t0 = t; if (!drag) { /* ゆっくり戻って正面に */ } if (ch) { const bob = Math.sin(t / 700) * .006; ch.rotation.y = yaw; ch.position.y = bob; dirty = true; } if (dirty) { dirty = false; r.render(sc, cam); } };
  requestAnimationFrame(loop);
  const thumbsToFill = [];
  function paintOpts() {
    box.innerHTML = ''; tabs.innerHTML = ''; paintSteps();
    TABS.forEach(([n], i) => tabs.appendChild(h('button', { cls: 'mk-tab' + (i === tabI ? ' on' : ''), text: n, onclick: () => { tabI = i; paintOpts(); box.scrollTop = 0; } })));
    if (TABS[tabI][1].some(([k]) => WEAR_KEYS.includes(k))) box.appendChild(h('div', { cls: 'mk-wallet' }, opts.allWear ? [h('span', { text: '担任助手は、ぜんぶ無料で選べるよ' })] : shop ? [h('span', { text: 'もっているピコ' }), h('b', { text: fmt(shop.picos()) })] : [h('span', { text: 'ためしに着てみられるよ。買うのは、お家に入ってから「me-をかえる」で' })]));
    TABS[tabI][1].forEach(([key, label, list, kind, names]) => {
      box.appendChild(h('div', { cls: 'mk-sec', text: label }));
      if (WEAR_KEYS.includes(key)) { wearSection(key, kind); return; }
      if (key === 'nick') {
        const inp = h('input', { type: 'text', maxlength: '8', placeholder: 'ニックネーム', 'aria-label': 'ニックネーム', autocomplete: 'off', cls: 'mk-nick' }); inp.value = nick;
        inp.addEventListener('input', () => { nick = inp.value.slice(0, 8); const b = $('mkNick'); if (b) b.textContent = cleanNick(nick) || 'なまえ未定'; });
        box.appendChild(inp); box.appendChild(h('div', { cls: 'mk-note', text: '本名は使わないでください。みんなに見えます' }));
        if (opts.cardHint) box.appendChild(h('div', { cls: 'mk-note', text: 'はじめてカードをもらった人は、いったん戻って、ホームの「はじめてカード」から入ってください（担任助手の確認なしですぐピコが使えます）' }));
        return;
      }
      if (key === 'height' || key === 'plump') {
        const isH = key === 'height', lo = isH ? HEIGHT_MIN : 0, hi = isH ? HEIGHT_MAX : 1;
        const inp = h('input', { type: 'range', min: String(lo), max: String(hi), step: '0.01', 'aria-label': label }); inp.value = String(me[key]);
        inp.addEventListener('input', () => { me[key] = +inp.value; if (isH) { resize(); } rebuild(); });
        box.appendChild(h('div', { cls: 'mk-slider' }, [h('span', { text: isH ? 'ちいさめ' : 'ほっそり' }), inp, h('span', { text: isH ? 'おおきめ' : 'ぽっちゃり' })]));
        return;
      }
      const adj = ADJ_KEYS.find(a => a[0] === key);
      if (adj) {   // パーツの位置・大きさ（-1〜1）。動かすと、顔が見えるように少し寄る
        const inp = h('input', { type: 'range', min: '-1', max: '1', step: '0.05', 'aria-label': label }); inp.value = String(me[key] || 0);
        inp.addEventListener('input', () => { me[key] = +inp.value; rebuild(); });
        box.appendChild(h('div', { cls: 'mk-slider' }, [h('span', { text: adj[2] }), inp, h('span', { text: adj[3] })]));
        if (key === ADJ_KEYS[ADJ_KEYS.length - 1][0]) box.appendChild(h('div', { cls: 'acts-row' }, [h('button', { cls: 'btn sm', text: 'ぜんぶ ふつうにもどす', onclick: () => { ADJ_KEYS.forEach(([k]) => { delete me[k]; }); rebuild(); paintOpts(); } })]));
        return;
      }
      const grid = h('div', { cls: kind ? 'mk-grid' : 'mk-sw' });
      list.forEach((v, i) => {
        if (!kind) { grid.appendChild(h('button', { cls: 'mk-swatch' + (me[key] === i ? ' on' : ''), style: 'background:' + v, 'aria-label': label + ' ' + (names ? names[i] : i + 1), title: names ? names[i] : '', onclick: () => pick(key, i) })); return; }
        const im = new Image(); im.alt = ''; im.width = 56; im.height = 56; thumbsToFill.push([im, key, i, kind]);
        grid.appendChild(h('button', { cls: 'mk-tile' + (me[key] === i ? ' on' : ''), onclick: () => pick(key, i) }, [im, h('span', { text: v })]));
      });
      box.appendChild(grid);
    });
    thumbsToFill.splice(0).forEach(([im, key, i, kind]) => meThumbInto(im, Object.assign({}, me, { [key]: i }), kind));
  }
  // きせかえ：さわると試着。持っていない物を着ているときは「買う」ボタンが出る
  function wearSection(key, kind) {
    const cur = me[key];
    if (!owned(key, cur)) {
      const name = WEAR[key][cur][0];
      box.appendChild(h('div', { cls: 'mk-buy' }, [h('span', { cls: 'nm', text: '試着中：' + name }),
        shop ? h('button', { cls: 'btn coral sm', text: fmt(shop.price(key, cur)) + ' ピコで買う', onclick: async () => { if (await shop.buy(key, cur)) { toast(name + 'を購入しました', 'ok'); paintOpts(); } } })
          : h('span', { cls: 'mk-note', text: '家で買えます' })]));
    }
    const grid = h('div', { cls: 'mk-grid' });
    WEAR[key].forEach(([name], i) => {
      if (isStaffWear(key, i) && !opts.allWear) return;   // スーツは担任助手モードの me- だけ
      const im = new Image(); im.alt = ''; im.width = 56; im.height = 56; thumbsToFill.push([im, key, i, kind]);
      const have = owned(key, i), sub = have ? (cur === i ? 'きている' : isStaffWear(key, i) ? '担任助手' : isFreeWear(key, i) ? 'むりょう' : 'もってる') : (shop ? fmt(shop.price(key, i)) + 'ピコ' : '試着できる');
      grid.appendChild(h('button', { cls: 'mk-tile wear' + (cur === i ? ' on' : '') + (have ? '' : ' lock'), onclick: () => pick(key, i) }, [im, h('span', { text: name }), h('i', { cls: 'pr', text: sub })]));
    });
    box.appendChild(grid);
  }
  function pick(key, i) { if (me[key] === i) return; me[key] = i; rebuild(); paintOpts(); }
  function refresh() { rebuild(); resize(); paintOpts(); }
  MK = { root, close() { alive = false; ro.disconnect(); r.dispose(); root.remove(); } };
  refresh();
}
export function closeMeMaker() { if (MK) { MK.close(); MK = null; } }
export const meMakerOpen = () => !!MK;
