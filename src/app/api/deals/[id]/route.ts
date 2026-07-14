import { NextRequest } from 'next/server'
import { getAuthenticatedUser, ok, noContent, unauthorized, notFound, badRequest, serverError } from '@/lib/api'
import { updateDealSchema } from '@/lib/validations/deal'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedUser()
  if (!auth) return unauthorized()
  const { id } = await params
  const { data, error } = await auth.supabase
    .from('deals')
    .select('*, stage:pipeline_stages(*), contact:contacts(id,first_name,last_name,email,phone), company:companies(id,name), owner:profiles(id,full_name), activities(id,type,subject,status,due_at), notes(id,content,created_at,author:profiles(id,full_name))')
    .eq('id', id)
    .single()
  if (error || !data) return notFound('Deal')
  return ok(data)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedUser()
  if (!auth) return unauthorized()
  const { id } = await params
  const body = await request.json()
  const parsed = updateDealSchema.safeParse(body)
  if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())
  const { data, error } = await auth.supabase.from('deals').update(parsed.data).eq('id', id).select('*, stage:pipeline_stages(id,name,color)').single()
  if (error) return error.code === 'PGRST116' ? notFound('Deal') : serverError(error.message)
  return ok(data)
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedUser()
  if (!auth) return unauthorized()
  const { id } = await params
  const { error } = await auth.supabase.from('deals').delete().eq('id', id)
  if (error) return serverError(error.message)
  return noContent()
}
