-- ═══════════════════════════════════════════════════════════════════
-- Migración 64: Actualizar claim_status + catálogos del cliente
-- ═══════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────
-- PARTE 1: CLAIM_STATUS — Reemplazar 7 estados por los 5 del cliente
-- ───────────────────────────────────────────────────────────────────
-- Cliente: Created(1), Adjustment(2), Dispatchment(3), Closed(4), Reopened(5)

-- IDs actuales:
--   created:      99c36f4e-4868-44c0-8fb4-78517424d727
--   scheduled:    4268814a-cc5f-4886-a280-5cc2a1a4695d
--   in_progress:  10088b7e-6f51-4c84-8cdd-42c64b2140af
--   in_review:    2f0c77f3-845b-4150-a3e4-503b6b326af2
--   closed:       7b8292f3-34cd-4296-aee7-2c8135cb1b16
--   pending_info: 3373c0fa-da24-47db-80ac-4f5c403dfb61
--   signed:       02fe13f6-849b-461d-b601-943b05d8056c

-- 1a. Reasignar claims que referencian estados que desaparecen
-- in_review → in_progress (que pasará a ser adjustment)
UPDATE claims SET status_id = '10088b7e-6f51-4c84-8cdd-42c64b2140af'
WHERE status_id = '2f0c77f3-845b-4150-a3e4-503b6b326af2';

-- pending_info → created
UPDATE claims SET status_id = '99c36f4e-4868-44c0-8fb4-78517424d727'
WHERE status_id = '3373c0fa-da24-47db-80ac-4f5c403dfb61';

-- signed → closed (firmado = cerrado)
UPDATE claims SET status_id = '7b8292f3-34cd-4296-aee7-2c8135cb1b16'
WHERE status_id = '02fe13f6-849b-461d-b601-943b05d8056c';

-- 1b. Eliminar estados que ya no existen
DELETE FROM lookup_catalog
WHERE id IN (
  '2f0c77f3-845b-4150-a3e4-503b6b326af2', -- in_review
  '3373c0fa-da24-47db-80ac-4f5c403dfb61'  -- pending_info
);

-- 1c. Actualizar los 5 estados restantes a los del cliente
UPDATE lookup_catalog SET code = 'created',      name = 'Creación',   sort_order = 1, updated_at = now()
WHERE id = '99c36f4e-4868-44c0-8fb4-78517424d727';

UPDATE lookup_catalog SET code = 'adjustment',   name = 'Liquidación', sort_order = 2, updated_at = now()
WHERE id = '10088b7e-6f51-4c84-8cdd-42c64b2140af';

UPDATE lookup_catalog SET code = 'dispatchment', name = 'Despacho',    sort_order = 3, updated_at = now()
WHERE id = '4268814a-cc5f-4886-a280-5cc2a1a4695d';

UPDATE lookup_catalog SET code = 'closed',       name = 'Cierre',      sort_order = 4, updated_at = now()
WHERE id = '7b8292f3-34cd-4296-aee7-2c8135cb1b16';

UPDATE lookup_catalog SET code = 'reopened',     name = 'Reapertura',  sort_order = 5, updated_at = now()
WHERE id = '02fe13f6-849b-461d-b601-943b05d8056c';

-- ═══════════════════════════════════════════════════════════════════
-- PARTE 2: INTERNATIONAL PHONE CODES (6 filas)
-- ═══════════════════════════════════════════════════════════════════
INSERT INTO lookup_catalog (country_id, category, code, name, sort_order, is_active)
VALUES
  ('2075e6cc-376a-415a-bb2c-0fc28d6856bc', 'international_phone_code', '54', 'Argentina (+54)', 1, true),
  ('406d5bcc-7f0a-42d3-8289-dc8273d6fb04', 'international_phone_code', '55', 'Brasil (+55)', 2, true),
  ('26b7647a-9fbe-4c32-ada3-338257ba693f', 'international_phone_code', '57', 'Colombia (+57)', 3, true),
  ('9b8807b5-0af1-4331-b576-3b09b6a1db31', 'international_phone_code', '56', 'Chile (+56)', 4, true),
  ('dc4a4c2e-c17c-4432-bd21-3ce229fd8623', 'international_phone_code', '51', 'Perú (+51)', 5, true),
  (null, 'international_phone_code', '52', 'México (+52)', 6, true)
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════
-- PARTE 3: BANK — Bancos de Chile (25 filas)
-- ═══════════════════════════════════════════════════════════════════
INSERT INTO lookup_catalog (country_id, category, code, name, description, sort_order, is_active)
VALUES
  ('9b8807b5-0af1-4331-b576-3b09b6a1db31', 'bank', '001', 'Banco de Chile', 'Opera también bajo las marcas Banco Edwards, City, Atlas y CrediChile', 1, true),
  ('9b8807b5-0af1-4331-b576-3b09b6a1db31', 'bank', '009', 'Banco Internacional', null, 2, true),
  ('9b8807b5-0af1-4331-b576-3b09b6a1db31', 'bank', '014', 'Scotiabank Chile', 'Opera también con la marca BancoDesarrollo', 3, true),
  ('9b8807b5-0af1-4331-b576-3b09b6a1db31', 'bank', '016', 'Banco de Crédito e Inversiones', 'Opera también con las marcas TBanc y Banco Nova', 4, true),
  ('9b8807b5-0af1-4331-b576-3b09b6a1db31', 'bank', '028', 'Banco Bice', null, 5, true),
  ('9b8807b5-0af1-4331-b576-3b09b6a1db31', 'bank', '031', 'HSBC Bank', null, 6, true),
  ('9b8807b5-0af1-4331-b576-3b09b6a1db31', 'bank', '037', 'Banco Santander-Chile', 'Opera también con la marca Banefe', 7, true),
  ('9b8807b5-0af1-4331-b576-3b09b6a1db31', 'bank', '039', 'Banco Itaú Chile', 'Desde el 1 de abril de 2016 se fusiona el Banco Corpbanca en Itaú Corpbanca', 8, true),
  ('9b8807b5-0af1-4331-b576-3b09b6a1db31', 'bank', '049', 'Banco Security', null, 9, true),
  ('9b8807b5-0af1-4331-b576-3b09b6a1db31', 'bank', '051', 'Banco Falabella', null, 10, true),
  ('9b8807b5-0af1-4331-b576-3b09b6a1db31', 'bank', '053', 'Banco Ripley', null, 11, true),
  ('9b8807b5-0af1-4331-b576-3b09b6a1db31', 'bank', '012', 'Banco Estado', 'Banco del Estado de Chile', 12, true),
  ('9b8807b5-0af1-4331-b576-3b09b6a1db31', 'bank', '041', 'JP Morgan Chase Bank', 'Sucursal de banco extranjero', 13, true),
  ('9b8807b5-0af1-4331-b576-3b09b6a1db31', 'bank', '060', 'China Construction Bank, agencia en Chile', 'Sucursal de banco extranjero', 14, true),
  ('9b8807b5-0af1-4331-b576-3b09b6a1db31', 'bank', '061', 'Bank of China, agencia en Chile', 'Sucursal de banco extranjero', 15, true),
  ('9b8807b5-0af1-4331-b576-3b09b6a1db31', 'bank', '741', 'Compañía emisora de medios de pagos digitales', 'Emisor tarjeta de pago - Copec', 16, true),
  ('9b8807b5-0af1-4331-b576-3b09b6a1db31', 'bank', '739', 'Digital Payments Prepago', 'Emisor tarjeta de pago', 17, true),
  ('9b8807b5-0af1-4331-b576-3b09b6a1db31', 'bank', '738', 'Global Card', 'Emisor tarjeta de pago', 18, true),
  ('9b8807b5-0af1-4331-b576-3b09b6a1db31', 'bank', '697', 'Inversiones LP', 'Emisor tarjeta de pago/crédito', 19, true),
  ('9b8807b5-0af1-4331-b576-3b09b6a1db31', 'bank', '732', 'Los Andes Tarjetas de prepago', 'Emisor tarjeta de pago', 20, true),
  ('9b8807b5-0af1-4331-b576-3b09b6a1db31', 'bank', '875', 'Mercado Pago', 'Emisor tarjeta de pago', 21, true),
  ('9b8807b5-0af1-4331-b576-3b09b6a1db31', 'bank', '729', 'Sociedad emisora de Tarjetas Los Héroes', 'Emisor tarjeta de pago', 22, true),
  ('9b8807b5-0af1-4331-b576-3b09b6a1db31', 'bank', '730', 'Tenpo Payments', 'Emisor tarjeta de pago/crédito', 23, true),
  ('9b8807b5-0af1-4331-b576-3b09b6a1db31', 'bank', '699', 'Tricard', 'Emisor tarjeta de pago/crédito', 24, true),
  ('9b8807b5-0af1-4331-b576-3b09b6a1db31', 'bank', '744', 'Sumup Chile', 'Emisor tarjeta de pago', 25, true)
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════
-- PARTE 4: CLOSE_REASON — Motivos de cierre (9 filas)
-- ═══════════════════════════════════════════════════════════════════
INSERT INTO lookup_catalog (country_id, category, code, name, sort_order, is_active)
VALUES
  ('9b8807b5-0af1-4331-b576-3b09b6a1db31', 'close_reason', '1', 'Anulación Interna', 1, true),
  ('9b8807b5-0af1-4331-b576-3b09b6a1db31', 'close_reason', '2', 'Cierre a solicitud de compañía', 2, true),
  ('9b8807b5-0af1-4331-b576-3b09b6a1db31', 'close_reason', '3', 'Cierre por desistimiento', 3, true),
  ('9b8807b5-0af1-4331-b576-3b09b6a1db31', 'close_reason', '4', 'Cierre por devolución de antecedentes', 4, true),
  ('9b8807b5-0af1-4331-b576-3b09b6a1db31', 'close_reason', '5', 'Cierre por duplicidad', 5, true),
  ('9b8807b5-0af1-4331-b576-3b09b6a1db31', 'close_reason', '6', 'Impugnación pendiente de antecedentes adicionales', 6, true),
  ('9b8807b5-0af1-4331-b576-3b09b6a1db31', 'close_reason', '7', 'Impugnación rechazada sin pago', 7, true),
  ('9b8807b5-0af1-4331-b576-3b09b6a1db31', 'close_reason', '8', 'Reclamo/consulta respondidos', 8, true),
  ('9b8807b5-0af1-4331-b576-3b09b6a1db31', 'close_reason', '9', 'Cierre Normal', 9, true)
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════
-- PARTE 5: REJECTION_REASON — Motivos de rechazo específicos (12 filas)
-- ═══════════════════════════════════════════════════════════════════
INSERT INTO lookup_catalog (country_id, category, code, name, sort_order, is_active)
VALUES
  ('9b8807b5-0af1-4331-b576-3b09b6a1db31', 'rejection_reason', '1', 'Póliza no cuenta con cláusula de cobertura', 1, true),
  ('9b8807b5-0af1-4331-b576-3b09b6a1db31', 'rejection_reason', '2', 'Siniestro fuera de vigencia', 2, true),
  ('9b8807b5-0af1-4331-b576-3b09b6a1db31', 'rejection_reason', '3', 'No cumple garantía de seguridad', 3, true),
  ('9b8807b5-0af1-4331-b576-3b09b6a1db31', 'rejection_reason', '4', 'Riesgo no incluido en póliza', 4, true),
  ('9b8807b5-0af1-4331-b576-3b09b6a1db31', 'rejection_reason', '5', 'Exclusiones y/o preexistencias', 5, true),
  ('9b8807b5-0af1-4331-b576-3b09b6a1db31', 'rejection_reason', '6', 'Bajo deducible o franquicia', 6, true),
  ('9b8807b5-0af1-4331-b576-3b09b6a1db31', 'rejection_reason', '7', 'Incumplimiento de contrato por parte del asegurado', 7, true),
  ('9b8807b5-0af1-4331-b576-3b09b6a1db31', 'rejection_reason', '8', 'Cierre por falta de antecedentes', 8, true),
  ('9b8807b5-0af1-4331-b576-3b09b6a1db31', 'rejection_reason', '9', 'Siniestro denunciado fuera de plazo', 9, true),
  ('9b8807b5-0af1-4331-b576-3b09b6a1db31', 'rejection_reason', '10', 'Sin daños en materia asegurada', 10, true),
  ('9b8807b5-0af1-4331-b576-3b09b6a1db31', 'rejection_reason', '11', 'Desistimiento del asegurado', 11, true),
  ('9b8807b5-0af1-4331-b576-3b09b6a1db31', 'rejection_reason', '12', 'Daños cubiertos en otro siniestro', 12, true)
ON CONFLICT DO NOTHING;
