// me-（自分のアバター）の設定：項目と数・色の一覧・既定値・整え方・4桁番号のハッシュ（純粋関数。DOMもthree.jsも使わない）
// 新しい項目は末尾に足す（番号がずれると、保存済みのme-の見た目が変わるため）
export const ME_COUNT = { hair: 20, hairC: 14, skin: 10, eye: 13, eyeC: 7, nose: 8, mouth: 12, brow: 9, cheek: 5, mole: 7, glasses: 5, hood: 8, top: 28, hat: 15, acc: 12, bag: 11, face: 5, browC: 15, bottom: 10, shoes: 9 };
export const HAIR_COLORS = ['#a9794f', '#5a3e2b', '#2f2622', '#c9955c', '#8a4b36', '#e2c070', '#6b6670', '#f2a0b8', '#8fd6c0', '#7fa8e8', '#6e2f2f', '#d9772f', '#f3e3b0', '#c8c8cc'];
export const SKIN_COLORS = ['#ffe6d2', '#ffe0c6', '#fbd3b3', '#f2c29a', '#d9a37a', '#b9825a', '#fff0e6', '#f7c9a6', '#c98f62', '#8f5e3e'];
export const HOOD_COLORS = ['#a8e6cf', '#f7a8a0', '#a9c8f2', '#ffd98a', '#f5b7d3', '#cdb4f0', '#46577e', '#f6f1e6'];
export const EYE_COLORS = [null, '#4a2a1a', '#1d2540', '#2f6a4f', '#4f7fd0', '#6b6670', '#9a5a2a'];   // 0 = 目の形ごとの標準の色
export const CHEEK_COLORS = [null, '#ff9bb0', '#ffb07a', '#ffc9d2', null];   // 4 = そばかす
export const HAIR_NAMES = ['ボブ', 'ショート', 'ツンツン', 'ポニテ', 'ツイン', 'おだんご', 'ロング', 'ぼうず', 'ふわパーマ', 'センター分け', 'サイドテール', 'みつあみ', 'マッシュ', 'ハーフアップ', 'くせ毛', 'ウルフ', 'ぱっつんロング', 'ななめ前髪', 'ベリーショート', 'ひくめおさげ'];
export const EYE_NAMES = ['まる', 'おおきめ', 'たれ目', 'きりっ', 'にっこり', 'きらきら', 'ねむそう', 'つり目', 'まつげ', 'ほそ目', 'まんまる', 'じとっ', 'ウインク'];
export const EYEC_NAMES = ['ふつう', 'ちゃいろ', 'こん', 'みどり', 'あお', 'はいいろ', 'こはく'];
export const NOSE_NAMES = ['なし', 'ちょん', 'まる', 'すっと', 'ほんのり', 'たかめ', 'だんご', 'ツン'];
export const MOUTH_NAMES = ['ω', 'にっこり', 'あーん', 'まる', 'にやり', 'ぺろっ', 'ニッ', 'むっ', 'へ', 'にこっ', 'おちょぼ', 'ぽかん'];
export const BROW_NAMES = ['なし', 'ふつう', 'ふとめ', 'きりっ', 'やさしい', 'まろ', 'ふと短', 'こまり', 'おこり'];
export const CHEEK_NAMES = ['なし', 'ピンク', 'オレンジ', 'うっすら', 'そばかす'];
export const MOLE_NAMES = ['なし', '左目の下', '右目の下', '左ほほ', '右ほほ', '口の左', '口の右'];
export const GLASSES_NAMES = ['なし', 'まる', 'しかく', 'ふちふと', 'きんいろ'];
export const HEIGHT_MIN = .9, HEIGHT_MAX = 1.1;
// まゆの色：0＝かみと同じ、1〜14＝かみの色と同じならび
export const BROWC_NAMES = ['かみと同じ'].concat(HAIR_COLORS.map((c, i) => 'いろ' + (i + 1)));
export const FACE_NAMES = ['まる顔', 'たまご顔', 'ほそ面', 'しかく顔', 'ふっくら'];
// 顔のパーツの位置・大きさ（-1〜1。0がふつう）。スライダーで少しずつ動かして、その人らしさを出す
export const ADJ_KEYS = [['eyeY', 'めの高さ', 'した', 'うえ'], ['eyeX', 'めのあいだ', 'せまい', 'ひろい'], ['eyeS', 'めの大きさ', 'ちいさい', 'おおきい'], ['browY', 'まゆの高さ', 'した', 'うえ'], ['mouthY', 'くちの高さ', 'した', 'うえ']];

// ===== きせかえ（ピコで買う）：[なまえ, 基本の値段(物価をかける前)]。値段0は最初から持っている =====
export const WEAR = {
  // 番号は末尾に足す（保存済みの me- の見た目が変わらないように）。7・8 は担任助手だけのスーツ
  top: [['パーカー', 0], ['Tシャツ', 300], ['ボーダーシャツ', 500], ['オーバーオール', 800], ['カーディガン', 900], ['ワンピース', 1200], ['ジャージ', 700], ['スーツ（パンツ）', 0], ['スーツ（スカート）', 0],
    ['セーター', 1500], ['ポロシャツ', 1000], ['アロハシャツ', 1600], ['チェックシャツ', 1300], ['デニムジャケット', 2200], ['ダウンジャケット', 3000], ['トレンチコート', 3500], ['ゆかた', 2800],
    ['ブレザー', 2500], ['タンクトップ', 600], ['体操服', 800], ['白衣', 2400], ['エプロン', 900], ['サンタ服', 4000], ['ドットワンピース', 1800],
    ['学ラン', 2000], ['ブレザー制服（ネクタイ）', 2000], ['制服（スカート）', 2000], ['制服（スラックス）', 2000]],
  hat: [['なし', 0], ['ニット帽', 400], ['キャップ', 500], ['むぎわら帽子', 600], ['ベレー帽', 600], ['ねこみみ', 900], ['リボン', 300], ['おうかん', 3000],
    ['ハンチング', 700], ['バケットハット', 800], ['シルクハット', 2000], ['カチューシャ', 400], ['うさみみ', 900], ['サンタぼうし', 1500], ['はちまき', 300]],
  acc: [['なし', 0], ['マフラー', 500], ['ヘッドホン', 900], ['星のペンダント', 700], ['ばんそうこう', 100], ['はなまるバッジ', 400],
    ['サングラス', 800], ['パールネックレス', 1200], ['ちょうネクタイ', 600], ['マスク', 200], ['きんメダル', 1500], ['カチューシャ', 400]],
  bag: [['リュック', 0], ['なし', 0], ['ショルダーバッグ', 600], ['トートバッグ', 500], ['ランドセル', 800], ['くまリュック', 1200],
    ['ボストンバッグ', 1200], ['ポシェット', 700], ['サコッシュ', 600], ['エコバッグ', 400], ['スクールバッグ', 1000]],
  // ボトムス・くつ（2026-11-13 追加）。0 は最初から持っている
  bottom: [['ふくに合わせる', 0], ['ジーンズ', 600], ['チノパン', 600], ['くろパンツ', 700], ['ショートパンツ', 500], ['プリーツスカート', 900], ['チェックスカート', 1000], ['ロングスカート', 1100], ['カーゴパンツ', 900], ['ジャージパンツ', 500]],
  shoes: [['スニーカー', 0], ['くろスニーカー', 300], ['ローファー', 600], ['ブーツ', 1000], ['サンダル', 400], ['長ぐつ', 500], ['ハイカット', 800], ['うわばき', 200], ['きんのくつ', 5000]]
};
export const WEAR_KEYS = ['top', 'hat', 'acc', 'bag', 'bottom', 'shoes'];
export const WEAR_LABEL = { top: 'ふく', hat: 'ぼうし', acc: 'アクセサリー', bag: 'かばん', bottom: 'ボトムス', shoes: 'くつ' };
// 担任助手モードだけで着られる服（ショップには出さない・生徒は買えない。サーバーの wear_items にも入れない）
export const STAFF_WEAR = new Set(['top7', 'top8']);
export const isStaffWear = (k, i) => STAFF_WEAR.has(k + i);
export const isFreeWear = (k, i) => !!WEAR[k][i] && WEAR[k][i][1] === 0 && !isStaffWear(k, i);
export const cleanWear = a => Array.isArray(a) ? [...new Set(a.filter(x => typeof x === 'string' && !STAFF_WEAR.has(x) && /^(top|hat|acc|bag|bottom|shoes)\d{1,2}$/.test(x) && WEAR[x.replace(/\d+$/, '')][+x.match(/\d+$/)[0]]))] : [];

export const defaultMe = () => ({ hair: 0, hairC: 0, skin: 1, eye: 0, eyeC: 0, nose: 1, mouth: 0, brow: 1, cheek: 1, mole: 0, glasses: 0, height: 1, plump: .4, hood: 0, top: 0, hat: 0, acc: 0, bag: 1, face: 0, browC: 0, bottom: 0, shoes: 0 });
const ci = (v, n, d) => { v = Math.floor(+v); return isFinite(v) && v >= 0 && v < n ? v : d; };
export function cleanMe(o) {
  const d = defaultMe(); if (!o || typeof o !== 'object') return null;
  const m = {}; for (const k in ME_COUNT) m[k] = ci(o[k], ME_COUNT[k], d[k]);
  const hh = +o.height, pp = +o.plump;
  m.height = isFinite(hh) ? Math.round(Math.max(HEIGHT_MIN, Math.min(HEIGHT_MAX, hh)) * 100) / 100 : 1;   // 小数2けた（保存を短く）
  m.plump = isFinite(pp) ? Math.round(Math.max(0, Math.min(1, pp)) * 100) / 100 : .4;
  // パーツの位置・大きさ：-1〜1 を 0.05 きざみ（保存が長くならないように丸める）。無い・0 のときは入れない
  ADJ_KEYS.forEach(([k]) => { const v = +o[k]; if (isFinite(v) && Math.abs(v) >= .025) m[k] = Math.round(Math.max(-1, Math.min(1, v)) * 20) / 20; });
  return m;
}
const adjOf = (m, k) => m[k] || 0;
export const meKey = m => { const c = cleanMe(m) || defaultMe(); return Object.keys(ME_COUNT).map(k => c[k]).join('.') + '/' + c.height.toFixed(2) + '/' + c.plump.toFixed(2) + '/' + ADJ_KEYS.map(([k]) => adjOf(c, k)).join(','); };
export function randomMe(rnd) {
  rnd = rnd || Math.random; const m = {}; for (const k in ME_COUNT) m[k] = Math.floor(rnd() * ME_COUNT[k]);
  m.mole = rnd() < .7 ? 0 : m.mole; m.glasses = rnd() < .6 ? 0 : m.glasses; m.eyeC = rnd() < .5 ? 0 : m.eyeC; m.cheek = rnd() < .6 ? 1 : m.cheek;
  WEAR_KEYS.forEach(k => { m[k] = 0; }); m.bag = 1;   // 服・ぼうし等は買った物だけなので、おまかせでは変えない（ふだんの服・かばんは「なし」）
  ADJ_KEYS.forEach(([k]) => { m[k] = rnd() < .5 ? 0 : (rnd() * 2 - 1) * .6; });   // おまかせは、ほどほどに動かす
  m.height = HEIGHT_MIN + rnd() * (HEIGHT_MAX - HEIGHT_MIN); m.plump = rnd(); return cleanMe(m);
}
// 4桁番号のハッシュ（簡易：文字列ハッシュ+生徒ID。サーバー化のときに置き換える）
export function pinHash(pin, studentUid) {
  const s = 'kojo|' + String(studentUid) + '|' + String(pin); let a = 2166136261, b = 5381;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a = Math.imul(a ^ c, 16777619) >>> 0; b = (Math.imul(b, 33) + c) >>> 0; }
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
}
export const checkPin = (st, pin) => !!st && !!st.pin && st.pin === pinHash(pin, st.uid);
// ID から決まる「仮のme」（me-未作成の人を家で歩かせるとき用）
export function seededMe(id) {
  let x = 2166136261; for (const c of String(id)) { x ^= c.charCodeAt(0); x = Math.imul(x, 16777619) >>> 0; }
  const rnd = () => { x = (x + 0x6D2B79F5) >>> 0; let t = x; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const m = randomMe(rnd); m.glasses = 0; m.mole = 0; return m;
}
// 表示用の名前。担任助手は前に★を付けて、ひと目でわかるようにする
export const nickOf = s => (s && s.retired ? '卒業した人' : (s && s.staff ? '★' : '') + ((s && s.nick) || 'まだ'));   // 退塾・休止の人の家具は「卒業した人」が買った扱い
export const cleanNick = v => String(v == null ? '' : v).replace(/[\s　]+/g, ' ').trim().slice(0, 8);
// ニックネームの簡単な検査：明らかに不適切な語（少数。足したいときはこの配列に足す）と、空白・記号だけの名前を弾く。
// 2文字以下の語は「その名前そのもの」だけを弾き、3文字以上の語は含まれていたら弾く（「ばかんす」のような誤爆を減らすため）
export const NG_WORDS = ['しね', 'ころす', 'ころして', 'ばか', 'あほ', 'きもい', 'うざい', 'くそ', 'うんこ', 'ちんこ', 'まんこ', 'ちんぽ', 'おっぱい', 'えろ', 'えっち', 'ぶす', 'でぶ', 'はげ', 'かす', 'ごみ',
  '死ね', '殺す', '殺して', '馬鹿', '阿呆', '糞', '消えろ', 'fuck', 'shit', 'bitch', 'sex', 'porn', 'dick', 'nazi', 'kill', 'die'];
const kana = s => s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 96));
export function nickProblem(v) {
  const n = cleanNick(v); if (!n) return 'ニックネームを入力してください';
  if (!/[\p{L}\p{N}]/u.test(n)) return 'ひらがな・カタカナ・漢字・英数字を入れてください（記号や空白だけの名前は付けられません）';
  const k = kana(n.normalize('NFKC').toLowerCase()).replace(/[\s\p{P}\p{S}ー]/gu, '');
  for (const w of NG_WORDS) { const x = kana(w.toLowerCase()); if (x.length <= 2 ? k === x : k.includes(x)) return 'その名前は使えません。ほかの名前にしてください'; }
  return '';
}
export function newUid(used) { const A = 'abcdefghjkmnpqrstuvwxyz23456789'; let u; do { u = ''; for (let i = 0; i < 8; i++) u += A[Math.floor(Math.random() * A.length)]; } while (used && used.has(u)); if (used) used.add(u); return u; }
