-- Añade flag para permitir recaptura de geolocalización en sesiones remotas
-- La recaptura es autorizada por el liquidador/inspector desde el dashboard.

ALTER TABLE public.inspection_sessions
ADD COLUMN IF NOT EXISTS geo_recapture_enabled BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.inspection_sessions.geo_recapture_enabled IS
'Cuando es true, el asegurado puede recapturar su ubicación desde el magic link. Se resetea a false tras cada captura.';
