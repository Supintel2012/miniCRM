import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUser, ok, unauthorized, badRequest, serverError } from '@/lib/api'
import { getRrtConfigService, runRrtModel, RrtError } from '@/lib/integrations/rrtoolbox'
import { z } from 'zod'

const runSchema = z.object({
  model_name: z.string().min(1),
  parameters: z.record(z.string(), z.unknown()).default({}),
  deal_id: z.string().uuid().optional().nullable(),
  contact_id: z.string().uuid().optional().nullable(),
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

  const body = await request.json()
  const parsed = runSchema.safeParse(body)
  if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())

  const { model_name, parameters, deal_id, contact_id } = parsed.data

  const config = await getRrtConfigService(profile.org_id)
  if (!config) return badRequest('RR Toolbox is not configured. Add your RRT API key in Settings → Integrations.')

  const start = Date.now()
  let success = true
  let errorMessage: string | null = null
  let result: Awaited<ReturnType<typeof runRrtModel>> | null = null

  try {
    result = await runRrtModel(config, model_name, parameters)
  } catch (err) {
    success = false
    errorMessage = err instanceof Error ? err.message : String(err)
    if (err instanceof RrtError) {
      return NextResponse.json(
        { error: { code: 'RRT_API_ERROR', message: errorMessage, status: err.status } },
        { status: err.status >= 400 && err.status < 500 ? err.status : 502 },
      )
    }
    return serverError(errorMessage)
  } finally {
    const duration_ms = Date.now() - start
    // Log the run to rrt_model_runs (best-effort, never blocks the response).
    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    serviceSupabase
      .from('crm.rrt_model_runs')
      .insert({
        org_id: profile.org_id,
        user_id: auth.user.id,
        model_name,
        deal_id: deal_id ?? null,
        contact_id: contact_id ?? null,
        parameters,
        summary: result?.summary ?? null,
        recommended_action: result?.recommended_action ?? null,
        key_drivers: result?.key_drivers ?? null,
        warnings: result?.warnings ?? null,
        attribution: result?.attribution ?? null,
        raw_result: result?.raw ?? null,
        success,
        error_message: errorMessage,
        duration_ms,
      })
      .then(() => {}, () => {})
  }

  return ok(result)
}
