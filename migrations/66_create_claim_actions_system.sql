-- ═══════════════════════════════════════════════════════════════════
-- Migración 66: Sistema de Acciones (Claim Actions)
-- ═══════════════════════════════════════════════════════════════════

-- ═══ PARTE 1: Catálogos en lookup_catalog ═══

-- action_type (6 tipos)
INSERT INTO lookup_catalog (category, code, name, description, sort_order, is_active) VALUES
  ('action_type', 'adjustment_process',  'Proceso de Ajuste',      'Acciones relacionadas con el Ajuste',         1, true),
  ('action_type', 'inspection_process',  'Proceso Inspección',     'Acciones relacionadas con el proceso de inspección', 2, true),
  ('action_type', 'appeal_process',      'Proceso de Impugnación', 'Acciones relacionadas con el proceso de impugnación', 3, true),
  ('action_type', 'claim_closure',       'Cierre de siniestro',    'Acciones asociadas a cierre de carpeta',      4, true),
  ('action_type', 'communications',      'Comunicaciones',         'Comunicaciones del siniestro',                5, true),
  ('action_type', 'claim_reopening',     'Reapertura Siniestro',   'Acciones asociadas a la Reapertura',          6, true);

-- action_status (7 estados de acción)
INSERT INTO lookup_catalog (category, code, name, sort_order, is_active) VALUES
  ('action_status', 'todo',        'Pendiente',   1, true),
  ('action_status', 'issued',      'Emitida',     2, true),
  ('action_status', 'reviewed',    'Revisada',    3, true),
  ('action_status', 'approved',    'Aprobada',    4, true),
  ('action_status', 'dispatched',  'Despachada',  5, true),
  ('action_status', 'rejected',    'Rechazada',   6, true),
  ('action_status', 'cancelled',   'Cancelada',   7, true);

-- ═══ PARTE 2: Tabla action_features ═══

CREATE TABLE IF NOT EXISTS action_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  has_specific_screen boolean NOT NULL DEFAULT false,
  has_control boolean NOT NULL DEFAULT false,
  has_issue boolean NOT NULL DEFAULT false,
  has_review boolean NOT NULL DEFAULT false,
  has_approve boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Insertar 22 action_features con UUIDs fijos para referenciar
INSERT INTO action_features (id, name, has_specific_screen, has_control, has_issue, has_review, has_approve, is_active, sort_order) VALUES
  ('a1000001-0000-0000-0000-000000000001', 'Inspección',                    true,  true,  true, false, false, true, 1),
  ('a1000001-0000-0000-0000-000000000002', 'Cobertura',                     true,  true,  true, false, false, true, 2),
  ('a1000001-0000-0000-0000-000000000003', 'Reserva',                       true,  false, true, false, false, true, 3),
  ('a1000001-0000-0000-0000-000000000004', 'Ajuste',                        true,  false, true, false, false, true, 4),
  ('a1000001-0000-0000-0000-000000000005', 'Coordinación Inspección',       true,  false, true, false, false, true, 5),
  ('a1000001-0000-0000-0000-000000000006', 'Informe de Liquidación',        false, false, false, false, false, true, 6),
  ('a1000001-0000-0000-0000-000000000007', 'Solicitud de Antecedentes',     true,  true,  true, false, false, true, 7),
  ('a1000001-0000-0000-0000-000000000008', 'Aviso Asignación',              true,  true,  true, false, false, true, 8),
  ('a1000001-0000-0000-0000-000000000009', 'Contacto Email Asegurado',      true,  true,  true, false, false, true, 9),
  ('a1000001-0000-0000-0000-000000000010', 'Recepción Total Antecedentes',  true,  true,  true, false, false, true, 10),
  ('a1000001-0000-0000-0000-000000000011', 'Cierre',                        true,  true,  true, false, false, true, 11),
  ('a1000001-0000-0000-0000-000000000012', 'Reapertura',                    true,  true,  true, false, false, true, 12),
  ('a1000001-0000-0000-0000-000000000013', 'Impugnación',                   true,  true,  true, false, false, true, 13),
  ('a1000001-0000-0000-0000-000000000014', 'Registro de Indemnización',     true,  false, true, false, false, true, 14),
  ('a1000001-0000-0000-0000-000000000015', 'Carta Propuesta al Asegurado',  true,  false, true, false, false, true, 15),
  ('a1000001-0000-0000-0000-000000000016', 'Respuesta de Impugnación',      true,  false, true, false, false, true, 16),
  ('a1000001-0000-0000-0000-000000000017', 'Prórroga de Siniestro',         true,  false, true, false, false, true, 17),
  ('a1000001-0000-0000-0000-000000000018', 'Recepción de Prórroga CMF',     true,  false, true, false, false, true, 18),
  ('a1000001-0000-0000-0000-000000000019', 'Genérica',                      true,  false, true, false, false, true, 19),
  ('a1000001-0000-0000-0000-000000000020', 'Solicitud de Despacho',         true,  false, true, false, false, true, 20),
  ('a1000001-0000-0000-0000-000000000021', 'Addendum',                      false, false, true, true,  true,  true, 21),
  ('a1000001-0000-0000-0000-000000000022', 'Reporte Preliminar',            false, false, true, true,  true,  true, 22);

-- ═══ PARTE 3: Tabla characteristic ═══

CREATE TABLE IF NOT EXISTS characteristic (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_feature_id uuid NOT NULL REFERENCES action_features(id) ON DELETE CASCADE,
  name text NOT NULL,
  local_name text,
  screen boolean NOT NULL DEFAULT false,
  control boolean NOT NULL DEFAULT false,
  issue boolean NOT NULL DEFAULT false,
  review boolean NOT NULL DEFAULT false,
  approve boolean NOT NULL DEFAULT false,
  document_template boolean NOT NULL DEFAULT false,
  email_template boolean NOT NULL DEFAULT false,
  document_type boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO characteristic (action_feature_id, name, local_name, screen, control, issue, review, approve, document_template, email_template, document_type, is_active, sort_order) VALUES
  ('a1000001-0000-0000-0000-000000000001', 'Inspection',                     'Inspección',                  true,  true,  true,  false, false, false, false, true,  true, 1),
  ('a1000001-0000-0000-0000-000000000002', 'Coverages',                      'Cobertura',                   true,  true,  true,  false, false, false, false, false, true, 2),
  ('a1000001-0000-0000-0000-000000000003', 'Reserve',                        'Reserva',                     true,  true,  true,  false, false, false, false, false, true, 3),
  ('a1000001-0000-0000-0000-000000000004', 'Adjustment File',                'Ajuste Archivo Excel',        false, false, true,  false, false, true,  true,  true,  true, 4),
  ('a1000001-0000-0000-0000-000000000005', 'Coordination',                   'Coordinación Inspección',     true,  true,  true,  false, false, false, true,  false, true, 5),
  ('a1000001-0000-0000-0000-000000000006', 'Loss Report',                    'Informe de Liquidación',      false, false, true,  true,  true,  true,  true,  true,  true, 6),
  ('a1000001-0000-0000-0000-000000000007', 'Background Documents Request',   'Solicitud de Antecedentes',   true,  true,  true,  false, false, false, true,  false, true, 7),
  ('a1000001-0000-0000-0000-000000000008', 'Assignment Notice',              'Aviso Asignación',            true,  true,  true,  false, false, false, true,  false, true, 8),
  ('a1000001-0000-0000-0000-000000000009', 'Insured Email Contact',          'Contacto Email Asegurado',    true,  false, true,  false, false, false, true,  true,  true, 9),
  ('a1000001-0000-0000-0000-000000000010', 'Background Documents Receive',   'Recepción Total Antecedentes', true, true,  true,  false, false, false, false, false, true, 10),
  ('a1000001-0000-0000-0000-000000000011', 'Closure',                        'Cierre',                      true,  true,  true,  false, false, false, false, false, true, 11),
  ('a1000001-0000-0000-0000-000000000012', 'Reopening',                      'Reapertura',                  true,  true,  true,  false, false, false, false, false, true, 12),
  ('a1000001-0000-0000-0000-000000000013', 'Appeal',                         'Impugnación',                 true,  true,  true,  false, false, false, false, true,  true, 13),
  ('a1000001-0000-0000-0000-000000000014', 'Indemnity Record',               'Registro de Indemnización',   true,  true,  true,  false, false, false, false, false, true, 14),
  ('a1000001-0000-0000-0000-000000000015', 'Proposal Settlement Letter',     'Carta Propuesta al Asegurado', false, false, true,  false, false, true,  true,  true,  true, 15),
  ('a1000001-0000-0000-0000-000000000016', 'Appeal Response',                'Respuesta de Impugnación',    true,  true,  true,  false, false, true,  true,  true,  true, 16),
  ('a1000001-0000-0000-0000-000000000017', 'Extension',                      'Registro de Prórroga',        true,  true,  true,  false, false, true,  true,  true,  true, 17),
  ('a1000001-0000-0000-0000-000000000018', 'CMF Extension Receipt',          'Recepción de Prórroga CMF',   true,  true,  true,  false, false, false, true,  true,  true, 18),
  ('a1000001-0000-0000-0000-000000000019', 'Generic',                        'Genérica',                    true,  false, true,  false, false, true,  true,  true,  true, 19);

-- ═══ PARTE 4: Tabla action_template ═══

CREATE TABLE IF NOT EXISTS action_template (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type_id uuid NOT NULL,          -- FK a lookup_catalog (action_type)
  action_features_id uuid NOT NULL REFERENCES action_features(id),
  line_business_id uuid,                 -- FK a business_lines
  name text NOT NULL,
  description text,
  is_blocker boolean NOT NULL DEFAULT false,
  is_review_applicable boolean NOT NULL DEFAULT false,
  is_approval_applicable boolean NOT NULL DEFAULT false,
  reviewer_role text,
  approver_role text,
  days_to_issue integer NOT NULL DEFAULT 1,
  days_to_review integer NOT NULL DEFAULT 0,
  days_to_approve integer NOT NULL DEFAULT 0,
  days_to_alert_to_issue integer NOT NULL DEFAULT 0,
  days_to_alert_to_review integer NOT NULL DEFAULT 0,
  days_to_alert_to_approve integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  issuer_role text,
  code text,
  is_dispatch_applicable boolean DEFAULT false,
  company_id uuid,
  event_id uuid,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Insertar plantillas clave con UUIDs fijos
-- Usamos los UUIDs de lookup_catalog para action_type:
--   adjustment_process, inspection_process, appeal_process, claim_closure, communications, claim_reopening
-- Los resolvemos con subqueries.

INSERT INTO action_template (id, action_type_id, action_features_id, line_business_id, name, description, is_blocker, is_review_applicable, is_approval_applicable, days_to_issue, days_to_alert_to_issue, is_dispatch_applicable, issuer_role, code, sort_order)
SELECT
  'b2000001-0000-0000-0000-000000000001',
  (SELECT id FROM lookup_catalog WHERE category='action_type' AND code='inspection_process'),
  'a1000001-0000-0000-0000-000000000005',
  '23b0bdba-80dd-13eb-4080-979cdd5335a3',
  'Coordinación de Inspección', 'Coordinación de Inspección', true, false, false, 2, 1, false, 'inspector', 'A', 1
WHERE NOT EXISTS (SELECT 1 FROM action_template WHERE id = 'b2000001-0000-0000-0000-000000000001');

INSERT INTO action_template (id, action_type_id, action_features_id, line_business_id, name, description, is_blocker, is_review_applicable, is_approval_applicable, days_to_issue, days_to_alert_to_issue, is_dispatch_applicable, issuer_role, code, sort_order)
SELECT
  'b2000001-0000-0000-0000-000000000002',
  (SELECT id FROM lookup_catalog WHERE category='action_type' AND code='inspection_process'),
  'a1000001-0000-0000-0000-000000000001',
  '23b0bdba-80dd-13eb-4080-979cdd5335a3',
  'Inspección', 'Inspección', true, false, false, 1, 1, false, 'inspector', 'B', 2
WHERE NOT EXISTS (SELECT 1 FROM action_template WHERE id = 'b2000001-0000-0000-0000-000000000002');

INSERT INTO action_template (id, action_type_id, action_features_id, line_business_id, name, description, is_blocker, is_review_applicable, is_approval_applicable, days_to_issue, days_to_alert_to_issue, is_dispatch_applicable, issuer_role, code, sort_order)
SELECT
  'b2000001-0000-0000-0000-000000000003',
  (SELECT id FROM lookup_catalog WHERE category='action_type' AND code='adjustment_process'),
  'a1000001-0000-0000-0000-000000000007',
  '23b0bdba-80dd-13eb-4080-979cdd5335a3',
  'Notificación y Solicitud de Antecedentes', 'Notificación y Solicitud de Antecedentes', true, false, false, 3, 2, false, 'adjuster', 'AA', 3
WHERE NOT EXISTS (SELECT 1 FROM action_template WHERE id = 'b2000001-0000-0000-0000-000000000003');

INSERT INTO action_template (id, action_type_id, action_features_id, line_business_id, name, description, is_blocker, is_review_applicable, is_approval_applicable, days_to_issue, days_to_alert_to_issue, is_dispatch_applicable, issuer_role, code, sort_order)
SELECT
  'b2000001-0000-0000-0000-000000000004',
  (SELECT id FROM lookup_catalog WHERE category='action_type' AND code='adjustment_process'),
  'a1000001-0000-0000-0000-000000000002',
  '23b0bdba-80dd-13eb-4080-979cdd5335a3',
  'Ingreso de Coberturas', 'Registro de coberturas', false, false, false, 3, 2, false, 'adjuster', 'B', 4
WHERE NOT EXISTS (SELECT 1 FROM action_template WHERE id = 'b2000001-0000-0000-0000-000000000004');

INSERT INTO action_template (id, action_type_id, action_features_id, line_business_id, name, description, is_blocker, is_review_applicable, is_approval_applicable, days_to_issue, days_to_alert_to_issue, is_dispatch_applicable, issuer_role, code, sort_order)
SELECT
  'b2000001-0000-0000-0000-000000000005',
  (SELECT id FROM lookup_catalog WHERE category='action_type' AND code='adjustment_process'),
  'a1000001-0000-0000-0000-000000000003',
  '23b0bdba-80dd-13eb-4080-979cdd5335a3',
  'Reserva', 'Registro de reserva en sistema', false, false, false, 2, 1, false, 'adjuster', 'R', 5
WHERE NOT EXISTS (SELECT 1 FROM action_template WHERE id = 'b2000001-0000-0000-0000-000000000005');

INSERT INTO action_template (id, action_type_id, action_features_id, line_business_id, name, description, is_blocker, is_review_applicable, is_approval_applicable, days_to_issue, days_to_alert_to_issue, is_dispatch_applicable, issuer_role, code, sort_order)
SELECT
  'b2000001-0000-0000-0000-000000000006',
  (SELECT id FROM lookup_catalog WHERE category='action_type' AND code='adjustment_process'),
  'a1000001-0000-0000-0000-000000000004',
  '23b0bdba-80dd-13eb-4080-979cdd5335a3',
  'Planilla Cuadro de Ajuste', 'Planilla de cálculos de ajuste de siniestro', false, true, false, 3, 2, true, 'adjuster', 'PCA', 6
WHERE NOT EXISTS (SELECT 1 FROM action_template WHERE id = 'b2000001-0000-0000-0000-000000000006');

INSERT INTO action_template (id, action_type_id, action_features_id, line_business_id, name, description, is_blocker, is_review_applicable, is_approval_applicable, days_to_issue, days_to_alert_to_issue, is_dispatch_applicable, issuer_role, code, sort_order)
SELECT
  'b2000001-0000-0000-0000-000000000007',
  (SELECT id FROM lookup_catalog WHERE category='action_type' AND code='adjustment_process'),
  'a1000001-0000-0000-0000-000000000006',
  '23b0bdba-80dd-13eb-4080-979cdd5335a3',
  'Informe de Liquidación', 'Informe de Liquidación', false, true, false, 5, 3, true, 'adjuster', 'IFL', 7
WHERE NOT EXISTS (SELECT 1 FROM action_template WHERE id = 'b2000001-0000-0000-0000-000000000007');

INSERT INTO action_template (id, action_type_id, action_features_id, line_business_id, name, description, is_blocker, is_review_applicable, is_approval_applicable, days_to_issue, days_to_alert_to_issue, is_dispatch_applicable, issuer_role, code, sort_order)
SELECT
  'b2000001-0000-0000-0000-000000000008',
  (SELECT id FROM lookup_catalog WHERE category='action_type' AND code='adjustment_process'),
  'a1000001-0000-0000-0000-000000000014',
  '23b0bdba-80dd-13eb-4080-979cdd5335a3',
  'Registro de Indemnización', 'Registro de indemnización', false, false, false, 2, 1, false, 'adjuster', 'Z', 8
WHERE NOT EXISTS (SELECT 1 FROM action_template WHERE id = 'b2000001-0000-0000-0000-000000000008');

INSERT INTO action_template (id, action_type_id, action_features_id, line_business_id, name, description, is_blocker, is_review_applicable, is_approval_applicable, days_to_issue, days_to_alert_to_issue, is_dispatch_applicable, issuer_role, code, sort_order)
SELECT
  'b2000001-0000-0000-0000-000000000009',
  (SELECT id FROM lookup_catalog WHERE category='action_type' AND code='adjustment_process'),
  'a1000001-0000-0000-0000-000000000008',
  '23b0bdba-80dd-13eb-4080-979cdd5335a3',
  'Aviso de Asignación', 'Aviso de asignación del siniestro', false, false, false, 2, 1, false, 'adjuster', 'Z', 9
WHERE NOT EXISTS (SELECT 1 FROM action_template WHERE id = 'b2000001-0000-0000-0000-000000000009');

INSERT INTO action_template (id, action_type_id, action_features_id, line_business_id, name, description, is_blocker, is_review_applicable, is_approval_applicable, days_to_issue, days_to_alert_to_issue, is_dispatch_applicable, issuer_role, code, sort_order)
SELECT
  'b2000001-0000-0000-0000-000000000010',
  (SELECT id FROM lookup_catalog WHERE category='action_type' AND code='adjustment_process'),
  'a1000001-0000-0000-0000-000000000010',
  '23b0bdba-80dd-13eb-4080-979cdd5335a3',
  'Recepción Total de Antecedentes', 'Recepción total de antecedentes', false, false, false, 1, 1, false, 'adjuster', 'R', 10
WHERE NOT EXISTS (SELECT 1 FROM action_template WHERE id = 'b2000001-0000-0000-0000-000000000010');

INSERT INTO action_template (id, action_type_id, action_features_id, line_business_id, name, description, is_blocker, is_review_applicable, is_approval_applicable, days_to_issue, days_to_alert_to_issue, is_dispatch_applicable, issuer_role, code, sort_order)
SELECT
  'b2000001-0000-0000-0000-000000000011',
  (SELECT id FROM lookup_catalog WHERE category='action_type' AND code='adjustment_process'),
  'a1000001-0000-0000-0000-000000000009',
  '23b0bdba-80dd-13eb-4080-979cdd5335a3',
  'Contacto Asegurado', 'Contacto con asegurado', false, false, false, 6, 4, false, 'adjuster', 'ZA', 11
WHERE NOT EXISTS (SELECT 1 FROM action_template WHERE id = 'b2000001-0000-0000-0000-000000000011');

-- Cierre de carpeta (action_type=claim_closure, feature=Cierre)
INSERT INTO action_template (id, action_type_id, action_features_id, line_business_id, name, description, is_blocker, is_review_applicable, is_approval_applicable, days_to_issue, days_to_alert_to_issue, is_dispatch_applicable, issuer_role, code, sort_order)
SELECT
  'b2000001-0000-0000-0000-000000000012',
  (SELECT id FROM lookup_catalog WHERE category='action_type' AND code='claim_closure'),
  'a1000001-0000-0000-0000-000000000011',
  '23b0bdba-80dd-13eb-4080-979cdd5335a3',
  'Cierre de carpeta', 'Cierre del siniestro', false, false, false, 1, 1, false, 'adjuster', 'C', 12
WHERE NOT EXISTS (SELECT 1 FROM action_template WHERE id = 'b2000001-0000-0000-0000-000000000012');

-- Reapertura (action_type=claim_reopening, feature=Reapertura)
INSERT INTO action_template (id, action_type_id, action_features_id, line_business_id, name, description, is_blocker, is_review_applicable, is_approval_applicable, days_to_issue, days_to_alert_to_issue, is_dispatch_applicable, issuer_role, code, sort_order)
SELECT
  'b2000001-0000-0000-0000-000000000013',
  (SELECT id FROM lookup_catalog WHERE category='action_type' AND code='claim_reopening'),
  'a1000001-0000-0000-0000-000000000012',
  '23b0bdba-80dd-13eb-4080-979cdd5335a3',
  'Reapertura', 'Reapertura del siniestro', false, false, false, 1, 1, false, 'admin', 'REA', 13
WHERE NOT EXISTS (SELECT 1 FROM action_template WHERE id = 'b2000001-0000-0000-0000-000000000013');

-- Solicitud de Despacho (action_type=adjustment_process, feature=Solicitud Despacho)
INSERT INTO action_template (id, action_type_id, action_features_id, line_business_id, name, description, is_blocker, is_review_applicable, is_approval_applicable, days_to_issue, days_to_alert_to_issue, is_dispatch_applicable, issuer_role, code, sort_order)
SELECT
  'b2000001-0000-0000-0000-000000000014',
  (SELECT id FROM lookup_catalog WHERE category='action_type' AND code='adjustment_process'),
  'a1000001-0000-0000-0000-000000000020',
  '23b0bdba-80dd-13eb-4080-979cdd5335a3',
  'Solicitud de Despacho', 'Solicitud de despacho del siniestro', false, false, false, 2, 1, false, 'adjuster', 'DES', 14
WHERE NOT EXISTS (SELECT 1 FROM action_template WHERE id = 'b2000001-0000-0000-0000-000000000014');

-- Impugnación Asegurado
INSERT INTO action_template (id, action_type_id, action_features_id, line_business_id, name, description, is_blocker, is_review_applicable, is_approval_applicable, days_to_issue, days_to_alert_to_issue, is_dispatch_applicable, issuer_role, code, sort_order)
SELECT
  'b2000001-0000-0000-0000-000000000015',
  (SELECT id FROM lookup_catalog WHERE category='action_type' AND code='appeal_process'),
  'a1000001-0000-0000-0000-000000000013',
  '23b0bdba-80dd-13eb-4080-979cdd5335a3',
  'Impugnación Asegurado', 'Impugnación del asegurado', true, false, false, 1, 1, false, 'adjuster', 'IMP', 15
WHERE NOT EXISTS (SELECT 1 FROM action_template WHERE id = 'b2000001-0000-0000-0000-000000000015');

-- Respuesta de Impugnación
INSERT INTO action_template (id, action_type_id, action_features_id, line_business_id, name, description, is_blocker, is_review_applicable, is_approval_applicable, days_to_issue, days_to_alert_to_issue, is_dispatch_applicable, issuer_role, code, sort_order)
SELECT
  'b2000001-0000-0000-0000-000000000016',
  (SELECT id FROM lookup_catalog WHERE category='action_type' AND code='appeal_process'),
  'a1000001-0000-0000-0000-000000000016',
  '23b0bdba-80dd-13eb-4080-979cdd5335a3',
  'Respuesta de Impugnación', 'Respuesta a la impugnación', false, false, false, 2, 1, false, 'adjuster', 'RIA', 16
WHERE NOT EXISTS (SELECT 1 FROM action_template WHERE id = 'b2000001-0000-0000-0000-000000000016');

-- Prórroga
INSERT INTO action_template (id, action_type_id, action_features_id, line_business_id, name, description, is_blocker, is_review_applicable, is_approval_applicable, days_to_issue, days_to_alert_to_issue, is_dispatch_applicable, issuer_role, code, sort_order)
SELECT
  'b2000001-0000-0000-0000-000000000017',
  (SELECT id FROM lookup_catalog WHERE category='action_type' AND code='adjustment_process'),
  'a1000001-0000-0000-0000-000000000017',
  '23b0bdba-80dd-13eb-4080-979cdd5335a3',
  'Prórroga', 'Acción de prórroga del siniestro', true, false, false, 5, 1, false, 'adjuster', 'PRO', 17
WHERE NOT EXISTS (SELECT 1 FROM action_template WHERE id = 'b2000001-0000-0000-0000-000000000017');

-- Carta Propuesta al Asegurado
INSERT INTO action_template (id, action_type_id, action_features_id, line_business_id, name, description, is_blocker, is_review_applicable, is_approval_applicable, days_to_issue, days_to_alert_to_issue, is_dispatch_applicable, issuer_role, code, sort_order)
SELECT
  'b2000001-0000-0000-0000-000000000018',
  (SELECT id FROM lookup_catalog WHERE category='action_type' AND code='adjustment_process'),
  'a1000001-0000-0000-0000-000000000015',
  '23b0bdba-80dd-13eb-4080-979cdd5335a3',
  'Carta Propuesta al Asegurado', 'Carta propuesta al asegurado', false, false, false, 3, 2, false, 'adjuster', 'CPA', 18
WHERE NOT EXISTS (SELECT 1 FROM action_template WHERE id = 'b2000001-0000-0000-0000-000000000018');

-- Observación (genérica)
INSERT INTO action_template (id, action_type_id, action_features_id, line_business_id, name, description, is_blocker, is_review_applicable, is_approval_applicable, days_to_issue, days_to_alert_to_issue, is_dispatch_applicable, issuer_role, code, sort_order)
SELECT
  'b2000001-0000-0000-0000-000000000019',
  (SELECT id FROM lookup_catalog WHERE category='action_type' AND code='communications'),
  'a1000001-0000-0000-0000-000000000019',
  '23b0bdba-80dd-13eb-4080-979cdd5335a3',
  'Observación', 'Acción genérica de observación', false, false, false, 1, 1, false, 'adjuster', 'O', 19
WHERE NOT EXISTS (SELECT 1 FROM action_template WHERE id = 'b2000001-0000-0000-0000-000000000019');

-- ═══ PARTE 5: Tabla action_template_claim_status (puente) ═══

CREATE TABLE IF NOT EXISTS action_template_claim_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_template_id uuid NOT NULL REFERENCES action_template(id) ON DELETE CASCADE,
  claim_status_id uuid NOT NULL,  -- FK a lookup_catalog (claim_status)
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE(action_template_id, claim_status_id)
);

-- Mapear plantillas a estados del siniestro
-- claim_status IDs:
--   created:      99c36f4e-4868-44c0-8fb4-78517424d727
--   adjustment:   10088b7e-6f51-4c84-8cdd-42c64b2140af
--   dispatchment: 4268814a-cc5f-4886-a280-5cc2a1a4695d
--   closed:       7b8292f3-34cd-4296-aee7-2c8135cb1b16
--   reopened:     02fe13f6-849b-461d-b601-943b05d8056c

-- Coordinación Inspección (template 1): created, adjustment, reopened
INSERT INTO action_template_claim_status (action_template_id, claim_status_id, is_active) VALUES
  ('b2000001-0000-0000-0000-000000000001', '99c36f4e-4868-44c0-8fb4-78517424d727', true),
  ('b2000001-0000-0000-0000-000000000001', '10088b7e-6f51-4c84-8cdd-42c64b2140af', true),
  ('b2000001-0000-0000-0000-000000000001', '02fe13f6-849b-461d-b601-943b05d8056c', true)
ON CONFLICT (action_template_id, claim_status_id) DO NOTHING;

-- Inspección (template 2): created, adjustment, reopened
INSERT INTO action_template_claim_status (action_template_id, claim_status_id, is_active) VALUES
  ('b2000001-0000-0000-0000-000000000002', '99c36f4e-4868-44c0-8fb4-78517424d727', true),
  ('b2000001-0000-0000-0000-000000000002', '10088b7e-6f51-4c84-8cdd-42c64b2140af', true),
  ('b2000001-0000-0000-0000-000000000002', '02fe13f6-849b-461d-b601-943b05d8056c', true)
ON CONFLICT (action_template_id, claim_status_id) DO NOTHING;

-- Solicitud Antecedentes (template 3): created, adjustment, reopened
INSERT INTO action_template_claim_status (action_template_id, claim_status_id, is_active) VALUES
  ('b2000001-0000-0000-0000-000000000003', '99c36f4e-4868-44c0-8fb4-78517424d727', true),
  ('b2000001-0000-0000-0000-000000000003', '10088b7e-6f51-4c84-8cdd-42c64b2140af', true),
  ('b2000001-0000-0000-0000-000000000003', '02fe13f6-849b-461d-b601-943b05d8056c', true)
ON CONFLICT (action_template_id, claim_status_id) DO NOTHING;

-- Coberturas (template 4): created, adjustment, dispatchment, reopened
INSERT INTO action_template_claim_status (action_template_id, claim_status_id, is_active) VALUES
  ('b2000001-0000-0000-0000-000000000004', '99c36f4e-4868-44c0-8fb4-78517424d727', true),
  ('b2000001-0000-0000-0000-000000000004', '10088b7e-6f51-4c84-8cdd-42c64b2140af', true),
  ('b2000001-0000-0000-0000-000000000004', '4268814a-cc5f-4886-a280-5cc2a1a4695d', true),
  ('b2000001-0000-0000-0000-000000000004', '02fe13f6-849b-461d-b601-943b05d8056c', true)
ON CONFLICT (action_template_id, claim_status_id) DO NOTHING;

-- Reserva (template 5): created, adjustment, reopened
INSERT INTO action_template_claim_status (action_template_id, claim_status_id, is_active) VALUES
  ('b2000001-0000-0000-0000-000000000005', '99c36f4e-4868-44c0-8fb4-78517424d727', true),
  ('b2000001-0000-0000-0000-000000000005', '10088b7e-6f51-4c84-8cdd-42c64b2140af', true),
  ('b2000001-0000-0000-0000-000000000005', '02fe13f6-849b-461d-b601-943b05d8056c', true)
ON CONFLICT (action_template_id, claim_status_id) DO NOTHING;

-- Planilla Cuadro Ajuste (template 6): adjustment, dispatchment, reopened
INSERT INTO action_template_claim_status (action_template_id, claim_status_id, is_active) VALUES
  ('b2000001-0000-0000-0000-000000000006', '10088b7e-6f51-4c84-8cdd-42c64b2140af', true),
  ('b2000001-0000-0000-0000-000000000006', '4268814a-cc5f-4886-a280-5cc2a1a4695d', true),
  ('b2000001-0000-0000-0000-000000000006', '02fe13f6-849b-461d-b601-943b05d8056c', true)
ON CONFLICT (action_template_id, claim_status_id) DO NOTHING;

-- Informe Liquidación (template 7): adjustment, dispatchment, reopened
INSERT INTO action_template_claim_status (action_template_id, claim_status_id, is_active) VALUES
  ('b2000001-0000-0000-0000-000000000007', '10088b7e-6f51-4c84-8cdd-42c64b2140af', true),
  ('b2000001-0000-0000-0000-000000000007', '4268814a-cc5f-4886-a280-5cc2a1a4695d', true),
  ('b2000001-0000-0000-0000-000000000007', '02fe13f6-849b-461d-b601-943b05d8056c', true)
ON CONFLICT (action_template_id, claim_status_id) DO NOTHING;

-- Indemnización (template 8): adjustment, reopened
INSERT INTO action_template_claim_status (action_template_id, claim_status_id, is_active) VALUES
  ('b2000001-0000-0000-0000-000000000008', '10088b7e-6f51-4c84-8cdd-42c64b2140af', true),
  ('b2000001-0000-0000-0000-000000000008', '02fe13f6-849b-461d-b601-943b05d8056c', true)
ON CONFLICT (action_template_id, claim_status_id) DO NOTHING;

-- Aviso Asignación (template 9): created, adjustment
INSERT INTO action_template_claim_status (action_template_id, claim_status_id, is_active) VALUES
  ('b2000001-0000-0000-0000-000000000009', '99c36f4e-4868-44c0-8fb4-78517424d727', true),
  ('b2000001-0000-0000-0000-000000000009', '10088b7e-6f51-4c84-8cdd-42c64b2140af', true)
ON CONFLICT (action_template_id, claim_status_id) DO NOTHING;

-- Recepción Antecedentes (template 10): created, adjustment, dispatchment, reopened
INSERT INTO action_template_claim_status (action_template_id, claim_status_id, is_active) VALUES
  ('b2000001-0000-0000-0000-000000000010', '99c36f4e-4868-44c0-8fb4-78517424d727', true),
  ('b2000001-0000-0000-0000-000000000010', '10088b7e-6f51-4c84-8cdd-42c64b2140af', true),
  ('b2000001-0000-0000-0000-000000000010', '4268814a-cc5f-4886-a280-5cc2a1a4695d', true),
  ('b2000001-0000-0000-0000-000000000010', '02fe13f6-849b-461d-b601-943b05d8056c', true)
ON CONFLICT (action_template_id, claim_status_id) DO NOTHING;

-- Contacto Asegurado (template 11): created, adjustment, dispatchment, reopened
INSERT INTO action_template_claim_status (action_template_id, claim_status_id, is_active) VALUES
  ('b2000001-0000-0000-0000-000000000011', '99c36f4e-4868-44c0-8fb4-78517424d727', true),
  ('b2000001-0000-0000-0000-000000000011', '10088b7e-6f51-4c84-8cdd-42c64b2140af', true),
  ('b2000001-0000-0000-0000-000000000011', '4268814a-cc5f-4886-a280-5cc2a1a4695d', true),
  ('b2000001-0000-0000-0000-000000000011', '02fe13f6-849b-461d-b601-943b05d8056c', true)
ON CONFLICT (action_template_id, claim_status_id) DO NOTHING;

-- Cierre (template 12): dispatchment, reopened
INSERT INTO action_template_claim_status (action_template_id, claim_status_id, is_active) VALUES
  ('b2000001-0000-0000-0000-000000000012', '4268814a-cc5f-4886-a280-5cc2a1a4695d', true),
  ('b2000001-0000-0000-0000-000000000012', '02fe13f6-849b-461d-b601-943b05d8056c', true)
ON CONFLICT (action_template_id, claim_status_id) DO NOTHING;

-- Reapertura (template 13): closed
INSERT INTO action_template_claim_status (action_template_id, claim_status_id, is_active) VALUES
  ('b2000001-0000-0000-0000-000000000013', '7b8292f3-34cd-4296-aee7-2c8135cb1b16', true)
ON CONFLICT (action_template_id, claim_status_id) DO NOTHING;

-- Solicitud Despacho (template 14): adjustment, dispatchment, reopened
INSERT INTO action_template_claim_status (action_template_id, claim_status_id, is_active) VALUES
  ('b2000001-0000-0000-0000-000000000014', '10088b7e-6f51-4c84-8cdd-42c64b2140af', true),
  ('b2000001-0000-0000-0000-000000000014', '4268814a-cc5f-4886-a280-5cc2a1a4695d', true),
  ('b2000001-0000-0000-0000-000000000014', '02fe13f6-849b-461d-b601-943b05d8056c', true)
ON CONFLICT (action_template_id, claim_status_id) DO NOTHING;

-- Impugnación (template 15): adjustment, dispatchment, reopened
INSERT INTO action_template_claim_status (action_template_id, claim_status_id, is_active) VALUES
  ('b2000001-0000-0000-0000-000000000015', '10088b7e-6f51-4c84-8cdd-42c64b2140af', true),
  ('b2000001-0000-0000-0000-000000000015', '4268814a-cc5f-4886-a280-5cc2a1a4695d', true),
  ('b2000001-0000-0000-0000-000000000015', '02fe13f6-849b-461d-b601-943b05d8056c', true)
ON CONFLICT (action_template_id, claim_status_id) DO NOTHING;

-- Respuesta Impugnación (template 16): dispatchment, reopened
INSERT INTO action_template_claim_status (action_template_id, claim_status_id, is_active) VALUES
  ('b2000001-0000-0000-0000-000000000016', '4268814a-cc5f-4886-a280-5cc2a1a4695d', true),
  ('b2000001-0000-0000-0000-000000000016', '02fe13f6-849b-461d-b601-943b05d8056c', true)
ON CONFLICT (action_template_id, claim_status_id) DO NOTHING;

-- Prórroga (template 17): adjustment, dispatchment, reopened
INSERT INTO action_template_claim_status (action_template_id, claim_status_id, is_active) VALUES
  ('b2000001-0000-0000-0000-000000000017', '10088b7e-6f51-4c84-8cdd-42c64b2140af', true),
  ('b2000001-0000-0000-0000-000000000017', '4268814a-cc5f-4886-a280-5cc2a1a4695d', true),
  ('b2000001-0000-0000-0000-000000000017', '02fe13f6-849b-461d-b601-943b05d8056c', true)
ON CONFLICT (action_template_id, claim_status_id) DO NOTHING;

-- Carta Propuesta (template 18): adjustment, dispatchment, reopened
INSERT INTO action_template_claim_status (action_template_id, claim_status_id, is_active) VALUES
  ('b2000001-0000-0000-0000-000000000018', '10088b7e-6f51-4c84-8cdd-42c64b2140af', true),
  ('b2000001-0000-0000-0000-000000000018', '4268814a-cc5f-4886-a280-5cc2a1a4695d', true),
  ('b2000001-0000-0000-0000-000000000018', '02fe13f6-849b-461d-b601-943b05d8056c', true)
ON CONFLICT (action_template_id, claim_status_id) DO NOTHING;

-- Observación (template 19): created, adjustment, dispatchment, reopened
INSERT INTO action_template_claim_status (action_template_id, claim_status_id, is_active) VALUES
  ('b2000001-0000-0000-0000-000000000019', '99c36f4e-4868-44c0-8fb4-78517424d727', true),
  ('b2000001-0000-0000-0000-000000000019', '10088b7e-6f51-4c84-8cdd-42c64b2140af', true),
  ('b2000001-0000-0000-0000-000000000019', '4268814a-cc5f-4886-a280-5cc2a1a4695d', true),
  ('b2000001-0000-0000-0000-000000000019', '02fe13f6-849b-461d-b601-943b05d8056c', true)
ON CONFLICT (action_template_id, claim_status_id) DO NOTHING;

-- ═══ PARTE 6: Tabla claim_actions ═══

CREATE TABLE IF NOT EXISTS claim_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  action_type_id uuid,                  -- FK a lookup_catalog (action_type)
  action_features_id uuid NOT NULL REFERENCES action_features(id),
  action_template_id uuid REFERENCES action_template(id) ON DELETE SET NULL,
  line_business_id uuid,                -- FK a business_lines

  name text NOT NULL,
  description text,
  code text,

  -- Datos específicos de la acción (JSON)
  action_data jsonb,

  -- Estado de la acción
  action_status_id uuid,                -- FK a lookup_catalog (action_status)

  -- Workflow: creación
  created_by uuid,                      -- FK a auth.users
  created_on timestamptz NOT NULL DEFAULT now(),

  -- Workflow: emisión
  issued_by uuid,                       -- FK a auth.users
  issued_on timestamptz,
  issuer_id uuid,

  -- Workflow: revisión
  reviewed_by uuid,
  reviewed_on timestamptz,
  reviewer_id uuid,
  review_rejected_by uuid,
  review_rejected_on timestamptz,
  reviewer_rejection_comment text,

  -- Workflow: aprobación
  approved_by uuid,
  approved_on timestamptz,
  approver_id uuid,
  approve_rejected_by uuid,
  approve_rejected_on timestamptz,
  approver_rejection_comment text,

  -- Workflow: despacho
  dispatched_by uuid,
  dispatched_on timestamptz,
  dispatcher_id uuid,
  dispatch_rejected_by uuid,
  dispatch_rejected_on timestamptz,
  dispatcher_rejection_comment text,

  -- Otros
  expected_date timestamptz,
  is_blocker boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  updated_on timestamptz,
  updated_by uuid
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_claim_actions_claim_id ON claim_actions(claim_id);
CREATE INDEX IF NOT EXISTS idx_claim_actions_status ON claim_actions(action_status_id);
CREATE INDEX IF NOT EXISTS idx_claim_actions_template ON claim_actions(action_template_id);
CREATE INDEX IF NOT EXISTS idx_action_template_type ON action_template(action_type_id);
CREATE INDEX IF NOT EXISTS idx_action_template_features ON action_template(action_features_id);
CREATE INDEX IF NOT EXISTS idx_action_template_claim_status_template ON action_template_claim_status(action_template_id);
CREATE INDEX IF NOT EXISTS idx_action_template_claim_status_status ON action_template_claim_status(claim_status_id);
CREATE INDEX IF NOT EXISTS idx_characteristic_feature ON characteristic(action_feature_id);
