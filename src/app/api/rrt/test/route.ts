import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser, ok, unauthorized, badRequest, serverError } from '@/lib/api'
import { getRrtConfigService, testRrtConnection, RrtError } from '@/lib/integrations/rrtoolbox'

const schema = z.object({
  base_url: z.string().url().optional(),
  api_key: z.string().min(1).optional(),
})

export async function POST(request: NextRequest) {
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

  const body = await request.json().catch(() => ({}))
  const parsed = schema.safeParse(body)

  // If the caller provides ad-hoc credentials, test those; otherwise test the
  // stored config. This lets the Settings UI verify before saving.
  let config: Awaited<ReturnType<typeof getRrtConfigService>>
  if (parsed.success && parsed.data.base_url && parsed.data.api_key) {
    config = { base_url: parsed.data.base_url, api_key: parsed.data.api_key }
  } else {
    config = await getRrtConfigService(profile.org_id)
  }

  if (!config) return badRequest('No credentials to test.')

  try {
    const result = await testRrtConnection(config)
    return ok(result)
  } catch (err) {
    if (err instanceof RrtError) {
      return Response.json(
        { error: { code: 'RRT_API_ERROR', message: err.message, status: err.status } },
        { status: err.status >= 400 && err.status < 500 ? err.status : 502 },
      )
    }
    return serverError(err instanceof Error ? err.message : String(err))
  }
}
