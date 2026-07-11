-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN 113: Sistema completo de gestiones por línea de negocio
--
-- 1. Agregar code_letter a business_lines (para codificación)
-- 2. Corregir códigos duplicados en action_template (únicos 3 letras)
-- 3. Duplicar todas las plantillas para línea Hogar
-- 4. Duplicar action_template_claim_status para plantillas Hogar
-- 5. Crear trigger para código automático de claim_actions
--    Formato: {liquidation_number}-{line_letter}-{template_code}-{seq:3}
--    Ejemplo: L-000000013-H-COB-001
-- 6. Backfill de claim_actions existentes
-- ═══════════════════════════════════════════════════════════════

-- ═══ 1. Agregar code_letter a business_lines ═══
ALTER TABLE business_lines
  ADD COLUMN IF NOT EXISTS code_letter text;

COMMENT ON COLUMN business_lines.code_letter IS 'Letra identificadora de la línea de negocio para codificación de gestiones. Ej: C=Comercial, H=Hogar.';

-- Asignar letras según el nombre
UPDATE business_lines SET code_letter = CASE
  WHEN name ILIKE '%comercial%' THEN 'C'
  WHEN name ILIKE '%hogar%' THEN 'H'
  WHEN name ILIKE '%responsabilidad%' THEN 'R'
  WHEN name ILIKE '%transporte%' THEN 'T'
  WHEN name ILIKE '%vida%' THEN 'V'
  ELSE UPPER(LEFT(name, 1))
END WHERE code_letter IS NULL;

-- ═══ 2. Corregir códigos duplicados en action_template ═══
-- Hacer todos los códigos únicos de 3 letras
UPDATE action_template SET code = CASE
  WHEN id = 'b2000001-0000-0000-0000-000000000001' THEN 'COI'  -- Coordinación de Inspección (era A)
  WHEN id = 'b2000001-0000-0000-0000-000000000002' THEN 'INS'  -- Inspección (era B)
  WHEN id = 'b2000001-0000-0000-0000-000000000003' THEN 'NSA'  -- Notificación y Solicitud de Antecedentes (era AA)
  WHEN id = 'b2000001-0000-0000-0000-000000000004' THEN 'COB'  -- Ingreso de Coberturas (era B, duplicado)
  WHEN id = 'b2000001-0000-0000-0000-000000000005' THEN 'RES'  -- Reserva (era R)
  WHEN id = 'b2000001-0000-0000-0000-000000000006' THEN 'PCA'  -- Planilla Cuadro de Ajuste
  WHEN id = 'b2000001-0000-0000-0000-000000000007' THEN 'IFL'  -- Informe de Liquidación
  WHEN id = 'b2000001-0000-0000-0000-000000000008' THEN 'RIN'  -- Registro de Indemnización (era Z, duplicado)
  WHEN id = 'b2000001-0000-0000-0000-000000000009' THEN 'AAS'  -- Aviso de Asignación (era Z, duplicado)
  WHEN id = 'b2000001-0000-0000-0000-000000000010' THEN 'RTA'  -- Recepción Total de Antecedentes (era R, duplicado)
  WHEN id = 'b2000001-0000-0000-0000-000000000011' THEN 'CAS'  -- Contacto Asegurado (era ZA)
  WHEN id = 'b2000001-0000-0000-0000-000000000012' THEN 'CCR'  -- Cierre de carpeta (era C)
  WHEN id = 'b2000001-0000-0000-0000-000000000013' THEN 'REA'  -- Reapertura
  WHEN id = 'b2000001-0000-0000-0000-000000000014' THEN 'DES'  -- Solicitud de Despacho
  WHEN id = 'b2000001-0000-0000-0000-000000000015' THEN 'IMP'  -- Impugnación Asegurado
  WHEN id = 'b2000001-0000-0000-0000-000000000016' THEN 'RIA'  -- Respuesta de Impugnación
  WHEN id = 'b2000001-0000-0000-0000-000000000017' THEN 'PRO'  -- Prórroga
  WHEN id = 'b2000001-0000-0000-0000-000000000018' THEN 'CPA'  -- Carta Propuesta al Asegurado
  WHEN id = 'b2000001-0000-0000-0000-000000000019' THEN 'OBS'  -- Observación (era O)
  ELSE code
END
WHERE id IN (
  'b2000001-0000-0000-0000-000000000001', 'b2000001-0000-0000-0000-000000000002',
  'b2000001-0000-0000-0000-000000000003', 'b2000001-0000-0000-0000-000000000004',
  'b2000001-0000-0000-0000-000000000005', 'b2000001-0000-0000-0000-000000000006',
  'b2000001-0000-0000-0000-000000000007', 'b2000001-0000-0000-0000-000000000008',
  'b2000001-0000-0000-0000-000000000009', 'b2000001-0000-0000-0000-000000000010',
  'b2000001-0000-0000-0000-000000000011', 'b2000001-0000-0000-0000-000000000012',
  'b2000001-0000-0000-0000-000000000013', 'b2000001-0000-0000-0000-000000000014',
  'b2000001-0000-0000-0000-000000000015', 'b2000001-0000-0000-0000-000000000016',
  'b2000001-0000-0000-0000-000000000017', 'b2000001-0000-0000-0000-000000000018',
  'b2000001-0000-0000-0000-000000000019'
);

-- ═══ 3. Duplicar todas las plantillas para línea Hogar ═══
-- UUID base para Hogar: b2000002-0000-0000-0000-0000000000XX
-- Copiar todas las plantillas de Comercial a Hogar

INSERT INTO action_template (
  id, action_type_id, action_features_id, line_business_id,
  name, description, is_blocker, is_review_applicable, is_approval_applicable,
  days_to_issue, days_to_alert_to_issue, is_dispatch_applicable,
  issuer_role, code, sort_order, is_active
)
SELECT
  ('b2000002-0000-0000-0000-0000000000' || LPAD((ROW_NUMBER() OVER (ORDER BY sort_order))::text, 2, '0'))::uuid,
  action_type_id,
  action_features_id,
  (SELECT id FROM business_lines WHERE name ILIKE '%hogar%' LIMIT 1),
  name, description, is_blocker, is_review_applicable, is_approval_applicable,
  days_to_issue, days_to_alert_to_issue, is_dispatch_applicable,
  issuer_role, code, sort_order, is_active
FROM action_template
WHERE line_business_id = (SELECT id FROM business_lines WHERE name ILIKE '%comercial%' LIMIT 1)
  AND id::text LIKE 'b2000001-%'
ON CONFLICT (id) DO NOTHING;

-- ═══ 4. Duplicar action_template_claim_status para plantillas Hogar ═══
-- Mapear: template Comercial N → template Hogar N (mismo orden)

INSERT INTO action_template_claim_status (action_template_id, claim_status_id, is_active)
SELECT
  h.id,
  s.claim_status_id,
  s.is_active
FROM action_template_claim_status s
JOIN action_template c ON c.id = s.action_template_id
  AND c.line_business_id = (SELECT id FROM business_lines WHERE name ILIKE '%comercial%' LIMIT 1)
  AND c.id::text LIKE 'b2000001-%'
JOIN action_template h ON h.code = c.code
  AND h.line_business_id = (SELECT id FROM business_lines WHERE name ILIKE '%hogar%' LIMIT 1)
  AND h.id::text LIKE 'b2000002-%'
  AND h.name = c.name
ON CONFLICT (action_template_id, claim_status_id) DO NOTHING;

-- ═══ 5. Trigger para código automático de claim_actions ═══
-- Formato: {liquidation_number}-{line_letter}-{template_code}-{seq:3}
-- Ejemplo: L-000000013-H-COB-001

CREATE OR REPLACE FUNCTION set_claim_action_code()
RETURNS TRIGGER AS $$
DECLARE
  v_liquidation text;
  v_line_letter text;
  v_template_code text;
  v_max_seq int;
  v_new_seq text;
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    -- Obtener liquidation_number y line_letter del claim
    SELECT c.liquidation_number, bl.code_letter
    INTO v_liquidation, v_line_letter
    FROM claims c
    LEFT JOIN business_lines bl ON bl.id = c.business_line_id
    WHERE c.id = NEW.claim_id;

    IF v_liquidation IS NULL THEN
      v_liquidation := 'UNKNOWN';
    END IF;

    IF v_line_letter IS NULL THEN
      v_line_letter := 'X';
    END IF;

    -- Obtener el código de la plantilla si existe
    IF NEW.action_template_id IS NOT NULL THEN
      SELECT t.code INTO v_template_code
      FROM action_template t
      WHERE t.id = NEW.action_template_id;
    END IF;

    IF v_template_code IS NULL THEN
      v_template_code := 'GEN';
    END IF;

    -- Calcular correlativo: count de gestiones existentes para este claim
    SELECT count(*) INTO v_max_seq
    FROM claim_actions
    WHERE claim_id = NEW.claim_id;

    v_new_seq := LPAD((v_max_seq + 1)::text, 3, '0');
    NEW.code := v_liquidation || '-' || v_line_letter || v_template_code || '-' || v_new_seq;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_claim_action_code ON claim_actions;
CREATE TRIGGER trg_set_claim_action_code
BEFORE INSERT ON claim_actions
FOR EACH ROW
EXECUTE FUNCTION set_claim_action_code();

-- ═══ 6. Backfill de claim_actions existentes sin código ═══
DO $$
DECLARE
  r RECORD;
  v_liquidation text;
  v_line_letter text;
  v_template_code text;
  v_seq int;
  v_new_seq text;
BEGIN
  FOR r IN
    SELECT id, claim_id, action_template_id
    FROM claim_actions
    WHERE code IS NULL OR code = ''
    ORDER BY created_on ASC
  LOOP
    SELECT c.liquidation_number, bl.code_letter
    INTO v_liquidation, v_line_letter
    FROM claims c
    LEFT JOIN business_lines bl ON bl.id = c.business_line_id
    WHERE c.id = r.claim_id;

    IF v_liquidation IS NULL THEN v_liquidation := 'UNKNOWN'; END IF;
    IF v_line_letter IS NULL THEN v_line_letter := 'X'; END IF;

    IF r.action_template_id IS NOT NULL THEN
      SELECT t.code INTO v_template_code
      FROM action_template t
      WHERE t.id = r.action_template_id;
    END IF;

    IF v_template_code IS NULL THEN v_template_code := 'GEN'; END IF;

    SELECT count(*) INTO v_seq
    FROM claim_actions
    WHERE claim_id = r.claim_id AND created_on < r.created_on;

    v_new_seq := LPAD((v_seq + 1)::text, 3, '0');

    UPDATE claim_actions
    SET code = v_liquidation || '-' || v_line_letter || v_template_code || '-' || v_new_seq
    WHERE id = r.id;
  END LOOP;
END$$;
