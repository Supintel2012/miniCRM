import { createClient } from '@/lib/supabase/server'
import { ContactsTable } from '@/components/contacts/ContactsTable'

export default async function ContactsPage() {
  const supabase = await createClient()
  const { data: contacts } = await supabase
    .from('contacts')
    .select('*, company:companies(id,name), owner:profiles(id,full_name)')
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Contacts</h1>
      </div>
      <ContactsTable initialData={contacts ?? []} />
    </div>
  )
}
