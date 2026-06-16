-- ============================================================
-- Hub Inspections — Setup para Nhost Hasura (ejecutar en Hasura Console → Data → SQL)
-- ============================================================

-- 1. EXTENSION
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. COMPANIES
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  rut TEXT UNIQUE,
  address TEXT,
  phone TEXT,
  email TEXT,
  logo_url TEXT,
  primary_color TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE companies IS 'Empresas tenant del sistema';

-- 3. PROFILES
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'adjuster' CHECK (role IN ('super_admin','admin','supervisor','adjuster','inspector','client')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE profiles IS 'Perfiles de usuarios con roles y tenant';

-- 4. CLAIMS (SINIESTROS)
CREATE TABLE IF NOT EXISTS claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  claim_number TEXT NOT NULL,
  policy_number TEXT NOT NULL,
  insurance_company TEXT,
  insured_name TEXT NOT NULL,
  insured_email TEXT,
  insured_phone TEXT,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  claim_date DATE NOT NULL,
  claim_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created','scheduled','in_progress','pending_info','in_review','signed','closed')),
  assigned_adjuster_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE claims IS 'Siniestros registrados vinculados a empresa';

-- 5. INSPECTION SESSIONS
CREATE TABLE IF NOT EXISTS inspection_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  magic_link_token TEXT UNIQUE,
  magic_link_expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','completed','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. INSPECTION CHECKLISTS
CREATE TABLE IF NOT EXISTS inspection_checklists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES inspection_sessions(id) ON DELETE CASCADE,
  area TEXT NOT NULL,
  item TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('reviewed','pending','not_applicable')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. INSPECTION DAMAGES
CREATE TABLE IF NOT EXISTS inspection_damages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES inspection_sessions(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  subcategory TEXT,
  description TEXT NOT NULL,
  observations TEXT,
  severity TEXT NOT NULL CHECK (severity IN ('low','medium','high','total')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. INSPECTION EVIDENCES
CREATE TABLE IF NOT EXISTS inspection_evidences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES inspection_sessions(id) ON DELETE CASCADE,
  claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('photo','video','pdf','document')),
  captured_by UUID REFERENCES profiles(id),
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. INSPECTION NOTES
CREATE TABLE IF NOT EXISTS inspection_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES inspection_sessions(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id),
  content TEXT NOT NULL,
  is_private BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. INSPECTION SIGNATURES
CREATE TABLE IF NOT EXISTS inspection_signatures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES inspection_sessions(id) ON DELETE CASCADE,
  signer_id UUID REFERENCES profiles(id),
  signer_role TEXT NOT NULL CHECK (signer_role IN ('insured','adjuster')),
  signature_data TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  device_info TEXT,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. INSPECTION REPORTS
CREATE TABLE IF NOT EXISTS inspection_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES inspection_sessions(id) ON DELETE CASCADE,
  claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  report_url TEXT NOT NULL,
  generated_by UUID REFERENCES profiles(id),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. MAGIC LINKS
CREATE TABLE IF NOT EXISTS magic_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token TEXT NOT NULL UNIQUE,
  claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  used_by_ip INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  old_data JSONB,
  new_data JSONB,
  performed_by UUID REFERENCES profiles(id),
  company_id UUID REFERENCES companies(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- FUNCTION: updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TRIGGERS updated_at (tablas publicas)
-- ============================================================
DROP TRIGGER IF EXISTS companies_updated_at ON companies;
CREATE TRIGGER companies_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS claims_updated_at ON claims;
CREATE TRIGGER claims_updated_at BEFORE UPDATE ON claims
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS inspection_sessions_updated_at ON inspection_sessions;
CREATE TRIGGER inspection_sessions_updated_at BEFORE UPDATE ON inspection_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS inspection_checklists_updated_at ON inspection_checklists;
CREATE TRIGGER inspection_checklists_updated_at BEFORE UPDATE ON inspection_checklists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS inspection_damages_updated_at ON inspection_damages;
CREATE TRIGGER inspection_damages_updated_at BEFORE UPDATE ON inspection_damages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS inspection_notes_updated_at ON inspection_notes;
CREATE TRIGGER inspection_notes_updated_at BEFORE UPDATE ON inspection_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
