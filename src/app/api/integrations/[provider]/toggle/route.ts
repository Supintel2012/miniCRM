import { NextRequest } from 'next/server'
import { getAuthenticatedUser, ok, unauthorized, serverError } from '@/lib/api'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const auth = await getAuthenticatedUser()
  if (!auth) return unauthorized()

  const { provider } = await params
  const { enabled } = await request.json()
  const { supabase, user } = auth

  const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
  if (!profile) return unauthorized()

  const { error } = await supabase
    .from('integration_tokens')
    .update({ enabled })
    .eq('org_id', profile.org_id)
    .eq('provider', provider)

  if (error) return serverError(error.message)
  return ok({ enabled })
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const auth = await getAuthenticatedUser()
  if (!auth) return unauthorized()

  const { provider } = await params
  const { supabase, user } = auth

  const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
  if (!profile) return unauthorized()

  const { error } = await supabase
    .from('integration_tokens')
    .delete()
    .eq('org_id', profile.org_id)
    .eq('provider', provider)

  if (error) return serverError(error.message)
  return ok({ disconnected: true })
}
