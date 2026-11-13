// 名簿の暗号化バックアップ・担任助手パスワードの部品。画面にもネットワークにも触らない（テストしやすい純粋な関数）
const cr = () => globalThis.crypto;
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
export const sha256Hex = async s => hex(await cr().subtle.digest('SHA-256', new TextEncoder().encode(s)));

// ===== 暗号化バックアップ：PBKDF2(SHA-256, 20万回) → AES-GCM =====
export const VAULT_ITER = 200000;
const b64 = u8 => { let s = ''; u8.forEach(c => { s += String.fromCharCode(c); }); return btoa(s); };
const unb64 = t => Uint8Array.from(atob(t), c => c.charCodeAt(0));
export async function deriveKey(pass, saltB64, iter) {
  const base = await cr().subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  return cr().subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64(saltB64), iterations: iter || VAULT_ITER }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export const newSalt = () => b64(cr().getRandomValues(new Uint8Array(16)));
// 鍵は(パスワード,salt)ごとに使い回す（毎回20万回まわすと重いので）
let kc = null;
export async function vaultKey(pass, saltB64) {
  if (kc && kc.pass === pass && kc.salt === saltB64) return kc.key;
  const key = await deriveKey(pass, saltB64); kc = { pass, salt: saltB64, key }; return key;
}
export const vaultKeyReset = () => { kc = null; };
export const currentSalt = pass => (kc && kc.pass === pass ? kc.salt : null);
// obj を暗号化 → { salt, iv, data }（すべて base64）。salt は同じパスワードの間は使い回し、iv は毎回ランダム
export async function vaultEncrypt(obj, pass) {
  const salt = currentSalt(pass) || newSalt(), key = await vaultKey(pass, salt), iv = cr().getRandomValues(new Uint8Array(12));
  const ct = await cr().subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(obj)));
  return { salt, iv: b64(iv), data: b64(new Uint8Array(ct)) };
}
// 復号：パスワードがちがう・こわれているときは throw
export async function vaultDecrypt(v, pass) {
  const key = await vaultKey(pass, v.salt);
  const pt = await cr().subtle.decrypt({ name: 'AES-GCM', iv: unb64(v.iv) }, key, unb64(v.data));
  return JSON.parse(new TextDecoder().decode(pt));
}
// 4けた数字のままの弱いパスワードか（バックアップはしない）
export const isWeakPass = p => String(p == null ? '' : p).length < 8;
// 新しいパスワード：半角の英数字・記号 8〜64文字（サーバーの bcrypt は72バイトまでなので全角は避ける）
export const passOk = p => /^[ -~]{8,64}$/.test(String(p == null ? '' : p));
// 生徒に配るURL（QRプレゼントのQRに使う）
export const STUDENT_URL = 'https://toshinfuji2-beep.github.io/kojo/';
