import { NextRequest } from 'next/server'
import { getAuthenticatedUser, ok, created, unauthorized, badRequest, serverError } from '@/lib/api'
import { z } from 'zod'

const createNoteSchema = z.object({
  content: z.string().min(1),
  contact_id: z.string().uuid().optional().nullable(),
  deal_id: z.string().uuid().optional().nullable(),
  company_id: z.string().uuid().optional().nullable(),
})

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedUser()
  if (!auth) return unauthorized()

  const { searchParams } = new URL(request.url)
  const contact_id = searchParams.get('contact_id')
  const deal_id = searchParams.get('deal_id')
  const company_id = searchParams.get('company_id')

  let query = auth.supabase
    .from('notes')
    .select('*, author:profiles(id,full_name)')
    .order('created_at', { ascending: false })

  if (contact_id) query = query.eq('contact_id', contact_id)
  if (deal_id) query = query.eq('deal_id', deal_id)
  if (company_id) query = query.eq('company_id', company_id)

  const { data, error } = await query
  if (error) return serverError(error.message)
  return ok(data)
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser()
  if (!auth) return unauthorized()

  const body = await request.json()
  const parsed = createNoteSchema.safeParse(body)
  if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())

  const { supabase, user } = auth
  const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
  if (!profile) return unauthorized()

  const { data, error } = await supabase
    .from('notes')
    .insert({ ...parsed.data, org_id: profile.org_id, author_id: user.id })
    .select('*, author:profiles(id,full_name)')
    .single()

  if (error) return serverError(error.message)
  return created(data)
}
