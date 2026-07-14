import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'

export function createMcpServer(supabase: SupabaseClient, orgId: string, scopes: string[]) {
  const server = new McpServer({ name: 'miniCRM', version: '1.0.0' })

  function requireScope(scope: string) {
    if (!scopes.includes(scope)) {
      throw new Error(`Missing scope: ${scope}`)
    }
  }

  // ── Contacts ──────────────────────────────────────────────────────────
  server.tool('list_contacts', {
    q: z.string().optional().describe('Search by name or email'),
    limit: z.number().min(1).max(100).default(20),
    tags: z.array(z.string()).optional(),
  }, async ({ q, limit, tags }) => {
    requireScope('read:contacts')
    let query = supabase.from('contacts')
      .select('id,first_name,last_name,email,phone,job_title,tags,company:companies(id,name)')
      .eq('org_id', orgId)
      .limit(limit)
    if (q) query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`)
    if (tags?.length) query = query.contains('tags', tags)
    const { data, error } = await query
    if (error) throw error
    return { content: [{ type: 'text', text: JSON.stringify(data) }] }
  })

  server.tool('get_contact', { id: z.string().uuid() }, async ({ id }) => {
    requireScope('read:contacts')
    const { data, error } = await supabase.from('contacts')
      .select('*, company:companies(id,name), deals(id,title,value,stage:pipeline_stages(id,name)), activities(id,type,subject,status,due_at)')
      .eq('id', id).eq('org_id', orgId).single()
    if (error) throw error
    return { content: [{ type: 'text', text: JSON.stringify(data) }] }
  })

  server.tool('create_contact', {
    first_name: z.string().min(1),
    last_name: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    company_id: z.string().uuid().optional(),
    tags: z.array(z.string()).optional(),
  }, async (input) => {
    requireScope('write:contacts')
    const { data, error } = await supabase.from('contacts')
      .insert({ ...input, org_id: orgId }).select('*').single()
    if (error) throw error
    return { content: [{ type: 'text', text: JSON.stringify(data) }] }
  })

  // ── Deals ──────────────────────────────────────────────────────────────
  server.tool('list_deals', {
    stage_id: z.string().uuid().optional(),
    contact_id: z.string().uuid().optional(),
    limit: z.number().min(1).max(100).default(20),
  }, async ({ stage_id, contact_id, limit }) => {
    requireScope('read:deals')
    let query = supabase.from('deals')
      .select('id,title,value,currency,stage:pipeline_stages(id,name,color),contact:contacts(id,first_name,last_name)')
      .eq('org_id', orgId).limit(limit)
    if (stage_id) query = query.eq('stage_id', stage_id)
    if (contact_id) query = query.eq('contact_id', contact_id)
    const { data, error } = await query
    if (error) throw error
    return { content: [{ type: 'text', text: JSON.stringify(data) }] }
  })

  server.tool('get_deal', { id: z.string().uuid() }, async ({ id }) => {
    requireScope('read:deals')
    const { data, error } = await supabase.from('deals')
      .select('*, stage:pipeline_stages(*), contact:contacts(id,first_name,last_name,email), activities(*), notes(id,content)')
      .eq('id', id).eq('org_id', orgId).single()
    if (error) throw error
    return { content: [{ type: 'text', text: JSON.stringify(data) }] }
  })

  server.tool('create_deal', {
    title: z.string().min(1),
    value: z.number().optional(),
    stage_id: z.string().uuid(),
    contact_id: z.string().uuid().optional(),
  }, async (input) => {
    requireScope('write:deals')
    const { data, error } = await supabase.from('deals')
      .insert({ ...input, org_id: orgId }).select('*').single()
    if (error) throw error
    return { content: [{ type: 'text', text: JSON.stringify(data) }] }
  })

  server.tool('move_deal_stage', {
    id: z.string().uuid(),
    stage_id: z.string().uuid(),
  }, async ({ id, stage_id }) => {
    requireScope('write:deals')
    const { data, error } = await supabase.from('deals')
      .update({ stage_id }).eq('id', id).eq('org_id', orgId).select('*').single()
    if (error) throw error
    return { content: [{ type: 'text', text: JSON.stringify(data) }] }
  })

  // ── Activities ────────────────────────────────────────────────────────
  server.tool('list_activities', {
    contact_id: z.string().uuid().optional(),
    deal_id: z.string().uuid().optional(),
    type: z.enum(['call','email','meeting','task']).optional(),
    status: z.enum(['planned','done','cancelled']).optional(),
    limit: z.number().default(20),
  }, async ({ contact_id, deal_id, type, status, limit }) => {
    requireScope('read:activities')
    let query = supabase.from('activities').select('*').eq('org_id', orgId).limit(limit)
    if (contact_id) query = query.eq('contact_id', contact_id)
    if (deal_id) query = query.eq('deal_id', deal_id)
    if (type) query = query.eq('type', type)
    if (status) query = query.eq('status', status)
    const { data, error } = await query
    if (error) throw error
    return { content: [{ type: 'text', text: JSON.stringify(data) }] }
  })

  server.tool('get_pipeline_summary', {}, async () => {
    requireScope('read:deals')
    const { data, error } = await supabase.rpc('get_dashboard_metrics', { p_org_id: orgId })
    if (error) throw error
    return { content: [{ type: 'text', text: JSON.stringify(data) }] }
  })

  return server
}
