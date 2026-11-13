// 名簿・向上得点の貼り付けテキストを読む「純粋関数」群（DOM・保存に依存しない。node でテストできる）

export const nfkc = s => String(s == null ? '' : s).normalize('NFKC');
// 表示用の名前：全角/半角スペースを半角1つに
export const normName = s => nfkc(s).replace(/[\s　]+/g, ' ').trim();
// チーミ名：丸数字（①など）が数字に変わらないよう、NFKC はかけずにスペースだけ整える
export const normTeam = s => String(s == null ? '' : s).replace(/[\s　]+/g, ' ').trim();
// 照合用の名前：スペースを全部取り、小文字化
export const nameKey = s => nfkc(s).replace(/[\s　]+/g, '').toLowerCase();
// 照合用のID：数字だけなら先頭の0を無視（001 = 1）
export const idKey = s => { const t = nfkc(s).replace(/[\s　]+/g, '').toLowerCase(); return /^\d+$/.test(t) ? t.replace(/^0+(?=\d)/, '') : t; };

// 数値に変換（全角・カンマ・「点」付きもOK）。読めなければ NaN
export function parseNum(s) {
  let t = nfkc(s).replace(/[,\s]/g, '').replace(/[−‐‑–—－]/g, '-').replace(/(点|pt)$/i, '');
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(t)) return NaN;
  return Number(t);
}
// 在校時間 → 分。「90分」「90」「1時間30分」「1時間」「1.5時間」「1h30m」「1:30」「1：30：00」に対応。読めなければ NaN
export function parseMinutes(s) {
  const t = nfkc(s).replace(/[,\s]/g, '').replace(/[：]/g, ':').toLowerCase();
  let m;
  if ((m = t.match(/^(\d+):(\d{1,2})(?::\d{1,2})?$/))) return (+m[1]) * 60 + (+m[2]);
  if ((m = t.match(/^(\d+(?:\.\d+)?)(?:時間|h|hr|hrs)(?:(\d+(?:\.\d+)?)(?:分|m|min)?|半)?$/))) return Math.round(((+m[1]) * 60 + (m[2] ? +m[2] : /半$/.test(t) ? 30 : 0)) * 1e6) / 1e6;
  if ((m = t.match(/^(\d+(?:\.\d+)?)(?:分|m|min)?$/))) return +m[1];
  return NaN;
}
const isNumCell = c => c !== '' && !isNaN(parseNum(c));
const round6 = v => Math.round(v * 1e6) / 1e6;

function csvSplit(line) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"' && cur === '') q = true;
    else if (c === ',' || c === '，') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur); return out;
}
// テキスト → 行×セル。区切りは「タブがあればTSV」「なければカンマ」「どちらも無ければ1列」
export function parseTable(text) {
  const lines = String(text == null ? '' : text).replace(/^﻿/, '').split(/\r\n|\r|\n/);
  const tab = lines.some(l => l.includes('\t')), comma = !tab && lines.some(l => /[,，]/.test(l));
  const delim = tab ? 'tab' : comma ? 'csv' : 'none';
  const rows = lines.map((l, i) => {
    const cells = (tab ? l.split('\t') : comma ? csvSplit(l) : [l]).map(c => c.replace(/　/g, ' ').trim());
    return { line: i + 1, cells, blank: cells.every(c => c === '') };
  });
  while (rows.length && rows[rows.length - 1].blank) rows.pop();   // 末尾の空行は数えない
  return { rows, delim };
}

const HEAD = {
  id: /^(生徒番号|生徒id|生徒ｉｄ|番号|id|no\.?|コード|会員番号|学籍番号|出席番号)$/i,
  name: /^(氏名|名前|生徒名|お名前|なまえ|name|生徒氏名)$/i,
  kana: /^(ふりがな|フリガナ|カナ|かな|ふりがな|読み|よみ|氏名カナ|氏名ふりがな)$/i,
  grade: /^(学年|grade)$/i,
  staff: /^(チーム担任助手|チーミ担任助手|担任助手|担当|担当者)$/,   // チーミの見出しの行にある担任助手
  kind: /^(種別|区分)$/,
  count: /^(人数|人数\(名\))$/,
  team: /^(チーミ|班|グループ|チーム|team|group|チーミ名|班名|チーム名)$/i,
  score: /得点|点数|スコア|ポイント|^pt$|^点$|^score$/i,
  stay: /^(在校|滞在)|^(時間|分|min|minutes?|time)([(（].*[)）])?$/i
};
function classify(c) { const k = nfkc(c).replace(/[\s　]/g, ''); if (!k) return null; for (const f in HEAD) if (HEAD[f].test(k)) return f; return null; }

// ===== 名簿 =====
// 戻り: { header, cols, rows:[{line,id,name,kana,grade,team,status}], stats }
//   status: ok / dup(取り込み内で重複) / empty(空行) / noname(名前が空)
export function parseRoster(text) {
  const { rows: raw, delim } = parseTable(text);
  const first = raw.find(r => !r.blank);
  const cols = {}; let header = false;
  if (first) {
    const m = {}; first.cells.forEach((c, i) => { const f = classify(c); if (f && f !== 'score' && m[f] == null) m[f] = i; });
    if (m.name != null || (m.id != null && Object.keys(m).length >= 2)) { header = true; Object.assign(cols, m); }
  }
  const body = raw.filter(r => !r.blank && !(header && r === first));
  const ncol = Math.max(1, ...raw.map(r => r.cells.length));
  if (!header) {
    // 見出し無し：数字だけの列=ID、それ以外の最初の列=氏名
    const allNum = [], textual = [];
    for (let c = 0; c < ncol; c++) { const vals = body.map(r => r.cells[c] || '').filter(v => v !== ''); allNum[c] = vals.length > 0 && vals.every(v => /^[0-9０-９]+$/.test(v)); textual[c] = vals.length > 0 && !allNum[c]; }
    if (ncol > 1) { const idc = allNum.findIndex(Boolean); if (idc >= 0) cols.id = idc; }
    cols.name = textual.findIndex(Boolean); if (cols.name < 0) cols.name = cols.id === 0 ? 1 : 0;
    const kc = textual.findIndex((t, c) => t && c !== cols.name && body.every(r => !r.cells[c] || /^[ぁ-んァ-ヶー・\s]+$/.test(r.cells[c])));
    if (kc >= 0) cols.kana = kc;
  } else if (cols.name == null) { // 見出しにIDだけ：残りの最初の列を氏名とみなす
    for (let c = 0; c < ncol; c++) if (!Object.values(cols).includes(c)) { cols.name = c; break; }
  }
  const out = [], seenId = new Set(), seenName = new Set(), teams = {};
  const stats = { lines: raw.length, ok: 0, dup: 0, empty: raw.filter(r => r.blank).length, noname: 0, teams: 0 };
  // ブロック形式（校舎の「チーミ一覧」）：チーム名だけが入った行＝チーミの見出し（担任助手・人数も）。その下の生徒の行はそのチーミ。
  // 空行でブロックが終わる（下に続く「未加入」の生徒にチーミが付かないように）
  let cur = '';
  raw.forEach(r => {
    if (r.blank) { cur = ''; return; }
    if (header && r === first) return;
    const g = f => cols[f] != null ? (r.cells[cols[f]] || '') : '';
    const teamCell = normTeam(g('team'));
    if (cols.team != null && teamCell && !normName(g('name')) && !nfkc(g('id')).trim()) {
      cur = teamCell; const n = parseInt(nfkc(g('count')).replace(/[^0-9]/g, ''), 10);
      teams[cur] = { staff: normName(g('staff')), kind: normName(g('kind')), count: isFinite(n) ? n : null, actual: 0, line: r.line };
      stats.teams++; out.push({ line: r.line, id: '', name: '', kana: '', grade: '', team: cur, staff: teams[cur].staff, count: teams[cur].count, status: 'team' }); return;
    }
    const row = { line: r.line, id: nfkc(g('id')).replace(/[\s　]/g, ''), name: normName(g('name')), kana: normName(g('kana')), grade: normName(g('grade')), team: teamCell || cur, status: 'ok' };
    if (!row.name) { row.status = 'noname'; stats.noname++; out.push(row); return; }
    if (row.team && teams[row.team]) teams[row.team].actual++;
    const ik = row.id ? idKey(row.id) : null, nk = nameKey(row.name);
    if ((ik && seenId.has(ik)) || (!ik && seenName.has(nk))) { row.status = 'dup'; stats.dup++; out.push(row); return; }
    if (ik) seenId.add(ik); seenName.add(nk); stats.ok++; out.push(row);
  });
  // 見出しの人数（○名）と、実際に読めた生徒の数がちがうチーミ
  const mismatch = Object.keys(teams).filter(t => teams[t].count != null && teams[t].count !== teams[t].actual);
  return { header, cols, delim, rows: out, stats, teams, mismatch };
}

// Excel ファイルの複数のシート → 名簿の貼り付けテキスト（タブ区切り）1つにまとめる
// sheets = [{ name, rows: [[セルの文字, ...], ...] }]。シートごとに見出しの行（氏名・生徒番号など）を探し、列を共通の並びにそろえる。
// 見出しが見つからないシートは飛ばす。シートの間は空行（チーミのブロックが次のシートに続かないように）
const ROSTER_COLS = [['team', 'チーム名'], ['kind', '種別'], ['staff', 'チーム担任助手'], ['count', '人数'], ['id', '生徒番号'], ['grade', '学年'], ['name', '氏名'], ['kana', 'かな']];
export function sheetsToRosterText(sheets) {
  const out = [ROSTER_COLS.map(c => c[1]).join('\t')], used = [], skipped = [];
  (sheets || []).forEach(sh => {
    const rows = (sh.rows || []).map(r => (r || []).map(c => String(c == null ? '' : c).replace(/[\t\r\n]+/g, ' ').trim()));
    const hi = rows.findIndex(r => { const f = r.map(classify); return f.includes('name') || (f.includes('id') && f.filter(Boolean).length >= 2); });
    if (hi < 0) { skipped.push(sh.name); return; }
    const map = {}; rows[hi].forEach((c, i) => { const f = classify(c); if (f && map[f] == null) map[f] = i; });
    out.push(ROSTER_COLS.map(() => '').join('\t'));
    rows.slice(hi + 1).forEach(r => out.push(ROSTER_COLS.map(([f]) => map[f] != null ? (r[map[f]] || '') : '').join('\t')));
    used.push(sh.name);
  });
  return { text: out.join('\n'), used, skipped };
}

// 取り込み計画。mode: 'add'(追加) / 'replace'(置き換え)
// 戻り: { rows(各行にstatus/idを反映), students:[...], groups:{チーミ名:[id]}, removed:[id], stats }
export function planRoster(parsed, existing, mode) {
  existing = existing || [];
  const byId = new Map(), byName = new Map();
  existing.forEach(s => { byId.set(idKey(s.id), s); byName.set(nameKey(s.name), s); });
  const used = new Set(existing.map(s => idKey(s.id)));
  if (mode === 'replace') used.clear();
  let seq = 1; const newId = () => { let id; do { id = 'A' + String(seq++).padStart(4, '0'); } while (used.has(idKey(id)) || byId.has(idKey(id))); used.add(idKey(id)); return id; };
  const rows = parsed.rows.map(r => Object.assign({}, r)), groups = {}, added = [], kept = [];
  const stats = { add: 0, exists: 0, dup: parsed.stats.dup, empty: parsed.stats.empty, noname: parsed.stats.noname };
  rows.forEach(r => {
    if (r.status !== 'ok') return;
    const ik = r.id ? idKey(r.id) : null, hit = (ik && byId.get(ik)) || (!ik && byName.get(nameKey(r.name))) || null;
    if (mode === 'add') {
      if (hit) { r.status = 'exists'; stats.exists++; return; }
      if (!r.id) r.id = newId(); else used.add(ik);
      const s = { id: r.id, name: r.name }; if (r.kana) s.kana = r.kana; if (r.grade) s.grade = r.grade;
      added.push(s); r.status = 'add'; stats.add++;
    } else {
      if (!r.id) r.id = hit ? hit.id : newId(); else used.add(ik);
      const s = Object.assign({}, hit || {}, { id: r.id, name: r.name }); if (r.kana) s.kana = r.kana; if (r.grade) s.grade = r.grade;
      kept.push(s); r.status = hit ? 'keep' : 'add'; hit ? 0 : stats.add++;
    }
    if (r.team) (groups[r.team] = groups[r.team] || []).push(r.id);
  });
  const students = mode === 'add' ? existing.concat(added) : kept;
  const keepIds = new Set(students.map(s => idKey(s.id)));
  const removed = existing.filter(s => !keepIds.has(idKey(s.id))).map(s => s.id);
  return { rows, students, groups, removed, stats, teams: parsed.teams || {} };   // teams＝ブロック形式のチーミの見出し（担任助手・人数）
}

// ===== 向上得点 =====
// 戻り: { header, rows:[{line,label,value,studentId,status,raw}], stats }
//   status: ok / unmatched(照合できない) / ambig(同姓同名) / badvalue(得点が読めない) / dup(同じ生徒が2回) / empty
// opts.kind === 'stay' のときは「在校時間（分）」として読む（見出しは 在校時間/時間/分、値は parseMinutes）
export function parseScores(text, students, opts) {
  students = students || [];
  const stay = !!(opts && opts.kind === 'stay'), pv = stay ? parseMinutes : parseNum, isNum = c => c !== '' && !isNaN(pv(c));
  const { rows: raw, delim } = parseTable(text);
  const first = raw.find(r => !r.blank);
  const cols = {}; let header = false;
  if (first) {
    const m = {}; first.cells.forEach((c, i) => { const f = classify(c); if (f && m[f] == null) m[f] = i; });
    if (stay) m.score = m.stay; else delete m.stay;
    if (m.score != null || ((m.id != null || m.name != null) && !first.cells.some(isNum))) { header = true; Object.assign(cols, m); }
  }
  const mid = new Map(), mname = new Map();
  students.forEach(s => { mid.set(idKey(s.id), s); const k = nameKey(s.name); mname.set(k, mname.has(k) ? 'AMBIG' : s); });
  const find = cell => {
    if (!cell) return null;
    const toks = [cell].concat(cell.split(/\s+/).filter(Boolean).length > 1 ? cell.split(/\s+/).filter(Boolean) : []);
    for (const t of toks) { const s = mid.get(idKey(t)); if (s) return s; }
    for (const t of toks) { const s = mname.get(nameKey(t)); if (s) return s; }
    // 「姓名」を2つの語に分けた場合（山田 太郎 → 山田太郎）
    return null;
  };
  const stats = { lines: raw.length, ok: 0, unmatched: 0, ambig: 0, badvalue: 0, dup: 0, empty: raw.filter(r => r.blank).length };
  const out = [], seen = new Set();
  raw.filter(r => !r.blank && !(header && r === first)).forEach(r => {
    let cells = r.cells.slice(), vi = -1;
    if (delim === 'none') { // 区切り無し：「氏名 得点」「ID 氏名 得点」を末尾の数字で分ける
      const c0 = stay ? nfkc(cells[0]).replace(/(時間|h)\s+(?=\d)/gi, '$1') : nfkc(cells[0]);
      const m = stay ? c0.match(/^(.*?\S)[\s　]+(\d+[:：]\d+(?:[:：]\d+)?|\d+(?:\.\d+)?(?:時間|h)(?:\d+(?:\.\d+)?(?:分|m)?|半)?|\d+(?:\.\d+)?\s*(?:分|m|min)?)$/i) : c0.match(/^(.*?\S)[\s　]+([-+−]?[\d.,]+)\s*(点|pt)?$/i);
      if (m) { cells = [m[1], m[2]]; vi = 1; } else cells = [cells[0]];
    }
    if (header && cols.score != null) vi = cols.score;
    else if (vi < 0) { for (let c = cells.length - 1; c >= 0; c--) if (isNum(cells[c])) { vi = c; break; } }
    let value = vi >= 0 ? pv(cells[vi]) : NaN;
    // 見出し無しで数字がIDだけの行（「101 山田」）は得点なし扱い
    if (!header && vi === 0 && cells.length > 1 && cells.slice(1).some(c => c !== '' && !isNum(c))) value = NaN;
    const keyCells = header ? [cells[cols.id], cells[cols.name]].filter(c => c != null && c !== '') : cells.filter((c, i) => i !== vi && c !== '');
    const label = keyCells.map(normName).join(' ') || '(空)';
    const row = { line: r.line, label, value: isNaN(value) ? null : round6(value), studentId: null, status: 'ok', raw: r.cells.join(' | ') };
    let st = null, amb = false;
    for (const c of keyCells) { const f = find(c); if (f === 'AMBIG') { amb = true; continue; } if (f) { st = f; break; } }
    if (!st && keyCells.length) { // 名前が同姓同名で曖昧か
      for (const c of keyCells) { if (mname.get(nameKey(c)) === 'AMBIG') amb = true; }
    }
    if (row.value == null) { row.status = 'badvalue'; stats.badvalue++; }
    else if (!st) { row.status = amb ? 'ambig' : 'unmatched'; stats[row.status]++; }
    else if (seen.has(st.id)) { row.status = 'dup'; row.studentId = st.id; stats.dup++; }
    else { row.studentId = st.id; seen.add(st.id); stats.ok++; }
    out.push(row);
  });
  return { header, cols, delim, rows: out, stats };
}

// 得点の反映計画（純粋）。
// mode: 'cum' = 累計として扱う（前回との差分だけ）/ 'add' = 今回分としてそのまま加算
// rows: [{studentId, value}]  lastScore: {studentId: 前回までの累計}  rate: 1点あたりのピコ
// 戻り: [{studentId, prev, value, delta, picos, warn, newLast}]
export function planScores(rows, lastScore, mode, rate) {
  lastScore = lastScore || {};
  return rows.map(r => {
    const prev = round6(+lastScore[r.studentId] || 0), value = round6(r.value);
    // base＝基準として記録：ピコは0、前回値をこの値で上書き（下がっていても上書き）
    if (mode === 'base') return { studentId: r.studentId, prev, value, delta: 0, picos: 0, warn: null, newLast: value, base: true };
    let delta = mode === 'add' ? value : round6(value - prev), warn = null;
    if (delta < 0) { delta = 0; warn = 'negative'; }
    const newLast = mode === 'add' ? round6(prev + Math.max(0, value)) : Math.max(prev, value);
    return { studentId: r.studentId, prev, value, delta, picos: Math.round(delta * rate), warn, newLast };
  });
}

// ランキング：1人あたり獲得ピコ（チーミメンバーの earned 合計 ÷ 人数）。
// teams:[{id,members:[studentId]}]  earned: {studentId: 累計獲得ピコ} または (id)=>数
export function rankTeams(teams, earned) {
  const get = typeof earned === 'function' ? earned : id => +(earned || {})[id] || 0;
  const list = teams.map(t => { const count = t.n > 0 ? t.n : t.members.length, total = t.members.reduce((a, id) => a + get(id), 0), per = total / Math.max(1, count); return { team: t, count, total, per, score: per }; });
  list.sort((a, b) => b.score - a.score || b.total - a.total);
  list.forEach((r, i) => { r.rank = i > 0 && r.score === list[i - 1].score ? list[i - 1].rank : i + 1; r.gap = i === 0 ? 0 : list[i - 1].score - r.score; });
  return { list };
}
// 個人ランキング：students:[{id,name,earned}] → earned の多い順（同点は同順位）
export function rankPeople(students) {
  const list = students.map(s => ({ student: s, score: Math.max(0, +s.earned || 0) })).sort((a, b) => b.score - a.score);
  list.forEach((r, i) => { r.rank = i > 0 && r.score === list[i - 1].score ? list[i - 1].rank : i + 1; r.gap = i === 0 ? 0 : list[i - 1].score - r.score; });
  return { list };
}

// ===== 校舎掲示（担任助手PCだけで使う。本名はこの端末の名簿から引き、サーバーには送らない）=====
// teams：確定したチーミ（members＝me- の uid）、students：me-（uid, nick, earned, staff, retired）、realOf：uid → 本名（名簿とひもづいていなければ null）
export function boardData({ teams, students, realOf }) {
  const P = new Map(students.map(s => [s.uid, { uid: s.uid, nick: String(s.nick || ''), earned: Math.max(0, +s.earned || 0), staff: !!s.staff, retired: !!s.retired, real: (realOf && realOf(s.uid)) || null, team: null }]));
  teams.forEach(t => t.members.forEach(u => { const p = P.get(u); if (p) p.team = t; }));
  const tr = rankTeams(teams, u => (P.get(u) || {}).earned || 0).list.map(r => Object.assign(r, { people: r.team.members.map(u => P.get(u)).filter(Boolean) }));
  const cand = [...P.values()].filter(p => !p.staff && !p.retired);
  const people = rankPeople(cand.filter(p => p.real).map(p => Object.assign(p, { id: p.uid }))).list.map(r => Object.assign(r.student, { rank: r.rank, score: r.score }));
  const unreg = cand.filter(p => !p.real).sort((a, b) => b.earned - a.earned);
  return { teams: tr, people, unreg };
}
// 上位 N 位まで（同点で N 位に並んだ人は全員入れる）
export const topRanks = (list, n) => list.filter(r => r.rank <= n);
// 名前の出し方：real＝本名 / nick＝ニックネーム / both＝本名（ニックネーム）。ひもづけていない人は「未登録」
export function boardName(p, mode) {
  const nk = p.nick || '（ニックネームなし）';
  if (mode === 'nick') return nk;
  if (!p.real) return mode === 'both' ? '未登録（' + nk + '）' : '未登録';
  return mode === 'both' ? p.real + '（' + nk + '）' : p.real;
}
// CSV（Excel で開けるように BOM つき・カンマや改行は "" で囲む）
export function toCsv(rows) {
  const q = v => { const s = v == null ? '' : String(v); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return '﻿' + rows.map(r => r.map(q).join(',')).join('\r\n') + '\r\n';
}
