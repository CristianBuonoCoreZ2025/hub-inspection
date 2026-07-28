-- ═══════════════════════════════════════════════════════════════
-- Migration 267: Dropear constraint viejo de policies
--
-- El constraint idx_policies_number_company (policy_number, insurance_company_id)
-- impedía tener múltiples items para la misma póliza + cia.
-- El nuevo constraint uq_policies_company_number_cia_item ya incluye policy_item.
-- ═══════════════════════════════════════════════════════════════

DROP INDEX IF EXISTS idx_policies_number_company;
