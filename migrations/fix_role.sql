-- Verificar si la columna role acepta 'inspector'
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name = 'role';

-- Si el CHECK no incluye 'inspector', actualizar:
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('super_admin','admin','supervisor','adjuster','inspector','client'));
