-- Migración 257: Arregla el trigger next_email_correlativo()
-- El trigger de la migración 256 usaba `FOR UPDATE` con `MAX()` (función agregada),
-- lo cual PostgreSQL no permite: "FOR UPDATE is not allowed with aggregate functions".
--
-- Solución: usar SELECT ... FOR UPDATE sobre las filas individuales con un subquery,
-- o mejor, usar pg_advisory_xact_lock() para lockear a nivel de transacción por
-- claim_action_id (más eficiente que lockear filas).

-- Recrear la función con lock correcto
CREATE OR REPLACE FUNCTION next_email_correlativo()
RETURNS TRIGGER AS $$
DECLARE
  next_val INT;
  lock_key BIGINT;
BEGIN
  -- Lock a nivel de transacción por claim_action_id (evita race conditions
  -- sin necesidad de FOR UPDATE sobre filas). Hash simple del UUID.
  lock_key := hashtext(NEW.claim_action_id::text);
  PERFORM pg_advisory_xact_lock(lock_key);

  SELECT COALESCE(MAX(correlativo), 0) + 1
    INTO next_val
    FROM email_logs
    WHERE claim_action_id = NEW.claim_action_id;

  NEW.correlativo := next_val;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
