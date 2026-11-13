// 保存層：localStorage に読み書きするだけの薄い層。あとでサーバーに替えるときはこのファイルだけ差し替える。
//   load() -> 状態S / save(S) / exportJSON(S) -> 文字列 / importJSON(text) -> 状態S（不正なら例外）
import { CFG, ITEM, baseSize, migrateRooms, layoutCheck, edgesOf, pairKey } from './data.js?v=202611131634';
import { cleanMe, cleanNick, newUid, cleanWear } from './me.js?v=202611131634';
import { cleanMission, cleanNotices } from './mission.js?v=202611131634';

export const KEY = 'kojoHouse.v2', OLD_KEY = 'kojoHouse.v1';   // キーは据え置き（中身のバージョンは S.v）
export const DEFAULT_RATE = 10000, DEFAULT_MUL = 10, VERSION = 3;

// 部屋 = 家の中の位置(x,z)と大きさ(w,d)つき。家具の座標は部屋の中のローカル座標
export function newRoom(name, w, d, x, z) { w = w || CFG.MIN_SIZE; d = d || w; return { name, x: x | 0, z: z | 0, w, d, wall: 'wp_cream', floor: 'fl_wood', items: [], av: { x: 1, y: Math.min(3, d - 1) } }; }
// 家：部屋・買った壁紙/床（家で共有）。持ち物(inv)は生徒ごと。
export function newHouse(size0) { return { rooms: [newRoom(CFG.ROOM_NAMES[0], size0 || CFG.MIN_SIZE)], open: [], own: { wallpaper: ['wp_cream'], floor: ['fl_wood'] } }; }
// picos = チーミ貯金箱（増築・部屋追加の費用）。size0 = 初期の一辺（確定時に人数で決める）
// チーミのあいことば（4けた）：チーミを選んだあとに入れる。メンバーだけが知っている
export const teamCode = () => String(Math.floor(Math.random() * 10000)).padStart(4, '0');
export function newTeam(id, name) { return Object.assign({ id, name, code: teamCode(), members: [], confirmed: false, picos: 0, size0: CFG.MIN_SIZE, total: 0, history: [], contrib: {} }, newHouse()); }
// uid = 内部ID（ランダム。家具のowner・チーミのmembers・ログはこれで参照）／ id = 名簿の番号（照合用・担任助手だけが見る）／ name = 本名（担任助手だけが見る）／ nick = 生徒側に出る名前
export function newStudent(id, name, uid) { return { uid: uid || newUid(), id: String(id), name: String(name), nick: '', earned: 0, picos: 0, inv: {} }; }
export function nextTeamId(S) { let id; do { id = 't' + (S.seq = (S.seq | 0) + 1); } while (S.teams.some(t => t.id === id)); return id; }
export function defaultState() {
  return { v: VERSION, settings: { rate: DEFAULT_RATE, passcode: '0000', priceMul: DEFAULT_MUL, stayRate: CFG.STAY_RATE }, students: [], teams: [], scoreLog: [], lastScore: {}, lastStay: {}, cur: { teamId: null, room: 0, studentId: null }, sound: true, uid: 1, seq: 0, staffMes: [], missions: [], notices: [], startDate: '', gifts: [] };
}
// 担任助手のme-（家を見に行くときの姿）と、家の伝言板（担任助手だけが書く）
export const cleanStaffMes = a => (Array.isArray(a) ? a : []).filter(p => p && /^[A-Za-z0-9_-]{1,20}$/.test(p.id)).slice(0, 30).map(p => { const r = { id: p.id, nick: cleanNick(p.nick) || '担任助手' }; const m = cleanMe(p.me); if (m) r.me = m; return r; });
export const cleanNotes = a => (Array.isArray(a) ? a : []).filter(n => n && typeof n.text === 'string' && n.text.trim()).slice(-100).map(n => ({ id: String(n.id || Date.now()), at: +n.at || 0, by: String(n.by || '担任助手').slice(0, 8), text: n.text.trim().slice(0, 200) }));

const num = (v, d) => (isFinite(+v) && v !== null && v !== '' ? +v : d);
const nn = v => Math.max(0, Math.floor(num(v, 0)));
const evenSize = v => { v = Math.floor(num(v, CFG.MIN_SIZE)); if (v % 2) v++; return Math.max(CFG.MIN_SIZE, Math.min(CFG.MAX_SIZE, v)); };
function cleanInv(o) { const inv = {}; for (const k in (o || {})) if (ITEM[k] && o[k] > 0) inv[k] = Math.floor(o[k]); return inv; }
function cleanHouse(o, S, size0, U) {
  const h = { rooms: [], open: [], own: { wallpaper: ['wp_cream'], floor: ['fl_wood'] } };
  ['wallpaper', 'floor'].forEach(k => { const a = o.own && o.own[k]; if (Array.isArray(a)) a.forEach(id => ITEM[id] && ITEM[id].cat === k && !h.own[k].includes(id) && h.own[k].push(id)); });
  const sz = v => Math.max(CFG.MIN_RW, Math.min(CFG.MAX_RW, Math.floor(num(v, CFG.MIN_SIZE))));
  migrateRooms(o.rooms, size0).slice(0, CFG.MAX_ROOMS).forEach(r => {
    const rm = newRoom(String(r.name || '部屋').slice(0, 8), sz(r.w), sz(r.d), Math.max(0, Math.floor(num(r.x, 0))), Math.max(0, Math.floor(num(r.z, 0))));
    rm.wall = ITEM[r.wall] && ITEM[r.wall].cat === 'wallpaper' ? r.wall : 'wp_cream';
    rm.floor = ITEM[r.floor] && ITEM[r.floor].cat === 'floor' ? r.floor : 'fl_wood';
    if (r.av) rm.av = { x: r.av.x | 0, y: r.av.y | 0 };
    if (r.dark) rm.dark = true;   // 電気を消している部屋
    (r.items || []).forEach(i => { if (ITEM[i.id]) { const c = Object.assign({}, i); c.uid = c.uid | 0 || S.uid++; S.uid = Math.max(S.uid, c.uid + 1); if (c.owner != null && U(c.owner)) c.owner = U(c.owner); else delete c.owner; rm.items.push(c); } });
    h.rooms.push(rm);
  });
  if (!h.rooms.length) h.rooms.push(newRoom(CFG.ROOM_NAMES[0], size0));
  // 位置が壊れていたら（重なり・つながっていない）、横一列に並べなおす
  if (['overlap', 'conn', 'size'].includes(layoutCheck(h.rooms))) { let ox = 0; h.rooms.forEach(r => { r.x = ox; r.z = 0; ox += r.w; }); }
  const keys = new Set(edgesOf(h.rooms).map(e => pairKey(e.i, e.j)));
  (Array.isArray(o.open) ? o.open : []).forEach(k => { if (typeof k === 'string' && keys.has(k) && !h.open.includes(k)) h.open.push(k); });
  return h;
}

export function sanitize(o) {
  const S = defaultState();
  if (!o || typeof o !== 'object') return S;
  if (o.v !== 2 && o.v !== 3) return migrateV1(o);   // 旧セーブ → 「お試しチーミ」
  const old = o.v === 2;                              // v2 = チーミ単位の財布 → 個人の財布へ移行
  const st = o.settings || {};
  S.settings = { rate: Math.max(1, num(st.rate, DEFAULT_RATE)), passcode: /^\d{4}$/.test(st.passcode) || /^[ -~]{8,64}$/.test(st.passcode) ? st.passcode : '0000', priceMul: Math.max(.01, num(st.priceMul, DEFAULT_MUL)), stayRate: Math.max(1, num(st.stayRate, CFG.STAY_RATE)) };
  S.sound = o.sound !== false; S.seq = o.seq | 0; S.uid = Math.max(1, o.uid | 0);
  const rawSt = (Array.isArray(o.students) ? o.students : []).filter(s => s && s.id != null && s.name), usedU = new Set(), byId = new Map(), byU = new Map();
  rawSt.forEach(s => { if (typeof s.uid === 'string' && /^[a-z0-9]{6,12}$/.test(s.uid) && !usedU.has(s.uid)) { usedU.add(s.uid); s._u = s.uid; } });
  rawSt.forEach(s => { if (!s._u) s._u = newUid(usedU); byId.set(String(s.id), s._u); byU.set(s._u, s._u); });
  const U = x => x == null ? null : (byU.has(String(x)) ? String(x) : byId.get(String(x)) || null);   // uid でも 名簿の番号でも uid に直す
  S.students = rawSt.map(s => {
    const r = newStudent(s.id, s.name, s._u); r.nick = cleanNick(s.nick); r.earned = nn(s.earned); r.picos = nn(s.picos); r.inv = cleanInv(s.inv);
    if (s.kana) r.kana = String(s.kana); if (s.grade) r.grade = String(s.grade);
    const me = cleanMe(s.me); if (me) r.me = me;
    const wear = cleanWear(s.wear); if (wear.length) r.wear = wear;   // 買ったきせかえ
    if (s.staff) r.staff = true;   // 担任助手（名前の前に★）
    if (typeof s.pin === 'string' && /^[0-9a-f]{16}$/.test(s.pin)) r.pin = s.pin;
    return r;
  });
  const sids = new Map(S.students.map(s => [s.uid, s])), used = new Set();
  S.teams = (Array.isArray(o.teams) ? o.teams : []).filter(t => t && t.id != null).map(t => {
    const size0 = old ? CFG.MIN_SIZE : evenSize(t.size0);
    const T = Object.assign(newTeam(String(t.id), String(t.name || 'チーミ').slice(0, 12)), cleanHouse(t, S, size0, U));
    T.size0 = size0;
    T.code = /^\d{4}$/.test(t.code) ? t.code : teamCode();   // 古いセーブには無いので新しく作る（担任助手モードで確認・変更できる）
    T.members = (Array.isArray(t.members) ? t.members : []).map(U).filter(id => id && sids.has(id) && !used.has(id) && used.add(id));
    T.confirmed = !!t.confirmed; T.picos = nn(t.picos); T.total = nn(t.total);
    T.history = Array.isArray(t.history) ? t.history.slice(0, 300) : []; T.contrib = {};
    const notes = cleanNotes(t.notes); if (notes.length) T.notes = notes;
    for (const k in (t.contrib || {})) if (+t.contrib[k] > 0 && U(k)) T.contrib[U(k)] = Math.floor(t.contrib[k]);
    const linv = cleanInv(t.inv); if (Object.keys(linv).length) T.inv = linv;   // 旧：チーミの持ち物
    if (old && T.members.length) {   // 旧チーミ財布をメンバーで等分（あまりは先頭から1ずつ）、持ち物は順に配る、貯金箱は0
      const n = T.members.length, base = Math.floor(T.picos / n), rem = T.picos - base * n;
      T.members.forEach((id, i) => { sids.get(id).picos += base + (i < rem ? 1 : 0); });
      T.picos = 0; let k = 0;
      for (const id in linv) for (let c = 0; c < linv[id]; c++) { const s = sids.get(T.members[k++ % n]); s.inv[id] = (s.inv[id] || 0) + 1; }
      delete T.inv;
    }
    return T;
  });
  S.scoreLog = (Array.isArray(o.scoreLog) ? o.scoreLog.slice(0, 200) : []).map(l => { if (!l || !Array.isArray(l.applied)) return null; const c = Object.assign({}, l); c.applied = l.applied.map(a => a.team ? Object.assign({}, a) : Object.assign({}, a, { studentId: U(a.studentId) })).filter(a => a.studentId || a.team); c.rows = (l.rows || []).map(r => Object.assign({}, r, { studentId: U(r.studentId) })).filter(r => r.studentId); return c; }).filter(Boolean);
  S.lastScore = {}; for (const k in (o.lastScore || {})) if (isFinite(+o.lastScore[k]) && U(k)) S.lastScore[U(k)] = +o.lastScore[k];
  S.lastStay = {}; for (const k in (o.lastStay || {})) if (isFinite(+o.lastStay[k]) && U(k)) S.lastStay[U(k)] = +o.lastStay[k];
  const c = o.cur || {}; S.cur = { teamId: S.teams.some(t => t.id === c.teamId) ? c.teamId : null, room: Math.max(0, c.room | 0), studentId: U(c.studentId) && sids.has(U(c.studentId)) ? U(c.studentId) : null };
  S.staffMes = cleanStaffMes(o.staffMes);
  // 週間ミッション（端末だけで動くとき）：コマ数と受け取った人は uid で持つ
  S.missions = (Array.isArray(o.missions) ? o.missions : []).slice(0, 60).map(m => { const c = cleanMission(m); if (!c) return null; if (c.counts) { const n = {}; for (const k in c.counts) if (U(k)) n[U(k)] = c.counts[k]; c.counts = n; } else c.counts = {}; c.claims = c.claims.map(U).filter(Boolean); return c; }).filter(Boolean);
  // プレゼントQR（端末だけで動くとき。サーバー版はサーバーの gift_codes）
  S.gifts = (Array.isArray(o.gifts) ? o.gifts : []).filter(g => g && /^[A-Z0-9]{4,12}$/.test(g.code) && (ITEM[g.item] || (!g.item && nn(g.picos) > 0))).slice(0, 2000).map(g => ({ code: g.code, item: ITEM[g.item] ? g.item : '', picos: ITEM[g.item] ? 0 : Math.min(1000000, nn(g.picos)), earned: g.earned !== false, set: String(g.set || '').slice(0, 24), kind: g.kind === 'each' ? 'each' : 'once', note: String(g.note || '').slice(0, 40), uses: nn(g.uses), expires: /^\d{4}-\d{2}-\d{2}$/.test(g.expires || '') ? g.expires : null, active: g.active !== false, at: +g.at || 0, claims: Array.isArray(g.claims) ? g.claims.map(U).filter(Boolean) : [] }));
  S.notices = cleanNotices(o.notices); S.startDate = /^\d{4}-\d{2}-\d{2}$/.test(o.startDate || '') ? o.startDate : '';
  return S;
}

// 旧v1（1人用）→ お試しチーミ。価格が10倍になった分、ピコも10倍にして買える量を保つ（メンバーがいないので貯金箱に入る）
function migrateV1(o) {
  const S = defaultState();
  if (!Array.isArray(o.rooms) || !o.rooms.length) return S;
  S.uid = Math.max(1, o.uid | 0);
  const T = Object.assign(newTeam('t0', 'お試しチーミ'), cleanHouse(o, S, CFG.MIN_SIZE, () => null));
  T.confirmed = true; T.size0 = CFG.MIN_SIZE; T.picos = nn(num(o.pts, 0) * DEFAULT_MUL); T.total = nn(num(o.total, 0) * DEFAULT_MUL);
  const inv = cleanInv(o.inv); if (Object.keys(inv).length) T.inv = inv;
  S.teams.push(T); S.cur = { teamId: null, room: Math.max(0, Math.min(T.rooms.length - 1, o.cur | 0)), studentId: null };
  S.sound = o.sound !== false; return S;
}

// チーミ確定：人数で初期の広さを決めて家を作る（貯金箱0）
export function confirmTeamHouse(t) { t.size0 = baseSize(Math.max(t.members.length, t.plan | 0)); Object.assign(t, newHouse(t.size0)); t.picos = 0; t.confirmed = true; delete t.inv; return t; }

export function load() {
  try {
    let raw = localStorage.getItem(KEY);
    if (raw) return sanitize(JSON.parse(raw));
    raw = localStorage.getItem(OLD_KEY);
    if (raw) return sanitize(JSON.parse(raw));
  } catch (e) { }
  return defaultState();
}
export function save(S) { try { localStorage.setItem(KEY, JSON.stringify(S)); return true; } catch (e) { return false; } }
export function clearAll() { try { localStorage.removeItem(KEY); } catch (e) { } }
export const exportJSON = S => JSON.stringify(S);
export function importJSON(text) {
  const o = JSON.parse(text);
  if (!o || typeof o !== 'object' || ((o.v === 2 || o.v === 3) ? !Array.isArray(o.teams) : !Array.isArray(o.rooms))) throw new Error('形式が違います');
  return sanitize(o);
}
