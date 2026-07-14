import { createClient } from '@/lib/supabase/server'
import { DealsKanban } from '@/components/deals/DealsKanban'

export default async function DealsPage() {
  const supabase = await createClient()

  const [{ data: stages }, { data: deals }] = await Promise.all([
    supabase.from('pipeline_stages').select('*').order('position'),
    supabase.from('deals').select('*, stage:pipeline_stages(id,name,color,position,is_won,is_lost), contact:contacts(id,first_name,last_name), company:companies(id,name), owner:profiles(id,full_name)').order('created_at', { ascending: false }),
  ])

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between shrink-0">
        <h1 className="text-2xl font-semibold">Deals</h1>
      </div>
      <DealsKanban initialStages={stages ?? []} initialDeals={deals ?? []} />
    </div>
  )
}
