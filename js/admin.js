// 担任助手モード（管理画面）：名簿 / チーミ編成 / 向上得点 / 在校時間 / 設定
// 本名(name)・名簿の番号(id)が見えるのはこの画面の中だけ。内部では uid で人を指す。
import { h, fmt, modal, closeModal, confirmDlg, toast, openSheet, closeSheet, emptyBox} from './ui.js?v=202611131634';
import { parseRoster, planRoster, parseScores, planScores, idKey, nameKey, sheetsToRosterText } from './parse.js?v=202611131634';
import { newTeam, newStudent, nextTeamId, confirmTeamHouse, defaultState, exportJSON, importJSON, clearAll } from './store.js?v=202611131634';
import { baseSize, ITEMS, ITEM, LTD_ITEMS } from './data.js?v=202611131634';
import { cleanMission, phaseOf, rangeText, condText, localTeamStatus, weekDraft, cleanNotices, NOTICE_KIND, shortDate, dayInfo, startText, GAME_START } from './mission.js?v=202611131634';
import { teamDetailDlg, hue } from './screens.js?v=202611131634';
import { SV, newCode, adminRpc, adminSync, admSaveLocal, admExport, admImport, mergeAdmin, errText, SvError, NEED_UPDATE, vaultRekey, vaultPush, vaultState } from './server.js?v=202611131634';
import { passOk, isWeakPass, STUDENT_URL } from './vault.js?v=202611131634';
import { dailyCard, dailyUnlockDlg, moveLinkedDlg, retireDlg, resetNickDlg, homeAlerts, launchCard, exportCard, launchResetDlg, chooseOperator, startPassed, importSum, lastImport, sameDayImport, laterLoad, laterSave, laterUpdate, fmtAt, FIX_HINT, LAUNCH_PHRASE } from './admin2.js?v=202611131634';
import { pinHash } from './me.js?v=202611131634';
import { faceImg, pinPad } from './meui.js?v=202611131634';
import { qrSvg } from './qr.js?v=202611131634';
import { posterTab } from './poster.js?v=202611131634';

export const actx = { itemIcon: null, visit: null, getS: null, setS: null, save: null, refresh: null, onUnlock: null, adminCheck: null, reload: null, editStaff: null, staffList: null, houseHi: null };   // main.js が結びつける
export const adminPreset = p => Object.assign(A, p);
export const openQuickTeam = () => quickTeamDlg();
const actxUI = () => ({ go: t => { A.tab = t; paint(); }, paint, save, tag: (c, t) => tag(c, t), S: () => S(), reload: () => actx.reload() });
const S = () => (SV.on && SV.adm) ? SV.adm : actx.getS();
// 保存：サーバー版は 名簿(本名つき)を この端末の localStorage に置き、チーミの名前と人数だけサーバーへ送る
let admT = 0;
function save() {
  if (SV.on && SV.adm) { admSaveLocal(SV.adm); clearTimeout(admT); admT = setTimeout(() => adminSync().catch(e => failSv(e)), 400); } else actx.save();
}
function failSv(e) { console.error(e); toast(e instanceof SvError && e.kind === 'schema' ? 'サーバーの準備がまだです' : e instanceof SvError && e.kind === 'offline' ? 'サーバーにつながらないよ' : 'サーバーのエラー：' + (e.message || e), 'ng'); }
async function rpcA(name, args) { try { const r = await adminRpc(name, args); if (!r.ok) { toast(errText(r.err), 'ng'); return null; } return r; } catch (e) { failSv(e); return null; } }
const A = { tab: 'home', rosterText: '', scoreText: '', stayText: '', scoreMode: 'cum', stayMode: 'cum', fix: {} };
const teamOf = uid => S().teams.find(t => t.members.includes(uid));
const stu = uid => S().students.find(s => s.uid === uid);
const stuByRid = rid => S().students.find(s => idKey(s.id) === idKey(rid));
const TABS = [['home', 'ホーム'], ['roster', '名簿'], ['teams', 'チーミ編成'], ['pins', '番号を忘れたとき'], ['staffme', '担任助手me-'], ['score', '向上得点'], ['stay', '在校時間'], ['event', '特別ピコ'], ['mission', 'ミッション'], ['gift', 'QRプレゼント'], ['poster', '掲示'], ['notice', 'お知らせ'], ['set', '設定']];
const tabList = () => SV.on ? [TABS[0], TABS[1], TABS[2], ['link', 'ひもづけ'], ...TABS.slice(3)] : TABS;
const operatorNames = () => (actx.staffList ? actx.staffList() : []).map(x => x.nick).filter(Boolean);
const hc = t => Math.max(t.members.filter(u => !(stu(u) || {}).retired).length, t.plan | 0);   // チーミの人数（名簿の人数と、人数だけ決めた予定の大きいほう）
let sheetBody = null;
// 名簿のバックアップが別のPCと衝突して、まとめ直したとき
SV.onMerge = () => { toast('別のPCが先に保存していたので、名簿をまとめました', 'ok'); if (sheetBody && sheetBody.isConnected) paint(); };

// ===== パスワード（サーバー版は8〜64文字。昔の4けたは変更されるまで通る） =====
export function openAdminGate() {
  const inp = h('input', { type: 'password', placeholder: 'パスワード', autocomplete: 'current-password', cls: 'pass', 'aria-label': '担任助手のパスワード' });
  const body = h('div', {}, [h('p', { text: '担任助手のパスワードを入れてね' }), inp]);
  let busy = false;
  const go = async () => {
    if (!inp.value || busy) return; busy = true;
    const ok = await actx.adminCheck(inp.value); busy = false;
    if (ok === 'schema') { closeModal(); return; }
    if (ok) { closeModal(); if (actx.onUnlock) await actx.onUnlock(); if (SV.on) await chooseOperator(operatorNames()); openAdmin(); }
    else { toast('パスワードがちがうよ', 'ng'); inp.value = ''; }
  };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  modal('担任助手モード', body, [h('button', { cls: 'btn', text: 'やめる', onclick: closeModal }), h('button', { cls: 'btn coral', text: 'ひらく', onclick: go })]);
  setTimeout(() => inp.focus(), 50);
}
export function openAdmin(tab) {
  GF.list = null;   // QRプレゼントの一覧は開くたびに読み直す
  if (tab) A.tab = tab;
  sheetBody = openSheet('担任助手モード', () => { }, () => actx.refresh());
  paint();
}
function paint() {
  const body = sheetBody; if (!body) return; const st = body.scrollTop; body.innerHTML = '';
  const tabs = h('div', { cls: 'adm-tabs' }); tabList().forEach(([k, n]) => tabs.appendChild(h('button', { cls: 'adm-tab' + (A.tab === k ? ' on' : ''), text: n, onclick: () => { A.tab = k; paint(); body.scrollTop = 0; } })));
  body.appendChild(tabs);
  const pane = h('div', { cls: 'adm-pane' }); body.appendChild(pane);
  ({ home: homeTab, roster: rosterTab, teams: teamsTab, link: linkTab, pins: pinsTab, staffme: staffTab, mission: missionTab, notice: noticeTab, event: eventTab, gift: giftTab, poster: p => posterTab(p, { S: S(), G: actx.getS(), server: SV.on, paint, houseHi: actx.houseHi, printRoot, A }), score: p => importTab(p, 'score'), stay: p => importTab(p, 'stay'), set: setTab })[A.tab](pane);
  body.scrollTop = st;
}
const tag = (cls, text) => h('span', { cls: 'tag ' + cls, text });
const ta = (val, ph, on) => { const e = h('textarea', { cls: 'ta', rows: '6', placeholder: ph, spellcheck: 'false' }); e.value = val; e.addEventListener('input', () => on(e.value)); return e; };
const full = s => s.name + (s.nick ? '（' + s.nick + '）' : '');
const fmtMin = m => { m = Math.round(m); return m >= 60 ? Math.floor(m / 60) + '時間' + (m % 60 ? m % 60 + '分' : '') : m + '分'; };

// ===== ホーム：担任助手モードを開いて最初に出る画面。よく使う4つを大きなボタンで =====
function homeTab(pane) {
  const S0 = S(), nLinked = S0.students.filter(s => s.link).length, pend = SV.on ? SV.rows.filter(r => !r.approved).length : 0;
  const btn = (cls, ico, title, sub, on, badge) => h('button', { cls: 'home-btn ' + cls, onclick: on }, [h('span', { cls: 'hb-ico', text: ico }), h('span', { cls: 'hb-t', text: title }), h('span', { cls: 'hb-s', text: sub }), badge ? h('span', { cls: 'hb-badge', text: badge }) : null]);
  homeAlerts(actxUI()).forEach(n => pane.appendChild(n));
  const grid = h('div', { cls: 'home-grid' });
  grid.appendChild(btn('coral', '📋', '向上得点を貼り付ける', 'Excelからコピー → 貼るだけ', () => { A.tab = 'score'; paint(); }));
  grid.appendChild(btn('mint', '⏱', '在校時間を貼り付ける', '100分で1,000ピコ', () => { A.tab = 'stay'; paint(); }));
  grid.appendChild(btn('', '＋', 'チーミを作る', '名前・人数だけで始められる', () => quickTeamDlg()));
  if (SV.on) grid.appendChild(btn('', '🧑', '＋ 生徒を1人追加', '途中参加：名簿とチーミに1回で', () => addOneDlg()));
  grid.appendChild(SV.on ? btn('', '🔗', 'ひもづけ', 'me- と名簿の人を結ぶ', () => { A.tab = 'link'; paint(); }, pend ? '承認まち ' + pend : '') : btn('', '👥', '名簿を入れる', '本名・番号はこの画面だけ', () => { A.tab = 'roster'; paint(); }));
  pane.appendChild(grid);
  // 生徒が家に入ったときと同じ画面を、お試しの「勝又チーミ」で見る（新しいタブ。サーバーには書かない）
  pane.appendChild(h('div', { cls: 'acts-row home-sub demo-row' }, [h('button', { cls: 'btn sm mint demo-open', title: '生徒が見る画面（お試し・保存されません）', onclick: () => { window.open(location.pathname + '?demo=katsumata', '_blank'); } }, [h('span', { text: '👀' }), h('span', { cls: 'demo-t', text: '生徒が見る画面を見る（勝又チーミ）' })])]));
  const vs = vaultState();
  pane.appendChild(h('div', { cls: 'stats home-stats' }, [tag('', '名簿 ' + S0.students.length + '人'), tag('', 'チーミ ' + S0.teams.length), SV.on ? tag(nLinked ? 'ok' : 'warn', 'me-を作った人 ' + nLinked + '/' + S0.students.length + '人') : null, SV.on && pend ? tag('warn', '承認まち ' + pend + '人') : null,
    vs === 'ok' ? tag('ok', '名簿バックアップ済み') : vs === 'noserver' ? tag('warn', 'バックアップ：サーバー更新が必要') : vs === 'blocked' ? tag('warn', 'バックアップを開けませんでした') : null]));
  { const lc = launchCard(actxUI()); if (lc) pane.appendChild(lc); }
  if (SV.on && SV.operator) pane.appendChild(h('div', { cls: 'hint op-chip' }, [h('span', { text: '操作している人：' }), h('b', { text: SV.operator }), h('button', { cls: 'btn sm', text: '変える', onclick: async () => { await chooseOperator(operatorNames()); paint(); } })]));
  if (isWeakPass(SV.on ? SV.adminPass : S0.settings.passcode)) pane.appendChild(h('div', { cls: 'warnbox' }, [h('b', { text: 'パスワードを8文字以上に変えてね' }), SV.on ? h('span', { text: '（8文字以上にすると、名簿がどのPCでも開けるようになります）' }) : null, h('span', { cls: 'sp' }), h('button', { cls: 'btn sm mint', text: '設定へ', onclick: () => { A.tab = 'set'; paint(); } })]));
  if (SV.on && S0.students.length && !nLinked) pane.appendChild(h('div', { cls: 'warnbox' }, [h('b', { text: '得点を入れるには、先に「ひもづけ」をしてね' })]));
  pane.appendChild(h('div', { cls: 'acts-row home-sub' }, [h('button', { cls: 'btn sm', text: 'くわしく編成', onclick: () => { A.tab = 'teams'; paint(); } }), h('button', { cls: 'btn sm', text: '名簿', onclick: () => { A.tab = 'roster'; paint(); } }), h('button', { cls: 'btn sm', text: 'ミッション', onclick: () => { A.tab = 'mission'; paint(); } }), h('button', { cls: 'btn sm', text: '🎁 特別ピコ', onclick: () => { A.tab = 'event'; paint(); } }), h('button', { cls: 'btn sm', text: '🎟 QRプレゼント', onclick: () => { A.tab = 'gift'; paint(); } }), h('button', { cls: 'btn sm', text: 'お知らせ', onclick: () => { A.tab = 'notice'; paint(); } }), h('button', { cls: 'btn sm', text: '設定', onclick: () => { A.tab = 'set'; paint(); } })]));
}
// 「＋ チーミを作る」：名前・あいことば・人数（またはメンバー）を入れて「作って始める」1回で、作成＋確定まで。名簿は先でも後でもOK
function quickTeamDlg() {
  const S0 = S(), un = S0.students.filter(s => !teamOf(s.uid)), sel = new Set();
  const name = h('input', { type: 'text', maxlength: '12', value: 'チーミ' + (S0.teams.length + 1), 'aria-label': 'チーミ名' });
  const code = h('input', { type: 'text', inputmode: 'numeric', maxlength: '4', value: newCode(), 'aria-label': 'あいことば' });
  const cnt = h('input', { type: 'number', min: '1', max: '40', value: '5', inputmode: 'numeric', 'aria-label': '人数' });
  let auto = un.length > 0;
  const info = h('div', { cls: 'hint' });
  const upd = () => { const n = Math.max(+cnt.value || 0, sel.size), lv = n ? baseSize(n) : 0; info.textContent = n ? n + '人 → 家の広さは ' + lv + '×' + lv + ' から始まります' : '人数を入れてね'; };
  code.addEventListener('input', () => { code.value = code.value.replace(/\D/g, '').slice(0, 4); });
  cnt.addEventListener('input', () => { auto = false; upd(); });
  const field = (lb, el, extra) => h('label', { cls: 'field' }, [h('span', { text: lb }), extra ? h('div', { cls: 'qt-line' }, [el, extra]) : el]);
  const body = h('div', { cls: 'qt' }, [h('div', { cls: 'qt-row' }, [field('チーミ名', name), field('あいことば（4けた）', code, h('button', { cls: 'btn sm', text: 'ランダム', onclick: () => { code.value = newCode(); } })), field('人数', cnt)]), info]);
  if (!SV.on && !un.length) body.appendChild(h('div', { cls: 'warnbox' }, [h('b', { text: 'この端末だけで使うときは、先に「名簿」を入れてね' }), h('span', { cls: 'sp' }), h('button', { cls: 'btn sm mint', text: '名簿へ', onclick: () => { closeModal(); A.tab = 'roster'; paint(); } })]));
  if (un.length) {
    body.appendChild(h('div', { cls: 'sec', text: 'メンバー（名簿から選べます。あとで決めてもOK）' }));
    const box = h('div', { cls: 'qt-chips' });
    un.forEach(s => { const cb = h('input', { type: 'checkbox' }); cb.onchange = () => { cb.checked ? sel.add(s.uid) : sel.delete(s.uid); if (auto || +cnt.value < sel.size) cnt.value = String(Math.max(1, sel.size)); upd(); }; box.appendChild(h('label', { cls: 'schip qt-chip' }, [cb, h('span', { cls: 'nm', text: s.name })])); });
    body.appendChild(box);
  } else if (SV.on) body.appendChild(h('div', { cls: 'hint', text: '名簿がなくてもOK。人数だけ入れれば作れます。メンバーは、生徒が自分で me- を作ったあと「ひもづけ」で名簿の人と結びます。' }));
  upd();
  let busy = false;
  const go = h('button', { cls: 'btn coral', text: '作って始める', onclick: async () => {
    if (busy) return;
    const nm = name.value.trim().slice(0, 12), n = Math.max(+cnt.value || 0, sel.size);
    if (!nm) { toast('チーミ名を入れてね', 'ng'); return; }
    if (!/^\d{4}$/.test(code.value)) { toast('あいことばは4けたの数字だよ', 'ng'); return; }
    if (!(n >= 1) || n > 40) { toast('人数は1〜40で入れてね', 'ng'); return; }
    if (!SV.on && !sel.size) { toast('メンバーを選んでね', 'ng'); return; }
    busy = true; go.disabled = true;
    const t = newTeam(nextTeamId(S0), nm); t.code = code.value; t.members = [...sel]; if (n > t.members.length) t.plan = n;
    S0.teams.push(t);
    try {
      if (SV.on) {
        admSaveLocal(SV.adm); await adminSync();
        const r = await adminRpc('admin_team_confirm', { p_id: t.id }); if (!r.ok) throw new SvError('server', errText(r.err));
        await actx.reload();
      } else { confirmTeamHouse(t); save(); }
    } catch (e) { busy = false; go.disabled = false; S0.teams = S0.teams.filter(x => x !== t); failSv(e); return; }
    closeModal(); paint();
    const lv = baseSize(n);
    modal('チーミを作りました', h('div', {}, [h('p', { text: '「' + nm + '」 ' + n + '人・家は ' + lv + '×' + lv + ' から始まります。' }), h('p', {}, ['あいことばは ', h('b', { cls: 'qt-code', text: code.value }), ' です。生徒に教えてね。']),
      h('p', { cls: 'hint', text: SV.on ? '生徒は最初の画面の「＋ はじめての人：me-をつくる」で自分の me- を作ります。そのあと「ひもづけ」で名簿の人と結ぶと、得点が入ります。' : '生徒はチーミを選んで、あいことばを入れて入ります。' })]),
      [SV.on ? h('button', { cls: 'btn mint', text: 'ひもづけへ', onclick: () => { closeModal(); A.tab = 'link'; paint(); } }) : null, h('button', { cls: 'btn', text: 'とじる', onclick: closeModal })]);
  } });
  modal('チーミを作る', body, [h('button', { cls: 'btn', text: 'やめる', onclick: closeModal }), go], 'wide');
}

// 「＋ 生徒を1人追加」（途中参加）：名簿に1人足す → チーミに入れる、を1つの画面で。ボタン1回で終わる
function addOneDlg() {
  const S0 = S(), teams = S0.teams;
  if (!teams.length) { toast('先にチーミを作ってね', 'ng'); return; }
  const idIn = h('input', { type: 'text', maxlength: '20', autocomplete: 'off', placeholder: '例）1234', 'aria-label': '名簿の番号' });
  const nameIn = h('input', { type: 'text', maxlength: '30', autocomplete: 'off', placeholder: '例）山田 太郎', 'aria-label': '氏名' });
  const sel = h('select', { 'aria-label': 'チーミ' }); teams.forEach(t => sel.appendChild(h('option', { value: t.id, text: t.name + '（' + hc(t) + '人' + (t.confirmed ? '' : '・未確定') + '）' })));
  const info = h('div', { cls: 'hint' }), upd = () => { const t = teams.find(x => x.id === sel.value); info.textContent = t && t.confirmed ? '確定済みのチーミです。本人は、チーミの画面で自分の名前を選んで me- を作れます。' : '未確定のチーミです。先に「チーミ編成」で確定すると、本人が名前を選んで me- を作れるようになります。'; };
  sel.onchange = upd; upd();
  const field = (lb, el) => h('label', { cls: 'field' }, [h('span', { text: lb }), el]);
  let busy = false;
  const go = h('button', { cls: 'btn coral', text: '追加する', onclick: async () => {
    if (busy) return; const id = idIn.value.trim(), nm = nameIn.value.trim();
    if (!id || !nm) { toast('名簿の番号と氏名を入れてね', 'ng'); return; }
    if (S0.students.some(x => idKey(x.id) === idKey(id))) { toast('その番号の人はもう名簿にいます', 'ng'); return; }
    busy = true; go.disabled = true;
    const t = teams.find(x => x.id === sel.value), st = newStudent(id, nm); S0.students.push(st); t.members.push(st.uid);
    save();
    closeModal(); paint();
    modal('追加しました', h('div', {}, [h('p', {}, [h('b', { text: st.name }), '（' + st.id + '）を「' + t.name + '」に入れました。']), SV.on ? h('p', { text: t.confirmed ? '本人は、チーミの画面で自分の名前を選んで me- を作れます。' : 'チーミを確定すると、名前を選べるようになります。' }) : null]),
      [h('button', { cls: 'btn', text: 'とじる', onclick: closeModal }), h('button', { cls: 'btn', text: '続けてもう1人', onclick: () => { closeModal(); addOneDlg(); } })]);
  } });
  modal('生徒を1人追加', h('div', { cls: 'qt' }, [field('名簿の番号', idIn), field('氏名', nameIn), field('チーミ', sel), info]), [h('button', { cls: 'btn', text: 'やめる', onclick: closeModal }), go]);
  setTimeout(() => idIn.focus(), 50);
}

// ===== (a) 名簿 =====
const ROSTER_ST = { add: ['ok', '新規'], keep: ['ok', '更新'], exists: ['warn', '登録済み'], dup: ['ng', '重複'], noname: ['ng', '名前なし'], ok: ['ok', 'OK'], team: ['', 'チーミ'] };
function rosterTab(pane) {
  pane.appendChild(h('p', { cls: 'hint', text: 'Excel・スプレッドシートからコピーして貼り付けてね（CSV・1行1名の名前だけ もOK）。1行目が見出し（生徒番号/氏名/かな/学年/チーミ）なら自動で判定します。本名と番号はこの画面にしか出ません（生徒の画面にはニックネームだけ）。' }));
  // 校舎の「チーミ一覧」Excel：ファイルを選ぶだけで、全部のシート（チーミ一覧・チーミ未加入生徒）をまとめて読む。貼り付けでもよい
  const fileIn = h('input', { type: 'file', accept: '.xlsx,.xls,.csv', hidden: '' });
  fileIn.addEventListener('change', async () => {
    const f = fileIn.files && fileIn.files[0]; fileIn.value = ''; if (!f) return;
    try {
      const X = await import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/xlsx.mjs');   // Excel を読む道具（このボタンを押したときだけ読み込む）
      const wb = X.read(await f.arrayBuffer(), { type: 'array' });
      const r = sheetsToRosterText(wb.SheetNames.map(n => ({ name: n, rows: X.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: false, defval: '' }) })));
      if (!r.used.length) { toast('名簿の見出し（氏名・生徒番号）が見つかりませんでした', 'ng'); return; }
      A.rosterText = r.text; paint();
      toast('「' + f.name + '」の ' + r.used.join('・') + ' を読み込みました。下の表を確かめて「追加」を押してね', 'ok');
    } catch (e) { console.error(e); toast('ファイルを読み込めませんでした（' + (e.message || e) + '）', 'ng'); }
  });
  pane.appendChild(h('div', { cls: 'warnbox roster-how' }, [
    h('b', { text: '校舎の「チーミ一覧」の Excel は、ファイルを選ぶだけで読み込めます' }),
    h('button', { cls: 'btn coral', text: '📂 Excel ファイルから読み込む', onclick: () => fileIn.click() }), fileIn,
    h('span', { text: '全部のシート（低学年チーミ一覧・チーミ未加入生徒）をまとめて読みます。「チーム名」の行がチーミの見出しになり、その下の生徒がそのチーミに入ります（チーム担任助手・人数も読みます）。未加入の人はチーミなしで入ります。コピーして下の欄に貼り付けても同じです。' })
  ]));
  const prev = h('div', { cls: 'prev' });
  const area = ta(A.rosterText, '例）\nチーム名\t種別\tチーム担任助手\t人数\t生徒番号\t学年\t氏名\tかな\n石井新高2①\t低学年\t石井\t3名\n\t\t\t\t82961808\t高1\t山田太郎\tヤマダタロウ', v => { A.rosterText = v; update(); });
  pane.appendChild(area); pane.appendChild(prev);
  const cur = h('div', { cls: 'cur-roster' }); pane.appendChild(cur);
  function update() {
    prev.innerHTML = '';
    if (A.rosterText.trim()) {
      const parsed = parseRoster(A.rosterText), plan = planRoster(parsed, S().students, 'add'), st = plan.stats;
      const colName = { id: '番号', name: '氏名', kana: 'かな', grade: '学年', team: 'チーミ', staff: '担任助手', kind: '種別', count: '人数' };
      const nTeams = Object.keys(parsed.teams || {}).length;
      prev.appendChild(h('div', { cls: 'stats' }, [
        tag('', parsed.stats.lines - parsed.stats.empty + '行'), tag('ok', '新規 ' + st.add + '人'), nTeams ? tag('ok', 'チーミ ' + nTeams + 'つ') : null, st.exists ? tag('warn', '登録済み ' + st.exists) : null, st.dup ? tag('ng', '重複 ' + st.dup) : null, st.noname ? tag('ng', '名前なし ' + st.noname) : null, st.empty ? tag('', '空行 ' + st.empty + '（除外）') : null,
        tag('', (parsed.header ? '見出しあり：' : '見出しなし：') + Object.keys(parsed.cols).map(k => colName[k]).filter(Boolean).join('・'))
      ]));
      // 見出しの「人数」と、実際に読めた生徒の数がちがうチーミ（コピーのし忘れ・空行のまちがいなど）
      if ((parsed.mismatch || []).length) prev.appendChild(h('div', { cls: 'warnbox' }, [h('b', { text: '人数が合わないチーミがあります' }), h('span', { text: parsed.mismatch.map(t => t + '（見出し ' + parsed.teams[t].count + '名・読めた ' + parsed.teams[t].actual + '名）').join('、') })]));
      const tbl = h('table', { cls: 'tbl' }); tbl.appendChild(h('tr', {}, ['行', '状態', '番号', '氏名', 'かな', '学年', 'チーミ'].map(t => h('th', { text: t }))));
      plan.rows.slice(0, 300).forEach(r => {
        const [c, t] = ROSTER_ST[r.status] || ['', r.status];
        if (r.status === 'team') { tbl.appendChild(h('tr', { cls: 'team-row' }, [h('td', { text: r.line }), h('td', {}, [tag(c, t)]), h('td', { colspan: '5', cls: 'nm' }, [h('b', { text: r.team }), h('span', { text: '　' + [r.staff ? '担任助手：' + r.staff : '', r.count != null ? r.count + '名' : ''].filter(Boolean).join('・') })])])); return; }
        tbl.appendChild(h('tr', { cls: c === 'ng' ? 'bad' : '' }, [h('td', { text: r.line }), h('td', {}, [tag(c, t)]), h('td', { text: r.id }), h('td', { cls: 'nm', text: r.name }), h('td', { cls: 'nm', text: r.kana }), h('td', { text: r.grade }), h('td', { cls: 'nm', text: r.team })]));
      });
      prev.appendChild(h('div', { cls: 'tbl-wrap' }, [tbl]));
      if (plan.rows.length > 300) prev.appendChild(h('div', { cls: 'hint', text: '（先頭300行だけ表示。取り込みは全部です）' }));
      const ta2 = planTeamAssign(parsed, S()), nMove = ta2.filter(r => r.status === 'move').length, nLock = ta2.filter(r => r.status === 'locked').length;
      if (parsed.cols.team != null && ta2.length) prev.appendChild(h('div', { cls: 'stats' }, [tag('ok', 'チーミを反映できる ' + nMove + '人'), ta2.filter(r => r.status === 'same').length ? tag('', 'すでに同じ ' + ta2.filter(r => r.status === 'same').length) : null, nLock ? tag('warn', '移せない ' + nLock + '（確定済み／ひもづけ済み）') : null, ta2.filter(r => r.status === 'nomatch').length ? tag('warn', '名簿にいない ' + ta2.filter(r => r.status === 'nomatch').length + '（先に「追加」）') : null]));
      prev.appendChild(h('div', { cls: 'acts-row' }, [
        parsed.cols.team != null ? h('button', { cls: 'btn', text: 'チーミを反映（' + nMove + '人）', title: '登録済みの人に、貼り付けのチーミ列を反映します（なければチーミも作ります）', onclick: applyTeamAssign, disabled: nMove ? null : '' }) : null,
        h('button', { cls: 'btn mint', text: '追加（' + st.add + '人）', onclick: () => applyRoster('add'), disabled: st.add ? null : '' }),
        h('button', { cls: 'btn coral', text: '置き換え', onclick: () => applyRoster('replace'), disabled: parsed.stats.ok ? null : '' })]));
    }
    cur.innerHTML = '';
    const sts = S().students;
    cur.appendChild(h('div', { cls: 'sec', text: 'いまの名簿（' + sts.length + '人）' }));
    if (!sts.length) cur.appendChild(h('div', { cls: 'hint', text: 'まだ誰もいません' }));
    const g = h('div', { cls: 'chipwrap' });
    sts.forEach(s => {
      const t = teamOf(s.uid);
      g.appendChild(h('span', { cls: 'schip' + (t ? ' in' : '') + (s.staff ? ' staff' : ''), title: s.id + (s.nick ? ' / ' + s.nick : '') }, [h('span', { cls: 'nm', text: (s.staff ? '★' : '') + s.name }), s.nick ? h('span', { cls: 'nk', text: s.nick }) : null,
        h('button', { cls: 'st' + (s.staff ? ' on' : ''), text: s.staff ? '★担任助手' : '担任助手にする', title: '担任助手にすると、名前の前に★が付きます', 'aria-label': s.name + (s.staff ? 'を生徒にもどす' : 'を担任助手にする'), onclick: async () => {
          if (SV.on) {   // サーバー版：★はサーバーの me- につく（ひもづけ済みの人だけ）
            if (!s.link) { toast('先に「ひもづけ」をしてね', 'ng'); return; }
            if (!await rpcA('admin_set_staff', { p_uid: s.link, p_staff: !s.staff })) return; await actx.reload(); paint(); return;
          }
          s.staff = !s.staff; if (!s.staff) delete s.staff; actx.save(); paint();
        } }),
        s.pin ? h('button', { cls: 'rs', text: '番号を忘れた', 'aria-label': s.name + 'が4けたの番号を忘れたのでリセット', onclick: () => resetPin(s) }) : null,
        h('button', { cls: 'x', 'aria-label': s.name + 'を名簿から削除', text: '×', onclick: () => delStudent(s) })]));
    });
    cur.appendChild(g);
  }
  update();
}
async function resetPin(s) {
  if (!await confirmDlg(s.name + 'さんの4けたの番号をリセットします。次に入るときに、新しく決め直します。', 'リセットする')) return;
  if (SV.on) { if (!s.link || !await rpcA('admin_reset_pin', { p_uid: s.link })) return; await actx.reload(); } else delete s.pin;
  save(); toast('リセットしました（次回入室時に再設定）', 'ok'); paint();
}
// チーミ列だけを、いまの名簿の人に反映する計画（新規の人は「追加」で入る。ここは登録済みの人のチーミ割り当て）
// status: move(移す/入れる) / same(すでにそのチーミ) / locked(確定済みのチーミにいる・ひもづけ済みの人は、チーミ編成から移す) / nomatch(名簿にいない) / noteam(チーミ列なし)
function planTeamAssign(parsed, S0) {
  const byId = new Map(S0.students.map(s => [idKey(s.id), s])), byName = new Map();
  S0.students.forEach(s => { const k = nameKey(s.name); byName.set(k, byName.has(k) ? 'AMBIG' : s); });
  const rows = [], seen = new Set();
  parsed.rows.filter(r => r.status === 'ok').forEach(r => {
    const tn = (r.team || '').trim().slice(0, 12); const o = { line: r.line, name: r.name, team: tn, status: 'nomatch', s: null };
    let s = (r.id && byId.get(idKey(r.id))) || null; if (!s) { const x = byName.get(nameKey(r.name)); s = x && x !== 'AMBIG' ? x : null; }
    if (!tn) o.status = 'noteam'; else if (s && !seen.has(s.uid)) {
      seen.add(s.uid); o.s = s; const cur = teamOf(s.uid);
      if (cur && cur.name === tn) o.status = 'same';
      else if (cur && (cur.confirmed || s.link)) o.status = 'locked';
      else o.status = 'move';
    }
    rows.push(o);
  });
  return rows;
}
async function applyTeamAssign() {
  const S0 = S(), rows = planTeamAssign(parseRoster(A.rosterText), S0).filter(r => r.status === 'move');
  if (!rows.length) return;
  let made = 0;
  rows.forEach(r => {
    let t = S0.teams.find(x => x.name === r.team);
    if (!t) { t = newTeam(nextTeamId(S0), r.team); S0.teams.push(t); made++; }
    S0.teams.forEach(x => { x.members = x.members.filter(u => u !== r.s.uid); });
    t.members.push(r.s.uid);
  });
  A.rosterText = ''; save(); toast(rows.length + '人のチーミを反映' + (made ? '（チーミ ' + made + ' つ作成）' : '') + 'しました。「チーミ編成」でまとめて確定できます', 'ok'); paint();
}
async function applyRoster(mode) {
  const S0 = S(), parsed = parseRoster(A.rosterText), plan = planRoster(parsed, S0.students, mode);
  const byRid = new Map(S0.students.map(s => [idKey(s.id), s]));
  if (mode === 'replace') {
    const ok = await confirmDlg('名簿を ' + S0.students.length + '人 から ' + plan.students.length + '人 に置き換えます。' + (plan.removed.length ? 'いなくなる ' + plan.removed.length + '人は、チーミからも外れます。' : '') + 'よろしいですか？', '置き換える');
    if (!ok) return;
    const gone = new Set(plan.removed.map(r => (byRid.get(idKey(r)) || {}).uid).filter(Boolean));
    S0.teams.forEach(t => { t.members = t.members.filter(u => !gone.has(u)); });
    if (SV.on) for (const r of plan.removed) { const o = byRid.get(idKey(r)); if (o && o.link) await rpcA('admin_delete_me', { p_uid: o.link }); }
  }
  const old = new Map(S0.students.map(s => [idKey(s.id), s]));
  S0.students = plan.students.map(s => { const o = old.get(idKey(s.id)); return o ? Object.assign(o, s, { uid: o.uid }) : Object.assign(newStudent(s.id, s.name), s); });
  const byId2 = new Map(S0.students.map(s => [idKey(s.id), s]));
  let made = 0;
  for (const name in plan.groups) {   // チーミ列 → 仮のチーミ（確定前）
    let t = S0.teams.find(x => x.name === name);
    if (!t) { t = newTeam(nextTeamId(S0), name.slice(0, 12)); S0.teams.push(t); made++; }
    const info = plan.teams && plan.teams[name];   // ブロック形式の見出しの「人数」＝予定の人数（家の広さ・費用の計算に使う）
    if (info && info.count) t.plan = Math.max(t.plan | 0, info.count);
    plan.groups[name].forEach(rid => { const s = byId2.get(idKey(rid)); if (s && !teamOf(s.uid)) t.members.push(s.uid); });
  }
  A.rosterText = ''; save();
  toast((mode === 'add' ? plan.stats.add + '人を追加' : plan.students.length + '人に置き換え') + (made ? '、チーミ ' + made + ' つ作成' : '') + 'しました', 'ok'); paint();
}
async function delStudent(s) {
  const t = teamOf(s.uid);
  if (!await confirmDlg(s.name + 'さんを名簿から消します。' + (t ? '（' + t.name + ' からも外れます）' : '') + '持っているピコ・持ち物もなくなります。', '消す')) return;
  if (SV.on && s.link) await rpcA('admin_delete_me', { p_uid: s.link });
  S().students = S().students.filter(x => x !== s); S().teams.forEach(x => { x.members = x.members.filter(u => u !== s.uid); }); save(); paint();
}

// ===== (b) チーミ編成 =====
async function moveStudent(uid, toId) {
  const S0 = S(), from = teamOf(uid), to = toId ? S0.teams.find(t => t.id === toId) : null;
  if ((from || null) === (to || null)) return;
  const s0 = stu(uid);
  if (SV.on && s0 && s0.link) {   // ひもづけ済み：サーバー上の家・財布が動くので、専用の「チーミ移動」
    if (!to || !to.confirmed) { toast('ひもづけ済みの人は、確定済みのチーミにだけ移せます', 'ng'); return; }
    if (await moveLinkedDlg(actxUI(), s0, from, to)) paint(); return;
  }
  if ((from && from.confirmed) || (to && to.confirmed)) {
    const nm = stu(uid).name, who = (to && to.confirmed) ? to : from;
    if (!await confirmDlg(who.name + ' はもう家づくり中です。' + nm + 'さんを' + (to ? to.name + 'に入れ' : from.name + 'から外し') + 'ますか？', 'うごかす')) return;
  }
  if (from) from.members = from.members.filter(x => x !== uid);
  if (to) to.members.push(uid);
  save(); paint();
}
function assignDlg(s) {
  const S0 = S(), cur = teamOf(s.uid), body = h('div', { cls: 'picklist' });
  const opt = (label, sub, on, active) => body.appendChild(h('button', { cls: 'btn pickbtn' + (active ? ' mint' : ''), onclick: () => { closeModal(); on(); } }, [h('span', { cls: 'a', text: label }), h('span', { cls: 'b', text: sub })]));
  opt('未所属にもどす', '', () => moveStudent(s.uid, null), !cur);
  S0.teams.forEach(t => opt(t.name, t.members.length + '人' + (t.confirmed ? '・確定済み' : ''), () => moveStudent(s.uid, t.id), cur === t));
  if (!S0.teams.length) body.appendChild(h('p', { text: 'まずチーミを追加してね' }));
  modal(s.name + ' さんの行き先', body, [h('button', { cls: 'btn', text: 'やめる', onclick: closeModal })]);
}
function stuChip(s) {
  const c = h('button', { cls: 'schip pick' + (s.staff ? ' staff' : '') + (s.retired ? ' retired' : ''), draggable: 'true', title: s.id, onclick: () => assignDlg(s) }, [h('span', { cls: 'nm', text: (s.staff ? '★' : '') + s.name }), s.retired ? h('span', { cls: 'st on', text: '休止' }) : null]);
  c.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', s.uid); e.dataTransfer.effectAllowed = 'move'; c.classList.add('drag'); });
  c.addEventListener('dragend', () => c.classList.remove('drag'));
  return c;
}
function dropZone(el, toId) {
  el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('over'); });
  el.addEventListener('dragleave', () => el.classList.remove('over'));
  el.addEventListener('drop', e => { e.preventDefault(); el.classList.remove('over'); const id = e.dataTransfer.getData('text/plain'); if (id && stu(id)) moveStudent(id, toId); });
}
function teamsTab(pane) {
  const S0 = S(), un = S0.students.filter(s => !teamOf(s.uid));
  pane.appendChild(h('button', { cls: 'btn coral bigact', text: '＋ チーミを作る（名前・あいことば・人数だけでOK）', onclick: () => quickTeamDlg() }));
  pane.appendChild(h('p', { cls: 'hint', text: 'ここは「くわしく編成」です。名簿の人をチーミに入れたり、ドラッグで動かしたいときに使います。' }));
  const wrap = h('div', { cls: 'tm-wrap' }); pane.appendChild(wrap);
  const left = h('div', { cls: 'tm-un' }, [h('div', { cls: 'sec', text: '未所属（' + un.length + '人）' })]); dropZone(left, null);
  const g = h('div', { cls: 'chipwrap' }); un.forEach(s => g.appendChild(stuChip(s))); left.appendChild(g);
  if (!S0.students.length) g.appendChild(h('div', { cls: 'hint', text: '名簿はあとからでもOK（「名簿」タブで入れられます）' }));
  else if (!un.length) g.appendChild(h('div', { cls: 'hint', text: 'みんな所属しています' }));
  left.appendChild(h('div', { cls: 'hint', text: '生徒をタップ→行き先を選ぶ（PCはドラッグもOK）' }));
  wrap.appendChild(left);
  const right = h('div', { cls: 'tm-right' }); wrap.appendChild(right);
  right.appendChild(h('div', { cls: 'tm-bar' }, [h('div', { cls: 'sec', text: 'チーミ（' + S0.teams.length + '）' }), SV.on && S0.teams.filter(t => !t.confirmed && hc(t)).length > 1 ? h('button', { cls: 'btn sm coral', text: '未確定の ' + S0.teams.filter(t => !t.confirmed && hc(t)).length + ' チーミをまとめて確定', onclick: () => confirmAllTeams() }) : null, h('button', { cls: 'btn sm mint', text: '＋ チーミを追加', onclick: () => { const t = newTeam(nextTeamId(S0), 'チーミ' + (S0.teams.length + 1)); S0.teams.push(t); save(); paint(); } })]));
  const grid = h('div', { cls: 'tm-grid' }); right.appendChild(grid);
  S0.teams.forEach(t => {
    const card = h('div', { cls: 'tm-card' + (t.confirmed ? ' conf' : ''), style: '--hu:' + hue(t.id) }); dropZone(card, t.id);
    const nm = h('input', { type: 'text', maxlength: '12', value: t.name, 'aria-label': 'チーミ名' }); nm.addEventListener('change', () => { t.name = nm.value.trim().slice(0, 12) || t.name; nm.value = t.name; save(); });
    card.appendChild(h('div', { cls: 'tm-hd' }, [nm, h('span', { cls: 'cnt', text: hc(t) + '人' })]));
    const mem = h('div', { cls: 'chipwrap' }); t.members.forEach(u => { const s = stu(u); if (s) mem.appendChild(stuChip(s)); });
    if (!t.members.length) mem.appendChild(h('div', { cls: 'hint', text: t.plan ? '人数だけ決めてあります（生徒が me- を作ったら「ひもづけ」で名簿の人と結びます）' : 'ここにメンバーを入れてね' }));
    card.appendChild(mem);
    // あいことば：チーミを選んだあとに入れる4けた。メンバーにだけ教える
    card.appendChild(h('div', { cls: 'tm-code' }, [h('span', { text: 'あいことば' }), h('b', { text: t.code || '----' }),
      h('button', { cls: 'btn sm', text: '変える', onclick: async () => { const v = await pinPad(t.name + 'の新しいあいことば', 'チーミのメンバーだけに教えてね'); if (v == null) return;
        if (SV.on) {   // サーバーにはハッシュだけ。控え（平文）はこの端末の名簿にだけ置く
          await adminSync().catch(failSv);
          if (!await rpcA('admin_team_set_code', { p_id: t.id, p_code: v })) return; t.code = v; t.hasCode = true; save(); toast('あいことばを ' + v + ' にしました', 'ok'); paint(); return;
        }
        t.code = v; actx.save(); toast('あいことばを ' + v + ' にしました', 'ok'); paint(); } })]));
    const ft = h('div', { cls: 'tm-ft' });
    ft.appendChild(t.confirmed ? tag('ok', '確定ずみ') : h('button', { cls: 'btn sm coral', text: '確定して家づくり開始', onclick: () => confirmTeam(t) }));
    if (SV.on && t.confirmed) { const un = t.members.filter(u => !(stu(u) && stu(u).link)).length; ft.appendChild(un ? tag('warn', '未ひもづけ ' + un + '人') : tag('ok', '全員ひもづけ済み')); }
    ft.appendChild(h('span', { cls: 'sp' }));
    if (t.confirmed) ft.appendChild(h('button', { cls: 'btn sm', text: '詳細', onclick: () => teamDetailDlg(t, true) }));
    if (t.confirmed) ft.appendChild(h('button', { cls: 'btn sm mint', text: '家を見る', onclick: () => { closeSheet(); actx.visit(t.id); } }));
    ft.appendChild(h('button', { cls: 'btn sm', text: '削除', onclick: () => delTeam(t) }));
    card.appendChild(ft); grid.appendChild(card);
  });
  if (!S0.teams.length) grid.appendChild(h('div', { cls: 'hint', text: '「＋ チーミを追加」で作ってね' }));
}
async function confirmTeam(t) {
  if (!hc(t)) { toast('人数を決めてから確定してね', 'ng'); return; }
  const lv = baseSize(hc(t));
  if (!await confirmDlg(t.name + '（' + hc(t) + '人）で確定します。家の広さは ' + lv + '×' + lv + ' から始まります。確定すると生徒の画面に出て、家づくりが始まります。', '確定する')) return;
  if (SV.on) {
    await adminSync().catch(failSv); if (!await rpcA('admin_team_confirm', { p_id: t.id })) return; await actx.reload();
    toast(t.name + ' の家づくりを始めました', 'ok'); paint(); return;
  }
  confirmTeamHouse(t); save(); toast(t.name + ' の家づくりを始めました', 'ok'); paint();
}
// 未確定のチーミ（人数が決まっているもの）をまとめて確定：名簿を一括で入れたあとの1回操作用。確定すると生徒の画面に出て、名前えらびも始まる
async function confirmAllTeams() {
  const list = S().teams.filter(t => !t.confirmed && hc(t));
  if (!list.length) return;
  if (!await confirmDlg(list.length + ' チーミ（' + list.reduce((a, t) => a + hc(t), 0) + '人）をまとめて確定します。確定すると生徒の画面に出て、家づくりと名前えらびが始まります。', '確定する')) return;
  await adminSync().catch(failSv); let n = 0;
  for (const t of list) { const r = await adminRpc('admin_team_confirm', { p_id: t.id }).catch(e => { failSv(e); return null; }); if (!r || !r.ok) { if (r) toast(errText(r.err), 'ng'); break; } n++; }
  await actx.reload(); toast(n + ' チーミの家づくりを始めました', n === list.length ? 'ok' : 'ng'); paint();
}
async function delTeam(t) {
  if (!await confirmDlg(t.name + 'を削除します。' + (t.confirmed ? '家のデータもすべて消えます。' : '') + 'メンバーは未所属に戻ります。', '削除する')) return;
  const S0 = S(); if (SV.on && t.confirmed !== undefined) { if (!await rpcA('admin_team_delete', { p_id: t.id })) return; }
  S0.teams = S0.teams.filter(x => x !== t); if (S0.cur && S0.cur.teamId === t.id) S0.cur.teamId = null; save(); paint();
}

// ===== (c)(d) 向上得点 / 在校時間（同じ画面・同じ読み取り）=====
const KIND = {
  score: { text: 'scoreText', mode: 'scoreMode', last: 'lastScore', title: '向上得点', unit: '点', val: v => String(v), rate: S0 => S0.settings.rate, ph: '例）\n山田太郎\t12.5\n佐藤花子\t8\n（番号つきの 101\t山田 太郎\t12.5 もOK）', hint: '「番号 or 氏名」と「向上得点」を貼り付けてね（Excel/CSV/「山田太郎 12.5」のような1行形式もOK）。0.1点きざみの小数もOKです。', base: '基準として記録（ピコは入れない・前回値だけ上書き。開始前の累計を基準にするとき）', cum: '累計として扱う（前回との差だけ加算）', add: '今回分としてそのまま加算', hd: '今回' },
  stay: { text: 'stayText', mode: 'stayMode', last: 'lastStay', title: '在校時間', unit: '分', val: fmtMin, rate: S0 => S0.settings.stayRate / 100, ph: '例）\n山田太郎\t1時間30分\n佐藤花子\t90\n（番号つきの 101\t山田 太郎\t90 もOK）', hint: '「番号 or 氏名」と「在校時間」を貼り付けてね（見出しは 在校時間/時間/分）。「1時間30分」「1:30」「90分」「90」どれでも分に直します。100分で1,000ピコ（設定で変えられます）。', base: '基準として記録（ピコは入れない・前回値だけ上書き。開始前の累計を基準にするとき）', cum: '累計として扱う（前回との差だけ加算）', add: '今回分としてそのまま加算', hd: '今回' }
};
// 最後の取り込み（日時・だれ・何人・合計ピコ）
function lastImportBox(log, kind, K) {
  const l = lastImport(log, kind);
  return h('div', { cls: 'lastimp' + (l ? '' : ' none') }, l ? [h('span', { cls: 'li-k', text: '最後の取り込み' }), h('b', { text: fmtAt(l.at) }), h('span', { text: l.by ? l.by + ' さん' : '（操作者の記録なし）' }), h('span', { text: (l.applied || []).length + '人' }), (l.mode === 'base' ? tag('', '基準') : h('b', { text: '+' + fmt(importSum(l)) + ' ピコ' }))] : [h('span', { cls: 'li-k', text: '最後の取り込み' }), h('span', { text: 'まだありません（' + K.title + '）' })]);
}
// あとで直す一覧：取り込めなかった行を残し、原因ごとに直し方を出す（この端末だけ。本名が入るのでサーバーには送らない）
function laterBox(box, kind, onChange) {
  const list = laterLoad().filter(x => x.kind === kind); if (!list.length) return;
  const K = KIND[kind];
  box.appendChild(h('div', { cls: 'sec', text: 'あとで直す一覧（' + list.length + '件）' }));
  const causes = [...new Set(list.map(x => x.status))];
  causes.forEach(c => {
    const rows = list.filter(x => x.status === c), hint = FIX_HINT[c] || [c, '', ''];
    box.appendChild(h('div', { cls: 'later-grp' }, [h('div', { cls: 'later-h' }, [h('b', { text: hint[0] }), h('span', { cls: 'sp' }), hint[2] ? h('button', { cls: 'btn sm mint', text: hint[1], onclick: () => { A.tab = hint[2]; paint(); } }) : null, c === 'unlinked' ? h('button', { cls: 'btn sm', text: 'ひもづけ', onclick: () => { A.tab = 'link'; paint(); } }) : null]),
      h('div', { cls: 'later-rows' }, rows.map(x => h('span', { cls: 'later-chip' }, [h('span', { text: x.label + (x.value !== '' ? '（' + (typeof x.value === 'number' ? K.val(x.value) : x.value) + '）' : '') }), h('button', { cls: 'x', 'aria-label': x.label + 'を一覧から消す', text: '×', onclick: () => { laterSave(laterLoad().filter(y => !(y.kind === x.kind && y.label === x.label && y.status === x.status))); onChange(); } })])))]));
  });
  box.appendChild(h('div', { cls: 'acts-row' }, [h('button', { cls: 'btn sm', text: '一覧をぜんぶ消す', onclick: () => { laterSave(laterLoad().filter(y => y.kind !== kind)); onChange(); } })]));
}
function importTab(pane, kind) {
  const K = KIND[kind];
  // 名簿・ひもづけが無いと貼っても何も起きないので、先に案内を出す
  const S1 = S(), nLinked = S1.students.filter(s => s.link).length;
  if (!S1.students.length || (SV.on && !nLinked)) pane.appendChild(h('div', { cls: 'warnbox' }, [h('b', { text: !S1.students.length ? '先に名簿を入れて' + (SV.on ? '、ひもづけしてね' : 'ね') : '先にひもづけしてね（ひもづけ済みの人だけに入ります）' }), h('span', { cls: 'sp' }),
    !S1.students.length ? h('button', { cls: 'btn sm mint', text: '名簿へ', onclick: () => { A.tab = 'roster'; paint(); } }) : null, SV.on ? h('button', { cls: 'btn sm mint', text: 'ひもづけへ', onclick: () => { A.tab = 'link'; paint(); } }) : null]));
  pane.appendChild(lastImportBox(S1.scoreLog, kind, K));
  pane.appendChild(h('p', { cls: 'hint', text: K.hint }));
  const area = ta(A[K.text], K.ph, v => { A[K.text] = v; A.fix = {}; update(); });
  pane.appendChild(area);
  const modes = h('div', { cls: 'modes' });
  [['cum', K.cum], ['add', K.add], ['base', K.base]].forEach(([k, n]) => {
    const lb = h('label', { cls: 'radio' }); const r = h('input', { type: 'radio', name: 'mode_' + kind }); r.checked = A[K.mode] === k; r.onchange = () => { A[K.mode] = k; update(); };
    lb.appendChild(r); lb.appendChild(h('span', { text: n })); modes.appendChild(lb);
  });
  pane.appendChild(modes);
  const prev = h('div', { cls: 'prev' }); pane.appendChild(prev);
  const logBox = h('div'); pane.appendChild(logBox);
  function update() {
    prev.innerHTML = ''; const S0 = S(), mode = A[K.mode], last = S0[K.last];
    if (A[K.text].trim()) {
      const parsed = parseScores(A[K.text], S0.students, { kind });   // 照合は名簿の番号/氏名。結果は uid に直す
      const rows = parsed.rows.map(r => { const o = Object.assign({}, r); if (o.studentId != null) { const s = stuByRid(o.studentId); o.studentId = s ? s.uid : null; } if ((o.status === 'unmatched' || o.status === 'ambig') && A.fix[o.line] && stu(A.fix[o.line])) Object.assign(o, { studentId: A.fix[o.line], status: 'ok', fixed: true }); return o; });
      const seen = new Set(); rows.forEach(r => { if (r.status === 'ok') { if (seen.has(r.studentId)) r.status = 'dup'; else seen.add(r.studentId); } });
      if (SV.on) rows.forEach(r => { if (r.status === 'ok' && !(stu(r.studentId) && stu(r.studentId).link)) r.status = 'unlinked'; });
      const okRows = rows.filter(r => r.status === 'ok'), plan = planScores(okRows, last, mode, K.rate(S0));
      const items = plan.map((p, i) => Object.assign(p, { row: okRows[i], team: teamOf(p.studentId), noBase: last[p.studentId] == null }));
      const bad = rows.filter(r => r.status !== 'ok'), noteam = items.filter(p => !p.team), sum = items.reduce((a, p) => a + p.picos, 0);
      // 基準：ピコは入らず、前回値だけ上書き ／ 累計：基準（前回値）がまだ無い人は、これまでの累計がすべてピコになる
      if (mode === 'base') prev.appendChild(h('div', { cls: 'warnbox' }, [h('b', { text: '基準として記録します（ピコは入りません）' }), h('span', { text: items.length + '人の前回値を、貼り付けた値で上書きします。このあと「累計」で取り込むと、ここから増えた分だけがピコになります。' })]));
      else if (mode === 'cum' && items.some(p => p.noBase)) prev.appendChild(h('div', { cls: 'warnbox' }, [h('b', { text: items.filter(p => p.noBase).length + '人は基準が未記録のため、これまでの累計がすべてピコになります' }), h('span', { text: '開始前の累計を基準にしたいときは、先に「基準として記録」で取り込んでください。' })]));
      prev.appendChild(h('div', { cls: 'stats' }, [tag('ok', '反映 ' + items.length + '人'), tag('ok', '合計 +' + fmt(sum) + ' ピコ'), noteam.length ? tag('warn', 'チーミ未所属 ' + noteam.length + '（本人には入ります）') : null, bad.length ? tag('ng', '読めない/照合なし ' + bad.length) : null, items.some(p => p.warn) ? tag('warn', 'マイナス差分あり(0扱い)') : null]));
      const tbl = h('table', { cls: 'tbl' }); tbl.appendChild(h('tr', {}, ['行', '生徒', '前回', K.hd, '増分', '獲得ピコ', 'チーミ'].map((t, i) => h('th', { text: t, cls: i >= 2 && i <= 5 ? 'n' : null }))));
      const byLine = new Map(items.map(p => [p.row.line, p]));
      rows.slice(0, 400).forEach(r => {
        const p = byLine.get(r.line);
        if (r.status === 'ok' && p) {
          const t = p.team;
          tbl.appendChild(h('tr', {}, [h('td', { text: r.line }), h('td', { cls: 'nm', text: stu(r.studentId).name + (r.fixed ? ' *' : '') }), h('td', { cls: 'n', text: K.val(p.prev) }), h('td', { cls: 'n', text: K.val(p.value) }), h('td', { cls: 'n' + (p.warn ? ' warn' : ''), text: (p.delta > 0 ? '+' : '') + K.val(p.delta) + (p.warn ? ' !' : '') }), h('td', { cls: 'n strong', text: '+' + fmt(p.picos) }), h('td', { cls: 'nm', text: t ? t.name : '未所属' })]));
        } else {
          const why = { unmatched: '照合できない', ambig: '同姓同名', badvalue: kind === 'stay' ? '時間が読めない' : '得点が読めない', dup: '同じ生徒が重複', unlinked: 'ひもづけ前（me-が未承認）' }[r.status] || r.status;
          const sel = h('select', { 'aria-label': r.label + 'の生徒を選ぶ' }); sel.appendChild(h('option', { value: '', text: '生徒を選ぶ…' })); S0.students.forEach(s => sel.appendChild(h('option', { value: s.uid, text: s.name + '（' + s.id + '）' })));
          sel.onchange = () => { A.fix[r.line] = sel.value; update(); };
          tbl.appendChild(h('tr', { cls: 'bad' }, [h('td', { text: r.line }), h('td', { cls: 'nm', text: r.label }), h('td', { colspan: '3', cls: 'nm', text: why + (r.value != null ? '（' + K.val(r.value) + '）' : '') }), h('td', { colspan: '2' }, [(r.status === 'unmatched' || r.status === 'ambig') ? sel : null])]));
        }
      });
      prev.appendChild(h('div', { cls: 'tbl-wrap' }, [tbl]));
      prev.appendChild(h('div', { cls: 'acts-row' }, [h('button', { cls: 'btn coral', text: mode === 'base' ? '基準を記録する（' + items.length + '人・ピコなし）' : '適用する（' + items.length + '人・+' + fmt(sum) + 'ピコ）', disabled: items.length ? null : '', onclick: () => applyImport(kind, items, bad) })]));
    }
    logBox.innerHTML = ''; const log = (S0.scoreLog || []).filter(l => (l.kind || 'score') === kind), lastE = log.find(l => !l.undone);
    logBox.appendChild(h('div', { cls: 'sec', text: '取り込みの履歴（' + K.title + '・直近 ' + Math.min(30, log.length) + '件）' }));
    if (!log.length) logBox.appendChild(h('div', { cls: 'hint', text: 'まだありません' }));
    log.slice(0, 30).forEach(l => logBox.appendChild(h('div', { cls: 'logrow' + (l.undone ? ' undone' : '') }, [h('span', { cls: 'lg-at', text: fmtAt(l.at) }), h('span', { cls: 'lg-by', text: l.by || '' }), h('span', { cls: 'lg-n', text: (l.applied || []).length + '人' }), (l.mode === 'base' ? tag('', '基準') : h('b', { text: '+' + fmt(importSum(l)) + ' ピコ' })), h('span', { cls: 'm', text: (l.mode === 'cum' ? '累計' : '今回分') + (l.undone ? '・取り消し済み' + (l.undoneBy ? '（' + l.undoneBy + '）' : '') : '') }),
      l === lastE ? h('button', { cls: 'btn sm', text: '取り消す', onclick: () => undoImport(kind, l) }) : null])));
    if (log.some(l => !l.undone && l !== lastE)) logBox.appendChild(h('div', { cls: 'hint', text: '取り消せるのは、いちばん新しい取り込みだけです（古い順に取り消してもピコの差分がずれないように）。' }));
    laterBox(logBox, kind, update);
  }
  update();
}
async function applyImport(kind, items, bad) {
  const S0 = S(), K = KIND[kind], mode = A[K.mode], nBad = bad.length;
  if (nBad) { if (!await confirmDlg(nBad + '行は読み取れず反映されません（「あとで直す一覧」に残します）。それ以外を適用しますか？', '適用する')) return; }
  // 基準：誤操作を防ぐため、ピコが入らないことをはっきり確認する
  if (mode === 'base' && !await confirmDlg('ピコは入りません。前回値を ' + items.length + '人分 上書きします（' + K.title + '）。あとで「取り消す」で元にもどせます。', '基準を記録する', '基準として記録')) return;
  // 累計：基準（前回値）がまだ無い人がいたら、これまでの累計がすべてピコになることを確認
  const nNoBase = mode === 'cum' ? items.filter(p => p.noBase).length : 0;
  if (nNoBase && !await confirmDlg(nNoBase + '人は基準が未記録のため、これまでの累計がすべてピコになります。このまま取り込みますか？', '取り込む', '基準が未記録の人がいます')) return;
  // 同じ日に同じ種類をもう取り込んでいたら確認（累計は前回との差だけ入るので二重にならない。「今回分」は足し算なので二重になる）
  const dup = mode === 'base' ? null : sameDayImport(S0.scoreLog, kind);
  if (dup && !await confirmDlg('今日 ' + fmtAt(dup.at) + ' に' + (dup.by ? ' ' + dup.by + ' さんが' : '') + '同じ種類（' + K.title + '）を取り込み済みです（' + (dup.applied || []).length + '人・+' + fmt(importSum(dup)) + 'ピコ）。' + (mode === 'cum' ? '「累計」の取り込みは前回との差だけが入るので、二重に加算されることはありません（同じ内容なら 0 ピコです）。' : '「今回分」の取り込みは足し算なので、同じ内容を貼ると二重に加算されます。') + 'もういちど取り込みますか？', '取り込む', '同じ日の2回目')) return;
  if (SV.on && !SV.operator) await chooseOperator(operatorNames());
  if (SV.on) {
    const entries = items.map(p => { const s = stu(p.studentId); return { uid: s.link, picos: p.picos, newLast: p.newLast }; });
    const r = await rpcA('admin_grant', { p_kind: kind, p_mode: mode, p_entries: entries }); if (!r) return;
    laterUpdate(kind, bad, items.map(p => p.row.label)); A[K.text] = ''; A.fix = {}; await actx.reload(); toast(mode === 'base' ? r.applied + '人ぶんの基準を記録しました（ピコは入れていません）' : r.applied + '人ぶん、合計 ' + fmt(items.reduce((a, x) => a + x.picos, 0)) + ' ピコを入れました', 'ok'); paint(); return;
  }
  const at = Date.now(), applied = [];
  items.forEach(p => {
    const s = stu(p.studentId); if (!s) return;
    applied.push({ studentId: s.uid, picos: p.picos, prevLast: S0[K.last][s.uid] == null ? null : S0[K.last][s.uid], newLast: p.newLast });
    s.picos = (s.picos || 0) + p.picos; s.earned = (s.earned || 0) + p.picos; S0[K.last][s.uid] = p.newLast;
  });
  S0.scoreLog.unshift({ at, kind, mode, rows: items.map(p => ({ studentId: p.studentId, value: p.value })), applied }); S0.scoreLog = S0.scoreLog.slice(0, 100);
  laterUpdate(kind, bad, items.map(p => p.row.label)); A[K.text] = ''; A.fix = {}; save(); toast(mode === 'base' ? applied.length + '人ぶんの基準を記録しました（ピコは入れていません）' : applied.length + '人ぶん、合計 ' + fmt(applied.reduce((a, x) => a + x.picos, 0)) + ' ピコを入れました', 'ok'); paint();
}
async function undoImport(kind, entry) {
  if (!await confirmDlg('直前の取り込み（' + entry.applied.length + '人）を取り消します。ピコはもどりますが、もう使ったぶんは0までしか引けません。', '元に戻す')) return;
  if (SV.on) { if (!await rpcA('admin_undo', { p_log: entry.id })) return; await actx.reload(); toast('元に戻しました', 'ok'); paint(); return; }
  const S0 = S(), K = KIND[kind];
  entry.applied.forEach(a => {
    const s = stu(a.studentId);
    if (s) { s.picos = Math.max(0, (s.picos || 0) - a.picos); s.earned = Math.max(0, (s.earned || 0) - a.picos); }
    if (a.prevLast == null) delete S0[K.last][a.studentId]; else S0[K.last][a.studentId] = a.prevLast;
  });
  entry.undone = true; save(); toast('元に戻しました', 'ok'); paint();
}

// ===== (e) 設定 =====
// ===== (g) 番号：生徒の4けたの番号を管理する =====
// 番号は生徒が me- を作るときに自分で決める（担任助手は配らない）。暗号（ハッシュ）で保存するので、いまの番号は見られない。
// 担任助手がさわるのは「本人が忘れたとき」だけ：リセット（次に入るとき本人が決め直す）か、変更（新しい番号を決めて本人に伝える）
async function loadPinStatus() { if (!SV.on) return; const r = await rpcA('admin_pin_status', {}); A.pinStatus = r ? r.status || {} : {}; paint(); }
function pinsTab(pane) {
  pane.appendChild(h('div', { cls: 'pin-policy' }, [h('b', { text: '4けたの番号は、生徒が me- を作るときに自分で決めます' }), h('span', { text: '担任助手が番号を配る必要はありません。ここでさわるのは、本人が番号を忘れたときだけです。' })]));
  pane.appendChild(h('p', { cls: 'hint', text: '番号は暗号にして保存しているので、担任助手でも「いまの番号」は見られません。忘れた人がいたら、その人の「番号を忘れた」から、リセット（次に入るとき本人が決め直す・おすすめ）か、番号の変更（新しい番号を決めて本人に伝える）を選んでください。まちがいが続いてロックされた人は「ロック解除」。「リセット」すると、次に入るときに本人が決め直します。' }));
  // 一覧：サーバー版はサーバーの me- 全員（ひもづけ済みなら本名も）、端末版は名簿で me- を作った人
  const rows = [];
  if (SV.on) {
    const byLink = new Map(S().students.filter(s => s.link).map(s => [s.link, s]));
    if (!A.pinStatus) { A.pinStatus = {}; loadPinStatus(); }
    SV.rows.forEach(r => { const st = A.pinStatus[r.uid] || {}, lk = byLink.get(r.uid); rows.push({ key: r.uid, team: r.teamId, name: lk ? lk.name : '（ひもづけ前）', nick: r.nick, me: r.me, staff: r.staff, retired: !!r.retired, pin: st.pin != null ? st.pin : !!r.pin, locked: !!st.locked, fails: st.fails | 0 }); });
  } else S().students.filter(s => s.me || s.pin).forEach(s => { const t = teamOf(s.uid); rows.push({ key: s.uid, team: t ? t.id : null, name: s.name, nick: s.nick, me: s.me, staff: s.staff, pin: !!s.pin, locked: false, fails: 0, local: s }); });
  if (!rows.length) { pane.appendChild(h('div', { cls: 'hint', text: 'まだ me- を作った人がいません' })); return; }
  if (SV.on) pane.appendChild(h('div', { cls: 'acts-row' }, [h('button', { cls: 'btn sm', text: '状態を読みなおす', onclick: () => loadPinStatus() })]));
  const teams = S().teams, groups = new Map();
  rows.forEach(r => { const k = r.team || ''; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); });
  groups.forEach((list, tid) => {
    const t = teams.find(x => x.id === tid), card = h('div', { cls: 'card lk-card', style: '--hu:' + hue(tid || 'x') }); card.appendChild(h('h4', { text: t ? t.name : 'チーミなし' }));
    list.forEach(r => {
      card.appendChild(h('div', { cls: 'lk-row pin-row' }, [
        r.me ? faceImg(r.me, 'face', 'mini') : h('span', { cls: 'mini none' }), h('b', { cls: 'lk-nick', text: (r.staff ? '★' : '') + (r.nick || 'まだ') }), h('span', { cls: 'pin-name', text: r.name }),
        r.retired ? tag('warn', '休止') : null, SV.on && SV.unlocks && SV.unlocks.has(r.key) ? tag('ok', '今日は解除') : null, r.locked ? tag('ng', 'ロック中') : r.pin ? tag('ok', '番号あり' + (r.fails ? '（まちがい' + r.fails + '回）' : '')) : tag('warn', '番号なし'),
        h('span', { cls: 'sp' }),
        r.locked ? h('button', { cls: 'btn sm', text: 'ロック解除', onclick: async () => { if (await rpcA('admin_unlock_pin', { p_uid: r.key })) { toast('ロックを解除しました', 'ok'); loadPinStatus(); } } }) : null,
        r.pin ? h('button', { cls: 'btn sm', text: '番号を忘れた', onclick: () => forgotPin(r) }) : h('span', { cls: 'hint', text: '次に入るとき本人が決めます' }),
        SV.on && !r.local && !r.staff && SV.dailyMin > 0 ? h('button', { cls: 'btn sm' + (SV.unlocks && SV.unlocks.has(r.key) ? ' mint' : ''), text: SV.unlocks && SV.unlocks.has(r.key) ? '解除を取り消す' : '今日だけ解除', title: '利用時間の制限を、今日だけ解除する', onclick: async () => { if (await dailyUnlockDlg(actxUI(), r, r.name)) loadPinStatus(); } }) : null,
        SV.on && !r.local ? h('button', { cls: 'btn sm', text: '名前を戻す', title: '不適切なニックネームを空にして、本人に付け直してもらう', onclick: async () => { if (await resetNickDlg(actxUI(), r, r.name)) loadPinStatus(); } }) : null,
        SV.on && !r.local && !r.staff ? h('button', { cls: 'btn sm' + (r.retired ? ' mint' : ''), text: r.retired ? '復帰' : '休止', title: '退塾・休止（戻せます）', onclick: async () => { if (await retireDlg(actxUI(), r, r.name)) loadPinStatus(); } }) : null
      ]));
    });
    pane.appendChild(card);
  });
}
// 「番号を忘れた」：リセット（おすすめ）か、新しい番号に変えて伝えるか
async function forgotPin(r) {
  const who = r.nick || r.name;
  modal(who + 'さんが番号を忘れたとき', h('div', { cls: 'pin-forgot' }, [
    h('button', { cls: 'ev-mode on', onclick: () => { closeModal(); resetPinRow(r); } }, [h('b', { text: '🔄 リセットする（おすすめ）' }), h('span', { text: '次にお家に入るとき、本人が新しい番号を自分で決めます' })]),
    h('button', { cls: 'ev-mode', onclick: () => { closeModal(); setPinFor(r); } }, [h('b', { text: '🔢 番号を変えて本人に伝える' }), h('span', { text: '担任助手が新しい4けたを決めて、その場で本人に伝えます' })])
  ]), [h('button', { cls: 'btn', text: 'やめる', onclick: closeModal })]);
}
async function setPinFor(r) {
  const v = await pinPad((r.nick || r.name) + 'の新しい番号', '本人に伝える4けたの数字を入れてね'); if (v == null) return;
  if (!await confirmDlg('「' + (r.nick || r.name) + '」の番号を ' + v + ' にします。本人に伝えてね（この画面を閉じると、もう見られません）', '決める')) return;
  if (SV.on) { if (!await rpcA('admin_set_pin', { p_uid: r.key, p_pin: v })) return; await actx.reload(); loadPinStatus(); }
  else { r.local.pin = pinHash(v, r.local.uid); save(); paint(); }
  toast('新しい番号は ' + v + ' です', 'ok');
}
async function resetPinRow(r) {
  if (!await confirmDlg('「' + (r.nick || r.name) + '」の番号をリセットします。次に入るときに、本人が新しく決め直します。', 'リセットする')) return;
  if (SV.on) { if (!await rpcA('admin_reset_pin', { p_uid: r.key })) return; await actx.reload(); loadPinStatus(); }
  else { delete r.local.pin; save(); paint(); }
  toast('リセットしました', 'ok');
}

// ===== (h) 担任助手 me-：家を見に行くときの自分の姿（★つきで歩く）=====
function staffTab(pane) {
  const list = actx.staffList ? actx.staffList() : [];
  pane.appendChild(h('p', { cls: 'hint', text: '担任助手として家を見に行くとき（「チーミ編成」→「家を見る」）の、自分の me- です。部屋では名前の前に★が付きます。担任助手が何人かいるときは、それぞれ作ってね。服やぼうしは、担任助手は無料で選べます。' }));
  const grid = h('div', { cls: 'staff-grid' }); pane.appendChild(grid);
  list.forEach(p => grid.appendChild(h('div', { cls: 'card staff-card' }, [
    p.me ? faceImg(p.me, 'full', 'staff-full') : h('div', { cls: 'staff-full none', text: '？' }), h('b', { text: '★' + (p.nick || '担任助手') }),
    h('div', { cls: 'acts-row' }, [h('button', { cls: 'btn sm mint', text: '見た目をかえる', onclick: () => actx.editStaff(p, () => paint()) }), h('button', { cls: 'btn sm', text: '削除', onclick: async () => {
      if (!await confirmDlg('「' + p.nick + '」の me- を消します。', '消す')) return;
      if (SV.on) { if (!await rpcA('admin_staff_delete', { p_id: p.id })) return; await actx.reload(); } else { const S0 = actx.getS(); S0.staffMes = (S0.staffMes || []).filter(x => x.id !== p.id); actx.save(); }
      paint();
    } })])
  ])));
  grid.appendChild(h('button', { cls: 'card staff-card add', onclick: () => actx.editStaff(null, () => paint()) }, [h('span', { cls: 'staff-full plus', text: '＋' }), h('b', { text: '担任助手の me- を作る' })]));
}

// ===== (i) 週間ミッション：作る・受講コマ数を記録する =====
// チーミ全員が条件を達成すると、生徒はひとりずつ報酬（ピコ・アイテム）を受け取れる。コマ数（ひとりひとりの数）はこの画面にだけ出す
const missionsOf = () => SV.on ? (SV.missions || []) : (actx.getS().missions = actx.getS().missions || []);
const REWARD_ITEMS = () => ITEMS.filter(d => (!d.free || d.ltd) && !d.pat);   // 非売品もミッションの報酬にできる
function missionTab(pane) {
  pane.appendChild(h('p', { cls: 'hint', text: 'チーミ全員が条件（受講コマ数）を達成すると、生徒の画面の「ミッション」で、ひとりずつ報酬を受け取れます。受講コマ数はここで記録してください（生徒の画面には「何人中何人が達成」だけが出ます）。' }));
  pane.appendChild(h('button', { cls: 'btn coral', text: '＋ 新しいミッション', onclick: () => missionEdit(null) }));
  const L = missionsOf().slice().sort((a, b) => b.start.localeCompare(a.start));
  if (!L.length) pane.appendChild(emptyBox('🎯', 'まだミッションがありません', '「新しいミッション」から作れます'));
  const teams = S().teams.filter(t => t.confirmed !== false);
  L.forEach(m => {
    const open = A.mission === m.id, it = m.item && ITEM[m.item];
    const sum = h('div', { cls: 'ms-teams' }, teams.map(t => { const st = teamStatusAdm(m, t); return tag(st.achieved ? 'ok' : st.done ? 'warn' : '', t.name + ' ' + st.done + '/' + st.total + (st.achieved ? ' ✓' : '')); }));
    const card = h('div', { cls: 'card ms-adm' + (open ? ' open' : '') }, [
      h('div', { cls: 'ms-hd' }, [h('span', { cls: 'tag ' + ({ now: 'ok', soon: '', over: 'dim' })[phaseOf(m)], text: ({ now: '実施中', soon: 'これから', over: '終わった' })[phaseOf(m)] }), h('b', { text: m.title }), h('span', { cls: 'ms-date', text: rangeText(m) })]),
      h('div', { cls: 'ms-cond', text: '条件：' + condText(m) + '　／　報酬（ひとりずつ）：' + ([m.picos ? fmt(m.picos) + ' ピコ' : '', it ? it.name : ''].filter(Boolean).join(' ＋ ') || 'なし') + '　／　受け取った人：' + (m.claims || []).length + '人' }),
      sum,
      h('div', { cls: 'acts-row' }, [
        h('button', { cls: 'btn sm mint', text: open ? 'コマ数の記録をとじる' : '受講コマ数を記録', onclick: () => { A.mission = open ? null : m.id; A.mcounts = null; A.mtext = ''; paint(); if (!open) loadCounts(m); } }),
        h('button', { cls: 'btn sm', text: '編集', onclick: () => missionEdit(m) }),
        h('button', { cls: 'btn sm', text: '削除', onclick: () => missionDelete(m) })
      ])
    ]);
    if (open) card.appendChild(countsEditor(m, teams));
    pane.appendChild(card);
  });
}
// 担任助手の画面でのチーミの達成（入力中のコマ数でその場で数える）
function teamStatusAdm(m, t) {
  const c = A.mission === m.id && A.mcounts ? A.mcounts : (SV.on ? null : m.counts);
  if (!c) return (m.teams && m.teams[t.id]) || { done: 0, total: t.members.length, achieved: false };
  return localTeamStatus(Object.assign({}, m, { counts: c }), t, uid => stu(uid));
}
async function loadCounts(m) {
  if (!SV.on) { A.mcounts = Object.assign({}, m.counts || {}); paint(); return; }
  const r = await rpcA('admin_mission_get', { p_id: m.id }); if (!r) return;
  const byLink = new Map(S().students.filter(s => s.link).map(s => [s.link, s.uid])), c = {};
  for (const k in (r.counts || {})) { const u = byLink.get(k); if (u) c[u] = r.counts[k]; }
  A.mcounts = c; paint();
}
function countsEditor(m, teams) {
  const box = h('div', { cls: 'ms-counts' });
  if (!A.mcounts) { box.appendChild(h('div', { cls: 'hint', text: '読み込み中…' })); return box; }
  const c = A.mcounts;
  // 貼り付け：「番号 or 氏名」と「コマ数」
  const prev = h('div', { cls: 'prev' });
  const area = ta(A.mtext || '', '貼り付けもできます（番号 or 氏名 と コマ数）\n例）\n101\t山田 太郎\t4\n102\t佐藤 花子\t3', v => { A.mtext = v; showPaste(); });
  function showPaste() {
    prev.innerHTML = ''; if (!(A.mtext || '').trim()) return;
    const p = parseScores(A.mtext, S().students), ok = p.rows.filter(r => r.status === 'ok' && r.value != null);
    prev.appendChild(h('div', { cls: 'stats' }, [tag('ok', '読めた ' + ok.length + '人'), p.rows.length - ok.length ? tag('ng', '読めない ' + (p.rows.length - ok.length) + '行') : null]));
    prev.appendChild(h('button', { cls: 'btn sm mint', text: '表に入れる', onclick: () => { ok.forEach(r => { const s = stuByRid(r.studentId); if (s) c[s.uid] = Math.max(0, Math.min(99, Math.round(r.value))); }); A.mtext = ''; paint(); } }));
  }
  box.appendChild(area); box.appendChild(prev); showPaste();
  teams.forEach(t => {
    const st = teamStatusAdm(m, t), tb = h('div', { cls: 'ms-team' });
    tb.appendChild(h('div', { cls: 'ms-team-hd' }, [h('b', { text: t.name }), tag(st.achieved ? 'ok' : '', st.done + ' / ' + st.total + '人 達成' + (st.achieved ? ' ✓ 全員クリア' : ''))]));
    t.members.map(stu).filter(Boolean).forEach(s => {
      const v = c[s.uid] || 0, okv = v >= m.need, noLink = SV.on && !s.link;
      const inp = h('input', { type: 'number', min: '0', max: '99', step: '1', inputmode: 'numeric', value: String(v), cls: 'ms-n' });
      const set = n => { n = Math.max(0, Math.min(99, Math.round(+n || 0))); if (n) c[s.uid] = n; else delete c[s.uid]; paint(); };
      inp.addEventListener('change', () => set(inp.value));
      tb.appendChild(h('div', { cls: 'ms-row' + (okv ? ' ok' : '') }, [
        h('span', { cls: 'ms-nm', text: full(s) }), noLink ? tag('warn', 'ひもづけ前') : null,
        h('button', { cls: 'btn sm', text: '−', onclick: () => set(v - 1) }), inp, h('button', { cls: 'btn sm', text: '＋', onclick: () => set(v + 1) }),
        h('span', { cls: 'ms-ok', text: okv ? '達成' : 'あと' + (m.need - v) })
      ]));
    });
    box.appendChild(tb);
  });
  box.appendChild(h('div', { cls: 'acts-row' }, [h('button', { cls: 'btn coral', text: '記録する', onclick: () => saveCounts(m) })]));
  if (SV.on) box.appendChild(h('p', { cls: 'hint', text: '「ひもづけ前」の人は、me- を作って「ひもづけ」が済むまでサーバーに記録できません（その人がいるチーミは全員クリアになりません）。' }));
  return box;
}
async function saveCounts(m) {
  const c = A.mcounts || {};
  if (SV.on) {
    const e = {}; S().students.forEach(s => { if (s.link) e[s.link] = c[s.uid] || 0; });
    if (!await rpcA('admin_mission_counts', { p_id: m.id, p_entries: e })) return;
    await actx.reload();
  } else { m.counts = Object.assign({}, c); actx.save(); }
  toast('受講コマ数を記録しました', 'ok'); paint();
}
function missionEdit(m) {
  const d = m || Object.assign(weekDraft(), { title: '週4コマ以上 受講しよう', need: 4, picos: 5000, item: 'trophy' });
  const title = h('input', { type: 'text', maxlength: '30', value: d.title || '' }), start = h('input', { type: 'date', value: d.start }), end = h('input', { type: 'date', value: d.end });
  const need = h('input', { type: 'number', min: '1', max: '99', value: String(d.need || 4), inputmode: 'numeric' }), picos = h('input', { type: 'number', min: '0', step: '100', value: String(d.picos || 0), inputmode: 'numeric' });
  const item = h('select', {}, [h('option', { value: '', text: 'なし' })].concat(REWARD_ITEMS().map(x => h('option', { value: x.id, text: x.name }))));
  item.value = d.item || '';
  const field2 = (lb, el, hint) => h('label', { cls: 'field' }, [h('span', { text: lb }), el, hint ? h('small', { text: hint }) : null]);
  const body = h('div', { cls: 'ms-form' }, [field2('ミッションの名前', title), h('div', { cls: 'ms-dates' }, [field2('はじまり', start), field2('おわり', end)]),
    field2('ひとりあたりの受講コマ数', need, 'チーミ全員がこの数以上で達成'), field2('報酬のピコ（ひとりずつ）', picos), field2('報酬のアイテム（ひとりずつ1つ）', item, '持ち物に入ります')]);
  modal(m ? 'ミッションを編集' : '新しいミッション', body, [h('button', { cls: 'btn', text: 'やめる', onclick: closeModal }), h('button', { cls: 'btn coral', text: '保存', onclick: async () => {
    const o = cleanMission({ id: m ? m.id : uniqMissionId('w' + (start.value || '').replace(/-/g, '')), title: title.value.trim() || 'ミッション', start: start.value, end: end.value, need: need.value, picos: picos.value, item: item.value });
    if (!o || !title.value.trim()) { toast('名前と期間（はじまり ≦ おわり）を入れてね', 'ng'); return; }
    if (SV.on) {
      if (!await rpcA('admin_mission_save', { p_id: o.id, p_title: o.title, p_starts: o.start, p_ends: o.end, p_need: o.need, p_picos: o.picos, p_item: o.item })) return;
      closeModal(); await actx.reload();
    } else {
      const L = missionsOf(), i = L.findIndex(x => x.id === o.id);
      if (i >= 0) L[i] = Object.assign(L[i], { title: o.title, start: o.start, end: o.end, need: o.need, picos: o.picos, item: o.item }); else L.push(Object.assign(o, { counts: {}, claims: [] }));
      closeModal(); actx.save();
    }
    toast('ミッションを保存しました', 'ok'); paint();
  } })]);
}
const uniqMissionId = base => { base = /^w\d{8}$/.test(base) ? base : 'm' + Date.now().toString(36); const ids = new Set(missionsOf().map(x => x.id)); let id = base, k = 2; while (ids.has(id)) id = base + '-' + k++; return id; };
async function missionDelete(m) {
  if (!await confirmDlg('ミッション「' + m.title + '」を消します。記録したコマ数も消えます（受け取った報酬はそのまま）。', '消す')) return;
  if (SV.on) { if (!await rpcA('admin_mission_delete', { p_id: m.id })) return; await actx.reload(); }
  else { const S0 = actx.getS(); S0.missions = (S0.missions || []).filter(x => x !== m); actx.save(); }
  if (A.mission === m.id) A.mission = null; paint();
}

function setTab(pane) {
  const S0 = S(), st = S0.settings;
  const field = (label, input, note) => h('div', { cls: 'fld' }, [h('label', { text: label }), input, note ? h('div', { cls: 'hint', text: note }) : null]);
  const rate = h('input', { type: 'number', min: '1', step: '1', value: String(st.rate), inputmode: 'numeric' });
  const stay = h('input', { type: 'number', min: '1', step: '1', value: String(st.stayRate), inputmode: 'numeric' });
  const mul = h('input', { type: 'number', min: '0.1', step: '0.1', value: String(st.priceMul), inputmode: 'decimal' });
  const pass = h('input', { type: 'password', maxlength: '64', autocomplete: 'new-password', placeholder: '変えるときだけ（半角 8〜64文字）' });
  const pass2 = h('input', { type: 'password', maxlength: '64', autocomplete: 'new-password', placeholder: 'もういちど' });
  pane.appendChild(h('div', { cls: 'card' }, [
    h('h4', { text: 'ピコとねだん' }),
    field('向上得点1点あたりのピコ', rate, '既定 10000（0.1点で1000ピコ）。次の取り込みから反映されます'),
    field('在校100分あたりのピコ', stay, '既定 1000（100分で1,000ピコ）。次の取り込みから反映されます'),
    field('物価倍率', mul, '家具のねだん ＝ もとのねだん × この数。既定 10（いす 5,000ピコ）'),
    h('h4', { text: 'パスワード' }), field('担任助手モードのパスワード', pass, '半角の英数字・記号で8〜64文字。' + (isWeakPass(SV.on ? SV.adminPass : st.passcode) ? 'いまは4けたなど短いので、変えてね。' : '')), field('もういちど（まちがい防止）', pass2),
    h('button', { cls: 'btn mint', text: '設定を保存', onclick: async () => {
      const r = +rate.value, m = +mul.value, sy = +stay.value;
      if (!(r >= 1) || !(m > 0) || !(sy >= 1)) { toast('数字を確かめてね', 'ng'); return; }
      if (pass.value || pass2.value) {
        if (!passOk(pass.value)) { toast('パスワードは半角の英数字・記号で8〜64文字にしてね', 'ng'); return; }
        if (pass.value !== pass2.value) { toast('2つのパスワードが同じじゃないよ', 'ng'); return; }
      }
      if (SV.on) {
        const ok1 = m === st.priceMul || await rpcA('admin_set_price_mul', { p_mul: m }); if (!ok1) return;
        if (pass.value) {
          let pr; try { pr = await adminRpc('admin_set_passcode', { p_new: pass.value }); } catch (e) { failSv(e); return; }
          if (!pr.ok) { toast(pr.err === 'bad' ? NEED_UPDATE : errText(pr.err), 'ng'); return; }   // 入力は確かめ済みなので bad は「サーバーが古い」
          SV.adminPass = pass.value; pass.value = pass2.value = '';
          try { await vaultRekey(); } catch (e) { failSv(e); }   // 新しいパスワードでバックアップを作りなおす
        }
        Object.assign(st, { rate: Math.round(r), stayRate: Math.round(sy), priceMul: m }); SV.priceMul = m; save(); toast('保存しました', 'ok'); paint(); return;
      }
      Object.assign(st, { rate: Math.round(r), stayRate: Math.round(sy), priceMul: m }); if (pass.value) st.passcode = pass.value; save(); toast('保存しました', 'ok'); paint();
    } })
  ]));
  if (SV.on) {   // サーバー版：名簿ファイル（本名つき・この端末の中だけ）の書き出し/読み込み
    const f2 = h('input', { type: 'file', accept: 'application/json,.json', hidden: '' });
    f2.onchange = () => { const f = f2.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = async () => { try { const a = admImport(rd.result); if (!await confirmDlg('この端末の名簿を、読み込んだ名簿ファイルで置き換えます。よろしいですか？（生徒 ' + a.students.length + '人・チーミ ' + a.teams.length + '）', '読み込む')) return; mergeAdmin(a, SV.rows, SV.teamRows, SV.priceMul); SV.adm = a; save(); toast('読み込みました', 'ok'); paint(); } catch (e) { toast('読み込めませんでした', 'ng'); } }; rd.readAsText(f); };
    const vs = vaultState(), VT = {
      weak: 'パスワードを8文字以上にすると、名簿がどのPCでも開けるようになります（暗号化してサーバーに保存。4けたのときはバックアップしません）。',
      ok: 'バックアップ済み' + (SV.vaultAt ? '（' + new Date(SV.vaultAt).toLocaleString('ja-JP') + '）' : '') + '。ほかのPCでも、同じパスワードで入ると名簿が開きます。',
      ready: 'このPCの名簿を、次に保存するときにバックアップします。', noserver: NEED_UPDATE + '。それまでバックアップはできません。',
      blocked: 'サーバーのバックアップを開けませんでした（別のパスワードで作られたかも）。上書きしないよう、このPCからは送りません。'
    };
    pane.appendChild(h('div', { cls: 'card' }, [
      h('h4', { text: '名簿の暗号化バックアップ' }),
      h('div', { cls: 'hint', text: VT[vs] || '' }),
      h('div', { cls: 'hint', text: 'パスワードから作った鍵で暗号化して送るので、サーバーには中身が読めません。パスワードを忘れると名簿は開けないので、名簿ファイル（下）の書き出しも ときどきしてね。' }),
      vs === 'ok' || vs === 'ready' ? h('button', { cls: 'btn sm', text: '今すぐバックアップ', onclick: async () => { try { if (await vaultPush()) toast('バックアップしました', 'ok'); else toast('バックアップできませんでした', 'ng'); } catch (e) { failSv(e); } paint(); } }) : null
    ]));
    pane.appendChild(h('div', { cls: 'card' }, [
      h('h4', { text: '名簿ファイル（本名つき）' }),
      h('div', { cls: 'acts-row' }, [
        h('button', { cls: 'btn', text: '書き出し（JSON）', onclick: () => { try { const d = new Date(), a = h('a', { href: URL.createObjectURL(new Blob([admExport(S())], { type: 'application/json' })), download: 'kojo-roster-' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '.json' }); document.body.appendChild(a); a.click(); a.remove(); } catch (e) { toast('書き出せませんでした', 'ng'); } } }),
        h('button', { cls: 'btn', text: '読み込み', onclick: () => f2.click() }), f2]),
      h('div', { cls: 'hint', text: '本名・番号・「どの me- が誰か」の対応表は、この端末の中にあります（サーバーには、暗号化したバックアップだけ）。別のPCへは、バックアップか、この書き出しで移せます。取り扱いに注意。' })
    ]));
    { const dc = dailyCard(actxUI()); if (dc) pane.appendChild(dc); }
    { const ec = exportCard(actxUI()); if (ec) pane.appendChild(ec); }
    pane.appendChild(h('details', { cls: 'card danger-zone' }, [h('summary', {}, [h('b', { text: '危険な操作' })]),
      h('div', { cls: 'hint' }, [startPassed() ? '運用開始日を過ぎています。いま実行すると、生徒の me-・家・ピコが本当に消えます。' : '運用開始の前に、確認用に作ったデータを消すための操作です。']),
      h('button', { cls: 'btn coral', text: startPassed() ? '本番のデータを消す…' : '確認用データを消して本番を始める…', onclick: () => launchResetDlg(actxUI()) })]));
    pane.appendChild(h('div', { cls: 'card' }, [h('h4', { text: '全リセット' }), h('div', { cls: 'hint', text: 'サーバーのチーミ・me-・家・得点と、この端末の名簿をすべて消します。' }), h('button', { cls: 'btn coral', text: 'すべて消して最初から', onclick: async () => {
      if (!await confirmDlg('サーバーのデータと、この端末の名簿をすべて消します。元に戻せません。', '次へ')) return;
      if (!await confirmDlg('本当にすべて消しますか？', '消す')) return;
      if (!await rpcA('admin_wipe', {})) return;
      mergeAdmin(Object.assign(S(), { students: [], teams: [], seq: 0 }), [], [], SV.priceMul); save(); await actx.reload(); toast('初期化しました', 'ok'); paint();
    } })]));
    return;
  }
  const file = h('input', { type: 'file', accept: 'application/json,.json', hidden: '' });
  file.onchange = () => { const f = file.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = async () => { try { const ns = importJSON(rd.result); if (!await confirmDlg('いまのデータを読み込んだデータで置き換えます。よろしいですか？（チーミ ' + ns.teams.length + '・生徒 ' + ns.students.length + '人）', '読み込む')) return; actx.setS(ns); save(); toast('読み込みました', 'ok'); paint(); } catch (e) { toast('読み込めませんでした', 'ng'); } }; rd.readAsText(f); };
  pane.appendChild(h('div', { cls: 'card' }, [
    h('h4', { text: 'データ' }),
    h('div', { cls: 'acts-row' }, [
      h('button', { cls: 'btn', text: '書き出し（JSON）', onclick: () => { try { const d = new Date(), a = h('a', { href: URL.createObjectURL(new Blob([exportJSON(S())], { type: 'application/json' })), download: 'kojo-house-' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '.json' }); document.body.appendChild(a); a.click(); a.remove(); } catch (e) { toast('書き出せませんでした', 'ng'); } } }),
      h('button', { cls: 'btn', text: '読み込み', onclick: () => file.click() }), file]),
    h('div', { cls: 'hint', text: 'このブラウザの中にだけ保存されています（本名・番号を含むので取り扱い注意）。ときどき書き出しておくと安心です。' })
  ]));
  pane.appendChild(h('div', { cls: 'card' }, [h('h4', { text: '全リセット' }), h('div', { cls: 'hint', text: '名簿・チーミ・家・得点のすべてを消します。' }), h('button', { cls: 'btn coral', text: 'すべて消して最初から', onclick: async () => {
    if (!await confirmDlg('名簿・チーミ・家・得点をすべて消します。元に戻せません。', '次へ')) return;
    if (!await confirmDlg('本当にすべて消しますか？', '消す')) return;
    clearAll(); actx.setS(defaultState()); save(); toast('初期化しました', 'ok'); paint();
  } })]));
}

// ===== (f) ひもづけ（承認）：チーミごとに、生徒が作った me- を 名簿の誰かに対応づける =====
function linkTab(pane) {
  const S0 = S(), teams = S0.teams.filter(t => t.confirmed);
  pane.appendChild(h('p', { cls: 'hint', text: '生徒が「＋ me-を作る」で作った me- を、名簿の人にひもづけます。ひもづけた人だけ、得点・在校時間が入ります。生徒が me- を作るときに「自分の名前」を選んだ人は、自動でひもづきます。ここは、名前が見つからず承認まちになった人用と、名前をまちがえた人の直し用です。まちがい・いたずらの me- は削除できます。' }));
  if (!teams.length) pane.appendChild(h('div', { cls: 'hint', text: '確定したチーミがまだありません（「チーミ編成」で確定してね）' }));
  teams.forEach(t => {
    const mem = t.members.map(stu).filter(Boolean), unlinked = mem.filter(m => !m.link), pending = SV.rows.filter(r => r.teamId === t.id && !r.approved);
    const card = h('div', { cls: 'card lk-card', style: '--hu:' + hue(t.id) });
    card.appendChild(h('h4', { text: t.name }));
    card.appendChild(h('div', { cls: 'stats' }, [tag('ok', 'ひもづけ済み ' + (mem.length - unlinked.length) + '人'), unlinked.length ? tag('warn', '未ひもづけ ' + unlinked.length + '人') : tag('ok', '全員ひもづけ済み'), pending.length ? tag('warn', '承認まち ' + pending.length) : tag('', '承認まち なし')]));
    if (!pending.length) card.appendChild(h('div', { cls: 'hint', text: 'いま承認まちの me- はありません' }));
    pending.forEach(r => {
      const sel = h('select', { 'aria-label': r.nick + 'は誰？' }); sel.appendChild(h('option', { value: '', text: '名簿の人を選ぶ…' }));
      unlinked.forEach(m => sel.appendChild(h('option', { value: m.uid, text: m.name + '（' + m.id + '）' })));
      card.appendChild(h('div', { cls: 'lk-row' }, [
        r.me ? faceImg(r.me, 'face', 'mini') : h('span', { cls: 'mini none' }), h('b', { cls: 'lk-nick', text: r.nick || 'まだ' }), sel,
        h('button', { cls: 'btn sm mint', text: 'ひもづける', onclick: async () => {
          const m = stu(sel.value); if (!m) { toast('名簿の人を選んでね', 'ng'); return; }
          if (!await confirmDlg('「' + r.nick + '」の me- は ' + m.name + ' さん、で確定します。', '確定する')) return;
          if (!await rpcA('admin_approve', { p_uid: r.uid })) return;
          m.link = r.uid; save(); await actx.reload(); toast(m.name + ' さんとひもづけました', 'ok'); paint();
        } }),
        h('button', { cls: 'btn sm', text: '削除', onclick: async () => { if (!await confirmDlg('「' + r.nick + '」の me- を消します（まちがい・いたずら用）。', '消す')) return; if (!await rpcA('admin_delete_me', { p_uid: r.uid })) return; await actx.reload(); paint(); } })
      ]));
    });
    if (unlinked.length) card.appendChild(h('div', { cls: 'hint lk-todo', text: 'まだ me- を作っていない人：' + unlinked.map(m => m.name).join('・') }));
    const done = mem.filter(m => m.link);
    if (done.length) {   // 名前をまちがえて選んだ人：はずすと「承認まち」にもどるので、正しい名簿の人にひもづけなおせる
      const det = h('details', { cls: 'lk-done' }, [h('summary', { text: 'ひもづけ済み ' + done.length + '人（まちがいを直す）' })]);
      done.forEach(m => {
        const r = SV.rows.find(x => x.uid === m.link);
        det.appendChild(h('div', { cls: 'lk-row' }, [h('b', { cls: 'lk-nick', text: m.name }), h('span', { cls: 'hint', text: '＝ ' + (r ? (r.nick || 'まだ') : '（いない）') }), h('span', { cls: 'sp' }),
          h('button', { cls: 'btn sm', text: 'はずす', title: '名簿との結びつきを外して、承認まちにもどす', onclick: async () => {
            if (!await confirmDlg('「' + m.name + '」さんと「' + (r ? r.nick : '') + '」のひもづけをはずします。「承認まち」にもどるので、正しい人にひもづけなおしてください。', 'はずす')) return;
            if (!await rpcA('admin_slot_free', { p_k: m.uid, p_uid: m.link })) return;
            m.link = null; save(); await actx.reload(); paint();
          } })]));
      });
      card.appendChild(det);
    }
    pane.appendChild(card);
  });
}

// ===== (j) 校舎のお知らせ（掲示板）・ゲームの開始日：生徒がチーミを選ぶ前に、全員が見る画面に出る =====
const noticesOf = () => SV.on ? (SV.notices || []) : (actx.getS().notices = actx.getS().notices || []);
const startOf = () => (SV.on ? SV.startDate : actx.getS().startDate) || GAME_START;
function noticeTab(pane) {
  pane.appendChild(h('p', { cls: 'hint', text: 'ここに書いたお知らせは、生徒がサイトを開いたとき、チーミを選ぶ前の「大事なお知らせ」の画面に出ます。イベント情報などを随時のせてください。「大事」はいちばん上に出ます。' }));
  // ゲームの開始日（その日までカウントダウン、その日から「何日目」）
  const d = dayInfo(startOf()), sd = h('input', { type: 'date', value: startOf(), cls: 'nt-start' });
  pane.appendChild(h('div', { cls: 'card nt-startbox' }, [
    h('b', { text: 'ゲームの開始日' }), sd,
    h('span', { cls: 'hint', text: d.before ? '今は「スタートまで あと' + d.left + '日」と出ています' : '今は「' + d.day + '日目」と出ています' }),
    h('button', { cls: 'btn sm mint', text: '保存', onclick: async () => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(sd.value)) { toast('日付を入れてね', 'ng'); return; }
      if (SV.on) { if (!await rpcA('admin_set_start_date', { p_date: sd.value })) return; await actx.reload(); } else { actx.getS().startDate = sd.value; actx.save(); }
      toast('開始日を ' + startText(sd.value) + ' にしました', 'ok'); paint();
    } })
  ]));
  pane.appendChild(h('button', { cls: 'btn coral', text: '＋ お知らせを書く', onclick: () => noticeEdit(null) }));
  const L = cleanNotices(noticesOf());
  if (!L.length) pane.appendChild(h('div', { cls: 'empty', text: 'まだお知らせはありません' }));
  L.forEach(n => pane.appendChild(h('div', { cls: 'card nt-adm' }, [
    h('div', { cls: 'nt-hd' }, [h('span', { cls: 'tag ' + NOTICE_KIND[n.kind][1], text: NOTICE_KIND[n.kind][0] }), h('b', { text: n.title }), n.date ? h('span', { cls: 'nt-date', text: '📅 ' + shortDate(n.date) }) : null]),
    n.body ? h('div', { cls: 'nt-body', text: n.body }) : null,
    h('div', { cls: 'acts-row' }, [h('button', { cls: 'btn sm', text: '編集', onclick: () => noticeEdit(n) }), h('button', { cls: 'btn sm', text: '削除', onclick: () => noticeDelete(n) })])
  ])));
}
function noticeEdit(n) {
  const kind = h('select', {}, Object.keys(NOTICE_KIND).map(k => h('option', { value: k, text: NOTICE_KIND[k][0] }))); kind.value = n ? n.kind : 'event';
  const title = h('input', { type: 'text', maxlength: '40', value: n ? n.title : '', placeholder: '例）冬の家具フェア' });
  const body = h('textarea', { cls: 'ta', rows: '4', maxlength: '400', placeholder: 'くわしい内容（400文字まで）' }); body.value = n ? n.body : '';
  const date = h('input', { type: 'date', value: n ? n.date : '' });
  const f = (lb, el, hint) => h('label', { cls: 'field' }, [h('span', { text: lb }), el, hint ? h('small', { text: hint }) : null]);
  modal(n ? 'お知らせを編集' : 'お知らせを書く', h('div', { cls: 'ms-form' }, [f('種類', kind, '「大事」はいちばん上に出ます'), f('タイトル', title), f('内容', body), f('イベントの日（あれば）', date)]), [
    h('button', { cls: 'btn', text: 'やめる', onclick: closeModal }),
    h('button', { cls: 'btn coral', text: '保存', onclick: async () => {
      const tt = title.value.trim(); if (!tt) { toast('タイトルを入れてね', 'ng'); return; }
      const dv = /^\d{4}-\d{2}-\d{2}$/.test(date.value) ? date.value : '';
      if (SV.on) { if (!await rpcA('admin_notice_save', { p_id: n ? +n.id : null, p_kind: kind.value, p_title: tt, p_body: body.value, p_date: dv || null })) return; closeModal(); await actx.reload(); }
      else {
        const L = noticesOf(), o = { id: n ? n.id : 'n' + Date.now().toString(36), at: n ? n.at : Date.now(), kind: kind.value, title: tt.slice(0, 40), body: body.value.slice(0, 400), date: dv };
        const i = L.findIndex(x => String(x.id) === String(o.id)); if (i >= 0) L[i] = o; else L.push(o); closeModal(); actx.save();
      }
      toast('お知らせを保存しました', 'ok'); paint();
    } })
  ]);
}
async function noticeDelete(n) {
  if (!await confirmDlg('お知らせ「' + n.title + '」を消します。', '消す')) return;
  if (SV.on) { if (!await rpcA('admin_notice_delete', { p_id: +n.id })) return; await actx.reload(); }
  else { const S0 = actx.getS(); S0.notices = (S0.notices || []).filter(x => String(x.id) !== String(n.id)); actx.save(); }
  paint();
}
// ===== 特別ピコ：ワークショップなどイベント参加の特例で、手でピコを配る（貼り付け欄とは別） =====
// 生徒へ（えらんだ人ひとりずつに同じピコ） か、チーミの貯金箱へ。理由はあとで履歴に出る。直前の1回は元に戻せる
const EV = { mode: 'stu', amount: 1000, note: '', earned: true, sel: new Set(), teams: new Set() };
const evOk = s => !s.retired && (!SV.on || !!s.link);   // サーバー版は ひもづけ済み（承認済み）の人だけ
function eventTab(pane) {
  const S0 = S(), teams = S0.teams.filter(t => t.confirmed || t.members.length);
  pane.appendChild(h('p', { cls: 'hint', text: 'ワークショップ・イベントに参加した人などに、特例でピコを配ります。向上得点・在校時間の貼り付けとは別に記録されます。' }));
  // 1) だれに
  const modes = h('div', { cls: 'ev-modes' });
  [['stu', '👤 生徒に配る', 'えらんだ人ひとりずつに'], ['bank', '🏠 チーミの貯金箱へ', '増築・部屋ふやしに使える']].forEach(([k, t, s]) => modes.appendChild(h('button', { cls: 'ev-mode' + (EV.mode === k ? ' on' : ''), onclick: () => { EV.mode = k; paint(); } }, [h('b', { text: t }), h('span', { text: s })])));
  pane.appendChild(modes);
  // 2) いくら・理由
  const amt = h('input', { type: 'number', min: '1', max: '1000000', step: '100', cls: 'ev-amt', 'aria-label': 'ピコ' }); amt.value = String(EV.amount);
  const note = h('input', { type: 'text', maxlength: '40', placeholder: '理由（例：英語ワークショップ参加）', cls: 'ev-note', 'aria-label': '理由' }); note.value = EV.note;
  const quick = h('div', { cls: 'ev-quick' }); [500, 1000, 3000, 5000, 10000].forEach(v => quick.appendChild(h('button', { cls: 'btn sm' + (EV.amount === v ? ' mint' : ''), text: fmt(v), onclick: () => { EV.amount = v; paint(); } })));
  pane.appendChild(h('div', { cls: 'card ev-form' }, [
    h('div', { cls: 'ev-row' }, [h('span', { cls: 'ev-k', text: EV.mode === 'stu' ? '1人あたり' : '1チーミあたり' }), amt, h('span', { text: 'ピコ' })]), quick,
    h('div', { cls: 'ev-row' }, [h('span', { cls: 'ev-k', text: '理由' }), note]),
    EV.mode === 'stu' ? (() => { const lb = h('label', { cls: 'chk' }), c = h('input', { type: 'checkbox' }); c.checked = EV.earned; c.onchange = () => { EV.earned = c.checked; }; lb.appendChild(c); lb.appendChild(h('span', { text: 'ランキング・ランクにも数える（ふつうはオン）' })); return lb; })() : null
  ]));
  // 3) えらぶ
  const list = h('div', { cls: 'ev-list' }); pane.appendChild(list);
  const foot = h('div', { cls: 'ev-foot' }); pane.appendChild(foot);
  const paintFoot = () => {
    foot.innerHTML = ''; const v = Math.floor(+amt.value || 0), n = EV.mode === 'stu' ? EV.sel.size : EV.teams.size;
    foot.appendChild(h('div', { cls: 'stats' }, [tag(n ? 'ok' : '', (EV.mode === 'stu' ? n + '人' : n + 'チーミ') + ' をえらんでいます'), n && v > 0 ? tag('ok', '合計 +' + fmt(n * v) + ' ピコ') : null]));
    foot.appendChild(h('div', { cls: 'acts-row' }, [h('button', { cls: 'btn coral', text: 'ピコを配る', disabled: n && v > 0 ? null : '', onclick: () => applyEvent() })]));
  };
  amt.addEventListener('input', () => { EV.amount = Math.max(0, Math.floor(+amt.value || 0)); paintFoot(); });
  note.addEventListener('input', () => { EV.note = note.value; });
  if (EV.mode === 'stu') {
    const groups = teams.map(t => ({ t, ms: t.members.map(stu).filter(Boolean) })), noTeam = S0.students.filter(s => !teamOf(s.uid));
    if (noTeam.length) groups.push({ t: null, ms: noTeam });
    if (!groups.some(g => g.ms.length)) list.appendChild(emptyBox('🙋', '名簿の生徒がいません', '先に名簿を入れてください'));
    groups.forEach(({ t, ms }) => {
      if (!ms.length) return;
      const ok = ms.filter(evOk), all = ok.length && ok.every(s => EV.sel.has(s.uid));
      const box = h('div', { cls: 'ev-team', style: t ? '--hu:' + hue(t.id) : '' });
      const head = h('label', { cls: 'chk ev-th' }), hc0 = h('input', { type: 'checkbox' }); hc0.checked = !!all; hc0.disabled = !ok.length;
      hc0.onchange = () => { ok.forEach(s => hc0.checked ? EV.sel.add(s.uid) : EV.sel.delete(s.uid)); paint(); };
      head.appendChild(hc0); head.appendChild(h('b', { text: t ? t.name : 'チーミなし' })); head.appendChild(h('span', { cls: 'ev-n', text: 'チーミ全員（' + ok.length + '人）' }));
      box.appendChild(head);
      const chips = h('div', { cls: 'ev-chips' });
      ms.forEach(s => {
        const can = evOk(s), lb = h('label', { cls: 'ev-chip' + (EV.sel.has(s.uid) ? ' on' : '') + (can ? '' : ' off'), title: can ? '' : (s.retired ? '休止中' : 'ひもづけ前（承認まち）') }), c = h('input', { type: 'checkbox' });
        c.checked = EV.sel.has(s.uid); c.disabled = !can; c.onchange = () => { c.checked ? EV.sel.add(s.uid) : EV.sel.delete(s.uid); lb.classList.toggle('on', c.checked); paintFoot(); };
        lb.appendChild(c); lb.appendChild(h('span', { text: s.name + (s.nick ? '（' + s.nick + '）' : '') }));
        chips.appendChild(lb);
      });
      box.appendChild(chips); list.appendChild(box);
    });
  } else {
    const chips = h('div', { cls: 'ev-chips ev-teams' });
    if (!teams.length) list.appendChild(emptyBox('🏠', 'チーミがありません', '先にチーミを作ってください'));
    teams.forEach(t => {
      const lb = h('label', { cls: 'ev-chip big' + (EV.teams.has(t.id) ? ' on' : ''), style: '--hu:' + hue(t.id) }), c = h('input', { type: 'checkbox' });
      c.checked = EV.teams.has(t.id); c.onchange = () => { c.checked ? EV.teams.add(t.id) : EV.teams.delete(t.id); lb.classList.toggle('on', c.checked); paintFoot(); };
      lb.appendChild(c); lb.appendChild(h('b', { text: t.name })); lb.appendChild(h('span', { text: '貯金箱 ' + fmt(t.picos || 0) }));
      chips.appendChild(lb);
    });
    list.appendChild(chips);
  }
  paintFoot();
  // 4) 履歴
  const log = (S0.scoreLog || []).filter(l => l.kind === 'event'), lastE = log.find(l => !l.undone);
  pane.appendChild(h('div', { cls: 'sec', text: '特別ピコの履歴' }));
  if (!log.length) pane.appendChild(h('div', { cls: 'hint', text: 'まだありません' }));
  log.slice(0, 10).forEach(l => {
    const d = new Date(l.at), sum = l.applied.reduce((a, x) => a + (x.picos || 0), 0), nb = l.applied.filter(x => x.team).length, ns = l.applied.length - nb;
    pane.appendChild(h('div', { cls: 'logrow' + (l.undone ? ' undone' : '') }, [
      h('span', { text: (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') }),
      h('span', { text: (l.note || '（理由なし）') }),
      h('span', { text: [ns ? ns + '人' : '', nb ? nb + 'チーミ' : ''].filter(Boolean).join('・') + ' +' + fmt(sum) }),
      l.by ? h('span', { cls: 'by', text: l.by }) : null, l.undone ? tag('', '取り消し済み') : null
    ]));
  });
  if (lastE) pane.appendChild(h('div', { cls: 'acts-row' }, [h('button', { cls: 'btn', text: '直前の特別ピコを元に戻す', onclick: () => undoEvent(lastE) })]));
}
async function applyEvent() {
  const S0 = S(), v = Math.floor(EV.amount || 0); if (v <= 0) return;
  const stus = EV.mode === 'stu' ? [...EV.sel].map(stu).filter(s => s && evOk(s)) : [], tms = EV.mode === 'bank' ? [...EV.teams].map(id => S0.teams.find(t => t.id === id)).filter(Boolean) : [];
  const n = stus.length + tms.length; if (!n) return;
  const what = stus.length ? stus.length + '人に ひとり ' + fmt(v) + ' ピコ' : tms.map(t => t.name).join('・') + ' の貯金箱に ' + fmt(v) + ' ピコずつ';
  if (!await confirmDlg(what + '（合計 ' + fmt(n * v) + ' ピコ）を配ります。' + (EV.note ? '\n理由：' + EV.note : ''), '配る')) return;
  if (SV.on) {
    const r = await rpcA('admin_event_grant', { p_note: EV.note || '', p_earned: !!EV.earned, p_entries: stus.map(s => ({ uid: s.link, picos: v })), p_bank: tms.map(t => ({ team: t.id, picos: v })) }); if (!r) return;
    EV.sel.clear(); EV.teams.clear(); await actx.reload(); toast((r.applied || n) + '件に ピコを配りました', 'ok'); paint(); return;
  }
  const applied = [];
  stus.forEach(s => { s.picos = (s.picos || 0) + v; if (EV.earned) s.earned = (s.earned || 0) + v; applied.push({ studentId: s.uid, picos: v, earned: !!EV.earned }); });
  tms.forEach(t => { t.picos = (t.picos || 0) + v; applied.push({ team: t.id, picos: v }); });
  S0.scoreLog.unshift({ at: Date.now(), kind: 'event', mode: 'add', note: EV.note || '', applied, rows: [] }); S0.scoreLog = S0.scoreLog.slice(0, 100);
  EV.sel.clear(); EV.teams.clear(); save(); toast(n + '件に 合計 ' + fmt(n * v) + ' ピコを配りました', 'ok'); paint();
}
async function undoEvent(l) {
  if (!await confirmDlg('「' + (l.note || '特別ピコ') + '」（' + l.applied.length + '件）を取り消します。もう使ったぶんは0までしか引けません。', '元に戻す')) return;
  if (SV.on) { if (!await rpcA('admin_undo', { p_log: l.id })) return; await actx.reload(); toast('元に戻しました', 'ok'); paint(); return; }
  const S0 = S();
  l.applied.forEach(a => {
    if (a.team) { const t = S0.teams.find(x => x.id === a.team); if (t) t.picos = Math.max(0, (t.picos || 0) - a.picos); return; }
    const s = stu(a.studentId); if (!s) return; s.picos = Math.max(0, (s.picos || 0) - a.picos); if (a.earned !== false) s.earned = Math.max(0, (s.earned || 0) - a.picos);
  });
  l.undone = true; save(); toast('元に戻しました', 'ok'); paint();
}

// ===== QRプレゼント：非売品アイテム または ピコのQRコードを発行。生徒がスマホで読むと、その人の持ち物（ピコ）に入る =====
// each＝みんなで1つのQR（1人1回） / once＝1枚ずつのカード（1枚1回） / gacha＝ガチャセット（中身と枚数を表で決めて、まとめて1枚1回のコードを発行）
const GF = { mode: 'each', what: 'item', item: '', picos: 500, earned: true, count: 10, note: '', expires: '', list: null, loading: false,
  gacha: [{ what: 'picos', picos: 100, n: 120 }, { what: 'picos', picos: 500, n: 40 }, { what: 'item', item: 'ltd_trophy', n: 5 }, { what: 'item', item: 'ltd_fish', n: 35 }], gEarned: true };
export const giftUrl = code => STUDENT_URL + '?gift=' + code;
const LOCAL_CH = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // 見まちがえやすい 0 O 1 I L を除く（サーバーの _gift_new_code と同じ）
const localCode = used => { let c; do { c = ''; const b = crypto.getRandomValues(new Uint8Array(8)); for (let i = 0; i < 8; i++) c += LOCAL_CH[b[i] % LOCAL_CH.length]; } while (used.has(c)); used.add(c); return c; };
const GACHA_MAX = 1000;
function itemIco(d, size) { const im = h('img', { cls: 'gf-ico', alt: '', width: String(size || 44), height: String(size || 44) }); if (actx.itemIcon) actx.itemIcon(d, im); return im; }
const giftName = g => g.picos > 0 ? fmt(g.picos) + 'ピコ' : (ITEM[g.item] ? ITEM[g.item].name : g.item);
const coin = size => h('span', { cls: 'gf-coin', style: 'font-size:' + (size || 28) + 'px', text: '🪙' });
async function loadGifts() {
  if (!SV.on) { GF.list = (actx.getS().gifts || []).slice(); return; }
  GF.loading = true; const r = await rpcA('admin_gift_list', {}); GF.loading = false; GF.list = r ? r.codes || [] : [];
}
// 中身のえらび方（アイテム or ピコ）。row は GF か ガチャの1行
function whatPicker(row, onChange) {
  const sel = h('select', { cls: 'gf-what', 'aria-label': '中身' });
  sel.appendChild(h('option', { value: 'picos', text: '🪙 ピコ' }));
  LTD_ITEMS.forEach(d => sel.appendChild(h('option', { value: 'item:' + d.id, text: (d.hazure ? '🐟 はずれ：' : '🎁 ') + d.name })));
  sel.value = row.what === 'picos' ? 'picos' : 'item:' + (row.item || LTD_ITEMS[0].id);
  sel.onchange = () => { if (sel.value === 'picos') row.what = 'picos'; else { row.what = 'item'; row.item = sel.value.slice(5); } onChange(); };
  return sel;
}
function giftTab(pane) {
  if (GF.list == null && !GF.loading) { loadGifts().then(() => { if (A.tab === 'gift') paint(); }); }
  if (!GF.item) GF.item = LTD_ITEMS[0].id;
  pane.appendChild(h('p', { cls: 'hint', text: '非売品のアイテム、またはピコのQRコードを作ります。生徒が自分のスマホで読み、お家に入ると受け取れます（4けたの番号で本人を確かめます）。' }));
  // 1) 配り方
  pane.appendChild(h('div', { cls: 'sec', text: '1. どう配る？' }));
  const kinds = h('div', { cls: 'ev-modes gf-modes' });
  [['each', '📣 みんなで1つのQR', 'イベントで画面や紙に1つ出す。1人1回まで'], ['once', '🎟 1枚ずつ配るカード', '1枚を1人だけが使える。枚数を決めて印刷'], ['gacha', '🎰 ガチャセット', '中身と枚数を表で決めて、まとめて発行（1000枚まで）。カプセル用の小さな紙に印刷']].forEach(([k, t, s]) => kinds.appendChild(h('button', { cls: 'ev-mode' + (GF.mode === k ? ' on' : ''), onclick: () => { GF.mode = k; paint(); } }, [h('b', { text: t }), h('span', { text: s })])));
  pane.appendChild(kinds);
  const note = h('input', { type: 'text', maxlength: '40', placeholder: GF.mode === 'gacha' ? 'セットの名前（例：12月 がんばりガチャ）' : 'メモ（例：12/20 英語ワークショップ）', cls: 'ev-note', 'aria-label': 'メモ' }); note.value = GF.note; note.oninput = () => { GF.note = note.value; };
  const exp = h('input', { type: 'date', cls: 'ev-date', 'aria-label': '使える期限' }); exp.value = GF.expires; exp.oninput = () => { GF.expires = exp.value; };
  const earnedChk = (obj, key) => { const lb = h('label', { cls: 'chk' }), c = h('input', { type: 'checkbox' }); c.checked = obj[key]; c.onchange = () => { obj[key] = c.checked; }; lb.appendChild(c); lb.appendChild(h('span', { text: 'ピコをランキング・ランクにも数える（ふつうはオン）' })); return lb; };
  if (GF.mode !== 'gacha') {
    // 2) 中身（アイテム or ピコ）
    pane.appendChild(h('div', { cls: 'sec', text: '2. 中身は？' }));
    const grid = h('div', { cls: 'gf-items' });
    grid.appendChild(h('button', { cls: 'gf-item gf-pico' + (GF.what === 'picos' ? ' on' : ''), onclick: () => { GF.what = 'picos'; paint(); } }, [coin(40), h('span', { text: 'ピコ' })]));
    LTD_ITEMS.forEach(d => grid.appendChild(h('button', { cls: 'gf-item' + (GF.what === 'item' && GF.item === d.id ? ' on' : '') + (d.hazure ? ' hz' : ''), onclick: () => { GF.what = 'item'; GF.item = d.id; paint(); } }, [itemIco(d, 56), h('span', { text: d.name }), d.hazure ? h('i', { cls: 'gf-hz', text: 'はずれ品' }) : null])));
    pane.appendChild(grid);
    const pv = h('input', { type: 'number', min: '1', max: '1000000', step: '100', cls: 'ev-amt', 'aria-label': 'ピコ' }); pv.value = String(GF.picos); pv.oninput = () => { GF.picos = Math.max(1, Math.min(1000000, Math.floor(+pv.value || 0))); };
    const cnt = h('input', { type: 'number', min: '1', max: '100', cls: 'ev-amt', 'aria-label': '枚数' }); cnt.value = String(GF.count); cnt.oninput = () => { GF.count = Math.max(1, Math.min(100, Math.floor(+cnt.value || 1))); };
    pane.appendChild(h('div', { cls: 'card ev-form' }, [
      GF.what === 'picos' ? h('div', { cls: 'ev-row' }, [h('span', { cls: 'ev-k', text: 'ピコ' }), pv, h('span', { text: 'ピコ（1人あたり）' })]) : null,
      GF.what === 'picos' ? earnedChk(GF, 'earned') : null,
      GF.mode === 'once' ? h('div', { cls: 'ev-row' }, [h('span', { cls: 'ev-k', text: '枚数' }), cnt, h('span', { text: '枚（100枚まで）' })]) : null,
      h('div', { cls: 'ev-row' }, [h('span', { cls: 'ev-k', text: 'メモ' }), note]),
      h('div', { cls: 'ev-row' }, [h('span', { cls: 'ev-k', text: '期限' }), exp, h('span', { cls: 'hint', text: 'この日まで使える（空なら無期限）' })]),
      h('div', { cls: 'acts-row' }, [h('button', { cls: 'btn coral', text: 'QRコードを発行する', onclick: () => createGift() })])
    ]));
  } else {
    // 2) ガチャの中身と枚数（表）
    pane.appendChild(h('div', { cls: 'sec', text: '2. 中身と枚数（ぜんぶ「1枚1回」のコードになります）' }));
    const tbl = h('table', { cls: 'tbl gc-tbl' }), total = () => GF.gacha.reduce((a, r) => a + (r.n | 0), 0);
    const sumEl = h('div', { cls: 'stats' }), paintSum = () => { const t = total(); sumEl.innerHTML = ''; sumEl.appendChild(tag(t > GACHA_MAX ? 'ng' : 'ok', '合計 ' + t + '枚' + (t > GACHA_MAX ? '（' + GACHA_MAX + '枚まで）' : ''))); GF.gacha.forEach(r => { if (r.n > 0) sumEl.appendChild(tag('', (r.what === 'picos' ? fmt(r.picos) + 'ピコ' : (ITEM[r.item] || {}).name) + ' ' + Math.round(r.n / Math.max(1, t) * 100) + '%')); }); };
    tbl.appendChild(h('tr', {}, ['中身', 'ピコ', '枚数', ''].map(t => h('th', { text: t }))));
    GF.gacha.forEach((r, i) => {
      const pv = h('input', { type: 'number', min: '1', max: '1000000', step: '100', cls: 'ev-amt sm', 'aria-label': 'ピコ', disabled: r.what === 'picos' ? null : '' }); pv.value = r.what === 'picos' ? String(r.picos || 100) : ''; pv.oninput = () => { r.picos = Math.max(1, Math.floor(+pv.value || 0)); paintSum(); };
      const nv = h('input', { type: 'number', min: '0', max: String(GACHA_MAX), cls: 'ev-amt sm', 'aria-label': '枚数' }); nv.value = String(r.n); nv.oninput = () => { r.n = Math.max(0, Math.floor(+nv.value || 0)); paintSum(); };
      tbl.appendChild(h('tr', {}, [h('td', {}, [whatPicker(r, () => { if (r.what === 'picos' && !r.picos) r.picos = 100; paint(); })]), h('td', {}, [pv]), h('td', {}, [nv, h('span', { text: ' 枚' })]), h('td', {}, [h('button', { cls: 'btn sm', text: '行を消す', onclick: () => { GF.gacha.splice(i, 1); paint(); } })])]));
    });
    pane.appendChild(h('div', { cls: 'tbl-wrap' }, [tbl]));
    pane.appendChild(h('div', { cls: 'acts-row' }, [h('button', { cls: 'btn sm', text: '＋ 行を足す', onclick: () => { GF.gacha.push({ what: 'picos', picos: 100, n: 10 }); paint(); } })]));
    paintSum(); pane.appendChild(sumEl);
    pane.appendChild(h('div', { cls: 'card ev-form' }, [
      earnedChk(GF, 'gEarned'),
      h('div', { cls: 'ev-row' }, [h('span', { cls: 'ev-k', text: 'セット名' }), note]),
      h('div', { cls: 'ev-row' }, [h('span', { cls: 'ev-k', text: '期限' }), exp, h('span', { cls: 'hint', text: 'この日まで使える（空なら無期限）' })]),
      h('div', { cls: 'hint', text: '印刷は 4cm×3cm の小さな紙（A4に36枚・切り取り線つき）。QRと8文字のコードだけで、中身は書きません（開けるまで分かりません）。並びはばらばらにして印刷します。' }),
      h('div', { cls: 'acts-row' }, [h('button', { cls: 'btn coral', text: 'ガチャセットを発行する', onclick: () => createGacha() })])
    ]));
  }
  // 3) 発行したもの
  pane.appendChild(h('div', { cls: 'sec', text: '発行したQRコード' }));
  if (GF.list == null) { pane.appendChild(h('div', { cls: 'hint', text: '読み込み中…' })); return; }
  if (!GF.list.length) { pane.appendChild(h('div', { cls: 'hint', text: 'まだありません' })); return; }
  const groups = new Map();   // ガチャセットは set ごと。それ以外は、同じとき・同じ中身・同じメモで作ったものをまとめる
  GF.list.forEach(g => { const k = g.set ? 'S|' + g.set : g.kind + '|' + g.item + '|' + (g.picos | 0) + '|' + g.note + '|' + Math.floor((g.at || 0) / 60000); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(g); });
  const box = h('div', { cls: 'gf-list' }); pane.appendChild(box);
  groups.forEach(gs => {
    const g0 = gs[0], used = gs.filter(g => g.uses > 0).length, live = gs.filter(g => g.active).length, at = new Date(g0.at || Date.now());
    if (g0.set) {   // ガチャセット：使われた枚数・残り・中身ごとの受け取り数
      const by = new Map(); gs.forEach(g => { const k = giftName(g); const o = by.get(k) || { n: 0, used: 0 }; o.n++; if (g.uses > 0) o.used++; by.set(k, o); });
      box.appendChild(h('div', { cls: 'gf-row gf-set' + (live ? '' : ' off') }, [
        h('span', { cls: 'gf-coin', style: 'font-size:30px', text: '🎰' }),
        h('div', { cls: 'gf-main' }, [h('b', { text: 'ガチャセット' + (g0.note ? '：' + g0.note : '') }), h('span', { text: (at.getMonth() + 1) + '/' + at.getDate() + ' 発行・' + gs.length + '枚・使用 ' + used + '・残り ' + (gs.length - used) + (g0.expires ? '・期限 ' + g0.expires : '') + (live ? '' : '・停止中') + (g0.by ? '・' + g0.by : '') }),
          h('div', { cls: 'gf-break' }, [...by.entries()].map(([k, o]) => h('span', { cls: 'gf-chip', text: k + '　' + o.used + '／' + o.n }))) ]),
        h('button', { cls: 'btn sm mint', text: '印刷', title: '未使用・停止していないものだけ', onclick: () => printCapsules(gs.filter(g => g.active && !g.uses)) }),
        h('button', { cls: 'btn sm', text: live ? '止める' : '再開', onclick: () => setGiftActive(gs, !live) }),
        h('button', { cls: 'btn sm', text: '消す', onclick: () => deleteGifts(gs) })
      ]));
      return;
    }
    const d = ITEM[g0.item], sub = g0.kind === 'each' ? '1人1回・' + g0.uses + '人が受け取り' : gs.length + '枚・使用 ' + used + '／' + gs.length;
    box.appendChild(h('div', { cls: 'gf-row' + (live ? '' : ' off') }, [
      g0.picos > 0 ? coin(30) : d ? itemIco(d, 40) : null,
      h('div', { cls: 'gf-main' }, [h('b', { text: giftName(g0) + (g0.note ? '　' + g0.note : '') }), h('span', { text: (at.getMonth() + 1) + '/' + at.getDate() + ' 発行・' + sub + (g0.expires ? '・期限 ' + g0.expires : '') + (live ? '' : '・停止中') + (g0.by ? '・' + g0.by : '') })]),
      h('button', { cls: 'btn sm mint', text: g0.kind === 'each' ? 'QRを表示' : '印刷', onclick: () => g0.kind === 'each' ? showGiftQr(g0) : printGifts(gs.filter(g => g.active && !g.uses)) }),
      h('button', { cls: 'btn sm', text: live ? '止める' : '再開', onclick: () => setGiftActive(gs, !live) }),
      h('button', { cls: 'btn sm', text: '消す', onclick: () => deleteGifts(gs) })
    ]));
  });
}
// 発行（サーバー版は admin_gift_create2。端末版はこの端末の S.gifts）。entries = [{ item, picos, earned, n }]
async function issueGifts(kind, entries, set) {
  const total = entries.reduce((a, e) => a + e.n, 0);
  if (SV.on) {
    const r = await rpcA('admin_gift_create2', { p_kind: kind, p_entries: entries, p_note: GF.note || '', p_expires: GF.expires || null, p_set: set || '' }); if (!r) return null;
  } else {
    const S0 = actx.getS(); S0.gifts = S0.gifts || []; const used = new Set(S0.gifts.map(g => g.code)), at = Date.now();
    entries.forEach(e => { for (let i = 0; i < e.n; i++) S0.gifts.unshift({ code: localCode(used), item: e.item || '', picos: e.picos | 0, earned: e.earned !== false, set: set || '', kind, note: GF.note || '', uses: 0, expires: GF.expires || null, active: true, at, claims: [] }); });
    actx.save();
  }
  await loadGifts(); return GF.list.filter(g => set ? g.set === set : true).slice(0, total);
}
async function createGift() {
  const isP = GF.what === 'picos', d = ITEM[GF.item]; if (!isP && (!d || !d.ltd)) return;
  const n = GF.mode === 'each' ? 1 : GF.count;
  const fresh = await issueGifts(GF.mode, [{ item: isP ? '' : d.id, picos: isP ? GF.picos : 0, earned: !!GF.earned, n }]); if (!fresh) return;
  toast((isP ? fmt(GF.picos) + 'ピコ' : d.name) + 'のQRコードを ' + n + (GF.mode === 'each' ? 'つ' : '枚') + ' 作りました', 'ok');
  paint();
  if (GF.mode === 'each') showGiftQr(fresh[0]); else printGifts(fresh);
}
async function createGacha() {
  const rows = GF.gacha.filter(r => r.n > 0), total = rows.reduce((a, r) => a + r.n, 0);
  if (!total) { toast('枚数を入れてください', 'ng'); return; }
  if (total > GACHA_MAX) { toast('1回で発行できるのは ' + GACHA_MAX + '枚までです', 'ng'); return; }
  if (rows.some(r => r.what === 'picos' && !(r.picos > 0))) { toast('ピコの金額を入れてください', 'ng'); return; }
  const lines = rows.map(r => (r.what === 'picos' ? fmt(r.picos) + 'ピコ' : (ITEM[r.item] || {}).name) + ' × ' + r.n + '枚').join('、');
  if (!await confirmDlg('ガチャセット（合計 ' + total + '枚）を発行します：' + lines, '発行する', 'ガチャセット')) return;
  const d = new Date(), p2 = v => String(v).padStart(2, '0'), set = 'G' + d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) + p2(d.getHours()) + p2(d.getMinutes()) + LOCAL_CH[Math.floor(Math.random() * LOCAL_CH.length)] + LOCAL_CH[Math.floor(Math.random() * LOCAL_CH.length)];
  const fresh = await issueGifts('once', rows.map(r => ({ item: r.what === 'picos' ? '' : r.item, picos: r.what === 'picos' ? r.picos : 0, earned: !!GF.gEarned, n: r.n })), set); if (!fresh) return;
  toast('ガチャセットを ' + fresh.length + '枚 発行しました', 'ok'); paint();
  printCapsules(fresh);
}
async function setGiftActive(gs, on) {
  const set = gs[0] && gs[0].set;
  if (SV.on) {
    if (set) { if (!await rpcA('admin_gift_set_active_set', { p_set: set, p_active: on })) return; }
    else for (const g of gs) { if (!await rpcA('admin_gift_set_active', { p_code: g.code, p_active: on })) return; }
    await loadGifts();
  } else { const L = actx.getS().gifts || []; gs.forEach(g => { const x = L.find(y => y.code === g.code); if (x) x.active = on; }); actx.save(); await loadGifts(); }
  toast(on ? '使えるようにしました' : '止めました（読んでも受け取れません）', 'ok'); paint();
}
async function deleteGifts(gs) {
  const set = gs[0] && gs[0].set;
  if (!await confirmDlg((set ? 'このガチャセット' : 'このQRコード') + '（' + gs.length + '件）を消します。配った紙のQRも使えなくなります。', '消す')) return;
  if (SV.on) {
    if (set) { if (!await rpcA('admin_gift_delete_set', { p_set: set })) return; }
    else for (const g of gs) { if (!await rpcA('admin_gift_delete', { p_code: g.code })) return; }
    await loadGifts();
  } else { const S0 = actx.getS(), del = new Set(gs.map(g => g.code)); S0.gifts = (S0.gifts || []).filter(g => !del.has(g.code)); actx.save(); await loadGifts(); }
  paint();
}
// みんなで1つのQR：大きく表示（プロジェクター・タブレットでそのまま見せる）。印刷もできる
function showGiftQr(g) {
  const d = ITEM[g.item], qr = h('div', { cls: 'gf-big-qr' }); qr.innerHTML = qrSvg(giftUrl(g.code));
  const body = h('div', { cls: 'gf-big' }, [
    h('div', { cls: 'gf-big-hd' }, [g.picos > 0 ? coin(50) : itemIco(d, 64), h('div', {}, [h('b', { text: giftName(g) }), h('span', { text: g.note || (g.picos > 0 ? 'ピコのプレゼント' : '非売品アイテムのプレゼント') })])]),
    qr, h('div', { cls: 'gf-code', text: g.code }),
    h('p', { cls: 'hint', text: 'スマホのカメラで読んで、自分の me- でお家に入ると受け取れます（1人1回）。読めないときは、お家の「設定」→「プレゼントコード」にこのコードを入れます。' })
  ]);
  modal('QRプレゼント', body, [h('button', { cls: 'btn', text: '印刷', onclick: () => { closeModal(); printGifts([g], true); } }), h('button', { cls: 'btn coral', text: 'とじる', onclick: closeModal })], 'wide');
}
// 印刷：はじめてカードと同じ紙面（A4に2列×5段）。big=true は1枚を大きく
function giftCardEl(g, big) {
  const qr = h('span', { cls: 'cp-qr', 'aria-hidden': 'true' }); qr.innerHTML = qrSvg(giftUrl(g.code));
  const what = g.picos > 0 ? 'ピコ' : '非売品アイテム';
  return h('div', { cls: 'cp-card gp-card' + (big ? ' gp-big' : '') }, [
    h('div', { cls: 'cp-l' }, [
      h('div', { cls: 'cp-title', text: '向上ハウス　プレゼントQR' }),
      h('div', { cls: 'cp-name' }, [h('small', { text: g.kind === 'each' ? what + '（1人1回）' : what + '（このカード1枚で1回）' }), h('b', { text: giftName(g) })]),
      h('div', { cls: 'cp-code', text: g.code }),
      g.note ? h('div', { cls: 'cp-team', text: g.note }) : null,
      h('div', { cls: 'cp-how', text: 'スマホでQRを読んで、自分の me- でお家に入ると受け取れます。読めないときは「設定」→「プレゼントコード」にこのコードを入れてね' + (g.expires ? '（' + g.expires + ' まで）' : '') })
    ]),
    qr
  ]);
}
function printRoot(pages) {
  const old = document.getElementById('cardPrint'); if (old) old.remove();
  const root = h('div', { id: 'cardPrint' }); pages.forEach(p => root.appendChild(p)); document.body.appendChild(root);
  const done = () => { window.removeEventListener('afterprint', done); root.remove(); };
  window.addEventListener('afterprint', done);
  if (!A.dryPrint) setTimeout(() => window.print(), 80);
  return root;
}
function printGifts(list, big) {
  if (!list.length) { toast('印刷できるQRがありません（使用済み・停止中は印刷しません）', 'ng'); return; }
  const per = big ? 1 : 10, pages = [];
  for (let i = 0; i < list.length; i += per) { const pg = h('div', { cls: 'cp-page' + (big ? ' gp-page' : '') }); list.slice(i, i + per).forEach(g => pg.appendChild(giftCardEl(g, big))); pages.push(pg); }
  printRoot(pages);
}
// ガチャ用：カプセルに入る小さな紙（4cm×3cm、A4に 4列×9段＝36枚）。QR（2cm角）と8文字のコードだけ。中身は書かない。並びはばらばら
const CAPS_PER = 36;
function printCapsules(list) {
  if (!list.length) { toast('印刷できるQRがありません（使用済み・停止中は印刷しません）', 'ng'); return; }
  const L = list.slice(); for (let i = L.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [L[i], L[j]] = [L[j], L[i]]; }
  const pages = [];
  for (let i = 0; i < L.length; i += CAPS_PER) {
    const pg = h('div', { cls: 'gc-page' });
    L.slice(i, i + CAPS_PER).forEach(g => { const qr = h('span', { cls: 'gc-qr', 'aria-hidden': 'true' }); qr.innerHTML = qrSvg(giftUrl(g.code)); pg.appendChild(h('div', { cls: 'gc-cell' }, [qr, h('div', { cls: 'gc-r' }, [h('b', { cls: 'gc-t', text: '向上ハウス' }), h('span', { cls: 'gc-s', text: 'ガチャ' }), h('span', { cls: 'gc-code', text: g.code.slice(0, 4) + ' ' + g.code.slice(4) })])])); });
    pages.push(pg);
  }
  printRoot(pages);
}
