import { NextRequest } from 'next/server'
import { getAuthenticatedUser, ok, noContent, unauthorized, notFound, badRequest, serverError } from '@/lib/api'
import { updateCompanySchema } from '@/lib/validations/company'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedUser()
  if (!auth) return unauthorized()
  const { id } = await params
  const { data, error } = await auth.supabase
    .from('companies')
    .select('*, owner:profiles(id,full_name), contacts(id,first_name,last_name,email), deals(id,title,value,stage:pipeline_stages(id,name,color))')
    .eq('id', id)
    .single()
  if (error || !data) return notFound('Company')
  return ok(data)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedUser()
  if (!auth) return unauthorized()
  const { id } = await params
  const body = await request.json()
  const parsed = updateCompanySchema.safeParse(body)
  if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())
  const { data, error } = await auth.supabase.from('companies').update(parsed.data).eq('id', id).select('*').single()
  if (error) return error.code === 'PGRST116' ? notFound('Company') : serverError(error.message)
  return ok(data)
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedUser()
  if (!auth) return unauthorized()
  const { id } = await params
  const { error } = await auth.supabase.from('companies').delete().eq('id', id)
  if (error) return serverError(error.message)
  return noContent()
}
