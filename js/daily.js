// 利用時間（1日あたり）：家にいる時間を、日ごと・端末ごとに数える（decisions #19）。
// 上限(分)はサーバーの設定 settings.daily_minutes（0＝無制限）。担任助手が個別に「今日だけ解除」できる。
// 担任助手のme-・お試し(demo)は対象外（呼ぶ側で除く）。ここは数え方と判定だけの純粋な部品（localStorage だけ使う）。
const KEY = 'kojoHouse.daily';
const p2 = n => String(n).padStart(2, '0');
export const dayKey = d => { d = d || new Date(); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); };
// {day, sec:{uid:秒}, warned:{uid:true}}。日付が変わったら空から数えなおす
export function dailyRead(now) {
  const day = dayKey(now ? new Date(now) : new Date());
  try { const o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (o && o.day === day && o.sec && typeof o.sec === 'object') return { day, sec: o.sec, warned: o.warned || {} }; } catch (e) { /* 壊れていたら空から */ }
  return { day, sec: {}, warned: {} };
}
const write = o => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* 保存できなくても数えるのは続ける */ } };
// その人の今日の利用秒数に sec を足して、合計を返す
export function dailyAdd(uid, sec, now) { const o = dailyRead(now); o.sec[uid] = (o.sec[uid] || 0) + Math.max(0, sec); write(o); return o.sec[uid]; }
export const dailyUsed = (uid, now) => dailyRead(now).sec[uid] || 0;
export function dailyWarn(uid, now) { const o = dailyRead(now); if (o.warned[uid]) return false; o.warned[uid] = true; write(o); return true; }   // 「あと5分」を今日1回だけ出すための印。初めて呼んだときだけ true
// 判定：limitMin＝1日の分(0＝無制限)、usedSec＝今日使った秒、unlocked＝今日だけ解除されているか
// → { limited, over(今日はここまで), leftSec, warn(残りがわずか：5分、上限が10分以下なら半分) }
export function dailyStatus(limitMin, usedSec, unlocked) {
  const lim = Math.max(0, +limitMin || 0) * 60, limited = lim > 0 && !unlocked, left = limited ? Math.max(0, lim - (usedSec || 0)) : Infinity;
  return { limited, over: limited && left <= 0, leftSec: left, warn: limited && left > 0 && left <= Math.min(300, lim / 2) };
}
