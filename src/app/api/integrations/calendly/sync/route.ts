import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCalendlyClient } from '@/lib/integrations/calendly'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: token } = await supabase.from('integration_tokens')
    .select('*').eq('org_id', profile.org_id).eq('provider', 'calendly').single()

  if (!token?.access_token) return NextResponse.json({ error: 'Calendly not connected' }, { status: 400 })

  const meta = token.metadata as Record<string, string>
  const client = getCalendlyClient(token.access_token)
  const orgId = profile.org_id

  try {
    const { collection: events } = await client.getScheduledEvents(meta.user_uri)
    let synced = 0

    for (const event of events) {
      try {
        const eventId = event.uri.split('/').pop()!
        const { collection: invitees } = await client.getEventInvitees(eventId)

        for (const invitee of invitees) {
          // Dedup contact by email
          const { data: existing } = await supabase.from('contacts')
            .select('id')
            .eq('org_id', orgId)
            .eq('email', invitee.email)
            .maybeSingle()

          let contactId: string | null = existing?.id ?? null

          if (!contactId) {
            const { data: created } = await supabase.from('contacts').insert({
              org_id: orgId,
              first_name: invitee.name?.split(' ')[0] ?? invitee.email.split('@')[0],
              last_name: invitee.name?.split(' ').slice(1).join(' ') || null,
              email: invitee.email,
              source: 'calendly',
            }).select('id').single()
            contactId = created?.id ?? null
          }

          // Dedup activity by calendly event URI + contact
          const { data: existingActivity } = await supabase.from('activities')
            .select('id')
            .eq('org_id', orgId)
            .filter('external_ids', 'cs', JSON.stringify({ calendly_event_id: event.uri }))
            .maybeSingle()

          if (!existingActivity) {
            await supabase.from('activities').insert({
              org_id: orgId,
              type: 'meeting',
              subject: event.name,
              description: `Calendly booking — ${invitee.name ?? invitee.email}`,
              status: 'done',
              due_at: event.start_time,
              done_at: event.end_time,
              contact_id: contactId,
              external_ids: { calendly_event_id: event.uri },
            })
            synced++
          }
        }
      } catch { /* skip individual event errors */ }
    }

    return NextResponse.json({ data: { synced } })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
