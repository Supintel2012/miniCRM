import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  return new NextResponse('OK', { status: 200 })
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const params = new URLSearchParams(body)
  const type = params.get('type')
  const email = params.get('data[email]')
  const orgId = request.nextUrl.searchParams.get('org_id')

  if (!orgId || !email) return NextResponse.json({ ok: true })

  const supabase = await createClient()

  if (type === 'subscribe') {
    await supabase.from('contacts').upsert({
      org_id: orgId,
      first_name: params.get('data[merges][FNAME]') || email.split('@')[0],
      last_name: params.get('data[merges][LNAME]') || null,
      email,
      source: 'mailchimp',
    }, { onConflict: 'org_id,email' })
  }

  return NextResponse.json({ ok: true })
}
