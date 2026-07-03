-- ═══════════════════════════════════════════════════════════════
-- MIGRATION 67: User Types System
-- Reemplaza el sistema de roles por tipos de usuario con 
-- relación many-to-many entre usuarios y clientes (companies)
-- ═══════════════════════════════════════════════════════════════

-- 1. Actualizar CHECK constraint de profiles.role con nuevos tipos
--    internal        → Usuario interno (admin, ve todo)
--    adjuster        → Liquidador (depende de 1+ clientes, ve siniestros donde es ajustador)
--    inspector       → Inspector (depende de 1+ clientes, ve inspecciones donde es inspector)
--    client_operator → Operativo del cliente (depende de 1 cliente, solo vista)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('internal', 'adjuster', 'inspector', 'client_operator'));

-- 2. Migrar roles existentes a los nuevos tipos
UPDATE profiles SET role = 'internal' WHERE role IN ('super_admin', 'admin', 'supervisor');
UPDATE profiles SET role = 'client_operator' WHERE role = 'client';
-- adjuster e inspector se mantienen igual

-- 3. Crear tabla junction user_clients (many-to-many)
--    Permite que un liquidador o inspector esté asociado a múltiples clientes
CREATE TABLE IF NOT EXISTS user_clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, company_id)
);

-- 4. Migrar company_id existentes a user_clients
INSERT INTO user_clients (user_id, company_id)
SELECT user_id, company_id FROM profiles
WHERE company_id IS NOT NULL
ON CONFLICT (user_id, company_id) DO NOTHING;

-- 5. Índices para performance
CREATE INDEX IF NOT EXISTS idx_user_clients_user_id ON user_clients(user_id);
CREATE INDEX IF NOT EXISTS idx_user_clients_company_id ON user_clients(company_id);

-- 6. Trigger para updated_at (reutilizar función existente)
DROP TRIGGER IF EXISTS trg_user_clients_updated_at ON user_clients;
-- user_clients no tiene updated_at, no necesita trigger

-- 7. Comentarios
COMMENT ON TABLE user_clients IS 'Relación many-to-many entre usuarios y clientes (companies). Usada por liquidadores e inspectores que pueden pertenecer a múltiples clientes.';
COMMENT ON COLUMN user_clients.user_id IS 'ID del usuario en auth.users (mapeado via profiles.user_id)';
COMMENT ON COLUMN user_clients.company_id IS 'ID de la empresa/cliente';

-- 8. Fix trigger handle_new_user: Nhost usa 'metadata' no 'raw_user_meta_data' (Supabase)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_company_id UUID;
  v_role TEXT;
BEGIN
  v_company_id := NULLIF(NEW.metadata->>'company_id', '')::UUID;
  v_role := COALESCE(NEW.metadata->>'role', 'adjuster');

  INSERT INTO public.profiles (user_id, email, full_name, role, company_id)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.metadata->>'full_name',
    v_role,
    v_company_id
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    company_id = EXCLUDED.company_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
