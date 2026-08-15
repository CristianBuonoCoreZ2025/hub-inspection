-- ═══════════════════════════════════════════════════════════════
-- Migración 346: Sincronizar field_config de local a producción
-- ═══════════════════════════════════════════════════════════════
-- Objetivo: Poner el field_config de producción igual al de local
-- (formato 2 columnas + order + labels completos).
-- Reemplaza las migraciones 344 y 345 (no las necesita).
--
-- PRERREQUISITO: Migración 343 debe estar aplicada.
-- 
-- NO se borran datos. Se hace backup antes de sobrescribir.
-- ═══════════════════════════════════════════════════════════════

-- 1. Backup de seguridad
ALTER TABLE property_classifications
  ADD COLUMN IF NOT EXISTS field_config_backup jsonb;

UPDATE property_classifications
  SET field_config_backup = field_config
  WHERE field_config IS NOT NULL AND field_config_backup IS NULL;

-- 2. Sincronizar field_config de clasificaciones
-- Casa
UPDATE property_classifications SET field_config = '{"show": {"commercial": [], "residential": ["bathroom_count", "built_surface", "floor_count", "is_habitable", "room_count", "warehouse_count"]}, "order": {"room_count": 6, "floor_count": 4, "office_count": 11, "built_surface": 5, "business_line": 10, "bathroom_count": 7, "warehouse_count": 8, "apartment_number": 13}, "labels": {"age_years": {"residential": "Antigüedad del Inmueble"}, "owner_name": {"residential": "Nombre Propietario"}, "room_count": {"residential": "Cantidad Habitaciones"}, "floor_count": {"residential": "N° Pisos"}, "is_habitable": {"residential": "¿Se encuentra habitable?"}, "built_surface": {"residential": "Superficie Construida (m²)"}, "bathroom_count": {"residential": "Cantidad Baños"}, "warehouse_count": {"residential": "N° Bodegas"}, "worker_resident_count": {"residential": "N° Habitantes"}}}'::jsonb WHERE id = '4a8578a7-5b16-3f49-8627-54ae4660aff9';

-- Departamento
UPDATE property_classifications SET field_config = '{"show": {"commercial": [], "residential": ["apartment_number", "bathroom_count", "built_surface", "floor_count", "is_habitable", "room_count", "warehouse_count"]}, "order": {"is_habitable": 10, "office_count": 11, "warehouse_count": 9}, "labels": {"age_years": {"residential": "Antigüedad del Inmueble"}, "owner_name": {"residential": "Nombre Propietario"}, "room_count": {"residential": "Cantidad Habitaciones"}, "floor_count": {"residential": "N° Pisos"}, "is_habitable": {"residential": "¿Se encuentra habitable?"}, "built_surface": {"residential": "Superficie Construida (m²)"}, "bathroom_count": {"residential": "Cantidad Baños"}, "warehouse_count": {"residential": "N° Bodegas"}, "apartment_number": {"residential": "N° Dpto"}, "worker_resident_count": {"residential": "N° Habitantes"}}}'::jsonb WHERE id = '1430a2bb-e021-df75-5adf-1693c7e1d20b';

-- Edificio
UPDATE property_classifications SET field_config = '{"show": {"commercial": ["branch_count", "built_surface", "business_line", "floor_count", "is_habitable", "office_count", "room_count", "warehouse_count"], "residential": ["built_surface", "floor_count", "is_habitable", "office_count", "room_count", "warehouse_count"]}, "order": {"branch_count": 11, "is_habitable": 10, "office_count": 8, "business_line": 12, "bathroom_count": 13, "warehouse_count": 9}, "labels": {"age_years": {"commercial": "Antigüedad", "residential": "Antigüedad del Inmueble"}, "owner_name": {"commercial": "Nombre Representante", "residential": "Nombre Propietario"}, "room_count": "Cantidad Espacios", "is_habitable": {"commercial": "¿Se encuentra utilizable?", "residential": "¿Se encuentra habitable?"}, "office_count": {"commercial": "N° Oficinas", "residential": "N° Departamentos"}, "built_surface": "Superficie Construida (m²)", "worker_resident_count": {"commercial": "N° Trabajadores", "residential": "N° Habitantes"}}}'::jsonb WHERE id = 'bb0469d6-fd50-3093-5aff-44c152cedd3d';

-- Galpón
UPDATE property_classifications SET field_config = '{"show": {"commercial": ["bathroom_count", "built_surface", "business_line", "floor_count", "room_count", "warehouse_count"], "residential": []}, "order": {"floor_count": 6, "is_habitable": 11, "built_surface": 5, "business_line": 4, "warehouse_count": 9, "apartment_number": 13}, "labels": {"age_years": {"commercial": "Antigüedad"}, "owner_name": {"commercial": "Representante Legal"}, "worker_resident_count": {"commercial": "N° Trabajadores"}}}'::jsonb WHERE id = 'dd8669b7-9e81-e61f-b605-833cceb94e81';

-- Maquinaria
UPDATE property_classifications SET field_config = '{"show": {"commercial": ["business_line"], "residential": []}, "order": {"business_line": 4, "apartment_number": 13}, "labels": {"age_years": {"commercial": "Antigüedad del Producto"}, "owner_name": {"commercial": "Nombre Propietario(s)"}, "worker_resident_count": {"commercial": "N° Operadores"}}}'::jsonb WHERE id = '6f2da6a1-fd2e-8dc2-e1fb-9c4c1fee5bd0';

-- No Ingresado
UPDATE property_classifications SET field_config = '{}'::jsonb WHERE id = 'e55caf48-ccf4-c6d7-cd6b-89facd5e6dc6';

-- Oficinas
UPDATE property_classifications SET field_config = '{"show": {"commercial": ["apartment_number", "bathroom_count", "branch_count", "built_surface", "business_line", "floor_count", "office_count", "room_count", "warehouse_count"], "residential": []}, "order": {"room_count": 8, "branch_count": 11, "is_habitable": 13, "office_count": 7, "business_line": 12, "bathroom_count": 9, "warehouse_count": 10}, "labels": {"age_years": {"commercial": "Antigüedad de la Oficina"}, "owner_name": {"commercial": "Representante Legal"}, "apartment_number": {"commercial": "Nº Oficina"}, "worker_resident_count": {"commercial": "N° Trabajadores"}}}'::jsonb WHERE id = '56a7eaa3-a623-c874-bee1-e8171a12b345';

-- Otros
UPDATE property_classifications SET field_config = '{"show": {"commercial": ["bathroom_count", "built_surface", "business_line", "floor_count", "is_habitable", "office_count", "room_count", "warehouse_count"], "residential": ["bathroom_count", "built_surface", "floor_count", "is_habitable", "office_count", "room_count", "warehouse_count"]}, "order": {"room_count": 6, "office_count": 4, "built_surface": 3, "business_line": 10, "bathroom_count": 7, "warehouse_count": 8, "apartment_number": 13, "worker_resident_count": 11}, "labels": {"age_years": "Antigüedad", "owner_name": {"commercial": "Representante Legal", "residential": "Nombre Propietario"}, "office_count": {"commercial": "N° Oficinas", "residential": "N° Deptos"}}}'::jsonb WHERE id = '4c29a2b6-7eff-9cbc-b3c0-cdb2bb919386';

-- 3. Sincronizar field_config + destination_type de destinos
-- Comercial
UPDATE housing_destinations SET field_config = '{"hide": ["is_habitable", "apartment_number", "floor_count", "built_surface", "room_count", "bathroom_count"], "show": ["branch_count", "business_line", "warehouse_count", "office_count"], "labels": {"age_years": "Antiguedad", "owner_name": "Representante Legal", "apartment_number": "Oficina", "worker_resident_count": "N° Trabajadores"}}'::jsonb, destination_type = 'commercial' WHERE id = '26187e83-ac09-5367-c8f4-1367dd3a78eb';

-- Habitacional
UPDATE housing_destinations SET field_config = '{"hide": ["branch_count", "business_line", "apartment_number"], "show": ["room_count", "bathroom_count", "is_habitable", "warehouse_count"], "labels": {"owner_name": "Nombre Propietario(s)", "worker_resident_count": "N° Habitantes"}}'::jsonb, destination_type = 'residential' WHERE id = '14b456b5-8edb-8d29-51d9-32faceb1dfea';

-- 4. Verificación
-- SELECT name, jsonb_typeof(field_config->'labels') as labels_type,
--        jsonb_typeof(field_config->'show') as show_type,
--        field_config->'order' IS NOT NULL as has_order,
--        field_config_backup IS NOT NULL as has_backup
-- FROM property_classifications ORDER BY name;
-- 
-- SELECT name, destination_type FROM housing_destinations ORDER BY name;
-- 
-- SELECT count(*) FROM classification_destinations;
