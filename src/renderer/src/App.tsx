import { HashRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { MainLayout } from './components/layout/MainLayout'
import { TranslationSessionProvider } from './context/TranslationSession'
import { ThemeProvider } from './context/ThemeContext'
import { DialogueNodesPage } from './pages/DialogueNodesPage'
import { GameInterfacePage } from './pages/GameInterfacePage'
import { InjectLocalizationPage } from './pages/InjectLocalizationPage'
import { WorkspacePage } from './pages/WorkspacePage'
import { DictionaryPage } from './pages/DictionaryPage'
import { EntryEditPage } from './pages/EntryEditPage'
import { ExtractPage } from './pages/ExtractPage'
import { ManageModsPage } from './pages/ManageModsPage'
import { MergeToolPage } from './pages/MergeToolPage'
import { MetricsPage } from './pages/MetricsPage'
import { PackagePage } from './pages/PackagePage'
import { ReferencePage } from './pages/ReferencePage'
import { SettingsPage } from './pages/SettingsPage'
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
          <Route path="/workspace/import" element={<WorkspacePage mode="import" />} />
          <Route path="/workspace/export" element={<WorkspacePage mode="export" />} />
          <Route path="/inject" element={<InjectLocalizationPage />} />
          <Route path="/mods" element={<ManageModsPage />} />
          <Route path="/extract" element={<ExtractPage />} />
          <Route path="/package" element={<PackagePage />} />
          <Route path="/merge" element={<MergeToolPage />} />
          <Route path="/metrics" element={<MetricsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

export default App
