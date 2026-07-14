/**
 * POST — save Resend API key (stored as access_token in integration_tokens)
 * DELETE — disconnect
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getResendClient } from '@/lib/integrations/resend'
import { z } from 'zod'

const schema = z.object({ api_key: z.string().min(10) })

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('org_id,role').eq('id', user.id).single()
  if (!profile || !['owner', 'admin'].includes(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid API key' }, { status: 400 })

  // Verify the key works
  try {
    await getResendClient(parsed.data.api_key).verifyKey()
  } catch (err) {
    return NextResponse.json({ error: `Invalid API key: ${err instanceof Error ? err.message : 'Unknown'}` }, { status: 400 })
  }

  const { error } = await supabase.from('integration_tokens').upsert({
    org_id: profile.org_id,
    user_id: user.id,
    provider: 'resend',
    access_token: parsed.data.api_key,
    enabled: true,
  }, { onConflict: 'org_id,provider' })

  if (error) return NextResponse.json({ error: `Failed to save: ${error.message}` }, { status: 500 })
  return NextResponse.json({ data: { ok: true } })
}

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('org_id,role').eq('id', user.id).single()
  if (!profile || !['owner', 'admin'].includes(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await supabase.from('integration_tokens')
    .delete()
    .eq('org_id', profile.org_id)
    .eq('provider', 'resend')

  return NextResponse.json({ data: { ok: true } })
}
