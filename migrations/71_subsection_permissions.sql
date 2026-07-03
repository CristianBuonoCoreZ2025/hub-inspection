-- ═══════════════════════════════════════════════════════════════
-- MIGRATION 71: Sub-section Permissions
-- Inserta permisos por sub-página para módulos que soportan drill-down.
-- Las sub-páginas heredan del módulo padre si no tienen permiso propio.
-- ═══════════════════════════════════════════════════════════════

-- Función auxiliar: insertar permiso de sub-sección heredando valores del padre
-- Si no existe permiso padre, usa false para todo.
CREATE OR REPLACE FUNCTION insert_subsection_permission(
  p_user_type TEXT,
  p_section TEXT,
  p_parent_section TEXT
) RETURNS VOID AS $$
DECLARE
  v_parent user_type_permissions%ROWTYPE;
BEGIN
  -- Buscar permiso del padre
  SELECT * INTO v_parent
  FROM user_type_permissions
  WHERE user_type = p_user_type AND section = p_parent_section;

  -- Insertar sub-sección con valores heredados del padre (o false si no existe)
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
-- Sub-páginas de CATÁLOGOS (16 páginas)
-- ═══════════════════════════════════════════════════════════════
-- Solo se crean si el usuario ya tiene configurado el padre.
-- Se insertan con los mismos valores del padre (herencia).

DO $$
DECLARE
  ut TEXT;
  sub TEXT;
  catalogos_subs TEXT[] := ARRAY[
    'catalogos_ubicaciones', 'catalogos_causas', 'catalogos_tipos_siniestros',
    'catalogos_eventos', 'catalogos_companias', 'catalogos_corredores',
    'catalogos_asesores', 'catalogos_lineas_negocio', 'catalogos_productos',
    'catalogos_tipos_polizas', 'catalogos_parentescos', 'catalogos_tipos_documentos',
    'catalogos_antiguedades', 'catalogos_clasificacion_bien',
    'catalogos_clasificacion_danos', 'catalogos_destinos_vivienda'
  ];
BEGIN
  FOR ut IN SELECT DISTINCT user_type FROM user_type_permissions WHERE section = 'catalogos' LOOP
    FOR sub IN SELECT unnest(catalogos_subs) LOOP
      PERFORM insert_subsection_permission(ut, sub, 'catalogos');
    END LOOP;
  END LOOP;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- Sub-páginas de CATÁLOGOS INSPECCIÓN (9 páginas)
-- ═══════════════════════════════════════════════════════════════
DO $$
DECLARE
  ut TEXT;
  sub TEXT;
  inspeccion_subs TEXT[] := ARRAY[
    'catalogos_inspeccion_muros', 'catalogos_inspeccion_cubierta',
    'catalogos_inspeccion_pavimentos', 'catalogos_inspeccion_cielos',
    'catalogos_inspeccion_cierre_perimetral',
    'catalogos_inspeccion_terminaciones_exteriores',
    'catalogos_inspeccion_terminaciones_interiores',
    'catalogos_inspeccion_relacion_asegurado',
    'catalogos_inspeccion_categorias_evidencia'
  ];
BEGIN
  FOR ut IN SELECT DISTINCT user_type FROM user_type_permissions WHERE section = 'catalogos_inspeccion' LOOP
    FOR sub IN SELECT unnest(inspeccion_subs) LOOP
      PERFORM insert_subsection_permission(ut, sub, 'catalogos_inspeccion');
    END LOOP;
  END LOOP;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- Sub-páginas de OPERACIONES (4 páginas)
-- ═══════════════════════════════════════════════════════════════
DO $$
DECLARE
  ut TEXT;
  sub TEXT;
  operaciones_subs TEXT[] := ARRAY[
    'operaciones_carga_siniestros', 'operaciones_carga_catalogos',
    'operaciones_inhabilitar', 'operaciones_reabrir'
  ];
BEGIN
  FOR ut IN SELECT DISTINCT user_type FROM user_type_permissions WHERE section = 'operaciones' LOOP
    FOR sub IN SELECT unnest(operaciones_subs) LOOP
      PERFORM insert_subsection_permission(ut, sub, 'operaciones');
    END LOOP;
  END LOOP;
END;
$$;

-- Limpiar función auxiliar
DROP FUNCTION IF EXISTS insert_subsection_permission(TEXT, TEXT, TEXT);

COMMENT ON TABLE user_type_permissions IS 'Permisos configurables por tipo de usuario. Define qué secciones puede ver, editar, crear y eliminar cada tipo. Soporta sub-secciones (ej: catalogos_causas) que heredan del módulo padre si no tienen permiso propio.';
