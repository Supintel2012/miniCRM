import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getHubSpotClient } from '@/lib/integrations/hubspot'
import { z } from 'zod'

const schema = z.object({ access_token: z.string().min(10) })

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid token' }, { status: 400 })

  // Verify token works before saving
  try {
    const hs = getHubSpotClient(parsed.data.access_token)
    const account = await hs.getAccountInfo()

    const { error } = await supabase.from('integration_tokens').upsert({
      org_id: profile.org_id,
      provider: 'hubspot',
      access_token: parsed.data.access_token,
      metadata: { portal_id: account.portalId },
      enabled: true,
      user_id: user.id,
    }, { onConflict: 'org_id,provider' })

    if (error) return NextResponse.json({ error: `Failed to save: ${error.message}` }, { status: 500 })
    return NextResponse.json({ data: { portal_id: account.portalId, ok: true } })
  } catch (err) {
    return NextResponse.json({ error: `Invalid token: ${err instanceof Error ? err.message : 'Unknown error'}` }, { status: 400 })
  }
}

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabase.from('integration_tokens')
    .delete()
    .eq('org_id', profile.org_id)
    .eq('provider', 'hubspot')

  return NextResponse.json({ data: { ok: true } })
}
