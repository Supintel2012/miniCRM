import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const event = body?.event
  const orgId = request.nextUrl.searchParams.get('org_id')

  if (!orgId || !event) return NextResponse.json({ ok: true })

  const supabase = await createServiceClient()
  const payload = body.payload

  if (event === 'invitee.created') {
    const email = payload?.invitee?.email
    const name = payload?.invitee?.name ?? ''
    const eventName = payload?.event?.name ?? 'Meeting'
    const startTime = payload?.event?.start_time

    if (email) {
      const { data: contact } = await supabase.from('contacts')
        .upsert({
          org_id: orgId,
          first_name: name.split(' ')[0] || email.split('@')[0],
          last_name: name.split(' ').slice(1).join(' ') || null,
          email,
          source: 'calendly',
        }, { onConflict: 'org_id,email' })
        .select('id')
        .single()

      await supabase.from('activities').insert({
        org_id: orgId,
        type: 'meeting',
        subject: `Calendly: ${eventName}`,
        status: 'planned',
        due_at: startTime,
        contact_id: contact?.id ?? null,
        external_ids: { calendly_event_id: payload?.event?.uri ?? '' },
      })
    }
  }

  return NextResponse.json({ ok: true })
}
