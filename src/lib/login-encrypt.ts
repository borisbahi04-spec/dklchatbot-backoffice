/**
 * login-encrypt.ts -- chiffrement côté navigateur des identifiants de
 * connexion (demande de Boris, 27/09/2026 : "les infos de connexion ne
 * doivent pas être lisibles depuis l'inspection"). Voir
 * `lib/server/login-crypto.ts` pour le schéma complet.
 *
 * RSA-OAEP / SHA-256 (RFC 8017). On utilise WebCrypto (`crypto.subtle`)
 * quand il est disponible ; sinon -- cas de l'appli servie en HTTP sur une
 * IP / un nom de machine, où les navigateurs désactivent `crypto.subtle` --
 * une implémentation autonome (SHA-256 + OAEP + BigInt) produit exactement
 * le même format. `crypto.getRandomValues` reste disponible en HTTP.
 */

export interface LoginChallenge {
  kid: string;
  n: string; // module RSA, base64url (JWK)
  e: string; // exposant public, base64url (JWK)
  nonce: string;
}

export interface EncryptedLoginBody {
  kid: string;
  payload: string; // base64
}

export async function encryptLoginCredentials(
  challenge: LoginChallenge,
  username: string,
  password: string
): Promise<EncryptedLoginBody> {
  const message = new TextEncoder().encode(
    JSON.stringify({ u: username, p: password, n: challenge.nonce, t: Date.now() })
  );
  const cipher = await rsaOaepSha256Encrypt(challenge, message);
  return { kid: challenge.kid, payload: bytesToBase64(cipher) };
}

async function rsaOaepSha256Encrypt(key: { n: string; e: string }, message: Uint8Array): Promise<Uint8Array> {
  const subtle = typeof globalThis.crypto !== "undefined" ? globalThis.crypto.subtle : undefined;
  if (subtle) {
    try {
      const cryptoKey = await subtle.importKey(
        "jwk",
        { kty: "RSA", n: key.n, e: key.e, alg: "RSA-OAEP-256", ext: true },
        { name: "RSA-OAEP", hash: "SHA-256" },
        false,
        ["encrypt"]
      );
      return new Uint8Array(await subtle.encrypt({ name: "RSA-OAEP" }, cryptoKey, message as BufferSource));
    } catch {
      // on retombe sur l'implémentation autonome ci-dessous
    }
  }
  return fallbackEncrypt(key, message);
}

/* ------------------------------------------------------------------ */
/* Implémentation autonome (contexte non sécurisé : HTTP)               */
/* ------------------------------------------------------------------ */

const H_LEN = 32;

function fallbackEncrypt(key: { n: string; e: string }, message: Uint8Array): Uint8Array {
  const nBytes = base64UrlToBytes(key.n);
  const k = nBytes[0] === 0 ? nBytes.length - 1 : nBytes.length;
  const n = bytesToBigInt(nBytes);
  const e = bytesToBigInt(base64UrlToBytes(key.e));

  if (message.length > k - 2 * H_LEN - 2) {
    throw new Error("Identifiants trop longs pour être chiffrés.");
  }

  // EME-OAEP encoding
  const lHash = sha256(new Uint8Array(0));
  const db = new Uint8Array(k - H_LEN - 1);
  db.set(lHash, 0);
  db[db.length - message.length - 1] = 0x01;
  db.set(message, db.length - message.length);

  const seed = new Uint8Array(H_LEN);
  globalThis.crypto.getRandomValues(seed);

  const dbMask = mgf1(seed, db.length);
  for (let i = 0; i < db.length; i++) db[i] ^= dbMask[i];
  const seedMask = mgf1(db, H_LEN);
  for (let i = 0; i < H_LEN; i++) seed[i] ^= seedMask[i];

  const em = new Uint8Array(k);
  em.set(seed, 1);
  em.set(db, 1 + H_LEN);

  const c = modPow(bytesToBigInt(em), e, n);
  return bigIntToBytes(c, k);
}

function mgf1(seed: Uint8Array, length: number): Uint8Array {
  const out = new Uint8Array(length);
  const input = new Uint8Array(seed.length + 4);
  input.set(seed, 0);
  let offset = 0;
  for (let counter = 0; offset < length; counter++) {
    input[seed.length] = (counter >>> 24) & 0xff;
    input[seed.length + 1] = (counter >>> 16) & 0xff;
    input[seed.length + 2] = (counter >>> 8) & 0xff;
    input[seed.length + 3] = counter & 0xff;
    const block = sha256(input);
    const take = Math.min(block.length, length - offset);
    out.set(block.subarray(0, take), offset);
    offset += take;
  }
  return out;
}

function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  const ZERO = BigInt(0);
  const ONE = BigInt(1);
  const TWO = BigInt(2);
  let result = ONE;
  let b = base % mod;
  let e = exp;
  while (e > ZERO) {
    if (e % TWO === ONE) result = (result * b) % mod;
    b = (b * b) % mod;
    e = e / TWO;
  }
  return result;
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  let hex = "";
  for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
  return hex ? BigInt("0x" + hex) : BigInt(0);
}

function bigIntToBytes(value: bigint, length: number): Uint8Array {
  let hex = value.toString(16);
  if (hex.length % 2) hex = "0" + hex;
  const out = new Uint8Array(length);
  const raw = hex.length / 2;
  for (let i = 0; i < raw; i++) out[length - raw + i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

function base64UrlToBytes(value: string): Uint8Array {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/* SHA-256 (FIPS 180-4) */
const K256 = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function sha256(data: Uint8Array): Uint8Array {
  const bitLen = data.length * 8;
  const padded = new Uint8Array(((data.length + 9 + 63) >> 6) << 6);
  padded.set(data);
  padded[data.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000));
  view.setUint32(padded.length - 4, bitLen >>> 0);

  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  const rotr = (x: number, r: number) => (x >>> r) | (x << (32 - r));

  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7]];
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K256[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0; h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
  }
  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) outView.setUint32(i * 4, h[i]);
  return out;
}

/** Exposé pour les tests uniquement. */
export const __test = { fallbackEncrypt, sha256 };
