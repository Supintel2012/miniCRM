import { NextRequest } from 'next/server'
import { getAuthenticatedUser, noContent, unauthorized, forbidden, serverError } from '@/lib/api'

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedUser()
  if (!auth) return unauthorized()

  const { id } = await params
  const { data: profile } = await auth.supabase.from('profiles').select('role').eq('id', auth.user.id).single()
  if (!profile) return unauthorized()
  if (!['owner', 'admin'].includes(profile.role)) return forbidden()

  const { error } = await auth.supabase.from('mcp_api_keys').delete().eq('id', id)
  if (error) return serverError(error.message)
  return noContent()
}
