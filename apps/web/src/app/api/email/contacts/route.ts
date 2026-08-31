import { NextRequest, NextResponse } from "next/server";
import { getClaimContacts } from "@/services/email-contacts";

/**
 * GET /api/email/contacts?claimId=xxx
 *
 * Devuelve la libreta de contactos para un siniestro:
 *  - Participantes (asegurado, beneficiario, contratista, contacto)
 *  - Equipo (liquidador, inspector, asistente, auditor, despachador)
 *  - Asesor
 *  - Directorio global (todos los usuarios del sistema)
 *
 * Deduplicado por email con roles combinados.
 */
export async function GET(req: NextRequest) {
  const claimId = req.nextUrl.searchParams.get("claimId");
  if (!claimId) {
    return NextResponse.json({ error: "claimId required" }, { status: 400 });
  }
  try {
    const contacts = await getClaimContacts(claimId);
    return NextResponse.json({ contacts });
  } catch (err) {
    console.error("[email-contacts] error:", err);
    return NextResponse.json({ error: "Failed to fetch contacts" }, { status: 500 });
  }
}
