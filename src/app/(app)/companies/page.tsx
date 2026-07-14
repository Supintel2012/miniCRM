import { createClient } from '@/lib/supabase/server'
import { CompaniesTable } from '@/components/companies/CompaniesTable'

export default async function CompaniesPage() {
  const supabase = await createClient()
  const { data: companies } = await supabase
    .from('companies')
    .select('*')
    .order('name')
    .limit(50)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Companies</h1>
      <CompaniesTable initialData={companies ?? []} />
    </div>
  )
}
