import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  const orgId = request.nextUrl.searchParams.get('org_id')
  if (!orgId) return NextResponse.json({ error: 'Missing org_id' }, { status: 400 })

  const supabase = await createServiceClient()
  const { data: token } = await supabase.from('integration_tokens')
    .select('*').eq('org_id', orgId).eq('provider', 'stripe').single()

  if (!token) return NextResponse.json({ error: 'Stripe not configured' }, { status: 400 })

  const webhookSecret = (token.metadata as Record<string, string>)?.webhook_secret
  let event: Stripe.Event

  try {
    const stripe = new Stripe(token.access_token!, { apiVersion: '2026-02-25.clover' })
    event = webhookSecret && sig
      ? stripe.webhooks.constructEvent(body, sig, webhookSecret)
      : JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 })
  }

  switch (event.type) {
    case 'customer.created':
    case 'customer.updated': {
      const customer = event.data.object as Stripe.Customer
      if (customer.email) {
        await supabase.from('contacts').upsert({
          org_id: orgId,
          first_name: customer.name?.split(' ')[0] ?? customer.email.split('@')[0],
          last_name: customer.name?.split(' ').slice(1).join(' ') || null,
          email: customer.email,
          source: 'stripe',
          external_ids: { stripe_customer_id: customer.id },
        }, { onConflict: 'org_id,email' })
      }
      break
    }
    case 'invoice.paid':
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const customerEmail = typeof invoice.customer_email === 'string' ? invoice.customer_email : null
      if (customerEmail) {
        const { data: contact } = await supabase.from('contacts').select('id').eq('email', customerEmail).eq('org_id', orgId).maybeSingle()
        if (contact) {
          await supabase.from('activities').insert({
            org_id: orgId,
            type: 'email',
            subject: event.type === 'invoice.paid'
              ? `Invoice paid: $${((invoice.amount_paid ?? 0) / 100).toFixed(2)}`
              : 'Invoice payment failed',
            status: 'done',
            done_at: new Date().toISOString(),
            contact_id: contact.id,
            external_ids: { stripe_invoice_id: invoice.id ?? '' },
          })
        }
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}
