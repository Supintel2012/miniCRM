import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthorizedClient } from '@/lib/integrations/google'
import { google } from 'googleapis'

// Parse "Jane Smith <jane@example.com>" → { name: "Jane Smith", email: "jane@example.com" }
// or "jane@example.com" → { name: null, email: "jane@example.com" }
function parseEmailAddress(raw: string): { name: string | null; email: string } | null {
  const match = raw.match(/^(.+?)\s*<([^>]+)>$/)
  if (match) {
    return { name: match[1].trim().replace(/^"|"$/g, ''), email: match[2].trim().toLowerCase() }
  }
  const plain = raw.trim().toLowerCase()
  if (plain.includes('@')) return { name: null, email: plain }
  return null
}

function parseFirstLast(fullName: string | null): { first: string; last: string | null } {
  if (!fullName) return { first: 'Unknown', last: null }
  const parts = fullName.trim().split(/\s+/)
  return { first: parts[0], last: parts.slice(1).join(' ') || null }
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = profile.org_id

  const authorized = await getAuthorizedClient(orgId)
  if (!authorized) return NextResponse.json({ error: 'Google not connected' }, { status: 400 })

  const { client } = authorized
  const gmail = google.gmail({ version: 'v1', auth: client })

  try {
    // Scan SENT mail from last 6 months — these are your actual outbound contacts
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    const dateQuery = `after:${Math.floor(sixMonthsAgo.getTime() / 1000)}`

    const list = await gmail.users.messages.list({
      userId: 'me',
      labelIds: ['SENT'],
      q: dateQuery,
      maxResults: 500,
    })

    const messageIds = list.data.messages?.map(m => m.id!).filter(Boolean) ?? []

    // Collect all unique email addresses from TO/CC headers
    const discovered = new Map<string, { name: string | null; subjects: string[]; lastDate: string }>()

    // Process in batches of 50 to avoid rate limits
    for (let i = 0; i < Math.min(messageIds.length, 200); i++) {
      try {
        const msg = await gmail.users.messages.get({
          userId: 'me',
          id: messageIds[i],
          format: 'metadata',
          metadataHeaders: ['To', 'Cc', 'Subject', 'Date'],
        })
        const headers = msg.data.payload?.headers ?? []
        const getH = (n: string) => headers.find(h => h.name === n)?.value ?? ''
        const subject = getH('Subject')
        const date = getH('Date')

        // Parse all TO + CC recipients
        const allRecipients = [getH('To'), getH('Cc')]
          .join(',')
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)

        for (const raw of allRecipients) {
          const parsed = parseEmailAddress(raw)
          if (!parsed || !parsed.email.includes('@')) continue
          // Skip your own email
          if (parsed.email === user.email) continue

          const existing = discovered.get(parsed.email)
          if (existing) {
            if (subject) existing.subjects.push(subject)
            if (!existing.name && parsed.name) existing.name = parsed.name
          } else {
            discovered.set(parsed.email, {
              name: parsed.name,
              subjects: subject ? [subject] : [],
              lastDate: date,
            })
          }
        }
      } catch { /* skip individual message errors */ }
    }

    // For each discovered email, check if contact already exists
    let created = 0
    let skipped = 0
    const newContacts: Array<{ email: string; name: string | null }> = []

    for (const [email, info] of discovered) {
      const { data: existing } = await supabase
        .from('contacts')
        .select('id')
        .eq('org_id', orgId)
        .eq('email', email)
        .maybeSingle()

      if (existing) {
        // Link any unlinked synced_emails to this contact
        await supabase
          .from('synced_emails')
          .update({ contact_id: existing.id })
          .eq('org_id', orgId)
          .eq('from_email', email)
          .is('contact_id', null)
        skipped++
        continue
      }

      const { first, last } = parseFirstLast(info.name)

      const { data: contact } = await supabase
        .from('contacts')
        .insert({
          org_id: orgId,
          first_name: first,
          last_name: last,
          email,
          source: 'import',
          external_ids: { gmail_extracted: true },
        })
        .select('id')
        .single()

      if (contact) {
        created++
        newContacts.push({ email, name: info.name })

        // Add a note with email context
        if (info.subjects.length > 0) {
          const contextNote = [
            `Extracted from Gmail sent mail.`,
            `Email threads: ${info.subjects.slice(0, 5).map(s => `"${s}"`).join(', ')}`,
          ].join('\n')

          await supabase.from('notes').insert({
            org_id: orgId,
            contact_id: contact.id,
            content: contextNote,
            author_id: user.id,
          })
        }

        // Link existing synced_emails
        await supabase
          .from('synced_emails')
          .update({ contact_id: contact.id })
          .eq('org_id', orgId)
          .eq('from_email', email)
          .is('contact_id', null)
      }
    }

    return NextResponse.json({
      data: {
        scanned: Math.min(messageIds.length, 200),
        discovered: discovered.size,
        created,
        skipped,
      }
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
