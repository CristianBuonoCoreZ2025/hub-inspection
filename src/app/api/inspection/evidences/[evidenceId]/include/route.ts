import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ evidenceId: string }> }
) {
  try {
    const { evidenceId } = await params;
    const body = await request.json();
    const includeInReport = typeof body.include_in_report === "boolean" ? body.include_in_report : null;

    if (includeInReport === null) {
      return NextResponse.json({ error: "Falta include_in_report" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("inspection_evidences")
      .update({ include_in_report: includeInReport })
      .eq("id", evidenceId)
      .select("id, include_in_report")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message || "No se pudo actualizar" }, { status: 500 });
    }

    return NextResponse.json({ success: true, evidence: data });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
