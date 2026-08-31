import { fetchAll, fetchById, insertRow, updateRow } from "@/lib/supabase/db";
import type { AiPrompt } from "@/types";

// ═══════════════════════════════════════════════════════════════
// Servicio para prompts de IA configurables por línea de negocio.
// Tabla: ai_prompts
// ═══════════════════════════════════════════════════════════════

/**
 * Obtiene todos los prompts activos con el nombre de la línea de negocio.
 */
export async function getAiPrompts(): Promise<AiPrompt[]> {
  return fetchAll<AiPrompt>("ai_prompts", {
    select: "id, business_line_id, prompt_type, name, system_prompt, user_prompt, refinement_prompt, is_active, created_at, updated_at, business_line:business_lines(name)",
    eq: { is_active: true },
    order: { column: "prompt_type", ascending: true },
  });
}

/**
 * Obtiene un prompt por ID.
 */
export async function getAiPromptById(id: string): Promise<AiPrompt | null> {
  return fetchById<AiPrompt>("ai_prompts", id, "id, business_line_id, prompt_type, name, system_prompt, user_prompt, refinement_prompt, is_active, created_at, updated_at");
}

/**
 * Crea un nuevo prompt.
 */
export async function createAiPrompt(input: {
  business_line_id?: string | null;
  prompt_type: "image" | "document";
  name: string;
  system_prompt: string;
  user_prompt: string;
  refinement_prompt?: string | null;
}): Promise<AiPrompt> {
  return insertRow<AiPrompt>("ai_prompts", {
    ...input,
    is_active: true,
  }, "id, business_line_id, prompt_type, name, system_prompt, user_prompt, refinement_prompt, is_active, created_at, updated_at");
}

/**
 * Actualiza un prompt existente.
 */
export async function updateAiPrompt(id: string, input: Partial<{
  business_line_id: string | null;
  prompt_type: "image" | "document";
  name: string;
  system_prompt: string;
  user_prompt: string;
  refinement_prompt: string | null;
}>): Promise<AiPrompt> {
  return updateRow<AiPrompt>("ai_prompts", id, input, "id, business_line_id, prompt_type, name, system_prompt, user_prompt, refinement_prompt, is_active, created_at, updated_at");
}

/**
 * Desactiva un prompt (soft delete).
 */
export async function deleteAiPrompt(id: string): Promise<AiPrompt> {
  return updateRow<AiPrompt>("ai_prompts", id, { is_active: false }, "id, is_active");
}
