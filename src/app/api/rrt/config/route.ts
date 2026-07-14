import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUser, ok, unauthorized, badRequest, serverError } from '@/lib/api'
import { getRrtConfigService } from '@/lib/integrations/rrtoolbox'

export async function GET() {
  const auth = await getAuthenticatedUser()
  if (!auth) return unauthorized()

  const { data: profile } = await auth.supabase
    .from('profiles')
    .select('org_id,role')
    .eq('id', auth.user.id)
    .single()
  if (!profile) return unauthorized()

  const config = await getRrtConfigService(profile.org_id)
  // Never return the API key — only whether one is set.
  return ok({
    configured: !!config,
    base_url: config?.base_url ?? null,
    has_api_key: !!config?.api_key,
  })
}

const putSchema = z.object({
  base_url: z.string().url(),
  api_key: z.string().min(1),
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
        provider: 'rrtoolbox',
        config: { base_url: parsed.data.base_url, api_key: parsed.data.api_key },
      },
      { onConflict: 'org_id,provider' },
    )

  if (error) return serverError(error.message)
  return ok({ configured: true, base_url: parsed.data.base_url, has_api_key: true })
}
