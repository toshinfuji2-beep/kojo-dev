// 担任助手モードの運用まわり（admin.js から呼ぶ）：サーバーの版の帯・運用開始チェック・データ書き出し・取り込みの記録 など
// 画面の部品は h() で作って返し、タブの切り替えなどは ctx（admin.js が渡す {go, paint, tag, S, reload}）経由で行う。
import { h, toast, modal, closeModal, confirmDlg } from './ui.js?v=202611131634';
import { dayKey } from './daily.js?v=202611131634';
import { SV, schemaStale, schemaAtLeast, REQUIRED_SCHEMA, rpc, adminRpc, errText, NEED_UPDATE, exportServerData, markExported, setOperator, lastOperator, vaultState } from './server.js?v=202611131634';
import { isWeakPass } from './vault.js?v=202611131634';

// サーバーの更新が必要なとき（schema.sql を実行していない／古い）に担任助手ホームの上に出す赤い帯。生徒側には出さない
export function staleBanner() {
  if (!SV.on) return null;
  if (!schemaStale()) return null;
  return h('div', { cls: 'errbox', role: 'alert' }, [
    h('b', { text: 'サーバーの更新が必要です：schema.sql を SQL Editor で実行してください' }),
    h('div', { text: 'いまのサーバーの版 ' + (SV.schema || 0) + ' ／ この画面が必要とする版 ' + REQUIRED_SCHEMA + '。更新するまで、新しい機能は動きません（今までの機能は使えます）。' }),
    h('details', {}, [h('summary', { text: '更新の手順を見る' }), h('ol', {}, [h('li', { text: 'Supabase の管理画面を開き、左の「SQL Editor」を選ぶ' }), h('li', { text: 'リポジトリの supabase/schema.sql を全部コピーして貼り付ける' }), h('li', { text: '右下の「Run」を1回押す（何度実行しても安全）' }), h('li', { text: 'この画面を開きなおす（赤い帯が消えれば完了）' })])])
  ]);
}

// ===== 小さな共通部品 =====
const p2 = n => String(n).padStart(2, '0');
export const fmtAt = ms => { const d = new Date(ms); return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes()); };
const ymd = ms => { const d = new Date(ms); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); };
const DAY = 86400000;
export function downloadText(name, text, type) {
  const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: type || 'application/json' })), download: name });
  document.body.appendChild(a); a.click(); a.remove();
}
const stamp = () => { const d = new Date(); return d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) + '-' + p2(d.getHours()) + p2(d.getMinutes()); };

// ===== 取り込み（向上得点・在校時間）の記録 =====
// scoreLog：新しい順。{id, at, kind, mode, undone, by, applied:[...]}
export const importSum = l => (l.applied || []).reduce((a, x) => a + (x.picos || 0), 0);
export const lastImport = (log, kind) => (log || []).find(l => (l.kind || 'score') === kind && !l.undone) || null;
// 同じ日に同じ種類をもう取り込んでいるか（あればその記録）
export const sameDayImport = (log, kind, now) => (log || []).find(l => (l.kind || 'score') === kind && !l.undone && ymd(l.at) === ymd(now || Date.now())) || null;
// 最後の取り込みから何日あいたか（取り込みがまだ無ければ null）
export function importGapDays(log, now) {
  const l = (log || []).find(x => !x.undone); if (!l) return null;
  return Math.floor(((now || Date.now()) - l.at) / DAY);
}
export const IMPORT_GAP_WARN = 3;
// 取り込めなかった行の原因ごとの直し方
export const FIX_HINT = {
  unmatched: ['名簿にその人がいない／名前や番号がちがう', '名簿を確かめる', 'roster'],
  ambig: ['同姓同名で決められない', '名簿を確かめる', 'roster'],
  unlinked: ['まだ me- を作っていない（名簿にひもづいていない）', 'ひもづけを確かめる', 'link'],
  badvalue: ['得点・時間が読めない（元の表を確かめる）', '', ''],
  dup: ['同じ生徒が2行ある（元の表を確かめる）', '', '']
};
// 「あとで直す一覧」：この端末だけに残す（本名が入るのでサーバーには送らない）
const LATER = 'kojoHouse.later';
export const laterLoad = () => { try { const a = JSON.parse(localStorage.getItem(LATER) || '[]'); return Array.isArray(a) ? a.filter(x => x && x.label) : []; } catch (e) { return []; } };
export const laterSave = a => { try { localStorage.setItem(LATER, JSON.stringify(a.slice(0, 200))); } catch (e) { } };
// 取り込んだあと：読めなかった行(bad)を一覧に足し、今回うまく入った行(okLabels)と同じ人の古い行は消す
export function laterUpdate(kind, bad, okLabels, now) {
  const ok = new Set(okLabels || []);
  const a = laterLoad().filter(x => !(x.kind === kind && ok.has(x.label)));
  (bad || []).forEach(r => { if (!a.some(x => x.kind === kind && x.label === r.label && x.status === r.status)) a.unshift({ kind, label: String(r.label), value: r.value == null ? '' : r.value, status: r.status, at: now || Date.now() }); });
  laterSave(a); return a;
}

// ===== 運用開始までのチェック =====
// 自動判定して [{key,label,ok,detail,tab,act}]。tab＝飛び先の画面、act＝'stale'/'wipe'（ダイアログ）
export function launchChecks(S0) {
  const st = S0.students || [], tm = S0.teams || [], inTeam = new Set(); tm.forEach(t => (t.members || []).forEach(u => inTeam.add(u)));
  const noTeam = st.filter(s => !inTeam.has(s.uid)).length, unconf = tm.filter(t => !t.confirmed).length;
  const linked = st.filter(s => s.link).length;
  const vs = vaultState(), log = S0.scoreLog || [];
  const stale = schemaStale() || SV.schema == null;
  return [
    { key: 'server', label: 'サーバーが最新', ok: !stale, detail: stale ? (SV.schema == null ? '版を確かめられません' : 'schema.sql を実行する（版 ' + SV.schema + ' → ' + REQUIRED_SCHEMA + '）') : '版 ' + SV.schema, act: 'stale' },
    { key: 'pass', label: 'パスワードが8文字以上', ok: !isWeakPass(SV.adminPass), detail: isWeakPass(SV.adminPass) ? 'いまは短い' : '', tab: 'set' },
    { key: 'roster', label: '名簿が入っている', ok: st.length > 0, detail: st.length ? st.length + '人' : 'まだ', tab: 'roster' },
    { key: 'teams', label: '全員がチーミに入り確定済み', ok: st.length > 0 && tm.length > 0 && !noTeam && !unconf, detail: !st.length ? '' : (noTeam ? '未所属 ' + noTeam + '人' : '') + (noTeam && unconf ? '・' : '') + (unconf ? '未確定 ' + unconf + 'チーミ' : ''), tab: 'teams' },
    { key: 'me', label: 'me-を作った', ok: st.length > 0 && linked === st.length, detail: linked + '/' + st.length + '人', tab: 'link' },
    { key: 'vault', label: '名簿のバックアップが有効', ok: vs === 'ok', detail: vs === 'ok' ? (SV.vaultAt ? '最終 ' + fmtAt(SV.vaultAt) : '') : vs === 'weak' ? 'パスワードが短い' : vs === 'noserver' ? 'サーバーの更新が必要' : vs === 'blocked' ? '開けなかった' : 'まだ送っていない', tab: 'set' },
    { key: 'score', label: '向上得点の取り込みを1回試した', ok: log.some(l => (l.kind || 'score') === 'score') || !!SV.wipedAt, detail: SV.wipedAt ? '済（確認用を消したあと）' : '', tab: 'score' },
    { key: 'wipe', label: '確認用に作ったデータを消した', ok: !!SV.wipedAt, detail: SV.wipedAt ? fmtAt(SV.wipedAt) : '本番を始める前に1回', act: 'wipe' }
  ];
}
// 開始日を過ぎたか（過ぎたら「確認用データを消す」はホームから外し、設定の奥・強い警告にする）
export const startPassed = now => !!SV.startDate && ymd(now || Date.now()) >= SV.startDate;

// ctx：{ go(tab), paint(), tag(cls,text), S(), reload() }
export function launchCard(ctx) {
  if (!SV.on) return null;
  const items = launchChecks(ctx.S()), done = items.filter(x => x.ok).length, all = done === items.length;
  const box = h('details', { cls: 'card lc-card' + (all ? ' all' : ''), id: 'launchCheck' });
  if (!all) box.open = true;
  box.appendChild(h('summary', {}, [h('b', { text: '運用開始までのチェック' }), ctx.tag(all ? 'ok' : 'warn', all ? '✓ 全部そろいました' : done + '/' + items.length)]));
  items.forEach(it => {
    const go = it.tab ? () => ctx.go(it.tab) : it.act === 'wipe' ? () => launchResetDlg(ctx) : () => staleDlg();
    const showBtn = !it.ok && !(it.act === 'wipe' && startPassed());
    box.appendChild(h('div', { cls: 'lc-row' + (it.ok ? ' ok' : ''), 'data-key': it.key }, [
      h('span', { cls: 'lc-mark', text: it.ok ? '✓' : '未' }), h('span', { cls: 'lc-t', text: it.label }), h('span', { cls: 'lc-d', text: it.detail || '' }),
      showBtn ? h('button', { cls: 'btn sm mint', text: it.act === 'wipe' ? '消して本番を始める' : it.act === 'stale' ? '手順' : ({ set: '設定へ', roster: '名簿へ', teams: '編成へ', link: 'ひもづけへ', score: '取り込みへ' })[it.tab] || 'ひらく', onclick: go }) : null]));
  });
  return box;
}
function staleDlg() {
  modal('サーバーの更新', h('div', {}, [h('p', { text: 'Supabase の「SQL Editor」に supabase/schema.sql を全部貼って「Run」を1回押します（何度実行しても安全）。そのあと、この画面を開きなおすと反映されます。' })]), [h('button', { cls: 'btn', text: 'とじる', onclick: closeModal })]);
}

// ===== ホームの注意（赤い帯・書き出し・取り込みのあきなど） =====
export const EXPORT_WARN_DAYS = 7;
export function homeAlerts(ctx) {
  const out = [], S0 = ctx.S(); if (!SV.on) return out;
  const sb = staleBanner(); if (sb) out.push(sb);
  const warn = (text, btnText, on) => out.push(h('div', { cls: 'warnbox' }, [h('b', { text }), h('span', { cls: 'sp' }), btnText ? h('button', { cls: 'btn sm mint', text: btnText, onclick: on }) : null]));
  const hasData = S0.students.length > 0 || SV.rows.length > 0;
  if (!schemaStale() && SV.schema != null && hasData) {
    const age = SV.exportAt ? Math.floor((Date.now() - SV.exportAt) / DAY) : null;
    if (age == null) warn('サーバーのデータをまだ保存していません', '保存する', () => ctx.go('set'));
    else if (age >= EXPORT_WARN_DAYS) warn('サーバーのデータを ' + age + '日 保存していません（最終 ' + fmtAt(SV.exportAt) + '）', '保存する', () => ctx.go('set'));
  }
  const linked = S0.students.filter(s => s.link).length;
  if (linked && startPassed()) {
    const gap = importGapDays((S0.scoreLog || []).filter(l => (l.kind || 'score') === 'score'));
    if (gap == null) warn('向上得点をまだ一度も取り込んでいません', '取り込む', () => ctx.go('score'));
    else if (gap >= IMPORT_GAP_WARN) warn('向上得点の取り込みが ' + gap + '日 ありません', '取り込む', () => ctx.go('score'));
  }
  return out;
}

// ===== サーバーデータの書き出し（JSON） =====
export async function saveServerExport() {
  const d = await exportServerData();
  downloadText('kojo-server-' + stamp() + '.json', JSON.stringify(d, null, 1));
  await markExported();
  return d;
}
export function exportCard(ctx) {
  if (!SV.on) return null;
  const age = SV.exportAt ? Math.floor((Date.now() - SV.exportAt) / DAY) : null;
  return h('div', { cls: 'card' }, [
    h('h4', { text: 'サーバーのデータを保存（JSON）' }),
    h('div', { cls: 'hint', text: 'サーバー(Supabase)の無料枠には自動バックアップがありません。me-・ピコ・家・得点の記録をこのPCにファイルで保存します（週に1回がおすすめ）。本名・番号は含まれません。' }),
    h('div', { cls: 'hint', text: SV.exportAt ? '最後に保存：' + fmtAt(SV.exportAt) + '（' + (age ? age + '日前' : '今日') + '）' : 'まだ保存していません' }),
    h('button', { cls: 'btn mint', text: 'サーバーのデータを保存', onclick: async () => { try { const d = await saveServerExport(); toast('保存しました（生徒 ' + d.students.length + '人・チーミ ' + d.teams.length + '）', 'ok'); } catch (e) { toast(e && e.kind === 'schema' ? NEED_UPDATE : 'うまく保存できませんでした', 'ng'); } ctx.paint(); } }),
    h('div', { cls: 'hint', text: 'もとにもどすときは、このファイルを開発者に渡してください。' })
  ]);
}

// ===== 確認用データを消して本番を始める =====
export const LAUNCH_PHRASE = '本番開始', LAUNCH_PHRASE_LATE = '本番のデータを消す';
export function launchResetDlg(ctx) {
  const late = startPassed(), phrase = late ? LAUNCH_PHRASE_LATE : LAUNCH_PHRASE;
  const pw = h('input', { type: 'password', autocomplete: 'current-password', placeholder: 'パスワードをもう一度', cls: 'pass', 'aria-label': 'パスワード（確認）' });
  const ph = h('input', { type: 'text', autocomplete: 'off', placeholder: '「' + phrase + '」と入力', 'aria-label': '確認の文字' });
  const go = h('button', { cls: 'btn coral', text: late ? '本番のデータを消す' : '消して本番を始める', disabled: '' });
  const upd = () => { go.disabled = !(pw.value && ph.value.trim() === phrase); };
  pw.addEventListener('input', upd); ph.addEventListener('input', upd);
  const li = t => h('li', { text: t });
  const body = h('div', { cls: 'wipe-dlg' }, [
    late ? h('div', { cls: 'errbox' }, [h('b', { text: '運用開始日（' + SV.startDate + '）を過ぎています。いま消すと、生徒が作った me-・家・ピコが本当になくなります' }), h('span', { text: '元にもどせません。実行前に、サーバーのデータを自動でファイルに保存します。' })]) : h('p', { text: '確認のために作ったデータを消して、まっさらな状態で本番を始めます。実行前に、サーバーのデータを自動でファイルに保存します。' }),
    h('div', { cls: 'wipe-cols' }, [
      h('div', {}, [h('b', { text: '消えるもの（サーバー）' }), h('ul', {}, [li('生徒の me-（ニックネーム・見た目・番号）'), li('持っているピコ・持ち物・きせかえ'), li('家の家具・間取り・チーミの貯金箱'), li('得点・在校時間の取り込みの記録、操作の記録'), li('家の伝言板'), li('ミッションの達成・受け取りの記録')])]),
      h('div', {}, [h('b', { text: '残るもの' }), h('ul', {}, [li('名簿・チーミ編成（この担任助手PCの中）'), li('サーバーのチーミ（名前・人数・確定・あいことば）。家は空の状態にもどる'), li('名簿の名前の枠：すべて空にもどり、生徒がそのまま選べる'), li('ミッション・お知らせ・担任助手のme-・設定')])])
    ]),
    h('label', { cls: 'field' }, [h('span', { text: 'パスワード' }), pw]),
    h('label', { cls: 'field' }, [h('span', { text: '「' + phrase + '」と打つ' }), ph])
  ]);
  let busy = false;
  go.onclick = async () => {
    if (busy) return; busy = true; go.disabled = true;
    try {
      let ok = false; try { const r = await rpc('admin_check', { p_admin: pw.value }); ok = !!r.ok; } catch (e) { ok = false; }
      if (!ok) { toast('パスワードがちがうよ', 'ng'); busy = false; upd(); return; }
      if (schemaStale() || SV.schema == null) { toast(NEED_UPDATE, 'ng'); busy = false; upd(); return; }
      try { await saveServerExport(); } catch (e) { toast('先にサーバーのデータを保存できなかったので、消しません', 'ng'); busy = false; upd(); return; }
      const r = await adminRpc('admin_launch_reset', {});
      if (!r.ok) { toast(errText(r.err), 'ng'); busy = false; upd(); return; }
      SV.wipedAt = Date.now(); closeModal();
      if (ctx.reload) await ctx.reload();
      toast('消しました（生徒 ' + r.students + '人ぶん）。名簿・チーミはそのままです', 'ok'); ctx.paint();
    } catch (e) { console.error(e); toast('うまくいきませんでした：' + (e && e.message || e), 'ng'); busy = false; upd(); }
  };
  modal(late ? '本番のデータを消す' : '確認用データを消して本番を始める', body, [h('button', { cls: 'btn', text: 'やめる', onclick: closeModal }), go], 'wide');
}

// ===== だれが操作しますか =====
// staffNames＝担任助手me-の名前の一覧。選んだ名前を返す（端末に覚える）
export function chooseOperator(staffNames) {
  return new Promise(res => {
    const last = lastOperator(), names = [...new Set((staffNames || []).filter(Boolean))];
    const done = n => { n = setOperator(n); closeModal(); res(n); };
    const list = h('div', { cls: 'picklist op-list' });
    names.forEach(n => list.appendChild(h('button', { cls: 'btn pickbtn' + (n === last ? ' mint' : ''), onclick: () => done(n) }, [h('span', { cls: 'a', text: n }), h('span', { cls: 'b', text: n === last ? '前回の人' : '' })])));
    const inp = h('input', { type: 'text', maxlength: '20', placeholder: 'その他（名前を入力）', autocomplete: 'off', 'aria-label': 'その他の名前' }); if (last && !names.includes(last)) inp.value = last;
    const ok = () => { const v = inp.value.trim(); if (!v) { toast('名前を入れてね', 'ng'); return; } done(v); };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') ok(); });
    const body = h('div', {}, [h('p', { text: 'あとで「だれがやったか」が分かるように、操作する人を選んでください。' }), list, h('div', { cls: 'op-other' }, [inp, h('button', { cls: 'btn sm mint', text: 'この名前で始める', onclick: ok })])]);
    modal('だれが操作しますか', body, [], 'sticky');
  });
}

// ===== メンバーの変化：チーミ移動・休止・ニックネームの差し戻し（サーバー版。schema 版4以上） =====
const need = n => { if (!schemaAtLeast(n)) { toast(NEED_UPDATE, 'ng'); return false; } return true; };
async function call(name, args) {
  try { const r = await adminRpc(name, args); if (!r.ok) { toast(errText(r.err), 'ng'); return null; } return r; }
  catch (e) { toast(e && e.kind === 'schema' ? NEED_UPDATE : e && e.kind === 'offline' ? 'サーバーにつながらないよ' : 'サーバーのエラー', 'ng'); return null; }
}
// その人(サーバーの uid)が、チーミの家に置いている自分の家具の数
export const ownedCount = (teamId, uid) => { const t = (SV.teamRows || []).find(x => x.id === teamId); return t ? (t.rooms || []).reduce((n, r) => n + (r.items || []).filter(i => i.owner === uid).length, 0) : 0; };
// チーミ移動（ひもづけ済みの人を、別の確定済みチーミへ）。from/to は名簿側のチーミ。ctx＝{S, save, paint, reload}。移したら true
export async function moveLinkedDlg(ctx, s, from, to) {
  if (!need(4)) return false;
  if (!s.link) { toast('ひもづけ前の人は、名簿だけで移せます', 'ng'); return false; }
  const row = SV.rows.find(r => r.uid === s.link) || {}, n = from ? ownedCount(from.id, s.link) : 0;
  const ok = await confirmDlg(s.name + 'さん（' + (row.nick || 'まだ') + '）を「' + (from ? from.name : 'チーミなし') + '」から「' + to.name + '」へ移します。\n'
    + '・' + (from ? '元の家に置いた自分の家具（いま ' + n + '個）は、持ち物にもどります（ほかの人の家具・壁紙・床はそのまま）' : '元の家はありません') + '\n'
    + '・持っているピコ（' + (row.picos || 0).toLocaleString('en-US') + '）と累計は、本人と一緒に動きます\n'
    + '・両方のチーミの人数が新しくなります\n・本人は、次に入るとき「' + to.name + '」の家に入ります', '移す', 'チーミ移動');
  if (!ok) return false;
  const r = await call('admin_move_student', { p_uid: s.link, p_to: to.id }); if (!r) return false;
  if (from) from.members = from.members.filter(u => u !== s.uid);
  if (!to.members.includes(s.uid)) to.members.push(s.uid);
  ctx.save(); await ctx.reload(); toast(s.name + 'さんを「' + to.name + '」へ移しました' + (r.returned ? '（家具 ' + r.returned + '個は持ち物へ）' : ''), 'ok'); return true;
}
// 退塾・休止（戻せる）。row＝{key(サーバーのuid), nick, retired}
export async function retireDlg(ctx, row, who) {
  if (!need(4)) return false;
  const on = !row.retired, nm = '「' + (row.nick || 'まだ') + '」' + (who ? '（' + who + '）' : '');
  if (!await confirmDlg(on ? nm + 'を休止にします。\n・生徒側の一覧・ランキングの人数から外れ、ログインできなくなります\n・家具は家に残ります（持ち主の表示は「卒業した人」）\n・あとで「復帰」で戻せます' : nm + 'を復帰させます。一覧・ランキングに戻り、またログインできます。', on ? '休止にする' : '復帰させる', on ? '退塾・休止' : '復帰')) return false;
  const r = await call('admin_retire', { p_uid: row.key, p_on: on }); if (!r) return false;
  await ctx.reload(); toast(on ? '休止にしました' : '復帰させました', 'ok'); return true;
}
// ニックネームの差し戻し（不適切な名前）：空にして「まだ」と表示。本人は次に入ったとき付け直す
export async function resetNickDlg(ctx, row, who) {
  if (!need(4)) return false;
  if (!await confirmDlg('「' + (row.nick || 'まだ') + '」' + (who ? '（' + who + '）' : '') + 'のニックネームを差し戻します。表示は「まだ」になり、本人が次に入ったとき、付け直すよう求められます。', '差し戻す', 'ニックネームの差し戻し')) return false;
  const r = await call('admin_reset_nick', { p_uid: row.key }); if (!r) return false;
  await ctx.reload(); toast('差し戻しました（本人が次に入ったとき付け直します）', 'ok'); return true;
}

// ===== 利用時間（1日あたりの分）と「今日だけ解除」（サーバー版。schema 版5以上） =====
// 設定の「利用時間」カード。0＝無制限
export function dailyCard(ctx) {
  if (!SV.on) return null;
  const ok = schemaAtLeast(5), inp = h('input', { type: 'number', min: '0', max: '600', step: '5', inputmode: 'numeric', value: String(SV.dailyMin), 'aria-label': '1日の利用時間（分）' });
  return h('div', { cls: 'card' }, [
    h('h4', { text: '利用時間（生徒が家にいられる時間）' }),
    h('div', { cls: 'hint', text: '1日あたりの分。0＝無制限（既定は30分）。超えると「今日はここまで。続きは明日」が出ます（ホームのお知らせ・ランキングは見られる）。担任助手のme-・お試しは対象外。残り5分で生徒に知らせます。' }),
    ok ? null : h('div', { cls: 'warnbox' }, [h('b', { text: NEED_UPDATE })]),
    h('label', { cls: 'field' }, [h('span', { text: '1日の分（0〜600）' }), inp]),
    h('button', { cls: 'btn mint', text: '利用時間を保存', disabled: ok ? null : '', onclick: async () => {
      const v = Math.round(+inp.value); if (!(v >= 0 && v <= 600)) { toast('0〜600 の数字で入れてね', 'ng'); return; }
      const r = await call('admin_set_daily', { p_min: v }); if (!r) return; SV.dailyMin = v; toast(v ? '1日 ' + v + '分 に設定しました' : '利用時間の制限をなくしました', 'ok'); ctx.paint();
    } })
  ]);
}
// 「今日だけ解除」（row＝{key(サーバーのuid), nick}）。解除済みなら取り消し
export async function dailyUnlockDlg(ctx, row, who) {
  if (!need(5)) return false;
  const on = !(SV.unlocks && SV.unlocks.has(row.key));
  if (!SV.dailyMin) { toast('いま利用時間の制限はありません（設定で0分＝無制限）', 'ng'); return false; }
  if (!await confirmDlg(on ? '「' + (row.nick || 'まだ') + '」' + (who ? '（' + who + '）' : '') + 'の利用時間の制限を、今日だけ解除します（明日からはまた' + SV.dailyMin + '分）。本人の画面は、最大1分ほどで続きが使えるようになります。' : '「' + (row.nick || 'まだ') + '」の今日の解除を取り消します。すでに時間を超えていれば「今日はここまで」になります。', on ? '解除する' : '取り消す', '今日だけ解除')) return false;
  const r = await call('admin_daily_unlock', { p_uid: row.key, p_on: on }); if (!r) return false;
  await ctx.reload(); toast(on ? '今日だけ解除しました' : '解除を取り消しました', 'ok'); return true;
}
