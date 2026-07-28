import { fetchAll, insertRow, updateRow } from "@/lib/supabase/db";

// ── Tipos ──
export interface ImportFieldMapping {
  id: string;
  company_id: string;
  excel_header: string;
  field_key: string;
  times_used: number;
  created_at: string;
  updated_at: string;
}

export interface ImportValueMapping {
  id: string;
  company_id: string;
  field_key: string;
  excel_value: string;
  catalog_uuid: string;
  times_used: number;
  created_at: string;
  updated_at: string;
}

// ── Field Mappings (excel_header → field_key) ──

export async function getImportFieldMappings(companyId: string): Promise<ImportFieldMapping[]> {
  return fetchAll<ImportFieldMapping>("import_field_mappings", {
    eq: { company_id: companyId },
    order: { column: "times_used", ascending: false },
  });
}

/**
 * Guarda o actualiza un mapeo de campo aprendido.
 * Si ya existe (company_id + excel_header), incrementa times_used.
 * Si no existe, lo crea con times_used = 1.
 */
export async function saveImportFieldMapping(
  companyId: string,
  excelHeader: string,
  fieldKey: string
): Promise<void> {
  const existing = await fetchAll<ImportFieldMapping>("import_field_mappings", {
    eq: { company_id: companyId, excel_header: excelHeader },
    limit: 1,
  });

  if (existing.length > 0) {
    // Ya existe: actualizar field_key (por si cambió) e incrementar times_used
    await updateRow<ImportFieldMapping>(
      "import_field_mappings",
      existing[0].id,
      {
        field_key: fieldKey,
        times_used: existing[0].times_used + 1,
      }
    );
  } else {
    // No existe: crear nuevo
    await insertRow<ImportFieldMapping>("import_field_mappings", {
      company_id: companyId,
      excel_header: excelHeader,
      field_key: fieldKey,
      times_used: 1,
    });
  }
}

/**
 * Guarda múltiples mapeos de campo en lote (batch).
 * Usa upsert lógico: si existe actualiza, si no crea.
 */
export async function saveImportFieldMappingsBatch(
  companyId: string,
  mappings: Array<{ excelHeader: string; fieldKey: string }>
): Promise<void> {
  // Cargar todos los existentes de esta empresa para no hacer N queries
  const existing = await fetchAll<ImportFieldMapping>("import_field_mappings", {
    eq: { company_id: companyId },
  });
  const existingMap = new Map(existing.map((m) => [m.excel_header, m]));

  for (const { excelHeader, fieldKey } of mappings) {
    const ex = existingMap.get(excelHeader);
    if (ex) {
      if (ex.field_key !== fieldKey || true) {
        // Actualizar (siempre incrementar times_used)
        await updateRow<ImportFieldMapping>("import_field_mappings", ex.id, {
          field_key: fieldKey,
          times_used: ex.times_used + 1,
        });
      }
    } else {
      await insertRow<ImportFieldMapping>("import_field_mappings", {
        company_id: companyId,
        excel_header: excelHeader,
        field_key: fieldKey,
        times_used: 1,
      });
    }
  }
}

// ── Value Mappings (excel_value → catalog_uuid) ──

export async function getImportValueMappings(companyId: string): Promise<ImportValueMapping[]> {
  return fetchAll<ImportValueMapping>("import_value_mappings", {
    eq: { company_id: companyId },
    order: { column: "times_used", ascending: false },
  });
}

/**
 * Guarda o actualiza un mapeo de valor aprendido.
 * Si ya existe (company_id + field_key + excel_value), incrementa times_used.
 * Si no existe, lo crea con times_used = 1.
 */
export async function saveImportValueMapping(
  companyId: string,
  fieldKey: string,
  excelValue: string,
  catalogUuid: string
): Promise<void> {
  const existing = await fetchAll<ImportValueMapping>("import_value_mappings", {
    eq: { company_id: companyId, field_key: fieldKey, excel_value: excelValue },
    limit: 1,
  });

  if (existing.length > 0) {
    await updateRow<ImportValueMapping>(
      "import_value_mappings",
      existing[0].id,
      {
        catalog_uuid: catalogUuid,
        times_used: existing[0].times_used + 1,
      }
    );
  } else {
    await insertRow<ImportValueMapping>("import_value_mappings", {
      company_id: companyId,
      field_key: fieldKey,
      excel_value: excelValue,
      catalog_uuid: catalogUuid,
      times_used: 1,
    });
  }
}

/**
 * Guarda múltiples mapeos de valor en lote (batch).
 */
export async function saveImportValueMappingsBatch(
  companyId: string,
  mappings: Array<{ fieldKey: string; excelValue: string; catalogUuid: string }>
): Promise<void> {
  const existing = await fetchAll<ImportValueMapping>("import_value_mappings", {
    eq: { company_id: companyId },
  });
  // Clave compuesta: field_key::excel_value
  const existingMap = new Map(existing.map((m) => [`${m.field_key}::${m.excel_value}`, m]));

  for (const { fieldKey, excelValue, catalogUuid } of mappings) {
    const key = `${fieldKey}::${excelValue}`;
    const ex = existingMap.get(key);
    if (ex) {
      await updateRow<ImportValueMapping>("import_value_mappings", ex.id, {
        catalog_uuid: catalogUuid,
        times_used: ex.times_used + 1,
      });
    } else {
      await insertRow<ImportValueMapping>("import_value_mappings", {
        company_id: companyId,
        field_key: fieldKey,
        excel_value: excelValue,
        catalog_uuid: catalogUuid,
        times_used: 1,
      });
    }
  }
}
