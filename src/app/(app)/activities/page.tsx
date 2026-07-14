import { createClient } from '@/lib/supabase/server'
import { ActivitiesView } from '@/components/activities/ActivitiesView'

export default async function ActivitiesPage() {
  const supabase = await createClient()
  const { data: activities } = await supabase
    .from('activities')
    .select('*, contact:contacts(id,first_name,last_name), deal:deals(id,title), owner:profiles(id,full_name)')
    .order('due_at', { ascending: true, nullsFirst: false })
    .limit(50)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Activities</h1>
      <ActivitiesView initialData={activities ?? []} />
    </div>
  )
}
