import { createClient } from '@/lib/supabase/server'
import { getCredentials } from '@/lib/integrations/credentials'
import { google } from 'googleapis'
import crypto from 'crypto'

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.events.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'offline_access',
]

export function buildOAuthClient(clientId: string, clientSecret: string) {
  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/google/callback`
  )
}

export async function getOAuthClientForOrg(orgId: string) {
  const creds = await getCredentials('google', orgId)
  if (!creds) return null
  return buildOAuthClient(creds.client_id, creds.client_secret)
}

export async function getAuthUrl(state: string, orgId: string) {
  const client = await getOAuthClientForOrg(orgId)
  if (!client) throw new Error('Google OAuth credentials not configured')
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    state,
    prompt: 'consent',
  })
}

export function signState(payload: object): string {
  const json = JSON.stringify({ ...payload, ts: Date.now() })
  const sig = crypto.createHmac('sha256', process.env.INTEGRATION_STATE_SECRET!).update(json).digest('hex')
  return Buffer.from(JSON.stringify({ data: json, sig })).toString('base64url')
}

export function verifyState(token: string): Record<string, unknown> | null {
  try {
    const { data, sig } = JSON.parse(Buffer.from(token, 'base64url').toString())
    const expected = crypto.createHmac('sha256', process.env.INTEGRATION_STATE_SECRET!).update(data).digest('hex')
    if (sig !== expected) return null
    const parsed = JSON.parse(data)
    if (Date.now() - parsed.ts > 10 * 60 * 1000) return null // 10 min expiry
    return parsed
  } catch {
    return null
  }
}

export async function getTokensForOrg(orgId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('integration_tokens')
    .select('*')
    .eq('org_id', orgId)
    .eq('provider', 'google')
    .single()
  return data
}

export async function getAuthorizedClient(orgId: string) {
  const supabase = await createClient()
  const { data: token } = await supabase
    .from('integration_tokens')
    .select('*')
    .eq('org_id', orgId)
    .eq('provider', 'google')
    .single()

  if (!token || !token.access_token) return null

  const client = await getOAuthClientForOrg(orgId)
  if (!client) return null

  client.setCredentials({
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    expiry_date: token.token_expires_at ? new Date(token.token_expires_at).getTime() : undefined,
  })

  // Auto-refresh if expired
  client.on('tokens', async (newTokens) => {
    await supabase.from('integration_tokens').update({
      access_token: newTokens.access_token,
      token_expires_at: newTokens.expiry_date ? new Date(newTokens.expiry_date).toISOString() : null,
    }).eq('org_id', orgId).eq('provider', 'google')
  })

  return { client, token }
}
