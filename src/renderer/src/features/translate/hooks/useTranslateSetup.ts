import { useEffect, useState } from 'react'
import type { ModInfo } from '@/types'
import { normalizeSearchText } from '@/utils/search'
import type { TranslationSession } from '../types'
import { DEFAULT_GAME_PROFILE, getGameProfile, type GameProfileId } from '../gameProfiles'

function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).pop() ?? path
}

export function useTranslateSetup(session: TranslationSession) {
  const [sourceLang, setSourceLangLocal] = useState(session.sourceLang)
  const [targetLang, setTargetLangLocal] = useState(session.targetLang)
  const [gameProfile, setGameProfileLocal] = useState<GameProfileId>(
    session.gameProfile ?? DEFAULT_GAME_PROFILE
  )
  const [selectedMod, setSelectedMod] = useState<string | null>(null)
  const [isNewMod, setIsNewMod] = useState(false)
  const [newModName, setNewModName] = useState('')
  const [filePath, setFilePath] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [mods, setMods] = useState<ModInfo[]>([])
  const [savedProjectNames, setSavedProjectNames] = useState<Record<string, string>>({})
  const [savedProjectsLoaded, setSavedProjectsLoaded] = useState(false)
  const [languages, setLanguages] = useState<
    Awaited<ReturnType<typeof window.api.language.getAll>>
  >([])
  const [modSearch, setModSearch] = useState('')
  const [hasUserChosenMode, setHasUserChosenMode] = useState(false)
  const gameProfileInfo = getGameProfile(gameProfile)

  useEffect(() => {
    if (session.gameProfile !== gameProfile) setGameProfileLocal(session.gameProfile)
  }, [gameProfile, session.gameProfile])

  const filteredMods = mods.filter((mod) =>
    normalizeSearchText(mod.name).includes(normalizeSearchText(modSearch))
  )

  const modName = isNewMod ? newModName.trim() : (selectedMod ?? '')
  const step1Done = !!(sourceLang && targetLang && sourceLang !== targetLang)
  const step2Done = !!(isNewMod ? newModName.trim() : selectedMod)
  const step3Done = !!filePath
  const ready = step1Done && step2Done && step3Done

  const srcLang = languages.find((language) => language.code === sourceLang)
  const tgtLang = languages.find((language) => language.code === targetLang)

  useEffect(() => {
    window.api.language.getAll().then(setLanguages)
    window.api.config.getAll().then((config) => {
      setSavedProjectNames({
        bg3: config.last_project_bg3 ?? '',
        dos1: config.last_project_dos1 ?? '',
        dos2: config.last_project_dos2 ?? ''
      })
      setSavedProjectsLoaded(true)
    })
  }, [])

  useEffect(() => {
    if (sourceLang && targetLang) {
      setHasUserChosenMode(false)
      window.api.mod.getAll({ lang1: sourceLang, lang2: targetLang }).then(setMods)
    }
  }, [sourceLang, targetLang])

  useEffect(() => {
    if (hasUserChosenMode || !savedProjectsLoaded) return
    if (mods.length === 0) {
      setIsNewMod(true)
      setSelectedMod(null)
      return
    }
    const rememberedProject = savedProjectNames[gameProfile]
    const rememberedMod = rememberedProject
      ? mods.find((mod) => mod.name === rememberedProject)
      : undefined
    if (rememberedMod) {
      setIsNewMod(false)
      setSelectedMod(rememberedMod.name)
      if (rememberedMod.lastFilePath) {
        setFilePath(rememberedMod.lastFilePath)
        setFileName(fileNameFromPath(rememberedMod.lastFilePath))
      }
      return
    }

    // Projects are shared in the database and do not carry a game profile,
    // so never auto-select the first (often BG3) project for DOS.
    if (gameProfile !== DEFAULT_GAME_PROFILE) {
      setIsNewMod(false)
      setSelectedMod(null)
      return
    }
    setIsNewMod(false)
    if (!selectedMod || !mods.some((mod) => mod.name === selectedMod)) {
      const defaultMod = mods[0] ?? null
      setSelectedMod(defaultMod?.name ?? null)
      if (defaultMod?.lastFilePath) {
        setFilePath(defaultMod.lastFilePath)
        setFileName(fileNameFromPath(defaultMod.lastFilePath))
      }
    }
  }, [gameProfile, hasUserChosenMode, mods, savedProjectNames, savedProjectsLoaded, selectedMod])

  const handleSourceChange = (lang: string) => {
    setSourceLangLocal(lang)
    session.setSourceLang(lang)
    window.api.config.set({ key: 'last_source_lang', value: lang })
  }

  const handleGameProfileChange = (profile: string) => {
    const next = profile as GameProfileId
    setGameProfileLocal(next)
    session.setGameProfile(next)
    void window.api.config.set({ key: 'last_game_profile', value: next })
    // A project belongs to a specific game/profile. Clear the old selection
    // so its radio state and cached file cannot be reused for another game.
    setHasUserChosenMode(false)
    setSelectedMod(null)
    setIsNewMod(false)
    clearFile()
  }

  const handleTargetChange = (lang: string) => {
    setTargetLangLocal(lang)
    session.setTargetLang(lang)
    window.api.config.set({ key: 'last_target_lang', value: lang })
  }

  const handleModSelect = (mod: ModInfo) => {
    setSelectedMod(mod.name)
    setIsNewMod(false)
    setHasUserChosenMode(true)
    setSavedProjectNames((previous) => ({ ...previous, [gameProfile]: mod.name }))
    void window.api.config.set({
      key: `last_project_${gameProfile}` as 'last_project_bg3' | 'last_project_dos1' | 'last_project_dos2',
      value: mod.name
    })
    if (mod.lastFilePath) {
      setFilePath(mod.lastFilePath)
      setFileName(fileNameFromPath(mod.lastFilePath))
    }
  }

  const handleModSearchChange = (query: string) => {
    setModSearch(query)
  }

  const handleBrowse = async () => {
    const paths = await window.api.fs.openDialog({
      filters: [{ name: 'Localization Files', extensions: gameProfileInfo.extensions }]
    })
    if (paths.length > 0) {
      setFilePath(paths[0])
      setFileName(fileNameFromPath(paths[0]))
    }
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    setIsDragging(false)
    const file = event.dataTransfer.files[0]
    if (!file) return
    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!extension || !gameProfileInfo.extensions.includes(extension)) return
    const path = window.api.fs.getPathForFile(file)
    setFilePath(path)
    setFileName(file.name)
  }

  const clearFile = () => {
    setFilePath(null)
    setFileName(null)
  }

  return {
    sourceLang,
    targetLang,
    gameProfile,
    gameProfileInfo,
    selectedMod,
    isNewMod,
    newModName,
    filePath,
    fileName,
    isDragging,
    mods,
    languages,
    modSearch,
    filteredMods,
    modName,
    step1Done,
    step2Done,
    step3Done,
    ready,
    srcLang,
    tgtLang,
    setIsNewMod: (value: boolean) => {
      setHasUserChosenMode(true)
      setIsNewMod(value)
    },
    setNewModName,
    setIsDragging,
    handleSourceChange,
    handleTargetChange,
    handleGameProfileChange,
    handleModSelect,
    handleModSearchChange,
    handleBrowse,
    handleDrop,
    clearFile
  }
}
