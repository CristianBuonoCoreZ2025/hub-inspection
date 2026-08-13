-- Migración 100b: Agregar GRANT SELECT para anon en user_type_data_access
-- Esto permite que el cliente anónimo (antes del login) pueda leer la tabla
-- para hacer el join en la query del login.
-- La política RLS ya permite SELECT a todos (using_expr = true).

GRANT SELECT ON user_type_data_access TO anon;
