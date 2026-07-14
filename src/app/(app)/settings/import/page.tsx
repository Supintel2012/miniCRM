import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ImportSettings } from '@/components/settings/ImportSettings'

export default async function ImportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Check which integrations are connected
  const { data: tokens } = await supabase
    .from('integration_tokens')
    .select('provider,enabled,metadata')
    .in('provider', ['google', 'mailchimp', 'hubspot'])

  const connected = {
    google: tokens?.some(t => t.provider === 'google' && t.enabled) ?? false,
    mailchimp: tokens?.some(t => t.provider === 'mailchimp' && t.enabled) ?? false,
    hubspot: tokens?.some(t => t.provider === 'hubspot' && t.enabled) ?? false,
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Import & Migration</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Import your existing contacts from HubSpot, Gmail, and Mailchimp.
        </p>
      </div>
      <ImportSettings connected={connected} />
    </div>
  )
}
