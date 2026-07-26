-- ═══════════════════════════════════════════════════════════════
-- Migration 242: action_template RLS permite templates globales (company_id IS NULL)
--
-- Problema: Los templates globales (company_id = NULL) como CIN
-- no eran visibles desde el cliente (anon key) porque la policy
-- `is_tenant_allowed(company_id)` retorna false cuando company_id es NULL.
-- Esto rompia `findCINTemplateForClaim` al cancelar/reagendar inspecciones:
--   "No se encontró el template CIN para este siniestro"
--
-- Solucion: La policy SELECT permite ver templates cuando
--   - company_id IS NULL (template global), O
--   - is_tenant_allowed(company_id) (template de la empresa del usuario)
--
-- No se modifican datos. Solo se actualiza la policy SELECT.
-- ═══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "action_template_tenant_select" ON action_template;
CREATE POLICY "action_template_tenant_select" ON action_template
  FOR SELECT TO authenticated
  USING (company_id IS NULL OR is_tenant_allowed(company_id));
