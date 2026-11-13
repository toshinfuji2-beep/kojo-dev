// サーバー（Supabase）との接続。書き込みはすべて RPC（security definer 関数）経由。
// config.js が無い・つながらない時は SV.on = false のまま（localStorage 版で動く）。
// 担任助手PCにだけ、名簿(本名・番号)と「uid⇔名簿」の対応表を localStorage に置く（サーバーには送らない）。
import { cleanMe, cleanWear } from './me.js?v=202611131634';
import { cleanMission, cleanNotices } from './mission.js?v=202611131634';
import { migrateRooms } from './data.js?v=202611131634';
import { dayKey } from './daily.js?v=202611131634';
import { vaultEncrypt, vaultDecrypt, vaultKeyReset, isWeakPass } from './vault.js?v=202611131634';

export const SV = { on: false, sb: null, adminPass: null, rows: [], teamRows: [], priceMul: 10, adm: null, status: 'init', slotsOk: null, vaultOk: null, vaultBlock: false, vaultAt: 0, onMerge: null, dailyMin: 0, unlocks: new Set(), schema: null, operator: '', wipedAt: 0, exportAt: 0 };   // cardsOk/vaultOk: null=未確認 / true / false=サーバーの更新が必要
// このクライアントが必要とするサーバー(schema.sql)の版。schema.sql 末尾の「schema 版」と同じ値にそろえる
export const REQUIRED_SCHEMA = 11;
export class SvError extends Error { constructor(kind, msg) { super(msg || kind); this.kind = kind; } }

// ===== 行の整形（純粋関数） =====
export const mapStudent = r => ({
  uid: r.uid, nick: r.nick || '', me: r.me ? (cleanMe(r.me) || undefined) : undefined, picos: Math.max(0, +r.picos || 0), earned: Math.max(0, +r.earned || 0), inv: r.inv && typeof r.inv === 'object' ? r.inv : {},
  teamId: r.team_id || null, approved: !!r.approved, pin: r.has_pin ? 'srv' : undefined, wear: cleanWear(r.wear), staff: !!r.staff,
  lastScore: r.last_score == null ? null : +r.last_score, lastStay: r.last_stay == null ? null : +r.last_stay, retired: !!r.retired
});
export const mapTeam = t => ({
  id: t.id, name: t.name, n: t.n | 0, members: Array.isArray(t.members) ? t.members.slice() : [], confirmed: !!t.confirmed, picos: Math.max(0, +t.picos || 0), size0: (t.size0 | 0) || 6, hasCode: !!t.has_code,
  rooms: t.data && Array.isArray(t.data.rooms) ? migrateRooms(t.data.rooms, (t.size0 | 0) || 6) : [], open: t.data && Array.isArray(t.data.open) ? t.data.open.filter(k => typeof k === 'string') : [], own: (t.data && t.data.own) || { wallpaper: ['wp_cream'], floor: ['fl_wood'] }, version: t.version | 0, history: [], contrib: {}, total: 0
});
// RPC の失敗理由 → やさしい日本語
const ERR = {
  log: 'この取り込みは取り消せません（いちばん新しい・1時間以内・担任助手の入口で入れたものだけ）', pin: '番号が違います', locked: '番号を何度も間違えたため、5分待ってください', nopin: '番号がまだ決まっていません', uid: 'その人が見つかりません', funds: 'ピコが足りません', rank: 'ランクが足りません', owned: 'すでに持っています',
  team: 'チーミがまだ準備中です', member: 'このチーミの人ではありません', conflict: 'ほかの人が同時に変更しました。もう一度試してください', limit: '作れる数が上限です。担任助手に伝えてください', nick: 'ニックネームを入力してください',
  admin: '担任助手のパスワードが違います', diff: '保存できませんでした。もう一度試してください', tamper: '保存できませんでした。もう一度試してください', inv: '持ち物が足りません', max: 'すでに最大です', item: 'そのアイテムはありません', haspin: '番号はすでに決まっています', wear: 'まだ買っていないきせかえです', pass: 'あいことばが違います',
  layout: '間取りが変わっています。もう一度開いてください', size: '部屋の広さは 3〜16 マスです', span: '家が大きすぎます（24×24マスまで）', overlap: '部屋が重なっています', conn: '部屋は辺でつなげてください', rooms: '部屋の数や並びが正しくありません', fit: 'はみ出してしまう家具があります', name: '部屋の名前を入力してください', items: '新しい部屋には家具を入れられません',
  gift: 'そのコードは見つかりません', giftend: 'このコードは もう使えません（期限切れ・停止中）', giftused: 'このコードは もう使われています', log: 'その記録は取り消せません',
  notyet: 'まだチーミ全員が達成していません', claimed: 'すでに受け取りました', staff: '担任助手は受け取れません', approve: '担任助手の承認がまだです', mission: 'そのミッションはありません', bad: '入力を確認してください',
  retired: 'この me- は今使えません。担任助手に聞いてください', slot: 'その名前はもう選べません。もう一度えらんでください', slotused: 'その名前は、すでにほかの人が選びました。まちがいなら担任助手に言ってください'
};
export const NEED_UPDATE = 'サーバーの更新が必要です（schema.sql を再実行）';
export const errText = e => ERR[e] || ('エラー（' + e + '）');

// ===== 接続 =====
// 'none'(config無し) / 'offline'(つながらない) / 'ok'。schema未実行は SvError('schema') を投げる
export async function svInit() {
  let cfg = null;
  try { cfg = (await import('./config.js?v=202611131634')).SUPABASE; } catch (e) { cfg = null; }
  if (!cfg || !cfg.url || !cfg.key || /YOUR_|xxxx/.test(cfg.url)) { SV.status = 'none'; return 'none'; }
  try { const m = await import('@supabase/supabase-js'); SV.sb = m.createClient(cfg.url, cfg.key, { auth: { persistSession: false, autoRefreshToken: false }, realtime: { params: { eventsPerSecond: 8 } } }); } catch (e) { SV.status = 'offline'; return 'offline'; }
  try { await pull(); } catch (e) { if (e.kind === 'offline') { SV.status = 'offline'; return 'offline'; } throw e; }
  SV.on = true; SV.status = 'ok'; await loadServerInfo(); return 'ok';
}
// サーバーの版：server_info() が無い古いサーバーは版0。つながらないときは不明(null)のまま（赤い帯は出さない）
export async function loadServerInfo() {
  try { const r = await SV.sb.rpc('server_info'); if (r.error) { const e = classify(r.error); if (e.kind === 'schema') SV.schema = 0; return SV.schema; } SV.schema = r.data && +r.data.schema >= 0 ? +r.data.schema | 0 : 0; } catch (e) { /* 不明のまま */ }
  return SV.schema;
}
// サーバーの版がこのクライアントに足りないか（担任助手ホームの赤い帯。生徒側には何も出さない）
export const schemaStale = () => !!SV.on && SV.schema != null && SV.schema < REQUIRED_SCHEMA;
// 版 n 以上のサーバーか（新しい引数・RPC を使ってよいか。版が不明のときは古いものとして扱う）
export const schemaAtLeast = n => !!SV.on && SV.schema != null && SV.schema >= n;
const isNet = m => /fetch|network|timeout|load failed/i.test(m || '');
const classify = (error) => {
  const m = error.message || '', c = error.code || '';
  if (isNet(m) && !c) return new SvError('offline', m);
  if (c === 'PGRST202' || c === '42883' || c === 'PGRST205' || c === '42P01' || /Could not find the (function|table)|schema cache|does not exist/i.test(m)) return new SvError('schema', m);
  return new SvError('server', m);
};
export async function pull() {
  const q = t => SV.sb.from(t).select('*');
  let a, b, c;
  try { [a, b, c] = await Promise.all([q('students'), q('teams'), SV.sb.from('settings').select('*').eq('id', 1).maybeSingle()]); } catch (e) { throw new SvError('offline', String(e)); }
  for (const r of [a, b, c]) if (r.error) throw classify(r.error);
  SV.rows = (a.data || []).map(mapStudent); SV.teamRows = (b.data || []).map(mapTeam); SV.priceMul = c.data && +c.data.price_mul > 0 ? +c.data.price_mul : 10; SV.startDate = c.data && /^\d{4}-\d{2}-\d{2}/.test(c.data.start_date || '') ? c.data.start_date.slice(0, 10) : '';
  SV.dailyMin = c.data && c.data.daily_minutes != null ? Math.max(0, +c.data.daily_minutes | 0) : 0;   // 古いサーバー(列なし)は制限なし
  SV.wipedAt = c.data && c.data.wiped_at ? Date.parse(c.data.wiped_at) || 0 : 0; SV.exportAt = c.data && c.data.last_export_at ? Date.parse(c.data.last_export_at) || 0 : 0;
  { const ret = new Set(SV.rows.filter(r => r.retired).map(r => r.uid)); if (ret.size) SV.teamRows.forEach(t => { t.members = t.members.filter(u => !ret.has(u)); }); }   // 休止の人は、生徒側の一覧・ランキングの人数から外す
  await pullExtras();
  return { students: SV.rows, teams: SV.teamRows, priceMul: SV.priceMul, staffMes: SV.staffMes, notes: SV.notes, missions: SV.missions, notices: SV.notices, startDate: SV.startDate };
}
// 担任助手のme-・伝言板（schema を更新する前でも本体は動くように、失敗しても空のまま続ける）
SV.staffMes = []; SV.notes = []; SV.missions = []; SV.notices = [];
async function pullExtras() {
  // 利用時間の「今日だけ解除」（古いサーバーには表が無い＝空のまま）
  try { const r = await SV.sb.from('daily_unlock').select('*'), day = dayKey(); SV.unlocks = new Set(r && !r.error && Array.isArray(r.data) ? r.data.filter(x => String(x.day).slice(0, 10) === day).map(x => x.uid) : []); } catch (e) { SV.unlocks = new Set(); }
  // 校舎のお知らせ（掲示板）
  try { const r = await SV.sb.from('notices').select('*'); SV.notices = r && !r.error && Array.isArray(r.data) ? cleanNotices(r.data.map(x => ({ id: x.id, at: Date.parse(x.at) || 0, kind: x.kind, title: x.title, body: x.body, date: x.event_date || '' }))) : []; } catch (e) { SV.notices = []; }
  try {
    const [p, n] = await Promise.all([SV.sb.from('staff_profiles').select('*'), SV.sb.from('team_notes').select('*')]);
    SV.staffMes = p && !p.error && Array.isArray(p.data) ? p.data.map(r => ({ id: r.id, nick: r.nick || '', me: r.me ? (cleanMe(r.me) || undefined) : undefined })) : [];
    SV.notes = n && !n.error && Array.isArray(n.data) ? n.data.map(r => ({ id: r.id, teamId: r.team_id, at: Date.parse(r.at) || 0, by: r.by_nick || '', text: r.body || '' })) : [];
  } catch (e) { SV.staffMes = []; SV.notes = []; }
  // 週間ミッション：中身・チーミごとの達成人数・受け取った人（ひとりひとりのコマ数はサーバーの外に出さない）
  try {
    const [m, t, c] = await Promise.all(['missions', 'mission_team', 'mission_claims'].map(n => SV.sb.from(n).select('*')));
    if (!m || m.error || !Array.isArray(m.data)) { SV.missions = []; return; }
    const tm = t && !t.error && Array.isArray(t.data) ? t.data : [], cl = c && !c.error && Array.isArray(c.data) ? c.data : [];
    SV.missions = m.data.map(r => { const o = cleanMission({ id: r.id, title: r.title, start: r.starts, end: r.ends, need: r.need, picos: r.reward_picos, item: r.reward_item || '' }); if (!o) return null; o.teams = {}; tm.filter(x => x.mission_id === r.id).forEach(x => { o.teams[x.team_id] = { done: x.done | 0, total: x.total | 0, achieved: !!x.achieved }; }); o.claims = cl.filter(x => x.mission_id === r.id).map(x => x.uid); return o; }).filter(Boolean);
  } catch (e) { SV.missions = []; }
}
// RPC（返り値は {ok:true,...} か {ok:false, err:'...'}）
export async function rpc(name, args) {
  let r; try { r = await SV.sb.rpc(name, args || {}); } catch (e) { throw new SvError('offline', String(e)); }
  if (r.error) throw classify(r.error);
  return r.data || { ok: false, err: 'empty' };
}
// 担任助手のパスワードなし入口：向上得点の貼り付け（rows＝[{n:氏名, v:得点}]。dry=true は見るだけ＝書き込まない）／直近1回の取り消し
export const staffScore = (mode, rows, dry, by) => rpc('staff_score_apply', { p_mode: mode, p_rows: rows, p_dry: !!dry, p_by: by || null });
export const staffScoreUndo = (log, by) => rpc('staff_score_undo', { p_log: log, p_by: by || null });
// 「だれが操作したか」を p_by で残す RPC と、それを受け付けるサーバーの版（古いサーバーには送らない＝今までどおり動く）
export const BY_RPC = { admin_grant: 2, admin_undo: 2, admin_reset_pin: 2, admin_delete_me: 2, admin_team_confirm: 2, admin_mark_export: 2, admin_launch_reset: 2, admin_move_student: 4, admin_retire: 4, admin_reset_nick: 4, admin_daily_unlock: 5, admin_event_grant: 6, admin_gift_create: 6, admin_gift_set_active: 6, admin_gift_delete: 6, admin_gift_create2: 11, admin_gift_set_active_set: 11, admin_gift_delete_set: 11 };
export const adminRpc = (name, args) => {
  const a = Object.assign({ p_admin: SV.adminPass }, args || {});
  if (BY_RPC[name] && SV.operator && schemaAtLeast(BY_RPC[name])) a.p_by = SV.operator;
  return rpc(name, a);
};
// ===== 操作者（担任助手モードに入るとき選ぶ名前。端末に前回の選択を覚える。担任助手の名前だけで個人情報ではない） =====
const OPKEY = 'kojoHouse.operator';
export const lastOperator = () => { try { return localStorage.getItem(OPKEY) || ''; } catch (e) { return ''; } };
export function setOperator(name) { SV.operator = String(name || '').trim().slice(0, 20); try { if (SV.operator) localStorage.setItem(OPKEY, SV.operator); } catch (e) { } return SV.operator; }
// サーバーのデータを1つにまとめて取る（admin_export）。保存し終えたら markExported() で日時を記録
export async function exportServerData() {
  const r = await adminRpc('admin_export', {}); if (!r.ok) throw new SvError('server', errText(r.err)); return r;
}
export async function markExported() {
  const r = await adminRpc('admin_mark_export', {}); if (r.ok) SV.exportAt = +r.at || Date.now(); return r.ok;
}
// Realtime：チーミ・生徒の変化を受けて onChange を呼ぶ（連続は まとめる）
let ch = null, tmr = 0;
export function subscribe(onChange) {
  unsubscribe(); if (!SV.sb) return;
  const fire = () => { clearTimeout(tmr); tmr = setTimeout(onChange, 250); };
  ch = SV.sb.channel('kojo-house').on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, fire).on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, fire)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'team_notes' }, fire).on('postgres_changes', { event: '*', schema: 'public', table: 'staff_profiles' }, fire)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'missions' }, fire).on('postgres_changes', { event: '*', schema: 'public', table: 'mission_team' }, fire).on('postgres_changes', { event: '*', schema: 'public', table: 'notices' }, fire).subscribe();
}
export function unsubscribe() { if (ch && SV.sb) { try { SV.sb.removeChannel(ch); } catch (e) { } } ch = null; clearTimeout(tmr); }

// ===== この端末の「自分」 =====
const MYKEY = 'kojoHouse.myuid', ADMKEY = 'kojoHouse.admin';
export const getMyUid = () => { try { return localStorage.getItem(MYKEY) || null; } catch (e) { return null; } };
export const setMyUid = u => { try { if (u) localStorage.setItem(MYKEY, u); else localStorage.removeItem(MYKEY); } catch (e) { } };

// ===== 担任助手PC：名簿・チーミ編成(本名つき)・ひもづけ表はここだけ =====
//   adm = { students:[{uid(ローカルのキー), id(名簿の番号), name, kana, grade, link(サーバーのuid|null)}], teams:[{id,name,members:[ローカルのキー]}], settings:{rate,stayRate}, seq }
export const ADM_FIELDS = ['uid', 'id', 'name', 'kana', 'grade', 'link', 'mt'];   // mt＝その人を最後に変えた時刻(ms)。2台同時編集のマージで「新しい方」を決めるのに使う   // card＝はじめてカードのコード（8文字・この端末だけ。サーバーにはハッシュだけ）
export function admLoad() { let o = null; try { o = JSON.parse(localStorage.getItem(ADMKEY) || 'null'); } catch (e) { } return admNormalize(o); }
export function admNormalize(o) {
  o = o && typeof o === 'object' ? o : {};
  return admTrack({
    students: (Array.isArray(o.students) ? o.students : []).filter(s => s && s.uid && s.id != null && s.name).map(s => { const r = { uid: String(s.uid), id: String(s.id), name: String(s.name), link: s.link ? String(s.link) : null }; if (s.kana) r.kana = String(s.kana); if (s.grade) r.grade = String(s.grade); if (s.mt > 0) r.mt = +s.mt; return r; }),
    teams: (Array.isArray(o.teams) ? o.teams : []).filter(t => t && t.id).map(t => { const r = { id: String(t.id), name: String(t.name || 'チーミ').slice(0, 12), members: (Array.isArray(t.members) ? t.members : []).map(String) }; if (/^\d{4}$/.test(t.code)) r.code = t.code; if (t.plan > 0) r.plan = Math.min(40, t.plan | 0); if (t.mt > 0) r.mt = +t.mt; return r; }),
    settings: { rate: Math.max(1, +(o.settings && o.settings.rate) || 10000), stayRate: Math.max(1, +(o.settings && o.settings.stayRate) || 1000) }, seq: o.seq | 0
  });
}
// ----- 変えた人・チーミの更新時刻(mt)：保存のとき、前回の中身と比べて変わったものだけに now を付ける -----
// （点検用の指紋 _fp は保存しない・列挙されない。名簿を読み込んだ直後の状態が基準）
const fpStu = s => JSON.stringify([s.id, s.name, s.kana || '', s.grade || '', s.link || '']);
const fpTeam = t => JSON.stringify([t.name, (t.members || []).join(','), t.code || '', t.plan | 0]);
function admTrack(a) { Object.defineProperty(a, '_fp', { value: new Map([...a.students.map(s => ['s' + s.uid, fpStu(s)]), ...a.teams.map(t => ['t' + t.id, fpTeam(t)])]), writable: true, enumerable: false, configurable: true }); return a; }
export function admStamp(a, now) {
  if (!a._fp) { admTrack(a); return; }
  now = now || Date.now();
  a.students.forEach(s => { const f = fpStu(s); if (a._fp.get('s' + s.uid) !== f) { s.mt = now; a._fp.set('s' + s.uid, f); } });
  a.teams.forEach(t => { if (t.foreign) return; const f = fpTeam(t); if (a._fp.get('t' + t.id) !== f) { t.mt = now; a._fp.set('t' + t.id, f); } });
}
// ----- 2台の担任助手PCが別々に編集した名簿の合流（admin_vault_put が「別のPCが先に保存していた」と答えたとき） -----
// 学生は名簿番号 id をキーに：link は「値がある方」（両方あれば mt が新しい方）、名前などは mt が新しい方、どちらかにしか無い人は残す。
// チーミは id をキーに「新しい方」を丸ごと採る（メンバーの和集合にはしない）。同点は remote（サーバー側＝先に保存された方）。
// local の uid と remote の uid が違う同じ人は remote の uid にそろえ、チーミのメンバーも付けかえる。設定は remote。
export function mergeRoster(L, R) {
  const mt = x => +(x && x.mt) || 0, byId = new Map(), uidMap = new Map(), students = [];
  R.students.forEach(s => byId.set(String(s.id), { r: s }));
  L.students.forEach(s => { const k = String(s.id), e = byId.get(k) || {}; e.l = s; byId.set(k, e); });
  for (const { l, r } of byId.values()) {
    if (!l || !r) { students.push(Object.assign({}, l || r)); continue; }
    const lNew = mt(l) > mt(r), base = lNew ? l : r, o = Object.assign({}, base, { uid: r.uid, mt: Math.max(mt(l), mt(r)) || undefined });
    for (const f of ['link']) { const v = l[f] && r[f] ? (lNew ? l[f] : r[f]) : (l[f] || r[f]); if (v) o[f] = v; else delete o[f]; }
    if (!o.mt) delete o.mt;
    uidMap.set(l.uid, r.uid); students.push(o);
  }
  const have = new Set(students.map(s => s.uid)), tm = new Map();
  R.teams.forEach(t => tm.set(t.id, { r: t })); L.teams.forEach(t => { const e = tm.get(t.id) || {}; e.l = t; tm.set(t.id, e); });
  const teams = [...tm.values()].map(({ l, r }) => { const w = !l ? r : !r ? l : (mt(l) > mt(r) ? l : r); return Object.assign({}, w, { members: (w.members || []).map(u => uidMap.get(u) || u).filter(u => have.has(u)) }); });
  const seen = new Set();   // 1人は1つのチーミだけ（新しいチーミから順に決める）
  teams.slice().sort((a, b) => mt(b) - mt(a)).forEach(t => { t.members = t.members.filter(u => !seen.has(u) && seen.add(u)); });
  return admNormalize({ students, teams, settings: R.settings, seq: Math.max(L.seq | 0, R.seq | 0) });
}
export const admPersist = a => ({ v: 1, students: a.students.map(s => { const r = {}; ADM_FIELDS.forEach(k => { if (s[k] != null) r[k] = s[k]; }); return r; }), teams: a.teams.map(t => { const r = { id: t.id, name: t.name, members: t.members.filter(u => a.students.some(s => s.uid === u)) }; if (t.code) r.code = t.code; if (t.plan > 0) r.plan = t.plan | 0; if (t.mt > 0) r.mt = t.mt; return r; }), settings: { rate: a.settings.rate, stayRate: a.settings.stayRate }, seq: a.seq | 0 });
const ATKEY = ADMKEY + '.at';   // 名簿を最後にこの端末へ保存した時刻（ms。バックアップと比べて新しいほうを採るため）
export const admSavedAt = () => { try { return +localStorage.getItem(ATKEY) || 0; } catch (e) { return 0; } };
export function admSaveLocal(a, at) {
  if (!at) admStamp(a);   // 自分で変えたときだけ、変えた人の mt を付ける（読み込み・合流の保存では付けない）
  try { localStorage.setItem(ADMKEY, JSON.stringify(admPersist(a))); localStorage.setItem(ATKEY, String(at || Date.now())); } catch (e) { return false; }
  if (!at) vaultSoon();
  return true;
}
// 名簿ファイル（別の担任助手PCへ手で移す用）
export const admExport = a => JSON.stringify(admPersist(a), null, 1);
export function admImport(text) {
  const o = JSON.parse(text); if (!o || typeof o !== 'object' || !Array.isArray(o.students) || !Array.isArray(o.teams)) throw new Error('形式が違います');
  return admNormalize(o);
}
// ローカルの名簿モデルに、サーバーの値を重ねる（サーバーの値は ひもづけ済みの人にだけ）
export function mergeAdmin(a, rows, teams, priceMul) {
  const byU = new Map(rows.map(r => [r.uid, r])), tmap = new Map(teams.map(t => [t.id, t]));
  a.students.forEach(s => {
    const r = s.link && byU.get(s.link);
    if (s.link && !r) s.link = null;   // サーバー側で消された me- は、ひもづけも外れる
    Object.assign(s, r ? { nick: r.nick, me: r.me, picos: r.picos, earned: r.earned, inv: r.inv, pin: r.pin, approved: true, wear: r.wear, staff: r.staff, retired: !!r.retired } : { nick: '', me: undefined, picos: 0, earned: 0, inv: {}, pin: undefined, approved: false, wear: [], staff: false, retired: false });
  });
  a.teams.forEach(t => { const sv = tmap.get(t.id); Object.assign(t, sv ? { hasCode: sv.hasCode, confirmed: sv.confirmed, picos: sv.picos, size0: sv.size0, n: sv.n, rooms: sv.rooms, open: sv.open, own: sv.own, version: sv.version, history: [], contrib: {}, total: 0 } : { confirmed: false, picos: 0, size0: 6, rooms: [], own: { wallpaper: [], floor: [] }, history: [], contrib: {}, total: 0 }); });
  teams.forEach(sv => { if (!a.teams.some(t => t.id === sv.id)) a.teams.push(Object.assign({}, sv, { members: [], foreign: true })); });
  a.lastScore = {}; a.lastStay = {}; a.students.forEach(s => { const r = s.link && byU.get(s.link); if (r && r.lastScore != null) a.lastScore[s.uid] = r.lastScore; if (r && r.lastStay != null) a.lastStay[s.uid] = r.lastStay; });
  a.settings.priceMul = priceMul; a.cur = a.cur || { teamId: null, room: 0, studentId: null };
  a.seq = Math.max(a.seq | 0, ...a.teams.map(t => +(String(t.id).match(/^t(\d+)$/) || [0, 0])[1]));
  return a;
}
export const newCode = () => String(Math.floor(Math.random() * 10000)).padStart(4, '0');
// サーバーへ送るチーミ情報（名前と人数だけ）
// （休止の人は人数に数えない。a＝名簿モデル）
export const teamPayload = (t, a) => ({ p_id: t.id, p_name: t.name, p_n: Math.max(a ? t.members.filter(u => { const s = a.students.find(x => x.uid === u); return !(s && s.retired); }).length : t.members.length, t.plan | 0) });
// 担任助手PCのチーミ（名前・人数）をサーバーへ。メンバーの本名は送らない
export async function adminSync() {
  const a = SV.adm; if (!a || !SV.on) return;
  let changed = false;
  for (const t of a.teams) {
    const sv = SV.teamRows.find(x => x.id === t.id);
    if (sv && t.foreign && !t.members.length && sv.name === t.name) continue;   // 別のPCで作ったチーミは、メンバーを入れるまで触らない
    if (!sv || sv.name !== t.name || sv.n !== teamPayload(t, a).p_n) { const r = await adminRpc('admin_team_save', teamPayload(t, a)); if (!r.ok) throw new SvError('server', errText(r.err)); delete t.foreign; changed = true; }
    // あいことば：サーバーに無ければ、担任助手PCの控え（なければ新しく作る）をハッシュで登録する
    if (!t.foreign && (!sv || !sv.hasCode)) {
      if (!/^\d{4}$/.test(t.code || '')) { t.code = newCode(); admSaveLocal(a); }
      const r = await adminRpc('admin_team_set_code', { p_id: t.id, p_code: t.code }); if (!r.ok) throw new SvError('server', errText(r.err)); changed = true;
    }
  }
  if (changed) await pull();
  try { if ((await slotsSync(a)).linked) changed = true; } catch (e) { /* 次の機会に（チーミの保存は済んでいる） */ }
}

// ===== 名簿の枠（担任助手PC側） =====
// 生徒が me- を作るとき「自分の名前」を選べるように、確定したチーミの名前（本名だけ・番号は送らない）をサーバーの roster_slots に置く。
// 生徒が選んだ枠の持ち主(uid)を読み戻して、名簿の人に自動でひもづける。サーバーが古い（schema.sql 未更新）ときは slotsOk=false
const isSchema = e => e instanceof SvError && e.kind === 'schema';
// 名簿の人の枠が入るチーミ：サーバーで確定済みのチーミにいる人だけ（未確定・チーミなしは null＝枠なし）
export function slotTeamOf(a, s) {
  const t = a.teams.find(x => (x.members || []).includes(s.uid)); if (!t) return null;
  const sv = SV.teamRows.find(x => x.id === t.id); return sv && sv.confirmed ? t.id : null;
}
let slotFp = '', slotSb = null;   // 最後にサーバーへ送った枠の指紋（変わったときだけ送る。つなぎ先が変わったら送りなおす）
export async function slotsSync(a) {
  a = a || SV.adm; const out = { linked: 0, ok: false };
  if (!a || !SV.on) return out;
  try {
    // まだひもづいていない・休止でない人だけが枠になる（ひもづけ済みの人の使用済み枠はサーバーが残す）
    const list = a.students.filter(s => !s.link && !s.retired).map(s => ({ k: s.uid, t: slotTeamOf(a, s), n: s.name })).filter(x => x.t);
    if (slotSb !== SV.sb) { slotSb = SV.sb; slotFp = ''; }
    const fp = JSON.stringify(list);
    // 名簿が空（別PC・ブラウザ消去・読み込み失敗）のときは送らない：サーバー側の未使用の枠を消してしまうため
    if (a.students.length && fp !== slotFp) { const r = await adminRpc('admin_roster_save', { p_slots: list }); if (!r.ok) throw new SvError('server', errText(r.err)); slotFp = fp; }
    const c = await adminRpc('admin_roster_claims', {});
    if (!c.ok) return out;
    SV.slotsOk = true; out.ok = true;
    for (const x of Array.isArray(c.claims) ? c.claims : []) {
      const s = a.students.find(y => y.uid === x.k);
      if (s && x.uid && s.link !== x.uid && !a.students.some(y => y !== s && y.link === x.uid)) { s.link = x.uid; out.linked++; }   // 選ばれた枠＝その me- がこの人
    }
  } catch (e) { if (isSchema(e)) { SV.slotsOk = false; return out; } throw e; }
  if (out.linked) admSaveLocal(a);
  return out;
}

// ===== 名簿・ひもづけ表の暗号化バックアップ =====
// パスワード(SV.adminPass)から作った鍵で AES-GCM 暗号化した塊だけをサーバーに置く（サーバーには読めない）。
// パスワードが4けた（8文字未満）の間は、弱いのでバックアップしない。サーバーが古ければ vaultOk=false で止める
let vt = 0;
export const vaultStrong = () => !!SV.on && !!SV.adminPass && !isWeakPass(SV.adminPass);
// 'off'(端末版) / 'noserver'(要schema更新) / 'weak'(パスワードが短い) / 'blocked'(復号できず上書きしない) / 'ready'(まだ送っていない) / 'ok'
export function vaultState() {
  if (!SV.on) return 'off'; if (SV.vaultOk === false) return 'noserver'; if (!vaultStrong()) return 'weak'; if (SV.vaultBlock) return 'blocked'; return SV.vaultAt ? 'ok' : 'ready';
}
export function vaultSoon() {
  if (!vaultStrong() || SV.vaultOk === false || SV.vaultBlock || !SV.adm) return;
  clearTimeout(vt); vt = setTimeout(() => { vaultPush().catch(e => console.error(e)); }, 4000); if (vt && vt.unref) vt.unref();   // （node のテストが待たされないように）
}
export async function vaultPush(depth = 0) {
  clearTimeout(vt);
  if (!vaultStrong() || SV.vaultOk === false || SV.vaultBlock || !SV.adm) return false;
  const enc = await vaultEncrypt(admPersist(SV.adm), SV.adminPass);
  let r; const args = { p_salt: enc.salt, p_iv: enc.iv, p_data: enc.data };
  if (schemaAtLeast(3)) args.p_expect = SV.vaultAt || 0;   // この PC が最後に見たバックアップの時刻。別の PC が先に保存していたら衝突
  try { r = await adminRpc('admin_vault_put', args); } catch (e) { if (isSchema(e)) { SV.vaultOk = false; return false; } throw e; }
  if (!r.ok && r.err === 'vconflict' && depth < 3) return vaultMergeRetry(depth);
  if (!r.ok) return false;
  SV.vaultOk = true; SV.vaultAt = +r.updated_at || Date.now();
  try { localStorage.setItem(ATKEY, String(SV.vaultAt)); } catch (e) { }   // 以後は「サーバーと同じ時刻」＝新しいほうを取りちがえない
  return true;
}
// 衝突：サーバーのバックアップを取得→復号→マージ→この PC の名簿にも反映→もういちど保存
async function vaultMergeRetry(depth) {
  let g;
  try { g = await adminRpc('admin_vault_get', {}); } catch (e) { return false; }
  if (!g.ok || !g.exists) return false;
  let obj; try { obj = await vaultDecrypt(g, SV.adminPass); } catch (e) { SV.vaultBlock = true; return false; }   // 開けない＝上書きしない
  const m = mergeRoster(admNormalize(admPersist(SV.adm)), admNormalize(obj)), prev = SV.adm;
  mergeAdmin(m, SV.rows, SV.teamRows, SV.priceMul); m.scoreLog = prev.scoreLog; m.cur = prev.cur || m.cur; SV.adm = admTrack(m);
  SV.vaultAt = +g.updated_at || 0; admSaveLocal(SV.adm, SV.vaultAt);
  const ok = await vaultPush(depth + 1);
  if (ok && SV.onMerge) SV.onMerge();
  return ok;
}
// ログイン直後：ローカルが空、またはバックアップのほうが新しければ、復号して採用する。'none' | 'weak' | 'noserver' | 'local' | 'restored' | 'fail' | 'error'
export async function vaultRestore() {
  if (!SV.on) return 'none';
  SV.vaultBlock = false; SV.vaultNeed = false; if (!vaultStrong()) return 'weak';
  let r;
  try { r = await adminRpc('admin_vault_get', {}); } catch (e) { if (isSchema(e)) { SV.vaultOk = false; return 'noserver'; } console.error(e); return 'error'; }
  if (!r.ok) return 'error';
  SV.vaultOk = true;
  const local = admLoad(), localAt = admSavedAt(), localEmpty = !local.students.length && !local.teams.length;
  if (!r.exists) { SV.vaultNeed = !localEmpty; return 'local'; }   // まだバックアップが無い：名簿ができていれば最初の1回を送る（SV.adm ができてから）
  SV.vaultAt = +r.updated_at || 0;
  if (!localEmpty && localAt >= SV.vaultAt) { SV.vaultNeed = localAt > SV.vaultAt; return 'local'; }
  let obj;
  try { obj = await vaultDecrypt(r, SV.adminPass); } catch (e) { SV.vaultBlock = true; return 'fail'; }
  const a = admNormalize(obj);
  try {
    if (!localEmpty) localStorage.setItem(ADMKEY + '.prev', localStorage.getItem(ADMKEY) || '');   // 置きかえる前の名簿を1つ残す
    localStorage.setItem(ADMKEY, JSON.stringify(admPersist(a))); localStorage.setItem(ATKEY, String(SV.vaultAt));
  } catch (e) { return 'error'; }
  return 'restored';
}
// パスワードを変えたとき：新しいパスワードで暗号化しなおして送る（復号できなかった状態もここで解消）
export async function vaultRekey() { vaultKeyReset(); SV.vaultBlock = false; if (SV.on && SV.adm) admSaveLocal(SV.adm, Date.now()); return vaultPush(); }
