-- ═══════════════════════════════════════════════════════════════
-- Migration 318: Grants para user_type_data_access
--
-- La tabla user_type_data_access necesita permisos explícitos para
-- el rol authenticated, ya que fue creada sin los grants por defecto.
-- SIN borrar datos.
-- ═══════════════════════════════════════════════════════════════

GRANT SELECT, UPDATE ON TABLE user_type_data_access TO authenticated;
