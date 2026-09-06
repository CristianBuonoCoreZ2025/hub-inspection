-- ═══════════════════════════════════════════════════════════════
-- Migración 364: Hubi Assistant con GraphRAG (pgvector)
-- ═══════════════════════════════════════════════════════════════
--
-- Crea:
-- 1. hubi_docs              — documentación embebida (how-to, manuales)
-- 2. hubi_conversations     — conversaciones por usuario
-- 3. hubi_messages          — mensajes de cada conversación
-- 4. hubi_entity_memory     — memoria de entidades mencionadas por usuario
-- 5. RPC match_hubi()       — búsqueda híbrida (vector + FTS + graph traversal)
--
-- Requiere: extensión vector (pgvector)
-- ═══════════════════════════════════════════════════════════════

-- ── 1. hubi_docs (Documentación embebida) ──
CREATE TABLE IF NOT EXISTS hubi_docs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,          -- 'AGENTS.md' | 'docs/DESIGN_SYSTEM.md' | etc.
  section TEXT,                  -- sección o título
  content TEXT NOT NULL,         -- texto del documento
  embedding VECTOR(384),         -- embedding del content (Xenova/all-MiniLM-L6-v2, 384 dims)
  metadata JSONB DEFAULT '{}',   -- tags, categoría, roles permitidos
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índice HNSW para búsqueda vectorial rápida
CREATE INDEX IF NOT EXISTS idx_hubi_docs_embedding ON hubi_docs
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Full-text search sobre el contenido
ALTER TABLE hubi_docs ADD COLUMN IF NOT EXISTS tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('spanish', content)) STORED;
CREATE INDEX IF NOT EXISTS idx_hubi_docs_tsv ON hubi_docs USING gin(tsv);

-- RLS: docs son lectura pública (documentación de la app)
ALTER TABLE hubi_docs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hubi_docs_select" ON hubi_docs FOR SELECT USING (true);

-- ── 2. hubi_conversations (Conversaciones por usuario) ──
CREATE TABLE IF NOT EXISTS hubi_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,         -- profile.id
  title TEXT,                    -- auto-generado del primer mensaje
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hubi_conversations_user ON hubi_conversations(user_id);

ALTER TABLE hubi_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hubi_conversations_own" ON hubi_conversations
  FOR ALL USING (user_id = (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid()));

-- ── 3. hubi_messages (Mensajes de conversación) ──
CREATE TABLE IF NOT EXISTS hubi_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES hubi_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,            -- 'user' | 'assistant' | 'tool'
  content TEXT NOT NULL,
  tool_calls JSONB,              -- si el asistente llamó tools
  tool_result JSONB,             -- resultado de la tool
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hubi_messages_conversation ON hubi_messages(conversation_id);

ALTER TABLE hubi_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hubi_messages_own" ON hubi_messages FOR ALL USING (
  conversation_id IN (
    SELECT id FROM hubi_conversations
    WHERE user_id = (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
  )
);

-- ── 4. hubi_entity_memory (Memoria de entidades por usuario) ──
CREATE TABLE IF NOT EXISTS hubi_entity_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,         -- profile.id
  entity_type TEXT NOT NULL,     -- 'claim' | 'person' | 'inspection'
  entity_id UUID NOT NULL,
  entity_label TEXT,             -- nombre legible
  mention_count INT DEFAULT 1,
  last_mentioned TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_hubi_entity_memory_user ON hubi_entity_memory(user_id);

ALTER TABLE hubi_entity_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hubi_entity_memory_own" ON hubi_entity_memory
  FOR ALL USING (user_id = (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid()));

-- ── 5. RPC match_hubi() — Búsqueda híbrida GraphRAG ──
-- Combina 3 carriles de recuperación:
--   a) Vector: búsqueda semántica sobre documentación (how-to)
--   b) Full-text: búsqueda exacta por nombre en claims_participants
--   c) Graph: traversal relacional (claims → inspection_sessions → profiles)
--
-- Respeta RLS: usa auth.uid() para filtrar claims accesibles al usuario
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION match_hubi(
  p_query_text TEXT,
  p_query_embedding VECTOR(384),
  p_match_count INT DEFAULT 10,
  p_user_role TEXT DEFAULT NULL
)
RETURNS TABLE (
  source TEXT,           -- 'docs' | 'person' | 'claim'
  entity_id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT,
  graph_context JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- ── Carril 1: Vector search sobre documentación ──
  -- Filtra docs por rol del usuario (metadata.roles)
  RETURN QUERY
  SELECT
    'docs'::TEXT AS source,
    d.id AS entity_id,
    d.content AS content,
    d.metadata AS metadata,
    (1 - (d.embedding <=> p_query_embedding))::FLOAT AS similarity,
    NULL::JSONB AS graph_context
  FROM hubi_docs d
  WHERE 1 - (d.embedding <=> p_query_embedding) > 0.65
    AND (
      p_user_role IS NULL
      OR (d.metadata->'roles') ? 'all'
      OR (d.metadata->'roles') ? p_user_role
    )
  ORDER BY d.embedding <=> p_query_embedding
  LIMIT p_match_count;

  -- ── Carril 2: Full-text search sobre claims_participants ──
  -- Encuentra personas por nombre exacto + graph traversal a sus claims
  IF p_query_text IS NOT NULL AND length(trim(p_query_text)) >= 3 THEN
    RETURN QUERY
    SELECT
      'person'::TEXT AS source,
      cp.id AS entity_id,
      cp.full_name AS content,
      jsonb_build_object(
        'type', cp.type,
        'claim_id', cp.claim_id,
        'rut', cp.rut
      ) AS metadata,
      (ts_rank(to_tsvector('spanish', cp.full_name), plainto_tsquery('spanish', p_query_text)))::FLOAT AS similarity,
      -- Graph context: claims + inspecciones de esta persona
      (
        SELECT jsonb_agg(jsonb_build_object(
          'liquidation_number', c.liquidation_number,
          'status_id', c.status_id,
          'inspector_name', p.full_name,
          'inspection_count', (
            SELECT count(*)::int FROM inspection_sessions s WHERE s.claim_id = c.id
          ),
          'inspection_status', (
            SELECT string_agg(distinct s.status, ', ') FROM inspection_sessions s WHERE s.claim_id = c.id
          )
        ))
        FROM claims c
        JOIN claims_participants cp2 ON cp2.claim_id = c.id
        LEFT JOIN profiles p ON p.id = c.inspector_id
        WHERE cp2.full_name ILIKE '%' || trim(p_query_text) || '%'
          AND cp2.type = 'insured'
          AND is_claim_accessible(c.id)
      ) AS graph_context
    FROM claims_participants cp
    WHERE cp.full_name ILIKE '%' || trim(p_query_text) || '%'
      AND is_claim_accessible(cp.claim_id)
    ORDER BY similarity DESC
    LIMIT LEAST(p_match_count, 5);
  END IF;

  -- ── Carril 3: Búsqueda exacta por liquidation_number ──
  -- Si el query parece un número de liquidación (L-XXXXXXX)
  IF p_query_text ~* '^L-?\d' THEN
    RETURN QUERY
    SELECT
      'claim'::TEXT AS source,
      c.id AS entity_id,
      c.liquidation_number AS content,
      jsonb_build_object(
        'liquidation_number', c.liquidation_number,
        'client_reference', c.client_reference,
        'status_id', c.status_id,
        'inspector_name', pi.full_name,
        'adjuster_name', pa.full_name,
        'insured_name', cp.full_name,
        'claim_address', c.claim_address,
        'disabled', c.disabled
      ) AS metadata,
      1.0::FLOAT AS similarity,
      -- Graph: inspecciones + participantes
      (
        SELECT jsonb_agg(jsonb_build_object(
          'status', s.status,
          'inspection_type', s.inspection_type,
          'inspector_name', psi.full_name,
          'scheduled_at', s.scheduled_at,
          'ended_at', s.ended_at,
          'inspection_number', s.inspection_number
        ))
        FROM inspection_sessions s
        LEFT JOIN profiles psi ON psi.id = s.inspector_id
        WHERE s.claim_id = c.id
      ) AS graph_context
    FROM claims c
    LEFT JOIN profiles pi ON pi.id = c.inspector_id
    LEFT JOIN profiles pa ON pa.id = c.assigned_adjuster_id
    LEFT JOIN claims_participants cp ON cp.claim_id = c.id AND cp.type = 'insured'
    WHERE c.liquidation_number ILIKE '%' || trim(p_query_text) || '%'
      AND is_claim_accessible(c.id)
    LIMIT 5;
  END IF;

  -- ── Carril 4: Búsqueda por número de inspección ──
  -- Si el query parece un código de inspección
  IF p_query_text IS NOT NULL AND length(trim(p_query_text)) >= 3 THEN
    RETURN QUERY
    SELECT
      'inspection'::TEXT AS source,
      s.id AS entity_id,
      COALESCE(ca.code, s.inspection_number, s.id::TEXT) AS content,
      jsonb_build_object(
        'session_id', s.id,
        'status', s.status,
        'inspection_type', s.inspection_type,
        'claim_id', s.claim_id,
        'liquidation_number', c.liquidation_number,
        'inspector_name', p.full_name
      ) AS metadata,
      0.9::FLOAT AS similarity,
      NULL::JSONB AS graph_context
    FROM inspection_sessions s
    LEFT JOIN claim_actions ca ON ca.id = s.claim_action_id
    LEFT JOIN claims c ON c.id = s.claim_id
    LEFT JOIN profiles p ON p.id = s.inspector_id
    WHERE (
      ca.code ILIKE '%' || trim(p_query_text) || '%'
      OR s.inspection_number ILIKE '%' || trim(p_query_text) || '%'
    )
    AND is_claim_accessible(s.claim_id)
    LIMIT 5;
  END IF;

END;
$$;

-- Permisos
GRANT EXECUTE ON FUNCTION match_hubi TO authenticated, anon;

-- Trigger updated_at
CREATE TRIGGER set_updated_at_hubi_docs BEFORE UPDATE ON hubi_docs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_hubi_conversations BEFORE UPDATE ON hubi_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
