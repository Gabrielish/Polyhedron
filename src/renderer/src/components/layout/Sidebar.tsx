import {
  BookOpen,
  Swords,
  FolderKanban,
  FolderSync,
  GitBranch,
  Languages,
  MonitorCog,
  LibraryBig,
  Settings,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import { cn } from '@/lib/utils'
import { useConfig } from '@/hooks/useConfig'

type NavItemConfig = { to: string; icon: React.ElementType; labelKey: string; kbd: string }
type NavGroupConfig = { label: string; icon: React.ElementType; items: NavItemConfig[] }

const NAV_GROUPS: NavGroupConfig[] = [
  {
    label: 'Localization',
    icon: FolderKanban,
    items: [
      { to: '/translate', icon: Languages, labelKey: 'translate', kbd: 'Ctrl 1' },
      { to: '/dictionary', icon: BookOpen, labelKey: 'dictionary', kbd: 'Ctrl 2' }
    ]
  },
  {
    label: 'Game Reference',
    icon: LibraryBig,
    items: [
      { to: '/dialogues', icon: GitBranch, labelKey: 'dialogues', kbd: 'Ctrl 3' },
      { to: '/game-data', icon: Swords, labelKey: 'gameData', kbd: 'Ctrl 4' },
      { to: '/game-interface', icon: MonitorCog, labelKey: 'gameInterface', kbd: 'Ctrl 5' }
    ]
  },
  {
    label: 'Workspace',
    icon: FolderSync,
    items: [
      { to: '/workspace', icon: FolderSync, labelKey: 'workspace', kbd: '' }
    ]
  }
]

const FOOTER_ITEMS: NavItemConfig[] = [{ to: '/settings', icon: Settings, labelKey: 'settings', kbd: '' }]

function NavItem({ to, icon: Icon, label, kbd }: NavItemConfig & { label: string }): React.JSX.Element {
  return (
    <NavLink
      to={to}
      title={label}
      className={({ isActive }) =>
        cn(
          'flex h-9 w-full cursor-pointer select-none items-center gap-3 rounded-md px-2 transition-colors',
          isActive
            ? 'bg-amber-500/14 text-amber-500'
            : 'text-neutral-400 hover:bg-[#1c1f24] hover:text-neutral-200'
        )
      }
    >
      <span className="flex w-8 shrink-0 items-center justify-center"><Icon size={17} /></span>
      <span className="flex-1 whitespace-nowrap text-xs font-medium opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100">{label}</span>
      <span className="shortcut-hint whitespace-nowrap font-mono text-[9px] text-neutral-600 opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100">{kbd}</span>
    </NavLink>
  )
}

function NavCapsule({ group, translate }: { group: NavGroupConfig; translate: (key: string) => string }): React.JSX.Element {
  const GroupIcon = group.icon
  return (
    <section className="mb-2 rounded-xl border border-[#1f2329] bg-[#131518]/70 px-2 py-2">
      <div className="flex h-8 items-center gap-3 px-2 text-neutral-600">
        <span className="flex w-8 shrink-0 items-center justify-center"><GroupIcon size={17} /></span>
        <span className="whitespace-nowrap text-[9px] font-semibold uppercase tracking-[0.12em] opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100">{group.label}</span>
      </div>
      {group.items.map((item) => <NavItem key={item.to} {...item} label={translate(item.labelKey)} />)}
    </section>
  )
}

export function Sidebar(): React.JSX.Element {
  const { t } = useAppTranslation('sidebar')
  const { config } = useConfig()
  const showGameInterface = config['show_game_interface'] === 'true'
  return (
    <aside className="sidebar-shell group/sidebar fixed top-0 left-0 z-40 flex h-screen w-16 flex-col overflow-hidden border-r border-[#1f2329] bg-[#0f1114] transition-[width] duration-200 hover:w-72">
      <nav className="sidebar-nav flex-1 overflow-y-auto px-2 py-3">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((item) => item.to !== '/game-interface' || showGameInterface)
          return items.length > 0 ? <NavCapsule key={group.label} group={{ ...group, items }} translate={t} /> : null
        })}
      </nav>
      <div className="sidebar-footer border-t border-[#1f2329] px-2 py-3"><NavItem {...FOOTER_ITEMS[0]} label={t(FOOTER_ITEMS[0].labelKey)} /></div>
    </aside>
  )
}
