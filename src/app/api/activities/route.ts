import { NextRequest } from 'next/server'
import { getAuthenticatedUser, ok, created, unauthorized, badRequest, serverError } from '@/lib/api'
import { createActivitySchema } from '@/lib/validations/activity'

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedUser()
  if (!auth) return unauthorized()

  const { supabase } = auth
  const { searchParams } = new URL(request.url)
  const contact_id = searchParams.get('contact_id')
  const deal_id = searchParams.get('deal_id')
  const type = searchParams.get('type')
  const status = searchParams.get('status')
  const page = Math.max(1, Number(searchParams.get('page') ?? 1))
  const per_page = Math.min(100, Number(searchParams.get('per_page') ?? 25))
  const from = (page - 1) * per_page

  let query = supabase
    .from('activities')
    .select('*, contact:contacts(id,first_name,last_name), deal:deals(id,title), owner:profiles(id,full_name)', { count: 'exact' })

  if (contact_id) query = query.eq('contact_id', contact_id)
  if (deal_id) query = query.eq('deal_id', deal_id)
  if (type) query = query.eq('type', type)
  if (status) query = query.eq('status', status)

  const { data, error, count } = await query
    .order('due_at', { ascending: true, nullsFirst: false })
    .range(from, from + per_page - 1)

  if (error) return serverError(error.message)
  return ok(data, { total: count ?? 0, page, per_page, total_pages: Math.ceil((count ?? 0) / per_page) })
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser()
  if (!auth) return unauthorized()

  const body = await request.json()
  const parsed = createActivitySchema.safeParse(body)
  if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())

  const { supabase, user } = auth
  const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
  if (!profile) return unauthorized()

  const { data, error } = await supabase
    .from('activities')
    .insert({ ...parsed.data, org_id: profile.org_id })
    .select('*')
    .single()

  if (error) return serverError(error.message)
  return created(data)
}
