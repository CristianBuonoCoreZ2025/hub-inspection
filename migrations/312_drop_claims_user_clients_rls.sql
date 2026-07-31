-- ═══════════════════════════════════════════════════════════════
-- Migration 312: Eliminar política claims_select_user_clients
--
-- La política anterior permitía a un usuario ver TODOS los siniestros
-- de las compañías que tenía asignadas en user_clients. Con el nuevo
-- modelo de acceso, un usuario solo debe ver los siniestros donde está
-- asignado en uno de los roles (assigned_adjuster, adjuster, inspector,
-- dispatcher, auditor, assistant) o ser internal.
--
-- claims_accessible_select (basada en is_claim_accessible) ya cubre
-- el acceso correcto. Esta política sobrante causaba que inspectores,
-- liquidadores, etc., vieran todos los casos de su compañía.
-- SIN borrar datos.
-- ═══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "claims_select_user_clients" ON claims;
