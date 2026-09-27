import "server-only";
import { constants, generateKeyPairSync, privateDecrypt, randomBytes, type KeyObject } from "crypto";

/**
 * Chiffrement des identifiants de connexion -- demande de Boris, 27/09/2026
 * ("faire en sorte que les infos de connexion ne soient pas lisibles depuis
 * l'inspection") : avant, `POST /api/backend/auth/login` partait avec
 * `{username, password}` EN CLAIR, visible tel quel dans DevTools > Network >
 * Payload (et dans tout export HAR / proxy HTTP intermédiaire).
 *
 * Fonctionnement :
 * 1. Le navigateur demande `GET /api/auth/login-key` -> clé publique RSA
 *    (générée en mémoire au démarrage du serveur Next, jamais écrite sur
 *    disque) + un `nonce` à usage unique valable 2 minutes.
 * 2. Il chiffre `{u, p, n, t}` en RSA-OAEP/SHA-256 (`lib/login-encrypt.ts`)
 *    et n'envoie que `{kid, payload}` (base64 illisible).
 * 3. Le proxy (`api/backend/[...path]/route.ts`) déchiffre ici avec la clé
 *    privée, vérifie le nonce (usage unique, 2 min : pas de rejeu), puis transmet
 *    `{username, password}` au backend Nest en serveur-à-serveur.
 *
 * Limite assumée : cela protège ce qui TRANSITE (onglet Réseau, HAR, proxy),
 * pas le poste lui-même (un script injecté dans la page pourrait toujours lire
 * le champ mot de passe). Servir l'application en HTTPS reste recommandé.
 */

const NONCE_TTL_MS = 2 * 60 * 1000;
const MAX_PENDING_NONCES = 5000;

interface LoginKeyState {
  kid: string;
  privateKey: KeyObject;
  publicJwk: { n: string; e: string };
  nonces: Map<string, number>; // nonce -> expiration (ms)
}

// Singleton sur globalThis : survit au rechargement à chaud (next dev) et
// partagé entre toutes les routes du même processus.
const globalForLoginKey = globalThis as unknown as { __chatbotLoginKey?: LoginKeyState };

function getState(): LoginKeyState {
  if (!globalForLoginKey.__chatbotLoginKey) {
    const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048, publicExponent: 0x10001 });
    const jwk = publicKey.export({ format: "jwk" }) as { n: string; e: string };
    globalForLoginKey.__chatbotLoginKey = {
      kid: randomBytes(8).toString("hex"),
      privateKey,
      publicJwk: { n: jwk.n, e: jwk.e },
      nonces: new Map(),
    };
  }
  return globalForLoginKey.__chatbotLoginKey;
}

function purgeExpiredNonces(state: LoginKeyState, now: number) {
  for (const [nonce, exp] of state.nonces) {
    if (exp <= now) state.nonces.delete(nonce);
  }
}

/** Clé publique (JWK n/e en base64url) + nonce à usage unique pour UNE tentative de connexion. */
export function issueLoginChallenge(): { kid: string; n: string; e: string; nonce: string; expiresIn: number } {
  const state = getState();
  const now = Date.now();
  purgeExpiredNonces(state, now);
  if (state.nonces.size >= MAX_PENDING_NONCES) {
    // Protection mémoire basique : on oublie les plus anciens.
    const oldest = state.nonces.keys().next().value;
    if (oldest) state.nonces.delete(oldest);
  }
  const nonce = randomBytes(12).toString("base64url");
  state.nonces.set(nonce, now + NONCE_TTL_MS);
  return { kid: state.kid, n: state.publicJwk.n, e: state.publicJwk.e, nonce, expiresIn: NONCE_TTL_MS / 1000 };
}

export class LoginDecryptError extends Error {}

/**
 * Déchiffre le corps `{kid, payload}` envoyé par le navigateur et renvoie
 * les identifiants en clair (uniquement côté serveur). Lève
 * `LoginDecryptError` si la clé a changé (serveur redémarré), si le nonce
 * est inconnu/expiré/déjà utilisé, ou si le contenu est invalide.
 */
export function decryptLoginPayload(body: unknown): { username: string; password: string } {
  const state = getState();
  const { kid, payload } = (body ?? {}) as { kid?: unknown; payload?: unknown };
  if (typeof payload !== "string" || !payload) {
    throw new LoginDecryptError("Requête de connexion non chiffrée refusée.");
  }
  if (kid !== state.kid) {
    throw new LoginDecryptError("Clé de connexion expirée, veuillez réessayer.");
  }

  let decoded: { u?: unknown; p?: unknown; n?: unknown; t?: unknown };
  try {
    const plain = privateDecrypt(
      { key: state.privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
      Buffer.from(payload, "base64")
    );
    decoded = JSON.parse(plain.toString("utf8"));
  } catch {
    throw new LoginDecryptError("Données de connexion illisibles, veuillez réessayer.");
  }

  const now = Date.now();
  const nonce = typeof decoded.n === "string" ? decoded.n : "";
  const exp = state.nonces.get(nonce);
  state.nonces.delete(nonce); // usage unique, même en cas d'échec ensuite
  if (!exp || exp <= now) {
    throw new LoginDecryptError("Session de connexion expirée, veuillez réessayer.");
  }
  // Pas de contrôle sur `t` (horloge du poste client potentiellement
  // décalée) : l'anti-rejeu repose sur le nonce, expiré côté serveur.
  if (typeof decoded.u !== "string" || typeof decoded.p !== "string") {
    throw new LoginDecryptError("Identifiants manquants.");
  }
  return { username: decoded.u, password: decoded.p };
}
