import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMailchimpClient } from '@/lib/integrations/mailchimp'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = profile.org_id

  // Support variant=a|b for A/B test groups
  const variant = new URL(request.url).searchParams.get('variant')
  const provider = variant === 'a' ? 'mailchimp_a' : variant === 'b' ? 'mailchimp_b' : 'mailchimp'

  const { data: token } = await supabase.from('integration_tokens')
    .select('*').eq('org_id', orgId).eq('provider', provider).single()

  if (!token?.access_token) return NextResponse.json({ error: `${provider} not connected` }, { status: 400 })

  const meta = token.metadata as Record<string, string>
  const client = getMailchimpClient(token.access_token, meta.data_center ?? 'us1')

  // Accept audience_id from body, fall back to stored metadata
  let listId: string | undefined
  try {
    const body = await request.json().catch(() => ({}))
    listId = body.audience_id ?? meta.audience_id
  } catch {
    listId = meta.audience_id
  }

  if (!listId) {
    return NextResponse.json({ error: { code: 'NO_AUDIENCE', message: 'No audience selected. Pick an audience in the Import page.' } }, { status: 400 })
  }

  // Save the selected audience_id to metadata for future syncs
  if (listId !== meta.audience_id) {
    await supabase.from('integration_tokens').update({
      metadata: { ...meta, audience_id: listId },
    }).eq('org_id', orgId).eq('provider', provider)
  }

  // Tag imported contacts with their group label
  const groupTag = variant === 'a' ? 'mailchimp_group_a' : variant === 'b' ? 'mailchimp_group_b' : 'mailchimp'

  try {
    let imported = 0, skipped = 0, offset = 0

    while (true) {
      const { members } = await client.getMembers(listId, offset)
      if (members.length === 0) break

      for (const member of members) {
        const firstName = member.merge_fields?.FNAME || member.full_name?.split(' ')[0] || member.email_address.split('@')[0]
        const lastName = member.merge_fields?.LNAME || member.full_name?.split(' ').slice(1).join(' ') || null

        // Dedup by email
        const { data: existing } = await supabase
          .from('contacts')
          .select('id,tags')
          .eq('org_id', orgId)
          .eq('email', member.email_address)
          .maybeSingle()

        if (existing) {
          // Add group tag and external_id if not already present
          const currentTags: string[] = (existing.tags as string[]) ?? []
          if (!currentTags.includes(groupTag)) {
            await supabase.from('contacts').update({
              external_ids: { [provider]: member.id },
              tags: [...currentTags, groupTag],
            }).eq('id', existing.id)
          }
          skipped++
          continue
        }

        const statusTags = member.status !== 'subscribed' ? [member.status, groupTag] : [groupTag]
        await supabase.from('contacts').insert({
          org_id: orgId,
          first_name: firstName,
          last_name: lastName,
          email: member.email_address,
          source: provider,
          external_ids: { [provider]: member.id },
          tags: statusTags,
        })
        imported++
      }

      if (members.length < 100) break
      offset += 100
    }

    return NextResponse.json({ data: { imported, skipped } })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
