import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOAuthClientForOrg, verifyState } from '@/lib/integrations/google'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!

  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}/settings/integrations?error=missing_params`)
  }

  const payload = verifyState(state)
  if (!payload) {
    return NextResponse.redirect(`${appUrl}/settings/integrations?error=invalid_state`)
  }

  try {
    const client = await getOAuthClientForOrg(payload.org_id as string)
    if (!client) return NextResponse.redirect(`${appUrl}/settings/integrations?error=google_not_configured`)

    const { tokens } = await client.getToken(code)

    const supabase = await createClient()
    await supabase.from('integration_tokens').upsert({
      org_id: payload.org_id,
      user_id: payload.user_id,
      provider: 'google',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      scopes: tokens.scope?.split(' ') ?? [],
      enabled: true,
    }, { onConflict: 'org_id,provider' })

    return NextResponse.redirect(`${appUrl}/settings/integrations?success=google`)
  } catch {
    return NextResponse.redirect(`${appUrl}/settings/integrations?error=google_auth_failed`)
  }
}
