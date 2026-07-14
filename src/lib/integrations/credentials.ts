/**
 * Integration credential resolution.
 * Priority: database (org-specific) → environment variables
 * This allows self-hosted users to configure OAuth apps through the UI.
 */

import { createClient } from '@/lib/supabase/server'

interface ProviderCredentials {
  client_id: string
  client_secret: string
  [key: string]: string
}

const ENV_MAP: Record<string, () => ProviderCredentials | null> = {
  google: () =>
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? { client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET }
      : null,
  mailchimp: () =>
    process.env.MAILCHIMP_CLIENT_ID && process.env.MAILCHIMP_CLIENT_SECRET
      ? { client_id: process.env.MAILCHIMP_CLIENT_ID, client_secret: process.env.MAILCHIMP_CLIENT_SECRET }
      : null,
  calendly: () =>
    process.env.CALENDLY_CLIENT_ID && process.env.CALENDLY_CLIENT_SECRET
      ? { client_id: process.env.CALENDLY_CLIENT_ID, client_secret: process.env.CALENDLY_CLIENT_SECRET }
      : null,
}

export async function getCredentials(provider: string, orgId: string): Promise<ProviderCredentials | null> {
  // Check DB first
  const supabase = await createClient()
  const { data } = await supabase
    .from('integration_credentials')
    .select('config')
    .eq('org_id', orgId)
    .eq('provider', provider)
    .single()

  if (data?.config && (data.config as Record<string, unknown>).client_id) {
    return data.config as ProviderCredentials
  }

  // Fall back to env vars
  return ENV_MAP[provider]?.() ?? null
}

export async function saveCredentials(provider: string, orgId: string, config: ProviderCredentials): Promise<void> {
  const supabase = await createClient()
  await supabase
    .from('integration_credentials')
    .upsert({ org_id: orgId, provider, config }, { onConflict: 'org_id,provider' })
}

export async function deleteCredentials(provider: string, orgId: string): Promise<void> {
  const supabase = await createClient()
  await supabase
    .from('integration_credentials')
    .delete()
    .eq('org_id', orgId)
    .eq('provider', provider)
}
