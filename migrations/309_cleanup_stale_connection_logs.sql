-- ═══════════════════════════════════════════════════════════════
-- Migración 309: Cerrar logs de conexión colgados
-- ═══════════════════════════════════════════════════════════════
-- Marca como desconectados todos los logs que quedaron en estado
-- connecting/success/retry sin fecha de desconexión y que tienen
-- más de 5 minutos de antigüedad. No borra datos.

UPDATE magic_link_connection_logs
SET
  status = 'disconnected',
  disconnected_at = now(),
  disconnect_reason = 'stale_cleanup'
WHERE disconnected_at IS NULL
  AND status IN ('connecting', 'success', 'retry')
  AND connected_at < now() - interval '5 minutes';
