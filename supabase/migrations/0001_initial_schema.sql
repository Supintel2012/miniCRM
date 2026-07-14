-- Helper required by RLS policies (0002); defined here so order is safe
-- Looks up org_id from profiles table (not JWT, since org_id is not in JWT claims)
CREATE OR REPLACE FUNCTION public.get_org_id()
RETURNS UUID LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org_id UUID;
BEGIN
  SELECT p.org_id INTO v_org_id FROM public.profiles p WHERE p.id = auth.uid();
  RETURN v_org_id;
END;
$$;

-- Organizations (tenants)
CREATE TABLE organizations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT UNIQUE NOT NULL,
  plan       TEXT NOT NULL DEFAULT 'free',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User profiles (extends auth.users)
CREATE TABLE profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  full_name  TEXT,
  avatar_url TEXT,
  role       TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Companies
CREATE TABLE companies (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  domain        TEXT,
  industry      TEXT,
  size          TEXT,
  website       TEXT,
  phone         TEXT,
  address       JSONB DEFAULT '{}',
  tags          TEXT[] DEFAULT '{}',
  external_ids  JSONB DEFAULT '{}',
  custom_fields JSONB DEFAULT '{}',
  owner_id      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Contacts
CREATE TABLE contacts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  first_name    TEXT NOT NULL,
  last_name     TEXT,
  email         TEXT,
  phone         TEXT,
  company_id    UUID REFERENCES companies(id) ON DELETE SET NULL,
  job_title     TEXT,
  tags          TEXT[] DEFAULT '{}',
  source        TEXT DEFAULT 'manual',
  external_ids  JSONB DEFAULT '{}',
  custom_fields JSONB DEFAULT '{}',
  owner_id      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pipeline stages
CREATE TABLE pipeline_stages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#6366f1',
  position   INTEGER NOT NULL DEFAULT 0,
  is_won     BOOLEAN NOT NULL DEFAULT false,
  is_lost    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Deals
CREATE TABLE deals (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  value          NUMERIC(12,2),
  currency       TEXT NOT NULL DEFAULT 'USD',
  stage_id       UUID NOT NULL REFERENCES pipeline_stages(id) ON DELETE RESTRICT,
  contact_id     UUID REFERENCES contacts(id) ON DELETE SET NULL,
  company_id     UUID REFERENCES companies(id) ON DELETE SET NULL,
  owner_id       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  expected_close DATE,
  probability    INTEGER CHECK (probability BETWEEN 0 AND 100),
  tags           TEXT[] DEFAULT '{}',
  external_ids   JSONB DEFAULT '{}',
  custom_fields  JSONB DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Activities
CREATE TABLE activities (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type         TEXT NOT NULL CHECK (type IN ('call','email','meeting','task')),
  subject      TEXT NOT NULL,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','done','cancelled')),
  due_at       TIMESTAMPTZ,
  done_at      TIMESTAMPTZ,
  contact_id   UUID REFERENCES contacts(id) ON DELETE CASCADE,
  deal_id      UUID REFERENCES deals(id) ON DELETE CASCADE,
  company_id   UUID REFERENCES companies(id) ON DELETE CASCADE,
  owner_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  external_ids JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notes
CREATE TABLE notes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  deal_id    UUID REFERENCES deals(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  author_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Integration tokens
CREATE TABLE integration_tokens (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider         TEXT NOT NULL CHECK (provider IN ('google','mailchimp','stripe','calendly')),
  user_id          UUID REFERENCES profiles(id) ON DELETE CASCADE,
  access_token     TEXT,
  refresh_token    TEXT,
  token_expires_at TIMESTAMPTZ,
  scopes           TEXT[],
  metadata         JSONB DEFAULT '{}',
  enabled          BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, provider)
);

-- Synced emails (Gmail)
CREATE TABLE synced_emails (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  gmail_id    TEXT NOT NULL,
  thread_id   TEXT NOT NULL,
  subject     TEXT,
  from_email  TEXT,
  to_emails   TEXT[],
  snippet     TEXT,
  body_html   TEXT,
  received_at TIMESTAMPTZ,
  contact_id  UUID REFERENCES contacts(id) ON DELETE SET NULL,
  deal_id     UUID REFERENCES deals(id) ON DELETE SET NULL,
  labels      TEXT[] DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, gmail_id)
);

-- MCP API keys
CREATE TABLE mcp_api_keys (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  key_hash   TEXT NOT NULL UNIQUE,
  scopes     TEXT[] NOT NULL DEFAULT '{"read:contacts","read:deals"}',
  last_used  TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX contacts_org_id_idx ON contacts(org_id);
CREATE INDEX contacts_email_idx ON contacts(email);
CREATE INDEX contacts_company_id_idx ON contacts(company_id);
CREATE INDEX companies_org_id_idx ON companies(org_id);
CREATE INDEX deals_org_id_stage_idx ON deals(org_id, stage_id);
CREATE INDEX deals_contact_id_idx ON deals(contact_id);
CREATE INDEX activities_org_id_idx ON activities(org_id);
CREATE INDEX activities_due_at_idx ON activities(due_at);
CREATE INDEX activities_contact_id_idx ON activities(contact_id);
CREATE INDEX activities_deal_id_idx ON activities(deal_id);
CREATE INDEX notes_contact_id_idx ON notes(contact_id);
CREATE INDEX notes_deal_id_idx ON notes(deal_id);
CREATE INDEX synced_emails_org_contact_idx ON synced_emails(org_id, contact_id);
