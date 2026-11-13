// 担任助手モード「掲示」タブ：校舎に貼るランキング・上位5チーミの部屋を印刷する（admin.js から呼ぶ）
// 本名はこの担任助手PCの名簿から引くだけ。サーバーには送らない。生徒のアプリにはランキングを出さない。
// ctx = { S: 担任助手の名簿モデル, G: ゲームの状態（me- と家）, server: サーバー版か, paint, houseHi, printRoot, A: 画面の状態 }
import { h, fmt, modal, closeModal, toast } from './ui.js?v=202611131634';
import { boardData, topRanks, boardName, toCsv } from './parse.js?v=202611131634';

export const PS = { kind: 'team', name: 'real', members: true, topN: 20, showPicos: true };
const KINDS = [['team', '🏠 チーミランキング', '全チーミの順位（A4縦）'], ['person', '🙋 個人ランキング', '上位の人（A4縦）'], ['house', '🏆 上位5チーミの部屋', '家の絵つき（A4横・1枚に1チーミ）']];
const NAMES = [['real', '本名'], ['nick', 'ニックネーム'], ['both', '本名＋ニックネーム']];
const today = () => { const d = new Date(); return (d.getMonth() + 1) + '月' + d.getDate() + '日'; };
const ymd = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()); };

function data(ctx) {
  const G = ctx.G, teams = (G.teams || []).filter(t => t.confirmed);
  let realOf;
  if (ctx.server) { const m = new Map(); (ctx.S.students || []).forEach(s => { if (s.link) m.set(s.link, s.name); }); realOf = u => m.get(u) || null; }
  else { const m = new Map((G.students || []).map(s => [s.uid, s.name])); realOf = u => m.get(u) || null; }
  return boardData({ teams, students: G.students || [], realOf });
}
const memberText = (r, mode) => r.people.length ? r.people.map(p => boardName(p, mode)).join('・') : '（メンバーなし）';

export function posterTab(pane, ctx) {
  const D = data(ctx), paint = ctx.paint;
  pane.appendChild(h('p', { cls: 'hint', text: '校舎に貼るランキングを印刷します。本名はこの担任助手PCの名簿から出すだけで、サーバーには送りません。生徒のアプリにはランキングは出ません。' }));
  pane.appendChild(h('div', { cls: 'sec', text: '1. 何を印刷する？' }));
  const kinds = h('div', { cls: 'ev-modes gf-modes' });
  KINDS.forEach(([k, t, s]) => kinds.appendChild(h('button', { cls: 'ev-mode' + (PS.kind === k ? ' on' : ''), onclick: () => { PS.kind = k; paint(); } }, [h('b', { text: t }), h('span', { text: s })])));
  pane.appendChild(kinds);
  pane.appendChild(h('div', { cls: 'sec', text: '2. 名前の出し方' }));
  const nm = h('div', { cls: 'ps-names' });
  NAMES.forEach(([k, t]) => nm.appendChild(h('button', { cls: 'btn sm' + (PS.name === k ? ' coral' : ''), text: t, onclick: () => { PS.name = k; paint(); } })));
  pane.appendChild(nm);
  const chk = (key, label) => { const lb = h('label', { cls: 'chk' }), c = h('input', { type: 'checkbox' }); c.checked = PS[key]; c.onchange = () => { PS[key] = c.checked; paint(); }; lb.appendChild(c); lb.appendChild(h('span', { text: label })); return lb; };
  const opts = h('div', { cls: 'card ev-form' });
  if (PS.kind === 'team') opts.appendChild(chk('members', 'メンバーの名前ものせる'));
  if (PS.kind === 'person') {
    const n = h('input', { type: 'number', min: '1', max: '500', cls: 'ev-amt', 'aria-label': '上位何位まで' }); n.value = String(PS.topN); n.onchange = () => { PS.topN = Math.max(1, Math.min(500, Math.floor(+n.value || 20))); paint(); };
    opts.appendChild(h('div', { cls: 'ev-row' }, [h('span', { cls: 'ev-k', text: '上位' }), n, h('span', { text: '位まで（同じ点の人は全員）' })]));
    opts.appendChild(chk('showPicos', 'ピコの数ものせる'));
    opts.appendChild(h('div', { cls: 'hint', text: '担任助手（★）と、休止中の人は入れません。' }));
  }
  if (PS.kind === 'house') opts.appendChild(h('div', { cls: 'hint', text: '1枚目に上位5チーミの一覧、2枚目から1チーミ1枚（順位・名前・1人あたりピコ・メンバー・家の絵）。順位はランキングと同じ「1人あたりの累計ピコ」。' }));
  // 数の確認
  const st = h('div', { cls: 'stats' });
  st.appendChild(h('span', { cls: 'tag ok', text: 'チーミ ' + D.teams.length }));
  st.appendChild(h('span', { cls: 'tag ok', text: '名簿とひもづいた人 ' + D.people.length }));
  if (D.unreg.length) st.appendChild(h('span', { cls: 'tag warn', text: '未登録（名簿とひもづいていない me-）' + D.unreg.length + '人は、順位に入れず下にまとめます' }));
  opts.appendChild(st);
  opts.appendChild(h('div', { cls: 'acts-row' }, [
    h('button', { cls: 'btn coral', text: '印刷プレビュー', onclick: () => preview(ctx, D) }),
    PS.kind !== 'house' ? h('button', { cls: 'btn', text: 'CSV に書き出す', onclick: () => csv(D) }) : null
  ]));
  pane.appendChild(opts);
  if (!D.teams.length) pane.appendChild(h('div', { cls: 'hint', text: 'まだ家づくりを始めたチーミがありません。' }));
}

// ===== 紙面づくり =====
const head = (title, sub) => h('div', { cls: 'ps-head' }, [h('div', { cls: 'ps-brand', text: '向上ハウス' }), h('h1', { text: title }), h('div', { cls: 'ps-date', text: today() + '時点' + (sub ? '　' + sub : '') })]);
const rankBadge = n => h('span', { cls: 'ps-rk' + (n <= 3 ? ' r' + n : ''), text: n + '位' });
const foot = (i, n) => h('div', { cls: 'ps-foot', text: '東進ハイスクール藤沢校　向上ハウス' + (n > 1 ? '　' + (i + 1) + '／' + n : '') });
function paged(rows, per, mk) { const out = []; for (let i = 0; i < Math.max(1, rows.length); i += per) out.push(mk(rows.slice(i, i + per), out.length)); return out; }

function teamPages(D) {
  const per = PS.members ? 12 : 26;
  const pages = paged(D.teams, per, (rs, pi) => {
    const tb = h('table', { cls: 'ps-tbl' }, [h('tr', {}, ['順位', 'チーミ', '人数', '1人あたり', PS.members ? 'メンバー' : null].filter(Boolean).map(t => h('th', { text: t })))]);
    rs.forEach(r => tb.appendChild(h('tr', { cls: r.rank <= 3 ? 'top' : '' }, [h('td', { cls: 'c' }, [rankBadge(r.rank)]), h('td', { cls: 'nm', text: r.team.name }), h('td', { cls: 'c', text: r.count + '人' }), h('td', { cls: 'num', text: fmt(Math.round(r.per)) + ' ピコ' }), PS.members ? h('td', { cls: 'ps-memc', text: memberText(r, PS.name) }) : null])));
    return h('div', { cls: 'ps-page ps-port' }, [pi === 0 ? head('チーミランキング', '（1人あたりの累計ピコ）') : h('div', { cls: 'ps-cont', text: 'チーミランキング（つづき）' }), tb]);
  });
  pages.forEach((p, i) => p.appendChild(foot(i, pages.length)));
  return pages;
}
function personPages(D) {
  const list = topRanks(D.people, PS.topN), per = 30, rows = list.map(p => ({ p })), unreg = D.unreg;
  if (unreg.length) rows.push({ sep: true });
  if (unreg.length && PS.name === 'real') rows.push({ note: '名簿とひもづいていない me- が ' + unreg.length + '人います（順位には入れていません）' });
  else unreg.forEach(p => rows.push({ p, un: true }));
  const pages = paged(rows, per, (rs, pi) => {
    const tb = h('table', { cls: 'ps-tbl' }, [h('tr', {}, ['順位', '名前', 'チーミ', PS.showPicos ? '累計ピコ' : null].filter(Boolean).map(t => h('th', { text: t })))]);
    rs.forEach(x => {
      if (x.sep) { tb.appendChild(h('tr', { cls: 'sep' }, [h('td', { colspan: PS.showPicos ? '4' : '3', text: '未登録（名簿とひもづいていない me-・順位なし）' })])); return; }
      if (x.note) { tb.appendChild(h('tr', {}, [h('td', { colspan: PS.showPicos ? '4' : '3', cls: 'ps-note', text: x.note })])); return; }
      const p = x.p;
      tb.appendChild(h('tr', { cls: x.un ? 'un' : p.rank <= 3 ? 'top' : '' }, [h('td', { cls: 'c' }, [x.un ? h('span', { text: '—' }) : rankBadge(p.rank)]), h('td', { cls: 'nm', text: boardName(p, PS.name) }), h('td', { text: p.team ? p.team.name : '' }), PS.showPicos ? h('td', { cls: 'num', text: fmt(p.earned) + ' ピコ' }) : null]));
    });
    return h('div', { cls: 'ps-page ps-port' }, [pi === 0 ? head('個人ランキング', '上位' + PS.topN + '位（累計ピコ）') : h('div', { cls: 'ps-cont', text: '個人ランキング（つづき）' }), tb]);
  });
  pages.forEach((p, i) => p.appendChild(foot(i, pages.length)));
  return pages;
}
// 上位5チーミの部屋。家の絵は main.js の houseHi（ホームの小さな絵と同じ描き方を横2000pxで）
async function housePages(ctx, D, onStep) {
  const top = D.teams.slice(0, 5), pics = [];
  for (let i = 0; i < top.length; i++) { onStep && onStep(i + 1, top.length); await new Promise(r => setTimeout(r, 20)); pics.push(ctx.houseHi ? ctx.houseHi(top[i].team) : { full: '', close: '' }); }
  const img = (src, cls) => src ? h('img', { cls, src, alt: '' }) : h('div', { cls: cls + ' ps-noimg', text: 'まだ部屋がありません' });
  const cover = h('div', { cls: 'ps-page ps-land' }, [head('上位5チーミの部屋', '（1人あたりの累計ピコ）'), h('div', { cls: 'ps-cover' }, top.map((r, i) => h('div', { cls: 'ps-cv' + (i === 0 ? ' first' : '') }, [img(pics[i].full, 'ps-cv-img'), h('div', { cls: 'ps-cv-t' }, [rankBadge(r.rank), h('b', { text: r.team.name }), h('span', { text: '1人あたり ' + fmt(Math.round(r.per)) + ' ピコ' })])])))]);
  const pages = [cover];
  top.forEach((r, i) => {
    const p = pics[i];
    pages.push(h('div', { cls: 'ps-page ps-land ps-team' }, [
      h('div', { cls: 'ps-th' }, [rankBadge(r.rank), h('div', { cls: 'ps-tn' }, [h('b', { text: r.team.name }), h('span', { text: '1人あたり ' + fmt(Math.round(r.per)) + ' ピコ・' + r.count + '人' })]), h('div', { cls: 'ps-date', text: today() + '時点' })]),
      h('div', { cls: 'ps-tb' }, [img(p.full, 'ps-full'), h('div', { cls: 'ps-side' }, [p.close ? h('div', {}, [h('div', { cls: 'ps-k', text: 'いちばん家具が多い部屋' }), img(p.close, 'ps-close')]) : null, h('div', { cls: 'ps-k', text: 'メンバー' }), h('div', { cls: 'ps-mem', text: memberText(r, PS.name) })])]),
      h('div', { cls: 'ps-foot', text: '東進ハイスクール藤沢校　向上ハウス　　' + new Date().toLocaleDateString('ja-JP') + ' 作成' })
    ]));
  });
  return pages;
}

async function preview(ctx, D) {
  if (!D.teams.length && PS.kind !== 'person') { toast('まだ家づくりを始めたチーミがありません', 'ng'); return; }
  let pages;
  if (PS.kind === 'house') {
    const msg = h('div', { cls: 'hint', text: '家の絵を描いています…' }); modal('印刷プレビュー', msg, [], 'wide');
    pages = await housePages(ctx, D, (i, n) => { msg.textContent = '家の絵を描いています…（' + i + '／' + n + '）'; });
    closeModal();
  } else pages = PS.kind === 'team' ? teamPages(D) : personPages(D);
  const box = h('div', { cls: 'ps-prev' + (PS.kind === 'house' ? ' land' : '') });
  pages.forEach(p => box.appendChild(h('div', { cls: 'ps-prev-pg' }, [p.cloneNode(true)])));
  modal('印刷プレビュー（' + pages.length + '枚）', h('div', {}, [h('p', { cls: 'hint', text: '印刷の画面では「' + (PS.kind === 'house' ? 'A4・横' : 'A4・縦') + '」「背景のグラフィック：オン」にすると、色つきで出ます。' }), box]), [
    h('button', { cls: 'btn', text: 'とじる', onclick: closeModal }),
    h('button', { cls: 'btn coral', text: '印刷する', onclick: () => { closeModal(); ctx.printRoot(pages); } })
  ], 'wide');
}

function csv(D) {
  let rows, name;
  if (PS.kind === 'team') {
    rows = [['順位', 'チーミ', '人数', '1人あたりピコ', '合計ピコ'].concat(PS.members ? ['メンバー'] : [])];
    D.teams.forEach(r => rows.push([r.rank, r.team.name, r.count, Math.round(r.per), r.total].concat(PS.members ? [memberText(r, PS.name)] : [])));
    name = 'チーミランキング_' + ymd() + '.csv';
  } else {
    rows = [['順位', '名前', 'チーミ'].concat(PS.showPicos ? ['累計ピコ'] : [])];
    topRanks(D.people, PS.topN).forEach(p => rows.push([p.rank, boardName(p, PS.name), p.team ? p.team.name : ''].concat(PS.showPicos ? [p.earned] : [])));
    D.unreg.forEach(p => rows.push(['未登録', boardName(p, PS.name), p.team ? p.team.name : ''].concat(PS.showPicos ? [p.earned] : [])));
    name = '個人ランキング_' + ymd() + '.csv';
  }
  const a = h('a', { href: URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv' })), download: name }); document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  toast(name + ' を保存しました（この端末だけ）', 'ok');
}
export const posterTest = { data, teamPages, personPages, housePages };
