import { NextRequest } from 'next/server'
import { getAuthenticatedUser, ok, created, unauthorized, badRequest, serverError } from '@/lib/api'
import { z } from 'zod'

const createStageSchema = z.object({
  name: z.string().min(1),
  color: z.string().default('#ee6b4d'),
  position: z.number().int().min(0),
  is_won: z.boolean().default(false),
  is_lost: z.boolean().default(false),
})

export async function GET() {
  const auth = await getAuthenticatedUser()
  if (!auth) return unauthorized()

  const { data, error } = await auth.supabase
    .from('crm.pipeline_stages')
    .select('*')
    .order('position')

  if (error) return serverError(error.message)
  return ok(data)
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser()
  if (!auth) return unauthorized()

  const body = await request.json()
  const parsed = createStageSchema.safeParse(body)
  if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())

  const { data: profile } = await auth.supabase.from('profiles').select('org_id').eq('id', auth.user.id).single()
  if (!profile) return unauthorized()

  const { data, error } = await auth.supabase
    .from('crm.pipeline_stages')
    .insert({ ...parsed.data, org_id: profile.org_id })
    .select('*')
    .single()

  if (error) return serverError(error.message)
  return created(data)
}
