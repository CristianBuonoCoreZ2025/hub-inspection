-- ============================================================
-- Hub Inspections — Migración Nhost/Hasura
-- Parte 2: Triggers
-- ============================================================

-- ============================================================
-- Triggers updated_at
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

-- ============================================================
-- Trigger: crear perfil al registrar usuario
-- ============================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
