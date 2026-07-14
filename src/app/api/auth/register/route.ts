import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const schema = z.object({
  full_name: z.string().min(1),
  org_name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
})

const DEFAULT_STAGES = [
  { name: 'Lead',      color: '#9ac0d4', position: 0, is_won: false, is_lost: false },
  { name: 'Qualified', color: '#3d5c7f', position: 1, is_won: false, is_lost: false },
  { name: 'Proposal',  color: '#ee6b4d', position: 2, is_won: false, is_lost: false },
  { name: 'Won',       color: '#10b981', position: 3, is_won: true,  is_lost: false },
  { name: 'Lost',      color: '#ef4444', position: 4, is_won: false, is_lost: true  },
]

export async function POST(request: NextRequest) {
  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Invalid input', details: parsed.error.flatten() } }, { status: 400 })
  }

  const { full_name, org_name, email, password } = parsed.data
  const cookieStore = await cookies()

  // Use service role for registration to bypass RLS
  const adminSupabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )

  // Create auth user
  const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError || !authData.user) {
    return NextResponse.json({ error: { code: 'AUTH_ERROR', message: authError?.message ?? 'Failed to create user' } }, { status: 400 })
  }

  const userId = authData.user.id

  // Create org
  const slug = org_name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')
  const { data: org, error: orgError } = await adminSupabase
    .from('organizations')
    .insert({ name: org_name, slug: `${slug}-${Date.now()}` })
    .select('id')
    .single()

  if (orgError || !org) {
    await adminSupabase.auth.admin.deleteUser(userId)
    return NextResponse.json({ error: { code: 'ORG_ERROR', message: 'Failed to create organization', detail: orgError?.message } }, { status: 500 })
  }

  // Update profile (the on_auth_user_created trigger already created a bare
  // profile row with role='admin' and no org_id — update it with org + owner role)
  const { error: profileError } = await adminSupabase.from('profiles').update({
    org_id: org.id,
    full_name,
    role: 'owner',
  }).eq('id', userId)
  if (profileError) {
    await adminSupabase.auth.admin.deleteUser(userId)
    await adminSupabase.from('organizations').delete().eq('id', org.id)
    return NextResponse.json({ error: { code: 'PROFILE_ERROR', message: 'Failed to update profile', detail: profileError.message } }, { status: 500 })
  }

  // Create default pipeline stages
  const { error: stagesError } = await adminSupabase.from('pipeline_stages').insert(
    DEFAULT_STAGES.map(s => ({ ...s, org_id: org.id }))
  )
  if (stagesError) {
    await adminSupabase.auth.admin.deleteUser(userId)
    await adminSupabase.from('organizations').delete().eq('id', org.id)
    await adminSupabase.from('profiles').delete().eq('id', userId)
    return NextResponse.json({ error: { code: 'STAGES_ERROR', message: 'Failed to create pipeline stages', detail: stagesError.message } }, { status: 500 })
  }

  // Sign in user to create session
  const userSupabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  await userSupabase.auth.signInWithPassword({ email, password })

  return NextResponse.json({ data: { ok: true } }, { status: 201 })
}
