import { HashRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { MainLayout } from './components/layout/MainLayout'
import { TranslationSessionProvider } from './context/TranslationSession'
import { ThemeProvider } from './context/ThemeContext'
import { DialogueNodesPage } from './pages/DialogueNodesPage'
import { GameInterfacePage } from './pages/GameInterfacePage'
import { WorkspacePage } from './pages/WorkspacePage'
import { DictionaryPage } from './pages/DictionaryPage'
import { EntryEditPage } from './pages/EntryEditPage'
import { ReferencePage } from './pages/ReferencePage'
import { SettingsPage } from './pages/SettingsPage'
import { ModsPage } from './pages/ModsPage'
import { TranslatePage } from './pages/TranslatePage'
import { UpdateNotifier } from './components/layout/UpdateNotifier'

function App(): React.JSX.Element {
  return (
    <HashRouter>
      <Toaster position="bottom-right" theme="dark" richColors />
      <UpdateNotifier />
      <Routes>
        <Route
          element={
            <ThemeProvider>
              <TranslationSessionProvider>
                <MainLayout />
              </TranslationSessionProvider>
            </ThemeProvider>
          }
        >
          <Route index element={<Navigate to="/translate" replace />} />
          <Route element={<Outlet />}>
            <Route path="/translate" element={<TranslatePage />} />
            <Route path="/translate/entry/:uid" element={<EntryEditPage />} />
          </Route>
          <Route path="/dictionary" element={<DictionaryPage />} />
          <Route path="/dialogues" element={<DialogueNodesPage />} />
          <Route path="/game-data" element={<ReferencePage />} />
          <Route path="/game-interface" element={<GameInterfacePage />} />
          <Route path="/workspace" element={<WorkspacePage />} />
          <Route path="/workspace/import" element={<Navigate to="/workspace" replace />} />
          <Route path="/workspace/export" element={<Navigate to="/workspace" replace />} />
          <Route path="/inject" element={<Navigate to="/workspace" replace />} />
          <Route path="/mods" element={<ModsPage />} />
          <Route path="/extract" element={<Navigate to="/mods" replace />} />
          <Route path="/package" element={<Navigate to="/mods" replace />} />
          <Route path="/merge" element={<Navigate to="/mods" replace />} />
          <Route path="/metrics" element={<Navigate to="/settings" replace />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

export default App
