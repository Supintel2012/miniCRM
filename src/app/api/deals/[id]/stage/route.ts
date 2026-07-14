import { NextRequest } from 'next/server'
import { getAuthenticatedUser, ok, unauthorized, notFound, badRequest, serverError } from '@/lib/api'
import { moveDealStageSchema } from '@/lib/validations/deal'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedUser()
  if (!auth) return unauthorized()

  const { id } = await params
  const body = await request.json()
  const parsed = moveDealStageSchema.safeParse(body)
  if (!parsed.success) return badRequest('stage_id is required')

  const { data, error } = await auth.supabase
    .from('deals')
    .update({ stage_id: parsed.data.stage_id })
    .eq('id', id)
    .select('*, stage:pipeline_stages(id,name,color)')
    .single()

  if (error) return error.code === 'PGRST116' ? notFound('Deal') : serverError(error.message)
  return ok(data)
}
