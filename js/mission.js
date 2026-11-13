// 週間ミッション：形を整える・期間の判定・チーミの達成の数え方（純粋関数。DOMもthree.jsも使わない）
// ミッション = { id, title, start:'YYYY-MM-DD', end, need(ひとりあたり必要なコマ数), picos(ひとりあたりの報酬), item(報酬のアイテムID か ''),
//               counts:{uid:コマ数}（端末だけで動くときだけ。サーバー版はサーバーの外に出さない）, claims:[受け取った uid], teams:{teamId:{done,total,achieved}}（サーバー版） }
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const int = (v, lo, hi, d) => { v = Math.floor(+v); return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };
export function cleanMission(o) {
  if (!o || typeof o !== 'object' || !/^[A-Za-z0-9_-]{1,24}$/.test(o.id || '')) return null;
  const start = String(o.start || '').slice(0, 10), end = String(o.end || '').slice(0, 10);
  if (!DAY.test(start) || !DAY.test(end) || end < start) return null;
  const m = { id: o.id, title: String(o.title || 'ミッション').slice(0, 30), start, end, need: int(o.need, 1, 99, 4), picos: int(o.picos, 0, 1000000, 0), item: typeof o.item === 'string' ? o.item.slice(0, 40) : '' };
  if (o.counts && typeof o.counts === 'object') { m.counts = {}; for (const k in o.counts) { const n = int(o.counts[k], 0, 99, 0); if (n) m.counts[k] = n; } }
  m.claims = Array.isArray(o.claims) ? [...new Set(o.claims.filter(x => typeof x === 'string'))] : [];
  return m;
}
// 端末の日付（YYYY-MM-DD）
export const todayStr = (d) => { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
// soon=これから / now=実施中 / over=終わった
export const phaseOf = (m, today) => { today = today || todayStr(); return today < m.start ? 'soon' : today > m.end ? 'over' : 'now'; };
const WD = '日月火水木金土';
const md = s => { const [y, mo, d] = s.split('-').map(Number), w = new Date(y, mo - 1, d).getDay(); return mo + '/' + d + '(' + WD[w] + ')'; };
export const rangeText = m => md(m.start) + '〜' + md(m.end);
export const condText = m => 'チーミ全員が ' + m.need + 'コマ以上 受講する';
// 端末だけで動くとき：チーミの達成人数を数える（担任助手★は数えない）
export function localTeamStatus(m, team, studentById) {
  const mem = team.members.map(studentById).filter(s => s && !s.staff), c = m.counts || {};
  const done = mem.filter(s => (c[s.uid] || 0) >= m.need).length;
  return { done, total: mem.length, achieved: mem.length > 0 && done >= mem.length };
}
// ===== ゲームの日数：開始日まではカウントダウン、開始日からは「何日目」 =====
export const GAME_START = '2026-12-01';
const dnum = s => { const [y, m, d] = s.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); };
export function dayInfo(start, today) {
  start = DAY.test(start || '') ? start : GAME_START; today = today || todayStr();
  const diff = dnum(today) - dnum(start);
  return diff < 0 ? { before: true, left: -diff, start } : { before: false, day: diff + 1, start };
}
export const startText = s => { const [y, m, d] = s.split('-').map(Number), w = new Date(y, m - 1, d).getDay(); return m + '月' + d + '日(' + WD[w] + ')'; };
// ===== 校舎のお知らせ（掲示板）：{ id, at, kind: info/event/important, title, body, date('YYYY-MM-DD' か '') } =====
export const NOTICE_KIND = { important: ['大事', 'ng'], event: ['イベント', 'ok'], info: ['お知らせ', ''] };
export function cleanNotices(a) {
  return (Array.isArray(a) ? a : []).filter(n => n && typeof n.title === 'string' && n.title.trim()).map(n => ({
    id: String(n.id), at: +n.at || 0, kind: NOTICE_KIND[n.kind] ? n.kind : 'info', title: n.title.trim().slice(0, 40), body: String(n.body || '').slice(0, 400), date: DAY.test(String(n.date || '').slice(0, 10)) ? String(n.date).slice(0, 10) : ''
  })).sort((x, y) => (y.kind === 'important') - (x.kind === 'important') || y.at - x.at).slice(0, 60);
}
export const shortDate = s => { if (!DAY.test(s || '')) return ''; const [, m, d] = s.split('-').map(Number); return m + '/' + d; };
// 次のミッションのIDと期間のたたき台（今日を含む週の月曜〜土曜）
export function weekDraft(today) {
  const d = today ? new Date(today + 'T00:00:00') : new Date(), w = (d.getDay() + 6) % 7, mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - w), sat = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 5);
  const s = todayStr(mon);
  return { id: 'w' + s.replace(/-/g, ''), start: s, end: todayStr(sat) };
}
