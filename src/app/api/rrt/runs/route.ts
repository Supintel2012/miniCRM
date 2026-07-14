import { NextRequest } from 'next/server'
import { getAuthenticatedUser, ok, unauthorized, badRequest, serverError } from '@/lib/api'

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedUser()
  if (!auth) return unauthorized()

  const { data: profile } = await auth.supabase
    .from('profiles')
    .select('org_id')
    .eq('id', auth.user.id)
    .single()
  if (!profile) return unauthorized()

  const { searchParams } = new URL(request.url)
  const dealId = searchParams.get('deal_id')
  const contactId = searchParams.get('contact_id')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10) || 20, 50)

  if (!dealId && !contactId) return badRequest('Provide deal_id or contact_id')

  let query = auth.supabase
    .from('rrt_model_runs')
    .select('id,model_name,deal_id,contact_id,summary,recommended_action,key_drivers,warnings,attribution,success,error_message,duration_ms,created_at')
    .eq('org_id', profile.org_id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (dealId) query = query.eq('deal_id', dealId)
  if (contactId) query = query.eq('contact_id', contactId)

  const { data, error } = await query
  if (error) return serverError(error.message)
  return ok(data)
}
