-- ═══════════════════════════════════════════════════════════════
-- Migration 268: Fix RLS UPDATE de action_template para company_id NULL
--
-- Problema: las 38 gestiones (action_template) tienen company_id = NULL
-- (son globales). La política UPDATE era is_tenant_allowed(company_id)
-- que devuelve false para NULL. Nadie podía editar gestiones.
--
-- Fix: permitir UPDATE cuando company_id IS NULL (igual que SELECT).
-- El control de permisos lo hace requirePermission("catalogos", "edit")
-- en la server action, no la RLS.
-- ═══════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'action_template' AND column_name = 'company_id'
  ) THEN
    DROP POLICY IF EXISTS action_template_tenant_update ON action_template;
    CREATE POLICY action_template_tenant_update ON action_template
      FOR UPDATE
      USING ((company_id IS NULL) OR is_tenant_allowed(company_id))
      WITH CHECK ((company_id IS NULL) OR is_tenant_allowed(company_id));
  END IF;
END $$;
