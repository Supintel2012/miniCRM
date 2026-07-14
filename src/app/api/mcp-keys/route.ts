import { NextRequest } from 'next/server'
import { getAuthenticatedUser, ok, created, unauthorized, badRequest, serverError, forbidden } from '@/lib/api'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'

const createKeySchema = z.object({
  name: z.string().min(1),
  scopes: z.array(z.string()).min(1),
  expires_at: z.string().datetime().optional().nullable(),
})

export async function GET() {
  const auth = await getAuthenticatedUser()
  if (!auth) return unauthorized()

  const { data: profile } = await auth.supabase.from('profiles').select('org_id').eq('id', auth.user.id).single()
  if (!profile) return unauthorized()

  const { data, error } = await auth.supabase
    .from('mcp_api_keys')
    .select('id,name,scopes,last_used,expires_at,created_at,created_by')
    .order('created_at', { ascending: false })

  if (error) return serverError(error.message)
  return ok(data)
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser()
  if (!auth) return unauthorized()

  const { data: profile } = await auth.supabase.from('profiles').select('org_id,role').eq('id', auth.user.id).single()
  if (!profile) return unauthorized()
  if (!['owner', 'admin'].includes(profile.role)) return forbidden()

  const body = await request.json()
  const parsed = createKeySchema.safeParse(body)
  if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())

  const plainKey = randomBytes(32).toString('hex')
  const keyHash = await bcrypt.hash(plainKey, 10)

  const { data, error } = await auth.supabase
    .from('mcp_api_keys')
    .insert({
      org_id: profile.org_id,
      name: parsed.data.name,
      scopes: parsed.data.scopes,
      expires_at: parsed.data.expires_at ?? null,
      key_hash: keyHash,
      created_by: auth.user.id,
    })
    .select('id,name,scopes,last_used,expires_at,created_at,created_by')
    .single()

  if (error) return serverError(error.message)
  // Return the plain key ONCE — it cannot be retrieved again
  return created({ ...data, plain_key: plainKey })
}
