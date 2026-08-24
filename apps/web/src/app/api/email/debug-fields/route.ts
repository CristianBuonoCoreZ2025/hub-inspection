import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { buildDocumentDataForClaim } from "@/services/document-data";
import { buildTemplateData, DOCUMENT_FIELDS } from "@/lib/document-fields";

export async function GET(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const claimId = new URL(request.url).searchParams.get("claimId");
  if (!claimId) {
    return NextResponse.json({ error: "Falta claimId" }, { status: 400 });
  }

  try {
    const docData = await buildDocumentDataForClaim(claimId, supabase);
    const templateData = buildTemplateData(docData, {});

    const fields = DOCUMENT_FIELDS.map((f) => ({
      key: f.key,
      label: f.label,
      group: f.group,
      value: templateData[f.key] ?? "",
      empty: !templateData[f.key],
    }));

    const emptyFields = fields.filter((f) => f.empty);
    const filledFields = fields.filter((f) => !f.empty);

    return NextResponse.json({
      claimId,
      total: fields.length,
      filled: filledFields.length,
      empty: emptyFields.length,
      fields,
      emptyFields: emptyFields.map((f) => `${f.group}: <${f.key}> [${f.label}]`),
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
