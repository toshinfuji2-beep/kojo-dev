// 担任助手の入口（パスワードなし）：家を見る／向上得点を貼り付ける。管理者モード（名簿・チーミ編集など）は今までどおりパスワード
import { h, fmt, modal, closeModal, openSheet, closeSheet, toast, confirmDlg } from './ui.js?v=202611131634';
import { parseScores } from './parse.js?v=202611131634';
import { SV, SvError, staffScore, staffScoreUndo, errText } from './server.js?v=202611131634';

const BYKEY = 'kojo.staffBy';
const getBy = () => { try { return localStorage.getItem(BYKEY) || ''; } catch (e) { return ''; } };
const setBy = v => { try { localStorage.setItem(BYKEY, v); } catch (e) { } };
const WHY = { unmatched: '名前の枠に見つからない（まだ名前を選んでいない人）', ambig: '同姓同名が複数', dup: '同じ人が重複', badvalue: '得点が読めない', toobig: '1行100点までです' };

// c = { teams(): 確定したチーミ, watch(id), openAdmin() }
export function openStaffDesk(c) {
  const teams = c.teams();
  const body = h('div', { cls: 'staffdesk' }, [
    h('p', { cls: 'hint', text: '担任助手の入口です。ここではパスワードなしで、家を見ることと、向上得点の貼り付けができます。' }),
    h('div', { cls: 'sd-sec', text: '向上得点' }),
    h('button', { cls: 'btn coral', text: '向上得点を貼り付ける', disabled: SV.on ? null : '', onclick: () => { closeModal(); scoreSheet(); } }),
    SV.on ? null : h('p', { cls: 'hint', text: 'サーバーにつながっているときだけ使えます' }),
    h('div', { cls: 'sd-sec', text: '家を見る（見るだけ）' }),
    h('div', { cls: 'picklist' }, teams.length ? teams.map(t => h('button', { cls: 'btn pickbtn', onclick: () => { closeModal(); c.watch(t.id); } }, [h('span', { cls: 'a', text: t.name }), h('span', { cls: 'b', text: t.members.length + '人' })])) : [h('p', { cls: 'hint', text: 'まだ確定したチーミがありません' })]),
    h('div', { cls: 'sd-sec', text: '管理者' }),
    h('button', { cls: 'btn sm', text: '管理者モード（パスワード）', onclick: () => { closeModal(); c.openAdmin(); } })
  ]);
  modal('担任助手', body, [h('button', { cls: 'btn', text: 'とじる', onclick: closeModal })]);
}

function scoreSheet() {
  openSheet('向上得点を貼り付ける', body => {
    let text = '', mode = 'cum', last = null;
    const by = h('input', { type: 'text', maxlength: '14', value: getBy(), placeholder: 'あなたの名前（記録用・なくてもOK）', 'aria-label': 'あなたの名前' });
    by.addEventListener('change', () => setBy(by.value.trim()));
    const ta = h('textarea', { rows: '8', placeholder: '例）\n山田太郎\t12.5\n佐藤花子\t8', 'aria-label': '向上得点の貼り付け' });
    const modes = h('div', { cls: 'modes' });
    [['cum', '累計として扱う（前回との差だけ加算）'], ['add', '今回分としてそのまま加算']].forEach(([k, n]) => {
      const r = h('input', { type: 'radio', name: 'sd_mode' }); r.checked = mode === k; r.onchange = () => { mode = k; run(); };
      modes.appendChild(h('label', { cls: 'radio' }, [r, h('span', { text: n })]));
    });
    const out = h('div', { cls: 'prev' }), undo = h('div');
    body.appendChild(h('p', { cls: 'hint', text: '「氏名」と「向上得点」を貼ってください。名前を選んで家に入った生徒の分だけ入ります（名前を選んでいない人は「見つからない」と出ます。その人たちは管理者モードで入れてください）。' }));
    body.appendChild(by); body.appendChild(ta); body.appendChild(modes); body.appendChild(out); body.appendChild(undo);
    let seq = 0;
    async function run() {
      out.innerHTML = ''; last = null; const my = ++seq;
      if (!text.trim()) return;
      const parsed = parseScores(text, [], { kind: 'score' }).rows;
      const rows = parsed.filter(r => r.status !== 'badvalue').map(r => ({ n: r.label, v: r.value }));
      const badRead = parsed.length - rows.length;
      if (!rows.length) { out.appendChild(h('div', { cls: 'hint', text: '得点が読み取れませんでした' })); return; }
      let r; try { r = await staffScore(mode, rows, true, getBy()); } catch (e) { if (my === seq) out.appendChild(h('div', { cls: 'warnbox', text: e instanceof SvError && e.kind === 'schema' ? 'サーバーの更新が必要です（管理者の人：schema.sql を再実行）' : 'サーバーにつながりません' })); return; }
      if (my !== seq) return;
      if (!r.ok) { out.appendChild(h('div', { cls: 'warnbox', text: errText(r.err) })); return; }
      const ok = r.rows.filter(x => x.status === 'ok'), bad = r.rows.filter(x => x.status !== 'ok'), sum = ok.reduce((a, x) => a + x.picos, 0);
      last = { ok, rows };
      out.appendChild(h('div', { cls: 'stats' }, [h('span', { cls: 'tag ok', text: '反映 ' + ok.length + '人' }), h('span', { cls: 'tag ok', text: '合計 +' + fmt(sum) + ' ピコ（1点=' + fmt(r.rate) + 'ピコ）' }), bad.length + badRead ? h('span', { cls: 'tag ng', text: '入らない ' + (bad.length + badRead) }) : null]));
      const tbl = h('table', { cls: 'tbl' }); tbl.appendChild(h('tr', {}, ['氏名', '前回', '今回', '獲得ピコ'].map((t, i) => h('th', { text: t, cls: i ? 'n' : null }))));
      r.rows.slice(0, 400).forEach(x => tbl.appendChild(x.status === 'ok'
        ? h('tr', {}, [h('td', { cls: 'nm', text: x.name }), h('td', { cls: 'n', text: String(x.prev) }), h('td', { cls: 'n', text: String(x.v) }), h('td', { cls: 'n', text: '+' + fmt(x.picos) })])
        : h('tr', { cls: 'bad' }, [h('td', { cls: 'nm', text: x.n }), h('td', { colspan: '3', cls: 'nm', text: WHY[x.status] || x.status })])));
      out.appendChild(h('div', { cls: 'tbl-wrap' }, [tbl]));
      out.appendChild(h('div', { cls: 'acts-row' }, [h('button', { cls: 'btn coral', text: '適用する（' + ok.length + '人・+' + fmt(sum) + 'ピコ）', disabled: ok.length ? null : '', onclick: apply })]));
    }
    async function apply() {
      if (!last || !last.ok.length) return;
      if (!await confirmDlg(last.ok.length + '人に合計 ' + fmt(last.ok.reduce((a, x) => a + x.picos, 0)) + ' ピコを入れます。よろしいですか？', '適用する')) return;
      let r; try { r = await staffScore(mode, last.rows, false, getBy()); } catch (e) { toast('サーバーにつながりません', 'ng'); return; }
      if (!r.ok) { toast(errText(r.err), 'ng'); return; }
      toast(r.applied + '人ぶん入れました', 'ok'); ta.value = ''; text = ''; out.innerHTML = '';
      if (r.log) undo.appendChild(h('div', { cls: 'logrow' }, [h('span', { text: '入れまちがえたら（1時間以内・直近の1回だけ）' }), h('button', { cls: 'btn sm', text: '取り消す', onclick: async b => {
        try { const u = await staffScoreUndo(r.log, getBy()); if (u.ok) { toast('取り消しました', 'ok'); undo.innerHTML = ''; } else toast(errText(u.err), 'ng'); } catch (e) { toast('サーバーにつながりません', 'ng'); } } })]));
    }
    ta.addEventListener('input', () => { text = ta.value; run(); });
  });
}
