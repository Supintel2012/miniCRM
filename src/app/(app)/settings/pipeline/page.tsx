import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PipelineSettings } from '@/components/settings/PipelineSettings'

export default async function PipelineSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: stages } = await supabase
    .from('pipeline_stages')
    .select('*')
    .order('position')

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Pipeline Stages</h1>
        <p className="text-muted-foreground text-sm mt-1">Customize the stages in your sales pipeline.</p>
      </div>
      <PipelineSettings initialStages={stages ?? []} />
    </div>
  )
}
