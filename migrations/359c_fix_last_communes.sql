-- ============================================================
-- Hub Inspections — Migracion 359c: Fix últimas comunas
-- ============================================================

-- Concon → Concón
UPDATE claims_participants SET commune = 'Concón', updated_at = NOW()
WHERE commune = 'Concon';

-- Chillan Viejo → Chillán Viejo
UPDATE claims_participants SET commune = 'Chillán Viejo', updated_at = NOW()
WHERE commune = 'Chillan Viejo';

-- CON-CON / CON CON → Concón
UPDATE claims_participants SET commune = 'Concón', updated_at = NOW()
WHERE commune IN ('CON-CON', 'CON CON');

-- LLAILLAY → Llay Llay
UPDATE claims_participants SET commune = 'Llay Llay', updated_at = NOW()
WHERE commune = 'LLAILLAY';

-- Rinconada de Los Andes → Rinconada
UPDATE claims_participants SET commune = 'Rinconada', updated_at = NOW()
WHERE commune = 'Rinconada de Los Andes';
