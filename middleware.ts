import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Guard: if env vars are missing (e.g. Vercel preview without env set), pass through
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  let user = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    // Auth check failed (edge network issue, bad cookie, etc.) — pass through
    return NextResponse.next({ request })
  }

  const { pathname } = request.nextUrl

  // Public routes that don't require auth
  const publicPaths = ['/login', '/register', '/onboarding', '/auth/callback', '/demo']
  const isPublicPath = publicPaths.some(p => pathname.startsWith(p))

  // API auth routes (register, complete-onboarding) and webhooks bypass middleware auth
  const isBypassPath =
    pathname.startsWith('/api/auth/') ||
    (pathname.startsWith('/api/integrations') && pathname.includes('/webhook')) ||
    pathname === '/api/mcp'

  if (!user && !isPublicPath && !isBypassPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Logged-in users hitting login/register go to dashboard (but NOT /onboarding —
  // they may need to complete onboarding even with a valid session)
  if (user && (pathname === '/login' || pathname === '/register')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  if (pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = user ? '/dashboard' : '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
