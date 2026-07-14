import { NextRequest } from 'next/server'
import { getAuthenticatedUser, ok, noContent, unauthorized, notFound, badRequest, serverError } from '@/lib/api'
import { z } from 'zod'

const updateStageSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().optional(),
  position: z.number().int().min(0).optional(),
  is_won: z.boolean().optional(),
  is_lost: z.boolean().optional(),
})

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedUser()
  if (!auth) return unauthorized()

  const { id } = await params
  const body = await request.json()
  const parsed = updateStageSchema.safeParse(body)
  if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())

  const { data, error } = await auth.supabase
    .from('pipeline_stages')
    .update(parsed.data)
    .eq('id', id)
    .select('*')
    .single()

  if (error) return error.code === 'PGRST116' ? notFound('Stage') : serverError(error.message)
  return ok(data)
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedUser()
  if (!auth) return unauthorized()

  const { id } = await params
  const { error } = await auth.supabase.from('pipeline_stages').delete().eq('id', id)
  if (error) return serverError(error.message)
  return noContent()
}
