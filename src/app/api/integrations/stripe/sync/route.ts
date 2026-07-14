import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncStripeContacts, syncStripeDeals } from '@/lib/integrations/stripe'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: token } = await supabase.from('integration_tokens')
    .select('*').eq('org_id', profile.org_id).eq('provider', 'stripe').single()

  if (!token?.access_token) return NextResponse.json({ error: 'Stripe not configured' }, { status: 400 })

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any
    const [contacts, deals] = await Promise.all([
      syncStripeContacts(profile.org_id, token.access_token, sb),
      syncStripeDeals(profile.org_id, token.access_token, sb),
    ])
    return NextResponse.json({ data: { synced: contacts + deals, contacts, deals } })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
