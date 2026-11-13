// 間取りを決める画面：真上から見た家の図（SVG）で、部屋を広げる・せばめる・つくる・こわす・壁をなくす。
// 変更は下書き(draft)に溜めて、「この間取りにする」で一度に確定する（費用・足りないピコ・まちがいは図の上にその場で出す）
import { CFG, ITEM, edgesOf, entranceOf, pairKey, checkLayout, layoutCost } from './data.js?v=202611131634';
import { h, fmt, openSheet, closeSheet } from './ui.js?v=202611131634';

const HANDLE_PX = 24;   // つまみを つかめる半径（画面ピクセル）。直径48pxで、32px以上の目安を満たす
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// o = { T, cur, n(人数), mul(), bank(), run(res) -> Promise<boolean>, say(msg, kind) }
export function openPlan(o) {
  const prev = o.T.rooms, init = prev.map((r, k) => ({ k, name: r.name, x: r.x, z: r.z, w: r.w, d: r.d })), initOpen = (o.T.open || []).slice().sort().join(',');
  let draft = init.map(r => Object.assign({}, r)), open = new Set(o.T.open || []), sel = Math.min(o.cur | 0, prev.length - 1), mode = null, drag = null, busy = false, vb = { x: 0, z: 0, w: 16, h: 12 }, res = null, cost = 0, hint = '';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'plan-svg'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', '家を真上から見た間取り図');
  const msg = h('div', { cls: 'plan-msg' }), map = h('div', { cls: 'plan-map' }, [svg, msg]), side = h('aside', { cls: 'plan-side' });
  let scroll = null, foot = null, nameIn = null;
  const reset = () => { draft = init.map(r => Object.assign({}, r)); open = new Set(o.T.open || []); sel = Math.min(o.cur | 0, prev.length - 1); mode = null; fitView(); refresh(); };
  const changed = () => JSON.stringify(draft.map(r => [r.k, r.name, r.x, r.z, r.w, r.d])) !== JSON.stringify(init.map(r => [r.k, r.name, r.x, r.z, r.w, r.d])) || [...open].sort().join(',') !== initOpen;
  const calc = () => { res = checkLayout(prev, draft, [...open]); cost = res.err ? 0 : layoutCost(prev, res.rooms, o.n, o.mul()); };
  const bbox = () => { let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; draft.forEach(r => { x0 = Math.min(x0, r.x); z0 = Math.min(z0, r.z); x1 = Math.max(x1, r.x + r.w); z1 = Math.max(z1, r.z + r.d); }); return { x0, z0, x1, z1 }; };
  function fitView() {
    const b = bbox(), m = 3.5, w = Math.max(b.x1 - b.x0 + m * 2, 14), hh = Math.max(b.z1 - b.z0 + m * 2, 10);
    vb = { x: (b.x0 + b.x1) / 2 - w / 2, z: (b.z0 + b.z1) / 2 - hh / 2, w, h: hh };
    svg.setAttribute('viewBox', vb.x + ' ' + vb.z + ' ' + vb.w + ' ' + vb.h);
  }
  const geo = () => { const r = svg.getBoundingClientRect(), u = Math.min(r.width / vb.w, r.height / vb.h) || 1; return { r, u, ox: (r.width - vb.w * u) / 2, oy: (r.height - vb.h * u) / 2 }; };
  const toW = e => { const g = geo(); return [vb.x + (e.clientX - g.r.left - g.ox) / g.u, vb.z + (e.clientY - g.r.top - g.oy) / g.u]; };
  const floorColor = r => { const rr = r.k != null ? prev[r.k] : null, f = ITEM[rr ? rr.floor : 'fl_wood']; return (f && f.color) || '#e8d3ae'; };
  const handles = r => [{ side: 'l', x: r.x, z: r.z + r.d / 2 }, { side: 'r', x: r.x + r.w, z: r.z + r.d / 2 }, { side: 't', x: r.x + r.w / 2, z: r.z }, { side: 'b', x: r.x + r.w / 2, z: r.z + r.d }];

  function drawMap() {
    const g = geo(), hr = 17 / g.u, sw = 1.5 / g.u, parts = [];
    let gp = ''; for (let x = Math.ceil(vb.x); x <= vb.x + vb.w; x++) gp += 'M' + x + ' ' + vb.z + 'V' + (vb.z + vb.h); for (let z = Math.ceil(vb.z); z <= vb.z + vb.h; z++) gp += 'M' + vb.x + ' ' + z + 'H' + (vb.x + vb.w);
    parts.push('<path d="' + gp + '" stroke="#b98650" stroke-opacity=".16" stroke-width="' + sw + '" fill="none"/>');
    draft.forEach((r, i) => {
      const bad = res && res.bad === i, on = i === sel;
      parts.push('<rect x="' + r.x + '" y="' + r.z + '" width="' + r.w + '" height="' + r.d + '" rx=".12" fill="' + floorColor(r) + '" fill-opacity="' + (on ? .95 : .78) + '" stroke="' + (bad ? '#d9362b' : '#8a6a44') + '" stroke-width="' + (bad ? .2 : .1) + '"' + (bad ? ' stroke-dasharray=".5 .3"' : '') + '/>');
      const len = String(r.name).length || 1, fs = Math.max(.5, Math.min(1.05, (r.w - .4) / Math.max(2, len * 1.02))), cy = r.z + r.d / 2;
      parts.push('<text x="' + (r.x + r.w / 2) + '" y="' + (cy + (r.d >= 3 ? -.05 : .3)) + '" text-anchor="middle" font-size="' + fs + '" font-weight="800" fill="#4a3624" stroke="#fffaf0" stroke-width="' + fs * .18 + '" paint-order="stroke">' + esc(r.name) + '</text>');
      if (r.d >= 3) parts.push('<text x="' + (r.x + r.w / 2) + '" y="' + (cy + fs * .95) + '" text-anchor="middle" font-size="' + fs * .72 + '" fill="#6a5238">' + r.w + '×' + r.d + '</text>');
    });
    // 部屋の間の壁・入口・ひとつづき
    const rooms = draft.map(r => ({ x: r.x, z: r.z, w: r.w, d: r.d }));
    let ed = []; try { ed = edgesOf(rooms); } catch (e) { ed = []; }
    ed.forEach(e => {
      const L = (a, b, c) => e.ax === 'z' ? '<line x1="' + e.pos + '" y1="' + a + '" x2="' + e.pos + '" y2="' + b + '" ' + c + '/>' : '<line x1="' + a + '" y1="' + e.pos + '" x2="' + b + '" y2="' + e.pos + '" ' + c + '/>';
      if (open.has(pairKey(e.i, e.j))) parts.push(L(e.a0 + .05, e.a1 - .05, 'stroke="#fffaf0" stroke-width=".3" stroke-dasharray=".35 .3" stroke-linecap="butt"'));
      else { if (e.d0 > e.a0) parts.push(L(e.a0, e.d0, 'stroke="#6b4a2b" stroke-width=".2"')); if (e.a1 > e.d1) parts.push(L(e.d1, e.a1, 'stroke="#6b4a2b" stroke-width=".2"')); parts.push(L(e.d0 + .06, e.d1 - .06, 'stroke="#f5c542" stroke-width=".34" stroke-linecap="round"')); }
    });
    const ent = rooms.length && res && !res.err ? entranceOf(rooms) : (() => { try { return entranceOf(rooms); } catch (e) { return null; } })();
    if (ent) { const r = draft[ent.k], cx = r.x + (ent.x0 + ent.x1) / 2, zf = r.z + r.d; parts.push('<path d="M' + (cx - .7) + ' ' + (zf + .25) + 'h1.4l-.7 .7z" fill="#4fb59c"/><text x="' + cx + '" y="' + (zf + 1.85) + '" text-anchor="middle" font-size=".8" font-weight="800" fill="#1d5a4a">玄関</text>'); }
    // 選んでいる部屋：ふちとつまみ
    if (sel != null && draft[sel] && mode !== 'draw') {
      const r = draft[sel]; parts.push('<rect x="' + r.x + '" y="' + r.z + '" width="' + r.w + '" height="' + r.d + '" rx=".12" fill="none" stroke="#f2877a" stroke-width=".22" pointer-events="none"/>');
      handles(r).forEach(hd => parts.push('<g data-h="' + hd.side + '"><circle cx="' + hd.x + '" cy="' + hd.z + '" r="' + hr + '" fill="#fff" stroke="#f2877a" stroke-width="' + 2.5 / g.u + '"/><circle cx="' + hd.x + '" cy="' + hd.z + '" r="' + hr * .38 + '" fill="#f2877a"/></g>'));
    }
    if (drag && drag.kind === 'draw') {
      const x = Math.min(drag.x0, drag.x1), z = Math.min(drag.z0, drag.z1), w = Math.abs(drag.x1 - drag.x0), d = Math.abs(drag.z1 - drag.z0), okSz = w >= CFG.MIN_RW && d >= CFG.MIN_RW;
      parts.push('<rect x="' + x + '" y="' + z + '" width="' + w + '" height="' + d + '" fill="' + (okSz ? '#8fd3c0' : '#f2877a') + '" fill-opacity=".45" stroke="' + (okSz ? '#4fb59c' : '#d9362b') + '" stroke-width=".16" stroke-dasharray=".4 .25"/>');
      if (w || d) parts.push('<text x="' + (x + w / 2) + '" y="' + (z + d / 2 + .3) + '" text-anchor="middle" font-size=".9" font-weight="800" fill="#1d3a30">' + w + '×' + d + '</text>');
    }
    svg.innerHTML = parts.join('');
  }
  function drawMsg() {
    let t = '', k = '';
    if (mode === 'draw') { t = '空いている所を指でなぞって四角を描く（3×3マス以上、今ある部屋に辺でくっつける）'; k = 'tip'; }
    else if (res && res.err) { t = res.msg; k = 'ng'; }
    else if (hint) { t = hint; k = 'tip'; }
    else if (!changed()) { t = '部屋をえらんで、まるいつまみを ドラッグして広げよう'; k = 'tip'; }
    else { t = cost ? '費用 ' + fmt(cost) + ' ピコ（貯金箱 ' + fmt(o.bank()) + ' ピコ）' : 'この変更は無料です'; k = o.bank() < cost ? 'ng' : 'ok'; if (o.bank() < cost) t += '　あと ' + fmt(cost - o.bank()) + ' ピコ足りません'; }
    msg.textContent = t; msg.className = 'plan-msg ' + k;
  }
  function renderSide() {
    const keepName = nameIn && document.activeElement === nameIn ? { v: nameIn.value, s: nameIn.selectionStart } : null;
    side.innerHTML = ''; scroll = h('div', { cls: 'plan-sc' }); foot = h('div', { cls: 'plan-foot' });
    const r = sel != null ? draft[sel] : null;
    if (r) {
      nameIn = h('input', { type: 'text', maxlength: '8', value: r.name, 'aria-label': '部屋の名前', placeholder: '部屋の名前' });
      nameIn.addEventListener('input', () => { r.name = nameIn.value.slice(0, 8); refresh(true); });
      scroll.appendChild(h('div', { cls: 'plan-sec' }, [h('div', { cls: 'plan-lb', text: '選んでいる部屋' }), nameIn, h('div', { cls: 'plan-size', text: r.w + '×' + r.d + '（' + r.w * r.d + 'マス）' })]));
      const ed = edgesOf(draft.map(q => ({ x: q.x, z: q.z, w: q.w, d: q.d }))).filter(e => e.i === sel || e.j === sel);
      if (ed.length) {
        const sec = h('div', { cls: 'plan-sec' }, [h('div', { cls: 'plan-lb', text: 'となりの部屋との壁' })]);
        ed.forEach(e => {
          const oi = e.i === sel ? e.j : e.i, key = pairKey(e.i, e.j), isOpen = open.has(key);
          const mk = (on, txt, val) => h('button', { cls: 'seg' + (on ? ' on' : ''), text: txt, onclick: () => { if (val) open.add(key); else open.delete(key); refresh(); } });
          sec.appendChild(h('div', { cls: 'plan-wall' }, [h('div', { cls: 'plan-wn', text: draft[oi].name }), h('div', { cls: 'seg-g' }, [mk(!isOpen, '壁あり', false), mk(isOpen, 'ひとつづき', true)])]));
        });
        scroll.appendChild(sec);
      }
      if (sel > 0) {
        const full = r.k != null && (prev[r.k].items || []).length > 0;
        scroll.appendChild(h('div', { cls: 'plan-sec' }, [h('button', { cls: 'btn sm bad', text: 'この部屋をこわす', disabled: full ? '' : null, onclick: () => removeRoom(sel) }), full ? h('div', { cls: 'plan-note', text: '家具があるのでこわせません' }) : h('div', { cls: 'plan-note', text: '返金はないよ' })]));
      }
    } else scroll.appendChild(h('div', { cls: 'plan-sec' }, [h('div', { cls: 'plan-note', text: '図の部屋をタップ' })]));
    const add = h('button', { cls: 'btn mint', text: mode === 'draw' ? 'やめる' : '＋ 部屋をつくる', disabled: draft.length >= CFG.MAX_ROOMS && mode !== 'draw' ? '' : null, onclick: () => { mode = mode === 'draw' ? null : 'draw'; drag = null; hint = ''; refresh(); } });
    scroll.appendChild(h('div', { cls: 'plan-sec row2' }, [add, h('button', { cls: 'btn', text: 'もとにもどす', disabled: changed() ? null : '', onclick: reset })]));
    scroll.appendChild(h('div', { cls: 'plan-note', text: '部屋 ' + draft.length + ' / ' + CFG.MAX_ROOMS }));
    const label = res && res.err ? 'この間取りにする' : cost ? 'この間取りにする（' + fmt(cost) + ' ピコ）' : 'この間取りにする（無料）';
    const can = changed() && res && !res.err && o.bank() >= cost && !busy;
    foot.appendChild(h('button', { cls: 'btn coral plan-go', text: label, disabled: can ? null : '', onclick: commit }));
    side.appendChild(scroll); side.appendChild(foot);
    if (keepName && nameIn) { nameIn.focus(); try { nameIn.setSelectionRange(keepName.s, keepName.s); } catch (e) { } }
  }
  function refresh(light) { calc(); drawMap(); drawMsg(); if (light) { const g = foot && foot.querySelector('.plan-go'); if (g) { const can = changed() && res && !res.err && o.bank() >= cost && !busy; g.disabled = !can; g.textContent = res.err ? 'この間取りにする' : cost ? 'この間取りにする（' + fmt(cost) + ' ピコ）' : 'この間取りにする（無料）'; } return; } renderSide(); }
  function removeRoom(i) {
    if (i <= 0) return; draft.splice(i, 1);
    const no = new Set(); open.forEach(k => { const [a, b] = k.split('-').map(Number); if (a === i || b === i) return; no.add(pairKey(a > i ? a - 1 : a, b > i ? b - 1 : b)); }); open = no;
    sel = Math.min(sel, draft.length - 1); fitView(); refresh();
  }
  async function commit() {
    if (busy || !res || res.err) return; busy = true; refresh();
    let ok = false; try { ok = await o.run({ rooms: res.rooms, open: res.open, cost }); } finally { busy = false; }
    if (ok) closeSheet(); else refresh();
  }
  // ===== 指・マウスの操作 =====
  const nearest = (r, gx, gz, g) => { let best = null, bd = HANDLE_PX; handles(r).forEach(hd => { const dd = Math.hypot((gx - hd.x) * g.u, (gz - hd.z) * g.u); if (dd < bd) { bd = dd; best = hd; } }); return best; };
  function dragEdge(side, base, gx, gz) {
    const n = Object.assign({}, base), cl = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    if (side === 'l') { const nx = cl(Math.round(gx), base.x + base.w - CFG.MAX_RW, base.x + base.w - CFG.MIN_RW); n.x = nx; n.w = base.x + base.w - nx; }
    else if (side === 'r') { const nr = cl(Math.round(gx), base.x + CFG.MIN_RW, base.x + CFG.MAX_RW); n.w = nr - base.x; }
    else if (side === 't') { const nz = cl(Math.round(gz), base.z + base.d - CFG.MAX_RW, base.z + base.d - CFG.MIN_RW); n.z = nz; n.d = base.z + base.d - nz; }
    else { const nb = cl(Math.round(gz), base.z + CFG.MIN_RW, base.z + CFG.MAX_RW); n.d = nb - base.z; }
    Object.assign(draft[sel], { x: n.x, z: n.z, w: n.w, d: n.d });
  }
  svg.addEventListener('pointerdown', e => {
    if (busy) return; e.preventDefault(); try { svg.setPointerCapture(e.pointerId); } catch (x) { }
    const [gx, gz] = toW(e), g = geo(); hint = '';
    if (mode === 'draw') { const x = Math.round(gx), z = Math.round(gz); drag = { kind: 'draw', x0: x, z0: z, x1: x, z1: z }; refresh(true); return; }
    if (sel != null && draft[sel]) { const hd = nearest(draft[sel], gx, gz, g); if (hd) { drag = { kind: 'edge', side: hd.side, base: Object.assign({}, draft[sel]) }; return; } }
    const i = draft.findIndex(r => gx >= r.x && gx < r.x + r.w && gz >= r.z && gz < r.z + r.d);
    if (i >= 0 && i !== sel) { sel = i; refresh(); }
    drag = { kind: 'tap' };
  });
  svg.addEventListener('pointermove', e => {
    if (!drag) return; const [gx, gz] = toW(e);
    if (drag.kind === 'edge') { dragEdge(drag.side, drag.base, gx, gz); refresh(true); }
    else if (drag.kind === 'draw') { drag.x1 = Math.round(gx); drag.z1 = Math.round(gz); calc(); drawMap(); }
  });
  const up = () => {
    const d = drag; drag = null; if (!d) return;
    if (d.kind === 'edge') { fitView(); refresh(); }
    else if (d.kind === 'draw') finishDraw(d);
  };
  svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
  function finishDraw(d) {
    const x = Math.min(d.x0, d.x1), z = Math.min(d.z0, d.z1), w = Math.abs(d.x1 - d.x0), dd = Math.abs(d.z1 - d.z0);
    if (w < 1 && dd < 1) { refresh(); return; }
    if (!addRoom(x, z, w, dd)) { refresh(); }
  }
  // 新しい部屋を足す。だめなら理由を図の上に出して false
  function addRoom(x, z, w, dd, name) {
    if (draft.length >= CFG.MAX_ROOMS) { hint = '部屋はこれ以上作れません'; return false; }
    if (w < CFG.MIN_RW || dd < CFG.MIN_RW) { hint = '3×3マス以上で描いてください'; return false; }
    const nr = { k: null, name: (name || CFG.ROOM_NAMES[draft.length] || '新しい部屋'), x, z, w, d: dd }, test = draft.concat([nr]), c = checkLayout(prev, test, [...open]);
    if (c.err && c.err !== 'fit') { hint = c.err === 'overlap' ? '今ある部屋と重ならないように描いてください' : c.err === 'conn' ? '今ある部屋に辺でくっつけて描いてください' : c.msg; return false; }
    draft = test; sel = draft.length - 1; mode = null; fitView(); refresh(); if (nameIn) { nameIn.focus(); nameIn.select(); } return true;
  }
  // ===== 画面 =====
  const body = openSheet('間取り', (bd, head) => {
    bd.classList.add('planb');
    const bank = h('span', { cls: 'plan-bank' }, [h('span', { cls: 'coin xs' }), h('b', { text: fmt(o.bank()) }), h('i', { text: 'ピコ（貯金箱）' })]);
    head.insertBefore(bank, head.lastChild);
    bd.appendChild(map); bd.appendChild(side);
  });
  fitView(); refresh();
  new ResizeObserver(() => { if (svg.isConnected) drawMap(); }).observe(map);
  return { draft: () => draft, open: () => [...open], sel: i => { sel = i; refresh(); }, edge: (s, v) => { const b = Object.assign({}, draft[sel]); dragEdge(s, b, v, v); fitView(); refresh(); }, edgeXY: (s, gx, gz) => { dragEdge(s, Object.assign({}, draft[sel]), gx, gz); fitView(); refresh(); }, add: (x, z, w, d, n) => addRoom(x, z, w, d, n), toggle: (a, b) => { const k = pairKey(a, b); if (open.has(k)) open.delete(k); else open.add(k); refresh(); }, remove: removeRoom, state: () => ({ res, cost, changed: changed(), err: res && res.err }), commit, body };
}
