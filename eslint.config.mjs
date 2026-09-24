import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Ce template synchronise volontairement l'état local d'un formulaire
      // (modales Créer/Modifier) et de listes de sélection (branches, rôles,
      // accès) via useEffect + setState, un pattern React classique et sûr
      // ici (pas de dépendances circulaires, effets bien scopés). La règle
      // (issue du plugin React Compiler) est plus stricte que nécessaire
      // pour ce cas d'usage ; désactivée pour éviter du bruit. Pour une
      // application de plus grande envergure, préférez `key`-based remount
      // ou une librairie de data-fetching (SWR, TanStack Query).
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
