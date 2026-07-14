import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { exchangeCalendlyCode, getCalendlyClient } from '@/lib/integrations/calendly'
import { verifyState } from '@/lib/integrations/google'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!

  if (!code || !state) return NextResponse.redirect(`${appUrl}/settings/integrations?error=missing_params`)
  const payload = verifyState(state)
  if (!payload) return NextResponse.redirect(`${appUrl}/settings/integrations?error=invalid_state`)

  try {
    const tokens = await exchangeCalendlyCode(code, payload.org_id as string)
    const client = getCalendlyClient(tokens.access_token)
    const { resource } = await client.getCurrentUser()

    const supabase = await createClient()
    await supabase.from('integration_tokens').upsert({
      org_id: payload.org_id,
      user_id: payload.user_id,
      provider: 'calendly',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      token_expires_at: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null,
      metadata: { user_uri: resource.uri, user_email: resource.email },
      enabled: true,
    }, { onConflict: 'org_id,provider' })

    return NextResponse.redirect(`${appUrl}/settings/integrations?success=calendly`)
  } catch {
    return NextResponse.redirect(`${appUrl}/settings/integrations?error=calendly_auth_failed`)
  }
}
