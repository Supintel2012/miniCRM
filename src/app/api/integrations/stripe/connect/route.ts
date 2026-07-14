import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const schema = z.object({ secret_key: z.string().min(10), webhook_secret: z.string().optional() })

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: { message: 'Invalid input' } }, { status: 400 })

  const { error } = await supabase.from('integration_tokens').upsert({
    org_id: profile.org_id,
    provider: 'stripe',
    access_token: parsed.data.secret_key,
    metadata: { webhook_secret: parsed.data.webhook_secret ?? '' },
    enabled: true,
  }, { onConflict: 'org_id,provider' })

  if (error) return NextResponse.json({ error: { message: `Failed to save: ${error.message}` } }, { status: 500 })
  return NextResponse.json({ data: { connected: true } })
}
