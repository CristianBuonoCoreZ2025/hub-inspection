-- Migración 334: helper SQL proper_address para direcciones
-- Aplica proper_case y luego normaliza abreviaturas de avenida/pasaje:
--   Av/    -> Av.
--   Avda.  -> Av.
--   Pasaje -> Psje.
--   Pje.   -> Psje.
--   Psje   -> Psje.

CREATE OR REPLACE FUNCTION proper_address(input text)
RETURNS text AS $$
DECLARE
  result text;
BEGIN
  IF input IS NULL THEN RETURN NULL; END IF;

  result := proper_case(input);

  -- Avenida
  result := replace(result, 'Av/', 'Av.');
  result := regexp_replace(result, 'Avda\.(\s|$)', 'Av.\1', 'g');
  result := regexp_replace(result, 'Avda(\s+)', 'Av.\1', 'g');
  -- Av. Avenida ... -> Av. ...
  result := regexp_replace(result, 'Av\.\s+Avenida(\s+|$)', 'Av.\1', 'g');

  -- Pasaje
  result := regexp_replace(result, 'Pasaje\.(\s+|$)', 'Psje.\1', 'g');
  result := regexp_replace(result, 'Pasaje(\s+|$)', 'Psje.\1', 'g');
  result := regexp_replace(result, 'Pje\.(\s+|$)', 'Psje.\1', 'g');
  result := regexp_replace(result, 'Pje(\s+|$)', 'Psje.\1', 'g');
  result := regexp_replace(result, 'Psje(\s+|$)', 'Psje.\1', 'g');

  RETURN trim(result);
END;
$$ LANGUAGE plpgsql IMMUTABLE;
