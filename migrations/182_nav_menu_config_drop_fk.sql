-- ═══════════════════════════════════════════════════════════════
-- 182: Eliminar FK de nav_menu_config.updated_by → profiles(id)
--
-- El user.id del JWT de Supabase Auth no siempre coincide con un
-- profile existente (puede ser un usuario recién creado o un
-- servicio técnico). La FK causaba errores al guardar la config
-- del menú. Se elimina la restricción y el campo queda como
-- metadata opcional (la auditoría real la hace el logger server-side).
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE nav_menu_config
  DROP CONSTRAINT IF EXISTS nav_menu_config_updated_by_fkey;
