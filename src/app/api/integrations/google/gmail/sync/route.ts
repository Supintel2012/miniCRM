import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthorizedClient } from '@/lib/integrations/google'
import { google } from 'googleapis'

export async function POST(request: NextRequest) {
  // Support cron-triggered sync with SYNC_CRON_SECRET
  const authHeader = request.headers.get('authorization')
  const isCron = authHeader === `Bearer ${process.env.SYNC_CRON_SECRET}`

  let orgId: string | undefined

  if (!isCron) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
    orgId = profile?.org_id
  }

  if (!orgId) return NextResponse.json({ error: 'org_id required' }, { status: 400 })

  const authorized = await getAuthorizedClient(orgId)
  if (!authorized) return NextResponse.json({ error: 'Google not connected' }, { status: 400 })

  const { client, token } = authorized
  const gmail = google.gmail({ version: 'v1', auth: client })
  const supabase = await createClient()

  const historyId = (token.metadata as Record<string, string>)?.gmail_history_id

  try {
    let messageIds: string[] = []

    if (historyId) {
      // Incremental sync
      const history = await gmail.users.history.list({
        userId: 'me',
        startHistoryId: historyId,
        historyTypes: ['messageAdded'],
      })
      const items = history.data.history ?? []
      messageIds = items.flatMap(h => h.messagesAdded?.map(m => m.message?.id ?? '') ?? []).filter(Boolean)
    } else {
      // Initial sync — last 100 messages
      const list = await gmail.users.messages.list({ userId: 'me', maxResults: 100 })
      messageIds = list.data.messages?.map(m => m.id ?? '').filter(Boolean) ?? []
    }

    let synced = 0
    for (const msgId of messageIds.slice(0, 50)) {
      try {
        const msg = await gmail.users.messages.get({ userId: 'me', id: msgId, format: 'metadata', metadataHeaders: ['From', 'To', 'Subject', 'Date'] })
        const headers = msg.data.payload?.headers ?? []
        const getHeader = (name: string) => headers.find(h => h.name === name)?.value ?? ''

        const fromEmail = getHeader('From').match(/<(.+?)>/)?.[ 1] ?? getHeader('From')
        const subject = getHeader('Subject')
        const date = getHeader('Date')
        const threadId = msg.data.threadId ?? ''

        // Try to link to a contact
        const { data: contact } = await supabase.from('contacts').select('id').eq('email', fromEmail).eq('org_id', orgId).maybeSingle()

        await supabase.from('synced_emails').upsert({
          org_id: orgId,
          gmail_id: msgId,
          thread_id: threadId,
          subject,
          from_email: fromEmail,
          to_emails: [getHeader('To')],
          snippet: msg.data.snippet,
          received_at: date ? new Date(date).toISOString() : null,
          contact_id: contact?.id ?? null,
          labels: msg.data.labelIds ?? [],
        }, { onConflict: 'org_id,gmail_id' })

        synced++
      } catch { /* skip individual message errors */ }
    }

    // Update historyId
    const profile = await gmail.users.getProfile({ userId: 'me' })
    await supabase.from('integration_tokens').update({
      metadata: { ...token.metadata as object, gmail_history_id: profile.data.historyId },
    }).eq('org_id', orgId).eq('provider', 'google')

    return NextResponse.json({ data: { synced } })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
