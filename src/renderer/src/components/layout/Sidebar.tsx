import {
  Swords,
  WandSparkles,
  FolderKanban,
  FolderSync,
  GitBranch,
  Languages,
  LibraryBig,
  ListChecks,
  Settings
} from 'lucide-react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { startTransition, useEffect, useState } from 'react'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import { cn } from '@/lib/utils'
import { useTranslationSession } from '@/context/TranslationSession'

type NavItemConfig = { to: string; icon: React.ElementType; labelKey: string }
type NavGroupConfig = { label: string; icon: React.ElementType; items: NavItemConfig[] }

const NAV_GROUPS: NavGroupConfig[] = [
  {
    label: 'Localization',
    icon: FolderKanban,
    items: [
      { to: '/translate', icon: Languages, labelKey: 'translate' },
      { to: '/consistency', icon: ListChecks, labelKey: 'consistency' }
    ]
  },
  {
    label: 'Game Reference',
    icon: LibraryBig,
    items: [
      { to: '/dialogues', icon: GitBranch, labelKey: 'dialogues' },
      { to: '/game-data', icon: Swords, labelKey: 'gameData' },
      { to: '/spells', icon: WandSparkles, labelKey: 'spells' }
    ]
  },
  {
    label: 'Workspace',
    icon: FolderSync,
    items: [{ to: '/workspace', icon: FolderSync, labelKey: 'workspace' }]
  }
]

const FOOTER_ITEMS: NavItemConfig[] = [{ to: '/settings', icon: Settings, labelKey: 'settings' }]

const BG3_REFERENCE_PATHS = new Set(['/dialogues', '/game-data', '/spells'])

function NavItem({ to, icon: Icon, label }: NavItemConfig & { label: string }): React.JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const [tooltipVisible, setTooltipVisible] = useState(false)
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 })

  useEffect(() => {
    setTooltipVisible(false)
  }, [location.key])

  useEffect(() => {
    const hideTooltip = () => setTooltipVisible(false)
    window.addEventListener('polyhedron:navigation-start', hideTooltip)
    window.addEventListener('blur', hideTooltip)
    return () => {
      window.removeEventListener('polyhedron:navigation-start', hideTooltip)
      window.removeEventListener('blur', hideTooltip)
    }
  }, [])

  const showTooltip = (
    event: React.MouseEvent<HTMLAnchorElement> | React.FocusEvent<HTMLAnchorElement>
  ) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setTooltipPosition({ top: rect.top - 8, left: rect.left + rect.width / 2 })
    setTooltipVisible(true)
  }

  const navigateToItem = (event: React.MouseEvent<HTMLAnchorElement>) => {
    setTooltipVisible(false)
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return
    }

    event.preventDefault()
    window.dispatchEvent(
      new CustomEvent('polyhedron:navigation-start', { detail: { pathname: to } })
    )
    startTransition(() => {
      navigate(to)
    })
  }

  return (
    <NavLink
      to={to}
      onClick={navigateToItem}
      onMouseEnter={showTooltip}
      onMouseLeave={() => setTooltipVisible(false)}
      onFocus={(event) => {
        if (event.currentTarget.matches(':focus-visible')) showTooltip(event)
      }}
      onBlur={() => setTooltipVisible(false)}
      className={({ isActive }) =>
        cn(
          'flex h-9 w-full cursor-pointer select-none items-center gap-3 rounded-md px-2 transition-colors',
          isActive
            ? 'bg-amber-500/14 text-amber-500'
            : 'text-neutral-400 hover:bg-[#1c1f24] hover:text-neutral-200'
        )
      }
    >
      <span className="flex w-8 shrink-0 items-center justify-center">
        <Icon size={17} />
      </span>
      <span className="flex-1 whitespace-nowrap text-xs font-medium opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100">
        {label}
      </span>
      {tooltipVisible &&
        createPortal(
          <span
            role="tooltip"
            className="pointer-events-none fixed z-[5000] -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-neutral-700 bg-[#131518] px-2 py-1.5 text-[10px] font-medium leading-tight text-neutral-200 opacity-100 shadow-2xl"
            style={{ top: tooltipPosition.top, left: tooltipPosition.left }}
          >
            {label}
          </span>,
          document.body
        )}
    </NavLink>
  )
}

function NavCapsule({
  group,
  translate
}: {
  group: NavGroupConfig
  translate: (key: string) => string
}): React.JSX.Element {
  const GroupIcon = group.icon
  return (
    <section className="mb-2 rounded-xl border border-[#1f2329] bg-[#131518]/70 px-2 py-2">
      <div className="flex h-8 items-center gap-3 px-2 text-neutral-600">
        <span className="flex w-8 shrink-0 items-center justify-center">
          <GroupIcon size={17} />
        </span>
        <span className="whitespace-nowrap text-[9px] font-semibold uppercase tracking-[0.12em] opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100">
          {group.label}
        </span>
      </div>
      {group.items.map((item) => (
        <NavItem key={item.to} {...item} label={translate(item.labelKey)} />
      ))}
    </section>
  )
}

export function Sidebar(): React.JSX.Element {
  const { t } = useAppTranslation('sidebar')
  const { gameProfile, phase, modName } = useTranslationSession()
  const hasActiveProject = phase === 'loaded' && modName.trim().length > 0
  // Reference tools are meaningful only while a translation project is open.
  // Keep them out of the navigation on the setup screen, where no project has
  // been entered yet.
  const showBg3Reference = gameProfile === 'bg3' && hasActiveProject
  return (
    <aside className="sidebar-shell group/sidebar fixed top-0 left-0 z-40 flex h-screen w-16 flex-col overflow-hidden border-r border-[#1f2329] bg-[#0f1114] transition-[width] duration-200 hover:w-72">
      <nav className="sidebar-nav flex-1 overflow-y-auto px-2 py-3">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter(
            (item) =>
              (item.to !== '/consistency' || hasActiveProject) &&
              (showBg3Reference || !BG3_REFERENCE_PATHS.has(item.to))
          )
          return items.length > 0 ? (
            <NavCapsule key={group.label} group={{ ...group, items }} translate={t} />
          ) : null
        })}
      </nav>
      <div className="sidebar-footer border-t border-[#1f2329] px-2 py-3">
        <NavItem {...FOOTER_ITEMS[0]} label={t(FOOTER_ITEMS[0].labelKey)} />
      </div>
    </aside>
  )
}
