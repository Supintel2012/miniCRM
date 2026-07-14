import { NextRequest } from 'next/server'
import { getAuthenticatedUser, ok, created, unauthorized, badRequest, serverError } from '@/lib/api'
import { createCompanySchema } from '@/lib/validations/company'

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedUser()
  if (!auth) return unauthorized()

  const { supabase } = auth
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')
  const page = Math.max(1, Number(searchParams.get('page') ?? 1))
  const per_page = Math.min(100, Number(searchParams.get('per_page') ?? 25))
  const from = (page - 1) * per_page

  let query = supabase
    .from('companies')
    .select('*, owner:profiles(id,full_name)', { count: 'exact' })

  if (q) query = query.ilike('name', `%${q}%`)

  const { data, error, count } = await query
    .order('name')
    .range(from, from + per_page - 1)

  if (error) return serverError(error.message)
  return ok(data, { total: count ?? 0, page, per_page, total_pages: Math.ceil((count ?? 0) / per_page) })
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser()
  if (!auth) return unauthorized()

  const body = await request.json()
  const parsed = createCompanySchema.safeParse(body)
  if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())

  const { supabase, user } = auth
  const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
  if (!profile) return unauthorized()

  const { data, error } = await supabase
    .from('companies')
    .insert({ ...parsed.data, org_id: profile.org_id })
    .select('*')
    .single()

  if (error) return serverError(error.message)
  return created(data)
}
