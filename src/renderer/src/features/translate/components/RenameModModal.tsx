import { Pencil, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ModalShell } from '@/components/shared/ModalShell'
import type { ModInfo } from '@/types'

interface RenameModModalProps {
  mod: ModInfo | null
  onClose: () => void
  onRename: (mod: ModInfo, nextName: string) => Promise<void>
}

export function RenameModModal({
  mod,
  onClose,
  onRename
}: RenameModModalProps): React.JSX.Element | null {
  const [name, setName] = useState(mod?.name ?? '')
  const [focused, setFocused] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setName(mod?.name ?? '')
    setError(null)
    setFocused(false)
  }, [mod])

  if (!mod) return null

  const submit = async () => {
    const nextName = name.trim()
    if (!nextName) {
      setError('Project name cannot be empty.')
      return
    }
    if (nextName === mod.name) {
      onClose()
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onRename(mod, nextName)
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to rename project.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ModalShell
      open
      title="Edit project"
      description="Change the name used for this translation project."
      icon={<Pencil size={16} />}
      sizeClassName="max-w-md"
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={() => void submit()}
          disabled={submitting}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-amber-500 px-3 text-xs font-semibold text-black transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save size={13} aria-hidden="true" />
          Save
        </button>
      }
    >
      <label className="block text-xs font-medium text-neutral-400" htmlFor="rename-project-input">
        Project name
      </label>
      <input
        id="rename-project-input"
        autoFocus
        value={name}
        onChange={(event) => setName(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') void submit()
        }}
        className="mt-2 h-10 w-full rounded-md border bg-[#0f1114] px-3 text-sm text-neutral-200 outline-none transition"
        style={{ borderColor: focused ? 'var(--poly-accent)' : '#1f2329' }}
      />
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </ModalShell>
  )
}
