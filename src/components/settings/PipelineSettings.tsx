'use client'

import { useState } from 'react'
import { Plus, Trash2, GripVertical, Check } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import type { PipelineStage } from '@/types/crm'

// SI brand ramp first (coral, sky, navy), then success/destructive and extra choices.
const PRESET_COLORS = ['#ee6b4d', '#9ac0d4', '#3d5c7f', '#10b981', '#ef4444', '#3b82f6', '#ec4899', '#14b8a6']

export function PipelineSettings({ initialStages }: { initialStages: PipelineStage[] }) {
  const [stages, setStages] = useState(initialStages)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#6366f1')
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setAdding(true)
    const res = await fetch('/api/pipeline-stages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, color: newColor, position: stages.length }),
    })
    if (res.ok) {
      const json = await res.json()
      setStages(prev => [...prev, json.data])
      setNewName('')
      toast.success('Stage added')
    } else {
      toast.error('Failed to add stage')
    }
    setAdding(false)
  }

  async function handleUpdate(id: string, updates: Partial<PipelineStage>) {
    setSaving(id)
    const res = await fetch(`/api/pipeline-stages/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (res.ok) {
      const json = await res.json()
      setStages(prev => prev.map(s => s.id === id ? json.data : s))
      toast.success('Stage updated')
    } else {
      toast.error('Failed to update stage')
    }
    setSaving(null)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this stage? Deals in this stage will need to be moved manually.')) return
    const res = await fetch(`/api/pipeline-stages/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setStages(prev => prev.filter(s => s.id !== id))
      toast.success('Stage deleted')
    } else {
      toast.error('Failed to delete stage')
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
        {stages.length === 0 && (
          <div className="px-4 py-8 text-center text-muted-foreground text-sm">No stages yet</div>
        )}
        {stages.map((stage, index) => (
          <StageRow
            key={stage.id}
            stage={stage}
            index={index}
            saving={saving === stage.id}
            onUpdate={updates => handleUpdate(stage.id, updates)}
            onDelete={() => handleDelete(stage.id)}
          />
        ))}
      </div>

      {/* Add stage */}
      <div className="rounded-lg border border-border p-4 space-y-4">
        <h3 className="text-sm font-medium">Add Stage</h3>
        <form onSubmit={handleAdd} className="flex items-end gap-3 flex-wrap">
          <div className="space-y-1 flex-1 min-w-40">
            <Label className="text-xs">Name</Label>
            <Input className="h-8 text-sm" placeholder="e.g. Negotiation" value={newName} onChange={e => setNewName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Color</Label>
            <div className="flex gap-1.5">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewColor(c)}
                  className="w-6 h-6 rounded-full transition-transform hover:scale-110 flex items-center justify-center"
                  style={{ background: c }}
                >
                  {newColor === c && <Check size={12} className="text-white" />}
                </button>
              ))}
            </div>
          </div>
          <Button type="submit" size="sm" disabled={adding || !newName.trim()}>
            <Plus size={13} className="mr-1" />{adding ? 'Adding…' : 'Add Stage'}
          </Button>
        </form>
      </div>
    </div>
  )
}

function StageRow({ stage, index, saving, onUpdate, onDelete }: {
  stage: PipelineStage
  index: number
  saving: boolean
  onUpdate: (u: Partial<PipelineStage>) => void
  onDelete: () => void
}) {
  const [name, setName] = useState(stage.name)
  const [color, setColor] = useState(stage.color)
  const [dirty, setDirty] = useState(false)

  function markDirty<T>(setter: (v: T) => void) {
    return (v: T) => { setter(v); setDirty(true) }
  }

  function handleSave() {
    onUpdate({ name, color })
    setDirty(false)
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <GripVertical size={14} className="text-muted-foreground shrink-0" />
      <span className="text-xs text-muted-foreground w-5 shrink-0">{index + 1}</span>

      {/* Color picker */}
      <div className="relative shrink-0">
        <div className="w-6 h-6 rounded-full cursor-pointer" style={{ background: color }} />
        <input
          type="color"
          value={color}
          onChange={e => markDirty(setColor)(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer w-6 h-6"
          title="Pick color"
        />
      </div>

      <Input
        className="h-7 text-sm flex-1"
        value={name}
        onChange={e => markDirty(setName)(e.target.value)}
      />

      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-1.5">
          <Switch
            checked={stage.is_won}
            onCheckedChange={v => onUpdate({ is_won: v, ...(v ? { is_lost: false } : {}) })}
            className="scale-75"
          />
          <span className="text-xs text-muted-foreground">Won</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Switch
            checked={stage.is_lost}
            onCheckedChange={v => onUpdate({ is_lost: v, ...(v ? { is_won: false } : {}) })}
            className="scale-75"
          />
          <span className="text-xs text-muted-foreground">Lost</span>
        </div>
      </div>

      {stage.is_won && <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-xs shrink-0">Won</Badge>}
      {stage.is_lost && <Badge className="bg-destructive/20 text-destructive border-0 text-xs shrink-0">Lost</Badge>}

      {dirty && (
        <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={handleSave} disabled={saving}>
          {saving ? '…' : 'Save'}
        </Button>
      )}

      <Button
        size="sm"
        variant="ghost"
        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
        onClick={onDelete}
      >
        <Trash2 size={13} />
      </Button>
    </div>
  )
}
