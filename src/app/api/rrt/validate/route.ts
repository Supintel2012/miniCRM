import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser, ok, unauthorized, badRequest, serverError } from '@/lib/api'
import { getRrtConfigService, validateRrtInputs, RrtError } from '@/lib/integrations/rrtoolbox'

const schema = z.object({
  model_name: z.string().min(1),
  parameters: z.record(z.string(), z.unknown()).default({}),
})

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser()
  if (!auth) return unauthorized()

  const { data: profile } = await auth.supabase
    .from('profiles')
    .select('org_id')
    .eq('id', auth.user.id)
    .single()
  if (!profile) return unauthorized()

  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())

  const config = await getRrtConfigService(profile.org_id)
  if (!config) return badRequest('RR Toolbox is not configured.')

  try {
    const result = await validateRrtInputs(config, parsed.data.model_name, parsed.data.parameters)
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
