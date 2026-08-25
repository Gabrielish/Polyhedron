import { useEffect } from 'react'
import { toast } from 'sonner'

export function UpdateNotifier(): null {
  const isMacOS = navigator.platform.toLowerCase().includes('mac')

  useEffect(() => {
    return window.api.update.onState((state) => {
      if (state.status === 'available') {
        toast(`New version ${state.version} is available`, {
          description: isMacOS ? 'Open the GitHub release to download the new version.' : 'Download the update now?',
          duration: 12000,
          action: { label: isMacOS ? 'Download' : 'Update', onClick: () => void window.api.update.download() }
        })
      } else if (state.status === 'downloading') {
        toast.loading(`Downloading update… ${Math.round(state.percent)}%`, { id: 'app-update' })
      } else if (state.status === 'downloaded') {
        toast.success(`Version ${state.version} is ready`, {
          id: 'app-update',
          description: 'Restart Polyhedron to finish the update.',
          duration: Infinity,
          action: { label: 'Restart', onClick: () => void window.api.update.install() }
        })
      } else if (state.status === 'error') {
        toast.error('Update failed', { id: 'app-update', description: state.message })
      }
    })
  }, [isMacOS])

  return null
}
