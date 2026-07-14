-- Helper: get current org_id from profiles table (also created here for idempotency;
-- RLS policies in 0002 depend on this function, so run this block first if needed)
-- Note: org_id is NOT in JWT claims — it's stored in public.profiles
CREATE OR REPLACE FUNCTION public.get_org_id()
RETURNS UUID LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org_id UUID;
BEGIN
  SELECT p.org_id INTO v_org_id FROM public.profiles p WHERE p.id = auth.uid();
  RETURN v_org_id;
END;
$$;

-- Hook: inject org_id into JWT after login
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  claims      JSONB;
  user_org_id UUID;
BEGIN
  SELECT org_id INTO user_org_id FROM public.profiles WHERE id = (event->>'user_id')::UUID;
  claims := event->'claims';
  IF user_org_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{org_id}', to_jsonb(user_org_id::TEXT));
  END IF;
  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;
-- supabase_auth_admin must be able to read profiles to inject org_id into JWT
GRANT SELECT ON public.profiles TO supabase_auth_admin;

-- updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER contacts_updated_at   BEFORE UPDATE ON contacts   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER companies_updated_at  BEFORE UPDATE ON companies  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER deals_updated_at      BEFORE UPDATE ON deals      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER activities_updated_at BEFORE UPDATE ON activities FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER notes_updated_at      BEFORE UPDATE ON notes      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tokens_updated_at     BEFORE UPDATE ON integration_tokens FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Dashboard metrics function (used by /api/dashboard/metrics)
CREATE OR REPLACE FUNCTION public.get_dashboard_metrics(p_org_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_contacts', (SELECT COUNT(*) FROM contacts WHERE org_id = p_org_id),
    'new_contacts_30d', (SELECT COUNT(*) FROM contacts WHERE org_id = p_org_id AND created_at > now() - interval '30 days'),
    'total_deals', (SELECT COUNT(*) FROM deals WHERE org_id = p_org_id),
    'total_pipeline_value', (SELECT COALESCE(SUM(value), 0) FROM deals d
      JOIN pipeline_stages s ON d.stage_id = s.id
      WHERE d.org_id = p_org_id AND s.is_won = false AND s.is_lost = false),
    'won_value_30d', (SELECT COALESCE(SUM(d.value), 0) FROM deals d
      JOIN pipeline_stages s ON d.stage_id = s.id
      WHERE d.org_id = p_org_id AND s.is_won = true AND d.updated_at > now() - interval '30 days'),
    'activities_due_today', (SELECT COUNT(*) FROM activities
      WHERE org_id = p_org_id AND status = 'planned' AND due_at::date = CURRENT_DATE),
    'deals_by_stage', (
      SELECT jsonb_agg(jsonb_build_object(
        'stage_id', s.id, 'name', s.name, 'color', s.color,
        'count', COUNT(d.id), 'value', COALESCE(SUM(d.value), 0)
      ))
      FROM pipeline_stages s
      LEFT JOIN deals d ON d.stage_id = s.id
      WHERE s.org_id = p_org_id
      GROUP BY s.id, s.name, s.color, s.position
      ORDER BY s.position
    )
  ) INTO result;
  RETURN result;
END;
$$;
