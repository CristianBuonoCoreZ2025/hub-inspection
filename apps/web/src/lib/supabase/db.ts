import { getSupabaseClient } from "./client";
import { logger } from "@/lib/logger";
import { startMeasure } from "@/lib/perf-metrics";

/**
 * Capa de datos unificada para reemplazar graphqlRequest.
 * Todos los services usan estas funciones para acceder a Supabase.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = Record<string, any>;

/**
 * SELECT una fila por ID (equivalente a table_by_pk)
 */
export async function fetchById<T = AnyObj>(
  table: string,
  id: string,
  select = "*"
): Promise<T | null> {
  const end = startMeasure(table, "select_one");
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    end({ success: true, rowsAffected: data ? 1 : 0 });
    return (data as T) ?? null;
  } catch (err) {
    end({ success: false, errorMessage: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

/**
 * SELECT múltiples filas con filtros opcionales
 */
export async function fetchAll<T = AnyObj>(
  table: string,
  options?: {
    select?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    eq?: Record<string, any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    in?: Record<string, any[]>;
    order?: { column: string; ascending?: boolean };
    limit?: number;
    range?: { from: number; to: number };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    neq?: Record<string, any>;
    ilike?: Record<string, string>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    gte?: Record<string, any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    lte?: Record<string, any>;
    is?: Record<string, boolean | null>;
    single?: boolean;
  }
): Promise<T[]> {
  const supabase = getSupabaseClient();
  let query = supabase.from(table).select(options?.select ?? "*");

  if (options?.eq) {
    for (const [k, v] of Object.entries(options.eq)) {
      query = query.eq(k, v);
    }
  }
  if (options?.neq) {
    for (const [k, v] of Object.entries(options.neq)) {
      query = query.neq(k, v);
    }
  }
  if (options?.in) {
    for (const [k, v] of Object.entries(options.in)) {
      query = query.in(k, v);
    }
  }
  if (options?.ilike) {
    for (const [k, v] of Object.entries(options.ilike)) {
      query = query.ilike(k, v);
    }
  }
  if (options?.gte) {
    for (const [k, v] of Object.entries(options.gte)) {
      query = query.gte(k, v);
    }
  }
  if (options?.lte) {
    for (const [k, v] of Object.entries(options.lte)) {
      query = query.lte(k, v);
    }
  }
  if (options?.is) {
    for (const [k, v] of Object.entries(options.is)) {
      query = query.is(k, v);
    }
  }
  if (options?.order) {
    query = query.order(options.order.column, {
      ascending: options.order.ascending ?? true,
    });
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }
  if (options?.range) {
    query = query.range(options.range.from, options.range.to);
  }
  if (options?.single) {
    const end = startMeasure(table, "select_all");
    try {
      const { data, error } = await query.maybeSingle();
      if (error) throw new Error(error.message);
      end({ success: true, rowsAffected: data ? 1 : 0 });
      return [data as T];
    } catch (err) {
      end({ success: false, errorMessage: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  }

  const end = startMeasure(table, "select_all");
  try {
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    end({ success: true, rowsAffected: data?.length ?? 0 });
    return (data as T[]) ?? [];
  } catch (err) {
    end({ success: false, errorMessage: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

/**
 * INSERT una fila (equivalente a insert_table_one)
 */
export async function insertRow<T = AnyObj>(
  table: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  row: Record<string, any>,
  select = "*"
): Promise<T> {
  const end = startMeasure(table, "insert");
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from(table)
      .insert(row)
      .select(select)
      .single();
    if (error) {
      logger.error(`Insert error on ${table}`, new Error(error.message), {
        component: "db.insertRow",
        action: `insert.${table}`,
        metadata: { error: error.message, details: error.details },
      });
      throw new Error(error.message);
    }
    end({ success: true, rowsAffected: 1 });
    return data as T;
  } catch (err) {
    end({ success: false, errorMessage: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

/**
 * INSERT múltiples filas
 */
export async function insertMany<T = AnyObj>(
  table: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows: Record<string, any>[],
  select = "*"
): Promise<T[]> {
  const end = startMeasure(table, "insert");
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from(table)
      .insert(rows)
      .select(select);
    if (error) throw new Error(error.message);
    end({ success: true, rowsAffected: data?.length ?? rows.length });
    return (data as T[]) ?? [];
  } catch (err) {
    end({ success: false, errorMessage: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

/**
 * UPSERT múltiples filas (INSERT ... ON CONFLICT DO UPDATE/NOTHING)
 */
export async function upsertMany<T = AnyObj>(
  table: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows: Record<string, any>[],
  options?: { onConflict?: string; ignoreDuplicates?: boolean; select?: string }
): Promise<T[]> {
  const end = startMeasure(table, "upsert");
  try {
    const supabase = getSupabaseClient();
    let query = supabase.from(table).upsert(rows, {
      onConflict: options?.onConflict,
      ignoreDuplicates: options?.ignoreDuplicates ?? true,
    });
    if (options?.select) query = query.select(options.select);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    end({ success: true, rowsAffected: data?.length ?? rows.length });
    return (data as T[]) ?? [];
  } catch (err) {
    end({ success: false, errorMessage: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

/**
 * UPDATE una fila por ID (equivalente a update_table_by_pk)
 */
export async function updateRow<T = AnyObj>(
  table: string,
  id: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  set: Record<string, any>,
  select = "*"
): Promise<T> {
  const end = startMeasure(table, "update");
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from(table)
      .update(set)
      .eq("id", id)
      .select(select)
      .single();
    if (error) {
      logger.error(`Update error on ${table}`, new Error(error.message), {
        component: "db.updateRow",
        action: `update.${table}`,
        metadata: { error: error.message, id },
      });
      throw new Error(error.message);
    }
    end({ success: true, rowsAffected: 1 });
    return data as T;
  } catch (err) {
    end({ success: false, errorMessage: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

/**
 * UPDATE con filtros custom
 */
export async function updateWhere<T = AnyObj>(
  table: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  set: Record<string, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filters: Record<string, any>,
  select = "*"
): Promise<T[]> {
  const end = startMeasure(table, "update");
  try {
    const supabase = getSupabaseClient();
    let query = supabase.from(table).update(set);
    for (const [k, v] of Object.entries(filters)) {
      query = query.eq(k, v);
    }
    const { data, error } = await query.select(select);
    if (error) throw new Error(error.message);
    end({ success: true, rowsAffected: data?.length ?? 0 });
    return (data as T[]) ?? [];
  } catch (err) {
    end({ success: false, errorMessage: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

/**
 * DELETE una fila por ID (equivalente a delete_table_by_pk)
 */
export async function deleteRow<T = AnyObj>(
  table: string,
  id: string,
  select = "*"
): Promise<T | null> {
  const end = startMeasure(table, "delete");
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from(table)
      .delete()
      .eq("id", id)
      .select(select)
      .maybeSingle();
    if (error) throw new Error(error.message);
    end({ success: true, rowsAffected: data ? 1 : 0 });
    return (data as T) ?? null;
  } catch (err) {
    end({ success: false, errorMessage: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

/**
 * DELETE con filtros custom
 */
export async function deleteWhere(
  table: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filters: Record<string, any>
): Promise<void> {
  const end = startMeasure(table, "delete");
  try {
    const supabase = getSupabaseClient();
    let query = supabase.from(table).delete();
    for (const [k, v] of Object.entries(filters)) {
      query = query.eq(k, v);
    }
    const { error } = await query;
    if (error) throw new Error(error.message);
    end({ success: true });
  } catch (err) {
    end({ success: false, errorMessage: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

/**
 * COUNT filas con filtros opcionales
 */
export async function countRows(
  table: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filters?: Record<string, any>
): Promise<number> {
  const supabase = getSupabaseClient();
  let query = supabase
    .from(table)
    .select("*", { count: "exact", head: true });
  if (filters) {
    for (const [k, v] of Object.entries(filters)) {
      query = query.eq(k, v);
    }
  }
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/**
 * Ejecutar una función RPC (stored procedure)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function rpc<T = any>(fn: string, args?: Record<string, any>): Promise<T> {
  const end = startMeasure(fn, "rpc");
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc(fn, args);
    if (error) throw new Error(error.message);
    end({ success: true });
    return data as T;
  } catch (err) {
    end({ success: false, errorMessage: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

/**
 * Cliente Supabase crudo para queries complejas que no cubren los helpers.
 */
export { getSupabaseClient };
