// 画面共通の小道具（要素づくり・モーダル・トースト）
export const $ = id => document.getElementById(id);
export const fmt = n => Math.round(n).toLocaleString('en-US');
export function h(tag, attrs, kids) {
  const e = document.createElement(tag);
  if (attrs) for (const k in attrs) { if (attrs[k] == null) continue; if (k === 'text') e.textContent = attrs[k]; else if (k.startsWith('on')) e.addEventListener(k.slice(2), attrs[k]); else if (k === 'cls') e.className = attrs[k]; else if (k === 'value') e.value = attrs[k]; else e.setAttribute(k, attrs[k]); }
  (kids || []).forEach(c => c != null && e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
  return e;
}
export function modal(title, body, acts, cls) {
  const d = $('dlg'); d.innerHTML = ''; d.className = cls || ''; d.appendChild(h('h3', { text: title })); d.appendChild(body);
  const a = h('div', { cls: 'acts' }); (acts || []).forEach(b => a.appendChild(b)); d.appendChild(a); $('modal').hidden = false;
}
export function closeModal() { $('modal').hidden = true; $('dlg').innerHTML = ''; }
export function confirmDlg(msg, ok, title) {
  return new Promise(res => {
    modal(title || 'かくにん', h('p', { text: msg }), [h('button', { cls: 'btn', text: 'やめる', onclick: () => { closeModal(); res(false); } }), h('button', { cls: 'btn coral', text: ok || 'OK', onclick: () => { closeModal(); res(true); } })]);
  });
}
export function toast(msg, kind) {
  const t = h('div', { cls: 'toast ' + (kind || ''), text: msg }); $('toasts').appendChild(t);
  while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
  setTimeout(() => t.remove(), 2700);
}
// 全画面シート（担任助手モード・ランキングで使う）
export function openSheet(title, buildBody, onClose) {
  const s = $('sheet'); s.hidden = false; s.innerHTML = '';
  const head = h('div', { cls: 'sh-head' }, [h('div', { cls: 'sh-title', text: title }), h('button', { cls: 'btn sm', text: 'とじる', onclick: () => closeSheet(onClose) })]);
  const body = h('div', { cls: 'sh-body' }); s.appendChild(head); s.appendChild(body); buildBody(body, head);
  return body;
}
export function closeSheet(onClose) { const s = $('sheet'); s.hidden = true; s.innerHTML = ''; if (onClose) onClose(); }
// 空の状態：絵文字のイラスト＋一言（＋ひとこと補足）
export function emptyBox(icon, text, sub) {
  return h('div', { cls: 'empty' }, [h('div', { cls: 'empty-ico', text: icon }), h('div', { cls: 'empty-t', text }), sub ? h('div', { cls: 'empty-sub', text: sub }) : null]);
}
// 読み込み中：葉っぱのアニメ＋ひとことヒント（index.html の最初の表示と同じ見た目）
export const HINTS = ['ピコは、向上得点・在校時間・ミッションでたまります', '家具をタップすると、動かす・回す・しまうができます', 'チーミ貯金箱のピコで、みんなの家を広げられます', '2本指で拡大・縮小、ドラッグで視点を変えられます', '壁紙と床は、リフォームで部屋ごとに変えられます'];
export function loadingBox(msg) {
  return h('div', { cls: 'boot', role: 'status' }, [h('div', { cls: 'boot-leaves', 'aria-hidden': 'true' }, [h('i'), h('i'), h('i')]), h('p', { cls: 'boot-t', text: msg || '読み込み中' }), h('p', { cls: 'boot-h', text: 'ヒント：' + HINTS[Math.floor(Math.random() * HINTS.length)] })]);
}
