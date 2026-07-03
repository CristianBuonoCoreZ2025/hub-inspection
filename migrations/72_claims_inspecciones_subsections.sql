-- ═══════════════════════════════════════════════════════════════
-- MIGRATION 72: Sub-section Permissions for Claims and Inspecciones
-- Inserta permisos por sub-página para Siniestros e Inspecciones.
-- Las sub-páginas heredan del módulo padre si no tienen permiso propio.
-- ═══════════════════════════════════════════════════════════════

-- Función auxiliar: insertar permiso de sub-sección heredando valores del padre
CREATE OR REPLACE FUNCTION insert_subsection_permission(
  p_user_type TEXT,
  p_section TEXT,
  p_parent_section TEXT
) RETURNS VOID AS $$
DECLARE
  v_parent user_type_permissions%ROWTYPE;
BEGIN
  SELECT * INTO v_parent
  FROM user_type_permissions
  WHERE user_type = p_user_type AND section = p_parent_section;

  INSERT INTO user_type_permissions (user_type, section, can_view, can_edit, can_create, can_delete)
  VALUES (
    p_user_type,
    p_section,
    COALESCE(v_parent.can_view, false),
    COALESCE(v_parent.can_edit, false),
    COALESCE(v_parent.can_create, false),
    COALESCE(v_parent.can_delete, false)
  )
  ON CONFLICT (user_type, section) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════
-- Sub-páginas de SINIESTROS (7 pantallas)
-- ═══════════════════════════════════════════════════════════════
DO $$
DECLARE
  ut TEXT;
  sub TEXT;
  claims_subs TEXT[] := ARRAY[
    'claims_listado', 'claims_detalle', 'claims_participantes',
    'claims_incidente', 'claims_gestiones', 'claims_documentos',
    'claims_log'
  ];
BEGIN
  FOR ut IN SELECT DISTINCT user_type FROM user_type_permissions WHERE section = 'claims' LOOP
    FOR sub IN SELECT unnest(claims_subs) LOOP
      PERFORM insert_subsection_permission(ut, sub, 'claims');
    END LOOP;
  END LOOP;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- Sub-páginas de INSPECCIONES (8 pantallas)
-- ═══════════════════════════════════════════════════════════════
DO $$
DECLARE
  ut TEXT;
  sub TEXT;
  inspecciones_subs TEXT[] := ARRAY[
    'inspecciones_listado', 'inspecciones_detalle', 'inspecciones_acta',
    'inspecciones_danos', 'inspecciones_evidencias', 'inspecciones_croquis',
    'inspecciones_firmas', 'inspecciones_informe'
  ];
BEGIN
  FOR ut IN SELECT DISTINCT user_type FROM user_type_permissions WHERE section = 'inspecciones' LOOP
    FOR sub IN SELECT unnest(inspecciones_subs) LOOP
      PERFORM insert_subsection_permission(ut, sub, 'inspecciones');
    END LOOP;
  END LOOP;
END;
$$;

-- Limpiar función auxiliar
DROP FUNCTION IF EXISTS insert_subsection_permission(TEXT, TEXT, TEXT);
