/**
 * GET  /api/integrations/credentials?provider=google  → returns { has_credentials: bool, client_id?: string }
 * POST /api/integrations/credentials                  → save credentials for a provider
 * DELETE /api/integrations/credentials?provider=      → remove stored credentials
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { saveCredentials, deleteCredentials } from '@/lib/integrations/credentials'
import { z } from 'zod'

const saveSchema = z.object({
  provider: z.string(),
  client_id: z.string().min(1),
  client_secret: z.string().min(1),
})

async function getOrgId(): Promise<{ orgId: string; userId: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('org_id,role').eq('id', user.id).single()
  if (!profile || !['owner', 'admin'].includes(profile.role)) return null
  return { orgId: profile.org_id, userId: user.id }
}

export async function GET(request: NextRequest) {
  const auth = await getOrgId()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const provider = new URL(request.url).searchParams.get('provider')
  if (!provider) return NextResponse.json({ error: 'provider required' }, { status: 400 })

  const supabase = await createClient()
  const { data } = await supabase
    .from('integration_credentials')
    .select('config')
    .eq('org_id', auth.orgId)
    .eq('provider', provider)
    .single()

  const config = data?.config as Record<string, string> | null
  return NextResponse.json({
    data: {
      has_credentials: !!(config?.client_id),
      // Return client_id (not secret) so UI can show it's configured
      client_id: config?.client_id ?? null,
    }
  })
}

export async function POST(request: NextRequest) {
  const auth = await getOrgId()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = saveSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  await saveCredentials(parsed.data.provider, auth.orgId, {
    client_id: parsed.data.client_id,
    client_secret: parsed.data.client_secret,
  })

  return NextResponse.json({ data: { ok: true } })
}

export async function DELETE(request: NextRequest) {
  const auth = await getOrgId()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const provider = new URL(request.url).searchParams.get('provider')
  if (!provider) return NextResponse.json({ error: 'provider required' }, { status: 400 })

  await deleteCredentials(provider, auth.orgId)
  return NextResponse.json({ data: { ok: true } })
}
