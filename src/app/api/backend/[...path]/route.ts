import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { APPLICATION_ID } from "@/lib/config";
import { SESSION_COOKIE_NAME } from "@/lib/server/backend-client";
import { decryptLoginPayload, LoginDecryptError } from "@/lib/server/login-crypto";

/**
 * Proxy authentifié navigateur -> backend.
 *
 * Contrairement à l'ancienne implémentation (un simple `rewrites()` dans
 * `next.config.ts`), ce Route Handler ne se contente pas de relayer l'URL :
 * il lit le JWT de session dans le cookie httpOnly `chatbot_session_token`
 * et l'ajoute lui-même aux en-têtes envoyés au backend (`x-user-claims`,
 * `Authorization: Bearer`). Le navigateur, lui, n'a plus jamais besoin de
 * connaître ou d'envoyer ce jeton : aucun token en clair dans le
 * `localStorage`, ni dans les en-têtes des requêtes visibles depuis les
 * DevTools (Network) du navigateur — seul le cookie httpOnly transite, et
 * un cookie httpOnly n'est lisible ni par le JavaScript de la page ni
 * autrement affiché "en clair" dans l'onglet Application/Storage.
 *
 * Cas particuliers :
 * - `POST /auth/login` : le jeton renvoyé par le backend (corps ou
 *   en-têtes, l'emplacement exact n'étant pas documenté par le Swagger) est
 *   extrait ICI, posé dans le cookie httpOnly, puis retiré de la réponse
 *   envoyée au navigateur — le JWT ne transite donc JAMAIS en clair côté
 *   client, pas même un instant dans la réponse JSON du login.
 * - `POST /auth/logout` : le cookie de session est supprimé après que le
 *   backend a confirmé la déconnexion.
 *
 * Exception assumée : la connexion temps réel du chat (socket.io) a besoin
 * d'un JWT explicite dans son handshake (le backend actuel ne sait pas
 * s'authentifier par cookie pour les WebSockets, voir
 * `lib/socket/socket-service.ts`) ; `GET /api/auth/socket-token` expose donc
 * ce jeton, mais uniquement pour cet usage précis et à la demande.
 */
async function proxy(req: NextRequest, path: string[]): Promise<NextResponse> {
  const backendBaseUrl = (
    process.env.BACKEND_API_BASE_URL ?? "http://127.0.0.1:3337/chatbot-backend/api/v1"
  ).replace(/\/+$/, "");

  const targetPath = path.join("/");
  const isLogin = targetPath === "auth/login" && req.method === "POST";
  const isLogout = targetPath === "auth/logout" && req.method === "POST";

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;

  // CORRECTIF 26/09/2026 (Boris : "No auth token") : sans cookie de session,
  // inutile d'appeler le backend -- passport-jwt répondrait "No auth token",
  // message incompréhensible pour l'utilisateur. On renvoie un 401 explicite,
  // que `lib/api-client.ts` intercepte pour renvoyer vers /login.
  const isPublicAuthRoute = isLogin || targetPath === "auth/user" || targetPath.startsWith("auth/forgot") || targetPath.startsWith("auth/reset");
  if (!token && !isPublicAuthRoute) {
    return NextResponse.json(
      {
        code: 401,
        message: "Session absente ou expirée. Veuillez vous reconnecter.",
        description: "Aucun cookie de session (chatbot_session_token) reçu par le proxy /api/backend.",
        timestamp: new Date().toISOString(),
        infoURL: "",
      },
      { status: 401 }
    );
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  const contentType = req.headers.get("content-type");
  if (contentType) headers["Content-Type"] = contentType;
  if (APPLICATION_ID) headers["x-application-id"] = APPLICATION_ID;
  if (token && !isLogin) {
    headers["x-user-claims"] = token;
    headers["Authorization"] = `Bearer ${token}`;
  }

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  let body = hasBody ? await req.text() : undefined;

  // AJOUTÉ 27/09/2026 (Boris : identifiants lisibles dans DevTools >
  // Payload) : le navigateur n'envoie plus que `{kid, payload}` chiffré
  // (voir lib/login-encrypt.ts). On déchiffre ICI, côté serveur, et seul
  // cet appel serveur -> backend porte `{username, password}` en clair.
  // Un login non chiffré est refusé.
  if (isLogin) {
    try {
      const credentials = decryptLoginPayload(body ? safeJsonParse(body) : undefined);
      body = JSON.stringify(credentials);
      headers["Content-Type"] = "application/json";
    } catch (err) {
      const message = err instanceof LoginDecryptError ? err.message : "Requête de connexion invalide.";
      return NextResponse.json(
        { code: 400, message, description: message, timestamp: new Date().toISOString(), infoURL: "" },
        { status: 400 }
      );
    }
  }
  const url = `${backendBaseUrl}/${targetPath}${req.nextUrl.search}`;

  let backendResponse: Response;
  try {
    backendResponse = await fetch(url, {
      method: req.method,
      headers,
      body: body || undefined,
      cache: "no-store",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Impossible de contacter le serveur.";

    return NextResponse.json(
      {
        code: 0,
        message,
        description: message,
        timestamp: new Date().toISOString(),
        infoURL: "",
      },
      { status: 502 }
    );
  }

  if (backendResponse.status === 204 || backendResponse.status === 205) {
    const res = new NextResponse(null, { status: backendResponse.status });
    if (isLogout) res.cookies.delete(SESSION_COOKIE_NAME);
    return res;
  }

  // Réponses BINAIRES (évolution "Gestion des tickets" du 19/09/2026 :
  // export Excel + impressions PDF, voir TicketController) -- ne JAMAIS les
  // faire passer par `.text()` + `JSON.parse`/`NextResponse.json` ci-dessous :
  // `.text()` décoderait les octets binaires en UTF-8 (les corrompant), et
  // `safeJsonParse` échouerait de toute façon sur un binaire, renvoyant
  // `{message: <texte corrompu>}` au lieu du fichier -- EXACTEMENT le bug
  // "Téléchargement de fichier corrompu" déjà rencontré une fois côté
  // backend (voir bugs.md) mais qui restait ouvert ICI, dans ce proxy
  // générique, pour tout nouvel endpoint binaire. On détecte via
  // `Content-Type` et on relaie les octets tels quels, avec les en-têtes
  // utiles au téléchargement (Content-Disposition, Content-Length).
  const responseContentType = backendResponse.headers.get("content-type") ?? "";
  const isBinaryResponse = !responseContentType.startsWith("application/json") && !responseContentType.startsWith("text/");
  if (isBinaryResponse) {
    const arrayBuffer = await backendResponse.arrayBuffer();
    const passthroughHeaders: Record<string, string> = { "Content-Type": responseContentType || "application/octet-stream" };
    const disposition = backendResponse.headers.get("content-disposition");
    if (disposition) passthroughHeaders["Content-Disposition"] = disposition;
    return new NextResponse(arrayBuffer, { status: backendResponse.status, headers: passthroughHeaders });
  }

  const text = await backendResponse.text();
  const data = text ? safeJsonParse(text) : undefined;

  if (isLogin && backendResponse.ok) {
    const loginToken = extractToken(data, backendResponse);
    if (!loginToken) {
      // `extractToken` n'a trouvé le jeton ni dans les champs habituels du
      // corps (`token`/`accessToken`/`jwt`) ni dans les en-têtes usuels
      // (`x-user-claims`/`x-auth-token`/`authorization`) : aucun cookie de
      // session n'est posé, donc TOUTE requête authentifiée suivante échoue
      // avec "No auth token" — y compris après un rechargement de page
      // (`GET /auth/user` échoue aussi, d'où le renvoi vers /login). On logue
      // ici, côté serveur (terminal `npm run dev`, jamais le navigateur), la
      // forme exacte de la réponse de connexion pour identifier où se trouve
      // réellement le jeton chez ce backend.
      console.warn(
        "[api/backend/auth/login] Aucun jeton trouvé dans la réponse de POST /auth/login.\n" +
          "Clés du corps de réponse:", Object.keys((data ?? {}) as Record<string, unknown>),
        "\nEn-têtes de réponse:", Object.fromEntries(backendResponse.headers.entries())
      );
    }

    // On ne renvoie jamais le jeton au navigateur, quel que soit le champ
    // sous lequel le backend l'a placé dans le corps de la réponse.
    const safeData = { ...((data ?? {}) as Record<string, unknown>) };
    delete safeData.token;
    delete safeData.accessToken;
    delete safeData.jwt;

    const res = NextResponse.json(safeData, { status: backendResponse.status });
    if (loginToken) {
      // CORRECTIF 26/09/2026 (Boris : "No auth token" sur toutes les requêtes
      // après connexion) :
      // 1. `secure` dépendait de NODE_ENV : avec `next build && next start`
      //    (NODE_ENV=production) servi en HTTP (IP / nom de machine, pas
      //    https), le navigateur REFUSE silencieusement un cookie `Secure` --
      //    le login "réussit" (la session arrive dans le JSON, Redux est
      //    rempli) mais aucune requête suivante ne porte le jeton. On se base
      //    désormais sur le protocole réel de la requête.
      // 2. Cookie posé directement sur la réponse renvoyée (plutôt que via
      //    `cookies().set()` puis un nouveau NextResponse), pour être sûr que
      //    l'en-tête Set-Cookie parte bien avec CETTE réponse.
      res.cookies.set(SESSION_COOKIE_NAME, loginToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: isHttpsRequest(req),
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      });
    }
    return res;
  }

  const res = NextResponse.json(data, { status: backendResponse.status });
  if (isLogout) {
    res.cookies.delete(SESSION_COOKIE_NAME);
  }
  return res;
}

/** true si le navigateur parle réellement en HTTPS (direct ou derrière un reverse-proxy). */
function isHttpsRequest(req: NextRequest): boolean {
  const forwarded = req.headers.get("x-forwarded-proto");
  if (forwarded) return forwarded.split(",")[0].trim() === "https";
  return req.nextUrl.protocol === "https:";
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function extractToken(data: unknown, response: Response): string | null {
  const body = (data ?? {}) as Record<string, unknown>;

  return (
    (typeof body.token === "string" && body.token) ||
    (typeof body.accessToken === "string" && body.accessToken) ||
    (typeof body.jwt === "string" && body.jwt) ||
    response.headers.get("x-user-claims") ||
    response.headers.get("x-auth-token") ||
    (response.headers.get("authorization") || "").replace(/^Bearer\s+/i, "") ||
    null
  );
}

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, { params }: RouteContext) {
  return proxy(req, (await params).path);
}
export async function POST(req: NextRequest, { params }: RouteContext) {
  return proxy(req, (await params).path);
}
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  return proxy(req, (await params).path);
}
export async function PUT(req: NextRequest, { params }: RouteContext) {
  return proxy(req, (await params).path);
}
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  return proxy(req, (await params).path);
}
