import Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'

export function getStripeClient(secretKey: string) {
  return new Stripe(secretKey, { apiVersion: '2026-02-25.clover' })
}

export async function syncStripeContacts(orgId: string, secretKey: string, supabase: SupabaseClient) {
  const stripe = getStripeClient(secretKey)
  let synced = 0

  for await (const customer of stripe.customers.list({ limit: 100 })) {
    if (!customer.email) continue

    // Check for existing contact by Stripe customer ID first, then email
    const { data: byExternal } = await supabase
      .from('contacts')
      .select('id')
      .eq('org_id', orgId)
      .eq("external_ids->>'stripe_customer_id'", customer.id)
      .maybeSingle()

    if (byExternal) {
      synced++
      continue
    }

    const { data: byEmail } = await supabase
      .from('contacts')
      .select('id')
      .eq('org_id', orgId)
      .eq('email', customer.email)
      .maybeSingle()

    if (byEmail) {
      // Tag with external ID
      await supabase.from('contacts')
        .update({ external_ids: { stripe_customer_id: customer.id } })
        .eq('id', byEmail.id)
      synced++
      continue
    }

    await supabase.from('contacts').insert({
      org_id: orgId,
      first_name: customer.name?.split(' ')[0] ?? customer.email.split('@')[0],
      last_name: customer.name?.split(' ').slice(1).join(' ') || null,
      email: customer.email,
      phone: (customer as { phone?: string }).phone ?? null,
      source: 'stripe',
      external_ids: { stripe_customer_id: customer.id },
    })
    synced++
  }

  return synced
}

export async function syncStripeDeals(orgId: string, secretKey: string, supabase: SupabaseClient) {
  const stripe = getStripeClient(secretKey)
  let synced = 0

  // Get the first non-won, non-lost pipeline stage for this org
  const { data: stages } = await supabase
    .from('pipeline_stages')
    .select('id,is_won,is_lost')
    .eq('org_id', orgId)
    .order('position')

  const defaultStage = stages?.find(s => !s.is_won && !s.is_lost) ?? stages?.[0]
  const wonStage = stages?.find(s => s.is_won)
  if (!defaultStage) return 0

  for await (const sub of stripe.subscriptions.list({ limit: 100, expand: ['data.customer'] })) {
    const customer = sub.customer as Stripe.Customer
    if (!customer || typeof customer === 'string') continue

    // Dedup by stripe_subscription_id
    const { data: existing } = await supabase
      .from('deals')
      .select('id')
      .eq('org_id', orgId)
      .eq("external_ids->>'stripe_subscription_id'", sub.id)
      .maybeSingle()

    if (existing) { synced++; continue }

    // Find the linked contact
    const { data: contact } = customer.email
      ? await supabase.from('contacts').select('id').eq('org_id', orgId).eq('email', customer.email).maybeSingle()
      : { data: null }

    // Compute monthly value (convert to monthly if annual billing)
    const item = sub.items.data[0]
    const unitAmount = item?.price?.unit_amount ?? 0
    const interval = item?.price?.recurring?.interval ?? 'month'
    const intervalCount = item?.price?.recurring?.interval_count ?? 1
    const qty = item?.quantity ?? 1
    const monthlyValue = interval === 'year'
      ? (unitAmount * qty) / (intervalCount * 12) / 100
      : interval === 'week'
        ? (unitAmount * qty * 4) / intervalCount / 100
        : (unitAmount * qty) / intervalCount / 100

    const productName = item?.price?.nickname ?? 'Subscription'
    const title = customer.name
      ? `${customer.name} — ${productName}`
      : `${customer.email ?? customer.id} — ${productName}`

    // Map subscription status to stage
    const stageId = sub.status === 'active' && wonStage ? wonStage.id : defaultStage.id

    await supabase.from('deals').insert({
      org_id: orgId,
      title,
      value: monthlyValue > 0 ? monthlyValue : null,
      currency: item?.price?.currency?.toUpperCase() ?? 'USD',
      stage_id: stageId,
      contact_id: contact?.id ?? null,
      tags: [`stripe_${sub.status}`],
      external_ids: { stripe_subscription_id: sub.id },
      custom_fields: {
        stripe_status: sub.status,
        stripe_interval: interval,
        stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
      },
    })
    synced++
  }

  return synced
}
