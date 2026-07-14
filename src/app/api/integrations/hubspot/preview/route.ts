import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getHubSpotClient } from '@/lib/integrations/hubspot'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: token } = await supabase
    .from('integration_tokens')
    .select('access_token,metadata')
    .eq('org_id', profile.org_id)
    .eq('provider', 'hubspot')
    .single()

  if (!token?.access_token) return NextResponse.json({ error: 'HubSpot not connected' }, { status: 400 })

  try {
    const hs = getHubSpotClient(token.access_token)
    const [contacts, companies, deals] = await Promise.all([
      hs.countContacts(),
      hs.countCompanies(),
      hs.countDeals(),
    ])
    return NextResponse.json({
      data: {
        contacts: contacts.total,
        companies: companies.total,
        deals: deals.total,
        portal_id: (token.metadata as Record<string, unknown>)?.portal_id,
      }
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
