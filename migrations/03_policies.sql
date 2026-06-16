-- ============================================================
-- Hub Inspections — Migración Nhost/Hasura
-- Parte 3: RLS + Índices
-- ============================================================

-- ============================================================
-- Enable RLS (PostgreSQL nativo)
-- Nota: Los permisos detallados se configuran en Hasura Console
-- (Permissions tab) para el role "user" u otros roles de Hasura.
-- ============================================================
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_damages ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_evidences ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE magic_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- POLICIES: Allow all for postgres owner
-- Hasura accede como role "postgres" que es superuser,
-- por lo que RLS no afecta a Hasura por defecto.
-- Las restricciones de acceso se implementan vía Hasura Permissions.
-- ============================================================

-- ============================================================
-- INDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_claims_company_id ON claims(company_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);
CREATE INDEX IF NOT EXISTS idx_claims_assigned_adjuster ON claims(assigned_adjuster_id);
CREATE INDEX IF NOT EXISTS idx_inspection_sessions_claim_id ON inspection_sessions(claim_id);
CREATE INDEX IF NOT EXISTS idx_inspection_sessions_status ON inspection_sessions(status);
CREATE INDEX IF NOT EXISTS idx_inspection_sessions_magic_token ON inspection_sessions(magic_link_token);
CREATE INDEX IF NOT EXISTS idx_evidences_session_id ON inspection_evidences(session_id);
CREATE INDEX IF NOT EXISTS idx_evidences_claim_id ON inspection_evidences(claim_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id ON audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
