import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { CompanyDetailView } from '@/components/companies/CompanyDetailView'

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: company } = await supabase
    .from('companies')
    .select(`
      *,
      owner:profiles(id,full_name),
      contacts(id,first_name,last_name,email,job_title),
      deals(id,title,value,currency,stage:pipeline_stages(id,name,color)),
      notes(id,content,created_at,author_id,author:profiles(id,full_name))
    `)
    .eq('id', id)
    .single()

  if (!company) notFound()

  return <CompanyDetailView company={company} />
}
