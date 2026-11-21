import { BookText, ScanSearch, Sparkles, Swords } from 'lucide-react'
import { ModalShell } from './ModalShell'

export function WhatsNewModal({ open, version, onClose }: { open: boolean; version: string; onClose: () => void }): React.JSX.Element | null {
  return (
    <ModalShell
      open={open}
      title={`What's new in v${version || '1.0.2'}`}
      description="Highlights from the latest Polyhedron release."
      sizeClassName="max-w-2xl"
      panelClassName="flex max-h-[min(720px,90vh)] flex-col"
      headerClassName="items-center"
      iconClassName="mt-0"
      descriptionClassName="mt-0"
      contentClassName="min-h-0 overflow-y-auto px-5 pb-5 pt-4"
      icon={<Sparkles size={21} />}
      onClose={onClose}
    >
      <div className="space-y-2.5">
        <Feature
          icon={<ScanSearch size={17} />}
          title="Quick Search"
          description="Select text anywhere and right-click to find matching EN–RO entries. Exact match, Starts with, Ends with and content ID display are available in the search options."
        />
        <Feature
          icon={<Swords size={17} />}
          title="Game Data"
          description="Add existing Source entries to catalog records, create subfolders, and edit or remove entries from the context menu with a confirmation before deletion."
        />
        <Feature
          icon={<BookText size={17} />}
          title="Term Glossary"
          description="See how often a glossary term occurs in the loaded Source and jump to its matches in Translate with one click."
        />
      </div>
    </ModalShell>
  )
}

function Feature({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }): React.JSX.Element {
  return (
    <section className="flex gap-3 rounded-xl border border-[#2c2e37] bg-[#1b1c21] px-3.5 py-3">
      <span className="mt-0.5 shrink-0 text-[var(--poly-accent)]">{icon}</span>
      <div className="min-w-0">
        <h3 className="text-sm font-medium text-neutral-100">{title}</h3>
        <p className="mt-1 text-xs leading-relaxed text-neutral-400">{description}</p>
      </div>
    </section>
  )
}
