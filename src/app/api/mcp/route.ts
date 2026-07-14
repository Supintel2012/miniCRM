import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createMcpServer } from '@/lib/mcp/server'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Missing API key' }, { status: 401 })
  }

  const apiKey = authHeader.slice(7)

  const serviceSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: keys } = await serviceSupabase
    .from('mcp_api_keys')
    .select('*')
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)

  const matchedKey = keys?.find((k: { key_hash: string }) => bcrypt.compareSync(apiKey, k.key_hash))

  if (!matchedKey) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
  }

  serviceSupabase.from('mcp_api_keys')
    .update({ last_used: new Date().toISOString() })
    .eq('id', matchedKey.id)
    .then(() => {})

  const mcpSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const server = createMcpServer(mcpSupabase, matchedKey.org_id, matchedKey.scopes)

  const body = await request.text()

  // Use StreamableHTTP transport for stateless MCP over HTTP
  const { StreamableHTTPServerTransport } = await import('@modelcontextprotocol/sdk/server/streamableHttp.js')

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
  await server.connect(transport)

  return transport.handleRequest(request as never, new NextResponse() as never, body)
}
