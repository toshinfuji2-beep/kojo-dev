// 案内・おかえり・お祝い・手ごたえの動き（DOMだけ。ゲームの状態は main.js から引数で受け取る）
import { $, h, fmt, modal, closeModal } from './ui.js?v=202611131634';

const LS = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
};
export const motionOK = () => { try { return !window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return true; } };

// ===== はじめての案内（コーチマーク） =====
const COACH_KEY = 'kojoHouse.coachSeen';
export const coachSeen = () => LS.get(COACH_KEY) === '1';
export const setCoachSeen = v => LS.set(COACH_KEY, v ? '1' : '0');
export const COACH_STEPS = [
  { t: '歩く', d: '部屋の床をタップすると、あなたの me- がそこまで歩きます。ドラッグで視点を変えられます。', sel: '#cv' },
  { t: 'ショップで買う', d: 'ショップの家具をタップすると、ピコで買えます。足りないときは「あと○ピコ」と出ます。', sel: '#panel' },
  { t: '置く・回す', d: '置きたい場所をタップして「ここに置く」。置いた家具をタップすると、移動・回転・しまうができます。', sel: '#cv' },
  { t: '貯金箱と間取り', d: 'チーミ貯金箱にピコを寄付すると、「間取り」タブで家を広げたり部屋を増やしたりできます。', sel: '#bankBox' }
];
let coachEl = null;
export const coachOpen = () => !!coachEl;
export function startCoach(opt) {
  if (coachEl) return; opt = opt || {}; let i = 0;
  const ring = h('div', { cls: 'coach-ring', 'aria-hidden': 'true' }), card = h('div', { cls: 'coach-card', role: 'dialog', 'aria-label': 'あそび方' });
  coachEl = h('div', { id: 'coach' }, [ring, card]); document.body.appendChild(coachEl);
  const done = () => { setCoachSeen(true); if (coachEl) coachEl.remove(); coachEl = null; window.removeEventListener('resize', place); if (opt.onDone) opt.onDone(); };
  const target = () => { const s = COACH_STEPS[i].sel; let e = document.querySelector(s); if (e && (e.offsetWidth === 0 || e.offsetHeight === 0)) e = null; return e; };
  function place() {
    const e = target(), r = e ? e.getBoundingClientRect() : null;
    if (r && i !== 0 && i !== 2) { ring.style.cssText = 'left:' + (r.left - 4) + 'px;top:' + (r.top - 4) + 'px;width:' + (r.width + 8) + 'px;height:' + (r.height + 8) + 'px'; ring.hidden = false; } else ring.hidden = true;
    // カードは、ハイライトと重ならない側（パネルのときは左、それ以外は下の中央）
    const pr = $('panel') && $('panel').offsetWidth ? $('panel').getBoundingClientRect() : null;
    card.style.left = '50%'; card.style.right = 'auto';
    if (i === 1 && pr) { card.style.left = Math.max(8, pr.left / 2) + 'px'; }
    else if (pr) card.style.left = Math.max(8, pr.left / 2) + 'px';
    card.classList.toggle('top', i === 3);
  }
  function paint() {
    card.innerHTML = '';
    card.appendChild(h('div', { cls: 'coach-n', text: (i + 1) + ' / ' + COACH_STEPS.length }));
    card.appendChild(h('div', { cls: 'coach-t', text: COACH_STEPS[i].t }));
    card.appendChild(h('div', { cls: 'coach-d', text: COACH_STEPS[i].d }));
    const dots = h('div', { cls: 'coach-dots' }); COACH_STEPS.forEach((_, k) => dots.appendChild(h('i', { cls: k === i ? 'on' : '' })));
    const last = i === COACH_STEPS.length - 1;
    card.appendChild(h('div', { cls: 'coach-acts' }, [h('button', { cls: 'btn ghost sm', text: 'スキップ', onclick: done }), dots, h('button', { cls: 'btn mint sm', text: last ? 'はじめる' : '次へ', onclick: () => { if (last) done(); else { i++; paint(); } } })]));
    place();
  }
  window.addEventListener('resize', place); paint();
}

// ===== 紙ふぶき・コインが飛ぶ・きらっ =====
export function confetti(n) {
  if (!motionOK()) return; n = n || 36;
  const box = h('div', { cls: 'confetti', 'aria-hidden': 'true' }); const cols = ['#f2877a', '#f5c542', '#8ccc6c', '#6fc3e8', '#c79be8'];
  for (let k = 0; k < n; k++) { const p = h('i'); p.style.cssText = 'left:' + (Math.random() * 100) + '%;background:' + cols[k % cols.length] + ';--dx:' + ((Math.random() - .5) * 160) + 'px;--r:' + (Math.random() * 720 - 360) + 'deg;animation-delay:' + (Math.random() * .5) + 's;animation-duration:' + (1.6 + Math.random() * 1.2) + 's'; box.appendChild(p); }
  document.body.appendChild(box); setTimeout(() => box.remove(), 3600);
}
// from の位置から to（要素）へコインが飛ぶ
export function flyCoins(fromRect, toEl, n) {
  if (!motionOK() || !fromRect || !toEl || !toEl.getBoundingClientRect) return;
  const tr = toEl.getBoundingClientRect(); n = n || 5;
  for (let k = 0; k < n; k++) {
    const c = h('span', { cls: 'coin fly-coin', 'aria-hidden': 'true' }); const x0 = fromRect.left + fromRect.width / 2 - 11 + (Math.random() - .5) * 24, y0 = fromRect.top + fromRect.height / 2 - 11 + (Math.random() - .5) * 24;
    c.style.cssText = 'left:' + x0 + 'px;top:' + y0 + 'px'; document.body.appendChild(c);
    const dx = tr.left + tr.width / 2 - 11 - x0, dy = tr.top + tr.height / 2 - 11 - y0;
    if (c.animate) { const a = c.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: 'translate(' + dx * .5 + 'px,' + (dy * .5 - 40) + 'px) scale(1.15)', opacity: 1, offset: .5 }, { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.6)', opacity: .9 }], { duration: 650 + k * 70, delay: k * 50, easing: 'ease-in', fill: 'backwards' }); a.onfinish = () => c.remove(); } else c.remove();
    setTimeout(() => c.remove(), 1600);
  }
}
export function sparkleAt(x, y) {
  if (!motionOK()) return;
  const s = h('div', { cls: 'sparkle', 'aria-hidden': 'true' }); s.style.cssText = 'left:' + x + 'px;top:' + y + 'px'; for (let k = 0; k < 6; k++) { const i = h('i'); i.style.setProperty('--a', (k * 60) + 'deg'); s.appendChild(i); } document.body.appendChild(s); setTimeout(() => s.remove(), 800);
}
export function bounceEl(el) { if (!el || !motionOK()) return; el.classList.remove('pop-bounce'); void el.offsetWidth; el.classList.add('pop-bounce'); }

// ===== おかえり表示：前回この端末で見た時点からの増え方 =====
const seenKey = uid => 'kojoHouse.seen.' + uid;
export function readSeen(uid) { try { const o = JSON.parse(LS.get(seenKey(uid)) || 'null'); return o && isFinite(o.e) ? o : null; } catch (e) { return null; } }
export function writeSeen(uid, o) { LS.set(seenKey(uid), JSON.stringify(o)); }
// 内訳：向上得点(点×rate)・在校時間(分×stayRate/100)・それ以外（ミッションなど）。累計が取れないときは合計だけ
export function gainBreakdown(prev, now, rate, stayRate) {
  const total = Math.round(now.e - prev.e); if (!(total > 0)) return null;
  const parts = []; let rest = total;
  if (prev.sc != null && now.sc != null && now.sc > prev.sc) { const v = Math.min(rest, Math.round((now.sc - prev.sc) * rate)); if (v > 0) { parts.push(['向上得点', v]); rest -= v; } }
  if (prev.st != null && now.st != null && now.st > prev.st) { const v = Math.min(rest, Math.round((now.st - prev.st) * stayRate / 100)); if (v > 0) { parts.push(['在校時間', v]); rest -= v; } }
  if (rest > 0 && parts.length) parts.push(['ミッションなど', rest]);
  return { total, parts };
}
export function welcomeBack(nick, g, o) {
  o = o || {};
  const big = h('b', { cls: 'wb-n', text: '+0' });
  const rows = h('div', { cls: 'wb-rows' }); g.parts.forEach(([k, v]) => rows.appendChild(h('div', { cls: 'wb-row' }, [h('span', { text: k }), h('b', { text: '+' + fmt(v) })])));
  const body = h('div', { cls: 'wb' }, [h('div', { cls: 'wb-pico' }, [h('span', { cls: 'coin' }), big, h('i', { text: 'ピコ' })]), h('p', { cls: 'wb-sub', text: '前回から増えたピコです' }), g.parts.length ? rows : null]);
  modal(nick + 'さん、おかえりなさい', body, [h('button', { cls: 'btn coral', text: '家へ', onclick: () => { closeModal(); if (o.onClose) o.onClose(); } })], 'sticky wbbox');
  const total = g.total;
  if (!motionOK()) big.textContent = '+' + fmt(total);
  else { const t0 = performance.now(), dur = Math.min(1600, 700 + total / 40); let last = -1; const step = t => { if (!big.isConnected) return; const k = Math.min(1, (t - t0) / dur), v = Math.round(total * (1 - Math.pow(1 - k, 3))); if (v !== last) { last = v; big.textContent = '+' + fmt(v); if (o.tick && k < 1) o.tick(); } if (k < 1) requestAnimationFrame(step); else { confetti(18); if (o.done) o.done(); } }; requestAnimationFrame(step); }
}

// ===== お祝い：ランクアップ・新しい家具の解放 =====
export function celebrate(title, sub, icons, o) {
  o = o || {}; confetti(48);
  const row = h('div', { cls: 'cele-items' }); (icons || []).slice(0, 8).forEach(x => row.appendChild(h('div', { cls: 'cele-it' }, [x.img ? x.img : null, h('span', { text: x.name })])));
  const card = h('div', { cls: 'cele-card', role: 'dialog', 'aria-label': title }, [h('div', { cls: 'cele-t', text: title }), sub ? h('div', { cls: 'cele-s', text: sub }) : null, (icons || []).length ? row : null, h('button', { cls: 'btn coral', text: 'OK', onclick: () => { el.remove(); if (o.onClose) o.onClose(); } })]);
  const el = h('div', { id: 'cele' }, [card]); document.body.appendChild(el); return el;
}
