'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Brain, CheckCircle, AlertCircle, Loader2, Plug, Save, Search } from 'lucide-react'
import type { RrtModelInfo, RrtConfigStatus } from '@/types/crm'

interface RrtSettingsProps {
  canManage: boolean
}

export function RrtSettings({ canManage }: RrtSettingsProps) {
  const [status, setStatus] = useState<RrtConfigStatus | null>(null)
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [models, setModels] = useState<RrtModelInfo[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadConfig()
  }, [])

  async function loadConfig() {
    const res = await fetch('/api/rrt/config')
    const json = await res.json()
    if (res.ok && json.data) {
      setStatus(json.data)
      if (json.data.base_url) setBaseUrl(json.data.base_url)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!baseUrl.trim() || !apiKey.trim()) return
    setSaving(true)
    setTestResult(null)
    const res = await fetch('/api/rrt/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base_url: baseUrl.trim(), api_key: apiKey.trim() }),
    })
    const json = await res.json()
    if (res.ok) {
      toast.success('RR Toolbox credentials saved')
      setStatus(json.data)
      setApiKey('')
      loadModels()
    } else {
      toast.error(json.error?.message ?? 'Failed to save')
    }
    setSaving(false)
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    const body: Record<string, string> = {}
    if (baseUrl.trim() && apiKey.trim()) {
      body.base_url = baseUrl.trim()
      body.api_key = apiKey.trim()
    }
    const res = await fetch('/api/rrt/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    if (res.ok) {
      setTestResult({ ok: true, message: `Connected — ${json.data.models} models available` })
      toast.success(`RR Toolbox reachable (${json.data.models} models)`)
    } else {
      setTestResult({ ok: false, message: json.error?.message ?? 'Connection failed' })
      toast.error(json.error?.message ?? 'Connection failed')
    }
    setTesting(false)
  }

  async function loadModels() {
    setLoadingModels(true)
    const res = await fetch('/api/rrt/models')
    const json = await res.json()
    if (res.ok) {
      setModels(json.data ?? [])
    } else {
      setModels([])
    }
    setLoadingModels(false)
  }

  useEffect(() => {
    if (status?.configured) loadModels()
  }, [status?.configured])

  const filteredModels = models.filter(m =>
    !search ||
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.description?.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Brain size={18} className="text-primary" />
            <div>
              <CardTitle className="text-base">RR Toolbox — Decision Models</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Connect miniCRM to our own decision-intelligence engine. Run SDP/MDP models on deals and contacts to dogfood our product.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {status?.configured && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle size={14} className="text-primary" />
              Connected to <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{status.base_url}</code>
            </div>
          )}

          {canManage && (
            <form onSubmit={handleSave} className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">RR Toolbox base URL</Label>
                <Input
                  className="h-9 text-sm"
                  placeholder="https://rrtoolbox.your-domain.com"
                  value={baseUrl}
                  onChange={e => setBaseUrl(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">RRT API key</Label>
                <Input
                  className="h-9 text-sm font-mono"
                  type="password"
                  placeholder={status?.has_api_key ? '•••••••• (saved — enter new to replace)' : 'RRT-...'}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  required={!status?.has_api_key}
                />
                <p className="text-xs text-muted-foreground">
                  Your RRT-* key from the RR Toolbox admin. Stored encrypted per-org.
                </p>
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={saving || !baseUrl.trim()}>
                  <Save size={13} className="mr-1" />
                  {saving ? 'Saving…' : 'Save'}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={handleTest} disabled={testing}>
                  {testing ? <Loader2 size={13} className="mr-1 animate-spin" /> : <Plug size={13} className="mr-1" />}
                  Test connection
                </Button>
              </div>
            </form>
          )}

          {testResult && (
            <div className={`flex items-center gap-2 text-sm rounded-md p-3 border ${testResult.ok ? 'border-primary/30 bg-primary/5' : 'border-destructive/30 bg-destructive/5'}`}>
              {testResult.ok
                ? <CheckCircle size={14} className="text-primary shrink-0" />
                : <AlertCircle size={14} className="text-destructive shrink-0" />}
              {testResult.message}
            </div>
          )}
        </CardContent>
      </Card>

      {status?.configured && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Available Models ({models.length})</CardTitle>
              <div className="relative w-48">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-8 text-xs pl-7"
                  placeholder="Search models…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingModels ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground text-sm">
                <Loader2 size={16} className="animate-spin mr-2" /> Loading models…
              </div>
            ) : filteredModels.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {models.length === 0 ? 'No models returned by RR Toolbox.' : 'No models match your search.'}
              </p>
            ) : (
              <div className="space-y-1 max-h-80 overflow-y-auto">
                {filteredModels.map(m => (
                  <div key={m.name} className="flex items-start gap-3 px-3 py-2 rounded-md hover:bg-accent/50">
                    <Brain size={14} className="text-muted-foreground shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{m.name}</span>
                        <Badge variant="secondary" className="text-xs py-0 font-mono">{m.endpoint}</Badge>
                      </div>
                      {m.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{m.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
