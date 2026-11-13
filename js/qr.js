// 小さなQRコード生成（外部ライブラリなし）。バイトモード・誤り訂正レベルL・型番1〜5（最大106バイト）。
// qrMatrix(text) → { size, rows:[[bool]], version, mask }。qrSvg(text) → <svg> 文字列
const VER = { 1: [19, 7], 2: [34, 10], 3: [55, 15], 4: [80, 20], 5: [108, 26] };   // [データ語数, 誤り訂正語数]（レベルL・1ブロック）
const ALIGN = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30] };
const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
{ let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; }
const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);
function rsEc(data, n) {
  let g = [1];
  for (let i = 0; i < n; i++) { const ng = new Array(g.length + 1).fill(0); for (let j = 0; j < g.length; j++) { ng[j] ^= g[j]; ng[j + 1] ^= mul(g[j], EXP[i]); } g = ng; }
  const res = new Array(n).fill(0);
  for (const d of data) { const f = d ^ res.shift(); res.push(0); for (let i = 0; i < n; i++) res[i] ^= mul(g[i + 1], f); }
  return res;
}
const MASKS = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x, y) => x % 3 === 0, (x, y) => (x + y) % 3 === 0, (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => (x * y) % 2 + (x * y) % 3 === 0, (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0, (x, y) => ((x + y) % 2 + (x * y) % 3) % 2 === 0];
export function qrMatrix(text, forceMask) {
  const bytes = [...new TextEncoder().encode(String(text))];
  let version = 0; for (let v = 1; v <= 5; v++) if (bytes.length <= VER[v][0] - 2) { version = v; break; }
  if (!version) throw new Error('QR: 文字が長すぎます');
  const [nData, nEc] = VER[version], size = 17 + 4 * version;
  // ビット列：モード0100・長さ8bit・本文・終端・パディング
  const bits = []; const put = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1); };
  put(4, 4); put(bytes.length, 8); bytes.forEach(b => put(b, 8)); put(0, Math.min(4, nData * 8 - bits.length)); while (bits.length % 8) bits.push(0);
  const cw = []; for (let i = 0; i < bits.length; i += 8) { let v = 0; for (let j = 0; j < 8; j++) v = v * 2 + bits[i + j]; cw.push(v); }
  for (let p = 0; cw.length < nData; p ^= 1) cw.push(p ? 0x11 : 0xEC);
  const all = cw.concat(rsEc(cw, nEc));
  const mod = Array.from({ length: size }, () => new Array(size).fill(false)), fn = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (x, y, d) => { mod[y][x] = d; fn[y][x] = true; };
  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }   // タイミング
  const finder = (cx, cy) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= size || y >= size) continue; const d = Math.max(Math.abs(dx), Math.abs(dy)); set(x, y, d !== 2 && d !== 4); } };
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
  const al = ALIGN[version]; al.forEach((cx, i) => al.forEach((cy, j) => { if ((i === 0 && j === 0) || (i === 0 && j === al.length - 1) || (i === al.length - 1 && j === 0)) return; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1); }));
  const fmt = mask => {   // 形式情報（レベルL=01）
    const data = (1 << 3) | mask; let rem = data; for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const b = ((data << 10) | rem) ^ 0x5412, bit = i => ((b >>> i) & 1) !== 0;
    for (let i = 0; i <= 5; i++) set(8, i, bit(i)); set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8)); for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i)); for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i)); set(8, size - 8, true);
  };
  fmt(0);   // 場所の確保（あとで本物を上書き）
  // データを右下から2列ずつジグザグに
  let k = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
      if (!fn[y][x] && k < all.length * 8) { mod[y][x] = ((all[k >>> 3] >>> (7 - (k & 7))) & 1) !== 0; k++; }
    }
  }
  const penalty = m => {
    let p = 0; const N = size;
    for (let pass = 0; pass < 2; pass++) for (let a = 0; a < N; a++) {
      let run = 1, line = [];
      for (let b = 0; b < N; b++) { const v = pass ? m[b][a] : m[a][b]; line.push(v); if (b && v === line[b - 1]) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; }
      const s = line.map(v => (v ? 1 : 0)).join(''); for (let i = 0; i + 11 <= N; i++) { const w = s.substr(i, 11); if (w === '10111010000' || w === '00001011101') p += 40; }
    }
    for (let y = 0; y + 1 < N; y++) for (let x = 0; x + 1 < N; x++) { const v = m[y][x]; if (v === m[y][x + 1] && v === m[y + 1][x] && v === m[y + 1][x + 1]) p += 3; }
    let dark = 0; m.forEach(r => r.forEach(v => { if (v) dark++; })); p += Math.floor(Math.abs(dark * 20 - N * N * 10) / (N * N)) * 10;
    return p;
  };
  const apply = mask => { const m = mod.map(r => r.slice()); for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && MASKS[mask](x, y)) m[y][x] = !m[y][x]; return m; };
  let best = -1, bestP = Infinity;
  if (forceMask != null) best = forceMask; else for (let mk = 0; mk < 8; mk++) { const p = penalty(apply(mk)); if (p < bestP) { bestP = p; best = mk; } }
  const rows = apply(best); mod.length = 0; rows.forEach(r => mod.push(r)); fmt(best);
  return { size, rows: mod, version, mask: best };
}
// SVG文字列（まわりに余白 quiet モジュール）
export function qrSvg(text, quiet) {
  const q = quiet == null ? 3 : quiet, { size, rows } = qrMatrix(text), n = size + q * 2; let d = '';
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (rows[y][x]) d += 'M' + (x + q) + ' ' + (y + q) + 'h1v1h-1z';
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + n + ' ' + n + '" shape-rendering="crispEdges" role="img" aria-label="QRコード"><rect width="' + n + '" height="' + n + '" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
}
