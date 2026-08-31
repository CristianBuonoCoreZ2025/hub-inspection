-- Migración 363b: Agregar FK de inspector_group_members.inspector_id a profiles.id
-- Sin esta FK, PostgREST no puede hacer el join para traer el nombre del inspector.

ALTER TABLE inspector_group_members
  ADD CONSTRAINT inspector_group_members_inspector_id_fkey
  FOREIGN KEY (inspector_id) REFERENCES profiles(id) ON DELETE CASCADE;
