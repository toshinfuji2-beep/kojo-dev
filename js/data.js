// ===== 向上ハウス データ定義（価格・閾値はここで調整） =====
export const CFG = {
  START_PTS: 3000,                 // 初期所持（デモ）
  SELL_RATE: 0.5,                  // 売却返金率
  ROOM_SIZES: [6, 8, 10, 12, 14],  // （旧）広さの段階。古いセーブの移行(roomSize)にだけ使う
  MIN_SIZE: 6, MAX_SIZE: 14,       // 部屋の一辺の下限・上限（偶数）
  ROOM_COST: [5000, 12000, 25000], // 5人の基準。新しい部屋ごとの追加料（2,3,4部屋目以降。人数/5 をかけて100単位に丸める）
  COST_BASE_N: 5,
  STAY_RATE: 1000,                 // 在校100分あたりのピコ（設定で変更可）
  MAX_ROOMS: 6,                    // 部屋の最大数
  MIN_RW: 3, MAX_RW: 16, MAX_SPAN: 24,   // 部屋の一辺（マス）の下限・上限／家全体の外寸の上限
  CELL_COST: 80,                   // 1マスの基本の値段（5人・物価1・家の面積36のとき）
  ROOM_NAMES: ['自分の部屋', 'リビング', '書斎', '屋根裏', '子ども部屋', 'ゲストルーム'],
  WALL_H: 3.4,
  RANKS: [
    { min: 0, name: '見習い' },
    { min: 5000, name: 'ルーキー' },
    { min: 15000, name: 'がんばり屋' },
    { min: 40000, name: '努力家' },
    { min: 100000, name: '秀才' },
    { min: 250000, name: 'マスター' }
  ]
};

// ===== 人数で決まる家の広さ・費用 =====
// 初期の一辺 = max(6, ceil(sqrt(8×人数))) を偶数に切り上げ（上限14）
export function baseSize(n) {
  let v = Math.max(CFG.MIN_SIZE, Math.ceil(Math.sqrt(8 * Math.max(1, n | 0)))); if (v % 2) v++;
  return Math.min(CFG.MAX_SIZE, v);
}
// 玄関（手前の壁の中央）：ここのマスには家具を置けない。部屋の一辺 n に対して x が n/2-1〜n/2+1、奥行きは手前の1マス
export const entranceRect = n => ({ x0: n / 2 - 1, x1: n / 2 + 1, y0: n - 1, y1: n });
export const roomSize = (base, lv) => Math.min(CFG.MAX_SIZE, base + 2 * lv);
const r100 = v => Math.max(100, Math.round(v / 100) * 100);
// 部屋追加費（nowRooms 部屋あるとき）
export function roomCost(nowRooms, n, mul) { return r100(CFG.ROOM_COST[Math.max(0, Math.min(CFG.ROOM_COST.length - 1, nowRooms - 1))] * mul * Math.max(1, n) / CFG.COST_BASE_N); }

// ===== 間取り（家の中の部屋の位置と大きさ）=====
// rooms[i] = { x, z, w, d, ... }（x,z = 家のマス目での左奥の角、w,d = 横・奥行きのマス数）。open = ["i-j", ...]（i<j。間の壁をなくす組）
const ri = v => Number.isInteger(v);
export const pairKey = (i, j) => Math.min(i, j) + '-' + Math.max(i, j);
export const roomAt = (rooms, cx, cz) => rooms.findIndex(r => cx >= r.x && cx < r.x + r.w && cz >= r.z && cz < r.z + r.d);
export function houseBox(rooms) {
  let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
  rooms.forEach(r => { x0 = Math.min(x0, r.x); z0 = Math.min(z0, r.z); x1 = Math.max(x1, r.x + r.w); z1 = Math.max(z1, r.z + r.d); });
  return { x0, z0, x1, z1, w: x1 - x0, d: z1 - z0 };
}
// となり合う部屋が共有する辺。ax='z' は z 方向に伸びる壁（x=pos の線）、ax='x' は x 方向に伸びる壁（z=pos の線）。lo = 小さい側の部屋、hi = 大きい側の部屋
// 入口（d0〜d1）は幅2マス（辺が1マスなら1マス）、共有する辺の中央
export function edgesOf(rooms) {
  const out = [];
  for (let i = 0; i < rooms.length; i++) for (let j = i + 1; j < rooms.length; j++) {
    const a = rooms[i], b = rooms[j]; let e = null;
    const zo0 = Math.max(a.z, b.z), zo1 = Math.min(a.z + a.d, b.z + b.d), xo0 = Math.max(a.x, b.x), xo1 = Math.min(a.x + a.w, b.x + b.w);
    if ((a.x + a.w === b.x || b.x + b.w === a.x) && zo1 > zo0) e = { ax: 'z', pos: a.x + a.w === b.x ? b.x : a.x, a0: zo0, a1: zo1, lo: a.x < b.x ? i : j, hi: a.x < b.x ? j : i };
    else if ((a.z + a.d === b.z || b.z + b.d === a.z) && xo1 > xo0) e = { ax: 'x', pos: a.z + a.d === b.z ? b.z : a.z, a0: xo0, a1: xo1, lo: a.z < b.z ? i : j, hi: a.z < b.z ? j : i };
    if (e) { const len = e.a1 - e.a0, dw = Math.min(2, len); e.i = i; e.j = j; e.d0 = e.a0 + Math.floor((len - dw) / 2); e.d1 = e.d0 + dw; out.push(e); }
  }
  return out;
}
// 玄関：rooms[0] の手前（z=d 側）の壁が外に面していればその中央。面していなければ、手前の壁が外に面している最初の部屋。
// 返り値 { k, x0, x1 }（その部屋の中の横位置 x0〜x1 の2マス）と rect（家具を置けないマス）
export function entranceOf(rooms) {
  for (let k = 0; k < rooms.length; k++) {
    const r = rooms[k], ext = c => roomAt(rooms, r.x + c, r.z + r.d) < 0; let best = -1, bd = 1e9;
    for (let c = 0; c + 1 < r.w; c++) if (ext(c) && ext(c + 1)) { const dd = Math.abs(c + 1 - r.w / 2); if (dd < bd - 1e-9) { bd = dd; best = c; } }
    if (best >= 0) return { k, x0: best, x1: best + 2, rect: { x0: best, x1: best + 2, y0: r.d - 1, y1: r.d } };
  }
  return null;
}
// 壁の設計図。各セグメント { ax, pos, a0, a1, kind, lo, hi, room, side }
//   kind: 'out'=外壁 / 'wall'=部屋どうしの壁 / 'door'=部屋どうしの入口 / 'ent'=玄関。壁なし(open)の所は出さない
//   外壁は room（その部屋）と side（l=x小・r=x大・t=z小・b=z大）つき。部屋どうしの壁は小さい側が lo、大きい側が hi
export function wallPlan(rooms, open) {
  const ed = new Map(edgesOf(rooms).map(e => [pairKey(e.i, e.j), e])), op = new Set(open || []), ent = entranceOf(rooms), units = [];
  rooms.forEach((r, i) => {
    const sides = [['l', 'z', r.x, r.z, r.d, k => [r.x - 1, r.z + k]], ['r', 'z', r.x + r.w, r.z, r.d, k => [r.x + r.w, r.z + k]], ['t', 'x', r.z, r.x, r.w, k => [r.x + k, r.z - 1]], ['b', 'x', r.z + r.d, r.x, r.w, k => [r.x + k, r.z + r.d]]];
    sides.forEach(([side, ax, pos, a0, len, nb]) => {
      for (let k = 0; k < len; k++) {
        const u = a0 + k, [cx, cz] = nb(k), m = roomAt(rooms, cx, cz);
        if (m < 0) { const isEnt = side === 'b' && ent && ent.k === i && k >= ent.x0 && k < ent.x1; units.push({ ax, pos, u, kind: isEnt ? 'ent' : 'out', room: i, side, lo: -1, hi: -1 }); }
        else if (side === 'l' || side === 't') {   // 部屋どうしの壁は、大きい側(hi)の部屋の l / t から1回だけ出す
          const e = ed.get(pairKey(i, m)); if (!e || op.has(pairKey(i, m))) continue;
          units.push({ ax, pos, u, kind: u >= e.d0 && u < e.d1 ? 'door' : 'wall', room: -1, side: '', lo: m, hi: i });
        }
      }
    });
  });
  units.sort((p, q) => (p.ax < q.ax ? -1 : p.ax > q.ax ? 1 : 0) || p.pos - q.pos || p.kind.localeCompare(q.kind) || p.room - q.room || p.lo - q.lo || p.hi - q.hi || p.side.localeCompare(q.side) || p.u - q.u);
  const segs = [];
  units.forEach(p => {
    const s = segs[segs.length - 1];
    if (s && s.ax === p.ax && s.pos === p.pos && s.kind === p.kind && s.room === p.room && s.side === p.side && s.lo === p.lo && s.hi === p.hi && s.a1 === p.u) s.a1 = p.u + 1;
    else segs.push({ ax: p.ax, pos: p.pos, a0: p.u, a1: p.u + 1, kind: p.kind, lo: p.lo, hi: p.hi, room: p.room, side: p.side });
  });
  return segs;
}
// 部屋 i の壁かけが掛けられない範囲（入口・壁なしの所）：{ L: [[a0,a1]...], R: [...] } を部屋の中の座標で
export function wallGaps(rooms, open, i) {
  const r = rooms[i], op = new Set(open || []), g = { L: [], R: [] };
  edgesOf(rooms).forEach(e => {
    if (e.hi !== i) return;   // 壁かけがつくのは x=0 側(L)・z=0 側(R)＝大きい側の部屋
    const gap = op.has(pairKey(e.i, e.j)) ? [e.a0, e.a1] : [e.d0, e.d1];
    if (e.ax === 'z') g.L.push([gap[0] - r.z, gap[1] - r.z]); else g.R.push([gap[0] - r.x, gap[1] - r.x]);
  });
  return g;
}
// 壁かけ（部屋 i の L / R 側、pos〜pos+w）が、ぜんぶ外壁に面しているか（腰の壁になる所では隠すため）
export function wallAllOuter(rooms, i, wall, pos, w) {
  const r = rooms[i];
  for (let u = Math.floor(pos + 1e-6); u < pos + w - 1e-6; u++) { const m = wall === 'L' ? roomAt(rooms, r.x - 1, r.z + u) : roomAt(rooms, r.x + u, r.z - 1); if (m >= 0) return false; }
  return true;
}
export const LAYOUT_ERR = { rooms: '部屋の数が多すぎます', size: '部屋の広さは 3〜16 マスです', span: '家が大きすぎます（24×24マスまで）', overlap: '部屋が重なっています', conn: '部屋は辺でつなげてください', open: 'ひとつづきにできない組があります', name: '部屋の名前を入力してください' };
export function layoutCheck(rooms, open) {
  if (!Array.isArray(rooms) || !rooms.length || rooms.length > CFG.MAX_ROOMS) return 'rooms';
  for (const r of rooms) {
    if (!r || ![r.x, r.z, r.w, r.d].every(ri)) return 'size';
    if (r.w < CFG.MIN_RW || r.d < CFG.MIN_RW || r.w > CFG.MAX_RW || r.d > CFG.MAX_RW || Math.abs(r.x) > 99 || Math.abs(r.z) > 99) return 'size';
  }
  const b = houseBox(rooms); if (b.w > CFG.MAX_SPAN || b.d > CFG.MAX_SPAN) return 'span';
  for (let i = 0; i < rooms.length; i++) for (let j = i + 1; j < rooms.length; j++) { const a = rooms[i], c = rooms[j]; if (a.x < c.x + c.w && c.x < a.x + a.w && a.z < c.z + c.d && c.z < a.z + a.d) return 'overlap'; }
  const ed = edgesOf(rooms), seen = new Set([0]), q = [0];
  while (q.length) { const v = q.shift(); ed.forEach(e => { const o = e.i === v ? e.j : e.j === v ? e.i : -1; if (o >= 0 && !seen.has(o)) { seen.add(o); q.push(o); } }); }
  if (seen.size !== rooms.length) return 'conn';
  if (open != null) {
    if (!Array.isArray(open)) return 'open';
    const keys = new Set(ed.map(e => pairKey(e.i, e.j))), dup = new Set();
    for (const k of open) { if (typeof k !== 'string' || !/^\d+-\d+$/.test(k) || !keys.has(k) || dup.has(k)) return 'open'; dup.add(k); }
  }
  return '';
}
// 部屋 rm の中に、家具が全部収まっているか（回転を考える）
export function itemsFit(rm, items) {
  for (const i of (items || rm.items || [])) {
    const d = ITEM[i.id]; if (!d) continue;
    if (d.wall) { if (i.pos < -.001 || i.pos + d.w > (i.wall === 'L' ? rm.d : rm.w) + .001) return false; }
    else { const w = (i.rot || 0) % 2 ? d.d : d.w, dd = (i.rot || 0) % 2 ? d.w : d.d; if (i.x < 0 || i.y < 0 || i.x + w > rm.w || i.y + dd > rm.d) return false; }
  }
  return true;
}
// 間取りを変える費用（貯金箱から）：増えるマス数ぶん。1マスの値段 = 80 × (確定後の家の面積/36)^1.5 × 物価倍率 × 人数/5。合計は100単位。
// 新しい部屋ごとに ROOM_COST の追加料。せばめても返金なし。 next[i].k = もとの部屋の番号（なければ新しい部屋）
export function layoutCost(prev, next, n, mul) {
  let cells = 0, area = 0, fees = 0, fresh = 0;
  next.forEach(r => {
    const a = r.w * r.d; area += a; const o = r.k != null && prev[r.k];
    if (o) cells += Math.max(0, a - o.w * o.d); else { cells += a; fees += roomCost(prev.length + fresh, n, mul); fresh++; }
  });
  const unit = CFG.CELL_COST * Math.pow(area / 36, 1.5) * mul * Math.max(1, n) / CFG.COST_BASE_N;
  return (cells > 0 ? r100(cells * unit) : 0) + fees;
}
// 古い形（sizeLv だけ）→ 新しい形。n = roomSize(size0, sizeLv) の正方形で、部屋0を (0,0)、以降を右（+x）に順に並べる
export function migrateRooms(rooms, size0) {
  let ox = 0;
  return (Array.isArray(rooms) ? rooms : []).map(r => {
    if (ri(r.w) && ri(r.d) && ri(r.x) && ri(r.z)) return r;
    const n = roomSize(size0 || CFG.MIN_SIZE, Math.max(0, r.sizeLv | 0)), o = Object.assign({}, r, { x: ox, z: 0, w: n, d: n }); delete o.sizeLv; ox += n; return o;
  });
}

// 間取りの下書き draft = [{ k, name, x, z, w, d }]（k = もとの部屋の番号、新しい部屋は null）を、もとの部屋 prev に重ねて確定形にする。
// 辺を動かした部屋の家具は、家の中の位置が変わらないよう部屋の中の座標をずらす（壁かけは L=奥行き方向 / R=横方向の位置をずらす）。家全体は左上が (0,0) になるよう平行移動
export function applyLayout(prev, draft) {
  const bx = Math.min(...draft.map(r => r.x)), bz = Math.min(...draft.map(r => r.z));
  return draft.map(dr => {
    const o = dr.k != null ? prev[dr.k] : null, x = dr.x - bx, z = dr.z - bz;
    if (!o) return { name: dr.name, x, z, w: dr.w, d: dr.d, wall: 'wp_cream', floor: 'fl_wood', items: [], av: { x: 1, y: Math.min(3, dr.d - 1) }, k: null };
    const dx = o.x - dr.x, dz = o.z - dr.z;
    const items = (o.items || []).map(i => i.wall ? Object.assign({}, i, { pos: Math.round((i.pos + (i.wall === 'L' ? dz : dx)) * 100) / 100 }) : Object.assign({}, i, { x: i.x + dx, y: i.y + dz }));
    const av = o.av ? { x: Math.max(0, Math.min(dr.w - 1, o.av.x + dx)), y: Math.max(0, Math.min(dr.d - 1, o.av.y + dz)) } : undefined;
    const r = Object.assign({}, o, { name: dr.name, x, z, w: dr.w, d: dr.d, items, k: dr.k }); if (av) r.av = av; return r;
  });
}
export const FIT_ERR = { fit: 'はみ出してしまう家具があります', destroy: '家具のある部屋はこわせません', first: '最初の部屋はこわせません' };
// 下書きの検査。返り値 { err, msg, rooms(確定形), open(整えたもの), bad(問題の部屋の番号) }。err は '' なら OK
export function checkLayout(prev, draft, open) {
  const res = { err: '', msg: '', rooms: [], open: [], bad: -1 };
  const fail = (err, bad, msg) => { res.err = err; res.bad = bad == null ? -1 : bad; res.msg = msg || LAYOUT_ERR[err] || FIT_ERR[err] || err; return res; };
  if (!draft.length || draft[0].k !== 0) return fail('first');
  const used = new Set(draft.map(r => r.k).filter(k => k != null));
  for (let k = 0; k < prev.length; k++) if (!used.has(k) && (prev[k].items || []).length) return fail('destroy', null, '「' + prev[k].name + '」には家具があるので、こわせません');
  for (let i = 1; i < draft.length; i++) if (draft[i].k != null && draft[i - 1].k != null && draft[i].k < draft[i - 1].k) return fail('first');
  for (let i = 0; i < draft.length; i++) if (!String(draft[i].name || '').trim()) return fail('name', i);
  const rooms = applyLayout(prev, draft), ed = new Set(edgesOf(rooms).map(e => pairKey(e.i, e.j))), op = (open || []).filter(k => ed.has(k));
  const lc = layoutCheck(rooms, op); if (lc) return fail(lc, lc === 'overlap' || lc === 'size' ? firstBad(rooms, lc) : -1);
  for (let i = 0; i < rooms.length; i++) if (!itemsFit(rooms[i])) return fail('fit', i, '「' + rooms[i].name + '」は、家具がはみ出してしまいます');
  res.rooms = rooms; res.open = op; return res;
}
function firstBad(rooms, kind) {
  for (let i = 0; i < rooms.length; i++) {
    const a = rooms[i]; if (kind === 'size' && (a.w < CFG.MIN_RW || a.d < CFG.MIN_RW || a.w > CFG.MAX_RW || a.d > CFG.MAX_RW)) return i;
    if (kind === 'overlap') for (let j = i + 1; j < rooms.length; j++) { const c = rooms[j]; if (a.x < c.x + c.w && c.x < a.x + a.w && a.z < c.z + c.d && c.z < a.z + a.d) return i; }
  }
  return -1;
}

export const CATS = [
  { id: 'furniture', name: '家具' },
  { id: 'appliance', name: '家電' },
  { id: 'goods', name: '雑貨' },
  { id: 'wall', name: '壁かけ' },
  { id: 'rug', name: 'ラグ' },
  { id: 'wallpaper', name: '壁紙' },
  { id: 'floor', name: '床' }
];

// I(id,名前,カテゴリ,価格,w,d,h,色,色2,追加)
function I(id, name, cat, price, w, d, h, color, color2, o) {
  return Object.assign({ id, name, cat, price, w, d, h, color, color2: color2 || color, rank: 0 }, o || {});
}

export const ITEMS = [
  // --- 家具 ---
  I('bed1', 'シングルベッド', 'furniture', 1800, 1, 2, 0.75, '#f4a79d', '#fff3e0', { shape: 'bed' }),
  I('bed2', 'ふかふかベッド', 'furniture', 4200, 2, 2, 0.8, '#8fd3c0', '#ffffff', { shape: 'bed', rank: 1 }),
  I('sofa1', 'ソファ', 'furniture', 2400, 2, 1, 0.9, '#7fb8d8', '#a6d2e8', { shape: 'sofa' }),
  I('sofa2', 'ゆったり大ソファ', 'furniture', 5200, 3, 1, 0.95, '#f08a7e', '#f7aaa0', { shape: 'sofa', rank: 2 }),
  I('chair', 'チェア', 'furniture', 500, 1, 1, 0.95, '#e8b86d', '#b98a5a', { shape: 'spindle' }),
  I('desk', '勉強机', 'furniture', 1500, 2, 1, 1.0, '#d9a96b', '#b98650', { shape: 'desk', surface: true }),
  I('desk2', '重役デスク', 'furniture', 6500, 3, 1, 1.05, '#8a5632', '#6b3f22', { shape: 'desk', surface: true, rank: 3 }),
  I('shelf1', '本棚', 'furniture', 1200, 1, 1, 2.2, '#c08f5e', '#c08f5e', { surface: true, sh: 2.26, shape: 'shelf' }),
  I('shelf2', '大きな本棚', 'furniture', 2200, 2, 1, 2.2, '#b07c4e', '#b07c4e', { surface: true, sh: 2.26, shape: 'shelf', rank: 1 }),
  I('tansu', 'タンス', 'furniture', 900, 1, 1, 1.2, '#dcae72', '#dcae72', { surface: true, sh: 1.2, shape: 'drawers' }),
  I('kotatsu', 'こたつ', 'furniture', 2800, 2, 2, 0.75, '#e57373', '#c9a06b', { shape: 'kotatsu', surface: true, rank: 1 }),
  I('lowtable', 'ローテーブル', 'furniture', 700, 2, 1, 0.55, '#d8b48a', '#b98f60', { shape: 'table', surface: true }),
  I('board', 'ホワイトボード', 'furniture', 1600, 2, 1, 1.9, '#9aa7b0', '#9aa7b0', { shape: 'board' }),
  I('piano', 'アップライトピアノ', 'furniture', 9000, 2, 1, 1.5, '#2f2f3a', '#ffffff', { surface: true, sh: 1.43, shape: 'piano', rank: 3 }),
  // --- 家電 ---
  I('tv', 'テレビ', 'appliance', 2000, 2, 1, 1.3, '#3b3b45', '#555', { shape: 'tv' }),
  I('fridge', '冷蔵庫', 'appliance', 2800, 1, 1, 2.0, '#dff0f5', '#aab8bf', { surface: true, sh: 2, shape: 'fridge' }),
  I('fan', 'せんぷうき', 'appliance', 900, 1, 1, 1.5, '#9fd6e8', '#e8f6fb', { shape: 'fan' }),
  I('laptop', 'ノートPC', 'appliance', 2200, 1, 1, 0.5, '#cfd8dc', '#455a64', { shape: 'laptop', small: true }),
  I('lamp', 'デスクライト', 'appliance', 600, 1, 1, 0.9, '#f2c14e', '#fff3b0', { shape: 'lamp', small: true }),
  I('alarm', '目覚まし時計', 'appliance', 300, 1, 1, 0.5, '#f2877a', '#ffffff', { shape: 'alarm', small: true }),
  I('aircon', 'エアコン', 'appliance', 1500, 1.8, 0.2, 0.6, '#f4f4f4', '#cfd8dc', { wall: true, art: 'aircon', zb: 2.6 }),
  // --- 雑貨 ---
  I('booktower', '参考書タワー', 'goods', 400, 1, 1, 0.8, '#6aa6d6', '#ffffff', { shape: 'stack', small: true, n: 7, pal: ['#6aa6d6', '#f08a7e', '#8fd3c0', '#f2c14e', '#b39ddb', '#6aa6d6', '#ef9a9a'] }),
  I('pastexam', '過去問の山', 'goods', 300, 1, 1, 0.8, '#fffaf0', '#f2877a', { shape: 'stack', small: true, n: 8, pal: ['#fffaf0', '#f3ecd9', '#fffaf0', '#f3ecd9', '#fffaf0', '#f3ecd9', '#fffaf0', '#f2877a'] }),
  I('globe', '地球儀', 'goods', 800, 1, 1, 0.8, '#5fa8d8', '#7bc47f', { shape: 'globe', small: true }),
  I('daruma', '合格祈願だるま', 'goods', 500, 1, 1, 0.7, '#e53935', '#fff', { shape: 'daruma', small: true }),
  I('trophy', 'トロフィー', 'goods', 700, 1, 1, 0.8, '#f5c542', '#5d4037', { shape: 'trophy', small: true, rank: 1 }),
  I('cards', '単語カードの束', 'goods', 100, 1, 1, 0.3, '#fff6a8', '#f2877a', { shape: 'cards', small: true }),
  I('plantS', '観葉植物(小)', 'goods', 300, 1, 1, 0.8, '#5fb760', '#d9895a', { shape: 'plant', small: true }),
  I('plantL', '観葉植物(大)', 'goods', 900, 1, 1, 2.2, '#4da855', '#c97c50', { shape: 'plant' }),
  I('cushion', 'クッション', 'goods', 150, 1, 1, 0.3, '#f7a8b8', '#fff', { shape: 'cushion', small: true }),
  I('bowl', '金魚鉢', 'goods', 600, 1, 1, 0.6, '#b6e3f4', '#ff9a4d', { shape: 'bowl', small: true }),
  I('guitar', 'ギター', 'goods', 3200, 1, 1, 1.6, '#c0732f', '#6d4c41', { shape: 'guitar', rank: 1 }),
  I('plush', 'くまのぬいぐるみ', 'goods', 250, 1, 1, 0.6, '#c58b5c', '#f3d7b5', { shape: 'plush', small: true }),
  // --- 壁かけ ---
  I('poster', '合格ポスター', 'wall', 300, 1, 0.1, 1.4, '#f2877a', '#fff3e0', { art: 'poster', zb: 1.4 }),
  I('toshinposter', '東進ハイスクール藤沢校ポスター', 'wall', 500, 1, 0.1, 1.4, '#0b8a3e', '#ffffff', { art: 'toshin', zb: 1.4 }),
  I('map', '世界地図', 'wall', 600, 2, 0.1, 1.2, '#7ec4e8', '#7bc47f', { art: 'map', zb: 1.3 }),
  I('window', '窓', 'wall', 800, 1.5, 0.1, 1.5, '#bfe6f7', '#ffffff', { art: 'window', zb: 1.1 }),
  I('window2', '大きな窓', 'wall', 1800, 2.5, 0.1, 1.7, '#bfe6f7', '#d9a96b', { art: 'window', zb: 1.0, rank: 1 }),
  I('wclock', '壁時計', 'wall', 500, 0.8, 0.1, 0.8, '#ffffff', '#c08f5e', { art: 'wclock', zb: 2.2 }),
  I('wshelf', '壁棚', 'wall', 700, 1.6, 0.1, 0.7, '#c08f5e', '#5fb760', { art: 'wshelf', zb: 1.8 }),
  I('calendar', 'カレンダー', 'wall', 200, 0.8, 0.1, 1.0, '#ffffff', '#e57373', { art: 'calendar', zb: 1.6 }),
  I('painting', '風景画', 'wall', 900, 1.2, 0.1, 1.0, '#a5d6a7', '#8d6e63', { art: 'painting', zb: 1.6 }),
  // --- 3D版で追加 ---
  I('vase', '花びん', 'goods', 450, 1, 1, 1.0, '#d9c8a0', '#ffffff', { shape: 'vase', small: true }),
  I('teaset', 'ティーセット', 'goods', 600, 1, 1, 0.3, '#f6f1e6', '#4f7aa8', { shape: 'teaset', small: true, rank: 1 }),
  I('pie', '焼きたてパイ', 'goods', 350, 1, 1, 0.2, '#d8963c', '#a82a3a', { shape: 'pie', small: true }),
  I('photo', '写真立て', 'goods', 250, 1, 1, 0.5, '#c9a24a', '#ffffff', { shape: 'photo', small: true }),
  I('bookpile', '本の山', 'goods', 200, 1, 1, 0.4, '#6b2f2f', '#d8c8a8', { shape: 'bookpile', small: true }),
  I('floorlamp', 'フロアライト', 'appliance', 1100, 1, 1, 1.6, '#f3e2bd', '#c9a24a', { shape: 'floorlamp', rank: 1 }),
  I('pendant', 'ペンダントライト', 'appliance', 1800, 1, 1, 3.4, '#d9a53c', '#fff0c0', { shape: 'pendant', ceil: true, rank: 1 }),
  I('globelight', 'ガラス玉のシャンデリア', 'appliance', 3600, 2, 1, 3.4, '#c9a24a', '#fff6dc', { shape: 'globelight', ceil: true, rank: 2 }),
  I('record', 'レコードプレーヤー', 'appliance', 2600, 1, 1, 0.45, '#7a4a2a', '#16120f', { shape: 'record', small: true, rank: 2 }),
  I('tvboard', 'テレビ台セット', 'furniture', 3200, 2, 1, 1.4, '#b98650', '#7a4a2a', { shape: 'tvboard', rank: 1 }),
  I('cabinet', '食器だな', 'furniture', 4800, 2, 1, 2.3, '#a9774d', '#7a4a2a', { surface: true, sh: 2.3, shape: 'cabinet', rank: 2 }),
  I('fireplace', '暖炉', 'furniture', 12000, 3, 1, 3.0, '#a8503a', '#6a625a', { shape: 'fireplace', rank: 4 }),
  I('frame', '額ぶち(静物画)', 'wall', 500, 1, 0.1, 1.3, '#d0a640', '#ffffff', { art: 'frame', art2: 'still', zb: 1.5 }),
  I('frame2', '額ぶち(肖像画)', 'wall', 700, 1, 0.1, 1.3, '#d0a640', '#ffffff', { art: 'frame', art2: 'portrait', zb: 1.5, rank: 1 }),
  I('garland', 'ガーランド', 'wall', 400, 2, 0.1, 0.6, '#d9534f', '#f0c040', { art: 'garland', zb: 2.6 }),
  I('sconce', 'かべ灯り', 'wall', 800, 0.4, 0.1, 0.5, '#c9a24a', '#fff3d0', { art: 'sconce', zb: 1.8, rank: 1 }),
  // --- 第4弾：ナチュラルな暮らし（キッチン・食卓・リビング）---
  I('fridge2', '両開き冷蔵庫', 'appliance', 4800, 2, 1, 2.1, '#e9e4d8', '#aab8bf', { surface: true, sh: 2.1, shape: 'fridge2', rank: 2 }),
  I('gasrange', 'ガスコンロ付きキッチン台', 'furniture', 3600, 2, 1, 1.0, '#c9985c', '#e8e0cc', { surface: true, sh: 1.0, shape: 'gasrange', rank: 1 }),
  I('sinkunit', 'シンク台', 'furniture', 3400, 2, 1, 1.0, '#c9985c', '#d8e4d4', { surface: true, sh: 1.0, shape: 'sinkunit', rank: 1 }),
  I('wagon', 'キッチンワゴン', 'furniture', 1500, 1, 1, 0.9, '#d9b886', '#a9774d', { surface: true, sh: 0.9, shape: 'wagon' }),
  I('birchtable', '白樺の丸太脚テーブル', 'furniture', 2600, 2, 1, 0.75, '#e8d0a8', '#efece4', { surface: true, shape: 'birchtable', rank: 1 }),
  I('ladderchair', 'はしご背のウッドチェア', 'furniture', 800, 1, 1, 1.0, '#c9985c', '#e8dcc6', { shape: 'ladderchair' }),
  I('rattanchair', 'ラタンチェア', 'furniture', 1600, 1, 1, 1.0, '#cfa968', '#f0e6d0', { shape: 'rattanchair', rank: 1 }),
  I('linensofa', 'リネンのソファ', 'furniture', 3800, 2, 1, 0.9, '#d8cdb8', '#e8dfcc', { shape: 'linensofa', rank: 2 }),
  I('sidetable', 'サイドテーブル', 'furniture', 650, 1, 1, 0.55, '#d8b48a', '#a9774d', { surface: true, shape: 'sidetable' }),
  I('ladderrack', '木のはしご棚', 'furniture', 1800, 1, 1, 1.8, '#d9b886', '#c08f5e', { surface: true, sh: 1.45, shape: 'ladderrack', rank: 1 }),
  I('fullmirror', '姿見', 'furniture', 1600, 1, 1, 1.6, '#d9b886', '#d9b886', { shape: 'fullmirror', rank: 1 }),
  I('coatstand', 'コートハンガー', 'furniture', 1200, 1, 1, 1.75, '#b98650', '#7fa6a0', { shape: 'coatstand' }),
  I('woodstove', '薪ストーブ', 'furniture', 5400, 1, 1, 1.1, '#2f2b28', '#ff9a3c', { surface: true, sh: 1.1, shape: 'woodstove', rank: 3 }),
  I('retrofan', 'レトロ扇風機', 'appliance', 1400, 1, 1, 1.0, '#9ad1c0', '#d8dcde', { shape: 'retrofan' }),
  I('toaster', 'トースター', 'appliance', 900, 1, 1, 0.3, '#c9ced1', '#2a2826', { shape: 'toaster', small: true }),
  I('radio', 'ラジオ', 'appliance', 1100, 1, 1, 0.4, '#b98650', '#2a2826', { shape: 'radio', small: true, rank: 1 }),
  I('diffuser', 'アロマディフューザー', 'appliance', 700, 1, 1, 0.5, '#f3efe6', '#b98650', { shape: 'diffuser', small: true }),
  I('tinbin', 'ブリキのゴミ箱', 'goods', 450, 1, 1, 0.7, '#aeb6ba', '#aeb6ba', { shape: 'tinbin' }),
  I('broom', 'ほうき', 'goods', 350, 1, 1, 1.4, '#d9b870', '#a9774d', { shape: 'broom' }),
  I('storagebasket', '収納かご', 'goods', 600, 1, 1, 0.6, '#d9b886', '#b08a5a', { shape: 'storagebasket' }),
  I('macrame', 'マクラメのつるし植物', 'goods', 700, 1, 1, 3.4, '#f3ecdc', '#f3efe6', { shape: 'macrame', ceil: true, rank: 1 }),
  I('dishrack', '食器の水切りかご', 'goods', 450, 1, 1, 0.3, '#c9ced1', '#fffdf4', { shape: 'dishrack', small: true }),
  I('pitcher', 'ピッチャー', 'goods', 300, 1, 1, 0.3, '#f2efe6', '#7fa6c8', { shape: 'pitcher', small: true }),
  I('kscale', 'キッチンスケール', 'goods', 350, 1, 1, 0.15, '#f2efe6', '#c9ced1', { shape: 'kscale', small: true }),
  I('coffeemill', 'コーヒーミル', 'goods', 500, 1, 1, 0.5, '#a9774d', '#b8a070', { shape: 'coffeemill', small: true }),
  I('chocake', 'チョコレートケーキ', 'goods', 380, 1, 1, 0.3, '#5a3a28', '#3a2418', { shape: 'chocake', small: true }),
  I('bread', 'パンのバスケット', 'goods', 250, 1, 1, 0.3, '#d99a52', '#c9a27a', { shape: 'bread', small: true }),
  I('teapot', 'ティーポット', 'goods', 550, 1, 1, 0.3, '#f6f1e6', '#4f7aa8', { shape: 'teapot', small: true }),
  I('kettle', 'やかん', 'goods', 600, 1, 1, 0.3, '#d8d4c8', '#3a3632', { shape: 'kettle', small: true }),
  I('pot', 'ほうろうの鍋', 'goods', 500, 1, 1, 0.25, '#c8553d', '#2a2826', { shape: 'pot', small: true }),
  I('donabe', '土鍋', 'goods', 650, 1, 1, 0.3, '#d9cdb8', '#6a4a30', { shape: 'donabe', small: true }),
  I('cuttingboard', 'まな板', 'goods', 200, 1, 1, 0.1, '#d9b886', '#d9b886', { shape: 'cuttingboard', small: true }),
  I('spicerack', 'スパイスラック', 'goods', 600, 1, 1, 0.5, '#c9985c', '#3a3632', { shape: 'spicerack', small: true }),
  I('slippers', 'スリッパ', 'goods', 200, 1, 1, 0.12, '#e8b8b0', '#e8dcc6', { shape: 'slippers', small: true }),
  I('candleglass', 'キャンドルグラス', 'goods', 450, 1, 1, 0.3, '#e8f4ff', '#f3ecdc', { shape: 'candleglass', small: true }),
  I('lantern', 'ガラスのランタン', 'goods', 650, 1, 1, 0.4, '#2f2c2a', '#fff0d0', { shape: 'lantern', small: true, rank: 1 }),
  I('anthurium', 'アンスリウムの鉢', 'goods', 500, 1, 1, 0.6, '#d8344a', '#f3efe6', { shape: 'anthurium', small: true }),
  I('mossball', '苔玉', 'goods', 350, 1, 1, 0.3, '#5a8a3a', '#e8dcc6', { shape: 'mossball', small: true }),
  I('dryvase', 'ドライフラワーの花びん', 'goods', 550, 1, 1, 0.8, '#e8dcc6', '#b8a070', { shape: 'dryvase', small: true }),
  I('bookend', '本立てと本', 'goods', 300, 1, 1, 0.3, '#d9b886', '#4a4642', { shape: 'bookend', small: true }),
  I('blanket', 'ブランケット', 'goods', 400, 1, 1, 0.2, '#c9a27a', '#f0e6d0', { shape: 'blanket', small: true }),
  I('bookstand', '参考書スタンド', 'goods', 300, 1, 1, 0.3, '#d9b886', '#d9b886', { shape: 'bookstand', small: true }),
  I('deskmat', 'デスクマット', 'goods', 400, 1, 1, 0.05, '#7a8a78', '#e8dcc6', { shape: 'deskmat', small: true }),
  I('timer', '学習タイマー', 'goods', 350, 1, 1, 0.3, '#f2877a', '#ffffff', { shape: 'timer', small: true }),
  I('wallcab', '吊り戸棚', 'wall', 1500, 2, 0.1, 0.9, '#c9985c', '#e8e0cc', { art: 'wallcab', zb: 2.2 }),
  I('hathook', '麦わら帽子とフック', 'wall', 600, 0.8, 0.1, 0.5, '#c9a27a', '#d9534f', { art: 'hathook', zb: 1.9 }),
  I('towelbar', 'タオル掛け', 'wall', 400, 0.9, 0.1, 0.8, '#fffaf0', '#7fa6c8', { art: 'towelbar', zb: 1.4 }),
  I('wreath', 'ユーカリのリース', 'wall', 500, 0.8, 0.1, 0.8, '#8fb07e', '#e8dcc6', { art: 'wreath', zb: 1.7 }),
  I('menuboard', 'きょうのごはん黒板', 'wall', 700, 1.0, 0.1, 1.2, '#c08f5e', '#8a5632', { art: 'menuboard', zb: 1.5 }),
  // --- 第4弾：壁紙・床 ---
  I('wp_paintboard', '白ぬりの板張り', 'wallpaper', 1500, 0, 0, 0, '#f5eddc', '#cfc3ae', { pat: 'boardW' }),
  I('fl_herrorange', 'オレンジ無垢のヘリンボーン', 'floor', 2600, 0, 0, 0, '#dea468', '#9a5f32', { pat: 'herring', rank: 1 }),
  // --- 壁紙・床の追加 ---
  I('wp_plaster', 'しっくい', 'wallpaper', 700, 0, 0, 0, '#efe6d6', '#d9cdb8', { pat: 'plaster' }),
  I('wp_brickw', '白レンガ', 'wallpaper', 1700, 0, 0, 0, '#ece8e0', '#bdb6a8', { pat: 'brickWhite', rank: 1 }),
  I('wp_wainscot', '腰壁', 'wallpaper', 2200, 0, 0, 0, '#e8dcc4', '#6a4326', { pat: 'wainscot', rank: 2 }),
  I('fl_herring', 'ヘリンボーン', 'floor', 2400, 0, 0, 0, '#c8935e', '#8a5c38', { pat: 'herring', rank: 2 }),
  // --- 第2弾：新家具 ---
  I('bunk', '二段ベッド', 'furniture', 5800, 1, 2, 1.9, '#8fb8e8', '#fff3e0', { shape: 'bunk', rank: 2 }),
  I('loft', 'ロフトベッド', 'furniture', 7800, 2, 2, 2.0, '#d9a96b', '#8a5632', { shape: 'loft', rank: 3 }),
  I('armchair', 'ひとりがけソファ', 'furniture', 2200, 1, 1, 0.95, '#f2a8b8', '#f7c6d0', { shape: 'armchair' }),
  I('beanbag', 'ビーズクッション', 'furniture', 1300, 1, 1, 0.8, '#9ad1c0', '#fff', { shape: 'beanbag' }),
  I('dtable', 'ダイニングテーブル', 'furniture', 3000, 2, 1, 0.9, '#c9985c', '#7a4a2a', { shape: 'table', surface: true, rank: 1 }),
  I('dchair', 'ダイニングチェア', 'furniture', 700, 1, 1, 1.0, '#f2c14e', '#8a5632', { shape: 'dchair' }),
  I('rtable', '丸テーブル', 'furniture', 1400, 1, 1, 0.75, '#e8c89a', '#a9774d', { shape: 'rtable', surface: true }),
  I('counter', 'キッチンカウンター', 'furniture', 4400, 2, 1, 1.0, '#e8dcc4', '#8fd3c0', { surface: true, sh: 1, shape: 'counter', rank: 2 }),
  I('rack', '洋服ラック', 'furniture', 1100, 2, 1, 1.55, '#3a3a42', '#c9a06b', { shape: 'rack' }),
  I('dresser', 'ドレッサー', 'furniture', 3400, 1, 1, 1.3, '#fff3e8', '#d9a0a8', { surface: true, sh: 0.87, shape: 'dresser', rank: 1 }),
  I('bench', 'ベンチ', 'furniture', 900, 2, 1, 0.55, '#d9a96b', '#8fb8e8', { surface: true, sh: 0.57, shape: 'bench' }),
  I('stool', 'スツール', 'furniture', 350, 1, 1, 0.55, '#e8b86d', '#f2877a', { shape: 'stool' }),
  I('cubeshelf', 'ボックス棚', 'furniture', 1000, 2, 1, 1.0, '#e8d4b0', '#fff', { surface: true, sh: 0.98, shape: 'cubeshelf', sh: 1.0 }),
  I('hammock', 'ハンモック', 'furniture', 3800, 1, 2, 1.1, '#f7c6a8', '#7a4a2a', { shape: 'hammock', rank: 2 }),
  I('chabudai', 'ちゃぶ台', 'furniture', 800, 1, 1, 0.36, '#c9985c', '#7a4a2a', { shape: 'chabudai', surface: true }),
  // --- 第2弾：家電 ---
  I('microwave', '電子レンジ', 'appliance', 1100, 1, 1, 0.4, '#f4f4f4', '#222a30', { shape: 'microwave', small: true }),
  I('ricecooker', '炊飯器', 'appliance', 900, 1, 1, 0.45, '#f4f4f4', '#7fb8d8', { shape: 'ricecooker', small: true }),
  I('console', 'ゲーム機とモニター', 'appliance', 3300, 2, 1, 0.75, '#26262e', '#fff', { shape: 'console', small: true, rank: 2 }),
  I('speaker', 'スピーカー', 'appliance', 1500, 1, 1, 0.95, '#9a6a40', '#e8dcc4', { shape: 'speaker', rank: 1 }),
  I('humid', '加湿器', 'appliance', 800, 1, 1, 0.55, '#fffaf0', '#9ad1e8', { shape: 'humid', small: true }),
  I('heater', '電気ストーブ', 'appliance', 1300, 1, 1, 0.7, '#e8d8c8', '#8a8a90', { shape: 'heater', rank: 1 }),
  I('washer', '洗濯機', 'appliance', 3000, 1, 1, 1.05, '#f4f6f8', '#7fb8d8', { surface: true, sh: 1.03, shape: 'washer', rank: 1 }),
  I('robovac', '掃除ロボット', 'appliance', 2000, 1, 1, 0.14, '#f3f0ea', '#6ab0f0', { shape: 'robovac', rank: 2 }),
  // --- 第2弾：雑貨 ---
  I('cactus', 'サボテンくん', 'goods', 350, 1, 1, 0.65, '#6fbf7a', '#e8b0a0', { shape: 'cactus', small: true }),
  I('flowerpot', '花の鉢', 'goods', 400, 1, 1, 0.5, '#f7a8b8', '#d9895a', { shape: 'flowerpot', small: true }),
  I('hourglass', '砂時計', 'goods', 450, 1, 1, 0.42, '#f2c14e', '#8a5632', { shape: 'hourglass', small: true }),
  I('calc', '電卓', 'goods', 250, 1, 1, 0.1, '#8fd3c0', '#fff', { shape: 'calc', small: true }),
  I('penstand', 'ペン立て', 'goods', 200, 1, 1, 0.4, '#f08a7e', '#fff', { shape: 'penstand', small: true }),
  I('mug', 'マグカップ', 'goods', 200, 1, 1, 0.16, '#ffffff', '#f2877a', { shape: 'mug', small: true }),
  I('birdcage', 'ことりの鳥かご', 'goods', 1500, 1, 1, 1.0, '#c9a24a', '#ffd84a', { shape: 'birdcage', small: true, rank: 1 }),
  I('aquarium', '水槽', 'goods', 4200, 2, 1, 1.15, '#e8d4b0', '#7a4a2a', { surface: true, sh: 1.22, shape: 'aquarium', rank: 3 }),
  I('boardgame', 'ボードゲーム', 'goods', 500, 1, 1, 0.1, '#e8645a', '#2a2a2a', { shape: 'boardgame', small: true }),
  I('catplush', 'ねこのぬいぐるみ', 'goods', 300, 1, 1, 0.5, '#f3e6d0', '#f0b080', { shape: 'catplush', small: true }),
  I('omamori', '合格お守り', 'goods', 400, 1, 1, 0.1, '#e8645a', '#e8c94a', { shape: 'omamori', small: true }),
  // --- 第2弾：壁かけ ---
  I('timetable', '時間割表', 'wall', 350, 1.3, 0.1, 1.0, '#fffdf4', '#c9985c', { art: 'timetable', zb: 1.6 }),
  I('cork', 'コルクボード', 'wall', 600, 1.5, 0.1, 1.1, '#c99a62', '#a9774d', { art: 'cork', zb: 1.5 }),
  I('mirror', 'おおきな鏡', 'wall', 1200, 0.9, 0.1, 1.7, '#e6f0f3', '#d9a96b', { art: 'mirror', zb: 0.9, rank: 1 }),
  I('hookshelf', 'フック付き棚', 'wall', 800, 1.6, 0.1, 0.7, '#d9a96b', '#8fd3c0', { art: 'hookshelf', zb: 1.7 }),
  I('neon', 'ネオン「GOAL」', 'wall', 2800, 2.2, 0.1, 0.9, '#ff6ab8', '#ff6ab8', { art: 'neon', zb: 2.0, rank: 2 }),
  I('catcher', 'ねがいごとリング', 'wall', 900, 1.0, 0.1, 1.5, '#d9a96b', '#ffe07a', { art: 'catcher', zb: 1.4, rank: 1 }),
  I('certificate', '賞状', 'wall', 700, 1.1, 0.1, 0.85, '#fffbea', '#d0a640', { art: 'certificate', zb: 1.8, rank: 1 }),
  // --- 第2弾：ラグ・壁紙・床 ---
  I('rug5', 'ミントのチェックラグ', 'rug', 1000, 2, 2, 0.02, '#9ad1c0', '#f3fbf8', { shape: 'rug', check: true }),
  I('rug6', 'おおきな丸ラグ', 'rug', 3200, 3, 3, 0.02, '#cde8f7', '#fff6d6', { shape: 'rug', round: true, rank: 2 }),
  I('rug7', 'ふんわりタテ長ラグ', 'rug', 1500, 2, 3, 0.02, '#f7c6a8', '#fff0e0', { shape: 'rug' }),
  I('wp_lavender', 'ラベンダー', 'wallpaper', 400, 0, 0, 0, '#e3d9f5', '#e3d9f5', { pat: 'plain' }),
  I('wp_gingham', 'ギンガム', 'wallpaper', 1200, 0, 0, 0, '#fff6e0', '#f7b8c0', { pat: 'gingham', rank: 1 }),
  I('wp_cloud', 'くもり空', 'wallpaper', 1600, 0, 0, 0, '#cfe8fa', '#ffffff', { pat: 'cloud', rank: 1 }),
  I('fl_birch', 'しろ木フローリング', 'floor', 700, 0, 0, 0, '#f0d8b0', '#d9b886', { pat: 'wood' }),
  I('fl_mintcheck', 'ミントのタイル', 'floor', 1300, 0, 0, 0, '#d4f0e4', '#fff8ea', { pat: 'checker' }),
  I('fl_grass', 'ふわふわ芝生', 'floor', 1500, 0, 0, 0, '#9fd47a', '#9fd47a', { pat: 'carpet', rank: 1 }),
  // --- ラグ ---
  I('rug1', '丸ラグ', 'rug', 600, 2, 2, 0.02, '#f7c6a8', '#fde6d2', { shape: 'rug', round: true }),
  I('rug2', '長方形ラグ', 'rug', 900, 3, 2, 0.02, '#9ad1c0', '#d6efe7', { shape: 'rug' }),
  I('rug3', 'チェックラグ', 'rug', 1200, 2, 2, 0.02, '#f2877a', '#fff1e6', { shape: 'rug', check: true }),
  I('rug4', 'ふわふわラグ', 'rug', 2400, 3, 3, 0.02, '#fff0f3', '#ffd6e0', { shape: 'rug', round: true, rank: 1 }),
  // --- 壁紙 ---
  I('wp_cream', 'クリーム', 'wallpaper', 0, 0, 0, 0, '#fbe9c8', '#fbe9c8', { pat: 'plain', free: true }),
  I('wp_mint', 'ミント', 'wallpaper', 400, 0, 0, 0, '#c9eee0', '#c9eee0', { pat: 'plain' }),
  I('wp_pink', 'さくら', 'wallpaper', 400, 0, 0, 0, '#fbd5dc', '#fbd5dc', { pat: 'plain' }),
  I('wp_sky', 'そらいろ', 'wallpaper', 400, 0, 0, 0, '#cde8f7', '#cde8f7', { pat: 'plain' }),
  I('wp_stripe', 'ミントストライプ', 'wallpaper', 900, 0, 0, 0, '#e6f6ef', '#bfe6d6', { pat: 'stripe' }),
  I('wp_brick', 'レンガ', 'wallpaper', 1500, 0, 0, 0, '#d98b6a', '#f2d9c4', { pat: 'brickRed' }),
  I('wp_dot', 'みずたま', 'wallpaper', 1100, 0, 0, 0, '#fff4d6', '#f2a8a0', { pat: 'dot', rank: 1 }),
  I('wp_board', '黒板グリーン', 'wallpaper', 1800, 0, 0, 0, '#3f6b57', '#6f9a86', { pat: 'plain', rank: 2 }),
  I('wp_star', '星空', 'wallpaper', 3000, 0, 0, 0, '#2b3a67', '#ffe9a8', { pat: 'star', rank: 3 }),
  // --- 床 ---
  I('fl_wood', 'フローリング', 'floor', 0, 0, 0, 0, '#e2b988', '#cf9f6c', { pat: 'wood', free: true }),
  I('fl_dark', '濃い木目', 'floor', 600, 0, 0, 0, '#a9774d', '#8a5c38', { pat: 'dark' }),
  I('fl_tatami', '畳', 'floor', 1400, 0, 0, 0, '#cfd9a0', '#7d8a4f', { pat: 'tatami' }),
  I('fl_check', 'チェック柄タイル', 'floor', 1200, 0, 0, 0, '#fff4e0', '#f2877a', { pat: 'checker' }),
  I('fl_carpet', 'ベージュカーペット', 'floor', 800, 0, 0, 0, '#e8d5b8', '#e8d5b8', { pat: 'carpet' }),
  I('fl_stone', '石畳', 'floor', 1600, 0, 0, 0, '#c9c3b8', '#a9a397', { pat: 'stone', rank: 2 }),
  I('fl_white', '白タイル', 'floor', 900, 0, 0, 0, '#f6f6f2', '#d9dedf', { pat: 'tile' }),
  // --- 第3弾：ナチュラル（落ち着いた壁・床、壁かけ、小物）---
  I('wp_boardw', '白い板張り', 'wallpaper', 1500, 0, 0, 0, '#efebe2', '#d6cfc0', { pat: 'boardV' }),
  I('wp_tilew', '白タイルの壁', 'wallpaper', 1400, 0, 0, 0, '#f5f3ee', '#d9d4ca', { pat: 'tileWall' }),
  I('wp_sage', 'セージグリーン', 'wallpaper', 600, 0, 0, 0, '#b8c8a2', '#b8c8a2', { pat: 'plain' }),
  I('wp_greige', 'グレージュ', 'wallpaper', 600, 0, 0, 0, '#dcd2c4', '#dcd2c4', { pat: 'plain' }),
  I('wp_creamwain', 'クリームの腰壁', 'wallpaper', 2000, 0, 0, 0, '#f1e7d3', '#fbf8f1', { pat: 'wainscot2' }),
  I('wp_sagewain', 'セージの腰壁', 'wallpaper', 2600, 0, 0, 0, '#b5c69f', '#f3eee3', { pat: 'wainscot2', rank: 1 }),
  I('fl_whitewash', '白っぽい古木', 'floor', 900, 0, 0, 0, '#e8decd', '#d2c4ad', { pat: 'wood' }),
  I('fl_greige', 'グレージュの床', 'floor', 900, 0, 0, 0, '#cbb9a2', '#ab9881', { pat: 'wood' }),
  I('fl_cobble', '石だたみタイル', 'floor', 1600, 0, 0, 0, '#d3ccbf', '#9d968a', { pat: 'cobble', rank: 1 }),
  I('fl_hex', '白い六角タイル', 'floor', 1800, 0, 0, 0, '#f4f2ec', '#cfc9be', { pat: 'hex', rank: 1 }),
  I('wp_beigestripe', 'ベージュのストライプ', 'wallpaper', 900, 0, 0, 0, '#f4ecdc', '#e3d3b4', { pat: 'stripe' }),
  I('wp_navy', 'ネイビー', 'wallpaper', 700, 0, 0, 0, '#46577e', '#46577e', { pat: 'plain' }),
  I('wp_pinkwain', 'さくらの腰壁', 'wallpaper', 2000, 0, 0, 0, '#f7d9d9', '#fffaf6', { pat: 'wainscot2' }),
  I('wp_darkboard', 'こげ茶の板張り', 'wallpaper', 1600, 0, 0, 0, '#8a6a4f', '#6b5038', { pat: 'boardV', rank: 1 }),
  I('wp_leaf', 'ボタニカル', 'wallpaper', 1800, 0, 0, 0, '#f5f2e8', '#93b07e', { pat: 'leaf', rank: 1 }),
  I('wp_brickgray', 'グレーのレンガ', 'wallpaper', 1900, 0, 0, 0, '#a9acb0', '#d7d8d9', { pat: 'brickGray', rank: 1 }),
  I('wp_gingblue', 'ブルーのギンガム', 'wallpaper', 1200, 0, 0, 0, '#f4f8fc', '#9cc0e0', { pat: 'gingham' }),
  I('fl_terracotta', 'テラコッタタイル', 'floor', 1500, 0, 0, 0, '#d98a62', '#efe3d2', { pat: 'tile', rank: 1 }),
  I('fl_hexgray', 'グレーの六角タイル', 'floor', 1800, 0, 0, 0, '#d3d6d8', '#9a9ea2', { pat: 'hex', rank: 1 }),
  I('fl_herrlight', 'あかるいヘリンボーン', 'floor', 2400, 0, 0, 0, '#e3c79c', '#b8956a', { pat: 'herring', rank: 2 }),
  I('fl_bluecheck', 'ブルーのチェック', 'floor', 1200, 0, 0, 0, '#dbe8f4', '#ffffff', { pat: 'checker' }),
  I('fl_walnut', 'ウォルナットの床', 'floor', 900, 0, 0, 0, '#7a5238', '#5e3e2a', { pat: 'dark' }),
  I('wplanter', '壁かけプランター', 'wall', 700, 0.9, 0.1, 0.9, '#e9dcc6', '#5fa860', { art: 'wplanter', zb: 1.9 }),
  I('dryflower', 'ドライフラワー', 'wall', 600, 0.5, 0.1, 0.9, '#e8d2b0', '#9a8a5a', { art: 'dryflower', zb: 1.6 }),
  I('bracket', 'ブラケットライト', 'wall', 1400, 0.7, 0.1, 0.6, '#f3efe6', '#3a3632', { art: 'bracket', zb: 2.0, rank: 1 }),
  I('switch', 'スイッチ', 'wall', 100, 0.36, 0.1, 0.26, '#f6f2ea', '#ffffff', { art: 'switch', zb: 1.2 }),
  I('cafewin', 'カフェカーテンの窓', 'wall', 1600, 1.1, 0.1, 1.25, '#bfe6f7', '#b07c4e', { art: 'cafewin', zb: 1.1 }),
  I('hookrack', 'ほうきとフック', 'wall', 800, 1.0, 0.1, 1.3, '#d9b886', '#9a8a70', { art: 'hookrack', zb: 0.9 }),
  I('spotrail', 'スポットライト', 'wall', 2400, 1.8, 0.1, 0.45, '#f3efe6', '#2f2c2a', { art: 'spotrail', zb: 2.85, rank: 2 }),
  I('candle', 'キャンドル', 'goods', 400, 1, 1, 0.35, '#f6efe0', '#c9a27a', { shape: 'candle', small: true }),
  I('jar', 'ガラスの保存びん', 'goods', 350, 1, 1, 0.45, '#dff3ff', '#c9a27a', { shape: 'jar', small: true }),
  I('basket', 'かご', 'goods', 450, 1, 1, 0.42, '#d9b886', '#b08a5a', { shape: 'basket', small: true }),
  I('bottles', 'ガラスボトル', 'goods', 500, 1, 1, 0.5, '#cfe3d8', '#e6ddc8', { shape: 'bottles', small: true }),
  // --- 非売品（ltd）：ショップに出ない・売れない。担任助手が発行するQRコードを読むと手に入る（ミッションの報酬にもできる） ---
  I('ltd_trophy', '金のトロフィー', 'goods', 0, 1, 1, 0.8, '#ffcf3a', '#7a4a10', { shape: 'ltdtrophy', small: true, free: true, ltd: true }),
  I('ltd_daruma', '金の合格だるま', 'goods', 0, 1, 1, 0.7, '#f0be3a', '#fff8e0', { shape: 'ltddaruma', small: true, free: true, ltd: true }),
  I('ltd_omamori', '虹色のお守り', 'goods', 0, 1, 1, 0.1, '#9b7fe0', '#ffe07a', { shape: 'omamori', small: true, free: true, ltd: true }),
  I('ltd_hourglass', '星の砂時計', 'goods', 0, 1, 1, 0.42, '#8fb8ff', '#3a3f6e', { shape: 'hourglass', small: true, free: true, ltd: true }),
  I('ltd_globe', '金の地球儀', 'goods', 0, 1, 1, 0.8, '#e8b830', '#fff1b8', { shape: 'ltdglobe', small: true, free: true, ltd: true }),
  I('ltd_cat', 'まねきねこ', 'goods', 0, 1, 1, 0.5, '#fffaf0', '#e8505b', { shape: 'catplush', small: true, free: true, ltd: true }),
  I('ltd_candle', '記念キャンドル', 'goods', 0, 1, 1, 0.35, '#ffd9e6', '#e8a0b8', { shape: 'candle', small: true, free: true, ltd: true }),
  // はずれ品（QRプレゼントで「はずれ」として配る）
  I('ltd_fish', '腐った魚', 'goods', 0, 1, 1, 0.4, '#8a9a6a', '#b8b48a', { shape: 'rottenfish', small: true, free: true, ltd: true, hazure: true })
];
export const LTD_ITEMS = ITEMS.filter(i => i.ltd);
ITEMS.forEach(i => { if (i.cat === 'wall') i.wall = true; });
export const ITEM = {}; ITEMS.forEach(i => { ITEM[i.id] = i; });
