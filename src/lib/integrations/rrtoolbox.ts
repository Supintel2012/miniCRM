/**
 * RR Toolbox (RRToolbox-API) integration client.
 *
 * Lets miniCRM dogfood our own decision models behind CRM workflows.
 * Calls the RRToolbox REST API at /mcp-tools/* using the org's RRT-* API key,
 * stored per-org in integration_credentials (provider='rrtoolbox').
 *
 * Env fallback: RRTOOLBOX_BASE_URL + RRTOOLBOX_API_KEY for self-hosted single-org.
 */

import { createClient } from '@supabase/supabase-js'
import { getCredentials } from './credentials'

export interface RrtConfig {
  base_url: string
  api_key: string
}

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

const ENV_FALLBACK: (() => RrtConfig | null) = () => {
  const base = process.env.RRTOOLBOX_BASE_URL
  const key = process.env.RRTOOLBOX_API_KEY
  return base && key ? { base_url: base, api_key: key } : null
}

/**
 * Resolve the RRToolbox config for an org.
 * Priority: DB (integration_credentials) → env vars.
 */
export async function getRrtConfig(orgId: string): Promise<RrtConfig | null> {
  const creds = await getCredentials('rrtoolbox', orgId)
  if (creds?.base_url && creds?.api_key) {
    return { base_url: creds.base_url, api_key: creds.api_key }
  }
  return ENV_FALLBACK()
}

function authHeaders(apiKey: string): Record<string, string> {
  const raw = apiKey.trim()
  const header = raw.startsWith('RRT-') ? `Bearer ${raw}` : raw.startsWith('Bearer ')
    ? raw : `Bearer ${raw}`
  return { Authorization: header, 'Content-Type': 'application/json' }
}

async function rrtFetch<T>(
  config: RrtConfig,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = `${config.base_url.replace(/\/$/, '')}${path}`
  const res = await fetch(url, {
    ...init,
    headers: { ...authHeaders(config.api_key), ...(init?.headers ?? {}) },
    // RRToolbox model runs can take a while (SDP solve).
    signal: AbortSignal.timeout(120_000),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new RrtError(res.status, body || res.statusText)
  }
  return res.json() as Promise<T>
}

export class RrtError extends Error {
  constructor(public status: number, message: string) {
    super(`RRToolbox API error ${status}: ${message}`)
    this.name = 'RrtError'
  }
}

// ── API wrappers ───────────────────────────────────────────────────────────

export async function listRrtModels(config: RrtConfig): Promise<RrtModelInfo[]> {
  return rrtFetch<RrtModelInfo[]>(config, '/mcp-tools/models')
}

export async function getRrtModelCard(config: RrtConfig, modelName: string): Promise<RrtModelCard> {
  const res = await rrtFetch<unknown>(config, '/mcp-tools/models/card', {
    method: 'POST',
    body: JSON.stringify({ model_name: modelName }),
  })
  return res as RrtModelCard
}

export async function getRrtInputSchema(config: RrtConfig, modelName: string): Promise<Record<string, unknown>> {
  const res = await rrtFetch<unknown>(config, '/mcp-tools/models/input-schema', {
    method: 'POST',
    body: JSON.stringify({ model_name: modelName }),
  })
  return res as Record<string, unknown>
}

export async function runRrtModel(
  config: RrtConfig,
  modelName: string,
  parameters: Record<string, unknown>,
): Promise<RrtRunResult> {
  const res = await rrtFetch<unknown>(config, '/mcp-tools/run', {
    method: 'POST',
    body: JSON.stringify({ model_name: modelName, parameters }),
  })
  return res as RrtRunResult
}

export async function validateRrtInputs(
  config: RrtConfig,
  modelName: string,
  parameters: Record<string, unknown>,
): Promise<{ ok: boolean; issues?: unknown[] }> {
  const res = await rrtFetch<unknown>(config, '/mcp-tools/validate', {
    method: 'POST',
    body: JSON.stringify({ model_name: modelName, parameters }),
  })
  return res as { ok: boolean; issues?: unknown[] }
}

/**
 * Test connectivity + auth against RRToolbox.
 * Returns the model count on success, throws RrtError on failure.
 */
export async function testRrtConnection(config: RrtConfig): Promise<{ models: number }> {
  const models = await listRrtModels(config)
  return { models: models.length }
}

// ── Service-role helper (for the proxy route) ──────────────────────────────

/**
 * Resolve RRT config using the service-role client (bypasses RLS).
 * Used by API routes that already have the org_id from the authenticated user.
 */
export async function getRrtConfigService(orgId: string): Promise<RrtConfig | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data } = await supabase
    .from('crm.integration_credentials')
    .select('config')
    .eq('org_id', orgId)
    .eq('provider', 'rrtoolbox')
    .single()

  const cfg = data?.config as Record<string, string> | null
  if (cfg?.base_url && cfg?.api_key) {
    return { base_url: cfg.base_url, api_key: cfg.api_key }
  }
  return ENV_FALLBACK()
}
