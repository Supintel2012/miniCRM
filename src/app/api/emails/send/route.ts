/**
 * POST /api/emails/send
 * Sends an email via Resend and logs it as an activity linked to contact/deal.
 * Body: { to, subject, html?, text?, contact_id?, deal_id?, from_name? }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getResendClient } from '@/lib/integrations/resend'
import { z } from 'zod'

const schema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  html: z.string().optional(),
  text: z.string().optional(),
  contact_id: z.string().uuid().optional(),
  deal_id: z.string().uuid().optional(),
  from_name: z.string().optional(),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('org_id,email,full_name').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  // Get Resend token
  const { data: token } = await supabase.from('integration_tokens')
    .select('access_token')
    .eq('org_id', profile.org_id)
    .eq('provider', 'resend')
    .single()

  if (!token?.access_token) return NextResponse.json({ error: 'Resend not connected' }, { status: 400 })

  const { data: orgData } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', profile.org_id)
    .single()

  const fromName = parsed.data.from_name ?? profile.full_name ?? orgData?.name ?? 'miniCRM'
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? `noreply@${process.env.NEXT_PUBLIC_APP_URL?.replace(/https?:\/\//, '') ?? 'example.com'}`

  try {
    const resend = getResendClient(token.access_token)
    const { id: emailId } = await resend.sendEmail({
      from: `${fromName} <${fromEmail}>`,
      to: [parsed.data.to],
      subject: parsed.data.subject,
      html: parsed.data.html,
      text: parsed.data.text ?? parsed.data.subject,
    })

    // Log as email activity
    await supabase.from('activities').insert({
      org_id: profile.org_id,
      type: 'email',
      subject: parsed.data.subject,
      description: `Sent to ${parsed.data.to}`,
      status: 'done',
      done_at: new Date().toISOString(),
      contact_id: parsed.data.contact_id ?? null,
      deal_id: parsed.data.deal_id ?? null,
      owner_id: user.id,
      external_ids: { resend_email_id: emailId },
    })

    return NextResponse.json({ data: { ok: true, email_id: emailId } })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Send failed' }, { status: 500 })
  }
}
