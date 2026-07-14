import { NextRequest } from 'next/server'
import { getAuthenticatedUser, ok, noContent, unauthorized, notFound, badRequest, serverError } from '@/lib/api'
import { updateActivitySchema } from '@/lib/validations/activity'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedUser()
  if (!auth) return unauthorized()
  const { id } = await params
  const body = await request.json()
  const parsed = updateActivitySchema.safeParse(body)
  if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())
  const { data, error } = await auth.supabase.from('activities').update(parsed.data).eq('id', id).select('*').single()
  if (error) return error.code === 'PGRST116' ? notFound('Activity') : serverError(error.message)
  return ok(data)
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedUser()
  if (!auth) return unauthorized()
  const { id } = await params
  const { error } = await auth.supabase.from('activities').delete().eq('id', id)
  if (error) return serverError(error.message)
  return noContent()
}
