import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ApiKeysSettings } from '@/components/settings/ApiKeysSettings'

export default async function ApiKeysPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: keys } = await supabase
    .from('mcp_api_keys')
    .select('id,org_id,name,scopes,last_used,expires_at,created_at,created_by')
    .order('created_at', { ascending: false })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const canManage = profile?.role === 'owner' || profile?.role === 'admin'

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">API Keys</h1>
        <p className="text-muted-foreground text-sm mt-1">
          MCP API keys allow AI agents (like Claude Desktop) to access your CRM data.
        </p>
      </div>
      <ApiKeysSettings initialKeys={keys ?? []} canManage={canManage} />
    </div>
  )
}
