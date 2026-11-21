import { useEffect, useState } from 'react'
import { FolderPlus } from 'lucide-react'
import { ModalShell } from '@/components/shared/ModalShell'

export function GameDataFolderModal({ open, parentPath, onClose, onSubmit }: {
  open: boolean
  parentPath: string
  onClose: () => void
  onSubmit: (name: string) => void
}): React.JSX.Element | null {
  const [name, setName] = useState('')
  useEffect(() => { if (open) setName('') }, [open, parentPath])
  if (!open) return null
  return <ModalShell open title="Add subfolder" description={`Create a folder inside ${parentPath.replaceAll(' / ', ' › ')}.`} sizeClassName="max-w-md" icon={<FolderPlus size={16} />} onClose={onClose} contentClassName="px-5 pb-5 pt-4">
    <div className="flex flex-col gap-3">
      <input autoFocus aria-label="Folder name" placeholder="Folder name..." value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && name.trim()) onSubmit(name.trim()) }} className="w-full rounded-md border border-[#2a2f37] bg-[#0c0d0f] px-3 py-2 text-sm text-neutral-200 outline-none focus:border-[var(--poly-accent)]" />
      <div className="flex justify-end">
        <button type="button" disabled={!name.trim()} onClick={() => onSubmit(name.trim())} className="accent-solid-control inline-flex items-center gap-2 rounded-md border border-[var(--poly-accent)] bg-[var(--poly-accent)] px-3 py-2 text-xs font-semibold disabled:opacity-40"><FolderPlus size={14} />Add folder</button>
      </div>
    </div>
  </ModalShell>
}
