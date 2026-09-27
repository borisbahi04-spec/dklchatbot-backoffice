import { NextResponse } from "next/server";
import { issueLoginChallenge } from "@/lib/server/login-crypto";

/**
 * `GET /api/auth/login-key` -- clé publique RSA + nonce à usage unique pour
 * chiffrer les identifiants avant `POST /api/backend/auth/login` (demande
 * de Boris, 27/09/2026 : identifiants illisibles dans l'inspecteur). Voir
 * `lib/server/login-crypto.ts`.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(issueLoginChallenge(), {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
