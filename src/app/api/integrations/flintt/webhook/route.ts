import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Flintt (app.sellable.dev) outbound webhook receiver.
 *
 * Flintt sends POST requests with an Authorization: Bearer <token> header.
 * The token is set when the webhook endpoint is created in Flintt and stored
 * per-org in integration_credentials (provider='flintt', config.webhook_token).
 *
 * Webhook URL: https://<your-domain>/api/integrations/flintt/webhook?org_id=<org_id>
 *
 * Event types handled:
 *   prospect.created  → creates a contact (source='flintt')
 *   company.created   → creates a company
 *   signal.run.*      → logged as an activity on the matched contact/company
 */

interface FlinttEvent {
  event_type?: string
  type?: string
  data?: {
    id?: string
    name?: string
    email?: string
    title?: string
    linkedin_url?: string
    company_id?: string
    domain?: string
    created_at?: string
    [key: string]: unknown
  }
}

export async function GET() {
  // Some webhook verification flows ping the URL with a GET.
  return new NextResponse('OK', { status: 200 })
}

export async function POST(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get('org_id')
  if (!orgId) return NextResponse.json({ error: 'Missing org_id' }, { status: 400 })

  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 })
  }
  const receivedToken = authHeader.slice(7)

  // Look up the stored webhook token for this org
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: cred } = await supabase
    .from('integration_credentials')
    .select('config')
    .eq('org_id', orgId)
    .eq('provider', 'flintt')
    .single()

  const storedToken = (cred?.config as Record<string, string> | null)?.webhook_token
  if (!storedToken || storedToken !== receivedToken) {
    return NextResponse.json({ error: 'Invalid webhook token' }, { status: 401 })
  }

  // Parse the event payload
  let event: FlinttEvent
  try {
    event = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const eventType = event.event_type ?? event.type ?? 'unknown'
  const data = event.data ?? {}

  switch (eventType) {
    case 'prospect.created': {
      if (!data.name) break
      const [firstName, ...rest] = data.name.split(' ')
      const lastName = rest.join(' ') || null

      await supabase.from('contacts').upsert({
        org_id: orgId,
        first_name: firstName,
        last_name: lastName,
        email: data.email ?? null,
        job_title: data.title ?? null,
        source: 'flintt',
        external_ids: data.id ? { flintt_prospect_id: data.id } : {},
        custom_fields: data.linkedin_url ? { linkedin_url: data.linkedin_url } : {},
      }, { onConflict: 'org_id,email' })
      break
    }

    case 'company.created': {
      if (!data.name) break
      await supabase.from('companies').upsert({
        org_id: orgId,
        name: data.name,
        domain: data.domain ?? null,
        external_ids: data.id ? { flintt_company_id: data.id } : {},
        custom_fields: data.linkedin_url ? { linkedin_url: data.linkedin_url } : {},
      }, { onConflict: 'org_id,name' })
      break
    }

    case 'signal.run.completed':
    case 'signal.run.result': {
      // Log signal run results as an activity on the matched contact (by email)
      if (data.email) {
        const { data: contact } = await supabase
          .from('contacts')
          .select('id')
          .eq('org_id', orgId)
          .eq('email', data.email)
          .maybeSingle()

        if (contact) {
          await supabase.from('activities').insert({
            org_id: orgId,
            type: 'task',
            subject: `Flintt signal: ${eventType}`,
            description: JSON.stringify(data).slice(0, 2000),
            status: 'done',
            done_at: new Date().toISOString(),
            contact_id: contact.id,
            external_ids: data.id ? { flintt_signal_id: data.id } : {},
          })
        }
      }
      break
    }

    default:
      // Unknown event type — acknowledge but don't process
      break
  }

  return NextResponse.json({ received: true })
}
