-- ═══════════════════════════════════════════════════════════════
-- 91: Catálogo de tipos de pantalla para gestiones
-- ═══════════════════════════════════════════════════════════════

-- Tipos de pantalla disponibles para gestiones con has_specific_screen
CREATE TABLE IF NOT EXISTS gestion_screen_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE gestion_screen_types IS 'Catálogo de tipos de pantalla que pueden asociarse a gestiones (action_template). Define qué formulario renderizar cuando se edita una gestión.';

-- Insertar tipos de pantalla basados en el sistema Tys
INSERT INTO gestion_screen_types (id, code, name, description, icon, sort_order) VALUES
  ('c1000001-0000-0000-0000-000000000001', 'email',          'Email / Aviso',         'Envío de correo con plantilla',                  'mail',        1),
  ('c1000001-0000-0000-0000-000000000002', 'coordinacion',   'Coordinación Inspección', 'Agendar/vincular inspección',                    'clipboard-check', 2),
  ('c1000001-0000-0000-0000-000000000003', 'coberturas',     'Coberturas',            'Registro de coberturas afectadas',               'shield',      3),
  ('c1000001-0000-0000-0000-000000000004', 'reserva',        'Reserva',               'Reserva de indemnización',                      'banknote',    4),
  ('c1000001-0000-0000-0000-000000000005', 'liquidacion',    'Liquidación / Informe',  'Informe de liquidación / ajuste',               'file-text',   5),
  ('c1000001-0000-0000-0000-000000000006', 'antecedentes',   'Solicitud Antecedentes', 'Solicitud y recepción de documentos',            'folder-open', 6),
  ('c1000001-0000-0000-0000-000000000007', 'cierre',         'Cierre',                'Cierre de siniestro',                            'lock',        7),
  ('c1000001-0000-0000-0000-000000000008', 'reapertura',     'Reapertura',            'Reapertura de siniestro',                        'rotate-ccw',  8),
  ('c1000001-0000-0000-0000-000000000009', 'prorroga',       'Prórroga',              'Solicitud de prórroga',                          'calendar-clock', 9),
  ('c1000001-0000-0000-0000-000000000010', 'impugnacion',    'Impugnación',           'Registro de impugnación',                        'alert-triangle', 10),
  ('c1000001-0000-0000-0000-000000000011', 'indemnizacion',  'Indemnización',         'Registro de indemnización / pago',               'credit-card', 11),
  ('c1000001-0000-0000-0000-000000000012', 'generica',       'Genérica',              'Formulario genérico configurable (JSON)',        'layout-template', 99)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order;

-- Agregar FK a action_template
ALTER TABLE action_template
  ADD COLUMN IF NOT EXISTS screen_type_id UUID REFERENCES gestion_screen_types(id) ON DELETE SET NULL;

COMMENT ON COLUMN action_template.screen_type_id IS 'Tipo de pantalla a renderizar cuando se edita esta gestión. NULL = sin pantalla específica.';

-- Índice
CREATE INDEX IF NOT EXISTS idx_action_template_screen_type
  ON action_template(screen_type_id)
  WHERE screen_type_id IS NOT NULL;
