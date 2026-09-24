import "server-only";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/server/backend-client";

/**
 * Expose le JWT de session — stocké dans un cookie httpOnly, donc
 * normalement invisible au JavaScript du navigateur — pour un seul usage
 * précis : ouvrir le handshake de la connexion socket.io du chat (voir
 * `lib/socket/socket-service.ts`).
 *
 * Le backend chatbot-backend authentifie ses WebSockets avec un jeton
 * explicite (`auth: { token }`), pas avec un cookie : c'est donc la seule
 * route de cette application où le JWT transite en clair vers le
 * navigateur, et uniquement à la demande (jamais persisté en
 * `localStorage`, récupéré juste avant chaque (re)connexion socket).
 */
export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;

  if (!token) {
    return NextResponse.json({ token: null }, { status: 401 });
  }

  return NextResponse.json({ token });
}
