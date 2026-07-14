import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

/**
 * Sellable (app.sellable.dev) webhook receiver.
 *
 * Sellable sends POST requests with an HMAC signature in the
 * x-sellable-signature header (format: v0=<hex>) and a timestamp in
 * x-sellable-timestamp. The webhook secret (whsec_live_...) is stored
 * per-org in integration_credentials (provider='sellable', config.webhook_secret).
 *
 * Webhook URL: https://<your-domain>/api/integrations/flintt/webhook?org_id=<org_id>
 *
 * The signature is computed as: HMAC-SHA256(secret, timestamp + '.' + rawBody)
 *
 * Event types handled:
 *   prospect_reply.test / prospect_reply.*  → creates/updates contact + logs activity
 *   prospect.created                        → creates a contact
 *   company.created                         → creates a company
 *   signal.run.*                            → logged as an activity
 */

interface SellableEvent {
  event_type?: string
  type?: string
  test?: boolean
  event_id?: string
  timestamp?: string
  api_version?: string
  workspace_id?: string
  // Prospect data (Sellable format — flat, not nested in data)
  prospect?: {
    email?: string
    first_name?: string
    last_name?: string
    title?: string
    company?: string
    linkedin_url?: string
    linkedin_provider_id?: string
    [key: string]: unknown
  }
  sender?: {
    id?: string
    name?: string
    linkedin_url?: string
  }
  campaign?: {
    id?: string
    name?: string
  }
  thread?: {
    id?: string | null
    url?: string | null
    messages?: Array<{
      id?: string
      body?: string
      subject?: string | null
      direction?: string
      timestamp?: string
      provider_message_id?: string
    }>
  }
  // Legacy Flintt format (nested data object)
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

  // Get raw body for signature verification
  const rawBody = await request.text()

  // Get Sellable signature headers
  const signatureHeader = request.headers.get('x-sellable-signature') || ''
  const timestampHeader = request.headers.get('x-sellable-timestamp') || ''

  // Also check for Bearer token (legacy/alternative auth)
  const authHeader = request.headers.get('authorization') || ''
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

  // Look up the stored webhook secret for this org
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

  const storedSecret = (cred?.config as Record<string, string> | null)?.webhook_token
  if (!storedSecret) {
    return NextResponse.json({ error: 'No webhook secret configured' }, { status: 401 })
  }

  // Verify authentication — either HMAC signature or Bearer token
  if (signatureHeader && timestampHeader) {
    // Sellable HMAC signature verification
    const sigMatch = signatureHeader.match(/^v0=(.+)$/)
    if (!sigMatch) {
      return NextResponse.json({ error: 'Invalid signature format' }, { status: 401 })
    }
    const expectedSig = crypto
      .createHmac('sha256', storedSecret)
      .update(`${timestampHeader}.${rawBody}`)
      .digest('hex')
    if (!crypto.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(sigMatch[1]))) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  } else if (bearerToken) {
    // Legacy Bearer token auth
    if (bearerToken !== storedSecret) {
      return NextResponse.json({ error: 'Invalid webhook token' }, { status: 401 })
    }
  } else {
    return NextResponse.json({ error: 'Missing authentication' }, { status: 401 })
  }

  // Parse the event payload
  let event: SellableEvent
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const eventType = event.event_type ?? event.type ?? 'unknown'

  // Extract prospect data — Sellable sends it flat at top level
  const prospect = event.prospect
  // Legacy format: data is nested
  const legacyData = event.data

  // Handle all prospect-related events
  const isProspectEvent =
    eventType.startsWith('prospect') ||
    eventType === 'prospect.created' ||
    !!prospect

  if (isProspectEvent && prospect) {
    const firstName = prospect.first_name || null
    const lastName = prospect.last_name || null
    const email = prospect.email ?? null
    const jobTitle = prospect.title ?? null
    const companyName = prospect.company ?? null
    const linkedinUrl = prospect.linkedin_url ?? null

    // Check for existing contact by email
    let existingContact: { id: string } | null = null
    if (email) {
      const { data: existing } = await supabase
        .from('contacts')
        .select('id')
        .eq('org_id', orgId)
        .eq('email', email)
        .maybeSingle()
      existingContact = existing
    }

    if (existingContact) {
      // Update existing contact
      const { error: updateError } = await supabase.from('contacts').update({
        first_name: firstName,
        last_name: lastName,
        job_title: jobTitle,
        source: 'sellable',
        custom_fields: linkedinUrl ? { linkedin_url: linkedinUrl } : {},
      }).eq('id', existingContact.id)
      if (updateError) {
        return NextResponse.json({ error: 'Failed to update contact', detail: updateError.message }, { status: 500 })
      }
    } else {
      // Create new contact
      const { error: contactError } = await supabase.from('contacts').insert({
        org_id: orgId,
        first_name: firstName,
        last_name: lastName,
        email,
        job_title: jobTitle,
        source: 'sellable',
        custom_fields: linkedinUrl ? { linkedin_url: linkedinUrl } : {},
      })
      if (contactError) {
        return NextResponse.json({ error: 'Failed to create contact', detail: contactError.message }, { status: 500 })
      }
    }

    // If there's a company name, create/link the company
    if (companyName) {
      const { data: existingCo } = await supabase
        .from('companies')
        .select('id')
        .eq('org_id', orgId)
        .eq('name', companyName)
        .maybeSingle()

      if (!existingCo) {
        await supabase.from('companies').insert({
          org_id: orgId,
          name: companyName,
        })
      }
    }

    // Log the event as an activity
    if (event.thread?.messages?.length) {
      const msg = event.thread.messages[0]
      const { data: contactForActivity } = email ? await supabase
        .from('contacts')
        .select('id')
        .eq('org_id', orgId)
        .eq('email', email)
        .maybeSingle() : { data: null }

      if (contactForActivity) {
        await supabase.from('activities').insert({
          org_id: orgId,
          type: msg.direction === 'inbound' ? 'email_received' : 'email_sent',
          subject: `Sellable: ${eventType}`,
          description: msg.body?.slice(0, 2000) || '',
          status: 'done',
          done_at: msg.timestamp || new Date().toISOString(),
          contact_id: contactForActivity.id,
          external_ids: event.event_id ? { sellable_event_id: event.event_id } : {},
        })
      }
    }

    return NextResponse.json({ received: true, event_type: eventType })
  }

  // Legacy Flintt format (nested data)
  if (legacyData) {
    switch (eventType) {
      case 'prospect.created': {
        if (!legacyData.name) break
        const [firstName, ...rest] = legacyData.name.split(' ')
        const lastName = rest.join(' ') || null

        if (legacyData.email) {
          const { data: existing } = await supabase
            .from('contacts')
            .select('id')
            .eq('org_id', orgId)
            .eq('email', legacyData.email)
            .maybeSingle()
          if (existing) {
            await supabase.from('contacts').update({
              first_name: firstName,
              last_name: lastName,
              job_title: legacyData.title ?? null,
              source: 'sellable',
              custom_fields: legacyData.linkedin_url ? { linkedin_url: legacyData.linkedin_url } : {},
            }).eq('id', existing.id)
            break
          }
        }

        await supabase.from('contacts').insert({
          org_id: orgId,
          first_name: firstName,
          last_name: lastName,
          email: legacyData.email ?? null,
          job_title: legacyData.title ?? null,
          source: 'sellable',
          external_ids: legacyData.id ? { sellable_prospect_id: legacyData.id } : {},
          custom_fields: legacyData.linkedin_url ? { linkedin_url: legacyData.linkedin_url } : {},
        })
        break
      }

      case 'company.created': {
        if (!legacyData.name) break
        const { data: existingCo } = await supabase
          .from('companies')
          .select('id')
          .eq('org_id', orgId)
          .eq('name', legacyData.name)
          .maybeSingle()
        if (!existingCo) {
          await supabase.from('companies').insert({
            org_id: orgId,
            name: legacyData.name,
            domain: legacyData.domain ?? null,
            external_ids: legacyData.id ? { sellable_company_id: legacyData.id } : {},
          })
        }
        break
      }
    }
  }

  return NextResponse.json({ received: true, event_type: eventType })
}
