'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Brain, Loader2, Play, ChevronDown, ChevronRight, AlertCircle, Lightbulb, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDistanceToNow } from 'date-fns'
import type { RrtModelInfo, RrtModelCard, RrtRunResult, RrtModelRun } from '@/types/crm'

interface RrtModelRunnerProps {
  /** 'deal' or 'contact' — determines which entity the run is logged against. */
  entityType: 'deal' | 'contact'
  entityId: string
}

/**
 * Suggested RRToolbox models per entity type.
 * These are the models we dogfood internally — the ones most relevant to
 * managing a CRM pipeline. The user can still pick any model from the full
 * catalog via the dropdown.
 */
const SUGGESTED: Record<string, string[]> = {
  deal: [
    'MA_TargetTiming',
    'BasicBusinessDecisionModel',
    'CapitalInvestment',
    'FranchiseExpansion',
    'IlliquidAssetDecision',
  ],
  contact: [
    'InfluencerPartnershipROI',
    'ContentCreatorMonetization',
    'JobSearchWithFiring',
    'HiringWithPolicyRisk',
  ],
}

export function RrtModelRunner({ entityType, entityId }: RrtModelRunnerProps) {
  const [models, setModels] = useState<RrtModelInfo[]>([])
  const [loadingModels, setLoadingModels] = useState(true)
  const [notConfigured, setNotConfigured] = useState(false)
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [card, setCard] = useState<RrtModelCard | null>(null)
  const [loadingCard, setLoadingCard] = useState(false)
  const [showCard, setShowCard] = useState(false)
  const [paramsJson, setParamsJson] = useState('{}')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<RrtRunResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [runs, setRuns] = useState<RrtModelRun[]>([])
  const [loadingRuns, setLoadingRuns] = useState(true)
  const [expandedRun, setExpandedRun] = useState<string | null>(null)

  const loadModels = useCallback(async () => {
    setLoadingModels(true)
    const res = await fetch('/api/rrt/models')
    if (res.status === 400) {
      setNotConfigured(true)
      setModels([])
      setLoadingModels(false)
      return
    }
    const json = await res.json()
    if (res.ok) {
      setModels(json.data ?? [])
      const suggested = SUGGESTED[entityType] ?? []
      const firstSuggested = suggested.find(s => (json.data ?? []).some((m: RrtModelInfo) => m.name === s))
      setSelectedModel(firstSuggested ?? json.data?.[0]?.name ?? '')
    } else {
      setNotConfigured(true)
    }
    setLoadingModels(false)
  }, [entityType])

  const loadRuns = useCallback(async () => {
    setLoadingRuns(true)
    const res = await fetch(`/api/rrt/runs?${entityType}_id=${entityId}&limit=10`)
    const json = await res.json()
    if (res.ok) setRuns(json.data ?? [])
    setLoadingRuns(false)
  }, [entityType, entityId])

  useEffect(() => { loadModels() }, [loadModels])
  useEffect(() => { if (!notConfigured) loadRuns() }, [loadRuns, notConfigured])

  async function loadCard(modelName: string) {
    if (!modelName) return
    setLoadingCard(true)
    setCard(null)
    setShowCard(true)
    const res = await fetch('/api/rrt/card', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model_name: modelName }),
    })
    const json = await res.json()
    if (res.ok) setCard(json.data)
    else setError(json.error?.message ?? 'Failed to load model card')
    setLoadingCard(false)
  }

  async function handleRun() {
    if (!selectedModel) return
    setRunning(true)
    setResult(null)
    setError(null)
    let parsed: Record<string, unknown> = {}
    try {
      parsed = JSON.parse(paramsJson)
    } catch {
      setError('Parameters must be valid JSON')
      setRunning(false)
      return
    }
    const res = await fetch('/api/rrt/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model_name: selectedModel,
        parameters: parsed,
        [`${entityType}_id`]: entityId,
      }),
    })
    const json = await res.json()
    if (res.ok) {
      setResult(json.data)
      toast.success('Model run complete')
      loadRuns()
    } else {
      setError(json.error?.message ?? 'Run failed')
      toast.error(json.error?.message ?? 'Run failed')
    }
    setRunning(false)
  }

  if (notConfigured) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <Brain size={20} className="text-muted-foreground opacity-40" />
        <p className="text-sm text-muted-foreground">
          RR Toolbox is not configured.
        </p>
        <p className="text-xs text-muted-foreground">
          Ask an admin to connect it in <span className="font-medium">Settings → Integrations</span>.
        </p>
      </div>
    )
  }

  if (loadingModels) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
        <Loader2 size={16} className="animate-spin mr-2" /> Loading decision models…
      </div>
    )
  }

  const suggestedSet = new Set(SUGGESTED[entityType] ?? [])
  const suggestedModels = models.filter(m => suggestedSet.has(m.name))
  const otherModels = models.filter(m => !suggestedSet.has(m.name))

  return (
    <div className="space-y-4">
      {/* Model selector + run */}
      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Brain size={15} className="text-primary" />
          <h4 className="text-sm font-medium">Run a decision model</h4>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Model</Label>
          <Select value={selectedModel} onValueChange={v => { setSelectedModel(v ?? ''); setCard(null); setShowCard(false); setResult(null); setError(null) }}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select a model" /></SelectTrigger>
            <SelectContent>
              {suggestedModels.length > 0 && (
                <>
                  <p className="text-xs font-medium text-muted-foreground px-2 py-1">Suggested for {entityType}s</p>
                  {suggestedModels.map(m => <SelectItem key={m.name} value={m.name}>{m.name}</SelectItem>)}
                </>
              )}
              {otherModels.length > 0 && (
                <>
                  <p className="text-xs font-medium text-muted-foreground px-2 py-1">All models</p>
                  {otherModels.map(m => <SelectItem key={m.name} value={m.name}>{m.name}</SelectItem>)}
                </>
              )}
            </SelectContent>
          </Select>
        </div>

        {selectedModel && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => loadCard(selectedModel)}>
              <Lightbulb size={12} className="mr-1" /> Model card
            </Button>
          </div>
        )}

        {showCard && (
          <div className="rounded-md bg-muted/40 p-3 text-xs space-y-2">
            {loadingCard ? (
              <div className="flex items-center text-muted-foreground"><Loader2 size={12} className="animate-spin mr-2" /> Loading card…</div>
            ) : card ? (
              <>
                <p><span className="font-medium">Purpose:</span> {card.purpose}</p>
                <p><span className="font-medium">Example question:</span> {card.example_question}</p>
                {card.common_mistakes?.length > 0 && (
                  <div>
                    <p className="font-medium">Common mistakes:</p>
                    <ul className="list-disc list-inside text-muted-foreground mt-0.5">
                      {card.common_mistakes.slice(0, 3).map((m, i) => <li key={i}>{m}</li>)}
                    </ul>
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-xs">Parameters (JSON)</Label>
          <textarea
            className="w-full text-xs font-mono rounded-md border border-input bg-background px-3 py-2 min-h-20 resize-y"
            value={paramsJson}
            onChange={e => setParamsJson(e.target.value)}
            placeholder='{"discount_rate": 0.1}'
          />
        </div>

        <Button size="sm" onClick={handleRun} disabled={running || !selectedModel}>
          {running ? <Loader2 size={13} className="mr-1 animate-spin" /> : <Play size={13} className="mr-1" />}
          {running ? 'Running…' : 'Run model'}
        </Button>
      </div>

      {/* Current result */}
      {error && (
        <div className="flex items-center gap-2 text-sm rounded-md p-3 border border-destructive/30 bg-destructive/5 text-destructive">
          <AlertCircle size={14} className="shrink-0" />
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Brain size={15} className="text-primary" />
            <h4 className="text-sm font-medium">Recommendation</h4>
            <Badge variant="secondary" className="text-xs ml-auto">{selectedModel}</Badge>
          </div>
          <p className="text-sm">{result.summary}</p>
          {result.recommended_action && (
            <div className="rounded-md bg-background/60 p-3">
              <p className="text-xs font-medium text-primary mb-0.5">Recommended action</p>
              <p className="text-sm">{result.recommended_action}</p>
            </div>
          )}
          {result.key_drivers?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Key drivers</p>
              <div className="flex flex-wrap gap-1">
                {result.key_drivers.map((d, i) => <Badge key={i} variant="secondary" className="text-xs">{d}</Badge>)}
              </div>
            </div>
          )}
          {result.warnings?.length > 0 && (
            <div className="text-xs text-amber-600 dark:text-amber-400 space-y-0.5">
              {result.warnings.map((w, i) => <p key={i}>⚠ {w}</p>)}
            </div>
          )}
          {result.attribution && (
            <p className="text-xs text-muted-foreground border-t border-border pt-2 mt-2">{result.attribution}</p>
          )}
        </div>
      )}

      {/* Past runs */}
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Clock size={12} /> Past runs ({runs.length})
        </h4>
        {loadingRuns ? (
          <div className="flex items-center text-muted-foreground text-xs py-2"><Loader2 size={12} className="animate-spin mr-2" /> Loading…</div>
        ) : runs.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">No models run on this {entityType} yet.</p>
        ) : (
          <div className="space-y-1">
            {runs.map(run => (
              <div key={run.id} className="rounded-md border border-border">
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent/40"
                  onClick={() => setExpandedRun(expandedRun === run.id ? null : run.id)}
                >
                  {expandedRun === run.id ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  <Brain size={13} className="text-muted-foreground" />
                  <span className="font-medium flex-1">{run.model_name}</span>
                  {run.success ? (
                    <Badge variant="secondary" className="text-xs">completed</Badge>
                  ) : (
                    <Badge variant="destructive" className="text-xs">failed</Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(run.created_at), { addSuffix: true })}
                  </span>
                </button>
                {expandedRun === run.id && (
                  <div className="px-3 pb-3 pt-1 space-y-2 text-xs">
                    {run.error_message && <p className="text-destructive">{run.error_message}</p>}
                    {run.summary && <p>{run.summary}</p>}
                    {run.recommended_action && (
                      <p><span className="font-medium text-primary">Action:</span> {run.recommended_action}</p>
                    )}
                    {run.key_drivers && run.key_drivers.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {run.key_drivers.map((d, i) => <Badge key={i} variant="secondary" className="text-xs">{d}</Badge>)}
                      </div>
                    )}
                    {run.attribution && <p className="text-muted-foreground border-t border-border pt-1.5">{run.attribution}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
