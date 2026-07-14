import { NextRequest } from 'next/server'
import { getAuthenticatedUser, ok, created, unauthorized, badRequest, serverError } from '@/lib/api'
import { createContactSchema } from '@/lib/validations/contact'

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedUser()
  if (!auth) return unauthorized()

  const { supabase } = auth
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')
  const company_id = searchParams.get('company_id')
  const page = Math.max(1, Number(searchParams.get('page') ?? 1))
  const per_page = Math.min(100, Math.max(1, Number(searchParams.get('per_page') ?? 25)))
  const from = (page - 1) * per_page
  const sort = searchParams.get('sort') ?? 'created_at'
  const order = searchParams.get('order') === 'asc'

  let query = supabase
    .from('contacts')
    .select('*, company:companies(id,name), owner:profiles(id,full_name)', { count: 'exact' })

  if (q) {
    query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`)
  }
  if (company_id) query = query.eq('company_id', company_id)

  const { data, error, count } = await query
    .order(sort, { ascending: order })
    .range(from, from + per_page - 1)

  if (error) return serverError(error.message)

  return ok(data, {
    total: count ?? 0,
    page,
    per_page,
    total_pages: Math.ceil((count ?? 0) / per_page),
  })
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser()
  if (!auth) return unauthorized()

  const body = await request.json()
  const parsed = createContactSchema.safeParse(body)
  if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())

  const { supabase, user } = auth
  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single()

  if (!profile) return unauthorized()

  const { data, error } = await supabase
    .from('contacts')
    .insert({ ...parsed.data, org_id: profile.org_id })
    .select('*')
    .single()

  if (error) return serverError(error.message)
  return created(data)
}
