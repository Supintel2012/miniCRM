import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getHubSpotClient } from '@/lib/integrations/hubspot'
import { z } from 'zod'

const schema = z.object({
  types: z.array(z.enum(['contacts', 'companies', 'deals'])).min(1),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = profile.org_id

  const { data: tokenRow } = await supabase
    .from('integration_tokens')
    .select('access_token')
    .eq('org_id', orgId)
    .eq('provider', 'hubspot')
    .single()

  if (!tokenRow?.access_token) return NextResponse.json({ error: 'HubSpot not connected' }, { status: 400 })

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const hs = getHubSpotClient(tokenRow.access_token)
  const results: Record<string, { imported: number; skipped: number; errors: number }> = {}

  // Map: hubspot company id → miniCRM company id (built during company import for deal linking)
  const companyIdMap: Record<string, string> = {}
  const contactIdMap: Record<string, string> = {}

  // --- Import Companies ---
  if (parsed.data.types.includes('companies')) {
    let imported = 0, skipped = 0, errors = 0
    for await (const batch of hs.companies()) {
      for (const co of batch) {
        try {
          const p = co.properties
          if (!p.name) { skipped++; continue }

          // Check if already imported by external_id
          const { data: existing } = await supabase
            .from('companies')
            .select('id')
            .eq('org_id', orgId)
            .eq("external_ids->>'hubspot'", co.id)
            .maybeSingle()

          if (existing) {
            companyIdMap[co.id] = existing.id
            skipped++
            continue
          }

          const { data: inserted } = await supabase
            .from('companies')
            .insert({
              org_id: orgId,
              name: p.name,
              domain: p.domain ?? null,
              industry: p.industry ?? null,
              phone: p.phone ?? null,
              website: p.website ?? null,
              size: p.numberofemployees ?? null,
              external_ids: { hubspot: co.id },
              source: 'hubspot',
            })
            .select('id')
            .single()

          if (inserted) {
            companyIdMap[co.id] = inserted.id
            imported++
          }
        } catch { errors++ }
      }
    }
    results.companies = { imported, skipped, errors }
  }

  // --- Import Contacts ---
  if (parsed.data.types.includes('contacts')) {
    let imported = 0, skipped = 0, errors = 0
    for await (const batch of hs.contacts()) {
      for (const c of batch) {
        try {
          const p = c.properties
          if (!p.firstname && !p.email) { skipped++; continue }

          // Check by hubspot external_id first, then by email
          const { data: byExtId } = await supabase
            .from('contacts')
            .select('id')
            .eq('org_id', orgId)
            .eq("external_ids->>'hubspot'", c.id)
            .maybeSingle()

          if (byExtId) {
            contactIdMap[c.id] = byExtId.id
            skipped++
            continue
          }

          if (p.email) {
            const { data: byEmail } = await supabase
              .from('contacts')
              .select('id')
              .eq('org_id', orgId)
              .eq('email', p.email)
              .maybeSingle()

            if (byEmail) {
              // Update external_id on existing contact
              await supabase.from('contacts')
                .update({ external_ids: { hubspot: c.id } })
                .eq('id', byEmail.id)
              contactIdMap[c.id] = byEmail.id
              skipped++
              continue
            }
          }

          const companyId = p.associatedcompanyid ? companyIdMap[p.associatedcompanyid] : null
          const tags = p.hs_lead_status ? [p.hs_lead_status.toLowerCase().replace(/_/g, ' ')] : []

          const { data: inserted } = await supabase
            .from('contacts')
            .insert({
              org_id: orgId,
              first_name: p.firstname ?? p.email?.split('@')[0] ?? 'Unknown',
              last_name: p.lastname ?? null,
              email: p.email ?? null,
              phone: p.phone ?? p.mobilephone ?? null,
              job_title: p.jobtitle ?? null,
              company_id: companyId ?? null,
              tags,
              source: 'hubspot',
              external_ids: { hubspot: c.id },
            })
            .select('id')
            .single()

          if (inserted) {
            contactIdMap[c.id] = inserted.id
            imported++
          }
        } catch { errors++ }
      }
    }
    results.contacts = { imported, skipped, errors }
  }

  // --- Import Deals ---
  if (parsed.data.types.includes('deals')) {
    // Get miniCRM stages for name matching
    const { data: stages } = await supabase
      .from('pipeline_stages')
      .select('id,name,is_won,is_lost')
      .eq('org_id', orgId)
      .order('position')

    const defaultStage = stages?.[0]
    if (!defaultStage) {
      results.deals = { imported: 0, skipped: 0, errors: 1 }
    } else {
      let imported = 0, skipped = 0, errors = 0

      function matchStage(hsStage?: string) {
        if (!hsStage || !stages) return defaultStage
        const hs = hsStage.toLowerCase()
        // Try to match by name similarity
        if (hs.includes('closedwon') || hs.includes('closed_won')) return stages.find(s => s.is_won) ?? defaultStage
        if (hs.includes('closedlost') || hs.includes('closed_lost')) return stages.find(s => s.is_lost) ?? defaultStage
        const match = stages.find(s => hs.includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(hs))
        return match ?? defaultStage
      }

      for await (const batch of hs.deals()) {
        for (const d of batch) {
          try {
            const p = d.properties
            if (!p.dealname) { skipped++; continue }

            const { data: existing } = await supabase
              .from('deals')
              .select('id')
              .eq('org_id', orgId)
              .eq("external_ids->>'hubspot'", d.id)
              .maybeSingle()

            if (existing) { skipped++; continue }

            const stage = matchStage(p.dealstage)
            const assocContactHsId = d.associations?.contacts?.results?.[0]?.id
            const assocCompanyHsId = d.associations?.companies?.results?.[0]?.id

            await supabase.from('deals').insert({
              org_id: orgId,
              title: p.dealname,
              value: p.amount ? parseFloat(p.amount) : null,
              stage_id: stage!.id,
              contact_id: assocContactHsId ? contactIdMap[assocContactHsId] ?? null : null,
              company_id: assocCompanyHsId ? companyIdMap[assocCompanyHsId] ?? null : null,
              expected_close: p.closedate ? new Date(p.closedate).toISOString().split('T')[0] : null,
              probability: p.hs_deal_stage_probability ? Math.round(parseFloat(p.hs_deal_stage_probability) * 100) : null,
              external_ids: { hubspot: d.id },
              source: 'hubspot',
            })
            imported++
          } catch { errors++ }
        }
      }
      results.deals = { imported, skipped, errors }
    }
  }

  return NextResponse.json({ data: results })
}
