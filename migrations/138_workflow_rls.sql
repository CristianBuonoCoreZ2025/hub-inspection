-- Migration 138: RLS policies for workflow tables
-- Las tablas workflow_configs y workflow_steps se crearon en migration 135
-- pero sin RLS. Esto causaba error "new row violates row-level security policy".

-- Workflow configs
ALTER TABLE workflow_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_configs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workflow_configs_all" ON workflow_configs;
CREATE POLICY "workflow_configs_all" ON workflow_configs
  FOR ALL TO public USING (true) WITH CHECK (true);

-- Workflow steps
ALTER TABLE workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_steps FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workflow_steps_all" ON workflow_steps;
CREATE POLICY "workflow_steps_all" ON workflow_steps
  FOR ALL TO public USING (true) WITH CHECK (true);
