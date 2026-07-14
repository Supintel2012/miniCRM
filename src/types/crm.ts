export type UserRole = 'owner' | 'admin' | 'member'
export type ActivityType = 'call' | 'email' | 'meeting' | 'task'
export type ActivityStatus = 'planned' | 'done' | 'cancelled'
export type IntegrationProvider = 'google' | 'mailchimp' | 'stripe' | 'calendly'
export type ContactSource = 'manual' | 'mailchimp' | 'stripe' | 'calendly' | 'import'

export interface Organization {
  id: string
  name: string
  slug: string
  plan: string
  created_at: string
}

export interface Profile {
  id: string
  org_id: string
  full_name: string | null
  avatar_url: string | null
  role: UserRole
  created_at: string
}

export interface Company {
  id: string
  org_id: string
  name: string
  domain: string | null
  industry: string | null
  size: string | null
  website: string | null
  phone: string | null
  address: Record<string, string>
  tags: string[]
  external_ids: Record<string, string>
  custom_fields: Record<string, unknown>
  owner_id: string | null
  created_at: string
  updated_at: string
  owner?: Profile
  _contact_count?: number
  _deal_count?: number
}

export interface Contact {
  id: string
  org_id: string
  first_name: string
  last_name: string | null
  email: string | null
  phone: string | null
  company_id: string | null
  job_title: string | null
  tags: string[]
  source: ContactSource
  external_ids: Record<string, string>
  custom_fields: Record<string, unknown>
  owner_id: string | null
  created_at: string
  updated_at: string
  company?: Company
  owner?: Profile
  _deal_count?: number
  _activity_count?: number
}

export interface PipelineStage {
  id: string
  org_id: string
  name: string
  color: string
  position: number
  is_won: boolean
  is_lost: boolean
  created_at: string
  _deal_count?: number
  _deal_value?: number
}

export interface Deal {
  id: string
  org_id: string
  title: string
  value: number | null
  currency: string
  stage_id: string
  contact_id: string | null
  company_id: string | null
  owner_id: string | null
  expected_close: string | null
  probability: number | null
  tags: string[]
  external_ids: Record<string, string>
  custom_fields: Record<string, unknown>
  created_at: string
  updated_at: string
  stage?: PipelineStage
  contact?: Contact
  company?: Company
  owner?: Profile
}

export interface Activity {
  id: string
  org_id: string
  type: ActivityType
  subject: string
  description: string | null
  status: ActivityStatus
  due_at: string | null
  done_at: string | null
  contact_id: string | null
  deal_id: string | null
  company_id: string | null
  owner_id: string | null
  external_ids: Record<string, string>
  created_at: string
  updated_at: string
  contact?: Contact
  deal?: Deal
  company?: Company
  owner?: Profile
}

export interface Note {
  id: string
  org_id: string
  content: string
  contact_id: string | null
  deal_id: string | null
  company_id: string | null
  author_id: string
  created_at: string
  updated_at: string
  author?: Profile
}

export interface IntegrationToken {
  id: string
  org_id: string
  provider: IntegrationProvider
  user_id: string | null
  token_expires_at: string | null
  scopes: string[]
  metadata: Record<string, unknown>
  enabled: boolean
  created_at: string
  updated_at: string
}

export interface SyncedEmail {
  id: string
  org_id: string
  gmail_id: string
  thread_id: string
  subject: string | null
  from_email: string | null
  to_emails: string[]
  snippet: string | null
  received_at: string | null
  contact_id: string | null
  deal_id: string | null
  labels: string[]
  created_at: string
  contact?: Contact
}

export interface McpApiKey {
  id: string
  org_id: string
  name: string
  scopes: string[]
  last_used: string | null
  expires_at: string | null
  created_by: string
  created_at: string
}

// ── RR Toolbox integration ────────────────────────────────────────────────
export interface RrtModelInfo {
  name: string
  endpoint: string
  description: string
}

export interface RrtModelCard {
  model_name: string
  purpose: string
  who_should_use: string
  example_question: string
  inputs: Record<string, unknown>
  common_mistakes: string[]
  worked_example: string
}

export interface RrtRunResult {
  summary: string
  recommended_action: string
  key_drivers: string[]
  warnings: string[]
  validation: { ok: boolean; issues?: unknown[] }
  attribution: string
  raw: Record<string, unknown>
}

export interface RrtModelRun {
  id: string
  model_name: string
  deal_id: string | null
  contact_id: string | null
  summary: string | null
  recommended_action: string | null
  key_drivers: string[] | null
  warnings: string[] | null
  attribution: string | null
  success: boolean
  error_message: string | null
  duration_ms: number | null
  created_at: string
}

export interface RrtConfigStatus {
  configured: boolean
  base_url: string | null
  has_api_key: boolean
}

export interface DashboardMetrics {
  total_contacts: number
  new_contacts_30d: number
  total_deals: number
  total_pipeline_value: number
  won_value_30d: number
  activities_due_today: number
  deals_by_stage: Array<{
    stage_id: string
    name: string
    color: string
    count: number
    value: number
  }>
}

export interface PaginationMeta {
  total: number
  page: number
  per_page: number
  total_pages: number
}

export interface ApiResponse<T> {
  data: T
  meta?: PaginationMeta
}

export interface ApiError {
  error: {
    code: string
    message: string
    details?: unknown
  }
}
