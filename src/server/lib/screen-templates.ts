import "server-only";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Dado un claim_action_id, determina si la pantalla asociada a la gestión
 * soporta flujo de plantillas de documento (.docx).
 *
 * La cadena es:
 *   claim_actions → action_template → action_features → screen_id → gestion_screens.form_schema
 *
 * Una pantalla soporta templates si su form_schema tiene al menos un campo
 * con type === "document_templates".
 *
 * Esta validación se usa en las rutas de generate-document y convert-to-pdf
 * para impedir que se generen/conviertan PDFs en gestiones cuya pantalla
 * no tiene flujo de templates (por ejemplo, coordinación de inspección).
 */
export async function actionSupportsDocumentTemplates(actionId: string): Promise<boolean> {
  const supabase = createAdminClient();

  // 1. claim_actions → action_template → action_features_id
  const { data: action, error: actionError } = await supabase
    .from("claim_actions")
    .select("id, action_template:action_template!claim_actions_action_template_id_fkey(action_features_id)")
    .eq("id", actionId)
    .maybeSingle();

  if (actionError || !action) return false;

  const actionTemplate = (action as Record<string, unknown>)?.action_template as { action_features_id?: string | null } | null;
  const featureId = actionTemplate?.action_features_id;
  if (!featureId) return false;

  // 2. action_features → screen_id → gestion_screens.form_schema
  const { data: feature, error: featureError } = await supabase
    .from("action_features")
    .select("id, screen_id, screen:gestion_screens!action_features_screen_id_fkey(form_schema)")
    .eq("id", featureId)
    .maybeSingle();

  if (featureError || !feature) return false;

  const screen = (feature as Record<string, unknown>)?.screen as { form_schema?: Record<string, unknown> | null } | null | undefined;
  const formSchema = screen?.form_schema;
  if (!formSchema) return false;
  const fields = Array.isArray(formSchema.fields) ? formSchema.fields : [];
  return fields.some((f) => (f as { type?: string }).type === "document_templates");
}
