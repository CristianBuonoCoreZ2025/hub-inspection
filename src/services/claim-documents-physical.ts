import { fetchAll, insertRow, updateRow } from "@/lib/supabase/db";

// ═══════════════════════════════════════════════════════════════
// Documentos físicos del siniestro (claim_documents)
// ═══════════════════════════════════════════════════════════════

export interface ClaimDocument {
  id: string;
  claim_id: string;
  document_name: string;
  document_url: string | null;
  document_type: string | null;
  file_size: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const DOCUMENT_FIELDS =
  "id, claim_id, document_name, document_url, document_type, file_size, is_active, created_at, updated_at";

export async function getClaimDocuments(claimId: string): Promise<ClaimDocument[]> {
  return fetchAll<ClaimDocument>("claim_documents", {
    select: DOCUMENT_FIELDS,
    eq: { claim_id: claimId, is_active: true },
    order: { column: "created_at", ascending: false },
  });
}

export async function createClaimDocument(input: {
  claim_id: string;
  document_name: string;
  document_url: string;
  document_type?: string;
  file_size?: number;
}): Promise<ClaimDocument> {
  return insertRow<ClaimDocument>(
    "claim_documents",
    {
      claim_id: input.claim_id,
      document_name: input.document_name,
      document_url: input.document_url,
      document_type: input.document_type || null,
      file_size: input.file_size || null,
      is_active: true,
    },
    DOCUMENT_FIELDS
  );
}

export async function deactivateClaimDocument(id: string): Promise<void> {
  await updateRow("claim_documents", id, { is_active: false });
}
