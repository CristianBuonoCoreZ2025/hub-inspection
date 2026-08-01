-- Migración 324: helper SQL proper_case inteligente
-- Transforma nombres/empresas a formato legible respetando preposiciones,
-- artículos, conjunciones y sufijos legales.
--
-- Ejemplos:
--   'CRISTIAN DE LA FUENTE'      -> 'Cristian de la Fuente'
--   'EMPRESA Y ASOCIADOS SPA'    -> 'Empresa y Asociados SpA'
--   'BANCO DE CHILE'             -> 'Banco de Chile'

CREATE OR REPLACE FUNCTION proper_case(input text)
RETURNS text AS $$
DECLARE
  words text[];
  result text := '';
  word text;
  first boolean := true;
  lower_words text[] := ARRAY[
    'a','al','con','de','del','desde','e','el','en','entre','hacia','hasta','la','las','lo','los','ni','o','para','por','segun','sin','sobre','tras','u','y','ya'
  ];
  keep_upper text[] := ARRAY[
    's.a.','s.a','spa','ltda.','ltda','e.i.r.l.','eirl','s.p.a.','s.p.a','srl','s.r.l.','s.r.l','s.c.','s.c','soc.','soc'
  ];
  keep_lower text[] := ARRAY[
    'de','del','la','las','los','el','lo','y','e','o','u','a','con','por','para','en','de','al','sin','sobre','hasta','desde','entre','hacia','tras','segun','ni','ya'
  ];
BEGIN
  IF input IS NULL THEN RETURN NULL; END IF;
  words := regexp_split_to_array(lower(trim(input)), '\s+');
  FOR i IN 1..array_length(words, 1) LOOP
    word := words[i];

    -- Si la palabra es un sufijo legal reconocido, dejarlo en mayúsculas
    IF lower(word) = ANY(keep_upper) THEN
      word := upper(word);
    ELSIF first THEN
      -- Siempre title case para la primera palabra
      word := initcap(word);
    ELSIF lower(word) = ANY(keep_lower) THEN
      -- Preposición/artículo/conjunción en minúscula
      word := lower(word);
    ELSE
      -- Resto: capitalizar normalmente
      word := initcap(word);
    END IF;

    result := result || word || ' ';
    first := false;
  END LOOP;

  RETURN trim(result);
END;
$$ LANGUAGE plpgsql IMMUTABLE;
