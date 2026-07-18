-- ═══════════════════════════════════════════════════════════════
-- Migration 168: RLS policies para currencies, country_currencies, exchange_rates
-- ═══════════════════════════════════════════════════════════════
-- Las tablas se crearon en la migración 167 con RLS activado
-- pero sin políticas, por lo que el cliente no podía ver ningún dato.
-- ═══════════════════════════════════════════════════════════════

-- ── currencies ──
DROP POLICY IF EXISTS currencies_select ON currencies;
DROP POLICY IF EXISTS currencies_insert ON currencies;
DROP POLICY IF EXISTS currencies_update ON currencies;
DROP POLICY IF EXISTS currencies_delete ON currencies;

CREATE POLICY currencies_select ON currencies FOR SELECT USING (true);
CREATE POLICY currencies_insert ON currencies FOR INSERT WITH CHECK (true);
CREATE POLICY currencies_update ON currencies FOR UPDATE USING (true);
CREATE POLICY currencies_delete ON currencies FOR DELETE USING (true);

-- ── country_currencies ──
DROP POLICY IF EXISTS country_currencies_select ON country_currencies;
DROP POLICY IF EXISTS country_currencies_insert ON country_currencies;
DROP POLICY IF EXISTS country_currencies_update ON country_currencies;
DROP POLICY IF EXISTS country_currencies_delete ON country_currencies;

CREATE POLICY country_currencies_select ON country_currencies FOR SELECT USING (true);
CREATE POLICY country_currencies_insert ON country_currencies FOR INSERT WITH CHECK (true);
CREATE POLICY country_currencies_update ON country_currencies FOR UPDATE USING (true);
CREATE POLICY country_currencies_delete ON country_currencies FOR DELETE USING (true);

-- ── exchange_rates ──
DROP POLICY IF EXISTS exchange_rates_select ON exchange_rates;
DROP POLICY IF EXISTS exchange_rates_insert ON exchange_rates;
DROP POLICY IF EXISTS exchange_rates_update ON exchange_rates;
DROP POLICY IF EXISTS exchange_rates_delete ON exchange_rates;

CREATE POLICY exchange_rates_select ON exchange_rates FOR SELECT USING (true);
CREATE POLICY exchange_rates_insert ON exchange_rates FOR INSERT WITH CHECK (true);
CREATE POLICY exchange_rates_update ON exchange_rates FOR UPDATE USING (true);
CREATE POLICY exchange_rates_delete ON exchange_rates FOR DELETE USING (true);
