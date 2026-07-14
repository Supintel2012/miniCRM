import { createClient } from '@/lib/supabase/server'
import { IntegrationsSettings } from '@/components/settings/IntegrationsSettings'
import { RrtSettings } from '@/components/settings/RrtSettings'
import { FlinttSettings } from '@/components/settings/FlinttSettings'

export default async function IntegrationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id,role')
    .eq('id', user.id)
    .single()

  const { data: tokens } = await supabase
    .from('integration_tokens')
    .select('provider,enabled,metadata,token_expires_at,updated_at')

  const canManage = ['owner', 'admin'].includes(profile?.role ?? '')

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Integrations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect your tools to sync data automatically.
        </p>
      </div>
      <IntegrationsSettings tokens={tokens ?? []} />
      <div className="pt-2 border-t border-border">
        <h2 className="text-lg font-semibold mb-1">Automated Outreach</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Receive prospect events from outreach tools as new contacts.
        </p>
        <FlinttSettings canManage={canManage} orgId={profile?.org_id ?? ''} />
      </div>
      <div className="pt-2 border-t border-border">
        <h2 className="text-lg font-semibold mb-1">Decision Intelligence</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Run RR Toolbox decision models on your deals and contacts.
        </p>
        <RrtSettings canManage={canManage} />
      </div>
    </div>
  )
}
