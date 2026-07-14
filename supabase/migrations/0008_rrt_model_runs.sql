-- Audit log for RR Toolbox decision-model invocations from miniCRM.
-- Records which org/user ran which RRT model against which CRM entity
-- (deal or contact), with the model's recommendation and raw output.
-- This is the "dogfooding" trail — we use our own models to manage our CRM.
CREATE TABLE rrt_model_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  model_name      TEXT NOT NULL,
  -- The CRM entity this run was associated with (both optional — a run
  -- may be exploratory and not tied to a specific deal/contact).
  deal_id         UUID REFERENCES deals(id) ON DELETE SET NULL,
  contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,
  parameters      JSONB NOT NULL DEFAULT '{}',
  -- Snapshot of the human-readable result so the detail page can show
  -- past recommendations without re-running the model.
  summary         TEXT,
  recommended_action TEXT,
  key_drivers     TEXT[],
  warnings        TEXT[],
  attribution     TEXT,
  raw_result      JSONB,
  success         BOOLEAN NOT NULL DEFAULT true,
  error_message   TEXT,
  duration_ms     INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX rrt_model_runs_org_created_idx ON rrt_model_runs (org_id, created_at DESC);
CREATE INDEX rrt_model_runs_deal_idx ON rrt_model_runs (deal_id) WHERE deal_id IS NOT NULL;
CREATE INDEX rrt_model_runs_contact_idx ON rrt_model_runs (contact_id) WHERE contact_id IS NOT NULL;

ALTER TABLE rrt_model_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rrt_runs_select" ON rrt_model_runs
  FOR SELECT USING (org_id = get_org_id());

CREATE POLICY "rrt_runs_insert" ON rrt_model_runs
  FOR INSERT WITH CHECK (org_id = get_org_id());

CREATE POLICY "rrt_runs_delete" ON rrt_model_runs
  FOR DELETE USING (org_id = get_org_id() AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner','admin')));
