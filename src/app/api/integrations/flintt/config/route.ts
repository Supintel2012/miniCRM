import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUser, ok, unauthorized, badRequest, serverError } from '@/lib/api'

export async function GET() {
  const auth = await getAuthenticatedUser()
  if (!auth) return unauthorized()

  const { data: profile } = await auth.supabase
    .from('profiles')
    .select('org_id,role')
    .eq('id', auth.user.id)
    .single()
  if (!profile) return unauthorized()

  const serviceSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data } = await serviceSupabase
    .from('crm.integration_credentials')
    .select('config')
    .eq('org_id', profile.org_id)
    .eq('provider', 'flintt')
    .single()

  const config = data?.config as Record<string, string> | null
  return ok({
    has_token: !!config?.webhook_token,
    // Don't return the full token — just whether it's set
    webhook_token: config?.webhook_token ? '••••••••' : null,
  })
}

const putSchema = z.object({
  webhook_token: z.string().min(1),
})

export async function PUT(request: NextRequest) {
  const auth = await getAuthenticatedUser()
  if (!auth) return unauthorized()

  const { data: profile } = await auth.supabase
    .from('profiles')
    .select('org_id,role')
    .eq('id', auth.user.id)
    .single()
  if (!profile) return unauthorized()
  if (!['owner', 'admin'].includes(profile.role)) {
    return Response.json({ error: { code: 'FORBIDDEN', message: 'Admin only' } }, { status: 403 })
  }

  const parsed = putSchema.safeParse(await request.json())
  if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())

  const serviceSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { error } = await serviceSupabase
    .from('crm.integration_credentials')
    .upsert(
      {
        org_id: profile.org_id,
        provider: 'flintt',
        config: { webhook_token: parsed.data.webhook_token },
      },
      { onConflict: 'org_id,provider' },
    )

  if (error) return serverError(error.message)
  return ok({ has_token: true })
}
