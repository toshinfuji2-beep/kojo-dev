// アイテム定義 -> 3Dモデル。id単位でテンプレートをキャッシュして clone を返す。
import { THREE, M, box, G, add } from './mk.js?v=202611131634';
import * as F from './models_furniture.js?v=202611131634';
import * as D from './models_decor.js?v=202611131634';
import * as W from './models_wall.js?v=202611131634';
import * as F2 from './models_furniture2.js?v=202611131634';
import * as D2 from './models_decor2.js?v=202611131634';
import * as W2 from './models_wall2.js?v=202611131634';
import * as W3 from './models_wall3.js?v=202611131634';
import * as N1 from './models_natural.js?v=202611131634';
import * as N2 from './models_natural_wall.js?v=202611131634';
import * as L1 from './models_ltd.js?v=202611131634';

const B = Object.assign({}, F, D, W, F2, D2, W2, W3, N1, N2, L1);
const tpl = new Map();

export const fallbackIds = new Set();
function fallback(d) {
  fallbackIds.add(d.id);
  const g = G(), w = Math.max(.3, d.w || 1), h = Math.max(.2, d.h || .5), dd = Math.max(.1, d.d || 1);
  add(g, box(w * .9, h, dd * .9, M(d.color || '#cccccc'), 0, 0, 0)); return g;
}
function make(d) {
  const fn = d.wall ? B['art_' + d.art] : B['build_' + d.shape];
  if (!fn) return { g: fallback(d), live: false };
  try { const g = fn(d); return { g, live: !!g.userData.anim }; } catch (e) { console.error('model', d.id, e); return { g: fallback(d), live: false }; }
}
// 足元中心・正面+z（壁物は左下原点・+zが部屋側）の Group を返す
export function buildItem(d) {
  let t = tpl.get(d.id);
  if (!t) {
    t = make(d);
    t.g.traverse(o => { if (o.isMesh) { o.castShadow = o.castShadow !== false && !(o.material && o.material.transparent); } });
    tpl.set(d.id, t);
    if (t.live) { tpl.delete(d.id); return t.g; }   // アニメ付きはクロージャを持つので共有しない（毎回作る）
  }
  return t.g.clone(true);
}
