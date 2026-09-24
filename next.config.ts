import type { NextConfig } from "next";

// Le proxy navigateur -> backend n'est plus un simple `rewrites()` : c'est
// un Route Handler (`src/app/api/backend/[...path]/route.ts`) qui, en plus
// de relayer l'URL, injecte lui-même le JWT de session (lu depuis un cookie
// httpOnly) dans les en-têtes envoyés au backend. Ce fichier n'a donc plus
// besoin de connaître l'URL réelle du backend : voir
// `BACKEND_API_BASE_URL` dans `.env.local` et `lib/server/backend-client.ts`.
const nextConfig: NextConfig = {};

export default nextConfig;
