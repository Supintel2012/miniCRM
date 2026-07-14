import { NextRequest } from 'next/server'
import { getAuthenticatedUser, ok, noContent, unauthorized, notFound, badRequest, serverError } from '@/lib/api'
import { updateContactSchema } from '@/lib/validations/contact'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedUser()
  if (!auth) return unauthorized()

  const { id } = await params
  const { supabase } = auth

  const { data, error } = await supabase
    .from('contacts')
    .select(`
      *,
      company:companies(id,name,domain,industry),
      owner:profiles(id,full_name),
      deals(id,title,value,currency,stage:pipeline_stages(id,name,color)),
      activities(id,type,subject,status,due_at),
      notes(id,content,created_at,author:profiles(id,full_name))
    `)
    .eq('id', id)
    .single()

  if (error || !data) return notFound('Contact')
  return ok(data)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedUser()
  if (!auth) return unauthorized()

  const { id } = await params
  const body = await request.json()
  const parsed = updateContactSchema.safeParse(body)
  if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())

  const { supabase } = auth
  const { data, error } = await supabase
    .from('contacts')
    .update(parsed.data)
    .eq('id', id)
    .select('*')
    .single()

  if (error) return error.code === 'PGRST116' ? notFound('Contact') : serverError(error.message)
  return ok(data)
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedUser()
  if (!auth) return unauthorized()

  const { id } = await params
  const { supabase } = auth
  const { error } = await supabase.from('contacts').delete().eq('id', id)
  if (error) return serverError(error.message)
  return noContent()
}
