-- ═══════════════════════════════════════════════════════════════
-- Migration 223: Permite que usuarios internal vean siniestros
-- de las compañías asignadas en user_clients.
--
-- Los roles externos (adjuster, inspector, etc.) ya usan user_clients.
-- Ahora los usuarios internal/admin también pueden tener múltiples
-- compañías asignadas, por lo que se amplía la política SELECT de
-- claims y audit_logs para considerar user_clients.
-- ═══════════════════════════════════════════════════════════════

-- Permite ver claims asociados a cualquiera de las compañías del usuario
DROP POLICY IF EXISTS claims_select_user_clients ON claims;
CREATE POLICY claims_select_user_clients ON claims FOR SELECT TO authenticated
  USING (
    company_id IN (SELECT company_id FROM user_clients WHERE user_id = auth.uid())
    OR company_id = (SELECT company_id FROM profiles WHERE user_id = auth.uid())
  );

-- Permite ver audit_logs de las compañías del usuario
DROP POLICY IF EXISTS audit_logs_select_user_clients ON audit_logs;
CREATE POLICY audit_logs_select_user_clients ON audit_logs FOR SELECT TO authenticated
  USING (
    company_id IN (SELECT company_id FROM user_clients WHERE user_id = auth.uid())
    OR company_id = (SELECT company_id FROM profiles WHERE user_id = auth.uid())
  );
