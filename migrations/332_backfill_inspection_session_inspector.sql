-- Rellenar inspector_id en inspecciones existentes que lo tengan null,
-- tomando el valor del siniestro asociado.
UPDATE public.inspection_sessions
SET inspector_id = c.inspector_id
FROM public.claims c
WHERE inspection_sessions.claim_id = c.id
  AND inspection_sessions.inspector_id IS NULL
  AND c.inspector_id IS NOT NULL;
