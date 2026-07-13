import type { Contact, Deal, PipelineStage, Activity, Company } from '@/types/crm'

export const DEMO_ORG_ID = 'demo-org'

export const DEMO_PROFILE = {
  id: 'demo-user',
  org_id: DEMO_ORG_ID,
  full_name: 'Demo User',
  avatar_url: null,
  role: 'owner' as const,
  created_at: '2024-01-01T00:00:00Z',
  organizations: { name: 'Superior Workspace' },
}

export const DEMO_STAGES: PipelineStage[] = [
  { id: 'stage-1', org_id: DEMO_ORG_ID, name: 'Prospecting', color: '#9ac0d4', position: 0, is_won: false, is_lost: false, created_at: '2024-01-01T00:00:00Z' },
  { id: 'stage-2', org_id: DEMO_ORG_ID, name: 'Proposal',    color: '#3d5c7f', position: 1, is_won: false, is_lost: false, created_at: '2024-01-01T00:00:00Z' },
  { id: 'stage-3', org_id: DEMO_ORG_ID, name: 'Negotiation', color: '#ee6b4d', position: 2, is_won: false, is_lost: false, created_at: '2024-01-01T00:00:00Z' },
  { id: 'stage-4', org_id: DEMO_ORG_ID, name: 'Won',         color: '#10b981', position: 3, is_won: true,  is_lost: false, created_at: '2024-01-01T00:00:00Z' },
]

export const DEMO_COMPANIES: Company[] = [
  { id: 'co-1', org_id: DEMO_ORG_ID, name: 'Acme Corp',      domain: 'acmecorp.com',     industry: 'Software', size: '201-500', website: null, phone: null, address: {}, tags: [], external_ids: {}, custom_fields: {}, owner_id: null, created_at: '2024-01-10T00:00:00Z', updated_at: '2024-03-01T00:00:00Z' },
  { id: 'co-2', org_id: DEMO_ORG_ID, name: 'DevShop',        domain: 'devshop.io',       industry: 'Agency',   size: '11-50',   website: null, phone: null, address: {}, tags: [], external_ids: {}, custom_fields: {}, owner_id: null, created_at: '2024-01-15T00:00:00Z', updated_at: '2024-03-02T00:00:00Z' },
  { id: 'co-3', org_id: DEMO_ORG_ID, name: 'TechFlow Inc',   domain: 'techflow.com',     industry: 'SaaS',     size: '51-200',  website: null, phone: null, address: {}, tags: [], external_ids: {}, custom_fields: {}, owner_id: null, created_at: '2024-01-20T00:00:00Z', updated_at: '2024-03-05T00:00:00Z' },
  { id: 'co-4', org_id: DEMO_ORG_ID, name: 'NorthBridge',    domain: 'northbridge.co',   industry: 'Finance',  size: '501+',    website: null, phone: null, address: {}, tags: [], external_ids: {}, custom_fields: {}, owner_id: null, created_at: '2024-01-22T00:00:00Z', updated_at: '2024-03-08T00:00:00Z' },
  { id: 'co-5', org_id: DEMO_ORG_ID, name: 'BlueSky Media',  domain: 'blueskymedia.com', industry: 'Media',    size: '11-50',   website: null, phone: null, address: {}, tags: [], external_ids: {}, custom_fields: {}, owner_id: null, created_at: '2024-02-01T00:00:00Z', updated_at: '2024-03-10T00:00:00Z' },
  { id: 'co-6', org_id: DEMO_ORG_ID, name: 'Acme Partners',  domain: 'acmepartners.io',  industry: 'Consulting', size: '11-50', website: null, phone: null, address: {}, tags: [], external_ids: {}, custom_fields: {}, owner_id: null, created_at: '2024-02-05T00:00:00Z', updated_at: '2024-03-12T00:00:00Z' },
  { id: 'co-7', org_id: DEMO_ORG_ID, name: 'Morphean Labs',  domain: 'morpheanlabs.com', industry: 'AI/ML',    size: '51-200',  website: null, phone: null, address: {}, tags: [], external_ids: {}, custom_fields: {}, owner_id: null, created_at: '2024-02-10T00:00:00Z', updated_at: '2024-03-15T00:00:00Z' },
  { id: 'co-8', org_id: DEMO_ORG_ID, name: 'StarField Inc',  domain: 'starfieldinc.com', industry: 'Hardware', size: '201-500', website: null, phone: null, address: {}, tags: [], external_ids: {}, custom_fields: {}, owner_id: null, created_at: '2024-02-15T00:00:00Z', updated_at: '2024-03-28T00:00:00Z' },
]

export const DEMO_CONTACTS: Contact[] = [
  { id: 'ct-1', org_id: DEMO_ORG_ID, first_name: 'Alex',   last_name: 'Thornton', email: 'alex@northbridge.co',   phone: '+1 415 555 0101', company_id: 'co-4', job_title: 'CTO',                  tags: ['enterprise', 'technical'], source: 'manual', external_ids: {}, custom_fields: {}, owner_id: null, created_at: '2024-01-22T00:00:00Z', updated_at: '2024-03-08T00:00:00Z', company: DEMO_COMPANIES[3] },
  { id: 'ct-2', org_id: DEMO_ORG_ID, first_name: 'Marcus', last_name: 'Webb',     email: 'marcus@acmecorp.com',   phone: '+1 415 555 0202', company_id: 'co-1', job_title: 'VP Sales',             tags: ['champion', 'strategic'],   source: 'manual', external_ids: {}, custom_fields: {}, owner_id: null, created_at: '2024-01-10T00:00:00Z', updated_at: '2024-03-01T00:00:00Z', company: DEMO_COMPANIES[0] },
  { id: 'ct-3', org_id: DEMO_ORG_ID, first_name: 'Sarah',  last_name: 'Chen',     email: 'sarah@devshop.io',      phone: '+1 415 555 0303', company_id: 'co-2', job_title: 'Head of Marketing',    tags: ['decision-maker'],          source: 'manual', external_ids: {}, custom_fields: {}, owner_id: null, created_at: '2024-01-15T00:00:00Z', updated_at: '2024-03-02T00:00:00Z', company: DEMO_COMPANIES[1] },
  { id: 'ct-4', org_id: DEMO_ORG_ID, first_name: 'Jordan', last_name: 'Park',     email: 'jordan@techflow.com',   phone: '+1 415 555 0404', company_id: 'co-3', job_title: 'CEO',                  tags: ['founder', 'strategic'],    source: 'manual', external_ids: {}, custom_fields: {}, owner_id: null, created_at: '2024-01-20T00:00:00Z', updated_at: '2024-03-05T00:00:00Z', company: DEMO_COMPANIES[2] },
  { id: 'ct-5', org_id: DEMO_ORG_ID, first_name: 'Rachel', last_name: 'Torres',   email: 'rachel@blueskymedia.com', phone: '+1 415 555 0505', company_id: 'co-5', job_title: 'Engineering Lead', tags: ['technical'],               source: 'manual', external_ids: {}, custom_fields: {}, owner_id: null, created_at: '2024-02-01T00:00:00Z', updated_at: '2024-03-10T00:00:00Z', company: DEMO_COMPANIES[4] },
  { id: 'ct-6', org_id: DEMO_ORG_ID, first_name: 'Dev',    last_name: 'Singh',    email: 'dev@acmepartners.io',    phone: '+1 415 555 0606', company_id: 'co-6', job_title: 'Founder',             tags: ['founder'],                 source: 'manual', external_ids: {}, custom_fields: {}, owner_id: null, created_at: '2024-02-05T00:00:00Z', updated_at: '2024-03-12T00:00:00Z', company: DEMO_COMPANIES[5] },
  { id: 'ct-7', org_id: DEMO_ORG_ID, first_name: 'Lena',   last_name: 'Marsh',    email: 'lena@morpheanlabs.com',  phone: '+1 415 555 0707', company_id: 'co-7', job_title: 'VP Product',          tags: ['champion'],                source: 'manual', external_ids: {}, custom_fields: {}, owner_id: null, created_at: '2024-02-10T00:00:00Z', updated_at: '2024-03-15T00:00:00Z', company: DEMO_COMPANIES[6] },
  { id: 'ct-8', org_id: DEMO_ORG_ID, first_name: 'Tom',    last_name: 'Reeves',   email: 'tom@starfieldinc.com',   phone: '+1 415 555 0808', company_id: 'co-8', job_title: 'Director of Ops',    tags: ['enterprise'],              source: 'manual', external_ids: {}, custom_fields: {}, owner_id: null, created_at: '2024-02-15T00:00:00Z', updated_at: '2024-03-28T00:00:00Z', company: DEMO_COMPANIES[7] },
]

export const DEMO_DEALS: Deal[] = [
  // Prospecting
  { id: 'deal-1', org_id: DEMO_ORG_ID, title: 'Acme Corp',     value: 27000,  currency: 'USD', stage_id: 'stage-1', contact_id: 'ct-2', company_id: 'co-1', owner_id: null, expected_close: '2026-03-30', probability: 20, tags: [], external_ids: {}, custom_fields: {}, created_at: '2024-02-01T00:00:00Z', updated_at: '2024-03-10T00:00:00Z', stage: DEMO_STAGES[0], contact: DEMO_CONTACTS[1], company: DEMO_COMPANIES[0] },
  { id: 'deal-2', org_id: DEMO_ORG_ID, title: 'BlueSky Media',  value: 31000,  currency: 'USD', stage_id: 'stage-1', contact_id: 'ct-5', company_id: 'co-5', owner_id: null, expected_close: '2026-04-05', probability: 15, tags: [], external_ids: {}, custom_fields: {}, created_at: '2024-02-05T00:00:00Z', updated_at: '2024-03-12T00:00:00Z', stage: DEMO_STAGES[0], contact: DEMO_CONTACTS[4], company: DEMO_COMPANIES[4] },
  // Proposal
  { id: 'deal-3', org_id: DEMO_ORG_ID, title: 'DevShop',        value: 54000,  currency: 'USD', stage_id: 'stage-2', contact_id: 'ct-3', company_id: 'co-2', owner_id: null, expected_close: '2026-03-12', probability: 40, tags: [], external_ids: {}, custom_fields: {}, created_at: '2024-02-10T00:00:00Z', updated_at: '2024-03-15T00:00:00Z', stage: DEMO_STAGES[1], contact: DEMO_CONTACTS[2], company: DEMO_COMPANIES[1] },
  { id: 'deal-4', org_id: DEMO_ORG_ID, title: 'TechFlow Inc',   value: 36000,  currency: 'USD', stage_id: 'stage-2', contact_id: 'ct-4', company_id: 'co-3', owner_id: null, expected_close: '2026-04-11', probability: 35, tags: [], external_ids: {}, custom_fields: {}, created_at: '2024-02-12T00:00:00Z', updated_at: '2024-03-16T00:00:00Z', stage: DEMO_STAGES[1], contact: DEMO_CONTACTS[3], company: DEMO_COMPANIES[2] },
  { id: 'deal-5', org_id: DEMO_ORG_ID, title: 'Acme Partners',  value: 52000,  currency: 'USD', stage_id: 'stage-2', contact_id: 'ct-6', company_id: 'co-6', owner_id: null, expected_close: '2026-03-07', probability: 30, tags: ['at-risk'], external_ids: {}, custom_fields: {}, created_at: '2024-02-15T00:00:00Z', updated_at: '2024-03-17T00:00:00Z', stage: DEMO_STAGES[1], contact: DEMO_CONTACTS[5], company: DEMO_COMPANIES[5] },
  // Negotiation
  { id: 'deal-6', org_id: DEMO_ORG_ID, title: 'NorthBridge',    value: 187000, currency: 'USD', stage_id: 'stage-3', contact_id: 'ct-1', company_id: 'co-4', owner_id: null, expected_close: '2026-03-14', probability: 70, tags: [], external_ids: {}, custom_fields: {}, created_at: '2024-01-20T00:00:00Z', updated_at: '2024-03-18T00:00:00Z', stage: DEMO_STAGES[2], contact: DEMO_CONTACTS[0], company: DEMO_COMPANIES[3] },
  { id: 'deal-7', org_id: DEMO_ORG_ID, title: 'Morphean Labs',  value: 96000,  currency: 'USD', stage_id: 'stage-3', contact_id: 'ct-7', company_id: 'co-7', owner_id: null, expected_close: '2026-04-06', probability: 65, tags: [], external_ids: {}, custom_fields: {}, created_at: '2024-01-25T00:00:00Z', updated_at: '2024-03-19T00:00:00Z', stage: DEMO_STAGES[2], contact: DEMO_CONTACTS[6], company: DEMO_COMPANIES[6] },
  // Won
  { id: 'deal-8', org_id: DEMO_ORG_ID, title: 'StarField Inc',  value: 62000,  currency: 'USD', stage_id: 'stage-4', contact_id: 'ct-8', company_id: 'co-8', owner_id: null, expected_close: '2026-03-28', probability: 100, tags: [], external_ids: {}, custom_fields: {}, created_at: '2024-01-28T00:00:00Z', updated_at: '2024-03-28T00:00:00Z', stage: DEMO_STAGES[3], contact: DEMO_CONTACTS[7], company: DEMO_COMPANIES[7] },
]

export const DEMO_ACTIVITIES: Activity[] = [
  { id: 'act-1', org_id: DEMO_ORG_ID, type: 'call',    subject: 'Discovery call',       description: 'Discussed enterprise rollout timeline', status: 'done',    due_at: '2026-03-18T14:00:00Z', done_at: '2026-03-18T14:30:00Z', contact_id: 'ct-1', deal_id: 'deal-6', company_id: null, owner_id: null, external_ids: {}, created_at: '2026-03-18T00:00:00Z', updated_at: '2026-03-18T00:00:00Z', contact: DEMO_CONTACTS[0], deal: DEMO_DEALS[5] },
  { id: 'act-2', org_id: DEMO_ORG_ID, type: 'email',   subject: 'Proposal sent',         description: 'Sent full pricing proposal',            status: 'done',    due_at: '2026-03-15T10:00:00Z', done_at: '2026-03-15T10:05:00Z', contact_id: 'ct-3', deal_id: 'deal-3', company_id: null, owner_id: null, external_ids: {}, created_at: '2026-03-15T00:00:00Z', updated_at: '2026-03-15T00:00:00Z', contact: DEMO_CONTACTS[2], deal: DEMO_DEALS[2] },
  { id: 'act-3', org_id: DEMO_ORG_ID, type: 'meeting', subject: 'Demo walkthrough',      description: 'Product demo scheduled',                status: 'planned', due_at: '2026-03-22T11:00:00Z', done_at: null,                   contact_id: 'ct-2', deal_id: 'deal-1', company_id: null, owner_id: null, external_ids: {}, created_at: '2026-03-19T00:00:00Z', updated_at: '2026-03-19T00:00:00Z', contact: DEMO_CONTACTS[1], deal: DEMO_DEALS[0] },
  { id: 'act-4', org_id: DEMO_ORG_ID, type: 'task',    subject: 'Follow up on contract', description: 'Legal review pending',                  status: 'planned', due_at: '2026-03-21T09:00:00Z', done_at: null,                   contact_id: 'ct-7', deal_id: 'deal-7', company_id: null, owner_id: null, external_ids: {}, created_at: '2026-03-19T00:00:00Z', updated_at: '2026-03-19T00:00:00Z', contact: DEMO_CONTACTS[6], deal: DEMO_DEALS[6] },
  { id: 'act-5', org_id: DEMO_ORG_ID, type: 'call',    subject: 'Check-in call',         description: 'Quarterly business review',              status: 'planned', due_at: '2026-03-21T15:00:00Z', done_at: null,                   contact_id: 'ct-4', deal_id: 'deal-4', company_id: null, owner_id: null, external_ids: {}, created_at: '2026-03-19T00:00:00Z', updated_at: '2026-03-19T00:00:00Z', contact: DEMO_CONTACTS[3], deal: DEMO_DEALS[3] },
]

export const DEMO_METRICS = {
  total_contacts: 47,
  new_contacts_30d: 8,
  total_deals: 7,
  total_pipeline_value: 283000,
  won_value_30d: 62000,
  activities_due_today: 3,
  deals_by_stage: [
    { stage_id: 'stage-1', name: 'Prospecting', color: '#9ac0d4', count: 2, value: 58000 },
    { stage_id: 'stage-2', name: 'Proposal',    color: '#3d5c7f', count: 3, value: 142000 },
    { stage_id: 'stage-3', name: 'Negotiation', color: '#ee6b4d', count: 2, value: 283000 },
    { stage_id: 'stage-4', name: 'Won',         color: '#10b981', count: 1, value: 62000 },
  ],
}
