-- ═══════════════════════════════════════════════════════════════
-- Migration 167: Sistema de Monedas y Tipos de Cambio
-- ═══════════════════════════════════════════════════════════════
-- 3 tablas:
--   currencies           — catálogo global de monedas del mundo
--   country_currencies   — relación país ↔ moneda (cuáles usa cada país)
--   exchange_rates       — tipos de cambio por país (cuánto vale cada moneda
--                          en la moneda base del país)
--
-- Ejemplo:
--   Chile usa CLP (base), UF, USD
--   Argentina usa ARS (base), USD
--   Perú usa PEN (base), USD
--
--   El USD en Chile vale ~950 CLP (rate_to_base=950, currency=USD, base=CLP)
--   El USD en Perú vale ~3.7 PEN (rate_to_base=3.7, currency=USD, base=PEN)
-- ═══════════════════════════════════════════════════════════════

-- ── Tabla 1: currencies (catálogo global de monedas) ──
CREATE TABLE IF NOT EXISTS currencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  symbol text,
  decimals integer NOT NULL DEFAULT 2,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE currencies IS 'Catálogo global de monedas del mundo';
COMMENT ON COLUMN currencies.code IS 'Código ISO 4217 (CLP, USD, EUR, etc.)';
COMMENT ON COLUMN currencies.symbol IS 'Símbolo ($, €, S/, R$)';
COMMENT ON COLUMN currencies.decimals IS 'Decimales a mostrar (CLP=0, USD=2)';

-- ── Tabla 2: country_currencies (relación país ↔ moneda) ──
CREATE TABLE IF NOT EXISTS country_currencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id uuid NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  currency_code text NOT NULL REFERENCES currencies(code) ON DELETE CASCADE,
  is_base boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(country_id, currency_code)
);

COMMENT ON TABLE country_currencies IS 'Relación país ↔ moneda (cuáles monedas usa cada país)';
COMMENT ON COLUMN country_currencies.is_base IS 'true = moneda base del país (solo una por país)';

-- Índice para buscar monedas por país
CREATE INDEX IF NOT EXISTS idx_country_currencies_country
  ON country_currencies(country_id) WHERE is_active = true;

-- Constraint: solo una moneda base por país
CREATE UNIQUE INDEX IF NOT EXISTS idx_country_currencies_base
  ON country_currencies(country_id) WHERE is_base = true;

-- ── Tabla 3: exchange_rates (tipos de cambio por país) ──
CREATE TABLE IF NOT EXISTS exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id uuid NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  currency_code text NOT NULL REFERENCES currencies(code) ON DELETE CASCADE,
  rate_to_base numeric(20,6) NOT NULL,
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(country_id, currency_code, effective_date)
);

COMMENT ON TABLE exchange_rates IS 'Tipos de cambio por país y fecha';
COMMENT ON COLUMN exchange_rates.rate_to_base IS 'Cuánto vale 1 unidad de esta moneda en la moneda base del país';
COMMENT ON COLUMN exchange_rates.effective_date IS 'Fecha de vigencia del tipo de cambio';

-- Índice para buscar el tipo de cambio más reciente
CREATE INDEX IF NOT EXISTS idx_exchange_rates_lookup
  ON exchange_rates(country_id, currency_code, effective_date DESC);

-- ═══════════════════════════════════════════════════════════════
-- SEED: Monedas del mundo
-- ═══════════════════════════════════════════════════════════════

INSERT INTO currencies (code, name, symbol, decimals) VALUES
  ('CLP', 'Peso Chileno', '$', 0),
  ('UF',  'Unidad de Fomento (CL)', 'UF', 2),
  ('USD', 'Dólar Americano', 'US$', 2),
  ('EUR', 'Euro', '€', 2),
  ('ARS', 'Peso Argentino', '$', 2),
  ('BRL', 'Real Brasileño', 'R$', 2),
  ('BOB', 'Boliviano (Bolivia)', 'Bs', 2),
  ('COP', 'Peso Colombiano', '$', 0),
  ('PEN', 'Sol Peruano', 'S/', 2),
  ('PYG', 'Guaraní (Paraguay)', '₲', 0),
  ('UYU', 'Peso Uruguayo', '$U', 2),
  ('MXN', 'Peso Mexicano', '$', 2),
  ('GBP', 'Libra Esterlina', '£', 2),
  ('CHF', 'Franco Suizo', 'Fr', 2),
  ('JPY', 'Yen Japonés', '¥', 0),
  ('CNY', 'Yuan Chino', '¥', 2),
  ('CAD', 'Dólar Canadiense', 'C$', 2),
  ('AUD', 'Dólar Australiano', 'A$', 2)
ON CONFLICT (code) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- SEED: Relaciones país ↔ moneda
-- ═══════════════════════════════════════════════════════════════

-- Chile: CLP (base), UF, USD
INSERT INTO country_currencies (country_id, currency_code, is_base, sort_order)
SELECT c.id, 'CLP', true, 1 FROM countries c WHERE c.code = 'CL'
ON CONFLICT (country_id, currency_code) DO NOTHING;
INSERT INTO country_currencies (country_id, currency_code, is_base, sort_order)
SELECT c.id, 'UF', false, 2 FROM countries c WHERE c.code = 'CL'
ON CONFLICT (country_id, currency_code) DO NOTHING;
INSERT INTO country_currencies (country_id, currency_code, is_base, sort_order)
SELECT c.id, 'USD', false, 3 FROM countries c WHERE c.code = 'CL'
ON CONFLICT (country_id, currency_code) DO NOTHING;

-- Argentina: ARS (base), USD
INSERT INTO country_currencies (country_id, currency_code, is_base, sort_order)
SELECT c.id, 'ARS', true, 1 FROM countries c WHERE c.code = 'AR'
ON CONFLICT (country_id, currency_code) DO NOTHING;
INSERT INTO country_currencies (country_id, currency_code, is_base, sort_order)
SELECT c.id, 'USD', false, 2 FROM countries c WHERE c.code = 'AR'
ON CONFLICT (country_id, currency_code) DO NOTHING;

-- Brasil: BRL (base), USD
INSERT INTO country_currencies (country_id, currency_code, is_base, sort_order)
SELECT c.id, 'BRL', true, 1 FROM countries c WHERE c.code = 'BR'
ON CONFLICT (country_id, currency_code) DO NOTHING;
INSERT INTO country_currencies (country_id, currency_code, is_base, sort_order)
SELECT c.id, 'USD', false, 2 FROM countries c WHERE c.code = 'BR'
ON CONFLICT (country_id, currency_code) DO NOTHING;

-- Bolivia: BOB (base), USD
INSERT INTO country_currencies (country_id, currency_code, is_base, sort_order)
SELECT c.id, 'BOB', true, 1 FROM countries c WHERE c.code = 'BO'
ON CONFLICT (country_id, currency_code) DO NOTHING;
INSERT INTO country_currencies (country_id, currency_code, is_base, sort_order)
SELECT c.id, 'USD', false, 2 FROM countries c WHERE c.code = 'BO'
ON CONFLICT (country_id, currency_code) DO NOTHING;

-- Colombia: COP (base), USD
INSERT INTO country_currencies (country_id, currency_code, is_base, sort_order)
SELECT c.id, 'COP', true, 1 FROM countries c WHERE c.code = 'CO'
ON CONFLICT (country_id, currency_code) DO NOTHING;
INSERT INTO country_currencies (country_id, currency_code, is_base, sort_order)
SELECT c.id, 'USD', false, 2 FROM countries c WHERE c.code = 'CO'
ON CONFLICT (country_id, currency_code) DO NOTHING;

-- Perú: PEN (base), USD
INSERT INTO country_currencies (country_id, currency_code, is_base, sort_order)
SELECT c.id, 'PEN', true, 1 FROM countries c WHERE c.code = 'PE'
ON CONFLICT (country_id, currency_code) DO NOTHING;
INSERT INTO country_currencies (country_id, currency_code, is_base, sort_order)
SELECT c.id, 'USD', false, 2 FROM countries c WHERE c.code = 'PE'
ON CONFLICT (country_id, currency_code) DO NOTHING;

-- Paraguay: PYG (base), USD
INSERT INTO country_currencies (country_id, currency_code, is_base, sort_order)
SELECT c.id, 'PYG', true, 1 FROM countries c WHERE c.code = 'PY'
ON CONFLICT (country_id, currency_code) DO NOTHING;
INSERT INTO country_currencies (country_id, currency_code, is_base, sort_order)
SELECT c.id, 'USD', false, 2 FROM countries c WHERE c.code = 'PY'
ON CONFLICT (country_id, currency_code) DO NOTHING;

-- Ecuador: USD (base — Ecuador usa USD como moneda oficial)
INSERT INTO country_currencies (country_id, currency_code, is_base, sort_order)
SELECT c.id, 'USD', true, 1 FROM countries c WHERE c.code = 'EC'
ON CONFLICT (country_id, currency_code) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- SEED: Tipos de cambio iniciales (aproximados, hoy)
-- ═══════════════════════════════════════════════════════════════

-- Chile: USD → CLP
INSERT INTO exchange_rates (country_id, currency_code, rate_to_base, source)
SELECT c.id, 'USD', 950.0, 'manual' FROM countries c WHERE c.code = 'CL'
ON CONFLICT (country_id, currency_code, effective_date) DO NOTHING;

-- Chile: UF → CLP
INSERT INTO exchange_rates (country_id, currency_code, rate_to_base, source)
SELECT c.id, 'UF', 38000.0, 'manual' FROM countries c WHERE c.code = 'CL'
ON CONFLICT (country_id, currency_code, effective_date) DO NOTHING;

-- Argentina: USD → ARS
INSERT INTO exchange_rates (country_id, currency_code, rate_to_base, source)
SELECT c.id, 'USD', 1000.0, 'manual' FROM countries c WHERE c.code = 'AR'
ON CONFLICT (country_id, currency_code, effective_date) DO NOTHING;

-- Brasil: USD → BRL
INSERT INTO exchange_rates (country_id, currency_code, rate_to_base, source)
SELECT c.id, 'USD', 5.5, 'manual' FROM countries c WHERE c.code = 'BR'
ON CONFLICT (country_id, currency_code, effective_date) DO NOTHING;

-- Bolivia: USD → BOB
INSERT INTO exchange_rates (country_id, currency_code, rate_to_base, source)
SELECT c.id, 'USD', 6.9, 'manual' FROM countries c WHERE c.code = 'BO'
ON CONFLICT (country_id, currency_code, effective_date) DO NOTHING;

-- Colombia: USD → COP
INSERT INTO exchange_rates (country_id, currency_code, rate_to_base, source)
SELECT c.id, 'USD', 4000.0, 'manual' FROM countries c WHERE c.code = 'CO'
ON CONFLICT (country_id, currency_code, effective_date) DO NOTHING;

-- Perú: USD → PEN
INSERT INTO exchange_rates (country_id, currency_code, rate_to_base, source)
SELECT c.id, 'USD', 3.7, 'manual' FROM countries c WHERE c.code = 'PE'
ON CONFLICT (country_id, currency_code, effective_date) DO NOTHING;

-- Paraguay: USD → PYG
INSERT INTO exchange_rates (country_id, currency_code, rate_to_base, source)
SELECT c.id, 'USD', 7300.0, 'manual' FROM countries c WHERE c.code = 'PY'
ON CONFLICT (country_id, currency_code, effective_date) DO NOTHING;
