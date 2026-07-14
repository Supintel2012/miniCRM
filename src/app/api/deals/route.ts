import { NextRequest } from 'next/server'
import { getAuthenticatedUser, ok, created, unauthorized, badRequest, serverError } from '@/lib/api'
import { createDealSchema } from '@/lib/validations/deal'

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedUser()
  if (!auth) return unauthorized()

  const { supabase } = auth
  const { searchParams } = new URL(request.url)
  const stage_id = searchParams.get('stage_id')
  const contact_id = searchParams.get('contact_id')
  const company_id = searchParams.get('company_id')
  const page = Math.max(1, Number(searchParams.get('page') ?? 1))
  const per_page = Math.min(100, Number(searchParams.get('per_page') ?? 50))
  const from = (page - 1) * per_page

  let query = supabase
    .from('deals')
    .select('*, stage:pipeline_stages(id,name,color,position,is_won,is_lost), contact:contacts(id,first_name,last_name,email), company:companies(id,name), owner:profiles(id,full_name)', { count: 'exact' })

  if (stage_id) query = query.eq('stage_id', stage_id)
  if (contact_id) query = query.eq('contact_id', contact_id)
  if (company_id) query = query.eq('company_id', company_id)

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, from + per_page - 1)

  if (error) return serverError(error.message)
  return ok(data, { total: count ?? 0, page, per_page, total_pages: Math.ceil((count ?? 0) / per_page) })
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser()
  if (!auth) return unauthorized()

  const body = await request.json()
  const parsed = createDealSchema.safeParse(body)
  if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())

  const { supabase, user } = auth
  const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
  if (!profile) return unauthorized()

  const { data, error } = await supabase
    .from('deals')
    .insert({ ...parsed.data, org_id: profile.org_id })
    .select('*, stage:pipeline_stages(id,name,color)')
    .single()

  if (error) return serverError(error.message)
  return created(data)
}
