import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ContactDetailView } from '@/components/contacts/ContactDetailView'

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: contact } = await supabase
    .from('contacts')
    .select(`
      *,
      company:companies(id,name,domain,industry),
      owner:profiles(id,full_name),
      deals(id,title,value,currency,stage:pipeline_stages(id,name,color)),
      activities(id,type,subject,status,due_at,description,created_at),
      notes(id,content,created_at,author_id,author:profiles(id,full_name))
    `)
    .eq('id', id)
    .single()

  if (!contact) notFound()

  const { data: companies } = await supabase
    .from('companies')
    .select('id,name')
    .order('name')

  return <ContactDetailView contact={contact} companies={companies ?? []} />
}
