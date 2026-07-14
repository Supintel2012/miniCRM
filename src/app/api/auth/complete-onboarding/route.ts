import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const schema = z.object({
  org_name: z.string().min(1),
  full_name: z.string().min(1).optional(),
})

const DEFAULT_STAGES = [
  { name: 'Lead',      color: '#6366f1', position: 0, is_won: false, is_lost: false },
  { name: 'Qualified', color: '#8b5cf6', position: 1, is_won: false, is_lost: false },
  { name: 'Proposal',  color: '#f59e0b', position: 2, is_won: false, is_lost: false },
  { name: 'Won',       color: '#10b981', position: 3, is_won: true,  is_lost: false },
  { name: 'Lost',      color: '#ef4444', position: 4, is_won: false, is_lost: true  },
]

export async function POST(request: NextRequest) {
  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Invalid input', details: parsed.error.flatten() } }, { status: 400 })
  }

  const cookieStore = await cookies()

  // Use service role to bypass RLS — createClient from @supabase/supabase-js
  // properly sends the service_role key as both apikey + Authorization header
  const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Get the authenticated user
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
  const { data: { user } } = await userSupabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, { status: 401 })
  }

  // Check if profile already exists with an org
  const { data: existing } = await adminSupabase
    .from('profiles')
    .select('id, org_id')
    .eq('id', user.id)
    .single()

  if (existing?.org_id) {
    return NextResponse.json({ error: { code: 'ALREADY_ONBOARDED', message: 'Profile already has an organization' } }, { status: 400 })
  }

  const { org_name, full_name } = parsed.data
  const nameToUse = full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'

  // Create org
  const slug = org_name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')
  const { data: org, error: orgError } = await adminSupabase
    .from('organizations')
    .insert({ name: org_name, slug: `${slug}-${Date.now()}` })
    .select('id')
    .single()

  if (orgError || !org) {
    return NextResponse.json({ error: { code: 'ORG_ERROR', message: 'Failed to create organization', detail: orgError?.message } }, { status: 500 })
  }

  // Create or update profile
  let profileError
  if (existing) {
    // Profile row exists but has no org_id (e.g. pre-existing from project setup)
    const r = await adminSupabase
      .from('profiles')
      .update({ org_id: org.id, full_name: nameToUse, role: 'owner' })
      .eq('id', user.id)
    profileError = r.error
  } else {
    const r = await adminSupabase
      .from('profiles')
      .insert({ id: user.id, org_id: org.id, full_name: nameToUse, role: 'owner' })
    profileError = r.error
  }
  if (profileError) {
    return NextResponse.json({ error: { code: 'PROFILE_ERROR', message: 'Failed to update profile', detail: profileError.message } }, { status: 500 })
  }

  // Create default pipeline stages
  const { error: stagesError } = await adminSupabase.from('pipeline_stages').insert(
    DEFAULT_STAGES.map(s => ({ ...s, org_id: org.id }))
  )
  if (stagesError) {
    return NextResponse.json({ error: { code: 'STAGES_ERROR', message: 'Failed to create pipeline stages', detail: stagesError.message } }, { status: 500 })
  }

  return NextResponse.json({ data: { ok: true } }, { status: 201 })
}
