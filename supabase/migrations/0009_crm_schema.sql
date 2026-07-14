-- Move all CRM domain tables from public to crm schema.
-- profiles stays in public (extends auth.users).
--
-- Run this AFTER 0001-0008. On a fresh database, run 0001-0008 first
-- (which create tables in public), then this migration to move them.
--
-- The application code references tables as '<table>' (no schema prefix)
-- in all .from() calls. PostgREST resolves them via views in public schema
-- that point to the underlying crm tables. profiles is a real table in public.

CREATE SCHEMA IF NOT EXISTS crm;

-- Move tables (CASCADE handles dependent objects)
ALTER TABLE public.organizations SET SCHEMA crm;
ALTER TABLE public.companies SET SCHEMA crm;
ALTER TABLE public.contacts SET SCHEMA crm;
ALTER TABLE public.pipeline_stages SET SCHEMA crm;
ALTER TABLE public.deals SET SCHEMA crm;
ALTER TABLE public.activities SET SCHEMA crm;
ALTER TABLE public.notes SET SCHEMA crm;
ALTER TABLE public.integration_tokens SET SCHEMA crm;
ALTER TABLE public.synced_emails SET SCHEMA crm;
ALTER TABLE public.mcp_api_keys SET SCHEMA crm;
ALTER TABLE public.integration_credentials SET SCHEMA crm;
ALTER TABLE public.rrt_model_runs SET SCHEMA crm;

-- Fix profiles FK to reference crm.organizations
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_org_id_fkey;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_org_id_fkey
  FOREIGN KEY (org_id) REFERENCES crm.organizations(id) ON DELETE CASCADE;

-- Grant access to crm schema
GRANT USAGE ON SCHEMA crm TO anon, authenticated, service_role, authenticator;
GRANT ALL ON ALL TABLES IN SCHEMA crm TO anon, authenticated, service_role, authenticator;
GRANT ALL ON ALL SEQUENCES IN SCHEMA crm TO anon, authenticated, service_role, authenticator;

-- Create views in public schema that point to crm tables.
-- PostgREST's schema cache includes public but may not pick up crm
-- without a restart. Views in public are immediately visible and
-- automatically updatable (single-table, no joins). security_invoker
-- makes the view respect RLS on the underlying crm table.
CREATE OR REPLACE VIEW public.organizations WITH (security_invoker = true) AS SELECT * FROM crm.organizations;
CREATE OR REPLACE VIEW public.companies WITH (security_invoker = true) AS SELECT * FROM crm.companies;
CREATE OR REPLACE VIEW public.contacts WITH (security_invoker = true) AS SELECT * FROM crm.contacts;
CREATE OR REPLACE VIEW public.deals WITH (security_invoker = true) AS SELECT * FROM crm.deals;
CREATE OR REPLACE VIEW public.activities WITH (security_invoker = true) AS SELECT * FROM crm.activities;
CREATE OR REPLACE VIEW public.notes WITH (security_invoker = true) AS SELECT * FROM crm.notes;
CREATE OR REPLACE VIEW public.pipeline_stages WITH (security_invoker = true) AS SELECT * FROM crm.pipeline_stages;
CREATE OR REPLACE VIEW public.integration_credentials WITH (security_invoker = true) AS SELECT * FROM crm.integration_credentials;
CREATE OR REPLACE VIEW public.integration_tokens WITH (security_invoker = true) AS SELECT * FROM crm.integration_tokens;
CREATE OR REPLACE VIEW public.mcp_api_keys WITH (security_invoker = true) AS SELECT * FROM crm.mcp_api_keys;
CREATE OR REPLACE VIEW public.rrt_model_runs WITH (security_invoker = true) AS SELECT * FROM crm.rrt_model_runs;
CREATE OR REPLACE VIEW public.synced_emails WITH (security_invoker = true) AS SELECT * FROM crm.synced_emails;

GRANT ALL ON public.organizations, public.companies, public.contacts, public.deals,
  public.activities, public.notes, public.pipeline_stages, public.integration_credentials,
  public.integration_tokens, public.mcp_api_keys, public.rrt_model_runs, public.synced_emails
  TO anon, authenticated, service_role;

-- Set search_path so RLS policies (which use unqualified table names)
-- resolve correctly for anon/authenticated roles.
ALTER ROLE anon SET search_path TO crm, public;
ALTER ROLE authenticated SET search_path TO crm, public;
ALTER ROLE service_role SET search_path TO crm, public;

-- Update get_dashboard_metrics to use crm-qualified table refs
-- (SECURITY DEFINER functions need explicit schema qualification)
CREATE OR REPLACE FUNCTION public.get_dashboard_metrics(p_org_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = crm, public AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_contacts', (SELECT COUNT(*) FROM crm.contacts WHERE org_id = p_org_id),
    'new_contacts_30d', (SELECT COUNT(*) FROM crm.contacts WHERE org_id = p_org_id AND created_at > now() - interval '30 days'),
    'total_deals', (SELECT COUNT(*) FROM crm.deals WHERE org_id = p_org_id),
    'total_pipeline_value', (SELECT COALESCE(SUM(value), 0) FROM crm.deals d
      JOIN crm.pipeline_stages s ON d.stage_id = s.id
      WHERE d.org_id = p_org_id AND s.is_won = false AND s.is_lost = false),
    'won_value_30d', (SELECT COALESCE(SUM(d.value), 0) FROM crm.deals d
      JOIN crm.pipeline_stages s ON d.stage_id = s.id
      WHERE d.org_id = p_org_id AND s.is_won = true AND d.updated_at > now() - interval '30 days'),
    'activities_due_today', (SELECT COUNT(*) FROM crm.activities
      WHERE org_id = p_org_id AND status = 'planned' AND due_at::date = CURRENT_DATE),
    'deals_by_stage', (
      SELECT jsonb_agg(jsonb_build_object(
        'stage_id', s.id, 'name', s.name, 'color', s.color,
        'count', COUNT(d.id), 'value', COALESCE(SUM(d.value), 0)
      ))
      FROM crm.pipeline_stages s
      LEFT JOIN crm.deals d ON d.stage_id = s.id
      WHERE s.org_id = p_org_id
      GROUP BY s.id, s.name, s.color, s.position
      ORDER BY s.position
    )
  ) INTO result;
  RETURN result;
END;
$$;

-- Add CRM tables to realtime publication (they moved schema, so re-add)
ALTER PUBLICATION supabase_realtime ADD TABLE crm.deals;
ALTER PUBLICATION supabase_realtime ADD TABLE crm.activities;
ALTER PUBLICATION supabase_realtime ADD TABLE crm.notes;
ALTER PUBLICATION supabase_realtime ADD TABLE crm.contacts;
