-- Migration 177: Unificar monedas en tabla currencies (eliminar de lookup_catalog)
--
-- Antes: claims.currency_id apuntaba a lookup_catalog(id) donde category='currency'
--        pero country_currencies y exchange_rates usaban currencies(code).
--        Habia dos definiciones de monedas con IDs diferentes → bug en el frontend.
--
-- Ahora: claims.currency_id apunta a currencies(id) como las demas tablas.
--        Las monedas se eliminan de lookup_catalog (autorizacion explicita del usuario).

-- ═══ 1. Drop FK viejo (que apunta a lookup_catalog) ═══
-- Necesario antes del UPDATE porque el FK viejo validaria contra lookup_catalog
-- y los nuevos IDs (de currencies) no existen ahi.

ALTER TABLE claims DROP CONSTRAINT IF EXISTS claims_currency_id_fkey;

-- ═══ 2. Migrar los currency_id de los claims ═══
-- Para cada claim, buscar su moneda en lookup_catalog, obtener el code,
-- y setear currency_id al ID correspondiente en currencies.

UPDATE claims cu
SET currency_id = cur.id
FROM lookup_catalog lc
JOIN currencies cur ON cur.code = lc.code
WHERE cu.currency_id = lc.id
  AND lc.category = 'currency';

-- Verificar que no quede ningun claim con currency_id huerfano
DO $$
DECLARE
  huerfanos int;
BEGIN
  SELECT count(*) INTO huerfanos
  FROM claims cu
  LEFT JOIN currencies cur ON cu.currency_id = cur.id
  WHERE cu.currency_id IS NOT NULL AND cur.id IS NULL;

  IF huerfanos > 0 THEN
    RAISE EXCEPTION 'Hay % claims con currency_id que no existen en currencies. Migracion abortada.', huerfanos;
  END IF;
END$$;

-- ═══ 3. Crear FK nuevo apuntando a currencies ═══

ALTER TABLE claims
  ADD CONSTRAINT claims_currency_id_fkey
  FOREIGN KEY (currency_id) REFERENCES currencies(id) ON DELETE RESTRICT;

-- ═══ 4. Eliminar las monedas de lookup_catalog ═══
-- (autorizacion explicita del usuario: "quita las monedas de lookup_catalog")

DELETE FROM lookup_catalog WHERE category = 'currency';

-- Verificar
SELECT 'monedas_en_lookup_catalog' as check, count(*) as total
FROM lookup_catalog WHERE category = 'currency';
