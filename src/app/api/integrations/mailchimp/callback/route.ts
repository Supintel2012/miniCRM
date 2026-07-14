import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCredentials } from '@/lib/integrations/credentials'
import { verifyState } from '@/lib/integrations/google'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!

  if (!code || !state) return NextResponse.redirect(`${appUrl}/settings/integrations?error=missing_params`)

  const payload = verifyState(state)
  if (!payload) return NextResponse.redirect(`${appUrl}/settings/integrations?error=invalid_state`)

  const orgId = payload.org_id as string
  // provider may be mailchimp, mailchimp_a, or mailchimp_b
  const provider = (payload.provider as string | undefined) ?? 'mailchimp'

  try {
    // Always use base 'mailchimp' credentials for OAuth
    const creds = await getCredentials('mailchimp', orgId)
    const clientId = creds?.client_id ?? process.env.MAILCHIMP_CLIENT_ID
    const clientSecret = creds?.client_secret ?? process.env.MAILCHIMP_CLIENT_SECRET
    if (!clientId || !clientSecret) {
      return NextResponse.redirect(`${appUrl}/settings/integrations?error=mailchimp_not_configured`)
    }

    const tokenRes = await fetch('https://login.mailchimp.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${appUrl}/api/integrations/mailchimp/callback`,
        code,
      }),
    })
    const tokenData = await tokenRes.json()

    const metaRes = await fetch('https://login.mailchimp.com/oauth2/metadata', {
      headers: { Authorization: `OAuth ${tokenData.access_token}` },
    })
    const meta = await metaRes.json()

    const supabase = await createClient()
    await supabase.from('integration_tokens').upsert({
      org_id: payload.org_id,
      user_id: payload.user_id,
      provider,
      access_token: tokenData.access_token,
      metadata: { data_center: meta.dc },
      enabled: true,
    }, { onConflict: 'org_id,provider' })

    return NextResponse.redirect(`${appUrl}/settings/integrations?success=${provider}`)
  } catch {
    return NextResponse.redirect(`${appUrl}/settings/integrations?error=mailchimp_auth_failed`)
  }
}
