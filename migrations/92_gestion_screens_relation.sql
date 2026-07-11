-- ═══════════════════════════════════════════════════════════════
-- 92: Relación flexible entre características y pantallas de gestión
-- Una pantalla puede ser usada por múltiples características.
-- ═══════════════════════════════════════════════════════════════

-- Catálogo de pantallas de gestión (componentes UI reutilizables)
CREATE TABLE IF NOT EXISTS gestion_screens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  form_schema JSONB, -- Define campos del formulario: { fields: [...] }
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE gestion_screens IS 'Catálogo de pantallas (componentes UI) que pueden asociarse a características de gestiones. Permite que una misma pantalla sirva para múltiples características.';
COMMENT ON COLUMN gestion_screens.form_schema IS 'Schema JSON de campos del formulario. Permite generar formularios dinámicos o referenciar componentes React fijos.';

-- Relación muchos-a-muchos: características ↔ pantallas
CREATE TABLE IF NOT EXISTS characteristic_screens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  characteristic_id UUID NOT NULL REFERENCES characteristic(id) ON DELETE CASCADE,
  screen_id UUID NOT NULL REFERENCES gestion_screens(id) ON DELETE CASCADE,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (characteristic_id, screen_id)
);

COMMENT ON TABLE characteristic_screens IS 'Relaciona características con las pantallas que deben mostrarse cuando una gestión con esa característica se edita.';
COMMENT ON COLUMN characteristic_screens.is_default IS 'Indica si es la pantalla principal a mostrar por defecto cuando hay múltiples.';

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_characteristic_screens_characteristic
  ON characteristic_screens(characteristic_id);
CREATE INDEX IF NOT EXISTS idx_characteristic_screens_screen
  ON characteristic_screens(screen_id);

-- Seed de pantallas basadas en el sistema Tys
INSERT INTO gestion_screens (id, code, name, description, icon, form_schema, sort_order) VALUES
  ('d1000001-0000-0000-0000-000000000001', 'email',          'Email / Aviso',            'Envío de correo o aviso con plantilla',              'mail',           '{"component": "EmailScreen"}',          1),
  ('d1000001-0000-0000-0000-000000000002', 'coordinacion',   'Coordinación Inspección',  'Agendar o coordinar una inspección',                 'clipboard-check', '{"component": "CoordinacionScreen"}',   2),
  ('d1000001-0000-0000-0000-000000000003', 'coberturas',     'Coberturas',               'Selección y edición de coberturas afectadas',        'shield',         '{"component": "CoberturasScreen"}',       3),
  ('d1000001-0000-0000-0000-000000000004', 'reserva',        'Reserva',                  'Reserva de indemnización / pago',                    'banknote',       '{"component": "ReservaScreen"}',          4),
  ('d1000001-0000-0000-0000-000000000005', 'solicitud_docs', 'Solicitud de Documentos',  'Solicitud y recepción de documentos / antecedentes', 'folder-open',    '{"component": "SolicitudDocumentosScreen"}', 5),
  ('d1000001-0000-0000-0000-000000000006', 'liquidacion',    'Liquidación / Informe',    'Informe de liquidación o ajuste',                    'file-text',      '{"component": "LiquidacionScreen"}',      6),
  ('d1000001-0000-0000-0000-000000000007', 'cierre',         'Cierre',                   'Cierre de siniestro',                                'lock',           '{"component": "CierreScreen"}',           7),
  ('d1000001-0000-0000-0000-000000000008', 'reapertura',     'Reapertura',               'Reapertura de siniestro',                            'rotate-ccw',     '{"component": "ReaperturaScreen"}',       8),
  ('d1000001-0000-0000-0000-000000000009', 'prorroga',       'Prórroga',                 'Solicitud o registro de prórroga',                   'calendar-clock', '{"component": "ProrrogaScreen"}',         9),
  ('d1000001-0000-0000-0000-000000000010', 'impugnacion',    'Impugnación',              'Registro de impugnación y respuesta',                'alert-triangle', '{"component": "ImpugnacionScreen"}',     10),
  ('d1000001-0000-0000-0000-000000000011', 'indemnizacion',  'Indemnización / Pago',     'Registro de indemnización o instrucción de pago',    'credit-card',    '{"component": "IndemnizacionScreen"}',   11),
  ('d1000001-0000-0000-0000-000000000012', 'generica',       'Genérica',                 'Formulario genérico configurable (JSON)',            'layout-template', '{"component": "GenericaScreen"}',        99)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  form_schema = EXCLUDED.form_schema,
  sort_order = EXCLUDED.sort_order;

-- Asociar pantallas a características existentes según sus nombres/capacidades.
-- Relación flexible: una pantalla puede servir a múltiples características.
INSERT INTO characteristic_screens (characteristic_id, screen_id, is_default)
SELECT c.id, s.id, true
FROM characteristic c
CROSS JOIN gestion_screens s
WHERE c.is_active = true
  AND (
    -- Inspección y Coordinación → pantalla coordinacion
    ((c.name ILIKE '%inspection%' OR c.local_name ILIKE '%inspección%') AND s.code = 'coordinacion')
    OR ((c.name ILIKE '%coordination%' OR c.local_name ILIKE '%coordinación%') AND s.code = 'coordinacion')
    -- Email / Aviso / Contacto
    OR ((c.name ILIKE '%email%' OR c.local_name ILIKE '%email%') AND s.code = 'email')
    OR ((c.name ILIKE '%notice%' OR c.local_name ILIKE '%aviso%' OR c.local_name ILIKE '%avis%') AND s.code = 'email')
    OR ((c.name ILIKE '%contact%' OR c.local_name ILIKE '%contacto%') AND s.code = 'email')
    -- Cobertura
    OR ((c.name ILIKE '%coverage%' OR c.local_name ILIKE '%cobertura%') AND s.code = 'coberturas')
    -- Reserva
    OR ((c.name ILIKE '%reserve%' OR c.local_name ILIKE '%reserva%') AND s.code = 'reserva')
    -- Solicitud de antecedentes / documentos / recepción
    OR ((c.name ILIKE '%background%' OR c.local_name ILIKE '%antecedente%') AND s.code = 'solicitud_docs')
    OR ((c.name ILIKE '%document%' OR c.local_name ILIKE '%documento%') AND s.code = 'solicitud_docs')
    OR ((c.name ILIKE '%receiv%' OR c.local_name ILIKE '%recepción%') AND s.code = 'solicitud_docs')
    -- Liquidación / Ajuste / Informe
    OR ((c.name ILIKE '%liquidation%' OR c.local_name ILIKE '%liquidación%') AND s.code = 'liquidacion')
    OR ((c.name ILIKE '%report%' OR c.local_name ILIKE '%informe%') AND s.code = 'liquidacion')
    OR ((c.name ILIKE '%adjustment%' OR c.local_name ILIKE '%ajuste%') AND s.code = 'liquidacion')
    -- Cierre
    OR ((c.name ILIKE '%closure%' OR c.local_name ILIKE '%cierre%') AND s.code = 'cierre')
    -- Reapertura
    OR ((c.name ILIKE '%reopening%' OR c.local_name ILIKE '%reapertura%') AND s.code = 'reapertura')
    -- Prórroga
    OR ((c.name ILIKE '%extension%' OR c.local_name ILIKE '%prórroga%') AND s.code = 'prorroga')
    -- Impugnación
    OR ((c.name ILIKE '%appeal%' OR c.local_name ILIKE '%impugnación%') AND s.code = 'impugnacion')
    OR ((c.name ILIKE '%response%' OR c.local_name ILIKE '%respuesta%') AND s.code = 'impugnacion')
    -- Indemnización
    OR ((c.name ILIKE '%indemnity%' OR c.local_name ILIKE '%indemnización%') AND s.code = 'indemnizacion')
  )
ON CONFLICT (characteristic_id, screen_id) DO NOTHING;

-- Características genéricas sin match específico → pantalla genérica
INSERT INTO characteristic_screens (characteristic_id, screen_id, is_default)
SELECT c.id, s.id, true
FROM characteristic c
CROSS JOIN gestion_screens s
WHERE s.code = 'generica'
  AND c.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM characteristic_screens cs WHERE cs.characteristic_id = c.id
  )
ON CONFLICT (characteristic_id, screen_id) DO NOTHING;
