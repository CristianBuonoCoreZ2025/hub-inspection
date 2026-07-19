import { fetchAll, insertRow } from "@/lib/supabase/db";

// ═══════════════════════════════════════════════════════════════
// Documentos físicos del siniestro (claim_documents)
// ═══════════════════════════════════════════════════════════════

export interface ClaimDocument {
  id: string;
  claim_id: string;
  doc_code: string | null;
  document_name: string;
  document_url: string | null;
  document_type: string | null;
  original_filename: string | null;
  mime_type: string | null;
  file_size: number | null;
  file_path: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const DOCUMENT_FIELDS =
  "id, claim_id, doc_code, document_name, document_url, document_type, original_filename, mime_type, file_size, file_path, is_active, created_at, updated_at";

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

export async function deleteClaimDocument(id: string, reason?: string): Promise<void> {
  const res = await fetch(`/api/claims/documents/${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason: reason || null }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Error al eliminar documento");
  }
}
