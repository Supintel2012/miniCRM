import { getAuthenticatedUser, ok, unauthorized, badRequest, serverError } from '@/lib/api'
import { getRrtConfigService, listRrtModels, RrtError } from '@/lib/integrations/rrtoolbox'

export async function GET() {
  const auth = await getAuthenticatedUser()
  if (!auth) return unauthorized()

  const { data: profile } = await auth.supabase
    .from('profiles')
    .select('org_id')
    .eq('id', auth.user.id)
    .single()
  if (!profile) return unauthorized()

  const config = await getRrtConfigService(profile.org_id)
  if (!config) return badRequest('RR Toolbox is not configured.')

  try {
    const models = await listRrtModels(config)
    return ok(models)
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
