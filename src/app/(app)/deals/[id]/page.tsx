import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { DealDetailView } from '@/components/deals/DealDetailView'

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [dealRes, stagesRes, contactsRes, companiesRes] = await Promise.all([
    supabase
      .from('deals')
      .select(`
        *,
        stage:pipeline_stages(*),
        contact:contacts(id,first_name,last_name,email,phone),
        company:companies(id,name),
        owner:profiles(id,full_name),
        activities(id,type,subject,status,due_at,description,created_at),
        notes(id,content,created_at,author_id,author:profiles(id,full_name))
      `)
      .eq('id', id)
      .single(),
    supabase.from('pipeline_stages').select('*').order('position'),
    supabase.from('contacts').select('id,first_name,last_name').order('first_name'),
    supabase.from('companies').select('id,name').order('name'),
  ])

  if (!dealRes.data) notFound()

  return (
    <DealDetailView
      deal={dealRes.data}
      stages={stagesRes.data ?? []}
      contacts={contactsRes.data ?? []}
      companies={companiesRes.data ?? []}
    />
  )
}
