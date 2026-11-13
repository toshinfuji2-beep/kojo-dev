// 向上ハウス 3D版：チーミ（班）で1つの家を作る。ピコは個人の財布、チーミは貯金箱。ゲームロジック＋three.js 描画
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CFG, CATS, ITEMS, ITEM, entranceOf, layoutCost, layoutCheck, itemsFit, houseBox, roomAt, wallGaps, wallAllOuter, wallPlan, pairKey, edgesOf, LAYOUT_ERR, migrateRooms } from './data.js?v=202611131634';
import { E, cam, WH, initScene, setQuality, qualityDefault, resize, resetCam, addYaw, orbit, setZoom, updateCamera, renderFrame, rayAt, project, setPointLights, flickerLights, buildHouse, showGrid, setCamMode, setNight } from './scene.js?v=202611131634';
import { buildItem, fallbackIds } from './models.js?v=202611131634';
import { swatchCanvas } from './textures.js?v=202611131634';
import { M, MF, G, box, rbox, sph, cyl, cone } from './mk.js?v=202611131634';
import * as store from './store.js?v=202611131634';
import { $, h, fmt, modal, closeModal, confirmDlg, toast, emptyBox} from './ui.js?v=202611131634';
import { setInfoSeen } from './screens.js?v=202611131634';
import { ctx as screenCtx, chooseTeam, renderLoading, renderSelect, openRanking, teamDetailDlg, showTeamMembers } from './screens.js?v=202611131634';
import { buildMe, AV } from './avatar.js?v=202611131634';
import { seededMe, randomMe, nickOf, cleanMe, pinHash, checkPin, WEAR, ME_COUNT } from './me.js?v=202611131634';
import { meThumb, faceImg, pinPad, pinSet, openMeMaker, closeMeMaker } from './meui.js?v=202611131634';
import { planScores } from './parse.js?v=202611131634';
import { todayStr, phaseOf, localTeamStatus, rangeText, condText } from './mission.js?v=202611131634';
import { dailyAdd, dailyUsed, dailyWarn, dailyStatus } from './daily.js?v=202611131634';
import { chooseOperator } from './admin2.js?v=202611131634';
import { actx, openAdminGate, openAdmin, openQuickTeam, adminPreset } from './admin.js?v=202611131634';
import { openPlan } from './plan.js?v=202611131634';
import { coachSeen, setCoachSeen, startCoach, coachOpen, confetti, flyCoins, sparkleAt, bounceEl, motionOK, readSeen, writeSeen, gainBreakdown, welcomeBack, celebrate } from './guide.js?v=202611131634';
import { MODE } from './mode.js?v=202611131634';
import { SV, SvError, svInit, pull as svPull, rpc as svRpc, adminRpc, errText, subscribe as svSubscribe, getMyUid, setMyUid, admLoad, mergeAdmin, vaultRestore, vaultSoon, slotsSync, NEED_UPDATE, loadServerInfo, admSaveLocal } from './server.js?v=202611131634';
import { openStaffDesk } from './staffdesk.js?v=202611131634';

const QKEY = 'kojoHouse.quality';

function showErr(msg) { const el = $('err'); if (!el) return; el.hidden = false; el.textContent = 'ERR: ' + msg; console.error('ERR', msg); }
window.addEventListener('error', e => showErr(e.message + ' @' + (e.lineno || '')));
window.addEventListener('unhandledrejection', e => showErr(String(e.reason && e.reason.message || e.reason)));

// ===== 状態 =====
// S = 全体（名簿・チーミ・設定）。T = いま遊んでいるチーミ（家・所持ピコ）。保存層は store.js
let uidN = 1;
function inst(id, x, y, rot) { return { uid: uidN++, id, x, y, rot: rot || 0 }; }
function winst(id, wall, pos, z) { return { uid: uidN++, id, wall, pos, z }; }
const newRoom = store.newRoom;
let S = store.load(); uidN = S.uid || 1;
const TESTQ = new URLSearchParams(location.search).get('test');
const DEMOQ = new URLSearchParams(location.search).get('demo');   // ?demo=katsumata : 勝又チーミのお試しの家（サーバーに送らない・保存しない）
let demoMode = false;
let T = null, me = null, adminOn = false, noSave = !!TESTQ || !!DEMOQ;   // me = いま遊んでいる生徒
let saveT = 0;
function save() { if (SV.on) { if (T && me) commitSoon(); return; } clearTimeout(saveT); saveT = setTimeout(saveNow, 200); }
function saveNow() { if (noSave || SV.on) return; S.uid = uidN; store.save(S); }
const mul = () => S.settings.priceMul;
const priceOf = d => Math.round(d.price * mul());
const room = () => T.rooms[S.cur.room];
const N = r => (r || room()).w;   // （テスト用：正方形の部屋の一辺）
const sq = (rm, n) => { rm.w = rm.d = n; };
// 玄関：この部屋にあれば、家具を置けないマス。なければ null
let entCache = { key: '', e: null };
function entRect(rm) {
  const k = T.rooms.map(r => r.x + ',' + r.z + ',' + r.w + ',' + r.d).join(';'); if (entCache.key !== k) entCache = { key: k, e: entranceOf(T.rooms) };
  const e = entCache.e; if (!e) return null; const r = T.rooms[e.k]; return r.x === rm.x && r.z === rm.z ? e.rect : null;
}
const roomIdxOf = rm => T.rooms.findIndex(r => r.x === rm.x && r.z === rm.z);
function rankIdx(t) { let r = 0; CFG.RANKS.forEach((k, i) => { if (t >= k.min * mul()) r = i; }); return r; }
const curRank = () => rankIdx(me ? me.earned || 0 : 0);
let quality = qualityDefault();
try { const q = localStorage.getItem(QKEY); if (q === 'std' || q === 'high') quality = q; } catch (e) { }

// ===== サウンド・トースト =====
let AC = null;
function tone(f, t0, dur, type, vol) {
  try {
    if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
    const o = AC.createOscillator(), g = AC.createGain(); o.type = type || 'triangle'; o.frequency.value = f;
    const t = AC.currentTime + t0; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol || .12, t + .01); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + dur + .02);
  } catch (e) { }
}
function sfx(k) {
  if (!S.sound) return;
  if (k === 'buy') { tone(880, 0, .12); tone(1320, .08, .2); }
  else if (k === 'place') { tone(300, 0, .09, 'square', .06); tone(420, .06, .12, 'triangle'); }
  else if (k === 'ng') tone(180, 0, .18, 'sawtooth', .06);
  else if (k === 'coin') { tone(988, 0, .1); tone(1318, .09, .1); tone(1568, .18, .25); }
  else if (k === 'rank') { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * .1, .25)); }
  else if (k === 'tap') tone(660, 0, .05, 'triangle', .05);
  else if (k === 'boing') { tone(520, 0, .08, 'sine', .1); tone(780, .07, .12, 'sine', .1); }
}
function floatText(txt, cls) {
  const r = $('ptsBox').getBoundingClientRect(); const e = h('div', { cls: 'fl ' + cls, text: txt });
  e.style.left = (r.left + r.width / 2 - 30) + 'px'; e.style.top = (r.bottom - 4) + 'px'; document.body.appendChild(e); setTimeout(() => e.remove(), 1200);
}
// ===== 手ごたえの動き（音オフ・動きを減らす設定を尊重：sfx は S.sound、動きは motionOK） =====
const rectOf2 = el => el && el.getBoundingClientRect ? el.getBoundingClientRect() : null;
function coinOut() { const e = $('ptsBox'); flyCoins(rectOf2(e), $('bankBox'), 4); bounceEl($('bankBox')); }
function donateFx() { flyCoins(rectOf2($('ptsBox')), $('bankBox'), 6); bounceEl($('bankBox')); }
function sparkleItem(i) { try { const d = ITEM[i.id]; const r = cv.getBoundingClientRect(); let p; if (d.wall) return; const rm = room(); const [w, dd] = dims(d, i.rot); p = project(new THREE.Vector3(i.x + w / 2, .5, i.y + dd / 2).add(E.fxG ? E.fxG.position : new THREE.Vector3())); sparkleAt(r.left + p[0], r.top + p[1]); } catch (e) { } }
let dispPts = 0, lastPicosT = null, lastPicosUid = null;
function addPts(n) {
  me.picos += n; lastPicosT = me.picos; floatText((n > 0 ? '+' : '') + fmt(n) + ' ピコ', n > 0 ? 'p' : 'm');
  $('coin').classList.remove('bump'); void $('coin').offsetWidth; $('coin').classList.add('bump');
}

// ===== 配置判定 =====
// rot = 0〜3（0°・90°・180°・270°）。90°と270°のときは幅と奥行きが入れかわる
function dims(d, rot) { return (rot || 0) % 2 ? [d.d, d.w] : [d.w, d.d]; }
const rotY = rot => (rot || 0) * Math.PI / 2;
const nextRot = rot => ((rot || 0) + 1) % 4;
function rectOf(i) { const d = ITEM[i.id], [w, dd] = dims(d, i.rot); return { x0: i.x, y0: i.y, x1: i.x + w, y1: i.y + dd }; }
const ovl = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const isFloor = i => !ITEM[i.id].wall;
const isBig = i => isFloor(i) && !ITEM[i.id].small && !ITEM[i.id].ceil && ITEM[i.id].cat !== 'rug';
const surfZ = d => d.sh != null ? d.sh : d.h;
function hostAt(items, cx, cy) {
  const cell = { x0: cx, y0: cy, x1: cx + 1, y1: cy + 1 };
  return items.find(i => isBig(i) && ITEM[i.id].surface && ovl(rectOf(i), cell));
}
function placeCheck(rm, d, x, y, rot, ign) {
  const [w, dd] = dims(d, rot);
  if (x < 0 || y < 0 || x + w > rm.w || y + dd > rm.d) return { ok: false, why: '部屋の外には置けません' };
  const R = { x0: x, y0: y, x1: x + w, y1: y + dd }, er = entRect(rm);
  if (!d.ceil && er && ovl(R, er)) return { ok: false, why: '玄関には置けません' };   // 玄関のマスは通り道
  if (d.cat === 'rug') return { ok: true, z: 0 };
  const its = rm.items.filter(i => i.uid !== ign && isFloor(i));
  if (d.ceil) { for (const i of its) if (ITEM[i.id].ceil && ovl(rectOf(i), R)) return { ok: false, why: 'ほかの物があります' }; return { ok: true, z: 0 }; }
  if (!d.small) { for (const i of its) if (ITEM[i.id].cat !== 'rug' && !ITEM[i.id].ceil && ovl(rectOf(i), R)) return { ok: false, why: 'ほかの物があります' }; return { ok: true, z: 0 }; }
  let z = null;
  for (let cx = x; cx < x + w; cx++) for (let cy = y; cy < y + dd; cy++) {
    const cell = { x0: cx, y0: cy, x1: cx + 1, y1: cy + 1 };
    for (const i of its) if (ITEM[i.id].small && ovl(rectOf(i), cell)) return { ok: false, why: 'ほかの物があります' };
    const bigs = its.filter(i => isBig(i) && ovl(rectOf(i), cell));
    let lv = 0;
    if (bigs.length) { if (bigs.length === 1 && ITEM[bigs[0].id].surface) lv = surfZ(ITEM[bigs[0].id]); else return { ok: false, why: 'ここには置けません' }; }
    if (z === null) z = lv; else if (z !== lv) return { ok: false, why: 'ここには置けません' };
  }
  if ((z || 0) + d.h > WH + .001) return { ok: false, why: '高すぎて置けません' };
  return { ok: true, z: z || 0 };
}
function wallCheck(rm, d, wall, pos, z, ign) {
  const n = wall === 'L' ? rm.d : rm.w;
  if (pos < -0.001 || pos + d.w > n + .001) return { ok: false, why: '壁の外には置けません' };
  if (z < 0 || z + d.h > WH + .001) return { ok: false, why: '壁の外には置けません' };
  { const ri = roomIdxOf(rm); if (ri >= 0) for (const [g0, g1] of wallGaps(T.rooms, T.open, ri)[wall] || []) if (pos < g1 - .001 && g0 < pos + d.w - .001) return { ok: false, why: 'ドアの所には掛けられません' }; }
  for (const i of rm.items) if (i.uid !== ign && i.wall === wall) {
    const e = ITEM[i.id]; if (pos < i.pos + e.w && i.pos < pos + d.w && z < i.z + e.h && i.z < z + d.h) return { ok: false, why: 'ほかの物があります' };
  }
  return { ok: true };
}
function blockedSet(rm, ign) {
  const s = new Set();
  rm.items.forEach(i => { if (i.uid !== ign && isBig(i)) { const r = rectOf(i); for (let x = r.x0; x < r.x1; x++) for (let y = r.y0; y < r.y1; y++) s.add(x + ',' + y); } });
  return s;
}
// extra = 家具以外に通れないマス（ほかの人がいるマスなど）
function bfs(rm, sx, sy, tx, ty, extra) {
  const bl = blockedSet(rm), key = (x, y) => x + ',' + y;
  if (extra) extra.forEach(k => bl.add(k));
  if (bl.has(key(tx, ty)) || tx < 0 || ty < 0 || tx >= rm.w || ty >= rm.d) return null;
  const prev = new Map(); prev.set(key(sx, sy), null); const q = [[sx, sy]];
  while (q.length) {
    const [x, y] = q.shift(); if (x === tx && y === ty) break;
    // ななめにも歩ける（ただし角をすり抜けないよう、となり2マスがどちらも空いているときだけ）
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = x + dx, ny = y + dy, k = key(nx, ny);
      if (nx < 0 || ny < 0 || nx >= rm.w || ny >= rm.d || bl.has(k) || prev.has(k)) continue;
      if (dx && dy && (bl.has(key(x + dx, y)) || bl.has(key(x, y + dy)))) continue;
      prev.set(k, [x, y]); q.push([nx, ny]);
    }
  }
  if (!prev.has(key(tx, ty))) return null;
  const path = []; let c = [tx, ty]; while (c) { path.unshift(c); c = prev.get(key(c[0], c[1])); }
  path.shift(); return path;
}
function freeCellNear(rm, x, y, extra) {
  const bl = blockedSet(rm); let best = null, bd = 1e9;
  if (extra) extra.forEach(k => bl.add(k));
  for (let cx = 0; cx < rm.w; cx++) for (let cy = 0; cy < rm.d; cy++) if (!bl.has(cx + ',' + cy)) { const dd = Math.abs(cx - x) + Math.abs(cy - y); if (dd < bd) { bd = dd; best = [cx, cy]; } }
  return best || [0, 0];
}

// ===== アバター（ロジック）：チーミ全員が家の中を歩く =====
const MAXAV = 24;                      // 描画する最大人数（それ以上は省略）
let AVS = [];                          // 歩く人たちの状態 {id,name,x,y,path,dir,t,idle,moving,ry,g,legs,arms,body,head}
const fnv = s => { let x = 2166136261; for (const c of String(s)) { x ^= c.charCodeAt(0); x = Math.imul(x, 16777619) >>> 0; } return x >>> 0; };
const HOODS = ['#a8e6cf', '#f7a8a0', '#ffd98a', '#a9c8f2', '#cdb4f0', '#f5b7d3', '#ffb98a', '#b8e0a0', '#8fd8e0', '#e8d0a8', '#d9a0a0', '#9fb0e8'];
const HAIRS = ['#a9794f', '#5a3e2b', '#2f2622', '#c9955c', '#7a4b3a', '#d7b26d', '#3d3a4f'];
const studentById = uid => S.students.find(s => s.uid === uid);
function randomFreeCells(rm, k) {
  const bl = blockedSet(rm), cells = [];
  for (let x = 0; x < rm.w; x++) for (let y = 0; y < rm.d; y++) if (!bl.has(x + ',' + y)) cells.push([x, y]);
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [cells[i], cells[j]] = [cells[j], cells[i]]; }
  return cells.length ? Array.from({ length: k }, (_, i) => cells[i % cells.length]) : Array.from({ length: k }, () => [0, 0]);
}
function rebuildAvatars() {
  AVS.forEach(a => E.fxG.remove(a.g)); AVS = [];
  const sts = T ? T.members.map(studentById).filter(Boolean).slice(0, MAXAV) : [];
  if (T && me && me.staff) sts.push(me);   // 見に来ている担任助手も、★つきの名札で部屋を歩く
  const few = sts.length <= 10;
  sts.forEach(st => {
    const id = st.uid, g = makeAvatar(st); g.traverse(o => { if (o.isMesh) o.castShadow = few; });
    E.fxG.add(g);
    const dir = (fnv(id) >>> 3) % 2, tr = idleFace();
    AVS.push({ id, name: nickOf(st), x: 1.5, y: 3.5, path: [], dir, t: Math.random() * 10, idle: 1 + Math.random() * 4, moving: false, ry: tr, tr, react: 0, g, legs: [g.getObjectByName('legL'), g.getObjectByName('legR')], arms: [g.getObjectByName('armL'), g.getObjectByName('armR')], body: g.getObjectByName('body'), head: g.getObjectByName('head') });
  });
  placeAvatars();
}
function placeAvatars() {
  if (!T) return; const rm = room(), cells = randomFreeCells(rm, AVS.length);
  AVS.forEach((a, i) => { a.x = cells[i][0] + .5; a.y = cells[i][1] + .5; a.path = []; a.moving = false; a.res = null; a.wait = 0; });
  cam.dirty = true;
}
// 視点を変えたら、しばらく（8秒）みんなその場で向きを保つ：見たい顔がすぐそっぽを向かないように
let holdUntil = 0;
const holdAvatars = () => { holdUntil = performance.now() + 8000; };
// 人どうしがすり抜けないように：ほかの人が「いるマス」と「これから入るマス(res)」は通れない
const ck = (x, y) => x + ',' + y;
function avCells(self) {
  const s = new Set();
  AVS.forEach(b => { if (b === self) return; s.add(ck(Math.floor(b.x), Math.floor(b.y))); if (b.res) s.add(b.res); });
  return s;
}
function avCell(a) { const r = room(); return [Math.max(0, Math.min(r.w - 1, Math.floor(a.x))), Math.max(0, Math.min(r.d - 1, Math.floor(a.y)))]; }
function walkTo(tx, ty, silent) {
  const rm = room(); let best = null, bd = 1e9;
  const mine = me && AVS.find(a => a.id === me.uid);
  if (mine) best = mine; else AVS.forEach(a => { const d = Math.hypot(a.x - tx - .5, a.y - ty - .5) + (a.path.length ? .5 : 0); if (d < bd) { bd = d; best = a; } });
  if (!best) return;
  const [sx, sy] = avCell(best);
  const p = bfs(rm, sx, sy, tx, ty, avCells(best)); if (!p) { if (!silent) sfx('ng'); return; }
  best.path = p; best.res = null; best.wait = 0; if (!silent) sfx('tap');
}
// 向き：ry=0 で +y（手前）向き、π/2 で +x 向き。かべは x=0 と y=0 の2面。
// 立ち止まっているときは、かべ側を向かない（0〜π/2 の手前側だけ）。歩いているときは360度どの向きでもよい
const wrapA = v => Math.atan2(Math.sin(v), Math.cos(v));
const FACE_MAX = Math.PI / 2;
function standFace(v) {
  v = wrapA(v); if (v >= 0 && v <= FACE_MAX) return v;
  return Math.abs(wrapA(v)) <= Math.abs(wrapA(v - FACE_MAX)) ? 0 : FACE_MAX;
}
const idleFace = () => Math.random() * FACE_MAX;
function updateAvatar(a, dt) {
  a.t += dt;
  if (a.react > 0) { a.moving = false; return; }   // タップされて反応している間は、その場で止まる
  if (a.path.length) {
    const tg = a.path[0], k = ck(tg[0], tg[1]);
    if (a.res !== k) {   // 次のマスに入る前に、空いているか確かめて予約する
      const [cx, cy] = avCell(a), ddx = tg[0] - cx, ddy = tg[1] - cy, occ = avCells(a);
      // ななめに進むときは、角のとなり2マスにも人がいないこと（人の角をすり抜けない）
      if (occ.has(k) || (ddx && ddy && (occ.has(ck(cx + ddx, cy)) || occ.has(ck(cx, cy + ddy))))) {
        a.moving = false; a.wait = (a.wait || 0) + dt;
        if (a.wait > .7) {   // しばらく空かなければ、人をよけて道を探し直す（だめなら止まる）
          a.wait = 0; const [cx, cy] = avCell(a), dest = a.path[a.path.length - 1];
          const p = bfs(room(), cx, cy, dest[0], dest[1], avCells(a)); a.path = p && p.length ? p : [];
          if (!a.path.length) a.tr = standFace(a.tr);
        }
        return;
      }
      a.res = k; a.wait = 0;
    }
    const tx = tg[0] + .5, ty = tg[1] + .5, dx = tx - a.x, dy = ty - a.y, dist = Math.hypot(dx, dy), sp = 3.2 * dt;
    a.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 2) : (dy > 0 ? 1 : 3);
    if (dist > 1e-4) a.tr = Math.atan2(dx, dy);   // 進む向きそのまま（ななめも）
    if (dist <= sp) { a.x = tx; a.y = ty; a.path.shift(); a.res = null; } else { a.x += dx / dist * sp; a.y += dy / dist * sp; }
    a.moving = true; a.idle = 2 + Math.random() * 5;
  } else {
    a.moving = false; a.idle -= dt;
    a.tr = standFace(a.tr);   // 止まったら、かべ側を向いていれば手前へ向き直る
    if (a.idle <= 0) {
      a.idle = 2 + Math.random() * 5;
      // 自分のme-は、さわって歩かせたとき以外は動かない（向きも変えない）。
      // ほかの人も、視点を変えた直後（holdUntil まで）は、その場で向きを保つ
      if ((me && a.id === me.uid) || performance.now() < holdUntil) return;
      if (Math.random() < .55) { // ぶらぶら歩く
        const rm = room(), [cx, cy] = avCell(a);
        const tx = Math.max(0, Math.min(rm.w - 1, cx + (Math.random() * 7 | 0) - 3)), ty = Math.max(0, Math.min(rm.d - 1, cy + (Math.random() * 7 | 0) - 3));
        const p = bfs(rm, cx, cy, tx, ty, avCells(a)); if (p && p.length) a.path = p;
      } else { a.dir = (a.dir + 1 + (Math.random() * 3 | 0)) % 4; a.tr = idleFace(); }
    }
  }
}

// ===== アバター（3Dモデル：オリジナルの学生くん）=====
// 名前ラベル：canvasに文字を描いてSpriteにする（フォントはOS標準の日本語フォント）
// 担任助手（名前が★で始まる）は、金色の★と金のふちどりで目立たせる
function nameSprite(name, mine) {
  const staff = name.startsWith('★'), body = staff ? name.slice(1) : name;
  const cv = document.createElement('canvas'), c = cv.getContext('2d'), font = '800 40px "Hiragino Maru Gothic ProN","Yu Gothic UI","Meiryo","Noto Sans JP",sans-serif';
  c.font = font; const sw = staff ? 44 : 0, tw = Math.min(480, Math.ceil(c.measureText(body).width)); cv.width = tw + 40 + sw; cv.height = 68;
  c.font = font; c.fillStyle = staff ? 'rgba(255,248,222,.98)' : 'rgba(255,252,244,.97)'; c.strokeStyle = staff ? '#e0a820' : mine ? '#f2877a' : '#b98650'; c.lineWidth = staff ? 6 : 4;
  c.beginPath(); if (c.roundRect) c.roundRect(3, 3, cv.width - 6, 62, 26); else c.rect(3, 3, cv.width - 6, 62); c.fill(); c.stroke();
  c.textBaseline = 'middle'; c.textAlign = 'center';
  if (staff) { c.fillStyle = '#f0b400'; c.fillText('★', 20 + sw / 2, 36); }
  c.fillStyle = '#3d2e22'; c.fillText(body, sw + (cv.width - sw) / 2, 36, 480);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, toneMapped: false }));
  sp.userData.ar = cv.width / 68; sp.scale.set(sp.userData.ar * .27, .27, 1); sp.center.set(.5, 0); sp.position.y = 1.36; sp.renderOrder = 20; return sp;
}
// 頭の上の名前札は、遠くても近くても同じ見た目の大きさ（画面の高さに合わせて20〜28px）に保つ
const _lv = new THREE.Vector3();
let pops = [];   // 置いた家具がぽんと弾むアニメ
function stepPops(dt) {
  if (!pops.length) return; cam.dirty = true;
  pops = pops.filter(p => { const g = objs.get(p.uid); p.t += dt; if (!g) return p.t < .3; const k = Math.min(1, p.t / .38); g.scale.setScalar(1 + .14 * Math.sin(k * Math.PI) * (1 - k * .4)); if (k >= 1) g.scale.setScalar(1); return k < 1; });
}
function scaleLabels() {
  const c = E.camera, e5 = c.projectionMatrix.elements[5], px = Math.max(20, Math.min(28, E.H * .03));
  AVS.forEach(a => { const sp = a.g.userData.lbl; if (!sp) return; sp.getWorldPosition(_lv); const d = _lv.distanceTo(c.position), wh = Math.max(.12, Math.min(.8, px * d * 2 / (E.H * e5))); sp.scale.set(sp.userData.ar * wh, wh, 1); });
}
function makeAvatar(st) {
  const m = cleanMe(st.me) || seededMe(st.uid), g = buildMe(m);
  const sp = nameSprite(nickOf(st).slice(0, 10), !!(me && st.uid === me.uid)); sp.position.y = AV.label * g.userData.h; g.userData.lbl = sp; g.add(sp); return g;
}
const DIR_RY = [Math.PI / 2, 0, -Math.PI / 2, Math.PI];
function updateAvatarObj(a, dt) {
  const tgt = a.tr == null ? DIR_RY[a.dir] : a.tr; let d = wrapA(tgt - a.ry);
  if (Math.abs(d) > .005) a.ry = wrapA(a.ry + d * Math.min(1, dt * (a.react > 0 ? 18 : 12))); else a.ry = tgt;
  const sw = a.moving ? Math.sin(a.t * 14) : 0, br = Math.sin(a.t * 2.2);
  let hop = a.moving ? Math.abs(Math.sin(a.t * 14)) : 0, lift = hop * .09, armZ = 0, squash = 0, tilt = 0;
  if (a.react > 0) {   // タップされた反応：ぴょんと跳ねて、片手をふり、首をかしげる
    a.react = Math.max(0, a.react - dt); const p = 1 - a.react / REACT_T;
    const j = p < .45 ? Math.sin(p / .45 * Math.PI) : 0;           // 1回ぴょん
    lift = j * .22; squash = p < .08 ? p / .08 : p < .45 ? 1 - j : 0;   // 跳ぶ前に少しかがむ
    armZ = Math.min(1, p * 5) * Math.min(1, a.react * 4);           // 手をあげて、終わりにおろす
    tilt = Math.sin(Math.min(1, p * 1.6) * Math.PI) * .22;
    if (a.fx) { a.fx.position.y = (AV.fx + p * .45) * (a.g.userData.h || 1); a.fx.material.opacity = Math.min(1, (1 - p) * 3); a.fx.scale.setScalar(.32 * Math.min(1, p * 6)); }
    if (!a.react && a.fx) { a.g.remove(a.fx); a.fx.material.dispose(); a.fx = null; }
  }
  a.legs[0].rotation.x = sw * .65; a.legs[1].rotation.x = -sw * .65; a.arms[0].rotation.x = -sw * .6; a.arms[1].rotation.x = sw * .6;
  a.arms[0].rotation.z = -.12; a.arms[1].rotation.z = .12 + armZ * (2.5 + Math.sin(a.t * 18) * .35);
  const sq = squash * .1;
  a.body.scale.set(1 + (a.moving ? hop * -.03 : br * -.008) + sq * .6, 1 + (a.moving ? hop * .04 : br * .016) - sq, 1 + (a.moving ? hop * -.03 : br * -.008) + sq * .6);
  a.head.rotation.z = a.moving ? Math.sin(a.t * 14) * .06 : Math.sin(a.t * 1.1) * .025 + tilt; a.head.position.y = (a.head.userData.baseY || .8) + (a.moving ? hop * .012 : br * .004);
  a.g.position.set(a.x, lift, a.y); a.g.rotation.y = a.ry;
}
// me-をタップしたときの反応。カメラの方を向いて、ぴょん＋手をふる＋頭の上に ♪
const REACT_T = 1.1;
let noteTex = null;
function reactAvatar(a) {
  if (!noteTex) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 96; const c = cv.getContext('2d');
    c.font = '800 72px "Segoe UI Symbol","Hiragino Maru Gothic ProN","Yu Gothic UI",sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 8; c.strokeStyle = '#fffaf0'; c.strokeText('♪', 48, 52); c.fillStyle = '#f2877a'; c.fillText('♪', 48, 52);
    noteTex = new THREE.CanvasTexture(cv); noteTex.colorSpace = THREE.SRGBColorSpace;
  }
  if (!a.fx) { a.fx = new THREE.Sprite(new THREE.SpriteMaterial({ map: noteTex, transparent: true, depthTest: false, toneMapped: false })); a.fx.renderOrder = 21; a.fx.position.x = .28; a.g.add(a.fx); }
  const cp = E.fxG.worldToLocal(E.camera.position.clone());
  a.tr = Math.atan2(cp.x - a.x, cp.z - a.y);   // カメラ（見ている人）の方へ
  a.react = REACT_T; a.idle = Math.max(a.idle, 3); cam.dirty = true; sfx('boing');
}
function hitAvatar(px, py) {
  if (!AVS.length) return null;
  const hits = rayAt(px, py).intersectObjects(AVS.map(a => a.g), true);
  for (const h of hits) { let o = h.object; while (o && !AVS.some(a => a.g === o)) o = o.parent; if (o) return { a: AVS.find(a => a.g === o), dist: h.distance }; }
  return null;
}

// ===== 3Dワールド =====
const objs = new Map();
let needSync = true, lightList = [], anims = [], hiG = null, hiArrow = null, hiBase = 0, ghostG = null;
const invalidate = () => { needSync = true; cam.dirty = true; };
function placeObj(g, i, d, rm) {
  rm = rm || room();
  if (i.wall) {
    if (i.wall === 'L') { g.position.set(0, i.z, i.pos + d.w); g.rotation.y = Math.PI / 2; } else { g.position.set(i.pos, i.z, 0); g.rotation.y = 0; }
  } else {
    const [w, dd] = dims(d, i.rot); let y = 0;
    if (d.small) { const host = hostAt(rm.items, i.x, i.y); if (host) y = surfZ(ITEM[host.id]); }
    g.position.set(i.x + w / 2, y, i.y + dd / 2); g.rotation.y = rotY(i.rot);
  }
}
// 壁かけが入口・壁なしの所にかかっていないか（かかっていれば隠す）
const inGap = (gaps, i, d) => (gaps[i.wall] || []).some(([g0, g1]) => i.pos < g1 - .001 && g0 < i.pos + d.w - .001);
function sync() {
  needSync = false;
  while (E.itemsG.children.length) E.itemsG.remove(E.itemsG.children[0]);
  while (E.othersG.children.length) E.othersG.remove(E.othersG.children[0]);
  objs.clear(); anims = []; const ls = [], cur = S.cur.room;
  const gaps = wallGaps(T.rooms, T.open, cur);
  room().items.forEach(i => {
    const d = ITEM[i.id]; const g = buildItem(d); g.userData.uid = i.uid; placeObj(g, i, d);
    if (i.wall && inGap(gaps, i, d)) g.visible = false;
    E.itemsG.add(g); objs.set(i.uid, g); if (g.userData.anim) anims.push(g);
  });
  E.itemsG.updateMatrixWorld(true);
  objs.forEach(g => { const l = g.userData.light; if (l && g.visible) ls.push({ pos: g.localToWorld(new THREE.Vector3(l.x, l.y, l.z)), color: l.color, intensity: l.intensity, dist: l.dist, flicker: l.flicker }); });
  ls.sort((a, b) => b.intensity - a.intensity);
  // ほかの部屋の家具（選べない。タップするとその部屋に移る）。腰の壁になる所の壁かけは隠す
  T.rooms.forEach((rm, ri) => {
    if (ri === cur) return;
    const grp = new THREE.Group(); grp.position.set(rm.x, 0, rm.z); grp.userData.roomIdx = ri; const og = wallGaps(T.rooms, T.open, ri), lo = [];
    rm.items.forEach(i => {
      const d = ITEM[i.id]; if (!d) return;
      if (i.wall && (!wallAllOuter(T.rooms, ri, i.wall, i.pos, d.w) || inGap(og, i, d))) return;
      const g = buildItem(d); placeObj(g, i, d, rm); grp.add(g); if (g.userData.anim) anims.push(g);
    });
    E.othersG.add(grp); grp.updateMatrixWorld(true);
    grp.children.forEach(g => { const l = g.userData.light; if (l) lo.push({ pos: g.localToWorld(new THREE.Vector3(l.x, l.y, l.z)), color: l.color, intensity: l.intensity * .8, dist: l.dist, flicker: l.flicker }); });
    lo.sort((a, b) => b.intensity - a.intensity); ls.push(...lo.slice(0, 2));
  });
  lightList = ls; setPointLights(ls);
  buildHi(); cam.dirty = true;
}
function rebuildRoom() { buildHouse(T.rooms, T.open || [], S.cur.room); setNight(!!room().dark); paintLight(); invalidate(); }

// 選択ハイライト
const hiMat = new THREE.MeshBasicMaterial({ color: 0xff6b6b, transparent: true, opacity: .3, depthWrite: false, side: THREE.DoubleSide });
const multiMat = new THREE.MeshBasicMaterial({ color: 0x2fb88e, transparent: true, opacity: .38, depthWrite: false, side: THREE.DoubleSide });
const boxMat = new THREE.MeshBasicMaterial({ color: 0x8fd3c0, transparent: true, opacity: .22, depthWrite: false, side: THREE.DoubleSide });
const arrowMat = new THREE.MeshBasicMaterial({ color: 0xff5252 });
function floorHi(i, mat) {
  const d = ITEM[i.id], r = rectOf(i); let z = 0; if (d.small) { const host = hostAt(room().items, i.x, i.y); if (host) z = surfZ(ITEM[host.id]); }
  const p = new THREE.Mesh(new THREE.PlaneGeometry(r.x1 - r.x0, r.y1 - r.y0), mat); p.rotation.x = -Math.PI / 2; p.position.set((r.x0 + r.x1) / 2, z + .03, (r.y0 + r.y1) / 2); hiG.add(p);
  return { r, z };
}
function buildHi() {
  if (!hiG) { hiG = new THREE.Group(); E.fxG.add(hiG); }
  hiG.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  while (hiG.children.length) hiG.remove(hiG.children[0]);
  hiArrow = null;
  if (multi) {   // まとめて選ぶ：選んだ物すべてに緑の印、なぞり中は範囲を表示
    room().items.forEach(i => { if (multi.sel.has(i.uid)) floorHi(i, multiMat); });
    const dr = multi.drag; if (dr && dr.kind === 'box' && dr.moved) { const b = boxRect(dr), p = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(.01, b.x1 - b.x0), Math.max(.01, b.y1 - b.y0)), boxMat); p.rotation.x = -Math.PI / 2; p.position.set((b.x0 + b.x1) / 2, .05, (b.y0 + b.y1) / 2); hiG.add(p); }
    return;
  }
  const i = selItem(); if (!i || ghost) return;
  const d = ITEM[i.id];
  if (i.wall) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(d.w + .1, d.h + .1), hiMat); const wg = new THREE.Group(); p.position.set(d.w / 2, d.h / 2, .08); wg.add(p); placeObj(wg, i, d); hiG.add(wg);
  } else {
    const { r, z } = floorHi(i, hiMat);
    const a = new THREE.Mesh(new THREE.ConeGeometry(.16, .3, 4), arrowMat); a.rotation.x = Math.PI; hiBase = z + (d.ceil ? 1.2 : d.h) + .4; a.position.set((r.x0 + r.x1) / 2, hiBase, (r.y0 + r.y1) / 2); hiG.add(a); hiArrow = a;
  }
}

// ===== 電気（部屋ごとにオン・オフ）=====
const setTl = (b, t) => { const e = b.querySelector('.tl'); if (e) e.textContent = t; else b.textContent = t; };
function paintLight() { const b = $('btnLight'); if (!b || !T) return; const dk = !!room().dark; setTl(b, dk ? '電気をつける' : '電気を消す'); b.classList.toggle('on', dk); }
function toggleLight() { const rm = room(); rm.dark = !rm.dark; setNight(rm.dark); sfx('tap'); toast(rm.dark ? '電気を消しました' : '電気をつけました'); paintLight(); invalidate(); save(); }

// ===== カメラの向き（斜め・真上・左の壁・右の壁）=====
function paintCam() { document.querySelectorAll('#camModes .btn').forEach(b => b.classList.toggle('on', b.dataset.m === cam.mode)); }

// ===== まとめて選ぶ：さわって選ぶ／なぞって範囲で選ぶ／選んだ物をドラッグでまとめて移動 =====
let multi = null;   // { sel: Set(uid), drag: null | {kind:'box',...} | {kind:'move',...} }
function setMultiBtn() { const b = $('btnMulti'); if (b) b.classList.toggle('on', !!multi); }
function enterMulti() {
  if (ghost) cancelGhost(); selUid = null; multi = { sel: new Set(), drag: null };
  setMultiBtn(); renderBar(); buildHi(); cam.dirty = true; sfx('tap'); toast('なぞって選び、ドラッグでまとめて動かせます');
}
function exitMulti() { if (!multi) return; cancelDrag(); multi = null; setMultiBtn(); renderBar(); buildHi(); cam.dirty = true; }
const multiItems = () => room().items.filter(i => multi.sel.has(i.uid));
function toggleMultiSel(i) {
  if (!isFloor(i)) { toast('壁かけはまとめて選べません', 'ng'); sfx('ng'); return; }
  if (multi.sel.has(i.uid)) multi.sel.delete(i.uid); else multi.sel.add(i.uid);
  sfx('tap'); renderBar(); buildHi(); cam.dirty = true;
}
function boxRect(b) {
  const r = room(), cx = v => Math.max(0, Math.min(r.w, v)), cy = v => Math.max(0, Math.min(r.d, v));
  return { x0: cx(Math.floor(Math.min(b.f0[0], b.f1[0]))), y0: cy(Math.floor(Math.min(b.f0[1], b.f1[1]))), x1: cx(Math.floor(Math.max(b.f0[0], b.f1[0])) + 1), y1: cy(Math.floor(Math.max(b.f0[1], b.f1[1])) + 1) };
}
function startDrag(x, y) {
  const f = floorAt(x, y, 0), hit = hitTest(x, y);
  if (hit && multi.sel.has(hit.uid)) {
    const rm = room(), set = new Set(multi.sel);
    multiItems().forEach(i => { if (isBig(i)) topsOf(rm, i).forEach(t => set.add(t.uid)); });   // 上にのっている小物もいっしょに
    const its = rm.items.filter(i => set.has(i.uid) && isFloor(i));
    multi.drag = { kind: 'move', f0: f, dx: 0, dy: 0, its, orig: its.map(i => [i.x, i.y]), set };
  } else multi.drag = { kind: 'box', f0: f, f1: f, moved: false };
}
// まとめて dx,dy ずらしても全部置けるか（家具→小物→ラグの順に確かめる）
function groupFits(dr, dx, dy) {
  const rm = room(), tmp = Object.assign({}, rm, { items: rm.items.filter(i => !dr.set.has(i.uid)) });
  const ord = i => { const d = ITEM[i.id]; return d.cat === 'rug' ? 2 : d.small ? 1 : 0; };
  const list = dr.its.map((i, k) => [i, dr.orig[k]]).sort((a, b) => ord(a[0]) - ord(b[0]));
  for (const [i, o] of list) {
    const c = Object.assign({}, i, { x: o[0] + dx, y: o[1] + dy });
    if (!placeCheck(tmp, ITEM[i.id], c.x, c.y, i.rot, -1).ok) return false;
    tmp.items.push(c);
  }
  return true;
}
function dragMove(x, y) {
  const dr = multi.drag, f = floorAt(x, y, 0);
  if (dr.kind === 'box') { dr.f1 = f; dr.moved = true; buildHi(); cam.dirty = true; return; }
  const dx = Math.round(f[0] - dr.f0[0]), dy = Math.round(f[1] - dr.f0[1]);
  if (dx === dr.dx && dy === dr.dy) return;
  if (!groupFits(dr, dx, dy)) return;   // 置けない位置には動かない（最後に置けた位置で止まる）
  dr.dx = dx; dr.dy = dy; dr.its.forEach((i, k) => { i.x = dr.orig[k][0] + dx; i.y = dr.orig[k][1] + dy; });
  sfx('tap'); invalidate();
}
function endDrag() {
  const dr = multi && multi.drag; if (!dr) return; multi.drag = null;
  if (dr.kind === 'box') {
    if (dr.moved) { const b = boxRect(dr); let k = 0; room().items.forEach(i => { if (isFloor(i) && ovl(rectOf(i), b)) { multi.sel.add(i.uid); k++; } }); if (k) sfx('tap'); renderBar(); }
    buildHi(); cam.dirty = true; return;
  }
  if (dr.dx || dr.dy) { sfx('place'); fixAvatar(); save(); }
  buildHi(); cam.dirty = true;
}
function cancelDrag() { const dr = multi && multi.drag; if (!dr) return; if (dr.kind === 'move') endDrag(); else { multi.drag = null; buildHi(); cam.dirty = true; } }
// まとめてしまう：しまえるのは自分が買った物だけ（担任助手モード中はぜんぶ）。番号は1回だけ確かめる
async function multiStow() {
  const all = multiItems(), its = all.filter(canRemove), skip = all.length - its.length; if (!all.length) return;
  if (!its.length) { toast('ほかの人が買った物はしまえません', 'ng'); sfx('ng'); return; }
  if (!await confirmDlg(its.length + '個を持ち物にしまいますか？（上にのっている物は持ち主にもどります）' + (skip ? '\nほかの人が買った ' + skip + '個 はそのままです。' : ''), 'しまう')) return;
  if (!await requirePin()) return;
  const rm = room(); let k = 0; its.forEach(i => { if (rm.items.includes(i)) { stowItem(i, true); multi.sel.delete(i.uid); k++; } });
  toast(k + '個をしまいました', 'ok'); sfx('place'); fixAvatar(); save(); renderBar(); renderPanel(); buildHi();
}

// 配置ゴースト
const gmats = new Map();
function ghostMat(m, ok) {
  const k = m.uuid + ok; let c = gmats.get(k);
  if (!c) { c = m.clone(); c.transparent = true; c.opacity = .62; c.depthWrite = false; if (c.emissive) { c.emissive = new THREE.Color(ok ? 0x2fbf80 : 0xe03030); c.emissiveIntensity = ok ? .35 : .6; c.emissiveMap = null; } gmats.set(k, c); }
  return c;
}
function ghostify(g, ok) { g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.material = Array.isArray(o.material) ? o.material.map(m => ghostMat(m, ok)) : ghostMat(o.material, ok); } }); }
function buildGhost() {
  if (!ghostG) { ghostG = new THREE.Group(); E.fxG.add(ghostG); }
  ghostG.traverse(o => { if (o.isMesh && o.userData.own) o.geometry.dispose(); });
  while (ghostG.children.length) ghostG.remove(ghostG.children[0]);
  cam.dirty = true; if (!ghost || ghost.x == null && !ghost.def.wall) return;
  const g = ghost, d = g.def, ok = g.ok, col = ok ? 0x50c88c : 0xeb5050;
  const ov = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .42, depthWrite: false, side: THREE.DoubleSide });
  const model = buildItem(d); ghostify(model, ok);
  if (d.wall) {
    const wg = new THREE.Group(); wg.add(model); const p = new THREE.Mesh(new THREE.PlaneGeometry(d.w, d.h), ov); p.position.set(d.w / 2, d.h / 2, .1); p.userData.own = true; wg.add(p);
    placeObj(wg, { wall: g.wall, pos: g.pos, z: g.z }, d); ghostG.add(wg);
  } else {
    const [w, dd] = dims(d, g.rot), z = g.z || 0;
    model.position.set(g.x + w / 2, z, g.y + dd / 2); model.rotation.y = rotY(g.rot); ghostG.add(model);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, dd), ov); p.rotation.x = -Math.PI / 2; p.position.set(g.x + w / 2, z + .035, g.y + dd / 2); p.userData.own = true; ghostG.add(p);
  }
}

// ===== サムネイル =====
const iconCache = new Map(); let thumb = null; const thumbQ = [];
function thumbInit() {
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); r.setPixelRatio(1); r.setSize(112, 112, false);
  r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.2; r.setClearColor(0x000000, 0);
  const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xfff0dc, 0x8a6240, .5)); { const pm = new THREE.PMREMGenerator(r); sc.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; sc.environmentIntensity = .7; pm.dispose(); } const dl = new THREE.DirectionalLight(0xffe0b0, 2.2); dl.position.set(3, 6, 4); sc.add(dl);
  thumb = { r, sc, cam: new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 200) };
}
function renderThumb(d) {
  if (!thumb) thumbInit();
  const { r, sc, cam: c } = thumb, m = buildItem(d); m.userData.anim = null; sc.add(m); m.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(m), ctr = bb.getCenter(new THREE.Vector3()), yaw = d.wall ? .45 : Math.PI / 4, pitch = d.wall ? .2 : .55;
  c.position.set(ctr.x + Math.sin(yaw) * Math.cos(pitch) * 20, ctr.y + Math.sin(pitch) * 20, ctr.z + Math.cos(yaw) * Math.cos(pitch) * 20); c.up.set(0, 1, 0); c.lookAt(ctr); c.updateMatrixWorld(true);
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; const v = new THREE.Vector3();
  for (const X of [bb.min.x, bb.max.x]) for (const Y of [bb.min.y, bb.max.y]) for (const Z of [bb.min.z, bb.max.z]) { v.set(X, Y, Z).applyMatrix4(c.matrixWorldInverse); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
  const hh = Math.max(x1 - x0, y1 - y0) / 2 * 1.12, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  c.left = cx - hh; c.right = cx + hh; c.top = cy + hh; c.bottom = cy - hh; c.updateProjectionMatrix();
  r.render(sc, c); const url = r.domElement.toDataURL('image/png'); sc.remove(m); return url;
}
function swatchUrl(d, size) { const k = d.id + '@' + size; let u = iconCache.get(k); if (!u) { u = swatchCanvas(d, size).toDataURL(); iconCache.set(k, u); } return u; }
function makeIcon(d, size) { return swatchUrl(d, size); }
function itemIcon(d, img) {
  const u = iconCache.get(d.id); if (u) { img.src = u; return; }
  thumbQ.push([d, img]); if (thumbQ.length === 1) setTimeout(pumpThumbs, 0);
}
function pumpThumbs() {
  const t0 = performance.now();
  while (thumbQ.length && performance.now() - t0 < 24) {
    const [d, img] = thumbQ.shift();
    let u = iconCache.get(d.id); if (!u) { try { u = renderThumb(d); } catch (e) { u = ''; console.error('thumb', d.id, e); } iconCache.set(d.id, u); }
    img.src = u;
  }
  if (thumbQ.length) setTimeout(pumpThumbs, 0);
}

// ===== ホームのチーミカード用：家の小さな絵（斜め視点で1回だけ描いてキャッシュ）=====
const houseCache = new Map(); let hth = null; const houseQ = [];
function houseThumbInit() {
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); r.setPixelRatio(1); r.setSize(360, 250, false);
  r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.1; r.setClearColor(0x000000, 0);
  const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xfff0dc, 0x8a6240, .75)); { const pm = new THREE.PMREMGenerator(r); sc.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; sc.environmentIntensity = .6; pm.dispose(); }
  const dl = new THREE.DirectionalLight(0xffe6c0, 1.6); dl.position.set(6, 10, 8); sc.add(dl);
  hth = { r, sc, cam: new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 300) };
}
function houseKey(t) { return [t.id, JSON.stringify(t.open || []), t.rooms.map(rm => [rm.x, rm.z, rm.w, rm.d, rm.wall, rm.floor, rm.items.map(i => i.id + i.x + i.y + (i.rot || 0) + (i.wall || '') + (i.pos || '')).join()].join(':')).join('|')].join('|'); }
// W×HH：絵の大きさ（ふだんは 360×250。掲示用は横2000px）。focus：その部屋だけに寄る（部屋の番号。-1 は全体）
function renderHouse(t, W = 360, HH = 250, focus = -1) {
  if (!hth) houseThumbInit();
  const { r, sc, cam: c } = hth, roomGrp = [], rooms = migrateRooms(t.rooms, t.size0), grp = new THREE.Group(), box = houseBox(rooms), H = 2.6, CUT = 1.1;
  const col = id => new THREE.Color((ITEM[id] || {}).color || '#e8d3ae');
  const mats = rooms.map(rm => ({ f: new THREE.MeshStandardMaterial({ color: col(rm.floor), roughness: .9 }), w: new THREE.MeshStandardMaterial({ color: col(rm.wall), roughness: 1 }) }));
  rooms.forEach((rm, i) => {
    const rg = new THREE.Group(); roomGrp.push(rg); grp.add(rg);
    const fl = new THREE.Mesh(new THREE.BoxGeometry(rm.w, .3, rm.d), mats[i].f); fl.position.set(rm.x + rm.w / 2, -.15, rm.z + rm.d / 2); rg.add(fl);
    rm.items.forEach(it => {
      const d = ITEM[it.id]; if (!d || it.wall) return;
      try { const g = buildItem(d); g.userData.anim = null; const [w, dd] = dims(d, it.rot); g.position.set(rm.x + it.x + w / 2, 0, rm.z + it.y + dd / 2); g.rotation.y = rotY(it.rot); rg.add(g); } catch (e) { /* 1つ作れなくても続ける */ }
    });
  });
  wallPlan(rooms, t.open || []).forEach(sg => {
    if (sg.kind === 'door') return;
    const full = sg.kind === 'out' && (sg.side === 'l' || sg.side === 't'), h = full ? H : CUT, len = sg.a1 - sg.a0, ri = sg.kind === 'out' || sg.kind === 'ent' ? sg.room : sg.hi;
    const th = sg.kind === 'out' ? .22 : .16, off = sg.kind === 'out' && (sg.side === 'r' || sg.side === 'b') ? th / 2 : -th / 2;
    const m = new THREE.Mesh(new THREE.BoxGeometry(sg.ax === 'z' ? th : len, h, sg.ax === 'z' ? len : th), mats[ri].w);
    m.position.set(sg.ax === 'z' ? sg.pos + off : (sg.a0 + sg.a1) / 2, h / 2, sg.ax === 'z' ? (sg.a0 + sg.a1) / 2 : sg.pos + off); grp.add(m);
  });
  sc.add(grp); grp.updateMatrixWorld(true);
  const ctr = new THREE.Vector3((box.x0 + box.x1) / 2, H * .35, (box.z0 + box.z1) / 2), yaw = Math.PI / 4, pitch = .62;
  c.position.set(ctr.x + Math.sin(yaw) * Math.cos(pitch) * 60, ctr.y + Math.sin(pitch) * 60, ctr.z + Math.cos(yaw) * Math.cos(pitch) * 60); c.up.set(0, 1, 0); c.lookAt(ctr); c.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(focus >= 0 && roomGrp[focus] ? roomGrp[focus] : grp); if (focus >= 0) bb.max.y = Math.max(bb.max.y, CUT); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; const v = new THREE.Vector3();
  for (const X of [bb.min.x, bb.max.x]) for (const Y of [bb.min.y, bb.max.y]) for (const Z of [bb.min.z, bb.max.z]) { v.set(X, Y, Z).applyMatrix4(c.matrixWorldInverse); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
  const asp = W / HH, hh = Math.max((x1 - x0) / asp, y1 - y0) / 2 * 1.08, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  c.left = cx - hh * asp; c.right = cx + hh * asp; c.top = cy + hh; c.bottom = cy - hh; c.updateProjectionMatrix();
  const big = W !== 360 || HH !== 250; if (big) r.setSize(W, HH, false);
  r.render(sc, c); const url = r.domElement.toDataURL('image/png'); sc.remove(grp); if (big) r.setSize(360, 250, false);
  grp.traverse(o => { if (o.geometry) o.geometry.dispose(); }); return url;
}
function houseThumb(t, cb) {
  if (!t || !t.rooms || !t.rooms.length) { cb(''); return; }
  const k = houseKey(t), hit = houseCache.get(k); if (hit) { cb(hit); return; }
  houseQ.push([t, k, cb]); if (houseQ.length === 1) setTimeout(pumpHouses, 30);
}
// 掲示用の大きな家の絵（横2000px）。全体図と、家具がいちばん多い部屋の寄り（部屋が2つ以上のとき）
function houseHi(t) {
  if (!t || !t.rooms || !t.rooms.length) return { full: '', close: '' };
  const rooms = migrateRooms(t.rooms, t.size0); let best = -1, bn = -1; rooms.forEach((rm, i) => { const n = rm.items.length; if (n > bn) { bn = n; best = i; } });
  let full = '', close = '';
  try { full = renderHouse(t, 2000, 1389); } catch (e) { console.error('houseHi', e); }
  if (rooms.length > 1 && bn > 0) { try { close = renderHouse(t, 1400, 1050, best); } catch (e) { console.error('houseHi', e); } }
  return { full, close, room: best };
}
function pumpHouses() {
  const q = houseQ.shift(); if (!q) return; const [t, k, cb] = q;
  let u = houseCache.get(k); if (!u) { try { u = renderHouse(t); } catch (e) { u = ''; console.error('houseThumb', e); } houseCache.set(k, u); }
  cb(u); if (houseQ.length) setTimeout(pumpHouses, 20);
}

// ===== 選択・配置 =====
let selUid = null, ghost = null;
function setSel(u) { selUid = u; renderBar(); buildHi(); cam.dirty = true; }
function startPlace(id, from, orig) {
  if (multi) exitMulti();
  const d = ITEM[id]; selUid = null;
  ghost = { def: d, id, rot: orig ? orig.rot || 0 : 0, x: null, y: null, ok: false, from, orig, uid: orig ? orig.uid : null };
  if (d.wall) { ghost.wall = orig && orig.wall || 'R'; ghost.pos = orig ? orig.pos : 1; ghost.z = orig ? orig.z : (d.zb != null ? d.zb : 1.2); evalGhost(); }
  else { const [w, dd] = dims(d, ghost.rot), rm0 = room(); ghost.x = orig ? orig.x : Math.max(0, Math.floor(rm0.w / 2 - w / 2)); ghost.y = orig ? orig.y : Math.max(0, Math.floor(rm0.d / 2 - dd / 2)); evalGhost(); }
  showGrid(true); invalidate(); renderBar(); renderPanel();
}
function evalGhost() {
  const g = ghost, rm = room();
  if (g.def.wall) { const r = wallCheck(rm, g.def, g.wall, g.pos, g.z, g.uid); g.ok = r.ok; g.why = r.why; }
  else { const r = placeCheck(rm, g.def, g.x, g.y, g.rot, g.uid); g.ok = r.ok; g.why = r.why; g.z = r.z || 0; }
  renderBar(); buildGhost();
}
const snap = (v, s) => Math.round(v / s) * s;
// 今いる部屋のローカル座標で見た視線（itemsG / fxG が部屋の角に置かれているぶんをずらす）
function lrayAt(px, py) { const rc = rayAt(px, py); rc.ray.origin.x -= E.fxG.position.x; rc.ray.origin.z -= E.fxG.position.z; return rc; }
function floorAt(px, py, y) {
  const rc = lrayAt(px, py), o = rc.ray.origin, dr = rc.ray.direction; if (Math.abs(dr.y) < 1e-6) return [-99, -99];
  const t = (y - o.y) / dr.y; return [o.x + dr.x * t, o.z + dr.z * t];
}
function wallAt(px, py) {
  const rc = lrayAt(px, py), o = rc.ray.origin, dr = rc.ray.direction, rm = room(), c = [];
  if (Math.abs(dr.x) > 1e-6) { const t = -o.x / dr.x, y = o.y + dr.y * t, u = o.z + dr.z * t; if (t > 0 && u > -.5 && u < rm.d + .5 && y > -.3 && y < WH + .3) c.push({ t, wall: 'L', u, y }); }
  if (Math.abs(dr.z) > 1e-6) { const t = -o.z / dr.z, y = o.y + dr.y * t, u = o.x + dr.x * t; if (t > 0 && u > -.5 && u < rm.w + .5 && y > -.3 && y < WH + .3) c.push({ t, wall: 'R', u, y }); }
  c.sort((a, b) => a.t - b.t); return c[0] || null;
}
function moveGhost(px, py) {
  const g = ghost; if (!g) return; const d = g.def;
  if (d.wall) {
    const w = wallAt(px, py); if (!w) return; const n = w.wall === 'L' ? room().d : room().w;
    g.wall = w.wall; g.pos = Math.max(0, Math.min(n - d.w, snap(w.u - d.w / 2, .5))); g.z = Math.max(0, Math.min(WH - d.h, snap(w.y - d.h / 2, .5)));
  } else {
    const [w, dd] = dims(d, g.rot); let f = floorAt(px, py, 0);
    if (d.small) {
      const zs = [...new Set(room().items.filter(i => isBig(i) && ITEM[i.id].surface).map(i => surfZ(ITEM[i.id])))].sort((a, b) => b - a);
      for (const z of zs) { const q = floorAt(px, py, z), host = hostAt(room().items.filter(i => i.uid !== g.uid), Math.floor(q[0]), Math.floor(q[1])); if (host && surfZ(ITEM[host.id]) === z) { f = q; break; } }
    }
    const rm = room(); g.x = Math.max(0, Math.min(rm.w - w, Math.round(f[0] - w / 2))); g.y = Math.max(0, Math.min(rm.d - dd, Math.round(f[1] - dd / 2)));
  }
  evalGhost();
}
function rotateGhost() {
  if (!ghost || ghost.def.wall) return; ghost.rot = nextRot(ghost.rot); const [w, dd] = dims(ghost.def, ghost.rot), rm = room();
  ghost.x = Math.max(0, Math.min(rm.w - w, ghost.x)); ghost.y = Math.max(0, Math.min(rm.d - dd, ghost.y)); evalGhost(); sfx('tap');
}
function endGhost() { ghost = null; showGrid(false); buildGhost(); invalidate(); }
function confirmGhost() {
  const g = ghost; if (!g) return; if (!g.ok) { toast(g.why || 'ここには置けません', 'ng'); sfx('ng'); return; }
  const rm = room();
  if (g.from === 'inv') { me.inv[g.id] = (me.inv[g.id] || 1) - 1; if (me.inv[g.id] <= 0) delete me.inv[g.id]; if (SV.on) pend.take[g.id] = (pend.take[g.id] || 0) + 1; }
  const o = g.def.wall ? { uid: g.uid || uidN++, id: g.id, wall: g.wall, pos: g.pos, z: g.z } : { uid: g.uid || uidN++, id: g.id, x: g.x, y: g.y, rot: g.rot };
  const ow = g.from === 'move' ? (g.orig && g.orig.owner) : me.uid; if (ow) o.owner = ow;
  rm.items.push(o); endGhost(); sfx('place'); pops.push({ uid: o.uid, t: 0 }); sparkleItem(o); toast(g.def.name + 'を置きました', 'ok');
  fixAvatar(); save(); renderBar(); renderPanel();
}
function cancelGhost() {
  if (!ghost) return; const g = ghost; endGhost();
  if (g.from === 'move' && g.orig) room().items.push(g.orig);
  renderBar(); renderPanel(); save();
}
function fixAvatar() { const rm = room(), bl = blockedSet(rm); AVS.forEach(a => { if (bl.has(Math.floor(a.x) + ',' + Math.floor(a.y))) { const c = freeCellNear(rm, Math.floor(a.x), Math.floor(a.y), avCells(a)); a.x = c[0] + .5; a.y = c[1] + .5; a.path = []; a.res = null; } }); cam.dirty = true; }
function topsOf(rm, host) { return rm.items.filter(t => isFloor(t) && ITEM[t.id].small && ovl(rectOf(t), rectOf(host)) && hostAt(rm.items, t.x, t.y) === host); }
// 持ち主の持ち物にもどす（持ち主がいない家具は、操作した人へ）
function giveInv(owner, id) { const st = (owner && studentById(owner)) || me; st.inv[id] = (st.inv[id] || 0) + 1; if (SV.on) { const g = pend.give[st.uid] = pend.give[st.uid] || {}; g[id] = (g[id] || 0) + 1; } }
const canRemove = i => adminOn || !i.owner || (me && i.owner === me.uid);
// 4桁番号：1回入れたら同じ生徒は5分間そのまま（入れた番号はメモリにだけ置く。サーバー版はRPCの中で確かめる）
let pinCache = { uid: null, pin: '', until: 0 };
const pinUntil = { set() { }, get() { return 0; } };
const dropPin = () => { pinCache = { uid: null, pin: '', until: 0 }; };
async function getPin() {
  if (window.__noPin || demoMode || !me) return '';
  if (pinCache.uid === me.uid && pinCache.until > Date.now()) return pinCache.pin;
  let v = null;
  if (SV.on) v = await verifyOrSetPin(me);
  else if (!me.pin) { const np = await pinSet({ face: faceImg(me.me, 'face', 'face'), who: nickOf(me) }); if (np) { me.pin = pinHash(np, me.uid); save(); v = np; } }
  else {
    let k = 0;
    for (; k < 3; k++) {
      const x = await pinPad('4けたの番号を入力', k ? '違います。もう一度' : 'ピコが動くので確認します', { face: faceImg(me.me, 'face', 'face'), who: nickOf(me) });
      if (x == null) break; if (checkPin(me, x)) { v = x; break; } sfx('ng');
    }
    if (k >= 3) toast('番号が違います。担任助手に聞いてください', 'ng');
  }
  if (v !== null) pinCache = { uid: me.uid, pin: v, until: Date.now() + 300000 };
  return v;
}
const requirePin = async () => (await getPin()) !== null;
// しまう・売る：持ち主だけ（担任助手モード中は可）。自分のものは番号を確かめる
async function gate(i) {
  if (!canRemove(i)) { toast(nickOf(studentById(i.owner)) + 'の物なので動かせません', 'ng'); sfx('ng'); return false; }
  if (adminOn && i.owner && i.owner !== me.uid) return true;
  return requirePin();
}
function payTo(owner, v, itemId) { const st = (owner && studentById(owner)) || me; if (SV.on) pend.sell.push({ uid: st.uid, item: itemId }); if (st === me) addPts(v); else st.picos += v; }
function stowItem(i, silent) {
  const rm = room(), d = ITEM[i.id];
  if (isBig(i)) topsOf(rm, i).forEach(t => { rm.items.splice(rm.items.indexOf(t), 1); giveInv(t.owner, t.id); });
  rm.items.splice(rm.items.indexOf(i), 1); giveInv(i.owner, i.id); if (!silent) toast(d.name + 'をしまいました', 'ok'); invalidate();
}
function selItem() { return room().items.find(i => i.uid === selUid); }
function actMove() { const i = selItem(); if (!i) return; const rm = room(); const hadTops = isBig(i) && topsOf(rm, i).length; if (hadTops) topsOf(rm, i).forEach(t => stowItem(t, true)); rm.items.splice(rm.items.indexOf(i), 1); if (hadTops) toast('上の物は持ち物にしまいました'); startPlace(i.id, 'move', Object.assign({}, i)); }
function actRot() {
  const i = selItem(); if (!i) return; const rot = nextRot(i.rot), r = placeCheck(room(), ITEM[i.id], i.x, i.y, rot, i.uid);
  if (!r.ok) { // 範囲内にずらして再判定
    const d = ITEM[i.id], [w, dd] = dims(d, rot), rm1 = room(); const nx = Math.min(i.x, rm1.w - w), ny = Math.min(i.y, rm1.d - dd), r2 = placeCheck(room(), d, nx, ny, rot, i.uid);
    if (r2.ok && !(isBig(i) && topsOf(room(), i).length)) { i.x = nx; i.y = ny; i.rot = rot; sfx('boing'); pops.push({ uid: i.uid, t: 0 }); save(); invalidate(); buildHi(); return; }
    toast('回転できません', 'ng'); sfx('ng'); return;
  }
  if (isBig(i) && topsOf(room(), i).length) { toast('上の物をどけてください', 'ng'); sfx('ng'); return; }
  i.rot = rot; sfx('boing'); pops.push({ uid: i.uid, t: 0 }); save(); invalidate();
}
async function actStow() { const i = selItem(); if (!i) return; if (!await gate(i)) return; sparkleItem(i); stowItem(i); setSel(null); sfx('place'); fixAvatar(); save(); renderPanel(); }
async function actSell() {
  const i = selItem(); if (!i) return; const d = ITEM[i.id], v = Math.floor(priceOf(d) * CFG.SELL_RATE);
  if (d.ltd) { toast('非売品は売れません（しまうことはできます）', 'ng'); sfx('ng'); return; }
  if (await confirmDlg(d.name + 'を ' + fmt(v) + ' ピコで売りますか？（上に置いたものは持ち主の持ち物に戻ります）', '売る')) {
    if (!await gate(i)) return;
    const rm = room(); if (isBig(i)) topsOf(rm, i).forEach(t => stowItem(t, true));
    rm.items.splice(rm.items.indexOf(i), 1); payTo(i.owner, v, i.id); sfx('coin'); toast(d.name + 'を売って +' + fmt(v) + ' ピコ', 'ok'); setSel(null); invalidate(); save(); renderPanel();
  }
}
function renderBar() {
  const b = $('bar'); b.innerHTML = ''; setTimeout(() => { const on = !b.hidden; $('stage').classList.toggle('barOn', on); if (on) $('stage').style.setProperty('--barh', b.offsetHeight + 'px'); }, 0);
  const btn = (t, f, cls) => b.appendChild(h('button', { cls: 'btn sm ' + (cls || ''), text: t, onclick: f }));
  if (multi) {
    b.hidden = false; const n = multi.sel.size;
    b.appendChild(h('span', { cls: 'lbl', text: n ? 'えらんだ物 ' + n + '個' : 'さわる・なぞるで選ぶ' }));
    if (n) { btn('解除', () => { multi.sel.clear(); renderBar(); buildHi(); cam.dirty = true; }); btn('しまう', multiStow); }
    btn('おわる', exitMulti, 'mint'); return;
  }
  if (ghost) {
    b.hidden = false; b.appendChild(h('span', { cls: 'lbl', text: ghost.def.name }));
    if (!ghost.def.wall) btn('回転', rotateGhost);
    btn('やめる', cancelGhost); btn('ここに置く', confirmGhost, ghost.ok ? 'mint' : '');
    b.lastChild.style.opacity = ghost.ok ? 1 : .55; return;
  }
  const i = selItem(); if (!i) { b.hidden = true; return; }
  const d = ITEM[i.id]; b.hidden = false; b.appendChild(h('span', { cls: 'lbl', text: d.name }));
  b.appendChild(h('span', { cls: 'own', text: i.owner ? nickOf(studentById(i.owner)) + 'が買った' : 'みんなの' }));
  btn('移動', actMove); if (!d.wall && !d.small) btn('回転', actRot);
  if (canRemove(i)) { btn('しまう', actStow); btn('売る ' + fmt(priceOf(d) * CFG.SELL_RATE) + 'ピコ', actSell, 'coral'); }
}

// ===== ポインタ =====
const cv = $('cv'), ptrs = new Map(); let pinch0 = null, didGesture = false;
const rel = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('pointerdown', e => {
  cv.setPointerCapture(e.pointerId); const [x, y] = rel(e); ptrs.set(e.pointerId, { x, y, sx: x, sy: y, moved: false, type: e.pointerType, btn: e.button });
  if (ptrs.size === 2) { cancelDrag(); const [a, b] = [...ptrs.values()]; pinch0 = { d: Math.hypot(a.x - b.x, a.y - b.y), z: cam.zoom }; didGesture = true; }
  else if (ptrs.size === 1) { didGesture = false; if (multi && e.button !== 2) startDrag(x, y); }
  if (ghost && ptrs.size === 1 && e.pointerType !== 'mouse') moveGhost(x, y);
});
cv.addEventListener('pointermove', e => {
  const p = ptrs.get(e.pointerId); const [x, y] = rel(e);
  if (!p) { if (ghost && e.pointerType === 'mouse') moveGhost(x, y); return; }
  const dx = x - p.x, dy = y - p.y; p.x = x; p.y = y; if (Math.hypot(x - p.sx, y - p.sy) > 8) p.moved = true;
  if (ptrs.size === 2 && pinch0) {
    const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); setZoom(pinch0.z * d / Math.max(1, pinch0.d));
    // 2本指パン（この指の動きの半分ずつ＝中点の移動量）
    cam.panx += dx / 2 / E.W; cam.pany += dy / 2 / E.H; cam.dirty = true;
  } else if (ptrs.size === 1) {
    if (multi && multi.drag) { if (p.moved) dragMove(x, y); }
    else if (ghost && p.type !== 'mouse') moveGhost(x, y);
    else if (p.btn === 2 || p.moved) { orbit(dx * .006, dy * .006); paintCam(); holdAvatars(); }
    else if (ghost) moveGhost(x, y);
  }
});
cv.addEventListener('pointerup', e => {
  const p = ptrs.get(e.pointerId); ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch0 = null;
  if (multi && multi.drag) { endDrag(); if (p && p.moved) return; }
  if (!p || didGesture) { if (!ptrs.size) didGesture = false; return; }
  if (p.btn === 2) return;
  if (!p.moved) tap(p.x, p.y, p.type);
});
cv.addEventListener('pointercancel', e => { ptrs.delete(e.pointerId); pinch0 = null; cancelDrag(); });
cv.addEventListener('wheel', e => { e.preventDefault(); setZoom(cam.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1)); }, { passive: false });
cv.addEventListener('dblclick', () => resetCam());
// タップした先がどの部屋か（ほかの部屋の家具・床なら、その部屋の番号。壁・今いる部屋なら今の番号）
function pickRoom(px, py) {
  if (T.rooms.length < 2) return -1;
  E.roomPick.updateMatrixWorld(true); E.othersG.updateMatrixWorld(true);
  const rc = rayAt(px, py), hits = rc.intersectObjects([E.roomPick, E.othersG].filter(Boolean), true);
  for (const hit of hits) {
    let o = hit.object; while (o && o.userData.roomIdx == null && o.parent) o = o.parent;
    if (o && o.userData.roomIdx != null) return o.userData.roomIdx;
    if (hit.object.name !== 'floor') return S.cur.room;   // 壁にさえぎられた
  }
  return -1;
}
function hitTest(px, py) {
  const hits = rayAt(px, py).intersectObjects(E.itemsG.children, true);
  for (const hit of hits) { let o = hit.object; while (o && o.userData.uid == null) o = o.parent; if (o) { const i = room().items.find(t => t.uid === o.userData.uid); if (i) return i; } }
  return null;
}
function tap(x, y, type) {
  if (ghost) { moveGhost(x, y); if (type === 'mouse') confirmGhost(); return; }
  if (multi) { const hit = hitTest(x, y); if (hit) toggleMultiSel(hit); return; }
  const av = hitAvatar(x, y); if (av) { reactAvatar(av.a); return; }   // me-をさわると、ちょっと反応する
  const hit = hitTest(x, y);
  if (hit) { setSel(hit.uid === selUid ? null : hit.uid); sfx('tap'); if (hit.id && ITEM[hit.id].cat === 'rug') { const f = floorAt(x, y, 0); walkTo(Math.floor(f[0]), Math.floor(f[1])); } return; }
  const pr = pickRoom(x, y); if (pr >= 0 && pr !== S.cur.room) { switchRoom(pr); return; }   // ほかの部屋をタップ → その部屋へ
  setSel(null); const f = floorAt(x, y, 0), rm = room();
  if (f[0] >= 0 && f[1] >= 0 && f[0] < rm.w && f[1] < rm.d) walkTo(Math.floor(f[0]), Math.floor(f[1]));
}
window.addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT') return;
  if (e.key === 'r' || e.key === 'R') { if (multi) return; if (ghost) rotateGhost(); else if (selUid && selItem() && !ITEM[selItem().id].wall) actRot(); }
  else if (e.key === 'Escape') { if (!$('modal').hidden) closeModal(); else if (ghost) cancelGhost(); else if (multi) exitMulti(); else setSel(null); }
});

// ===== 売買 =====
function owned(d) { return d.cat === 'wallpaper' || d.cat === 'floor' ? T.own[d.cat].includes(d.id) : false; }
async function buy(id, direct) {
  const d = ITEM[id], deco = d.cat === 'wallpaper' || d.cat === 'floor';
  if (d.rank > curRank()) { toast(CFG.RANKS[d.rank].name + 'ランクで解放されます', 'ng'); sfx('ng'); return; }
  if (me.picos < priceOf(d)) { toast('ピコが足りません', 'ng'); sfx('ng'); return; }
  const pin = await getPin(); if (pin === null) return;
  if (SV.on) {
    const r = await svCall('buy_item', { p_uid: me.uid, p_pin: pin, p_item: id });
    if (!r || !r.ok) { if (r) { if (r.err === 'pin' || r.err === 'locked') dropPin(); toast(errText(r.err), 'ng'); sfx('ng'); } return; }
    floatText('-' + fmt(priceOf(d)) + ' ピコ', 'm'); coinOut(); await pullApply(true); sfx('buy');
    if (direct) { afterBuy(d, deco); return true; }
    toast(d.name + 'を購入しました。' + (deco ? 'リフォームで使えます（家のみんなで共有）' : '持ち物から置けます'), 'ok'); return true;
  }
  coinOut(); addPts(-priceOf(d)); $('coin').classList.remove('bump'); void $('coin').offsetWidth; $('coin').classList.add('bump');
  if (deco) { T.own[d.cat].push(id); if (!direct) toast(d.name + 'を購入しました。リフォームで使えます（家のみんなで共有）', 'ok'); }
  else { me.inv[id] = (me.inv[id] || 0) + 1; if (!direct) toast(d.name + 'を購入しました。持ち物から置けます', 'ok'); }
  sfx('buy'); save(); renderPanel(); if (direct) afterBuy(d, deco); return true;
}
// 買ったあと：家具はそのまま置く場面へ、壁紙・床はそのまま使う
function afterBuy(d, deco) {
  boughtId = d.id; setTimeout(() => { boughtId = null; }, 800);
  if (deco) { applyDeco(d.id); toast(d.name + 'を購入して、さっそく使いました', 'ok'); return; }
  toast(d.name + 'を購入。置きたい場所をタップ', 'ok'); startPlace(d.id, 'inv');
}
function applyDeco(id) { const d = ITEM[id]; room()[d.cat === 'wallpaper' ? 'wall' : 'floor'] = id; sfx('place'); toast(d.name + 'にしました', 'ok'); rebuildRoom(); save(); renderPanel(); }

// ===== パネル =====
let tab = 'shop', shopCat = 'all';
// ミッションは2か所：部屋の左上の小さなカード（#btnMission）と、パネルのタブの上の帯ボタン（#msTab。押すとパネルにチーミの達成状況）
// 帯ボタンは家具・アイテムのタブとは別の形・色にして、見分けられるようにする
const TABS = [['shop', 'ショップ'], ['inv', '持ち物'], ['reno', 'リフォーム'], ['plan', '間取り']];
function renderTabs() { const t = $('tabs'); t.innerHTML = ''; if (tab !== 'mission' && !TABS.some(([k]) => k === tab)) tab = 'shop'; TABS.forEach(([k, n]) => t.appendChild(h('button', { cls: 'tab' + (tab === k ? ' on' : ''), text: n, onclick: () => { tab = k; renderPanel(); } }))); paintMsTab(); }
const MS_ICO = '<svg class="ic" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 21V4M5 4h12l-2.5 4 2.5 4H5"/></svg>';
function paintMsTab() {
  const b = $('msTab'); if (!b) return;
  b.hidden = !T; if (!T) return;
  const L = missionsSorted().filter(m => phaseOf(m) !== 'over' || canClaim(m)), m = L.find(canClaim) || L[0], st = m ? missionStat(m, T) : null, nw = L.some(canClaim);
  b.className = 'btn' + (tab === 'mission' ? ' on' : '') + (nw ? ' new' : '');
  b.innerHTML = MS_ICO;
  b.appendChild(h('span', { cls: 'mt-k', text: 'ミッション' }));
  b.appendChild(h('span', { cls: 'mt-s', text: !m ? 'いまはなし' : nw ? '🎁 報酬を受け取れます' : T.name + '：' + st.done + '/' + st.total + '人 達成' }));
  b.appendChild(h('span', { cls: 'mt-go', text: tab === 'mission' ? '表示中' : '見る ›' }));
  b.onclick = () => { tab = tab === 'mission' ? 'shop' : 'mission'; renderPanel(); sfx('tap'); };
}
function iconEl(d) {
  const e = h('div', { cls: 'ico' }); const im = new Image(); im.alt = ''; im.width = 44; im.height = 44; e.appendChild(im);
  if (d.pat) im.src = makeIcon(d, 88); else itemIcon(d, im);
  return e;
}
function sizeText(d) { return d.wall ? '幅' + d.w : d.w + '×' + d.d; }
function renderPanel() {
  renderTabs(); const body = $('tabBody'), sc = body.scrollTop; body.innerHTML = '';
  if (tab === 'mission') missionView(body); else if (tab === 'shop') shopView(body); else if (tab === 'inv') invView(body); else if (tab === 'reno') renoView(body); else planView(body);
  body.scrollTop = sc;
}
// ショップ・持ち物：同じ「タイル」の見た目。タップ＝買う→そのまま置く（壁紙・床は買ってそのまま使う）
let boughtId = null;
function tileEl(d, o) {
  const ico = h('span', { cls: 'tile-ico' }); const im = new Image(); im.alt = ''; im.width = 88; im.height = 88; ico.appendChild(im);
  if (d.pat) im.src = makeIcon(d, 176); else itemIcon(d, im);
  const t = h('button', { cls: 'tile' + (boughtId === d.id ? ' pop' : '') + (o.lock ? ' lock' : '') + (o.poor ? ' poor' : '') + (o.have ? ' have' : ''), onclick: o.onclick, 'aria-label': d.name }, [
    ico, h('span', { cls: 'tile-nm', text: d.name }),
    h('span', { cls: 'tile-meta' }, [o.price != null ? h('span', { cls: 'price' + (o.poor ? ' no' : '') }, [h('span', { cls: 'coin xs' }), h('b', { text: fmt(o.price) })]) : null, o.sub ? h('span', { cls: 'tile-sz', text: o.sub }) : null]),
    o.badge ? h('span', { cls: 'tile-badge' + (o.lock ? ' lk' : ''), text: o.badge }) : null
  ]);
  if (o.lock) t.setAttribute('aria-disabled', 'true');
  return t;
}
function shopView(body) {
  if (me && me.staff) { body.appendChild(h('p', { cls: 'staff-note', text: '担任助手は見るだけモードです。家具を選ぶと、動かす・しまう・売るができます（しまう・売るは持ち主に戻ります）。' })); return; }
  const chips = h('div', { cls: 'chips' }); const all = [['all', 'すべて']].concat(CATS.map(c => [c.id, c.name]));
  all.forEach(([k, n]) => chips.appendChild(h('button', { cls: 'chip' + (shopCat === k ? ' on' : ''), text: n, onclick: () => { shopCat = k; renderPanel(); $('tabBody').scrollTop = 0; sfx('tap'); } })));
  body.appendChild(chips);
  const list = ITEMS.filter(d => !d.free && (shopCat === 'all' || d.cat === shopCat)), grid = h('div', { cls: 'tiles' });
  list.forEach(d => {
    const lock = d.rank > curRank(), have = owned(d), price = priceOf(d), poor = !have && !lock && me.picos < price, deco = d.cat === 'wallpaper' || d.cat === 'floor', cnt = me.inv[d.id] || 0;
    grid.appendChild(tileEl(d, {
      lock, poor, have, price: have || lock ? null : price, sub: have ? '購入ずみ' : lock ? 'あと ' + fmt(Math.max(0, CFG.RANKS[d.rank].min * mul() - (me.earned || 0))) : poor ? 'あと ' + fmt(price - me.picos) : deco ? '' : sizeText(d),
      badge: lock ? '🔒 ' + CFG.RANKS[d.rank].name : have ? 'つかう' : cnt ? '持ってる ×' + cnt : '',
      onclick: () => {
        if (lock) { toast(CFG.RANKS[d.rank].name + 'ランクで解放されます', 'ng'); sfx('ng'); return; }
        if (have) { applyDeco(d.id); return; }
        buy(d.id, true);
      }
    }));
  });
  if (!list.length) body.appendChild(h('div', { cls: 'empty' }, [h('div', { cls: 'empty-ico', text: '🛍️' }), h('div', { text: 'このカテゴリはまだ空っぽ' })]));
  body.appendChild(grid);
}
function invView(body) {
  const ids = Object.keys(me.inv).filter(k => me.inv[k] > 0);
  if (!ids.length) { body.appendChild(h('div', { cls: 'empty' }, [h('div', { cls: 'empty-ico', text: '📦' }), h('div', { text: '持ち物はまだ空っぽ' }), h('div', { cls: 'empty-sub', text: 'ショップで買うと、ここから置けます' }), h('button', { cls: 'btn mint', text: 'ショップを見る', onclick: () => { tab = 'shop'; renderPanel(); } })])); return; }
  const grid = h('div', { cls: 'tiles' });
  ids.forEach(id => { const d = ITEM[id]; grid.appendChild(tileEl(d, { sub: (d.ltd ? '🎁非売品・' : '') + sizeText(d), badge: '×' + me.inv[id], onclick: () => startPlace(id, 'inv') })); });
  body.appendChild(grid);
}
function renoView(body) {
  [['wallpaper', '壁紙', 'wall'], ['floor', '床', 'floor']].forEach(([cat, name, key]) => {
    body.appendChild(h('div', { cls: 'sec', text: name + '（' + room().name + '）' })); const g = h('div', { cls: 'swgrid' });
    T.own[cat].forEach(id => { const d = ITEM[id], s = h('div', { cls: 'sw' + (room()[key] === id ? ' on' : ''), onclick: () => applyDeco(id) }); const im = new Image(); im.src = makeIcon(d, 144); s.appendChild(im); s.appendChild(h('div', { cls: 'n', text: d.name })); g.appendChild(s); });
    body.appendChild(g);
  });
  body.appendChild(h('div', { cls: 'empty slim' }, [h('button', { cls: 'btn mint', text: 'ショップで買い足す', onclick: () => { tab = 'shop'; shopCat = 'wallpaper'; renderPanel(); } })]));
}
function bankCard() {
  const c = h('div', { cls: 'card bankcard' }); c.appendChild(h('h4', { text: 'チーミ貯金箱' }));
  c.appendChild(h('div', { cls: 'bankrow' }, [h('span', { cls: 'coin sm' }), h('b', { text: fmt(T.picos) }), h('i', { text: 'ピコ' })]));
  c.appendChild(h('p', { cls: 'hint', text: 'みんなで貯めて、間取りを変えるのに使います。自分のピコから寄付できます' }));
  c.appendChild(h('button', { cls: 'btn mint', text: '寄付する', onclick: donateDlg }));
  return c;
}
// 間取りタブ：今の家のかんたんな図と、間取りを変える画面への入口
function miniPlan() {
  const NS = 'http://www.w3.org/2000/svg', box = houseBox(T.rooms), m = .6, svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', (box.x0 - m) + ' ' + (box.z0 - m) + ' ' + (box.w + m * 2) + ' ' + (box.d + m * 2)); svg.setAttribute('class', 'mini-plan'); svg.setAttribute('aria-hidden', 'true');
  const parts = T.rooms.map((r, i) => '<rect x="' + r.x + '" y="' + r.z + '" width="' + r.w + '" height="' + r.d + '" rx=".15" fill="' + ((ITEM[r.floor] || {}).color || '#e8d3ae') + '" stroke="' + (i === S.cur.room ? '#f2877a' : '#8a6a44') + '" stroke-width="' + (i === S.cur.room ? .3 : .14) + '"/>');
  svg.innerHTML = parts.join(''); return svg;
}
function planView(body) {
  const cnt = T.n > 0 ? T.n : T.members.length, rm = room(), bb = houseBox(T.rooms);
  body.appendChild(bankCard());
  const c1 = h('div', { cls: 'card' }); c1.appendChild(h('h4', { text: '間取り' }));
  c1.appendChild(miniPlan());
  c1.appendChild(h('p', { cls: 'hint', text: '部屋 ' + T.rooms.length + ' / ' + CFG.MAX_ROOMS + '　家の大きさ ' + bb.w + '×' + bb.d + 'マス' }));
  if (me && me.staff) c1.appendChild(h('p', { cls: 'hint', text: '担任助手は見るだけモードです' }));
  else c1.appendChild(h('button', { cls: 'btn coral', text: '間取りを変える', onclick: openPlanScreen }));
  c1.appendChild(h('p', { cls: 'hint', text: '部屋を広げる・作る・つなげる。貯金箱のピコを使います' }));
  body.appendChild(c1);
  const c2 = h('div', { cls: 'card' }); c2.appendChild(h('h4', { text: '今いる部屋の名前' }));
  const inp = h('input', { type: 'text', maxlength: '8', value: rm.name }); c2.appendChild(inp);
  c2.appendChild(h('button', { cls: 'btn', text: '名前を変える', onclick: () => { rm.name = inp.value.trim().slice(0, 8) || rm.name; save(); renderRooms(); renderPanel(); toast('名前を変更しました', 'ok'); } }));
  body.appendChild(c2);
}
function openPlanScreen() {
  if (!T || !me) return; exitMulti(); cancelGhost(); selUid = null;
  return openPlan({ T, cur: S.cur.room, n: T.n > 0 ? T.n : T.members.length, mul, bank: () => T.picos, run: applyLayoutRun });
}
// 間取りの確定：サーバー版は team_layout（費用・制約はサーバーで確かめる）、端末だけのときはここで反映
async function applyLayoutRun(p) {
  const { rooms, open, cost } = p;
  if (T.picos < cost) { toast('貯金箱のピコが足りません', 'ng'); sfx('ng'); return false; }
  if (SV.on) {
    clearTimeout(ct); await commitHouse();   // 置いた家具を先に保存してから
    const r = await svCall('team_layout', { p_uid: me.uid, p_team: T.id, p_version: T.version, p_rooms: rooms, p_open: open });
    if (!r || !r.ok) { if (r) toast(errText(r.err), 'ng'); sfx('ng'); await pullApply(true); return false; }
    await pullApply(true);
  } else {
    T.picos -= cost; T.rooms = rooms.map(r => { const c = Object.assign({}, r); delete c.k; return c; }); T.open = open.slice();
  }
  if (S.cur.room >= T.rooms.length) S.cur.room = 0;
  placeAvatars(); rebuildRoom(); renderRooms(); renderHud(); renderPanel(); sfx('buy'); confetti(26); toast('間取りを変更しました', 'ok'); if (!SV.on) save();
  return true;
}
// 貯金箱への寄付：自分の所持ピコから。番号を確かめる
function donateDlg() {
  const body = h('div', { cls: 'donate' }); let amt = 0;
  const inp = h('input', { type: 'number', min: '0', step: '100', inputmode: 'numeric', placeholder: '0' }), info = h('div', { cls: 'hint' });
  const set = v => { amt = Math.max(0, Math.min(me.picos, Math.floor(+v || 0))); inp.value = amt ? String(amt) : ''; };
  inp.addEventListener('input', () => { amt = Math.max(0, Math.min(me.picos, Math.floor(+inp.value || 0))); });
  body.appendChild(h('p', { text: 'あなたのピコ：' + fmt(me.picos) + '　貯金箱：' + fmt(T.picos) }));
  const q = h('div', { cls: 'quick' }); [1000, 5000, 10000].forEach(v => q.appendChild(h('button', { cls: 'btn sm', text: '+' + fmt(v), onclick: () => set(amt + v) }))); q.appendChild(h('button', { cls: 'btn sm', text: 'ぜんぶ', onclick: () => set(me.picos) }));
  body.appendChild(q); body.appendChild(inp); body.appendChild(info);
  modal('貯金箱に寄付', body, [h('button', { cls: 'btn', text: 'やめる', onclick: closeModal }), h('button', { cls: 'btn coral', text: '寄付する', onclick: async () => {
    amt = Math.min(me.picos, Math.floor(+inp.value || amt)); if (amt <= 0) { toast('ピコの数を入力してください', 'ng'); return; }
    closeModal(); const pin = await getPin(); if (pin === null) return;
    if (SV.on) {
      const r = await svCall('donate', { p_uid: me.uid, p_pin: pin, p_amount: amt });
      if (!r || !r.ok) { if (r) { if (r.err === 'pin' || r.err === 'locked') dropPin(); toast(errText(r.err), 'ng'); } return; }
      floatText('-' + fmt(amt) + ' ピコ', 'm'); sfx('coin'); donateFx(); toast('貯金箱に ' + fmt(amt) + ' ピコを寄付しました', 'ok'); await pullApply(true); return;
    }
    me.picos -= amt; T.picos += amt; floatText('-' + fmt(amt) + ' ピコ', 'm'); sfx('coin'); donateFx(); toast('貯金箱に ' + fmt(amt) + ' ピコを寄付しました', 'ok'); renderHud(); save(); renderPanel();
  } })]);
}
function switchRoom(i) { exitMulti(); cancelGhost(); selUid = null; S.cur.room = i; placeAvatars(); rebuildRoom(); renderRooms(); renderBar(); renderPanel(); save(); }
function renderRooms() { const r = $('rooms'); r.innerHTML = ''; r.hidden = T.rooms.length < 2; T.rooms.forEach((rm, i) => r.appendChild(h('button', { cls: 'rtab' + (i === S.cur.room ? ' on' : ''), text: rm.name, onclick: () => switchRoom(i) }))); }

// ===== HUD・ダイアログ =====
let meChipKey = '';
function renderHud() {
  if (!T || !me) return;
  const ri = curRank(), r = CFG.RANKS[ri], nx = CFG.RANKS[ri + 1], e = me.earned || 0, b0 = r.min * mul(), b1 = nx ? nx.min * mul() : 0, pct = nx ? (e - b0) / (b1 - b0) * 100 : 100;
  $('rankName').textContent = r.name; $('rankNext').textContent = nx ? 'あと ' + fmt(Math.max(0, b1 - e)) : 'MAX'; { const bg = 'linear-gradient(90deg,#bdeedd ' + pct + '%,#fffaf0 ' + pct + '%)'; if ($('rank')._bg !== bg) { $('rank')._bg = bg; $('rank').style.background = bg; } }
  $('rank').title = nx ? '次のランク「' + nx.name + '」まで あと ' + fmt(b1 - e) + ' ピコ' : '最高ランク'; checkRankUp();
  $('meNick').textContent = nickOf(me) + (adminOn && !me.staff ? '★' : ''); $('meChip').title = nickOf(me) + '（' + T.name + '）';
  const k = me.uid + (me.me ? JSON.stringify(me.me) : ''); if (k !== meChipKey) { meChipKey = k; $('meFace').src = me.me ? meThumb(me.me, 'face') : ''; $('meFace').style.display = me.me ? '' : 'none'; }
  $('btnPend').hidden = !(SV.on && !me.staff && me.approved === false);   // 承認まち：何ができて何ができないかを見せる
  $('bank').textContent = fmt(T.picos); $('bankBox').title = T.name + 'の貯金箱（タップで寄付）';
  paintNotesBtn(); paintMissionBtn();
}
// 承認まち：担任助手が名簿の人とひもづけるまで
function pendDlg() {
  const ul = h('ul', { cls: 'dm-list' }); ['担任助手が me- を名簿の人と確認すると「承認」されます', 'それまで、得点・在校時間のピコは入りません', '家を見る・歩く・家具を動かすことは今もできます', '早く承認してほしいときは、担任助手に声をかけてください'].forEach(x => ul.appendChild(h('li', { text: x })));
  modal('承認まち', ul, [h('button', { cls: 'btn coral', text: '了解', onclick: closeModal })]);
}
// 自分のチップを押したとき：プロフィール（見た目・きせかえ・切り替え・設定）
function profileDlg() {
  if (!T || !me) return;
  const ri = curRank(), r = CFG.RANKS[ri], nx = CFG.RANKS[ri + 1], e = me.earned || 0, b0 = r.min * mul(), b1 = nx ? nx.min * mul() : 0, pct = nx ? Math.max(0, Math.min(100, (e - b0) / (b1 - b0) * 100)) : 100;
  const body = h('div', { cls: 'prof' });
  const face = me.me ? faceImg(me.me, 'face', 'pf-face') : h('div', { cls: 'pf-face none', text: '？' });
  body.appendChild(h('div', { cls: 'pf-top' }, [face, h('div', { cls: 'pf-who' }, [h('b', { cls: 'pf-nick', text: nickOf(me) }), h('span', { cls: 'pf-team', text: T.name }), h('span', { cls: 'pf-pico' }, [h('span', { cls: 'coin sm' }), h('b', { text: fmt(me.picos) }), h('i', { text: 'ピコ' })])])]));
  body.appendChild(h('div', { cls: 'pf-rank' }, [h('div', { cls: 'pf-rt' }, [h('b', { text: r.name }), h('span', { text: nx ? '次の ' + nx.name + ' まで あと ' + fmt(Math.max(0, b1 - e)) + ' ピコ' : '最高ランク' })]), h('div', { cls: 'prog' }, [h('i', { style: 'width:' + pct.toFixed(1) + '%' })])]));
  const acts = h('div', { cls: 'pf-acts' });
  if (!me.staff) {
    acts.appendChild(h('button', { cls: 'btn', onclick: async () => { closeModal(); if (await requirePin()) editMe('wear'); } }, [h('span', { text: '👕 きせかえ' })]));
    acts.appendChild(h('button', { cls: 'btn', onclick: async () => { closeModal(); if (await requirePin()) editMe(); } }, [h('span', { text: '✏️ me-をつくりなおす' })]));
  } else acts.appendChild(h('button', { cls: 'btn', text: '✏️ 担任助手の me-', onclick: () => { closeModal(); editStaffMe(staffList().find(p => p.id === me.staffId) || null); } }));
  acts.appendChild(h('button', { cls: 'btn', text: '🔁 ほかの人に切り替える', onclick: () => { closeModal(); leaveTeam(); } }));
  acts.appendChild(h('button', { cls: 'btn', text: '⚙ 設定', onclick: () => { closeModal(); settingsDlg(); } }));
  body.appendChild(acts);
  modal(nickOf(me) + ' のプロフィール', body, [h('button', { cls: 'btn coral', text: 'とじる', onclick: closeModal })], 'profbox');
}
function settingsDlg() {
  const body = h('div'), snd = h('input', { type: 'checkbox' }); snd.checked = S.sound; snd.onchange = () => { S.sound = snd.checked; save(); if (S.sound) sfx('tap'); };
  body.appendChild(h('div', { cls: 'setrow' }, [h('span', { text: '効果音' }), snd]));
  const qb = h('span'), paintQ = () => { qb.innerHTML = ''; [['std', '標準'], ['high', '高']].forEach(([k, n]) => qb.appendChild(h('button', { cls: 'btn sm' + (quality === k ? ' mint' : ''), text: n, style: 'margin-left:4px', onclick: () => { quality = k; try { localStorage.setItem(QKEY, k); } catch (e) { } setQuality(k); paintQ(); } }))); };
  paintQ(); body.appendChild(h('div', { cls: 'setrow' }, [h('span', { text: '画質' }), qb]));
  body.appendChild(h('div', { cls: 'setrow' }, [h('span', { text: 'あそび方' }), h('button', { cls: 'btn sm', text: 'もう一度見る', onclick: () => { closeModal(); setTimeout(() => startCoach(), 150); } })]));
  if (me && me.staff) body.appendChild(h('div', { cls: 'setrow' }, [h('span', { text: '担任助手の me-' }), h('button', { cls: 'btn sm', text: '見た目をかえる', onclick: () => { closeModal(); editStaffMe(staffList().find(p => p.id === me.staffId) || null); } })]));
  else body.appendChild(h('div', { cls: 'setrow' }, [h('span', { text: 'me-（見た目）' }), h('button', { cls: 'btn sm', text: 'つくりなおす', onclick: async () => { closeModal(); if (await requirePin()) editMe(); } })]));
  if (me && !me.staff) body.appendChild(h('div', { cls: 'setrow' }, [h('span', { text: 'プレゼントコード' }), h('button', { cls: 'btn sm', text: 'コードを入れる', onclick: () => { closeModal(); giftCodeDlg(); } })]));
  if (MODE !== 'student') body.appendChild(h('div', { cls: 'setrow' }, [h('span', { text: '担任助手の人へ' }), h('button', { cls: 'btn sm', text: '担任助手モード', onclick: () => { closeModal(); gateAdmin(); } })]));
  modal('設定', body, [h('button', { cls: 'btn', text: 'とじる', onclick: closeModal })]);
}
function afterLoad() { ghost = null; multi = null; setMultiBtn(); showGrid(false); buildGhost(); selUid = null; setCamMode('iso'); paintCam(); rebuildAvatars(); rebuildRoom(); renderRooms(); renderHud(); renderBar(); renderPanel(); }

// ===== 画面の切り替え：チーミ選択 → メンバー選択 → 家 =====
// me-未作成・ニックネーム未設定なら作成画面へ。番号(PIN)未設定（リセット後）なら決め直してから入る
function enterAs(teamId, uid) {
  const t = S.teams.find(x => x.id === teamId && x.confirmed), st = studentById(uid); if (!t || !st) return;
  if (SV.on) { enterServer(t, st); return; }
  if (!st.me || !st.nick) { makeFlow(t, st, st.me, st.nick); return; }
  if (!st.pin) { pinSet({ face: faceImg(st.me, 'face', 'face'), who: nickOf(st) }).then(np => { if (!np) return; st.pin = pinHash(np, st.uid); pinUntil.set(st.uid, Date.now() + 300000); save(); startHouse(t, st); }); return; }
  startHouse(t, st);
}
function makeFlow(t, st, me0, nick0) {
  openMeMaker({ me: me0, nick: nick0, nextLabel: 'つぎへ（番号をきめる）', cancelLabel: 'もどる', onDone: async (m, nick) => {
    const np = await pinSet({ face: faceImg(m, 'face', 'face'), who: nick, step: '3/3' });
    if (!np) { makeFlow(t, st, m, nick); return; }
    st.me = m; st.nick = nick; st.pin = pinHash(np, st.uid); pinUntil.set(st.uid, Date.now() + 300000); save(); toast('me-を作りました', 'ok'); startHouse(t, st);
  } });
}
// 家の中から、見た目だけ作りなおす（ニックネームも変えられる）
function editMe(tab) {
  const st = me;
  // きせかえショップ：自分のピコで買う（4桁番号を確かめる）。買った物は st.wear に入る（サーバー版は buy_wear で価格をサーバーが確かめる）
  const wearPrice = (k, i) => Math.round(WEAR[k][i][1] * mul());
  const shop = {
    owned: (k, i) => (st.wear || []).includes(k + i), price: wearPrice, picos: () => st.picos,
    buy: async (k, i) => {
      const p = wearPrice(k, i); if (st.picos < p) { toast('ピコが足りません', 'ng'); sfx('ng'); return false; }
      if (!await requirePin()) return false;
      if (SV.on) {
        const r = await svCall('buy_wear', { p_uid: st.uid, p_pin: pinCache.pin, p_key: k + i });
        if (!r || !r.ok) { if (r) { if (r.err === 'pin' || r.err === 'locked') dropPin(); toast(errText(r.err), 'ng'); } sfx('ng'); return false; }
        st.picos = Math.max(0, st.picos - p); st.wear = (st.wear || []).concat(k + i); sfx('buy'); renderHud(); return true;
      }
      if (me === st) addPts(-p); else st.picos -= p;
      st.wear = (st.wear || []).concat(k + i); sfx('buy'); save(); renderHud(); return true;
    }
  };
  openMeMaker({ me: st.me, nick: st.nick, shop, wearOnly: tab === 'wear', tab: typeof tab === 'number' ? tab : 0, nextLabel: 'これでけってい', cancelLabel: 'やめる', onDone: async (m, nick) => {
    if (SV.on) {
      const r = await svCall('set_profile', { p_uid: st.uid, p_pin: pinCache.pin, p_nick: nick, p_me: m, p_new_pin: null });
      if (!r || !r.ok) { if (r) { if (r.err === 'pin' || r.err === 'locked') dropPin(); toast(errText(r.err), 'ng'); } return; }
      await pullApply(true); meChipKey = ''; renderHud(); toast('me- を変更しました', 'ok'); return;
    }
    st.me = m; st.nick = nick; save(); meChipKey = ''; rebuildAvatars(); renderHud(); toast('me- を変更しました', 'ok');
  } });
}
// 担任助手として家を見に行く（財布なし。家具の移動・しまう・売るは担任助手の権限でできる）
// 担任助手の姿は「担任助手me-」（担任助手モードで作る）から選ぶ。この端末で最後に使った人を覚えておく
const STAFFKEY = 'kojoHouse.staffId';
const getStaffId = () => { try { return localStorage.getItem(STAFFKEY) || ''; } catch (e) { return ''; } };
const setStaffId = id => { try { localStorage.setItem(STAFFKEY, id); } catch (e) { } };
const staffList = () => S.staffMes || [];
const makeStaff = p => ({ uid: '__staff', staff: true, staffId: p ? p.id : null, nick: p ? p.nick : '担任助手', picos: 0, earned: 0, inv: {}, me: p && p.me ? p.me : null });
function pickStaff() {
  const L = staffList(); if (L.length <= 1) return Promise.resolve(L[0] || null);
  const last = L.find(p => p.id === getStaffId()); if (last) return Promise.resolve(last);
  return new Promise(res => {
    const body = h('div', { cls: 'staff-pick' });
    L.forEach(p => body.appendChild(h('button', { cls: 'btn staff-pickbtn', onclick: () => { closeModal(); setStaffId(p.id); res(p); } }, [p.me ? faceImg(p.me, 'face', 'mini') : h('span', { cls: 'mini none' }), h('b', { text: '★' + p.nick })])));
    modal('どの担任助手？', body, [h('button', { cls: 'btn', text: 'やめる', onclick: () => { closeModal(); res(undefined); } })]);
  });
}
async function visitTeam(teamId) {
  const t = S.teams.find(x => x.id === teamId && x.confirmed); if (!t) { toast('確定したチーミだけ見に行けます', 'ng'); return; }
  const prev = me && me.staff ? staffList().find(p => p.id === me.staffId) : null;
  const p = prev || await pickStaff(); if (p === undefined) return;
  startHouse(t, makeStaff(p)); adminOn = true; tab = 'inv'; renderHud(); renderPanel(); toast(t.name + 'の家を見ているよ（担任助手）', 'ok');
  if (!p) toast('担任助手モードの「担任助手me-」で、自分の me- を作れます', 'ok');
}
// 見るだけで家に入る（パスワードなし）。何を動かしても保存されない（adminOn=false・commitHouse は止める）
async function watchTeam(teamId) {
  const t = S.teams.find(x => x.id === teamId && x.confirmed); if (!t) { toast('確定したチーミだけ見に行けます', 'ng'); return; }
  if (T) leaveTeam();
  const st = makeStaff(null); st.watch = true; st.nick = '見学'; startHouse(t, st); adminOn = false; tab = 'inv'; renderHud(); renderPanel(); toast(t.name + 'の家を見ているよ（見るだけ・保存されません）', 'ok');
}
// ほかのチーミの家へ（担任助手だけ。生徒はあいことばが無いと入れない）
function teamJumpDlg() {
  if (!me || !me.staff) return;
  const body = h('div', { cls: 'picklist' });
  S.teams.filter(t => t.confirmed).forEach(t => body.appendChild(h('button', { cls: 'btn pickbtn' + (T && t.id === T.id ? ' mint' : ''), onclick: () => { closeModal(); if (T && t.id === T.id) return; leaveTeam(); visitTeam(t.id); } }, [h('span', { cls: 'a', text: t.name }), h('span', { cls: 'b', text: t.members.length + '人' + ((t.notes || []).length ? '・伝言 ' + t.notes.length : '') })])));
  modal('ほかのチーミの家へ', body, [h('button', { cls: 'btn', text: 'やめる', onclick: closeModal })]);
}
// 担任助手のme-を作る・変える（担任助手モードの中・家を見ているときの設定から）
function editStaffMe(p, after) {
  openMeMaker({ me: p && p.me, nick: p ? p.nick : '', allWear: true, top: true, nextLabel: 'これでけってい', cancelLabel: 'やめる', onDone: async (m, nick) => {
    const id = p ? p.id : 's' + Date.now().toString(36);
    if (SV.on) {
      const r = await svCall('admin_staff_save', { p_admin: SV.adminPass, p_id: id, p_nick: nick, p_me: m });
      if (!r || !r.ok) { if (r) toast(errText(r.err), 'ng'); return; }
      await pullApply(true);
    } else {
      const L = S.staffMes = S.staffMes || [], i = L.findIndex(x => x.id === id), o = { id, nick, me: m };
      if (i >= 0) L[i] = o; else L.push(o); saveNow();
    }
    setStaffId(id);
    if (me && me.staff && (!me.staffId || me.staffId === id)) { me.staffId = id; me.nick = nick; me.me = m; meChipKey = ''; rebuildAvatars(); renderHud(); }
    toast('担任助手の me- を保存しました', 'ok'); if (after) after();
  } });
}

// ===== 家の伝言板：担任助手だけが書ける。生徒は自分のチーミの家で読む =====
const SEENKEY = 'kojoHouse.seenNotes';
const seenNotes = () => { try { return JSON.parse(localStorage.getItem(SEENKEY) || '{}') || {}; } catch (e) { return {}; } };
const unreadNotes = t => { const s = seenNotes()[t.id] || 0; return (t.notes || []).filter(n => n.at > s).length; };
function markNotesSeen(t) { const s = seenNotes(), last = Math.max(0, ...(t.notes || []).map(n => n.at)); s[t.id] = last; try { localStorage.setItem(SEENKEY, JSON.stringify(s)); } catch (e) { } }
function paintNotesBtn() {
  const b = $('btnNotes'), j = $('btnTeams'); if (!b) return;
  if (!T) { b.hidden = true; if (j) j.hidden = true; return; }
  const n = (T.notes || []).length, u = me && me.staff ? 0 : unreadNotes(T);
  b.hidden = !n && !(me && me.staff); setTl(b, '伝言板' + (n ? '（' + n + '）' : '')); b.classList.toggle('new', u > 0);
  if (j) j.hidden = !(me && me.staff);
}
const fmtAt = ms => { const d = new Date(ms); return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0'); };
function notesDlg() {
  if (!T) return; const t = T, staff = !!(me && me.staff && adminOn);
  const body = h('div', { cls: 'notes' }), list = h('div', { cls: 'note-list' });
  const paint = () => {
    list.innerHTML = ''; const L = (t.notes || []).slice().reverse();
    if (!L.length) list.appendChild(emptyBox('💬', staff ? 'まだ伝言はありません' : 'まだ伝言はありません', staff ? '下から書けます' : ''));
    L.forEach(n => list.appendChild(h('div', { cls: 'note' }, [h('div', { cls: 'note-hd' }, [h('b', { text: '★' + (n.by || '担任助手') }), h('span', { text: fmtAt(n.at) }), staff ? h('button', { cls: 'note-x', text: '×', 'aria-label': 'この伝言を消す', onclick: () => delNote(t, n, paint) }) : null]), h('div', { cls: 'note-tx', text: n.text })])));
  };
  paint(); body.appendChild(list);
  if (staff) {
    const ta = h('textarea', { cls: 'ta note-in', rows: '3', maxlength: '200', placeholder: t.name + 'のみんなへ（200文字まで）' });
    body.appendChild(ta); body.appendChild(h('button', { cls: 'btn coral', text: '伝言を書く', onclick: async () => { if (await addNote(t, ta.value)) { ta.value = ''; paint(); } } }));
  } else body.appendChild(h('div', { cls: 'hint', text: '伝言板は担任助手からのお知らせです' }));
  markNotesSeen(t); paintNotesBtn();
  modal(t.name + 'の伝言板', body, [h('button', { cls: 'btn', text: 'とじる', onclick: closeModal })]);
}
async function addNote(t, text) {
  text = String(text || '').trim().slice(0, 200); if (!text) { toast('伝言を書いてください', 'ng'); return false; }
  const by = (me && me.nick) || '担任助手';
  if (SV.on) { const r = await svCall('admin_note_add', { p_admin: SV.adminPass, p_team: t.id, p_by: by, p_body: text }); if (!r || !r.ok) { if (r) toast(errText(r.err), 'ng'); return false; } await pullApply(true); const nt = S.teams.find(x => x.id === t.id); if (nt) t.notes = nt.notes; }
  else { t.notes = (t.notes || []).concat({ id: String(Date.now()), at: Date.now(), by, text }).slice(-100); saveNow(); }
  sfx('tap'); toast('伝言を書きました', 'ok'); paintNotesBtn(); return true;
}
async function delNote(t, n, after) {
  if (!await confirmDlg('この伝言を消しますか？', '消す')) return;
  if (SV.on) { const r = await svCall('admin_note_delete', { p_admin: SV.adminPass, p_id: n.id }); if (!r || !r.ok) { if (r) toast(errText(r.err), 'ng'); return; } await pullApply(true); const nt = S.teams.find(x => x.id === t.id); if (nt) t.notes = nt.notes; }
  else { t.notes = (t.notes || []).filter(x => x !== n); saveNow(); }
  paintNotesBtn(); after();
}
// ===== 週間ミッション：チーミ全員が条件を達成したら、ひとりずつ報酬を受け取れる =====
// 生徒の画面には「何人中何人が達成」だけを出す（ひとりひとりのコマ数は出さない）
const PHASE = { now: ['実施中', 'ok'], soon: ['これから', ''], over: ['終わった', 'dim'] };
const missionsSorted = () => { const ord = { now: 0, soon: 1, over: 2 }, today = todayStr(); return (S.missions || []).slice().sort((a, b) => ord[phaseOf(a, today)] - ord[phaseOf(b, today)] || (phaseOf(a, today) === 'over' ? b.start.localeCompare(a.start) : a.start.localeCompare(b.start))); };
function missionStat(m, t) {
  if (!t) return { done: 0, total: 0, achieved: false };
  if (SV.on) return (m.teams && m.teams[t.id]) || { done: 0, total: t.n || t.members.length, achieved: false };
  return localTeamStatus(m, t, studentById);
}
const canClaim = m => !!(T && me && !me.staff && phaseOf(m) !== 'soon' && missionStat(m, T).achieved && !(m.claims || []).includes(me.uid));
function paintMissionBtn() {
  const b = $('btnMission'); if (!b) return;
  const L = T ? missionsSorted().filter(m => phaseOf(m) !== 'over' || canClaim(m)) : [];
  b.hidden = !T || (!L.length && !(me && me.staff)); if (b.hidden) b._sig = '';
  const nw = L.some(canClaim); b.classList.toggle('new', nw);
  if (b.hidden) return;
  // 部屋の左上の小さなカード：ミッション名・チーミの達成人数・自分のコマ数。タップでくわしく（missionDlg）
  const m = L.find(canClaim) || L[0], st = m ? missionStat(m, T) : null;
  // 500msごとに呼ばれるので、表示が変わらないときは作り直さない（性能）
  const c0 = !nw && m && me && !me.staff && phaseOf(m) !== 'soon' ? missionCounts(m, T, paintMissionBtn) : null;
  const sig = [m && m.id, m && m.title, nw, st && st.done, st && st.total, m && phaseOf(m), c0 && me ? c0[me.uid] : '', me && me.staff].join('|');
  if (b._sig === sig) return; b._sig = sig;
  b.innerHTML = '';
  b.appendChild(h('span', { cls: 'mc-hd' }, [
    h('svg-ico'), h('b', { text: 'ミッション' }),
    m ? h('span', { cls: 'tag ' + PHASE[phaseOf(m)][1], text: PHASE[phaseOf(m)][0] }) : null,
    h('span', { cls: 'mc-more', text: 'くわしく ›' })
  ]));
  b.querySelector('svg-ico').outerHTML = '<svg class="ic" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 21V4M5 4h12l-2.5 4 2.5 4H5"/></svg>';
  if (!m) { b.appendChild(h('span', { cls: 'mc-none', text: '今はミッションがありません' })); b.title = '週間ミッション'; return; }
  const pct = st.total ? Math.round(st.done / st.total * 100) : 0;
  b.appendChild(h('span', { cls: 'mc-t', text: m.title }));
  b.appendChild(h('span', { cls: 'mc-row' }, [h('span', { cls: 'mc-bar' }, [h('i', { style: 'width:' + pct + '%' })]), h('b', { cls: 'mc-n', text: st.done + '/' + st.total + '人' })]));
  if (nw) b.appendChild(h('span', { cls: 'mc-claim', text: '🎁 報酬を受け取れます' }));
  else if (me && !me.staff && phaseOf(m) !== 'soon') {
    const c = c0, v = c ? (c[me.uid] || 0) : null;
    if (v != null) b.appendChild(h('span', { cls: 'mc-mine' + (v >= m.need ? ' ok' : '') }, [h('span', { text: 'あなた' }), h('b', { text: v + '/' + m.need + 'コマ' }), h('span', { text: v >= m.need ? '✓' : 'あと' + (m.need - v) }) ]));
  }
  b.title = nw ? 'ミッション達成。報酬を受け取れます' : '週間ミッション：' + m.title + '（' + st.done + '/' + st.total + '人 達成）';
}
const rewardText = m => [m.picos ? fmt(m.picos) + ' ピコ' : '', m.item && ITEM[m.item] ? ITEM[m.item].name : ''].filter(Boolean).join(' ＋ ') || 'なし';
// パネルの「ミッション」タブ と ミッションのボタン（同じ中身）
function missionDlg() { if (!T) return; const body = h('div'); missionView(body); modal('週間ミッション', body, [h('button', { cls: 'btn', text: 'とじる', onclick: closeModal })], 'wide'); }
// ひとりひとりの受講コマ数（ノルマに対してどれだけか）。見せるのは自分のチーミの中だけ
// サーバー版は、チーミのあいことばで確かめてから読む（mission_progress）。読めないときは出さない
const progCache = new Map();
function missionCounts(m, t, repaint) {
  if (!SV.on) return m.counts || {};
  const k = m.id + '|' + t.id, c = progCache.get(k);
  if (c === undefined) {
    progCache.set(k, null);
    svRpc('mission_progress', { p_id: m.id, p_team: t.id, p_pass: getTeamCode(t.id) || '' }).then(r => { progCache.set(k, r && r.ok ? r.counts || {} : false); repaint(); }).catch(() => progCache.set(k, false));
    return null;
  }
  return c || null;
}
// ミッションを開くたびに読み直す（担任助手が記録したら反映されるように）
const clearProg = () => progCache.clear();
function memberProgress(m, t, repaint) {
  const c = missionCounts(m, t, repaint); if (!c) return null;
  const mem = t.members.map(studentById).filter(s => s && !s.staff), box = h('div', { cls: 'ms-mem' });
  const mine = me && !me.staff ? (c[me.uid] || 0) : null;
  if (mine != null) {
    const ok = mine >= m.need, pc = Math.min(100, Math.round(mine / m.need * 100));
    box.appendChild(h('div', { cls: 'ms-mine' + (ok ? ' ok' : '') }, [
      h('span', { cls: 'mm-k', text: 'あなた' }), h('b', { cls: 'mm-n', text: mine + ' / ' + m.need + 'コマ' }),
      h('span', { cls: 'mm-bar' }, [h('i', { style: 'width:' + pc + '%' })]),
      h('span', { cls: 'mm-s', text: ok ? '達成 ✓' : 'あと' + (m.need - mine) + 'コマ' })
    ]));
  }
  const list = h('div', { cls: 'ms-chips' });
  mem.forEach(s => { const v = c[s.uid] || 0, ok = v >= m.need; list.appendChild(h('span', { cls: 'ms-chip' + (ok ? ' ok' : '') + (me && s.uid === me.uid ? ' me' : '') }, [s.me ? faceImg(s.me, 'face', 'mc-f') : h('span', { cls: 'mc-f none' }), h('span', { cls: 'mc-n', text: nickOf(s) }), h('b', { text: v + 'コマ' + (ok ? ' ✓' : '') })])); });
  box.appendChild(list); return box;
}
function missionView(outer) {
  clearProg();
  const t = T, body = h('div', { cls: 'missions' }); outer.appendChild(body);
  const paint = () => {
    body.innerHTML = '';
    const L = missionsSorted();
    if (!L.length) body.appendChild(emptyBox('🎯', '今はミッションがありません', '次のミッションをお待ちください'));
    L.forEach(m => {
      const ph = phaseOf(m), st = missionStat(m, t), got = me && (m.claims || []).includes(me.uid), pct = st.total ? Math.round(st.done / st.total * 100) : 0;
      const it = m.item && ITEM[m.item];
      let act;
      if (me && me.staff) act = h('span', { cls: 'ms-note', text: '受講コマ数は 担任助手モードの「ミッション」で記録します' });
      else if (got) act = h('span', { cls: 'ms-got', text: '受け取りずみ ✓' });
      else if (canClaim(m)) act = h('button', { cls: 'btn coral ms-claim', text: '報酬を受け取る', onclick: () => claimMission(m, paint) });
      else act = h('span', { cls: 'ms-note', text: ph === 'soon' ? '開始までお待ちください' : st.achieved ? '' : ph === 'over' ? '達成なし' : 'あと ' + Math.max(0, st.total - st.done) + '人で達成' });
      body.appendChild(h('div', { cls: 'ms-card' + (st.achieved ? ' done' : '') + (ph === 'over' ? ' over' : '') }, [
        h('div', { cls: 'ms-hd' }, [h('span', { cls: 'tag ' + PHASE[ph][1], text: PHASE[ph][0] }), h('b', { text: m.title }), h('span', { cls: 'ms-date', text: rangeText(m) })]),
        h('div', { cls: 'ms-cond', text: '条件：' + condText(m) }),
        h('div', { cls: 'ms-bar' }, [h('i', { style: 'width:' + pct + '%' })]),
        h('div', { cls: 'ms-prog', text: t.name + '：' + st.done + ' / ' + st.total + '人 達成' + (st.achieved ? '　🎉 チーミ全員クリア' : '') }),
        memberProgress(m, t, paint),
        h('div', { cls: 'ms-rew' }, [h('span', { text: '報酬（ひとりずつ）：' }), it ? (() => { const im = h('img', { cls: 'ms-ico', alt: '' }); itemIcon(it, im); return im; })() : null, h('b', { text: rewardText(m) })]),
        h('div', { cls: 'ms-act' }, [act])
      ]));
    });
  };
  paint();
}
async function claimMission(m, after) {
  if (!canClaim(m)) return;
  if (SV.on) {
    const r = await svCall('mission_claim', { p_uid: me.uid, p_id: m.id }); if (!r) return;
    if (!r.ok) { toast(errText(r.err), 'ng'); sfx('ng'); await pullApply(true); after(); paintMissionBtn(); return; }
    await pullApply(true);
  } else {
    me.picos += m.picos; if (m.item && ITEM[m.item]) { me.inv = me.inv || {}; me.inv[m.item] = (me.inv[m.item] || 0) + 1; }
    m.claims = (m.claims || []).concat(me.uid); saveNow();
  }
  if (m.picos) floatText('+' + fmt(m.picos) + ' ピコ', 'p'); sfx('coin');
  toast('ミッション達成の報酬を受け取りました。' + (m.item && ITEM[m.item] ? '「' + ITEM[m.item].name + '」は持ち物に入りました' : ''), 'ok');
  const fresh = (S.missions || []).find(x => x.id === m.id); if (fresh) Object.assign(m, fresh);
  renderHud(); renderPanel(); paintMissionBtn(); after();
}
// ニックネームが空（担任助手が差し戻した）の人が家に入ったとき：付け直しを求める（番号を確かめてから、me- づくり画面のなまえタブ）
async function nickFixDlg() {
  if (!me || me.nick || me.staff || !T) return;
  if (!await confirmDlg('ニックネームを付け直してください（担任助手から名前の変更を依頼されています）', 'つけなおす', 'ニックネーム')) return;
  if (await requirePin()) editMe(0);
}
// ===== 利用時間（1日あたり。decisions #19）：家にいる時間を端末で日ごとに数え、残り5分で知らせ、超えたら「今日はここまで」 =====
// 対象：サーバー版の生徒だけ（担任助手のme-・担任助手モード・お試しは除く）。上限はサーバーの設定 SV.dailyMin（0＝無制限）。担任助手の「今日だけ解除」は SV.unlocks
const dailyApplies = () => SV.on && SV.dailyMin > 0 && !DEMOQ && !sampleMode;
const dailyState = st => dailyStatus(SV.dailyMin, dailyUsed(st.uid), SV.unlocks && SV.unlocks.has(st.uid));
const dailyBlocked = st => !!st && !st.staff && dailyApplies() && !adminOn && dailyState(st).over;
let dailyLast = 0, dailyEl = null;
function dailyTick() {
  const now = performance.now(), dt = dailyLast ? Math.min(2, (now - dailyLast) / 1000) : 0; dailyLast = now;
  if (!T || !me || me.staff || !dailyApplies() || adminOn || document.visibilityState !== 'visible' || dailyEl) return;
  dailyAdd(me.uid, dt); const s = dailyState(me);
  if (s.warn && dailyWarn(me.uid)) toast('あと ' + Math.max(1, Math.ceil(s.leftSec / 60)) + '分で、今日の利用時間です', 'ok');
  if (s.over) dailyEndScreen(me);
}
// 「今日はここまで。続きは明日」：家にいることはできないが、ホームのお知らせ・ランキングは見られる。担任助手が解除すれば続けられる
function dailyEndScreen(st) {
  if (dailyEl) return;
  let poll = 0;
  const close = () => { clearInterval(poll); if (dailyEl) dailyEl.remove(); dailyEl = null; };
  const recheck = async () => { await pullApply(true); if (!dailyBlocked(st)) { close(); toast('利用時間の制限が解除されました', 'ok'); return true; } return false; };
  poll = setInterval(recheck, 60000);
  dailyEl = h('div', { id: 'dailyEnd', role: 'dialog', 'aria-label': '今日はここまで' }, [h('div', { cls: 'de-box' }, [
    h('div', { cls: 'de-ico', text: '🌙' }), h('h2', { text: '今日はここまで' }), h('p', { text: '続きは明日。今日の利用時間（' + SV.dailyMin + '分）を使い切りました' }),
    h('p', { cls: 'sub', text: 'ホームのお知らせとランキングは、いつでも見られます' }),
    h('div', { cls: 'de-acts' }, [h('button', { cls: 'btn coral big', text: 'ホームにもどる', onclick: () => { close(); if (T) leaveTeam(); } }), h('button', { cls: 'btn', text: '解除されたか確かめる', onclick: async () => { if (!await recheck()) toast('まだ解除されていません', 'ng'); } })])])]);
  document.body.appendChild(dailyEl);
}
function startHouse(t, st) {
  if (dailyBlocked(st)) { renderSelect(); dailyEndScreen(st); return; }   // 今日の分を使いきっている人は、家に入れない
  T = t; me = st; adminOn = false; if (S.cur.teamId !== t.id) S.cur = { teamId: t.id, room: 0, studentId: st.uid }; if (!st.staff) S.cur.studentId = st.uid; if (S.cur.room >= T.rooms.length) S.cur.room = 0;
  $('select').hidden = true; $('app').classList.add('in-house'); tab = 'shop'; meChipKey = '';
  dispPts = me.picos; shownPts = -1; if (SV.on) { if (!st.staff) setMyUid(st.uid); lastRoomsJson = JSON.stringify(t.rooms); avKey = ''; } afterLoad(); save();
  houseEntered(t, st);
  if (!st.staff && pendingGift()) setTimeout(() => giftDlg(pendingGift()), 900);   // QRプレゼントを読んでから入ったとき
  if (SV.on && !st.staff && !st.nick) setTimeout(nickFixDlg, 500);   // 担任助手が名前を差し戻したとき：付け直す
  if (!st.staff && unreadNotes(t)) toast('伝言板に担任助手からの新しい伝言があります', 'ok');
  if ((S.missions || []).some(canClaim)) setTimeout(() => toast('チーミ全員でミッション達成。「ミッション」から報酬を受け取れます', 'ok'), 600);
}
// ===== おかえり・お祝い・はじめての案内・みんなの最近（2026-11-11） =====
// 端末ごと・人ごとに「前回見た時点」(kojoHouse.seen.<uid>)と、チーミの家具の一覧(kojoHouse.tsnap.<tid>)を覚える。サーバーは使わない
const hasQ = k => new URLSearchParams(location.search).has(k);
let lastRankIdx = 0, recent = [], recentNew = false;
const cumOf = st => { const u = st.uid; return { sc: st.lastScore != null ? st.lastScore : (S.lastScore || {})[u], st: st.lastStay != null ? st.lastStay : (S.lastStay || {})[u] }; };
const nowSeen = st => Object.assign({ e: st.earned || 0, rk: rankIdx(st.earned || 0) }, cumOf(st));
function snapSeen() {
  if (!T || !me || me.staff || (noSave && !window.__seenTest)) return;
  writeSeen(me.uid, nowSeen(me)); writeTeamSnap(T);
}
const teamSnapKey = t => 'kojoHouse.tsnap.' + t.id;
const itemMap = t => { const m = {}; (t.rooms || []).forEach(r => (r.items || []).forEach(i => { m[i.uid] = [i.id, i.owner || '']; })); return m; };
function writeTeamSnap(t) { try { localStorage.setItem(teamSnapKey(t), JSON.stringify({ items: itemMap(t), bank: t.picos })); } catch (e) { } }
function readTeamSnap(t) { try { return JSON.parse(localStorage.getItem(teamSnapKey(t)) || 'null'); } catch (e) { return null; } }
const ownerNick = u => { const x = u && studentById(u); return x ? nickOf(x) : ''; };
const itemLabel = ([id, ow]) => { const d = ITEM[id]; return d ? (ow ? ownerNick(ow) + 'の' : '') + d.name : ''; };
function pushRecent(text, ico) { recent.unshift({ text, ico }); if (recent.length > 20) recent.pop(); recentNew = true; $('btnRecent').classList.add('new'); }
// 前回の一覧と今の一覧の差から「みんなの最近」を作る（だれの物が置かれた・片付けられた、貯金箱の増減）
function diffInto(prevItems, prevBank, t) {
  const cur = itemMap(t); let added = 0, removed = 0;
  Object.keys(cur).forEach(u => { if (!prevItems[u] && added < 8) { added++; const l = itemLabel(cur[u]); if (l) pushRecent(l + 'が置かれました', 'in'); } });
  Object.keys(prevItems).forEach(u => { if (!cur[u] && removed < 4) { removed++; const l = itemLabel(prevItems[u]); if (l) pushRecent(l + 'が片付けられました', 'out'); } });
  if (prevBank != null && t.picos > prevBank) pushRecent('貯金箱に ' + fmt(t.picos - prevBank) + ' ピコが寄付されました', 'bank');
  else if (prevBank != null && t.picos < prevBank) pushRecent('貯金箱から ' + fmt(prevBank - t.picos) + ' ピコを使いました', 'bank');
}
function noteDiff(oldT, newT) { if (!oldT || oldT.id !== newT.id) return; diffInto(itemMap(oldT), oldT.picos, newT); }
function recentDlg() {
  const list = h('div', { cls: 'rc-list' });
  if (!recent.length) list.appendChild(emptyBox('🏠', 'まだ新しい動きはありません', 'チーミのだれかが家具を置いたり寄付したりすると、ここに出ます'));
  recent.forEach(r => list.appendChild(h('div', { cls: 'rc-row' }, [h('span', { text: (r.ico === 'bank' ? '🪙 ' : r.ico === 'out' ? '📦 ' : '🛋️ ') + r.text })])));
  modal('みんなの最近', list, [h('button', { cls: 'btn', text: 'とじる', onclick: closeModal })]); recentNew = false; $('btnRecent').classList.remove('new');
}
// ランクアップ：新しく解放された家具を見せて紙ふぶき（モーダルや案内が出ている間は待つ）
function checkRankUp() {
  if (!T || !me || me.staff) return; const ri = curRank();
  if (ri <= lastRankIdx || !$('modal').hidden || coachOpen() || $('cele')) return;
  const from = lastRankIdx; lastRankIdx = ri;
  const its = ITEMS.filter(d => !d.free && d.rank > from && d.rank <= ri).slice(0, 8).map(d => { const im = new Image(); im.alt = ''; im.width = 52; im.height = 52; if (d.pat) im.src = makeIcon(d, 104); else itemIcon(d, im); return { name: d.name, img: im }; });
  sfx('rank'); celebrate('ランクアップ  ' + CFG.RANKS[ri].name, its.length ? '新しい家具が解放されました' : '', its);
}
function houseEntered(t, st) {
  recent = []; recentNew = false; $('btnRecent').classList.remove('new'); $('btnRecent').hidden = !!st.staff;
  const seen = st.staff ? null : readSeen(st.uid), now = nowSeen(st), ts = readTeamSnap(t);
  lastRankIdx = seen && seen.rk != null ? Math.min(seen.rk, now.rk) : now.rk;
  if (ts) diffInto(ts.items || {}, ts.bank, t);
  const demoOnly = TESTQ && TESTQ !== 'coach' && TESTQ !== 'welcome', persist = !noSave || !!window.__seenTest;
  const g = !st.staff && seen && !demoOnly ? gainBreakdown(seen, now, S.settings.rate, S.settings.stayRate || CFG.STAY_RATE) : null;
  const after = () => { snapSeen(); if (!st.staff && !coachSeen() && !demoOnly && !hasQ('nocoach')) setTimeout(() => { if (T && me === st && $('modal').hidden) startCoach(); }, 500); };
  if (g) { if (persist) writeSeen(st.uid, now); setTimeout(() => { if (T && me === st) welcomeBack(nickOf(st), g, { tick: () => sfx('tap'), done: () => sfx('coin'), onClose: after }); }, 500); }
  else { if (!st.staff && persist) writeSeen(st.uid, now); after(); }
}
function leaveTeam() {
  snapSeen(); exitMulti(); cancelGhost(); selUid = null; const tid = T && T.id; if (SV.on) { clearTimeout(ct); if (!pendEmpty() || JSON.stringify(T.rooms) !== lastRoomsJson) commitHouse(); } T = null; me = null; adminOn = false; rebuildAvatars(); S.cur.teamId = null; save();
  $('app').classList.remove('in-house'); $('bar').hidden = true; $('select').hidden = false; if (tid) showTeamMembers(tid); renderSelect();
}
// 担任助手モードを閉じたあと：名簿・チーミ・ピコの変化を画面に反映
function refreshAfterAdmin() {
  if (SV.on) { pullApply(true); return; }
  if (T) {
    const t = S.teams.find(x => x.id === T.id), st = me && (me.staff ? me : studentById(me.uid));
    if (!t || !t.confirmed || !st || (!st.staff && !t.members.includes(st.uid))) { T = null; leaveTeam(); return; }
    T = t; me = st; dispPts = me.picos; rebuildAvatars(); renderHud(); renderPanel();
  } else renderSelect();
}

// ===== サーバー連携（Supabase）=====
// 家の変更は、画面ではすぐ反映（楽観更新）して、RPC(house_commit)でまとめて保存する。競合したら最新を取り直す
const pend = { take: {}, give: {}, sell: [] };
const pendEmpty = () => !Object.keys(pend.take).length && !Object.keys(pend.give).length && !pend.sell.length;
let lastRoomsJson = '', committing = false, ct = 0, deferApply = false, avKey = '';
function showSchemaMissing() { SV.status = 'schema'; const el = $('err'); if (el) { el.hidden = false; el.textContent = 'サーバーの準備がまだです。担任助手に伝えてください（担任助手の人：supabase/schema.sql を実行してください）'; } }
function svFail(e) {
  console.error(e);
  if (e instanceof SvError && e.kind === 'schema') showSchemaMissing();
  else toast(e instanceof SvError && e.kind === 'offline' ? 'ネットにつながりません。少し待って、もう一度試してください' : 'うまくいきませんでした。もう一度試してください', 'ng');
}
async function svCall(name, args) { try { return await svRpc(name, args); } catch (e) { svFail(e); return null; } }
function commitSoon() { clearTimeout(ct); ct = setTimeout(commitHouse, 120); }
async function commitHouse() {
  if (!SV.on || !T || !me || me.watch) return;
  if (committing) { commitSoon(); return; }
  if (ghost && ghost.from === 'move') return;   // 動かし中は、置き終わってから
  const rj = JSON.stringify(T.rooms); if (rj === lastRoomsJson && pendEmpty()) return;
  const tm = T, mm = me; committing = true; const take = pend.take, give = pend.give, sell = pend.sell; pend.take = {}; pend.give = {}; pend.sell = [];
  const needPin = Object.keys(give).length > 0 || sell.length > 0;
  const r = await svCall('house_commit', { p_uid: me.uid, p_pin: needPin ? pinCache.pin : null, p_admin: adminOn ? SV.adminPass : null, p_team: T.id, p_version: T.version, p_rooms: T.rooms, p_take: take, p_give: give, p_sell: sell });
  committing = false;
  if (r && r.ok) { tm.version = r.version; if (T === tm) lastRoomsJson = rj; mm.inv = r.inv || {}; mm.picos = r.picos | 0; if (T === tm) renderPanel(); }
  else { if (r) { if (r.err === 'pin' || r.err === 'locked') dropPin(); toast(errText(r.err), 'ng'); sfx('ng'); } await pullApply(true); }   // 失敗したら最新の状態にもどす
  if (deferApply) { deferApply = false; pullApply(); }
}
async function pullApply(force) {
  if (!SV.on) return;
  if (!force && (committing || ghost || !pendEmpty())) { deferApply = true; return; }
  let d; try { d = await svPull(); } catch (e) { svFail(e); return; }
  applyServer(d);
}
function applyServer(d) {
  S.students = d.students; S.teams = d.teams; S.settings.priceMul = d.priceMul;
  S.staffMes = d.staffMes || []; S.missions = d.missions || []; S.notices = d.notices || []; S.startDate = d.startDate || '';
  S.teams.forEach(t => { t.notes = (d.notes || []).filter(n => n.teamId === t.id).sort((a, b) => a.at - b.at || a.id - b.id); });
  if (me && me.staff && me.staffId) { const p = S.staffMes.find(x => x.id === me.staffId); if (p) { me.nick = p.nick; me.me = p.me; } }   // 担任助手のme-の変更を反映
  paintNotesBtn(); paintMissionBtn();
  if (T) {
    const t = S.teams.find(x => x.id === T.id), st = me && (me.staff ? me : studentById(me.uid));
    if (!t || !t.confirmed || !st) { T = null; leaveTeam(); return; }
    const rj = JSON.stringify(t.rooms), changed = rj !== lastRoomsJson || JSON.stringify(t.open || []) !== JSON.stringify(T.open || []), k = t.members.join(',') + '|' + t.members.map(u => { const x = studentById(u); return x ? nickOf(x) + JSON.stringify(x.me || '') : ''; }).join('|') + (me && me.staff ? '|staff:' + me.nick + JSON.stringify(me.me || '') : '');
    if (changed || t.picos !== T.picos) noteDiff(T, t);
    T = t; me = st; lastRoomsJson = rj; if (S.cur.room >= T.rooms.length) S.cur.room = 0;
    if (k !== avKey) { avKey = k; rebuildAvatars(); }
    if (changed) { rebuildRoom(); renderBar(); fixAvatar(); }
    renderRooms(); renderHud(); renderPanel();
  } else if (!$('select').hidden) renderSelect();
}
// 他の人の me- を押したとき：その人の番号を確かめる／番号がリセットされた人は決め直す。成功したら入力した番号を返す
async function verifyOrSetPin(st) {
  const face = faceImg(st.me, 'face', 'face'), who = nickOf(st);
  if (!st.pin) {
    const np = await pinSet({ face, who }); if (!np) return null;
    const r = await svCall('set_pin', { p_uid: st.uid, p_new_pin: np }); if (!r || !r.ok) { if (r) toast(errText(r.err), 'ng'); return null; }
    st.pin = 'srv'; return np;
  }
  for (let k = 0; k < 3; k++) {
    const v = await pinPad('4けたの番号を入力', k ? '違います。もう一度' : 'ピコが動くので確認します', { face, who }); if (v == null) return null;
    const r = await svCall('check_pin', { p_uid: st.uid, p_pin: v }); if (!r) return null;
    if (r.ok) return v;
    sfx('ng'); toast(errText(r.err), 'ng'); if (r.err === 'locked') return null;
  }
  return null;
}
async function enterServer(t, st) {
  if (st.uid !== getMyUid() || !st.pin) {   // 自分の端末の me- でなければ、番号を確かめてから（なりすまし防止）
    const v = await verifyOrSetPin(st); if (v === null) return;
    pinCache = { uid: st.uid, pin: v, until: Date.now() + 300000 }; setMyUid(st.uid);
  }
  startHouse(t, st);
}
// 「＋ me-を作る」：ニックネーム→見た目→番号。サーバーには未承認の生徒として作られ、すぐ家に入れる
// teamId なし（ホームの「はじめての人」）：me-を先に作り、番号のあとで「チーミをえらぶ」。メンバー画面からはチーミが決まっているので飛ばす
// 名前えらび：チーミがきまったら、名簿の「まだ me- を作っていない人」の名前から自分を選ぶ。選ぶと担任助手の確認なしで承認済み（得点が入る）。
//   返り値：枠のキー／''（名前がない・名簿なし・サーバーが古い＝従来どおり承認まち）／null（もどる）／false（サーバーのエラー）
function pickSlot(tid, m, nick) {
  return new Promise(async res => {
    const t = S.teams.find(x => x.id === tid);
    let r; try { r = await svRpc('team_slots', { p_team: tid, p_pass: getTeamCode(tid) || null }); } catch (e) { if (isSchemaErr(e)) { res(''); return; } svFail(e); res(false); return; }
    if (!r.ok) { toast(errText(r.err), 'ng'); res(false); return; }
    const slots = Array.isArray(r.slots) ? r.slots : [];
    if (!slots.length) { res(''); return; }
    const show = () => {
      const body = h('div', { cls: 'tp' });
      body.appendChild(h('div', { cls: 'tp-who' }, [faceImg(m, 'face', 'face'), h('span', { cls: 'tp-q' }, [h('b', { text: nick }), h('span', { text: 'さんは、だれ？' })])]));
      body.appendChild(h('p', { cls: 'hint', text: (t ? t.name + 'の' : '') + '名簿から、自分の名前をえらんでね。えらぶと、担任助手の確認なしですぐ得点が入ります。' }));
      const list = h('div', { cls: 'picklist tp-list' }); body.appendChild(list);
      slots.forEach(x => list.appendChild(h('button', { cls: 'btn pickbtn', onclick: async () => {
        closeModal();
        if (!await confirmDlg('「' + x.n + '」さん、で まちがいない？\n（まちがえると、ほかの人のピコが入ってしまいます）', 'これです', '名前の確認')) { show(); return; }
        res(x.k);
      } }, [h('span', { cls: 'a', text: x.n })])));
      modal('自分の名前をえらぼう', body, [h('button', { cls: 'btn', text: 'もどる', onclick: () => { closeModal(); res(null); } }), h('button', { cls: 'btn', text: '名前がない', onclick: () => { closeModal(); res(''); } })]);
    };
    show();
  });
}

// ===== QRプレゼント（非売品アイテム）：?gift=コード を読んだら、この端末が覚えておき、自分の me- でお家に入ったときに受け取る =====
// コードは URL からすぐ消す（はじめてカードと同じ）。受け取りは本人の4けたの番号で確かめる
const GIFT_KEY = 'kojoHouse.gift';
const normGift = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
const pendingGift = () => { try { return normGift(localStorage.getItem(GIFT_KEY)); } catch (e) { return ''; } };
const setPendingGift = c => { try { if (c) localStorage.setItem(GIFT_KEY, c); else localStorage.removeItem(GIFT_KEY); } catch (e) { } };
const takeUrlGift = () => {
  try {
    const u = new URL(location.href), c = normGift(u.searchParams.get('gift') || '');
    if (u.searchParams.has('gift')) { u.searchParams.delete('gift'); history.replaceState(null, '', u.pathname + u.search + u.hash); }
    return c;
  } catch (e) { return ''; }
};
async function giftPeek(code) {
  if (SV.on) return await svCall('gift_peek', { p_code: code });
  const g = (S.gifts || []).find(x => x.code === code); if (!g) return { ok: false, err: 'gift' };
  if (!g.active || (g.expires && g.expires < todayStr())) return { ok: false, err: 'giftend' };
  if (g.kind === 'once' && g.uses > 0) return { ok: false, err: 'giftused' };
  return { ok: true, item: g.item || '', picos: g.picos | 0, kind: g.kind, note: g.note };
}
async function giftRedeem(code, pin) {
  if (SV.on) return await svCall('gift_redeem', { p_uid: me.uid, p_pin: pin, p_code: code });
  const g = (S.gifts || []).find(x => x.code === code), p = await giftPeek(code); if (!p.ok) return p;
  if ((g.claims || []).includes(me.uid)) return { ok: false, err: 'claimed' };
  g.claims = (g.claims || []).concat(me.uid); g.uses = (g.uses || 0) + 1;
  if (g.item) me.inv[g.item] = (me.inv[g.item] || 0) + 1;
  if (g.picos > 0) { me.picos = (me.picos || 0) + g.picos; if (g.earned !== false) me.earned = (me.earned || 0) + g.picos; }
  save(); return { ok: true, item: g.item || '', picos: g.picos | 0 };
}
// 受け取り画面：何がもらえるかを見せてから、番号で受け取る
async function giftDlg(code) {
  code = normGift(code); if (!code || !T || !me) return;
  if (me.staff) { toast('担任助手の me- では受け取れません（生徒の me- で入ってね）', 'ng'); return; }
  const p = await giftPeek(code);
  if (!p || !p.ok) { if (p) { toast(errText(p.err), 'ng'); if (p.err !== 'pin') setPendingGift(''); } return; }
  const pc = p.picos | 0, d = pc > 0 ? { name: fmt(pc) + ' ピコ', pico: true } : ITEM[p.item]; if (!d) { setPendingGift(''); return; }
  let im; if (d.pico) im = h('div', { cls: 'gift-coin', 'aria-hidden': 'true', text: '🪙' }); else { im = h('img', { cls: 'gift-ico', alt: '', width: '120', height: '120' }); itemIcon(d, im); }
  const body = h('div', { cls: 'gift-dlg' + (d.pico ? ' pico' : '') }, [
    h('div', { cls: 'gift-burst', 'aria-hidden': 'true' }), im,
    h('div', { cls: 'gift-tag' + (d.hazure ? ' hz' : '') + (d.pico ? ' pc' : ''), text: d.hazure ? 'はずれ…' : d.pico ? 'ピコ' : '非売品' }), h('b', { cls: 'gift-name', text: d.name }), d.hazure ? h('div', { cls: 'gift-note', text: 'ざんねん！ はずれでした。でも記念に飾れます' }) : null,
    p.note ? h('div', { cls: 'gift-note', text: p.note }) : null,
    h('p', { cls: 'hint', text: nickOf(me) + (d.pico ? ' さんのピコに入ります。' : ' さんの持ち物に入ります。') + '4けたの番号で確かめます。' })
  ]);
  modal('🎁 プレゼントが届いています', body, [
    h('button', { cls: 'btn', text: 'あとで', onclick: closeModal }),
    h('button', { cls: 'btn coral', text: '受け取る', onclick: async () => {
      closeModal(); const pin = await getPin(); if (pin === null) return;
      const r = await giftRedeem(code, pin);
      if (!r || !r.ok) { if (r) { if (r.err === 'pin' || r.err === 'locked') dropPin(); else setPendingGift(''); toast(errText(r.err), 'ng'); sfx('ng'); } return; }
      setPendingGift(''); if (SV.on) await pullApply(true);
      if (d.pico) { sfx('buy'); lastPicosT = me.picos; floatText('+' + fmt(pc) + ' ピコ', 'p'); picoCelebrate(pc); renderPanel(); return; }
      sfx(d.hazure ? 'ng' : 'buy'); toast(d.name + (d.hazure ? 'を受け取りました…（はずれ）。「持ち物」から置けます' : 'を受け取りました！「持ち物」から置けます'), 'ok'); tab = 'inv'; renderPanel();
    } })
  ], 'gift');
}
// ピコが当たったとき：大きく「+○ピコ」を出す（数秒で消える）
function picoCelebrate(n) {
  const el = h('div', { cls: 'pico-win', role: 'status' }, [h('div', { cls: 'pw-coin', 'aria-hidden': 'true', text: '🪙' }), h('b', { text: '+' + fmt(n) + ' ピコ' }), h('span', { text: 'ピコが当たった！' })]);
  document.body.appendChild(el); el.addEventListener('click', () => el.remove()); setTimeout(() => el.remove(), 2600);
  toast(fmt(n) + ' ピコを受け取りました！', 'ok');
}
// 設定の「プレゼントコード」：QRが読めないときにコードを手で入れる
function giftCodeDlg() {
  const inp = h('input', { type: 'text', maxlength: '12', placeholder: '例：AB23CD45', autocomplete: 'off', cls: 'pass gift-inp', 'aria-label': 'プレゼントコード' });
  const go = () => { const c = normGift(inp.value); if (c.length < 6) { toast('コードを入れてください', 'ng'); return; } closeModal(); giftDlg(c); };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  modal('プレゼントコード', h('div', {}, [h('p', { cls: 'hint', text: 'QRプレゼントの紙・画面にある8文字のコードを入れてください。' }), inp]), [h('button', { cls: 'btn', text: 'やめる', onclick: closeModal }), h('button', { cls: 'btn coral', text: 'つぎへ', onclick: go })]);
  setTimeout(() => inp.focus(), 50);
}
const bootGift = TESTQ ? '' : takeUrlGift(); if (bootGift) setPendingGift(bootGift);
function createMe(teamId, me0, nick0) {
  if (teamId && !S.teams.find(x => x.id === teamId && x.confirmed)) return;
  const nSteps = teamId ? 3 : 4;
  openMeMaker({ me: me0, nick: nick0, nextLabel: 'つぎへ（番号をきめる）', cancelLabel: 'もどる', stepTeam: !teamId, onCancel: () => renderSelect(), onDone: async (m, nick) => {
    const np = await pinSet({ face: faceImg(m, 'face', 'face'), who: nick, step: '3/' + nSteps });
    if (!np) { createMe(teamId, m, nick); return; }
    let tid = teamId, slot;
    for (;;) {
      if (!tid) { tid = await chooseTeam(m, nick); if (!tid) { createMe(null, m, nick); return; } }   // もどる：me-はそのままで作成画面へ
      if (slot === undefined) {   // 自分の名前をえらぶ（名簿の枠。承認済みで始まる）
        slot = await pickSlot(tid, m, nick);
        if (slot === null || slot === false) { slot = undefined; if (!teamId) { tid = null; continue; } createMe(teamId, m, nick); return; }   // もどる／エラー
      }
      const args = { p_team: tid, p_nick: nick, p_me: m, p_pin: np }; if (slot) args.p_slot = slot;
      const r = await svCall('create_me', args);
      if (r && r.ok) { await finishCreate(r, tid, np); return; }
      if (r) toast(errText(r.err), 'ng');
      if (r && (r.err === 'slot' || r.err === 'slotused')) { slot = undefined; continue; }   // 先に ほかの人が選んでいた：名前えらびをやりなおす
      slot = undefined;
      if (!teamId) { tid = null; continue; }   // チーミ選択にもどる（満員など）
      createMe(teamId, m, nick); return;
    }
  } });
}
// できあがり：「完了！あなたの me- は〇〇チーミの家にいます」を見せてから、そのまま家へ
async function finishCreate(r, teamId, np) {
  const tid = r.team || teamId; setMyUid(r.uid); showTeamMembers(tid); await pullApply(true);
  const st = studentById(r.uid), t = S.teams.find(x => x.id === tid);
  pinCache = { uid: r.uid, pin: np, until: Date.now() + 300000 };
  if (!(st && t)) { renderSelect(); return; }
  $('select').hidden = true;   // （選択画面が見えたままにならないように）
  const body = h('div', { cls: 'done-me' }, [faceImg(st.me, 'face', 'face'), h('div', { cls: 'dm-t' }, [h('b', { text: nickOf(st) + 'さん、me- ができました' }), h('span', {}, ['あなたの me- は ', h('span', { cls: 'dm-team', text: t.name + 'チーミ' }), ' の家にいます'])])]);
  const notes = r.slot
    ? ['担任助手の確認は不要です。もうピコ（得点）が入ります', '番号（4けた）を忘れたら、担任助手に言うとリセットしてもらえます']
    : ['今は「承認まち」。確認されるまで、ピコ（得点）は入りません', '家を見る・歩く・家具を動かすことはできます', '番号（4けた）を忘れたら、担任助手に言うとリセットしてもらえます'];
  const ul = h('ul', { cls: 'dm-list' }); notes.forEach(x => ul.appendChild(h('li', { text: x }))); body.appendChild(ul);
  modal('完了', body, [h('button', { cls: 'btn coral big', text: '家に入る', onclick: () => { closeModal(); startHouse(t, st); } })], 'sticky');
}
const isSchemaErr = e => e instanceof SvError && e.kind === 'schema';
const mineStu = () => { const u = getMyUid(), r = u ? (SV.rows.find(x => x.uid === u) || studentById(u)) : null; return r && r.retired ? null : r; };   // 休止の人は、この端末でも「自分」にしない
// 担任助手モード：名簿(本名)はこの端末の localStorage にだけ。サーバーの値を重ねて見せる
async function buildAdm() {
  const d = await svPull(), a = admLoad(); let linked = 0;
  try { linked = (await slotsSync(a)).linked; } catch (e) { svFail(e); }   // 選ばれた名前の枠の持ち主を、名簿の人に自動でひもづける
  mergeAdmin(a, d.students, d.teams, d.priceMul); a.scoreLog = [];
  try {
    const lg = await adminRpc('admin_logs', {});
    if (lg.ok) { const k = new Map(a.students.filter(x => x.link).map(x => [x.link, x.uid])); a.scoreLog = lg.logs.map(l => ({ id: l.id, at: l.at, kind: l.kind, mode: l.mode, undone: l.undone, by: l.by || '', undoneBy: l.undone_by || '', note: l.note || '', applied: (l.applied || []).map(x => ({ studentId: x.uid ? k.get(x.uid) || null : null, uid: x.uid, team: x.team, picos: x.picos })) })); }
  } catch (e) { svFail(e); }
  SV.adm = a;
  if (linked) toast('名前えらびで ' + linked + '人が自動でひもづきました', 'ok');
  if (SV.vaultNeed || linked) vaultSoon();
}
// チーミのあいことば（サーバー版）：サーバーで確かめる。通ったらこの端末がチーミごとに覚える（あいことばが変わったら聞き直す）
const TCKEY = 'kojoHouse.teamcode.';
const getTeamCode = id => { try { return localStorage.getItem(TCKEY + id) || ''; } catch (e) { return ''; } };
const setTeamCode = (id, v) => { try { if (v) localStorage.setItem(TCKEY + id, v); else localStorage.removeItem(TCKEY + id); } catch (e) { } };
async function teamAuth(t) {
  if (!t.hasCode) return true;   // あいことば未設定のチーミは、そのまま入れる
  const mem = getTeamCode(t.id);
  if (mem) {
    const r = await svCall('check_team_pass', { p_team: t.id, p_pass: mem });
    if (r && r.ok) return true;
    if (!r) return false;
    if (r.err === 'locked') { toast(errText('locked'), 'ng'); return false; }
    setTeamCode(t.id, '');
  }
  for (let k = 0; k < 3; k++) {
    const v = await pinPad(t.name + 'のあいことば', k ? '違います。もう一度' : 'チーミのメンバーだけが知っている4けたの数字');
    if (v == null) return false;
    const r = await svCall('check_team_pass', { p_team: t.id, p_pass: v }); if (!r) return false;
    if (r.ok) { setTeamCode(t.id, v); return true; }
    sfx('ng'); if (r.err === 'locked') { toast(errText('locked'), 'ng'); return false; }
  }
  toast('あいことばが違います。担任助手に聞いてください', 'ng'); return false;
}
async function svStart() {
  let r;
  try { r = await svInit(); } catch (e) {
    if (e instanceof SvError && e.kind === 'schema') { showSchemaMissing(); S = store.defaultState(); renderSelect(); return; }
    svFail(e); renderSelect(); return;
  }
  if (r !== 'ok') { if (r === 'offline') toast('サーバーにつながらないため、この端末だけで動いています', 'ng'); renderSelect(); return; }
  S = store.defaultState(); noSave = true; screenCtx.loadDemo = null; screenCtx.houseThumb = houseThumb; screenCtx.teamAuth = teamAuth;
  applyServer({ students: SV.rows, teams: SV.teamRows, priceMul: SV.priceMul });
  const my = getMyUid(), mine = my && SV.rows.find(x => x.uid === my);
  if (mine && mine.teamId) showTeamMembers(mine.teamId);   // 自分の端末なら、自分のチーミのメンバー一覧から
  if (!S.teams.some(t => t.confirmed) && MODE !== 'staff' && !new URLSearchParams(location.search).has('admin')) { sampleHouse(); return; }
  renderSelect();
  svSubscribe(() => pullApply());
  if (MODE !== 'student' && (MODE === 'staff' || new URLSearchParams(location.search).has('admin'))) { MODE === 'staff' && !new URLSearchParams(location.search).has('admin') ? openDesk() : gateAdmin(); }
}
// お試しの家「勝又チーミ」：確定したチーミがまだ無いとき・?demo=katsumata・担任助手の「生徒が見る画面」で使う。
// 生徒が入ったときと同じ経路（enterAs → startHouse）で本物の家画面を出す。サーバーには何も送らず、保存もしない（ピコの動く操作もこの端末の中だけ）
let sampleMode = false;
function sampleHouse() {
  sampleMode = true; demoMode = true; SV.on = false; noSave = true; makeDemo({ katsumata: true }); screenCtx.canCreate = () => false;
  enterAs(S.teams[0].id, S.teams[0].members[0]);
  document.body.classList.add('sample');
  toast('お試しの家（勝又チーミ）です。保存されません', 'ok');
}
// 見本の家から担任助手モードへ行くときは、本物のサーバーにつなぎ直してから開く
// 担任助手の入口（パスワードなし：家を見る・向上得点）。名簿やチーミ編集は中の「管理者モード」から（パスワード）
function openDesk() { if (MODE === 'student') return; if (sampleMode) { gateAdmin(); return; } openStaffDesk({ teams: () => S.teams.filter(t => t.confirmed), watch: watchTeam, openAdmin: gateAdmin }); }
function gateAdmin() { if (MODE === 'student') return; if (sampleMode) { location.href = location.pathname + '?admin=1'; return; } openAdminGate(); }

let lastT = performance.now(), camAnim = false, lastR = 0, shownPts = -1;
function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (t - lastT) / 1000); lastT = t;
  if (!T) return;
  if (!me) return;
  if (Math.abs(me.picos - dispPts) > .5) { dispPts += (me.picos - dispPts) * Math.min(1, dt * 8); if (Math.abs(me.picos - dispPts) < 1) dispPts = me.picos; } else dispPts = me.picos;
  if (me.uid !== lastPicosUid) { lastPicosUid = me.uid; lastPicosT = me.picos; }
  else if (me.picos !== lastPicosT) { const dlt = me.picos - lastPicosT; lastPicosT = me.picos; if (dlt > 0) { floatText('+' + fmt(dlt) + ' ピコ', 'p'); sfx('coin'); const bx = $('ptsBox'); bx.classList.remove('gain'); void bx.offsetWidth; bx.classList.add('gain'); } }
  const sp = Math.round(dispPts); if (sp !== shownPts) { shownPts = sp; $('pts').textContent = fmt(sp); }
  if (AVS.length) { AVS.forEach(a => { updateAvatar(a, dt); updateAvatarObj(a, dt); }); cam.dirty = true; }
  if (needSync) sync();
  const cont = anims.length > 0 || lightList.some(l => l.flicker) || (hiArrow && !ghost);
  if (!(cam.dirty || camAnim || (cont && t - lastR > 30))) return;
  lastR = t; cam.dirty = false;
  stepPops(dt); camAnim = updateCamera(dt, false); scaleLabels();
  const ts = t / 1000;
  anims.forEach(g => g.userData.anim(ts)); flickerLights(ts, lightList);
  if (hiArrow) hiArrow.position.y = hiBase + Math.sin(ts * 5) * .07;
  renderFrame();
}

// ===== 起動 =====
// オープニング：サイトに入ったら最初に出す → 「はじめる」でチーミ選択へ
// 背景は開いた時刻で変える：午前5時〜午後3時前＝昼の空（.day）、午後3時〜午前5時前＝夕方・夜（いままでの絵）。?op=day / ?op=night で確認できる
const isDayTime = (d) => { const f = new URLSearchParams(location.search).get('op'); if (f === 'day') return true; if (f === 'night') return false; const hr = (d || new Date()).getHours(); return hr >= 5 && hr < 15; };
function showOpening() {
  const op = $('opening'), box = $('opMes'); op.hidden = false; op.classList.remove('out'); box.innerHTML = '';
  op.classList.toggle('day', isDayTime());
  for (let i = 0; i < 4; i++) box.appendChild(faceImg(Object.assign(randomMe(), { top: [0, 1, 4, 6][i], hat: [0, 2, 6, 1][i] }), 'full', ''));
  const go = () => { sfx('tap'); op.classList.add('out'); setTimeout(() => { op.hidden = true; }, 460); };
  $('opStart').onclick = go;
}
// 開いたままのタブの更新：画面が前面に戻ったとき＋10分ごとに version.txt を no-store で見る。違えば小さな帯を出す（押すと再読み込み）。
// テスト・?demo・file:// ・?v= の無い読み込みでは動かさない
export function startUpdateWatch() {
  let mine = ''; try { mine = new URL(import.meta.url).searchParams.get('v') || ''; } catch (e) { }
  if (!mine || (TESTQ && !window.__updWatchTest) || DEMOQ || location.protocol === 'file:' || window.__noUpdateWatch) return;
  let busy = false;
  const check = async () => {
    if (busy || $('updBar')) return; busy = true;
    try {
      let v; if (window.__fetchVersion) v = String(await window.__fetchVersion()).trim(); else { const r = await fetch('version.txt?t=' + Date.now(), { cache: 'no-store' }); if (!r.ok) return; v = (await r.text()).trim(); }
      if (/^\d{8,14}$/.test(v) && v !== mine) document.body.appendChild(h('div', { id: 'updBar', role: 'status' }, [h('span', { text: '新しい版があります' }), h('button', { cls: 'btn sm coral', text: '更新する', onclick: () => location.reload() })]));
    } catch (e) { /* つながらないときは何もしない */ } finally { busy = false; }
  };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  setInterval(check, 10 * 60 * 1000);
  return check;   // （確認用）
}
function boot() {
  startUpdateWatch();
  if (TESTQ && TESTQ !== 'info') setInfoSeen(true);   // 確認用テストは、お知らせの画面をとばす
  screenCtx.staffOk = () => MODE !== 'student'; screenCtx.getS = () => S; screenCtx.enter = enterAs; screenCtx.meId = () => me && me.uid; screenCtx.myTeam = () => T && T.id; screenCtx.openAdmin = () => { if (SV.status === 'schema') { showSchemaMissing(); return; } openDesk(); }; screenCtx.myUid = () => getMyUid(); screenCtx.canCreate = () => SV.on; screenCtx.createMe = id => createMe(id || null); screenCtx.houseThumb = houseThumb; screenCtx.loadDemo = () => { makeDemo(); saveNow(); renderSelect(); toast('お試しデータを入れました', 'ok'); };
  actx.getS = () => S; actx.save = save; actx.onUnlock = async () => { adminOn = true; if (SV.on) { try { const vr = await vaultRestore(); if (vr === 'restored') toast('バックアップから名簿を開きました', 'ok'); else if (vr === 'fail') toast('バックアップを開けませんでした（別のパスワードで作られたかも）。上書きはしません', 'ng'); await buildAdm(); } catch (e) { svFail(e); } } renderHud(); }; actx.refresh = refreshAfterAdmin; actx.visit = id => { if (T) leaveTeam(); visitTeam(id); }; actx.reload = async () => { try { await buildAdm(); } catch (e) { svFail(e); } };
  actx.adminCheck = async p => { if (!SV.on) return p === S.settings.passcode; try { const r = await svRpc('admin_check', { p_admin: p }); if (r.ok) { SV.adminPass = p; return true; } return false; } catch (e) { svFail(e); return false; } };
  actx.setS = ns => { S = ns; uidN = Math.max(uidN, S.uid || 1); T = null; $('app').classList.remove('in-house'); $('select').hidden = false; };
  initScene(cv, $('stage')); setQuality(quality);
  $('btnSet').onclick = settingsDlg; $('camReset').onclick = () => { setCamMode('iso'); paintCam(); }; $('btnBack').onclick = leaveTeam; $('btnRank').onclick = () => openRanking(); $('bankBox').onclick = donateDlg; $('meChip').onclick = () => { if (!ghost) profileDlg(); };
  const viewPop = on => { $('viewPop').hidden = !on; $('btnView').setAttribute('aria-expanded', on ? 'true' : 'false'); $('btnView').classList.toggle('on', on); };
  $('btnView').onclick = () => viewPop($('viewPop').hidden);
  document.querySelectorAll('#camModes .btn').forEach(b => { b.onclick = () => { setCamMode(b.dataset.m); paintCam(); holdAvatars(); sfx('tap'); viewPop(false); }; });
  const camR = $('camReset').onclick; $('camReset').onclick = () => { camR(); holdAvatars(); viewPop(false); };
  document.addEventListener('pointerdown', e => { if (!$('viewPop').hidden && !e.target.closest('#viewWrap')) viewPop(false); }, true);
  $('btnLight').onclick = toggleLight; $('btnMulti').onclick = () => multi ? exitMulti() : enterMulti();
  $('btnRecent').onclick = recentDlg; window.addEventListener('pagehide', snapSeen); setInterval(snapSeen, 15000);
  $('btnPend').onclick = pendDlg; $('btnMission').onclick = missionDlg; $('btnNotes').onclick = notesDlg; $('btnTeams').onclick = teamJumpDlg;
  actx.editStaff = (p, after) => editStaffMe(p, after); actx.staffList = staffList; actx.itemIcon = itemIcon; actx.houseHi = houseHi;
  $('modal').addEventListener('pointerdown', e => { if (e.target === $('modal') && !$('dlg').classList.contains('sticky')) closeModal(); });
  $('panelToggle').onclick = () => { const p = $('panel'); p.classList.toggle('hide'); $('panelToggle').textContent = p.classList.contains('hide') ? '◀' : '▶'; setTimeout(resize, 0); };
  new ResizeObserver(resize).observe($('stage')); window.addEventListener('resize', resize);
  if (DEMOQ === 'katsumata') sampleHouse();
  else if (!TESTQ && !new URLSearchParams(location.search).has('local')) { renderLoading(); svStart(); } else renderSelect();
  requestAnimationFrame(frame);
  if ((!TESTQ && !DEMOQ) || TESTQ === 'opening') showOpening();
  window.addEventListener('pagehide', saveNow);
  setInterval(renderHud, 500); setInterval(dailyTick, 1000);
  window.__kojo = { get S() { return S; }, get T() { return T; }, get me() { return me; }, pinHash, enterAs, requirePin, donateDlg, editMe, makeFlow, startHouse, meThumb, buy, startPlace, moveGhost, confirmGhost, tap, setSel, cam, project, leaveTeam, setCamMode, toggleLight, enterMulti, exitMulti, get AVS() { return AVS; }, get multi() { return multi; }, get tab() { return tab; }, set tab(v) { tab = v; renderPanel(); } };
  if (TESTQ) { new MutationObserver(() => console.log('TESTOUT ' + document.body.dataset.test)).observe(document.body, { attributes: true, attributeFilter: ['data-test'] }); setTimeout(() => runTest(TESTQ), 400); }
}

// ===== テスト用のサンプル（?test=...）。保存はしない =====
const DEMO_NAMES = '山田 太郎,佐藤 花子,鈴木 一郎,高橋 美咲,田中 蓮,伊藤 結衣,渡辺 大和,中村 あかり,小林 陸,加藤 さくら,吉田 悠真,山本 凛,佐々木 颯太,松本 芽依,井上 翔,木村 ひなた,林 湊,斎藤 美羽,清水 蒼,森田 心春'.split(',');
const DEMO_NICKS = 'ひなた,そら,みお,はると,ゆず,れん,もも,かいと,あおい,りく,こはる,だいち,なな,しおん,ここな,ゆうま,みなと,あん,たいが,さくら'.split(',');
function makeDemo(opt) {
  opt = opt || {};
  S = store.defaultState(); uidN = 1; T = null; me = null;
  S.students = DEMO_NAMES.map((n, i) => {
    const s = store.newStudent(String(101 + i), n);
    if (i < 18) { s.nick = DEMO_NICKS[i]; s.me = seededMe(s.uid); s.pin = pinHash('1234', s.uid); }   // 最後の2人は me-未作成・ニックネームなし
    return s;
  });
  const U = i => S.students[i].uid;
  const groups = [['ひまわり', 0, 6], ['あおぞら', 6, 11], ['もりのくま', 11, 16], ['ほしぞら', 16, opt.partial ? 18 : 20]];
  groups.forEach(([nm, a, b]) => { const t = store.newTeam(store.nextTeamId(S), nm); t.members = S.students.slice(a, b).map(s => s.uid); if (!opt.unconfirmed || nm === 'ひまわり') store.confirmTeamHouse(t); S.teams.push(t); });
  if (!opt.noScore) {
    const rows = S.students.map((s, i) => ({ studentId: s.uid, value: Math.round((((i * 37) % 9) + 1 + (i % 3) * .1) * 10) / 10 }));
    planScores(rows, {}, 'cum', S.settings.rate).forEach(p => { const st = studentById(p.studentId); st.picos += p.picos; st.earned += p.picos; S.lastScore[p.studentId] = p.newLast; });
    S.students.forEach(s => { s.picos = Math.round(s.picos * .6); });   // 少し使った状態
    S.teams.forEach((t, k) => { if (t.confirmed) t.picos = 18000 + k * 9000; });
  }
  const t0 = S.teams[0], r0 = t0.rooms[0];
  sq(r0, t0.size0 || CFG.MIN_SIZE);
  r0.items = [inst('rug1', 2, 2, 0), inst('bed1', 0, 0, 1), inst('desk', 3, 0, 0), inst('chair', 3, 1, 0), inst('shelf1', 0, 5, 0), inst('plantL', 6, 5, 0), inst('laptop', 3, 0, 0), inst('lamp', 4, 0, 0), inst('sofa1', 2, 5, 0), inst('lowtable', 2, 4, 0), inst('cactus', 0, 5, 0), inst('mug', 2, 4, 0), winst('window', 'L', 2, 1.2), winst('wclock', 'R', 0.5, 2.3), winst('poster', 'R', 4, 1.6)];
  r0.items.forEach((it, k) => { if (k % 5 !== 4) it.owner = t0.members[k % t0.members.length]; });
  t0.members.forEach((u, k) => { studentById(u).inv = k === 0 ? { vase: 1, sofa1: 1 } : {}; });
  if (opt.katsumata) {
    // 勝又チーミ：生徒が入ったときと同じ家。メンバーはニックネームだけ（本名なし）。ピコは買い物を試せる分だけ持たせる
    t0.name = '勝又'; t0.members = t0.members.slice(0, 6);
    S.students = t0.members.map(studentById); S.teams = [t0]; S.students.forEach(st => { st.name = st.nick; st.picos = 38000; });
    r0.wall = 'wp_sagewain'; r0.floor = 'fl_whitewash'; t0.own = { wallpaper: ['wp_cream', 'wp_sagewain'], floor: ['fl_wood', 'fl_whitewash'] };
    r0.items = [inst('rug2', 2, 2, 0), inst('bed1', 0, 0, 1), inst('desk', 3, 0, 0), inst('chair', 3, 1, 0), inst('laptop', 3, 0, 0), inst('lamp', 4, 0, 0), inst('shelf1', 0, 5, 0), inst('bookpile', 1, 5, 0), inst('plantL', 6, 5, 0), inst('floorlamp', 6, 0, 0), inst('sofa1', 2, 5, 0), inst('lowtable', 2, 4, 0), inst('mug', 2, 4, 0), inst('cactus', 0, 6, 0), inst('trophy', 4, 5, 0), winst('window', 'L', 2, 1.2), winst('wclock', 'R', 0.5, 2.3), winst('poster', 'R', 4, 1.6), winst('calendar', 'R', 6, 1.6)];
    r0.items.forEach((it, k) => { if (k % 5 !== 4) it.owner = t0.members[k % t0.members.length]; });
    t0.members.forEach((u, k) => { studentById(u).inv = k === 0 ? { vase: 1, plush: 1 } : {}; });
    t0.picos = 24000;
  }
  // 週間ミッションの例（12/1〜12/6・チーミ全員が週4コマ以上）。お試しでは ひまわり の何人かが記録ずみ
  const cnt = {}; t0.members.forEach((u, k) => { cnt[u] = [5, 4, 4, 2, 6, 3][k % 6]; });
  // 校舎のお知らせ（お試し）
  S.notices = [{ id: 'n1', at: Date.now() - 3600000, kind: 'important', title: '12/1(火) から向上ハウスがはじまるよ', body: '受講した分だけピコがもらえるよ。チーミのみんなで家をつくろう！', date: '2026-12-01' }, { id: 'n2', at: Date.now() - 7200000, kind: 'event', title: '冬の家具フェア', body: 'あたたかい家具がそろうよ。くわしくは担任助手まで。', date: '2026-12-12' }, { id: 'n3', at: Date.now() - 86400000, kind: 'info', title: 'あいことばは チーミのみんなだけの ひみつ', body: 'ほかのチーミの人に教えないでね。' }];
  S.missions = [{ id: 'w20261201', title: '週4コマ以上 受講しよう', start: '2026-12-01', end: '2026-12-06', need: 4, picos: 5000, item: 'trophy', counts: cnt, claims: [] }];
}
function runDemoView(mode) {
  const q = new URLSearchParams(location.search);
  // ?test=demo : お試しの「勝又チーミ」の家。生徒と同じ家画面で開き、買い物をしても通信・保存が一切起きない（fetch は止めて数える）
  if (mode === 'demo') {
    const calls = [], rf = window.fetch; window.fetch = (...a) => { calls.push(String(a[0])); return Promise.reject(new Error('テストでは通信しない')); };
    const ls0 = JSON.stringify(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)]));
    (async () => {
      const out = {}; sampleHouse(); sync();
      out.inHouse = $('select').hidden && $('app').classList.contains('in-house'); out.team = T.name; out.members = T.members.length; out.nick = $('meNick').textContent;
      out.noRealNames = S.students.every(s => s.name === s.nick); out.svOff = !SV.on; out.items = room().items.length; out.sample = document.body.classList.contains('sample');
      out.hud = ['btnBack', 'btnRank', 'btnSet', 'panel', 'bar'].every(id => !!$(id)); out.label = getComputedStyle(document.body, '::after').content;
      const p0 = me.picos; await buy('chair'); out.bought = me.inv.chair === 1 && me.picos === p0 - priceOf(ITEM.chair);
      saveNow(); out.fetchCalls = calls.length; out.lsSame = JSON.stringify(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])) === ls0;
      window.fetch = rf; document.body.dataset.test = JSON.stringify(out);
    })();
    return 'wait';
  }
  // ?test=demoadm : 担任助手モードのホームに「生徒が見る画面を見る（勝又チーミ）」ボタン
  if (mode === 'desk') { makeDemo(); renderSelect(); openStaffDesk({ teams: () => S.teams.filter(t => t.confirmed), watch: watchTeam, openAdmin: gateAdmin }); return 'ok'; }
  if (mode === 'watch') { makeDemo(); renderSelect(); watchTeam(S.teams[0].id).then(() => { sync(); document.body.dataset.test = 'ok'; }); return 'wait'; }
  if (mode === 'demoadm') { makeDemo(); renderSelect(); adminPreset({ tab: 'home' }); openAdmin(); const b = document.querySelector('.demo-open'); return b ? 'btn: ' + b.textContent : 'no button'; }
  if (mode === 'empty') { S = store.defaultState(); T = null; renderSelect(); return 'ok'; }
  if (mode === 'select') { makeDemo(); renderSelect(); return 'ok'; }
  if (mode === 'demobtn') { const b = [...document.querySelectorAll('#select button')].find(x => x.textContent.includes('お試しデータ')); if (!b) return 'no button'; b.click(); return 'teams=' + S.teams.filter(t => t.confirmed).length; }
  if (mode === 'visit') { makeDemo(); renderSelect(); visitTeam(S.teams[0].id).then(() => { sync(); document.body.dataset.test = 'ok'; }); return 'wait'; }
  // ?test=staffvisit : 担任助手me-で家を見に行く → ★で歩く・伝言を書く・ほかのチーミへ移動・生徒は読むだけ
  if (mode === 'staffvisit') {
    makeDemo(); S.staffMes = [{ id: 's1', nick: 'たなか', me: Object.assign(randomMe(), { hat: 7, top: 4 }) }];
    const out = {}; renderSelect();
    (async () => {
      await visitTeam(S.teams[0].id); sync();
      const sa = AVS.find(a => a.id === '__staff'); out.staffAvatar = !!sa; out.staffName = sa && sa.name; out.teamsBtn = !$('btnTeams').hidden; out.notesBtn = !$('btnNotes').hidden;
      out.added = await addNote(T, 'あしたは 10時から です。がんばろう！'); out.notes = (T.notes || []).length;
      const t0 = T.id; leaveTeam(); await visitTeam(S.teams[1].id); out.moved = T && T.id !== t0; out.staffStill = AVS.some(a => a.id === '__staff');
      leaveTeam(); window.__noPin = true; enterAs(S.teams[0].id, S.teams[0].members[0]); await new Promise(r => setTimeout(r, 50));
      out.studentSeesNote = !$('btnNotes').hidden && $('btnNotes').classList.contains('new'); out.studentTeamsBtn = !$('btnTeams').hidden;
      notesDlg(); out.studentCanWrite = !!document.querySelector('#dlg .note-in'); out.noteShown = (document.querySelector('#dlg .note-tx') || {}).textContent;
      document.body.dataset.test = JSON.stringify(out);
    })().catch(e => { out.err = String(e && e.stack || e); document.body.dataset.test = JSON.stringify(out); });
    return 'wait';
  }
  // ?test=staffroom : 担任助手が家を見ているところ（★の担任助手me-と、伝言板を開いた画面の確認用）
  if (mode === 'staffroom') {
    makeDemo(); S.staffMes = [{ id: 's1', nick: 'たなか', me: Object.assign(randomMe(), { hat: 7, top: 4 }) }];
    S.teams[0].notes = [{ id: '1', at: Date.now() - 86400000, by: 'たなか', text: 'きのうは 家具を ならべてくれて ありがとう！' }, { id: '2', at: Date.now(), by: 'たなか', text: 'あしたは 10時から です。がんばろう！' }];
    studentById(S.teams[0].members[1]).staff = true;
    renderSelect(); visitTeam(S.teams[0].id).then(() => { sync(); if (q.get('notes')) notesDlg(); document.body.dataset.test = 'ok'; });
    return 'wait';
  }
  // ?test=pins : 担任助手モードの「番号」タブ（端末版）
  if (mode === 'pins') {
    makeDemo(); S.students.slice(0, 3).forEach(s => { s.pin = pinHash('1234', s.uid); }); studentById(S.teams[0].members[1]).staff = true;
    renderSelect(); adminPreset({ tab: q.get('tab') || 'pins' }); openAdminGate(); $('dlg').querySelector('input').value = '0000'; $('dlg').querySelector('input').dispatchEvent(new Event('input')); return 'ok';
  }
  // ?test=staffmembers : メンバー選択で、担任助手のme-に★の札
  if (mode === 'staffmembers') { makeDemo(); studentById(S.teams[0].members[1]).staff = true; showTeamMembers(S.teams[0].id); renderSelect(); return 'ok'; }
  if (mode === 'house') { makeDemo(); enterAs(S.teams[0].id, S.teams[0].members[0]); sync(); return 'ok'; }
  // ?test=plan&cam=iso|top|free&room=0|1|2 : 3部屋（L字のつながり）の家。部屋0とリビングはひとつづき、書斎は入口つき。玄関は手前が外に面したリビング側
  // ?test=planedit : 同じ家で間取り画面を開いた状態（リビングを右に1マス広げた下書き）
  if (mode === 'plan' || mode === 'planedit') {
    makeDemo(); enterAs(S.teams[0].id, S.teams[0].members[0]);
    const rooms = T.rooms, r0 = rooms[0], sz = r0.w; r0.name = '自分の部屋';
    const r1 = store.newRoom('リビング', 7, sz, sz, 0), r2 = store.newRoom('書斎', sz, 5, 0, sz);
    r1.wall = 'wp_sagewain'; r1.floor = 'fl_whitewash'; r2.wall = 'wp_cream'; r2.floor = 'fl_birch';
    r1.items = [inst('rug6', 1, 2), inst('sofa1', 1, 1), inst('lowtable', 1, 3), inst('plantL', 6, 0), inst('lamp', 4, 1), winst('frame', 'R', 2, 1.6), winst('frame', 'L', 1.5, 1.6)].filter(i => ITEM[i.id]);
    r2.items = [inst('desk', 1, 0), inst('chair', 1, 1), inst('shelf1', 5, 0), winst('frame', 'R', 3, 1.7)].filter(i => ITEM[i.id]);
    T.rooms.push(r1, r2); T.open = ['0-1']; T.picos = Math.max(T.picos, 60000);
    S.cur.room = Math.min(2, +(q.get('room') || 0));
    afterLoad(); sync(); setCamMode(q.get('cam') || 'iso'); paintCam(); updateCamera(0, true);
    if (q.get('thumb') === 'err') { setTimeout(() => { try { renderHouse(T); document.body.dataset.test = 'ok'; } catch (e) { document.body.dataset.test = String(e.stack).slice(0, 400); } }, 300); return 'wait'; }
    if (q.get('thumb') != null) { houseThumb(T, u => { const im = new Image(); im.src = u; im.style.cssText = 'position:fixed;left:10px;top:10px;width:360px;height:250px;z-index:999;background:#fde;border:2px solid #333'; document.body.appendChild(im); document.body.dataset.test = 'thumb ' + u.length; }); return 'wait'; }
    if (q.get('tap') != null) { (async () => { const out = {}, wait = ms => new Promise(r => setTimeout(r, ms)), tp = async (x, z) => { await wait(120); const p = project(new THREE.Vector3(x, 0, z)); tap(p[0], p[1], 'touch'); return S.cur.room; }; out.fromRoom0ToLiving = await tp(sz + 3, 3); out.backToRoom0 = await tp(2, 2); out.toStudy = await tp(3, sz + 2); document.body.dataset.test = JSON.stringify(out); })(); return 'wait'; }
    if (mode === 'planedit') { const ctl = openPlanScreen(); window.__plan = ctl; ctl.sel(1); ctl.edgeXY('r', sz + 8, 0); }
    return 'ok';
  }
  // ?test=deco&cam=iso|top|wallL|wallR&night=1&wall=wp_sagewain&floor=fl_whitewash : 第3弾の壁・床・壁かけ・小物を並べた部屋
  if (mode === 'deco') {
    makeDemo(); enterAs(S.teams[0].id, S.teams[0].members[0]);
    const rm = room(); rm.wall = q.get('wall') || 'wp_sagewain'; rm.floor = q.get('floor') || 'fl_whitewash'; rm.items = [];
    const n = N(), P = (id, x, y, r) => rm.items.push(inst(id, x, y, r || 0)), Wl = (id, w, p, z) => rm.items.push(winst(id, w, p, z));
    P('rug6', 2, 2); P('sofa1', 2, 1); P('lowtable', 2, 3); P('candle', 2, 3); P('jar', 3, 3); P('cubeshelf', 0, 0); P('bottles', 0, 0); P('basket', 1, 0); P('plantL', n - 1, 0); P('armchair', 4, 2);
    Wl('cafewin', 'R', 1.2, 1.1); Wl('wplanter', 'R', 2.6, 1.9); Wl('dryflower', 'R', 3.8, 1.5); Wl('switch', 'R', .3, 1.2); Wl('spotrail', 'R', n - 2.2, 2.85);
    Wl('bracket', 'L', 1.2, 2.0); Wl('hookrack', 'L', 2.4, .9); Wl('cafewin', 'L', 3.8, 1.1);
    if (q.get('night') === '1') rm.dark = true;
    placeAvatars(); rebuildRoom(); sync(); setCamMode(q.get('cam') || 'iso'); paintCam(); updateCamera(0, true);
    const out = { n: rm.items.length, thumbErr: ITEMS.filter(d => ['wplanter', 'dryflower', 'bracket', 'switch', 'cafewin', 'hookrack', 'spotrail', 'candle', 'jar', 'basket', 'bottles'].includes(d.id)).filter(d => { try { return !renderThumb(d); } catch (e) { return true; } }).map(d => d.id) };
    return JSON.stringify(out);
  }
  // ?test=natural&cam=iso&night=1 : ナチュラルなキッチン＋リビングの部屋（夕方）。新家具を並べる確認用（無いIDは飛ばす）
  if (mode === 'natural') {
    makeDemo(); enterAs(S.teams[0].id, S.teams[0].members[0]);
    const rm = room(), has = id => !!ITEM[id]; rm.items = [];
    rm.wall = q.get('wall') || (has('wp_paintboard') ? 'wp_paintboard' : 'wp_boardw'); rm.floor = q.get('floor') || (has('fl_herrorange') ? 'fl_herrorange' : 'fl_herrlight');
    const n = N(), P = (id, x, y, r) => { if (has(id)) rm.items.push(inst(id, x, y, r || 0)); }, Wl = (id, w, p, z) => { if (has(id)) rm.items.push(winst(id, w, p, z)); };
    // キッチン（右の壁ぞい）
    P('fridge2', 0, 0); P('sinkunit', 2, 0); P('gasrange', 4, 0); P('wagon', 6, 0);
    P('basket', 1, 0); P('bread', 0, 0); P('dishrack', 2, 0); P('pitcher', 3, 0); P('kettle', 4, 0); P('pot', 5, 0); P('toaster', 6, 0);
    Wl('wallcab', 'R', 2, 1.9); Wl('cafewin', 'R', 6.4, 1.1); Wl('towelbar', 'R', 4.3, 1.5); Wl('hathook', 'R', 5.4, 1.9); Wl('switch', 'R', 7.6, 1.2);
    // リビング・ダイニング
    P('rug6', 3, 3); P('birchtable', 3, 4); P('ladderchair', 3, 5, 2); P('rattanchair', 4, 5, 2); P('ladderchair', 5, 4, 1);
    P('candleglass', 3, 4); P('teapot', 4, 4); P('chocake', 5, 4);
    P(has('linensofa') ? 'linensofa' : 'sofa1', 0, 3, 1); P('sidetable', 0, 5); P('radio', 0, 5); P('woodstove', 0, 6); P('donabe', 0, 6);
    P('ladderrack', 0, 1); P('anthurium', 0, 1); P('lowtable', 1, 6); P('candle', 1, 6); P('mossball', 2, 6); P('plantL', n - 1, 2);
    P('tinbin', n - 1, 0); P('fullmirror', n - 1, 4, 3); P('slippers', 2, 2); P('macrame', 5, 2); P('blanket', 1, 7); P('lantern', 4, 6);
    Wl('cafewin', 'L', 4.2, 1.1); Wl('wreath', 'L', 2.4, 1.6); Wl('dryflower', 'L', 1.0, 1.5);
    rm.dark = q.get('night') === '1';
    placeAvatars(); rebuildRoom(); sync(); setCamMode(q.get('cam') || 'iso'); paintCam(); updateCamera(0, true);
    return JSON.stringify({ n: rm.items.length });
  }
  // ?test=catalog&set=0..4 : 第4弾の新アイテムを床に並べて近くで見る（モデルの出来の確認用）
  if (mode === 'catalog') {
    makeDemo(); enterAs(S.teams[0].id, S.teams[0].members[0]);
    const rm = room(), a = ITEMS.findIndex(d => d.id === 'fridge2'), b = ITEMS.findIndex(d => d.id === 'menuboard'), all = ITEMS.slice(a, b + 1), set = +(q.get('set') || 0);
    rm.items = []; rm.wall = 'wp_paintboard'; rm.floor = 'fl_herrorange'; sq(rm, T.size0 || CFG.MIN_SIZE); const n = N();
    const fl = all.filter(d => !d.wall).slice(set * 12, set * 12 + 12), wl = all.filter(d => d.wall);
    let x = 0, y = 1.4, rowH = 0;
    fl.forEach(d => { const w = d.w, dd = d.d; if (x + w > n) { x = 0; y += rowH + .3; rowH = 0; } rm.items.push(inst(d.id, x, Math.round(y), 0)); x += w + .3; rowH = Math.max(rowH, dd); });
    if (set === 0) wl.forEach((d, i) => rm.items.push(winst(d.id, i < 3 ? 'R' : 'L', 1 + (i % 3) * 2.2, d.zb)));
    placeAvatars(); rebuildRoom(); sync(); setCamMode(q.get('cam') || 'iso'); paintCam(); updateCamera(0, true);
    if (q.get('zoom')) { cam.zoom = +q.get('zoom'); cam.panx = +(q.get('px') || 0); cam.pany = +(q.get('py') || 0); updateCamera(0, true); }
    return JSON.stringify({ n: n, shown: fl.map(d => d.id).join(',') });
  }
  // ?test=models : 床・壁以外の全アイテムを作って、自前モデルがなく「ただの箱」になったものを数える
  if (mode === 'models') {
    const bad = []; ITEMS.filter(d => !d.pat).forEach(d => { try { buildItem(d); } catch (e) { bad.push(d.id + ':' + e.message); } });
    return JSON.stringify({ total: ITEMS.filter(d => !d.pat).length, fallback: [...fallbackIds], errors: bad });
  }
  if (mode === 'opening') { makeDemo(); renderSelect(); return 'ok'; }
  // ?test=teamlock : チーミを選ぶと、あいことばを聞かれる。ちがう番号では入れず、正しい番号でメンバー選択へ
  if (mode === 'teamlock') {
    makeDemo(); renderSelect(); const t = S.teams[0], wrong = t.code === '1111' ? '2222' : '1111';
    const key = k => window.dispatchEvent(new KeyboardEvent('keydown', { key: k }));
    const out = {}; document.querySelector('#select .tcard').click();
    setTimeout(() => {
      out.askShown = !$('modal').hidden && !!document.querySelector('.pin-keys'); out.membersBefore = !!document.querySelector('.mem-grid');
      [...wrong].forEach(key);
      setTimeout(() => {
        out.stillAsking = !$('modal').hidden; out.membersAfterWrong = !!document.querySelector('.mem-grid');
        [...t.code].forEach(key);
        setTimeout(() => { out.membersAfterRight = !!document.querySelector('.mem-grid'); out.staffStar = nickOf({ nick: 'せんせい', staff: true }); document.body.dataset.test = JSON.stringify(out); }, 400);
      }, 400);
    }, 300);
    return 'wait';
  }
  // ?test=wear : 家の中から me-をかえる → きせかえタブ（ショップつき）。1つ試着中
  if (mode === 'wear') {
    makeDemo(); enterAs(S.teams[0].id, S.teams[0].members[0]); me.picos = 50000; me.wear = ['top3', 'hat1'];
    me.me = Object.assign({}, me.me || {}, { top: 3, hat: 1, hood: 1, hair: 8 }); editMe('wear');
    { const ht = [...document.querySelectorAll('#mk .mk-tab')].find(b => b.textContent === 'ぼうし'); if (ht) ht.click(); }   // きせかえは種類ごとのタブ
    const t = [...document.querySelectorAll('#mk .mk-tile.wear')].find(b => b.textContent.includes('ねこみみ')); if (t) t.click();
    return JSON.stringify({ tiles: document.querySelectorAll('#mk .mk-tile.wear').length, buyBar: !!document.querySelector('#mk .mk-buy button') });
  }
  // ?test=looks : 新しい見た目・きせかえを着た人たちが並ぶ部屋（スクショ確認用）
  if (mode === 'looks') {
    makeDemo(); const t0 = S.teams[0]; t0.members = S.students.map(s => s.uid).slice(0, 12); enterAs(t0.id, t0.members[0]);
    const L = [[8, 3, 1, 0, 5], [9, 2, 3, 3, 4], [10, 4, 4, 5, 0], [11, 5, 2, 2, 3], [12, 1, 6, 1, 2], [13, 6, 5, 6, 5], [0, 0, 7, 7, 1], [3, 1, 2, 4, 0], [4, 2, 1, 0, 3], [6, 3, 5, 2, 4], [8, 4, 3, 1, 2], [9, 5, 0, 6, 0]];
    t0.members.forEach((u, i) => { const st = studentById(u), [hair, top, hat, eye, bag] = L[i]; st.me = Object.assign(randomMe(), { hair, top, hat, eye, bag, acc: i % 6, hood: i % 8, eyeC: i % 7, cheek: i % 5, skin: i % 10, hairC: (i * 3) % 14, mouth: i % 8, brow: i % 6 }); });
    studentById(t0.members[1]).staff = true;   // 担任助手（★）の名札の確認用
    const rm = room(); rm.items = []; rebuildAvatars(); rebuildRoom(); sync();
    const n = N(); AVS.forEach((a, i) => { a.x = 1.5 + (i % 4) * 1.6; a.y = 1.5 + Math.floor(i / 4) * 1.8; a.dir = 1; a.ry = a.tr = 0; a.path = []; a.idle = 99; }); holdAvatars();
    cam.zoom = +(q.get('zoom') || 1.25); cam.panx = +(q.get('px') || 0); cam.pany = +(q.get('py') || 0); if (q.get('nohat')) S.teams[0].members.forEach(u => { studentById(u).me.hat = 0; }), rebuildAvatars(), AVS.forEach((a, i) => { a.x = 1.5 + (i % 4) * 1.6; a.y = 1.5 + Math.floor(i / 4) * 1.8; a.ry = a.tr = 0; a.path = []; a.idle = 99; }); cam.dirty = true; return 'ok';
  }
  // ?test=rot4 : 家具が4方向に回る（幅2×奥行1のソファ）
  if (mode === 'rot4') {
    makeDemo(); enterAs(S.teams[0].id, S.teams[0].members[0]); const rm = room(); rm.items = [inst('sofa1', 2, 2)]; sync(); const s = rm.items[0]; setSel(s.uid);
    const seen = []; for (let k = 0; k < 4; k++) { actRot(); const r = rectOf(s); seen.push(s.rot + ':' + (r.x1 - r.x0) + 'x' + (r.y1 - r.y0)); sync(); seen.push('ry=' + Math.round(objs.get(s.uid).rotation.y * 180 / Math.PI)); }
    return JSON.stringify(seen);
  }
  // ?test=hold : 自分のme-は勝手に向きを変えない／視点を変えた直後はほかの人も止まる
  if (mode === 'hold') {
    makeDemo(); enterAs(S.teams[0].id, S.teams[0].members[0]); const mine = AVS.find(a => a.id === me.uid), others = AVS.filter(a => a !== mine);
    const d0 = mine.dir, x0 = mine.x; let mineChanged = 0; for (let s = 0; s < 1200; s++) { AVS.forEach(a => updateAvatar(a, 1 / 60)); if (mine.dir !== d0 || mine.x !== x0) mineChanged++; }
    holdAvatars(); const od = others.map(a => a.dir + ',' + a.x + ',' + a.y); others.forEach(a => { a.path = []; a.idle = 0; a.res = null; }); for (let s = 0; s < 120; s++) others.forEach(a => updateAvatar(a, 1 / 60));
    const othersMoved = others.filter((a, i) => (a.dir + ',' + a.x + ',' + a.y) !== od[i]).length;
    return JSON.stringify({ mineChanged, othersMovedDuringHold: othersMoved });
  }
  // ?test=avoid : 20人を狭い部屋で10秒ぶん歩かせ、同じマスに2人いる瞬間がないか数える
  if (mode === 'avoid') {
    makeDemo(); const t0 = S.teams[0]; t0.members = S.students.map(s => s.uid).slice(0, 14); enterAs(t0.id, t0.members[0]);
    const rm = room(); rm.items = rm.items.filter(i => !isBig(i)); placeAvatars();
    let overlap = 0, steps = 0, moved = 0; const start = AVS.map(a => [a.x, a.y]);
    for (let s = 0; s < 600; s++) {
      if (s % 40 === 0) AVS.forEach(a => { if (!a.path.length) a.idle = 0; });
      AVS.forEach(a => updateAvatar(a, 1 / 60));
      const seen = new Set(); AVS.forEach(a => { const k = Math.floor(a.x) + ',' + Math.floor(a.y); if (seen.has(k)) overlap++; seen.add(k); }); steps++;
    }
    AVS.forEach((a, i) => { if (Math.hypot(a.x - start[i][0], a.y - start[i][1]) > .5) moved++; });
    return JSON.stringify({ avatars: AVS.length, steps, overlap, moved });
  }
  // ?test=megrid&k=top|hat|acc|bag|hair&v=bF,bS,bB : 見た目を大きく並べる（服の部品が浮いていないか・髪型の確認用）
  if (mode === 'megrid') {
    const q = new URLSearchParams(location.search), k = q.get('k') || 'top', views = (q.get('v') || (k === 'hair' ? 'hF,h3,hS,hB' : 'bF,bS,bB')).split(','), base = Object.assign(cleanMe({}), JSON.parse(q.get('base') || '{}'));
    const n = ME_COUNT[k] || 7, only = q.get('i');
    document.body.innerHTML = ''; document.body.style.cssText = 'background:#efe6d6;margin:0;font:14px sans-serif;overflow:auto';
    const box = h('div', { style: 'display:flex;flex-wrap:wrap;gap:6px;padding:6px' }); document.body.appendChild(box);
    for (let i = 0; i < n; i++) { if (only != null && !only.split(',').includes(String(i))) continue; const m = Object.assign({}, base, { [k]: i }); const cell = h('div', { style: 'background:#fffaf0;border-radius:8px;padding:4px' }, [h('div', { text: k + i })]); views.forEach(v => { const im = new Image(); im.src = meThumb(m, v); cell.appendChild(im); }); box.appendChild(cell); }
    return 'ok';
  }
  // ?test=mission&all=1 : 週間ミッション（端末だけ）。all=1 で全員達成→受け取り。shot=1 は画面確認用（パネルのミッションタブを開いたまま）
  if (mode === 'mission') {
    makeDemo(); const t0 = S.teams[0], m = S.missions[0], td = todayStr(), out = {};
    if (q.get('now') !== '0') { m.start = td; m.end = td; }
    if (q.get('all') === '1') t0.members.forEach(u => { m.counts[u] = 4; });
    enterAs(t0.id, t0.members[0]); missionDlg();
    out.tabShown = !!$('dlg').querySelector('.ms-card'); out.chips = $('dlg').querySelectorAll('.ms-chip').length; out.mine = ($('dlg').querySelector('.ms-mine') || {}).textContent; out.card = $('btnMission').textContent; out.stat = missionStat(m, T); out.btn = !$('btnMission').hidden; out.canClaim = canClaim(m);
    if (q.get('shot') === '1') return JSON.stringify(out);
    const p0 = me.picos; const inv0 = me.inv.trophy | 0;
    claimMission(m, () => { }); out.picos = me.picos - p0; out.trophy = (me.inv.trophy | 0) - inv0; out.again = canClaim(m);
    const st = studentById(t0.members[1]); st.staff = false; out.otherCan = (() => { const m0 = me; me = st; const r = canClaim(m); me = m0; return r; })();
    S.missions[0].counts[t0.members[2]] = 1; out.afterDrop = missionStat(m, T).achieved;
    return JSON.stringify(out);
  }
  // ?test=info : 最初に「大事なお知らせ」（日数・掲示板）→「チーミをえらぶ」でチーミ選択。ほかのチーミの家のサムネは出さない
  if (mode === 'info') {
    makeDemo(); setInfoSeen(false); if (q.get('start')) S.startDate = q.get('start'); renderSelect(); const out = {};
    out.infoShown = !!document.querySelector('.info-page'); out.day = (document.querySelector('.day-card') || {}).textContent; out.notices = document.querySelectorAll('.nt-item').length; out.teamsHidden = !document.querySelector('.tcard:not(.ghost)');
    if (q.get('shot') === '1') return JSON.stringify(out);
    document.querySelector('.info-go').click(); out.teamsAfter = document.querySelectorAll('.tcard:not(.ghost)').length; out.strip = (document.querySelector('.info-strip') || {}).textContent; out.houseImgs = document.querySelectorAll('.tc-thumb img').length;
    return JSON.stringify(out);
  }
  // ?test=noticeadm : 担任助手モードの「お知らせ」タブ
  if (mode === 'noticeadm') { makeDemo(); renderSelect(); adminPreset({ tab: 'notice' }); openAdmin(); return document.querySelectorAll('.nt-adm').length + ' notices, start=' + !!document.querySelector('.nt-startbox'); }
  // ?test=missionadm : 担任助手モードの「ミッション」タブ（コマ数の記録を開いた状態）
  if (mode === 'missionadm') {
    makeDemo(); renderSelect(); adminPreset({ tab: 'mission', mission: 'w20261201', mcounts: Object.assign({}, S.missions[0].counts) }); openAdmin(); return 'ok';
  }
  // ?test=facing : 止まっている人はかべ側を向かない／歩くときはななめも／タップでぴょんと反応する
  if (mode === 'facing') {
    makeDemo(); const t0 = S.teams[0]; t0.members = S.students.map(s => s.uid).slice(0, 10); enterAs(t0.id, t0.members[0]);
    const rm = room(); rm.items = rm.items.filter(i => !isBig(i)); placeAvatars(); rebuildRoom(); sync();
    AVS.forEach(a => { a.tr = a.ry = Math.PI; });   // わざと全員かべ向きにしておく
    let badStand = 0, diag = 0, angles = new Set();
    for (let s = 0; s < 1500; s++) {
      if (s % 50 === 0) AVS.forEach(a => { if (!a.path.length) a.idle = 0; });
      AVS.forEach(a => { updateAvatar(a, 1 / 60); updateAvatarObj(a, 1 / 60); if (a.moving) { angles.add(Math.round(a.tr * 4 / Math.PI)); if (Math.abs(Math.sin(2 * a.tr)) > .9) diag++; } });
      if (s > 60) AVS.forEach(a => { if (!a.moving && !a.path.length && a.react <= 0 && Math.abs(wrapA(a.ry - a.tr)) < .01 && (a.ry < -.01 || a.ry > FACE_MAX + .01)) badStand++; });
    }
    const a0 = AVS[1]; a0.path = []; a0.res = null; updateAvatarObj(a0, 0); E.fxG.updateMatrixWorld(true); updateCamera(0, true);
    const wp = a0.g.getObjectByName('head').getWorldPosition(new THREE.Vector3()), [px, py] = project(wp);
    tap(px, py, 'touch'); const reacted = a0.react > 0, hadNote = !!a0.fx;
    let maxLift = 0; for (let s = 0; s < 80; s++) { updateAvatar(a0, 1 / 60); updateAvatarObj(a0, 1 / 60); maxLift = Math.max(maxLift, a0.g.position.y); }
    return JSON.stringify({ badStand, diagSteps: diag, moveAngles: angles.size, reacted, hadNote, maxLift: +maxLift.toFixed(2), noteGone: !a0.fx, standAfter: +a0.tr.toFixed(2) });
  }
  // ?test=multi : まとめて選んで1マス動かす（置けない所には動かない）
  if (mode === 'multi') {
    makeDemo(); enterAs(S.teams[0].id, S.teams[0].members[0]); const rm = room();
    rm.items = [inst('desk', 1, 1), inst('chair', 1, 2), inst('laptop', 1, 1), inst('shelf1', 4, 1)]; sync(); enterMulti();
    const desk = rm.items[0], chair = rm.items[1], top = rm.items[2]; multi.sel.add(desk.uid); multi.sel.add(chair.uid);
    const its = [desk, chair, top], set = new Set(its.map(i => i.uid)), dr = { kind: 'move', its, orig: its.map(i => [i.x, i.y]), set, dx: 0, dy: 0, f0: [0, 0] };
    const okRight = groupFits(dr, 1, 0), blocked = groupFits(dr, 2, 0), outside = groupFits(dr, -2, 0);
    multi.drag = dr; dragMove(...project(new THREE.Vector3(1.0, 0, 0)));   // 画面上で動かしても例外が出ないこと
    multi.drag = null; return JSON.stringify({ okRight, blocked, outside, sel: multi.sel.size });
  }
  if (mode === 'rank' || mode === 'rankp') { makeDemo(); renderSelect(); openRanking(); return 'ok'; }
  if (mode === 'members') { makeDemo(); showTeamMembers(S.teams[0].id); renderSelect(); return 'ok'; }
  if (mode === 'make') { makeDemo(); openMeMaker({ tab: +(q.get('tab') || 0), nick: 'ひなた', me: S.students[0].me, nextLabel: 'つぎへ（番号をきめる）', cancelLabel: 'もどる' }); return 'ok'; }
  if (mode === 'pickteam') { makeDemo(); S.teams.forEach(t => { t.confirmed = true; }); for (let i = S.teams.length; i < +(q.get('n') || 8); i++) S.teams.push(Object.assign({}, S.teams[0], { id: 'x' + i, name: 'チーミ' + (i + 1) })); screenCtx.teamAuth = null; chooseTeam(S.students[0].me, 'ひなた'); return 'ok'; }
  if (mode === 'make1') { makeDemo(); openMeMaker({ nick: '', start: {}, nextLabel: 'つぎへ（番号をきめる）', cancelLabel: 'もどる' }); return 'ok'; }
  if (mode === 'pin') { makeDemo(); pinPad('4けたの番号を入力', 'ピコが動くので確認します', { face: faceImg(S.students[0].me, 'face', 'face'), who: S.students[0].nick }); return 'ok'; }
  if (mode === 'bar') { makeDemo(); enterAs(S.teams[0].id, S.teams[0].members[0]); sync(); const it = room().items.find(i => i.id === 'desk'); setSel(it.uid); return 'ok'; }
  if (mode === 'bank') { makeDemo(); enterAs(S.teams[0].id, S.teams[0].members[0]); tab = 'plan'; renderPanel(); return 'ok'; }
  if (mode === 'mes') {
    const el = h('div', { id: 'dbgMes' }); document.body.appendChild(el); let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const row = (t, kids) => { el.appendChild(h('div', { cls: 'dbg-t', text: t })); const r = h('div', { cls: 'dbg-r' }); kids.forEach(k => r.appendChild(k)); el.appendChild(r); };
    const img = (m, k) => { const im = new Image(); im.src = meThumb(m, k); return im; };
    const base = Object.assign({}, S.students.length ? {} : {}, { hair: 0, hairC: 0, skin: 1, eye: 0, nose: 1, mouth: 0, brow: 1, mole: 0, glasses: 0, height: 1, plump: .4, hood: 0 });
    row('かみがた 8', [0, 1, 2, 3, 4, 5, 6, 7].map(i => img(Object.assign({}, base, { hair: i, hairC: i + 1 }), 'hair')));
    row('め 6 + くち 6', [0, 1, 2, 3, 4, 5].map(i => img(Object.assign({}, base, { eye: i, mouth: i, mole: i }), 'face')).concat([0, 1, 2, 3, 4, 5].map(i => img(Object.assign({}, base, { eye: 5 - i, mouth: i, nose: i % 4, brow: i % 5, glasses: i % 5, hairC: i + 2, skin: i }), 'face'))));
    row('ランダムな me- （全身）', Array.from({ length: 9 }, () => img(randomMe(rnd), 'full')));
    return 'ok';
  }
  if (mode === 'detail') { makeDemo(); renderSelect(); openRanking(); teamDetailDlg(S.teams[1]); return 'ok'; }
  if (mode === 'roster') { makeDemo({ noScore: true }); S.students = S.students.slice(0, 2); S.teams = []; renderSelect(); adminPreset({ tab: 'roster', rosterText: '生徒番号\t氏名\tふりがな\t学年\tチーミ\n101\t山田　太郎\tやまだ たろう\t中2\tひまわり\n102\t佐藤 花子\tさとう はなこ\t中3\tあおぞら\n103\t鈴木 一郎\tすずき いちろう\t中2\tひまわり\n\n102\t佐藤 花子\tさとう はなこ\t中3\tあおぞら\n105\t高橋 美咲\tたかはし みさき\t中1\t\n106\t\t\t\t\n107\t伊藤 結衣\tいとう ゆい\t中2\tあおぞら' }); openAdminGate(); S.settings.passcode = '0000'; $('dlg').querySelector('input').value = '0000'; $('dlg').querySelector('input').dispatchEvent(new Event('input')); return 'ok'; }
  if (mode === 'teams') { makeDemo({ noScore: true, unconfirmed: true, partial: true }); S.teams[3].members = S.teams[3].members.slice(0, 1); renderSelect(); adminPreset({ tab: 'teams' }); openAdminGate(); $('dlg').querySelector('input').value = '0000'; $('dlg').querySelector('input').dispatchEvent(new Event('input')); return 'ok'; }
  if (mode === 'stay') {
    makeDemo({ noScore: true }); S.lastStay = { [S.students[0].uid]: 60 };
    const t = '生徒番号\t氏名\t在校時間\n' + S.students.slice(0, 6).map((x, i) => x.id + '\t' + x.name + '\t' + ['1時間30分', '1:05', '90分', '45', '2時間', '0:20'][i]).join('\n') + '\n999\t不明\t1:00\n';
    renderSelect(); adminPreset({ tab: 'stay', stayText: t }); openAdminGate(); $('dlg').querySelector('input').value = '0000'; $('dlg').querySelector('input').dispatchEvent(new Event('input')); return 'ok';
  }
  if (mode === 'score') {
    makeDemo({ noScore: true }); S.lastScore = { [S.students[0].uid]: 3, [S.students[1].uid]: 5 };
    const t = S.students.slice(0, 7).map((s, i) => s.id + '\t' + s.name + '\t' + [3.5, 12.3, 8, 0.4, 20, 5.5, 9][i]).join('\n') + '\n999\tだれか 不明\t4\n' + S.students[8].name.replace(' ', '') + '\t０．５\n' + S.students[9].id + '\t' + S.students[9].name + '\tなし\n';
    S.students.push(store.newStudent('555', '未所属 さん'));
    renderSelect(); adminPreset({ tab: 'score', scoreText: t + '555\t未所属 さん\t2\n' }); openAdminGate(); $('dlg').querySelector('input').value = '0000'; $('dlg').querySelector('input').dispatchEvent(new Event('input')); return 'ok';
  }
  return null;
}
const dlgBtnClick = txt => { const b = [...$('dlg').querySelectorAll('button')].find(x => x.textContent.trim().startsWith(txt)); if (b) b.click(); };
// ?test=svmembers / svlink : サーバー版の画面確認用（にせサーバー）
async function svView(mk, mode) {
  window.__noPin = true; SV.sb = mk.sb; SV.on = true; { const sc = new URLSearchParams(location.search).get('schema'); if (sc != null) mk.db.schema = +sc; if (new URLSearchParams(location.search).get('legacy') === '1') mk.db.legacy = true; await loadServerInfo(); } S = store.defaultState(); noSave = true; screenCtx.loadDemo = null; screenCtx.houseThumb = houseThumb;
  const nicks = ['ひな', 'そら', 'みお', 'れん'];
  for (const n of nicks) await mk.sb.rpc('create_me', { p_team: 't1', p_nick: n, p_me: seededMe(n), p_pin: '1234' });
  mk.db.students[0].approved = true; mk.db.students[0].picos = 4200; mk.db.students[0].earned = 4200; mk.db.teams[0].n = 5;
  await pullApply(true); setMyUid(mk.db.students[0].uid); if (mode !== 'svsel') showTeamMembers('t1'); renderSelect();
  if (mode === 'svdone') {   // 確認用：できあがり画面（slot=1 で名前えらびあり）と、承認まちのボタン
    const cr = await svCall('create_me', { p_team: 't1', p_nick: 'ひな', p_me: randomMe(), p_pin: '1234' }); if (new URLSearchParams(location.search).get('slot') === '1') { cr.slot = true; mk.db.students[mk.db.students.length - 1].approved = true; }
    await finishCreate(cr, 't1', '1234'); if (new URLSearchParams(location.search).get('enter') === '1') { dlgBtnClick('家に入る'); }
  }
  if (mode === 'svlink') {
    SV.adminPass = '0000'; adminOn = true;
    const a = admLoad(); a.students = DEMO_NAMES.slice(0, 6).map((n, i) => ({ uid: 'k' + i, id: String(101 + i), name: n, link: i === 0 ? mk.db.students[0].uid : null })); a.teams = [{ id: 't1', name: 'ひまわり', members: a.students.slice(0, 5).map(x => x.uid) }];
    mergeAdmin(a, SV.rows, SV.teamRows, SV.priceMul); SV.adm = a; adminPreset({ tab: 'link' }); openAdmin();
  }
  // ?test=svhome / svscore / svquick : 担任助手モードのホーム・向上得点の貼り付け（サーバー版）・チーミを作る（にせサーバー）。linked=0 でひもづけ無し、roster=0 で名簿無し
  if (mode === 'svhome' || mode === 'svscore' || mode === 'svquick' || mode === 'svops' || mode === 'svops2' || mode === 'svdaily' || mode === 'svupd' || mode === 'svnotice') {
    const qq = new URLSearchParams(location.search); SV.adminPass = '0000'; adminOn = true;
    const a = admLoad(); a.students = qq.get('roster') === '0' ? [] : DEMO_NAMES.slice(0, 6).map((n, i) => ({ uid: 'k' + i, id: String(101 + i), name: n, link: qq.get('linked') !== '0' && i < 3 ? mk.db.students[i].uid : null })); a.teams = a.students.length ? [{ id: 't1', name: 'ひまわり', members: a.students.slice(0, 5).map(x => x.uid) }] : [];
    mk.db.students.slice(0, 3).forEach(x => { x.approved = true; });
    await pullApply(true); mergeAdmin(a, SV.rows, SV.teamRows, SV.priceMul); a.scoreLog = []; SV.adm = a;
    adminPreset({ tab: qq.get('tab') || (mode === 'svnotice' ? 'notice' : mode === 'svscore' ? 'score' : 'home'), scoreText: mode === 'svscore' && qq.get('text') !== '0' ? '山田太郎\t12.5\n佐藤花子\t8\n鈴木一郎\t3\n高橋美咲\t5' : '' }); openAdmin();
    if (mode === 'svscore' && qq.get('go') === '1') {   // 「適用する」を押して、サーバーへ送られた中身を調べる（uid と付与ピコだけのはず）
      const b = [...document.querySelectorAll('#sheet button')].find(x => x.textContent.startsWith('適用する')); if (!b) { document.body.dataset.test = 'no apply button: ' + $('sheet').innerText.slice(0, 300); return; } b.click(); await new Promise(r => setTimeout(r, 100)); const cf = [...$('dlg').querySelectorAll('button')].find(x => x.textContent === '適用する'); if (cf) cf.click(); await new Promise(r => setTimeout(r, 300));
      const g = mk.db.calls.find(c => c[0] === 'admin_grant'); document.body.dataset.test = JSON.stringify({ grant: g && g[1], picos: mk.db.students.slice(0, 3).map(x => x.picos), json: JSON.stringify(g && g[1]) }); return;
    }
    if (mode === 'svnotice') {   // 「お知らせを書く」→ タイトルを入れて「保存」→ サーバーに入るか・ホームに出るか
      const nb = [...document.querySelectorAll('#sheet button')].find(x => x.textContent.includes('お知らせを書く')); nb.click(); await new Promise(r => setTimeout(r, 50));
      const ti = document.getElementById('dlg').querySelector('input[type=text]'); ti.value = 'テストのお知らせ'; ti.dispatchEvent(new Event('input'));
      const sb = [...document.getElementById('dlg').querySelectorAll('button')].find(x => x.textContent === '保存'); sb.click(); await new Promise(r => setTimeout(r, 300));
      const out = { saved: mk.db.notices.length, call: (mk.db.calls.find(c => c[0] === 'admin_notice_save') || [])[1], dlgOpen: !document.getElementById('modal').hidden, toasts: [...document.querySelectorAll('.toast')].map(t => t.textContent) };
      await pullApply(true); out.S = (S.notices || []).length; $('sheet').hidden = true; setInfoSeen(false); renderSelect(); out.home = document.querySelectorAll('.nt-item').length;
      document.body.dataset.test = JSON.stringify(out); return;
    }
    if (mode === 'svops') {   // 運用まわり：チェックリスト・操作者・取り込みの記録/同日2回目の確認/あとで直す一覧・確認用データを消して本番を始める
      const wait = ms => new Promise(r => setTimeout(r, ms)), o = {}, sheet = () => $('sheet').innerText, btn = (root, txt) => [...root.querySelectorAll('button')].find(x => x.offsetParent !== null && x.textContent.trim().startsWith(txt));
      try {
        SV.adminPass = 'newpass-123'; mk.db.pass = 'newpass-123'; admSaveLocal(SV.adm); SV.startDate = '2026-12-01'; SV.exportAt = 0; SV.operator = '';
        const pr = chooseOperator(['たなか', 'すずき']); await wait(50); o.opDlg = $('dlg').innerText.includes('だれが操作しますか') && $('dlg').innerText.includes('すずき'); btn($('dlg'), 'すずき').click(); o.op = await pr; o.opSaved = SV.operator === 'すずき' && localStorage.getItem('kojoHouse.operator') === 'すずき';
        closeModal(); openAdmin(); await wait(100);
        o.checkRows = document.querySelectorAll('#launchCheck .lc-row').length; o.checkTitle = sheet().includes('運用開始までのチェック'); o.noStale = !sheet().includes('サーバーの更新が必要です'); o.exportWarn = sheet().includes('サーバーのデータをまだ保存していません');
        // 取り込み（向上得点）：1回目 → 同じ日の2回目で確認
        adminPreset({ tab: 'score', scoreText: '山田太郎\t12.5\n佐藤花子\t8\n鈴木一郎\t3\n高橋美咲\t5\n不明人\t9' }); openAdmin('score'); await wait(100);
        o.lastNone = sheet().includes('最後の取り込み') && sheet().includes('まだありません');
        btn($('sheet'), '適用する').click(); await wait(60); o.badDlg = $('dlg').innerText.includes('あとで直す一覧'); btn($('dlg'), '適用する').click(); await wait(400);
        const g1 = mk.db.calls.filter(c => c[0] === 'admin_grant'); o.grant1 = g1.length; o.by = g1[0] && g1[0][1].p_by; o.lastBox = sheet().includes('最後の取り込み') && sheet().includes('すずき'); o.histRow = sheet().includes('直近 1件');
        o.laterList = sheet().includes('あとで直す一覧') && sheet().includes('不明人') && sheet().includes('高橋美咲'); o.laterHints = sheet().includes('まだ me- を作っていない') && sheet().includes('名簿にその人がいない');
        adminPreset({ scoreText: '山田太郎\t12.5\n佐藤花子\t8' }); openAdmin('score'); await wait(100);
        btn($('sheet'), '適用する').click(); await wait(80); o.dupDlg = $('dlg').innerText.includes('同じ種類') && $('dlg').innerText.includes('二重に加算されることはありません'); btn($('dlg'), 'やめる').click(); await wait(50); o.grantAfterCancel = mk.db.calls.filter(c => c[0] === 'admin_grant').length;
        const undo = btn($('sheet'), '取り消す'); o.undoBtn = !!undo; undo.click(); await wait(60); btn($('dlg'), '元に戻す').click(); await wait(300); o.undoneBy = mk.db.log[0].undone_by; o.picosAfterUndo = mk.db.students.slice(0, 3).map(x => x.picos).join(',');
        // 書き出し → 確認用データを消して本番を始める
        mk.db.students.forEach(x => { x.picos = 777; }); openAdmin('set'); await wait(100); o.exportCard = sheet().includes('サーバーのデータを保存（JSON）');
        btn($('sheet'), 'サーバーのデータを保存').click(); await wait(300); o.exportAt = SV.exportAt > 0 && mk.db.calls.some(c => c[0] === 'admin_mark_export');
        const dz = document.querySelector('#sheet .danger-zone'); dz.open = true; btn(dz, '確認用データを消して本番を始める').click(); await wait(80);
        const dl = $('dlg'); o.wipeText = dl.innerText.includes('消えるもの') && dl.innerText.includes('残るもの') && dl.innerText.includes('未使用にもどり');
        const go = btn(dl, '消して本番を始める'); o.goDisabled = go.disabled; const ins = dl.querySelectorAll('input');
        const set = (e, v) => { e.value = v; e.dispatchEvent(new Event('input')); };
        set(ins[0], 'wrong-pass'); set(ins[1], '本番開始'); o.goEnabled = !go.disabled; go.click(); await wait(300); o.wrongPassKept = mk.db.students.length > 0 && $('dlg').innerText.includes('消えるもの');
        set(ins[1], 'ちがう'); o.goDisabledPhrase = go.disabled; set(ins[0], 'newpass-123'); set(ins[1], '本番開始'); const exportsBefore = mk.db.calls.filter(c => c[0] === 'admin_export').length;
        go.click(); await wait(600);
        o.wiped = mk.db.students.length === 0 && mk.db.log.length === 0; o.exportedFirst = mk.db.calls.filter(c => c[0] === 'admin_export').length === exportsBefore + 1; o.teamKept = mk.db.teams.length > 0 && mk.db.teams[0].confirmed; o.wipedAt = SV.wipedAt > 0;
        openAdmin('home'); await wait(100); o.wipeRowOk = !!document.querySelector('#launchCheck .lc-row[data-key=wipe].ok'); o.rosterKept = SV.adm.students.length === 6;
      } catch (e) { o.err = String(e && e.stack || e); }
      document.body.dataset.test = JSON.stringify(o); return;
    }
    if (mode === 'svupd') {   // 開いたままのタブ：同じ版なら何も出ない／version.txt が変わっていたら「新しい版があります［更新する］」（本物の通信はしない：版は差しかえで返す）
      const wait = ms => new Promise(r => setTimeout(r, ms)), o = {};
      try {
        window.__updWatchTest = true; let ver = new URL(import.meta.url).searchParams.get('v'); window.__fetchVersion = async () => ver; const check = startUpdateWatch();
        o.hasCheck = typeof check === 'function'; await check(); o.sameNoBar = !$('updBar');
        ver = '209912312359'; await check(); await wait(50); const bar = $('updBar'); o.bar = !!bar && bar.innerText.includes('新しい版があります') && !!bar.querySelector('button') && bar.querySelector('button').textContent === '更新する';
        const r = bar && bar.getBoundingClientRect(); o.barRect = r && [Math.round(r.top), Math.round(r.height), Math.round(r.width)]; o.barSmall = !!r && r.height < 40 && r.top < 20; await check(); o.once = document.querySelectorAll('#updBar').length === 1;
        ver = 'garbage'; $('updBar').remove(); await check(); o.badIgnored = !$('updBar');
      } catch (e) { o.err = String(e && e.stack || e); }
      document.body.dataset.test = JSON.stringify(o); return;
    }
    if (mode === 'svdaily') {   // 利用時間：残り知らせ→「今日はここまで」→家に入れない→担任助手のme-は対象外→今日だけ解除で続けられる
      const wait = ms => new Promise(r => setTimeout(r, ms)), o = {};
      try {
        mk.db.settings.daily_minutes = 1; mk.db.students[1].staff = true; await pullApply(true); o.dailyMin = SV.dailyMin;
        const st = studentById(mk.db.students[0].uid), t = S.teams.find(x => x.id === 't1'); closeModal();
        dailyAdd(st.uid, 35); startHouse(t, st); await wait(100); o.inHouse = !!T && me === st; dailyTick(); await wait(1100); dailyTick(); o.warnToast = $('toasts').innerText.includes('あと');
        dailyAdd(st.uid, 30); dailyTick(); await wait(50); o.overlay = !!$('dailyEnd') && $('dailyEnd').innerText.includes('今日はここまで') && $('dailyEnd').innerText.includes('続きは明日');
        o.homeKept = document.body.innerText.includes('チーミ') || !$('select').hidden;
        if (new URLSearchParams(location.search).get('shot') === '1') { document.body.dataset.test = 'shot'; return; }
        [...$('dailyEnd').querySelectorAll('button')].find(x => x.textContent.startsWith('ホームにもどる')).click(); await wait(100); o.left = !T && !$('dailyEnd');
        startHouse(t, st); await wait(100); o.blocked = !T && !!$('dailyEnd'); const btnc = [...$('dailyEnd').querySelectorAll('button')].find(x => x.textContent.startsWith('解除されたか'));
        btnc.click(); await wait(400); o.stillBlocked = !!$('dailyEnd');
        [...$('dailyEnd').querySelectorAll('button')].find(x => x.textContent.startsWith('ホームにもどる')).click(); await wait(50);
        const stf = studentById(mk.db.students[1].uid); dailyAdd(stf.uid, 500); startHouse(t, stf); await wait(100); o.staffExempt = !!T && me === stf && !$('dailyEnd'); leaveTeam();
        startHouse(t, st); await wait(100); const btn2 = [...$('dailyEnd').querySelectorAll('button')].find(x => x.textContent.startsWith('解除されたか')); await mk.sb.rpc('admin_daily_unlock', { p_admin: mk.db.pass, p_uid: st.uid, p_on: true }); btn2.click(); await wait(500); o.unlocked = !$('dailyEnd');
        startHouse(t, st); await wait(100); o.entersAfterUnlock = !!T && me === st; leaveTeam();
        mk.db.settings.daily_minutes = 0; await pullApply(true); o.noLimit = !dailyBlocked(st) && SV.dailyMin === 0;
      } catch (e) { o.err = String(e && e.stack || e); }
      document.body.dataset.test = JSON.stringify(o); return;
    }
    if (mode === 'svops2') {   // メンバーの変化：休止・名前を戻す・チーミ移動・生徒を1人追加
      const wait = ms => new Promise(r => setTimeout(r, ms)), o = {}, sheet = () => $('sheet').innerText, btn = (root, txt) => [...root.querySelectorAll('button')].find(x => x.offsetParent !== null && x.textContent.trim().startsWith(txt));
      try {
        SV.adminPass = 'newpass-123'; mk.db.pass = 'newpass-123';
        const t2 = JSON.parse(JSON.stringify(mk.db.teams[0])); t2.id = 't2'; t2.name = 'あおぞら'; t2.members = []; t2.n = 3; t2.picos = 0; t2.data.rooms[0].items = []; mk.db.teams.push(t2);
        const u0 = mk.db.students[0].uid; mk.db.teams[0].data.rooms[0].items = [{ uid: 1, id: 'chair', x: 2, y: 2, rot: 0, owner: u0 }, { uid: 2, id: 'sofa1', x: 3, y: 3, rot: 0, owner: mk.db.students[1].uid }];
        a.teams.push({ id: 't2', name: 'あおぞら', members: [] }); mergeAdmin(a, SV.rows, SV.teamRows, SV.priceMul); admSaveLocal(a); await actx.reload(); await pullApply(true);
        SV.operator = 'たなか'; openAdmin('pins'); await wait(150);
        o.pinsBtns = !!btn($('sheet'), '休止') && !!btn($('sheet'), '名前を戻す');
        btn($('sheet'), '休止').click(); await wait(60); o.retireDlg = $('dlg').innerText.includes('ログインできなくなります') && $('dlg').innerText.includes('卒業した人'); btn($('dlg'), '休止にする').click(); await wait(400);
        o.retired = mk.db.students[0].retired === true; o.retiredTag = sheet().includes('休止') && !!btn($('sheet'), '復帰'); o.hiddenFromTeam = !SV.teamRows.find(x => x.id === 't1').members.includes(u0);
        btn($('sheet'), '復帰').click(); await wait(60); btn($('dlg'), '復帰させる').click(); await wait(400); o.restored = mk.db.students[0].retired === false;
        const nb = [...$('sheet').querySelectorAll('button')].filter(x => x.textContent.trim() === '名前を戻す')[1]; nb.click(); await wait(60); btn($('dlg'), '差し戻す').click(); await wait(400); o.nickReset = mk.db.students[1].nick === '' && sheet().includes('まだ');
        // チーミ移動
        openAdmin('teams'); await wait(150); const chip = [...document.querySelectorAll('#sheet .schip')].find(x => x.title === '101'); o.chip = !!chip; chip.click(); await wait(60);
        btn($('dlg'), 'あおぞら').click(); await wait(80); o.moveDlg = $('dlg').innerText.includes('持ち物にもどります') && $('dlg').innerText.includes('チーミ移動'); btn($('dlg'), '移す').click(); await wait(500);
        o.moved = mk.db.students[0].team_id === 't2' && mk.db.teams[1].members.includes(u0) && !mk.db.teams[0].members.includes(u0); o.invBack = mk.db.students[0].inv.chair >= 1; o.houseClean = mk.db.teams[0].data.rooms[0].items.length === 1;
        o.localMoved = !!SV.adm.teams.find(x => x.id === 't2').members.includes(SV.adm.students[0].uid); o.picosKept = mk.db.students[0].picos === 4200;
        // 生徒を1人追加
        openAdmin('home'); await wait(100); o.addBtn = !!btn($('sheet'), '＋ 生徒を1人追加' ) || sheet().includes('生徒を1人追加'); [...$('sheet').querySelectorAll('button')].find(x => x.textContent.includes('生徒を1人追加')).click(); await wait(60);
        const ins = $('dlg').querySelectorAll('input'), set = (e, v) => { e.value = v; e.dispatchEvent(new Event('input')); }; set(ins[0], '999'); set(ins[1], '途中 参加'); btn($('dlg'), '追加する').click(); await wait(600);
        const ns = SV.adm.students.find(x => x.id === '999'); o.added = !!ns && SV.adm.teams[0].members.includes(ns.uid); await wait(700); o.slotRegistered = mk.db.slots.some(x => x.k === (ns || {}).uid && x.team_id === 't1' && x.name === '途中 参加'); o.doneDlg = $('dlg').innerText.includes('追加しました');
        o.nameOnlyInSlots = JSON.stringify(mk.db.calls.filter(c => c[0] === 'admin_roster_save')).includes('途中') && !JSON.stringify(mk.db.calls.filter(c => c[0] !== 'admin_roster_save')).includes('途中');
        closeModal(); await pullApply(true); const sNo = studentById(mk.db.students[1].uid); o.nickEmpty = sNo && sNo.nick === ''; startHouse(S.teams.find(x => x.id === 't1'), sNo); await wait(900); o.nickFix = $('dlg').innerText.includes('ニックネームを付け直してください');
      } catch (e) { o.err = String(e && e.stack || e); }
      document.body.dataset.test = JSON.stringify(o); return;
    }
    if (mode === 'svquick') {
      openQuickTeam();
      if (qq.get('go') === '1') {
        const d = $('dlg'), ins = d.querySelectorAll('input'); ins[0].value = 'あおぞら'; ins[1].value = '2468'; ins[2].value = '7'; ins[2].dispatchEvent(new Event('input'));
        [...d.querySelectorAll('button')].find(x => x.textContent === '作って始める').click(); await new Promise(r => setTimeout(r, 500));
        const T2 = mk.db.teams.find(t => t.name === 'あおぞら'); document.body.dataset.test = JSON.stringify({ team: T2 && { n: T2.n, confirmed: T2.confirmed, code: T2.mockCode }, calls: mk.db.calls.map(c => c[0]).join(','), done: $('dlg').innerText.slice(0, 60) }); return;
      }
    }
  }
  document.body.dataset.test = 'ok';
}
// ?test=sv : にせサーバー(tools/mock_sb.js)で、サーバー版の配線（me作成→入室→買う→置く→保存→他の人の変更→競合）を通す
// ?test=svplan : にせサーバーで間取りの配線（指でつまみをドラッグ→部屋を描く→確定→team_layout→反映→house_commit が通る）を確かめる
async function svPlanTest(mk) {
  const out = {}, wait = ms => new Promise(r => setTimeout(r, ms));
  try {
    window.__noPin = true; SV.sb = mk.sb; SV.on = true; S = store.defaultState(); noSave = true; screenCtx.loadDemo = null; screenCtx.houseThumb = houseThumb;
    await pullApply(true);
    const cr = await svCall('create_me', { p_team: 't1', p_nick: 'ひな', p_me: randomMe(), p_pin: '1234' }); setMyUid(cr.uid);
    mk.db.students[0].approved = true; mk.db.students[0].picos = 20000; mk.db.teams[0].picos = 500000; await pullApply(true);
    enterAs('t1', cr.uid); await wait(80);
    const ctl = openPlanScreen(), svg = document.querySelector('.plan-svg'), vbx = svg.getAttribute('viewBox').split(' ').map(Number);
    const fire = (type, x, y) => svg.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: 7, bubbles: true, isPrimary: true }));
    const px = () => { const r = svg.getBoundingClientRect(), vb = svg.getAttribute('viewBox').split(' ').map(Number), u = Math.min(r.width / vb[2], r.height / vb[3]); return { r, vb, u, X: gx => r.left + (r.width - vb[2] * u) / 2 + (gx - vb[0]) * u, Y: gz => r.top + (r.height - vb[3] * u) / 2 + (gz - vb[1]) * u }; };
    let g = px(); const h = svg.querySelector('[data-h="r"] circle').getBoundingClientRect();
    out.handlePx = Math.round(h.width);   // つまみの大きさ（32px以上）
    fire('pointerdown', h.left + h.width / 2, h.top + h.height / 2); fire('pointermove', g.X(8), g.Y(3)); fire('pointerup', g.X(8), g.Y(3));
    out.draftW = ctl.draft()[0].w; out.cost1 = ctl.state().cost; out.err1 = ctl.state().err;
    const add = [...document.querySelectorAll('.plan-side button')].find(b => b.textContent.includes('部屋をつくる')); add.click();
    g = px(); fire('pointerdown', g.X(8), g.Y(0)); fire('pointermove', g.X(14), g.Y(6)); fire('pointerup', g.X(14), g.Y(6));
    out.rooms = ctl.draft().length; out.cost2 = ctl.state().cost; out.err2 = ctl.state().err;
    const before = mk.db.teams[0].picos; await ctl.commit(); await wait(200);
    const st = mk.db.teams[0]; out.server = st.data.rooms.map(r => [r.x, r.z, r.w, r.d, r.k]); out.paid = before - st.picos; out.client = T.rooms.map(r => [r.x, r.z, r.w, r.d]); out.version = [T.version, st.version]; out.closed = document.getElementById('sheet').hidden;
    out.costOk = out.paid === out.cost2;
    startPlace('chair', 'inv'); me.inv.chair = 1; startPlace('chair', 'inv'); moveGhost(...project(new THREE.Vector3(2.5, 0, 2.5))); confirmGhost(); await wait(500);
    out.afterCommit = [T.version, mk.db.teams[0].version, mk.db.teams[0].data.rooms[0].items.length];   // 間取り変更のあとも house_commit が通る
    switchRoom(1); await wait(50); out.cur = S.cur.room; out.fx = [E.fxG.position.x, E.fxG.position.z];
  } catch (e) { out.error = String(e && e.stack || e); }
  document.body.dataset.test = JSON.stringify(out);
}
async function svTest(mk) {
  const out = {}, wait = ms => new Promise(r => setTimeout(r, ms));
  try {
    window.__noPin = true; SV.sb = mk.sb; SV.on = true; S = store.defaultState(); noSave = true; screenCtx.loadDemo = null; screenCtx.houseThumb = houseThumb;
    await pullApply(true);
    const cr = await svCall('create_me', { p_team: 't1', p_nick: 'ひな', p_me: randomMe(), p_pin: '1234' }); out.created = !!(cr && cr.ok); setMyUid(cr.uid);
    await pullApply(true); out.unapprovedShown = !!studentById(cr.uid) && studentById(cr.uid).approved === false;
    mk.db.students[0].approved = true; mk.db.students[0].picos = 20000; await pullApply(true);
    enterAs('t1', cr.uid); await wait(80); out.inHouse = !!T && !!me && me.uid === cr.uid; out.size = N();
    await buy('chair'); out.inv = me.inv.chair; out.picos = me.picos;
    startPlace('chair', 'inv'); moveGhost(...project(new THREE.Vector3(2.5, 0, 2.5))); confirmGhost(); await wait(500);
    out.placed = room().items.length; out.serverItems = mk.db.teams[0].data.rooms[0].items.length; out.version = [T.version, mk.db.teams[0].version]; out.owner = !!room().items[0] && room().items[0].owner === cr.uid; out.invAfter = JSON.stringify(me.inv);
    mk.db.teams[0].data.rooms[0].items[0].x = 0; mk.db.teams[0].version++; await pullApply(); out.remoteX = room().items[0].x;
    mk.db.teams[0].version += 5; T.rooms[0].name = 'へんこう'; save(); await wait(600);
    out.conflictToast = document.querySelector('#toasts').innerText.includes('同時'); out.roomNameAfterConflict = room().name;
    const bank0 = mk.db.teams[0].picos; mk.db.students[0].picos = 9000; await pullApply(true);
    const r = await svCall('donate', { p_uid: me.uid, p_pin: '', p_amount: 3000 }); out.donateErrWithoutPin = r && r.err;
    // きせかえ：買う（価格はサーバーの表）→ 持ち物に入る／もう一度は買えない／高すぎれば足りない
    mk.db.students[0].picos = 20000; await pullApply(true);
    const bw = await svCall('buy_wear', { p_uid: me.uid, p_pin: '1234', p_key: 'hat1' }); await pullApply(true);
    out.wearBuy = bw && bw.ok; out.wearOwned = JSON.stringify(studentById(me.uid).wear); out.wearAgain = (await svCall('buy_wear', { p_uid: me.uid, p_pin: '1234', p_key: 'hat1' })).err; out.wearPicos = studentById(me.uid).picos;
    // チーミのあいことば：サーバーで確かめる。覚えた端末は聞かれずに通る／まちがいは弾かれる／5回でロック
    mk.db.teams[0].has_code = true; mk.db.teams[0].mockCode = '4321'; await pullApply(true); const tt = S.teams[0];
    out.hasCode = tt.hasCode; setTeamCode('t1', '4321'); out.authRemembered = await teamAuth(tt);
    out.wrongPass = (await svCall('check_team_pass', { p_team: 't1', p_pass: '1111' })).err; for (let k = 0; k < 4; k++) await svCall('check_team_pass', { p_team: 't1', p_pass: '1111' });
    out.lockedAfter5 = (await svCall('check_team_pass', { p_team: 't1', p_pass: '4321' })).err; setTeamCode('t1', '');
    SV.adminPass = '0000'; out.staffSet = (await adminRpc('admin_set_staff', { p_uid: me.uid, p_staff: true })).ok; await pullApply(true); out.staffNick = nickOf(studentById(me.uid));
    // 担任助手の道具（にせサーバー）：番号を決める・担任助手me-・伝言板
    SV.adminPass = '0000'; adminOn = true;
    out.setPin = !!(await svCall('admin_set_pin', { p_admin: '0000', p_uid: cr.uid, p_pin: '5678' }) || {}).ok; out.pinWorks = !!(await svCall('check_pin', { p_uid: cr.uid, p_pin: '5678' }) || {}).ok;
    const ps = await svCall('admin_pin_status', { p_admin: '0000' }); out.pinStatus = ps && ps.ok && !!ps.status[cr.uid] && ps.status[cr.uid].pin;
    await svCall('admin_staff_save', { p_admin: '0000', p_id: 's1', p_nick: 'たなか', p_me: randomMe() }); await pullApply(true); out.staffMes = (S.staffMes || []).length;
    out.noteAdded = await addNote(T, 'がんばろう'); out.notesFromServer = (S.teams.find(x => x.id === 't1').notes || []).length;
    out.noteBadAdmin = ((await svCall('admin_note_add', { p_admin: '9999', p_team: 't1', p_by: 'x', p_body: 'いたずら' })) || {}).err;
    // 週間ミッション（にせサーバー）：全員そろうまで受け取れない → そろったら1回だけ受け取れる
    await adminRpc('admin_set_staff', { p_uid: cr.uid, p_staff: false }); adminOn = false;
    const c2 = await svCall('create_me', { p_team: 't1', p_nick: 'そら', p_me: randomMe(), p_pin: '1111' }); mk.db.students.forEach(s => { s.approved = true; });
    const td = todayStr(); await pullApply(true); enterAs('t1', cr.uid); await wait(50);
    out.msSave = !!(await svCall('admin_mission_save', { p_admin: '0000', p_id: 'wtest', p_title: 'テスト', p_starts: td, p_ends: td, p_need: 4, p_picos: 5000, p_item: 'trophy' }) || {}).ok;
    await svCall('admin_mission_counts', { p_admin: '0000', p_id: 'wtest', p_entries: { [cr.uid]: 4, [c2.uid]: 2 } }); await pullApply(true);
    const ms = () => (S.missions || []).find(x => x.id === 'wtest');
    out.msLoaded = !!ms(); out.msHalf = ms() && JSON.stringify(ms().teams.t1); out.msCanClaimHalf = canClaim(ms());
    out.msNotYet = ((await svCall('mission_claim', { p_uid: cr.uid, p_id: 'wtest' })) || {}).err;
    await svCall('admin_mission_counts', { p_admin: '0000', p_id: 'wtest', p_entries: { [c2.uid]: 5 } }); await pullApply(true);
    out.msAll = ms() && ms().teams.t1.achieved; out.msCanClaim = canClaim(ms()); out.msBtnNew = $('btnMission').classList.contains('new');
    const p0 = studentById(cr.uid).picos; await claimMission(ms(), () => { });
    out.msPicos = studentById(cr.uid).picos - p0; out.msTrophy = (studentById(cr.uid).inv || {}).trophy | 0; out.msClaimedAfter = canClaim(ms());
    out.msTwice = ((await svCall('mission_claim', { p_uid: cr.uid, p_id: 'wtest' })) || {}).err;
    // ひとりひとりのコマ数（あいことばで確かめて読む）・校舎のお知らせ・開始日
    mk.db.teams[0].has_code = false; const pg = await svCall('mission_progress', { p_id: 'wtest', p_team: 't1', p_pass: '' }); out.progMine = pg && pg.ok && pg.counts[cr.uid];
    mk.db.teams[0].has_code = true; mk.db.teams[0].mockCode = '4321'; out.progBadPass = ((await svCall('mission_progress', { p_id: 'wtest', p_team: 't1', p_pass: '0000' })) || {}).err; mk.db.teams[0].has_code = false;
    await svCall('admin_notice_save', { p_admin: '0000', p_id: null, p_kind: 'event', p_title: 'フェア', p_body: 'あるよ', p_date: '2026-12-12' }); await svCall('admin_set_start_date', { p_admin: '0000', p_date: '2026-12-02' }); await pullApply(true);
    out.noticesFromServer = (S.notices || []).map(n => n.kind + ':' + n.title + ':' + n.date).join(','); out.startDate = S.startDate;
    out.calls = mk.db.calls.map(c => c[0]).join(',');
  } catch (e) { out.err = String(e && e.stack || e); }
  document.body.dataset.test = JSON.stringify(out);
}
// ?test=svslotstu : にせサーバーで「自分の名前をえらんで me- を作る」生徒側の流れを通す
//   （名前えらび→承認済み／先に取られた名前／名前がない→承認まち／あいことばあり／もどる／古いサーバー／担任助手PCへの自動ひもづけ）
async function svSlotStuTest(mk) {
  const out = {}, wait = ms => new Promise(r => setTimeout(r, ms));
  const press = async str => { for (const c of str) { window.dispatchEvent(new KeyboardEvent('keydown', { key: c, bubbles: true, cancelable: true })); await wait(30); } await wait(300); };
  const dlgText = () => ($('modal').hidden ? '' : $('dlg').innerText);
  const dlgBtn = txt => [...$('dlg').querySelectorAll('button')].find(x => x.textContent.trim().startsWith(txt));
  const makeMe = async nick => { const n = document.querySelector('.mk-nick'); n.value = nick; n.dispatchEvent(new Event('input')); document.querySelector('.mk-foot .btn.coral').click(); await wait(150); await press('1234'); await press('1234'); await wait(400); };
  try {
    window.__noPin = true; SV.sb = mk.sb; SV.on = true; S = store.defaultState(); noSave = true; screenCtx.loadDemo = null; screenCtx.houseThumb = houseThumb; SV.adminPass = '0000'; setMyUid(null);
    mk.db.teams.push({ id: 't2', name: 'あおぞら', n: 3, members: [], confirmed: false, picos: 0, size0: 6, data: {}, version: 0 });
    await pullApply(true);
    const a = admLoad(); a.students = ['ヤマダタロウ', 'サトウハナコ', 'スズキイチロウ'].map((n, i) => ({ uid: 'k' + i, id: String(101 + i), name: n, link: null }));
    a.teams = [{ id: 't1', name: 'ひまわり', members: ['k0', 'k1'] }, { id: 't2', name: 'あおぞら', members: ['k2'] }]; SV.adm = a;
    const r0 = await slotsSync(a); out.sync0 = r0.ok && r0.linked === 0;
    out.slots = JSON.stringify(mk.db.slots.map(x => x.team_id + ':' + x.name));   // 確定している t1 の2人だけ（t2 は未確定なので枠なし）
    out.noNumbers = !JSON.stringify(mk.db.calls.filter(c => c[0] === 'admin_roster_save')).includes('101');
    mk.db.teams[0].has_code = true; mk.db.teams[0].mockCode = '4321'; setTeamCode('t1', '4321');
    // A) 名前をえらぶ → 確認 → 承認済みで家へ
    const stopPick = new URLSearchParams(location.search).get('stop') === 'pick';   // 画面確認用：長い名前も足して、名前えらびの画面で止める
    if (stopPick) ['イシヤマサクラコ', 'ホリウチユウ', 'タニモトユウマ', 'ハタモチコウイチロウ'].forEach((n, i) => mk.db.slots.push({ k: 'x' + i, team_id: 't1', name: n, uid: null }));
    createMe('t1'); await wait(200); await makeMe('ひな');
    if (stopPick) { document.body.dataset.test = 'pick'; return; }
    out.A_pick = dlgText(); out.A_names = out.A_pick.includes('ヤマダタロウ') && out.A_pick.includes('サトウハナコ') && !out.A_pick.includes('スズキイチロウ');
    dlgBtn('ヤマダタロウ').click(); await wait(200); out.A_confirm = dlgText(); dlgBtn('これです').click(); await wait(600);
    out.A_done = dlgText(); const s0 = mk.db.students[0]; out.A_approved = s0.approved && mk.db.slots[0].uid === s0.uid; out.A_noPend = !out.A_done.includes('承認まち');
    dlgBtn('家に入る').click(); await wait(300); out.A_in = !!T && !!me && me.uid === s0.uid;
    // 担任助手PCへ：選ばれた枠の持ち主が名簿の人にひもづく
    const r1 = await slotsSync(a); out.B_linked = r1.linked === 1 && a.students[0].link === s0.uid;
    // 2人目のとき、ヤマダは候補から消える。名前がない→承認まち
    leaveTeam(); await wait(100); setMyUid(null); createMe('t1'); await wait(200); await makeMe('そら');
    out.C_names = dlgText().includes('サトウハナコ') && !dlgText().includes('ヤマダタロウ');
    dlgBtn('名前がない').click(); await wait(600); const s1 = mk.db.students[1]; out.C_pending = !s1.approved && !mk.db.slots.some(x => x.uid === s1.uid);
    dlgBtn('家に入る').click(); await wait(300); leaveTeam();
    // D) 選ぶ前に ほかの人に取られた：エラーを出して、名前えらびをやりなおす
    setMyUid(null); createMe('t1'); await wait(200); await makeMe('ゆう');
    mk.db.slots.find(x => x.name === 'サトウハナコ').uid = 'someone';   // 開いている間に取られた
    dlgBtn('サトウハナコ').click(); await wait(200); dlgBtn('これです').click(); await wait(600);
    out.D_retry = dlgText().includes('承認まち') && !mk.db.students.at(-1).approved; out.D_toast = (document.querySelector('.toast') || {}).textContent;   // 残りの名前がなければ、そのまま承認まちで作られる
    dlgBtn('家に入る').click(); await wait(300); leaveTeam();
    // E) あいことばが違うと名前一覧は返らない
    setTeamCode('t1', ''); const bad = await svCall('team_slots', { p_team: 't1', p_pass: '0000' }); out.E_denied = !!bad && !bad.ok && !bad.slots;
    // F) 古いサーバー：名前えらびは飛ばして、従来どおり承認まち
    mk.db.legacy = true; const lg = await svCall('team_slots', { p_team: 't1', p_pass: '4321' }); out.F_legacy = lg === null || !(lg && lg.ok); mk.db.legacy = false;
    // G) まちがえて選んだ人：はずす → 承認まちにもどる、枠が空く
    const fr = await adminRpc('admin_slot_free', { p_k: 'k0', p_uid: s0.uid }); out.G_free = !!fr; await pullApply(true);
    out.G_state = !mk.db.students[0].approved && !mk.db.slots.some(x => x.uid === s0.uid);
    out.calls = mk.db.calls.map(c => c[0]).filter(n => /slot|roster/.test(n)).join(',');
  } catch (e) { out.err = String(e && e.stack || e); }
  document.body.dataset.test = JSON.stringify(out);
}
// ?test=1 : 自動操作の確認用（配置・選択）。結果を body[data-test] に書く
// 案内・おかえり・お祝いのテスト（保存先は localStorage の kojoHouse.* だけ。サーバーには何も送らない）
function guideTest(mode) {
  const out = {}, fin = () => { document.body.dataset.test = JSON.stringify(out); };
  try {
    window.__seenTest = true; setCoachSeen(false);
    makeDemo(); const st = studentById(S.teams[0].members[0]);
    if (mode === 'welcome') {
      const last = (S.lastScore || {})[st.uid] || 0;
      writeSeen(st.uid, { e: st.earned - 6000, sc: last - .3, st: null, rk: rankIdx(st.earned - 6000) });
      enterAs(S.teams[0].id, st.uid);
      setTimeout(() => {
        out.modal = !$('modal').hidden && !!$('dlg').querySelector('.wb'); out.rows = [...$('dlg').querySelectorAll('.wb-row')].map(r => r.textContent);
        out.title = $('dlg').querySelector('h3') && $('dlg').querySelector('h3').textContent;
        const s2 = readSeen(st.uid); out.saved = !!s2 && s2.e === st.earned;
        if (!out.modal || out.rows.length < 2) out.err = 'welcome';
        [...$('dlg').querySelectorAll('.btn')].find(b => b.textContent === '家へ').click();
        setTimeout(() => {
          out.coach = !!$('coach'); if (!out.coach) out.err = 'coach-after-welcome';
          [...$('coach').querySelectorAll('.btn')].find(b => b.textContent === 'スキップ').click(); out.seen = coachSeen(); if (!out.seen) out.err = 'coachSeen';
          // 増えていなければ出ない
          leaveTeam(); setCoachSeen(true); enterAs(S.teams[0].id, st.uid);
          setTimeout(() => { out.noRepeat = $('modal').hidden; if (!out.noRepeat) out.err = 'repeat'; fin(); }, 1500);
        }, 1500);
      }, 2500);
    } else if (mode === 'coach') {
      enterAs(S.teams[0].id, st.uid);
      setTimeout(() => {
        out.coach = !!$('coach'); const steps = [];
        for (let k = 0; k < 6 && $('coach'); k++) { steps.push($('coach').querySelector('.coach-t').textContent); const b = [...$('coach').querySelectorAll('.btn')].find(x => x.textContent === '次へ' || x.textContent === 'はじめる'); b.click(); }
        out.steps = steps; out.closed = !$('coach'); out.seen = coachSeen();
        if (steps.length !== 4 || !out.closed || !out.seen) out.err = 'coach';
        settingsDlg(); const re = [...$('dlg').querySelectorAll('.btn')].find(b => b.textContent === 'もう一度見る'); out.again = !!re;
        if (!re) out.err = 'again'; else { re.click(); setTimeout(() => { out.reopen = !!$('coach'); if (!out.reopen) out.err = 'reopen'; fin(); }, 600); }
      }, 1500);
    } else {
      enterAs(S.teams[0].id, st.uid);
      setTimeout(() => {
        me.earned = 99999999; renderHud(); out.cele = !!$('cele'); out.items = $('cele') ? $('cele').querySelectorAll('.cele-it').length : 0; out.t = $('cele') && $('cele').querySelector('.cele-t').textContent;
        if (!out.cele || !out.items) out.err = 'cele'; fin();
      }, 1200);
    }
  } catch (e) { out.err = String(e && e.message || e); fin(); }
}
// ===== 確認用（特別ピコ・QRプレゼント・ミッションの帯ボタン）：?test=evadm / giftadm / gift / mstab =====
const tick = ms => new Promise(r => setTimeout(r, ms || 0));
const okDlg = async () => { await tick(30); const b = document.querySelector('#dlg .acts .btn.coral'); if (b) b.click(); await tick(60); };
async function newTest(mode) {
  const q = new URLSearchParams(location.search);
  // ?test=evadm&bank=1 : 「特別ピコ」（2人えらんで配る→残高・履歴→元に戻す）。shot=1 は配る前の画面
  if (mode === 'evadm') {
    makeDemo(); renderSelect(); adminPreset({ tab: 'event' }); openAdmin(); const out = {}, t0 = S.teams[0], u0 = t0.members[0], u1 = t0.members[1];
    if (q.get('bank')) { document.querySelectorAll('.ev-mode')[1].click(); await tick(); }
    if (q.get('shot') === '1') { if (!q.get('bank')) document.querySelectorAll('.ev-team')[0].querySelector('.ev-th input').click(); return 'ok'; }
    const p0 = studentById(u0).picos, e0 = studentById(u0).earned, b0 = t0.picos;
    if (q.get('bank')) document.querySelector('.ev-teams .ev-chip input').click();
    else { const ins = document.querySelectorAll('.ev-team')[0].querySelectorAll('.ev-chip input'); ins[0].click(); ins[1].click(); }
    document.querySelector('.ev-foot .btn.coral').click(); await okDlg();
    out.gotPicos = studentById(u0).picos - p0; out.gotEarned = studentById(u0).earned - e0; out.bank = t0.picos - b0;
    out.log = (S.scoreLog[0] || {}).kind; out.rows = document.querySelectorAll('.logrow').length;
    const ub = [...document.querySelectorAll('.adm-pane .btn')].find(b => b.textContent.includes('直前の特別ピコ')); if (ub) { ub.click(); await okDlg(); }
    out.afterUndo = studentById(u0).picos - p0; out.bankAfterUndo = t0.picos - b0;
    return JSON.stringify(out);
  }
  // ?test=giftadm&once=1&big=1 : 「QRプレゼント」（発行→一覧）。each は大きなQRが出たまま
  if (mode === 'giftadm') {
    makeDemo(); renderSelect(); adminPreset({ tab: 'gift', dryPrint: true }); openAdmin(); await tick(30);
    if (q.get('once')) { document.querySelectorAll('.ev-mode')[1].click(); await tick(10); }
    if (q.get('pico')) { document.querySelector('.gf-pico').click(); await tick(10); }
    // gacha=1：ガチャセット（既定の表 100×120・500×40・トロフィー×5・はずれ×35＝200枚）を発行して、カプセル用の紙を作る
    if (q.get('gacha')) {
      document.querySelectorAll('.ev-mode')[2].click(); await tick(10);
      const out = { rows: document.querySelectorAll('.gc-tbl tr').length - 1 };
      if (q.get('make') === '0') return JSON.stringify(out);
      [...document.querySelectorAll('.adm-pane .btn.coral')].find(b => b.textContent.includes('ガチャ')).click(); await tick(30);
      document.querySelector('#dlg .acts .btn.coral').click(); await tick(150);
      const G = S.gifts || [];
      Object.assign(out, { gifts: G.length, sets: new Set(G.map(g => g.set)).size, p100: G.filter(g => g.picos === 100).length, p500: G.filter(g => g.picos === 500).length, troph: G.filter(g => g.item === 'ltd_trophy').length, fish: G.filter(g => g.item === 'ltd_fish').length, caps: document.querySelectorAll('#cardPrint .gc-cell').length, pages: document.querySelectorAll('#cardPrint .gc-page').length, noContent: !document.querySelector('#cardPrint').textContent.includes('ピコ'), setRow: document.querySelectorAll('.gf-set').length, chips: document.querySelectorAll('.gf-set .gf-chip').length });
      return JSON.stringify(out);
    }
    if (q.get('make') !== '0') { const btn = [...document.querySelectorAll('.adm-pane .btn.coral')].find(b => b.textContent.includes('発行')); btn.click(); await tick(80); }
    const out = { gifts: (S.gifts || []).length, picos: (S.gifts || []).map(g => g.picos | 0)[0], rows: document.querySelectorAll('.gf-row').length, bigQr: !!document.querySelector('.gf-big-qr svg'), print: document.querySelectorAll('#cardPrint .gp-card').length };
    if (q.get('big') !== '1') closeModal();
    return JSON.stringify(out);
  }
  // ?test=gift : 生徒がQRプレゼントを受け取る（端末だけ）。2回目は「受け取りずみ」。shot=1 は受け取り画面を出したまま
  if (mode === 'gift') {
    makeDemo(); const t0 = S.teams[0], u0 = t0.members[0]; window.__noPin = true;
    const pz = +q.get('pico') || 0;
    S.gifts = [{ code: 'AB23CD45', item: pz ? '' : q.get('item') || 'ltd_trophy', picos: pz, earned: true, kind: 'each', note: '英語ワークショップ', uses: 0, expires: null, active: true, at: Date.now(), claims: [] }];
    setPendingGift('AB23CD45'); enterAs(t0.id, u0); await tick(1300);
    const out = { dlg: !!document.querySelector('.gift-dlg'), name: (document.querySelector('.gift-name') || {}).textContent };
    if (q.get('shot') === '1') return JSON.stringify(out);
    const p0 = me.picos, e0 = me.earned || 0;
    document.querySelector('#dlg .acts .btn.coral').click(); await tick(80);
    if (pz) { out.gotPicos = me.picos - p0; out.gotEarned = (me.earned || 0) - e0; out.win = !!document.querySelector('.pico-win'); }
    out.inv = me.inv[S.gifts[0].item] | 0; out.pending = pendingGift(); out.tab = tab; out.ltdTile = [...document.querySelectorAll('#tabBody .tile-sz')].some(e => e.textContent.includes('非売品'));
    out.again = (await giftRedeem('AB23CD45', '')).err;
    S.gifts[0].active = false; out.stopped = (await giftPeek('AB23CD45')).err;
    return JSON.stringify(out);
  }
  // ?test=pinsadm&forgot=1 : 担任助手「番号を忘れたとき」（端末だけ）。forgot=1 で「番号を忘れた」の選択画面
  if (mode === 'pinsadm') {
    makeDemo(); S.students.forEach((s, i) => { if (i % 4) s.pin = pinHash('1234', s.uid); else delete s.pin; }); renderSelect(); adminPreset({ tab: 'pins' }); openAdmin(); await tick(30);
    if (q.get('forgot')) { const b = [...document.querySelectorAll('#sheet button')].find(x => x.textContent === '番号を忘れた'); if (b) b.click(); }
    return JSON.stringify({ forgotBtns: [...document.querySelectorAll('#sheet button')].filter(x => x.textContent === '番号を忘れた').length, setBtns: [...document.querySelectorAll('#sheet button')].filter(x => x.textContent === '番号を決める').length, choice: document.querySelectorAll('.pin-forgot .ev-mode').length });
  }
  // ?test=poster&kind=team|person|house&name=real|nick|both&shot=1 : 担任助手「掲示」（印刷プレビュー）。1人を未登録・1人を担任助手にして確かめる
  if (mode === 'poster') {
    makeDemo(); const s0 = S.students[0], s1 = S.students[1]; s1.staff = true; const unreg = S.students[2]; const nm0 = unreg.name; unreg.name = '';
    renderSelect(); adminPreset({ tab: 'poster', dryPrint: true }); openAdmin(); await tick(30);
    const kind = q.get('kind') || 'team', ki = { team: 0, person: 1, house: 2 }[kind]; document.querySelectorAll('.adm-pane .ev-mode')[ki].click(); await tick(10);
    const nmi = { real: 0, nick: 1, both: 2 }[q.get('name') || 'real']; [...document.querySelectorAll('.ps-names .btn')][nmi].click(); await tick(10);
    [...document.querySelectorAll('.adm-pane .btn.coral')].find(b => b.textContent.includes('プレビュー')).click(); await tick(kind === 'house' ? 3000 : 60);
    const pv = document.querySelector('.ps-prev'), txt = pv ? pv.textContent : '';
    const out = { pages: document.querySelectorAll('.ps-prev .ps-page').length, rows: document.querySelectorAll('.ps-prev .ps-tbl tr').length, imgs: [...document.querySelectorAll('.ps-prev img')].filter(i => i.src.length > 1000).length, staffShown: kind === 'person' && txt.includes(s1.name), hasReal: txt.includes(s0.name), hasNick: !!s0.nick && txt.includes(s0.nick), unregNote: txt.includes('未登録'), date: txt.includes('時点') };
    if (q.get('shot') !== '1') { document.querySelector('#dlg .acts .btn.coral').click(); await tick(30); out.printPages = document.querySelectorAll('#cardPrint .ps-page').length; }
    unreg.name = nm0; return JSON.stringify(out);
  }
  // ?test=rosterblk : 担任助手「名簿」に、校舎の「チーミ一覧」形式（ブロック）を貼った状態（名前は架空）
  if (mode === 'rosterblk') {
    makeDemo({ noScore: true }); S.students = []; S.teams = []; renderSelect();
    const txt = ['チーム名	種別	チーム担任助手	人数	生徒番号	学年	氏名	かな', '							', 'あおぞら新高2①	低学年	石井	2名				', '				101	高1	山田太郎	ヤマダタロウ', '				102	新高2	佐藤花子	サトウハナコ', '							', 'ひまわり新高2①	低学年	内海	3名				', '				103	高1	鈴木一郎	スズキイチロウ', '				104	高1	高橋美咲	タカハシミサキ'].join('\n');
    adminPreset({ tab: 'roster', rosterText: txt }); openAdmin(); await tick(30);
    if (q.get('go')) { const b = [...document.querySelectorAll('#sheet button')].find(x => x.textContent.startsWith('追加')); if (b) b.click(); await tick(60); }
    return JSON.stringify({ teams: document.querySelectorAll('.team-row').length, students: S.students.length, teamsMade: S.teams.length, plan: S.teams.map(t => t.plan | 0) });
  }
  // ?test=basesc : 向上得点「基準として記録」→ ピコは入らず前回値だけ → そのあと「累計」は増えた分だけ（端末だけ）
  if (mode === 'basesc') {
    makeDemo({ noScore: true }); S.lastScore = {}; const s0 = S.students[0], s1 = S.students[1], p0 = s0.picos, p1 = s1.picos; renderSelect();
    const clickApply = async () => { const b = [...document.querySelectorAll('#sheet .prev .btn.coral')][0]; if (b) b.click(); for (let i = 0; i < 3; i++) { await tick(40); const ok = document.querySelector('#dlg .acts .btn.coral'); if (ok && !$('modal').hidden) ok.click(); } await tick(60); };
    adminPreset({ tab: 'score', scoreMode: 'base', scoreText: s0.name + '\t30\n' + s1.name + '\t12' }); openAdmin(); await tick(30);
    const out = { baseWarn: !!document.querySelector('#sheet .prev .warnbox'), btn: (document.querySelector('#sheet .prev .btn.coral') || {}).textContent };
    await clickApply();
    out.afterBase = { last0: S.lastScore[s0.uid], picos0: s0.picos - p0, log: (S.scoreLog[0] || {}).mode, label: !!document.querySelector('.lastimp .tag') };
    adminPreset({ tab: 'score', scoreMode: 'cum', scoreText: s0.name + '\t31\n' + s1.name + '\t12\n' + S.students[2].name + '\t4' }); openAdmin(); await tick(30);
    out.noBaseWarn = ((document.querySelector('#sheet .prev .warnbox b') || {}).textContent || '');
    await clickApply();
    out.afterCum = { picos0: s0.picos - p0, picos1: s1.picos - p1 };
    return JSON.stringify(out);
  }
  // ?test=itemgrid&ids=a,b : アイテムの絵を大きく並べる（確認用）
  if (mode === 'itemgrid') {
    document.body.innerHTML = ''; document.body.style.cssText = 'background:#efe6d6;margin:0;display:flex;flex-wrap:wrap;gap:8px;padding:8px;font:14px sans-serif';
    (q.get('ids') || '').split(',').filter(id => ITEM[id]).forEach(id => { const im = new Image(); im.width = 180; im.height = 180; itemIcon(ITEM[id], im); document.body.appendChild(h('div', { style: 'background:#fffaf0;border-radius:8px;padding:6px;text-align:center' }, [im, h('div', { text: ITEM[id].name })])); });
    await tick(1500); return 'ok';
  }
  // ?test=mstab&open=0 : パネルの「ミッション」帯ボタン → パネルにミッション（チーミの達成状況）
  if (mode === 'mstab') {
    makeDemo(); const t0 = S.teams[0], m = S.missions[0], td = todayStr(); m.start = td; m.end = td; enterAs(t0.id, t0.members[0]);
    const out = { shown: !$('msTab').hidden, text: $('msTab').textContent, tabs: $('tabs').children.length };
    if (q.get('open') !== '0') { $('msTab').click(); out.panel = !!$('tabBody').querySelector('.ms-card'); out.chips = $('tabBody').querySelectorAll('.ms-chip').length; out.on = $('msTab').classList.contains('on'); }
    return JSON.stringify(out);
  }
  return null;
}
function runTest(mode) {
  const out = {};
  try {
    if (['evadm', 'giftadm', 'gift', 'mstab', 'itemgrid', 'pinsadm', 'rosterblk', 'basesc', 'poster'].includes(mode)) { newTest(mode).then(v => { document.body.dataset.test = v || 'none'; }).catch(e => { document.body.dataset.test = 'ERR ' + e.message; console.error(e); }); return; }
    if (mode === 'flow') { import('../tools/flow_test.js').then(m => m.run({ get S() { return S; }, makeDemo, renderSelect, pinHash, $ })); return; }
    if (['svmembers', 'svsel', 'svdone', 'svlink', 'svhome', 'svscore', 'svquick', 'svops', 'svops2', 'svdaily', 'svupd', 'svnotice'].includes(mode)) { import('../tools/mock_sb.js').then(m => svView(m.makeMock(), mode)); return; }
    if (mode === 'sv') { import('../tools/mock_sb.js').then(m => svTest(m.makeMock())); return; }
    if (mode === 'svslotstu') { import('../tools/mock_sb.js').then(m => svSlotStuTest(m.makeMock())); return; }
    if (mode === 'svplan') { import('../tools/mock_sb.js').then(m => svPlanTest(m.makeMock())); return; }
    const v = runDemoView(mode); if (v) { document.body.dataset.test = v; return; }
    if (mode === 'welcome' || mode === 'coach' || mode === 'celebrate') { guideTest(mode); return; }
    makeDemo(); enterAs(S.teams[0].id, S.teams[0].members[0]);
    sync();
    const rm = room(); out.items0 = rm.items.length;
    if (mode === '2') { me.inv.sofa1 = 1; startPlace('sofa1', 'inv'); ghost.x = 1; ghost.y = 1; evalGhost(); out.ghostOk = ghost.ok; out.why = ghost.why; $('bar') && 0; document.body.dataset.test = JSON.stringify(out); return; }
    if (mode === '3') { me.inv.frame = 1; startPlace('frame', 'inv'); moveGhost(...project(new THREE.Vector3(0, 2, 2.0))); out.wall = ghost.wall; out.pos = ghost.pos; out.z = ghost.z; out.ok = ghost.ok; document.body.dataset.test = JSON.stringify(out); return; }
    if (mode === '10' || mode === '11') {
      sq(rm, T.size0 || CFG.MIN_SIZE); rm.items = [inst('rug1', 2, 2, 0), inst('bed1', 0, 0, 1), inst('desk', 3, 0, 0), inst('chair', 3, 1, 0), inst('shelf1', 0, 5, 0), inst('plantL', 5, 5, 0), inst('laptop', 3, 0, 0), inst('lamp', 4, 0, 0), inst('sofa1', 2, 4, 0), inst('lowtable', 2, 3, 0), inst('cactus', 0, 5, 0), inst('mug', 2, 3, 0), winst('window', 'L', 2, 1.2), winst('wclock', 'R', 0.5, 2.3), winst('poster', 'R', 4, 1.6)];
      if (mode === '11') sq(rm, Math.min(14, rm.w + 4));   // （旧：増築の再配置。いまは間取り画面で広げる）
      placeAvatars(); rebuildRoom(); sync(); out.items = rm.items.map(i => i.id + '@' + (i.wall ? i.wall + i.pos : i.x + ',' + i.y)); document.body.dataset.test = JSON.stringify(out); return;
    }
    if (mode === '7') { rm.items = []; cam.zoom = 3.6; cam.pany = Number(new URLSearchParams(location.search).get('py') || 0); cam.panx = 0; rebuildRoom(); sync(); document.body.dataset.test = 'ok'; return; }
    if (mode === '8' || mode === '9') {
      sq(rm, mode === '8' ? 14 : (T.size0 || CFG.MIN_SIZE)); rm.items = []; rm.floor = 'fl_birch'; rm.wall = 'wp_gingham'; T.own.floor.push('fl_birch'); T.own.wallpaper.push('wp_gingham');
      const NEW = ITEMS.filter(d => !d.pat && !d.wall && d.cat !== 'rug' && !d.small && !d.ceil && ['bunk', 'loft', 'armchair', 'beanbag', 'dtable', 'dchair', 'rtable', 'counter', 'rack', 'dresser', 'bench', 'stool', 'cubeshelf', 'hammock', 'chabudai', 'speaker', 'heater', 'washer', 'robovac', 'aquarium', 'shelf1', 'tansu', 'sofa1'].includes(d.id));
      let x = 0, y = 0, rowH = 0; const n = N(), tops = [];
      NEW.forEach(d => { const w = d.w, dd = d.d; if (x + w > n) { x = 0; y += rowH + 0; rowH = 0; } if (y + dd > n) return; rm.items.push(inst(d.id, x, y, 0)); if (d.surface) tops.push([x, y]); x += w; rowH = Math.max(rowH, dd); });
      const sm = ['cactus', 'flowerpot', 'hourglass', 'penstand', 'mug', 'catplush', 'boardgame', 'omamori', 'microwave', 'humid'];
      tops.forEach((t, i) => { const d = ITEM[sm[i % sm.length]]; rm.items.push(inst(d.id, t[0], t[1], 0)); });
      if (mode === '9') { rm.items = [inst('shelf2', 1, 1, 0), inst('tansu', 4, 1, 0), inst('dresser', 3, 1, 0), inst('cactus', 1, 1, 0), inst('catplush', 2, 1, 0), inst('flowerpot', 4, 1, 0), inst('mug', 3, 1, 0), inst('rug5', 1, 3, 0), inst('armchair', 4, 4, 0), inst('beanbag', 1, 4, 0)]; [['neon', 'R', 3.2, 2.0], ['timetable', 'L', 1.5, 1.6], ['catcher', 'L', 3.5, 1.3]].forEach(([id, w, p, z]) => rm.items.push(winst(id, w, p, z))); }
      rebuildRoom(); sync(); out.n = rm.items.length; document.body.dataset.test = JSON.stringify(out); return;
    }
    if (mode === '6') {
      sq(rm, Math.min(14, (T.size0 || CFG.MIN_SIZE) + 4)); rm.items = []; rm.floor = 'fl_herring'; rm.wall = 'wp_wainscot'; T.own.floor.push('fl_herring'); T.own.wallpaper.push('wp_wainscot');
      const L = [['fireplace', 2, 0], ['cabinet', 5, 0], ['tvboard', 0, 3, 1], ['sofa2', 3, 4], ['pendant', 3, 3], ['globelight', 4, 5], ['floorlamp', 7, 1], ['rug4', 3, 3], ['kotatsu', 5, 6], ['piano', 0, 6, 1], ['vase', 5, 6], ['teaset', 6, 6], ['pie', 5, 7], ['guitar', 7, 4]];
      L.forEach(([id, x, y, r]) => rm.items.push(inst(id, x, y, r || 0)));
      [['frame', 'R', 5.5, 1.6], ['frame2', 'R', 7, 1.6], ['garland', 'L', 3, 2.6], ['sconce', 'L', 6, 1.8], ['aircon', 'R', 0.5, 2.6]].forEach(([id, w, p, z]) => rm.items.push(winst(id, w, p, z)));
      out.empty = ITEMS.filter(d => !d.pat).filter(d => { try { return !renderThumb(d); } catch (e) { out.terr = d.id + ':' + e.message; return true; } }).map(d => d.id);
      rebuildRoom(); sync(); out.n = rm.items.length; out.lights = lightList.length; document.body.dataset.test = JSON.stringify(out); return;
    }
    me.inv.sofa1 = 1; me.inv.vase = 1; startPlace('sofa1', 'inv');
    const p = project(new THREE.Vector3(2.0, 0, 2.5)); moveGhost(p[0], p[1]); out.gx = ghost.x; out.gy = ghost.y; out.gok = ghost.ok; confirmGhost();
    out.items1 = rm.items.length; sync();
    if (mode === '5') { setSel(rm.items[rm.items.length - 1].uid); document.body.dataset.test = JSON.stringify(out); return; }
    const bed = rm.items.find(i => i.id === 'bed1'), bc = project(new THREE.Vector3(1, .4, 1));
    tap(bc[0], bc[1], 'touch'); out.selId = selItem() && selItem().id;
    const sofa = rm.items[rm.items.length - 1]; const sc = project(new THREE.Vector3(sofa.x + 1, .4, sofa.y + .5)); tap(sc[0], sc[1], 'touch'); out.selId2 = selItem() && selItem().id;
    const f = project(new THREE.Vector3(1.5, 0, 3.5)); tap(f[0], f[1], 'touch'); out.sel3 = selUid; out.walk = AVS.length;
  } catch (e) { out.err = String(e && e.stack || e); }
  document.body.dataset.test = JSON.stringify(out);
}
boot();
