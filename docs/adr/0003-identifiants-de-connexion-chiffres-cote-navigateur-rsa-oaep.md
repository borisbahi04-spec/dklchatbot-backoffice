# ADR-0003 — Identifiants de connexion chiffrés côté navigateur (RSA-OAEP)

- **Statut** : Accepté
- **Date** : 2026-09-27
- **Décideur** : Boris (DKL)

## Contexte

Le mot de passe apparaissait en clair dans l'onglet Réseau des outils de développement, l'application étant servie en HTTP sur IP.

## Décision

- `GET /api/auth/login-key` fournit une clé publique RSA-2048 (générée en mémoire au démarrage de Next) et un **nonce** à usage unique (2 min).
- Le navigateur chiffre `{u, p, n, t}` (WebCrypto si disponible, sinon implémentation autonome car `crypto.subtle` est désactivé en HTTP).
- Le proxy déchiffre et transmet au backend ; login en clair et nonce rejoué refusés.

## Conséquences

- Protège ce qui transite (réseau, HAR) mais pas un script exécuté sur le poste. Ne remplace pas HTTPS.
- `change-password` n'est pas encore chiffré.

## Références

- `src/lib/login-encrypt.ts`, `src/lib/server/login-crypto.ts`, `src/app/api/auth/login-key/route.ts`
