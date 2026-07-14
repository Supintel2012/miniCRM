import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMailchimpClient } from '@/lib/integrations/mailchimp'

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
    .eq('provider', 'mailchimp')
    .single()

  if (!token?.access_token) return NextResponse.json({ error: 'Mailchimp not connected' }, { status: 400 })

  const dc = (token.metadata as Record<string, string>)?.data_center ?? 'us1'
  const mc = getMailchimpClient(token.access_token, dc)

  try {
    const { lists } = await mc.getLists()
    return NextResponse.json({ data: lists })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
