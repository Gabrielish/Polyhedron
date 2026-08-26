import type { ElectronAPI } from '@electron-toolkit/preload'

export type UnsubscribeFn = () => void
export type AiProviderId = 'openai' | 'anthropic' | 'gemini' | 'grok'
export type TranslationProvider = AiProviderId | 'deepl' | 'google' | 'manual'

// The four variables every translation prompt must contain. Highlighted in the editor and
// validated before a prompt slot can be saved (shared by main + renderer).
export const REQUIRED_PROMPT_VARS = [
  'SOURCE_TEXT',
  'SOURCE_LANGUAGE',
  'TARGET_TEXT',
  'TARGET_LANGUAGE'
] as const

export function missingPromptVars(template: string): string[] {
  return REQUIRED_PROMPT_VARS.filter((v) => !template.includes(`{${v}}`))
}

// {ALL_CAPS} tokens that are not one of the required variables - almost always a typo
// (e.g. {SOURCE_LAGUAGE}). They would reach the AI as literal text, so they block saving.
// Lowercase/numeric braces ({0}, {1}) are game placeholders and stay untouched.
export function unknownPromptVars(template: string): string[] {
  const required = new Set<string>(REQUIRED_PROMPT_VARS)
  const unknown = new Set<string>()
  for (const match of template.matchAll(/\{([A-Z_]+)\}/g)) {
    if (!required.has(match[1])) unknown.add(match[1])
  }
  return [...unknown]
}

// Sections the system appends to every rendered prompt (reference examples; the mandatory
// response-format block that keeps grouped batch replies parseable). A template containing
// them would duplicate/conflict with the appended blocks, so saving is blocked.
export const RESERVED_PROMPT_HEADINGS = ['## Response format', '## Reference examples'] as const

export function reservedPromptHeadings(template: string): string[] {
  return RESERVED_PROMPT_HEADINGS.filter((heading) => template.includes(heading))
}

export interface AiSimilarityExample {
  src: string
  tgt: string
}

export interface PromptSlot {
  id: number
  name: string
  prompt: string
  isDefault: boolean
  createdAt: string | null
  updatedAt: string | null
}

export interface TranslationStartPayload {
  provider: TranslationProvider
  filePath: string
  modName: string
  sourceLang: string
  targetLang: string
  apiKey?: string
  author?: string
  model?: string
}

export interface TranslationProgressEvent {
  jobId: string
  current: number
  total: number
  source: string
  target: string
}

export interface TranslationDoneEvent {
  jobId: string
  outputPath: string
}

export interface TranslationErrorEvent {
  jobId: string
  message: string
}

export interface TranslationBatchProgressEvent {
  jobId: string
  uid: string
  completed: number
  total: number
  target: string | null
  error?: string
}

export interface TranslationBatchDoneEvent {
  jobId: string
  total: number
  translated: number
  failed: number
  cancelled: boolean
}

export interface TranslationBatchErrorEvent {
  jobId: string
  message: string
}

export interface LogPayload {
  level?: 'error' | 'warn' | 'info'
  scope: string
  message: string
  stack?: string
  meta?: unknown
}

export interface DictionaryEntry {
  id: number
  language1: string
  language2: string
  textLanguage1: string
  textLanguage2: string
  modName: string | null
  uid: string | null
  createdAt: string | null
  updatedAt: string | null
}

export interface UpsertDictionaryPayload {
  language1: string
  language2: string
  textLanguage1: string
  textLanguage2: string
  modName?: string | null
  uid?: string | null
}

export interface SimilarEntry {
  original: string
  translated: string
  score: number
}

export interface Language {
  id: number
  code: string
  name: string
  createdAt: string | null
  updatedAt: string | null
}

export interface ModInfo {
  name: string
  totalStrings: number
  translatedStrings: number
  lastFilePath: string | null
  updatedAt: string | null
}

export interface ModWithPriority extends ModInfo {
  priority: number | null
}

export interface DeleteModResult {
  modName: string
  dictionaryRows: number
  hadMeta: boolean
  folderRemoved: boolean
  folderPath: string
}

export interface DeleteModPreview {
  dictionaryRows: number
  folderPath: string
  folderExists: boolean
}

export interface ModMeta {
  metaFilePath: string
  name: string
  folder: string
  author: string
  description: string
  uuid: string
  versionMajor: number
  versionMinor: number
  versionRevision: number
  versionBuild: number
  version64: string
}

export interface TranslationXmlCandidate {
  id: string
  absolutePath: string
  relativePath: string
  stringCount: number
  sizeKb: number
  valid: boolean
  status: 'valid' | 'invalid'
}

export interface PreparedTranslationInput {
  importId: string
  requiresSelection: boolean
  candidates: TranslationXmlCandidate[]
}

export interface CompleteTranslationImportResult {
  xmlPath: string
  meta: ModMeta
}

export type ConfigKey =
  | 'openai_key'
  | 'deepl_key'
  | 'google_key'
  | 'anthropic_key'
  | 'gemini_key'
  | 'grok_key'
  | 'openai_model'
  | 'anthropic_model'
  | 'gemini_model'
  | 'grok_model'
  | 'ai_provider'
  | 'ai_active_prompt_slot'
  | 'ai_similarity_enabled'
  | 'ai_similarity_count'
  | 'ai_similarity_min_score'
  | 'last_source_lang'
  | 'last_target_lang'
  | 'app_language'
  | 'author'
  | 'dictionary_page_size'
  | 'translation_page_size'
  | 'show_translation_counters'
  | 'divine_path'

export type UserErrorCode =
  | 'common.unknown'
  | 'common.unsupportedFileType'
  | 'common.noPakInArchive'
  | 'common.noXmlForLanguage'
  | 'translation.apiKeyMissing'
  | 'translation.apiKeyRequired'
  | 'translation.aiRateLimited'
  | 'translation.invalidProvider'
  | 'translation.noValidXml'
  | 'translation.invalidFormat'
  | 'translation.fileLoadFailed'
  | 'translation.saveFailed'
  | 'merge.sessionExpired'
  | 'merge.invalidXml'
  | 'merge.modNameRequired'
  | 'merge.languagesMustDiffer'
  | 'dictionary.xlsxNotSupported'
  | 'package.versionFormatInvalid'
  | 'package.languageFolderInvalid'
  | 'package.folderInvalid'

export type XmlMatchType = 'none' | 'mod-text' | 'text' | 'manual'

export interface DictionaryFilters {
  text?: string
  exactMatch?: boolean
  modName?: string
  sourceLang?: string
  targetLang?: string
}

export interface DictionaryListParams {
  filters: DictionaryFilters
  page: number
  pageSize: number
}

export interface DictionaryListResult {
  items: DictionaryEntry[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface DictionaryImportPreviewRow {
  sourceLang: string
  targetLang: string
  sourceText: string
  targetText: string
  modName: string | null
  uid: string | null
}

export interface DictionaryImportPreview {
  headers: string[]
  totalRows: number
  rows: DictionaryImportPreviewRow[]
}

export interface XmlEntry {
  uid: string
  version: string
  source: string
  target: string
  matchType: XmlMatchType
  needsReview: boolean
}

export interface TranslationApi {
  start(payload: TranslationStartPayload): Promise<{ jobId: string }>
  cancel(jobId: string): Promise<void>
  onProgress(cb: (data: TranslationProgressEvent) => void): UnsubscribeFn
  onDone(cb: (data: TranslationDoneEvent) => void): UnsubscribeFn
  onError(cb: (data: TranslationErrorEvent) => void): UnsubscribeFn
  single(payload: {
    provider: 'openai' | 'deepl' | 'google'
    text: string
    sourceLang: string
    targetLang: string
  }): Promise<string>
  batch(payload: {
    entries: { uid: string; source: string }[]
    provider: 'openai' | 'deepl' | 'google'
    sourceLang: string
    targetLang: string
  }): Promise<{ jobId: string }>
  onBatchProgress(cb: (data: TranslationBatchProgressEvent) => void): UnsubscribeFn
  onBatchDone(cb: (data: TranslationBatchDoneEvent) => void): UnsubscribeFn
  onBatchError(cb: (data: TranslationBatchErrorEvent) => void): UnsubscribeFn
}

export type DictionaryImportProgressUpdate =
  | { phase: 'reading' }
  | { phase: 'parsing' }
  | { phase: 'writing'; processed: number; total: number }

export interface DictionaryApi {
  list(params: DictionaryListParams): Promise<DictionaryListResult>
  getAll(params: { lang1: string; lang2: string }): Promise<DictionaryEntry[]>
  search(params: { text: string; lang1: string; lang2: string }): Promise<DictionaryEntry[]>
  create(entry: UpsertDictionaryPayload): Promise<{ success: boolean }>
  update(params: { id: number; entry: UpsertDictionaryPayload }): Promise<{ success: boolean }>
  upsert(entry: UpsertDictionaryPayload): Promise<{ success: boolean }>
  bulkUpsert(entries: UpsertDictionaryPayload[]): Promise<{ count: number }>
  delete(params: { id: number }): Promise<{ success: boolean }>
  previewImport(params: {
    filePath: string
    format: 'csv' | 'xlsx'
  }): Promise<DictionaryImportPreview>
  import(params: { filePath: string; format: 'csv' | 'xlsx' }): Promise<{ count: number }>
  onImportProgress(cb: (data: DictionaryImportProgressUpdate) => void): () => void
  export(params: {
    filters: DictionaryFilters
    format: 'csv' | 'xlsx'
    outputPath: string
  }): Promise<{ success: boolean }>
  similar(params: {
    text: string
    lang1: string
    lang2: string
    limit?: number
  }): Promise<SimilarEntry[]>
  deleteByFilter(filters: DictionaryFilters): Promise<{ deleted: number }>
  replaceByFilter(
    filters: DictionaryFilters,
    patch: { findText: string; replaceText: string; column: 'language1' | 'language2' }
  ): Promise<{ updated: number }>
}

export interface LanguageApi {
  getAll(): Promise<Language[]>
}

export interface ModApi {
  extract(params: {
    inputPath: string
    outputPath: string
    sourceLang?: string
  }): Promise<{ success: boolean; xmlFiles: string[] }>
  pack(params: {
    inputFolder: string
    outputPath: string
  }): Promise<{ success: boolean; pakPath: string }>
  getAll(params?: { lang1?: string; lang2?: string }): Promise<ModInfo[]>
  upsert(params: {
    name: string
    totalStrings?: number
    lastFilePath?: string
  }): Promise<{ success: boolean }>
  storeFile(params: { modName: string; filePath: string }): Promise<{ storedPath: string }>
  prepareTranslationInput(params: { inputPath: string }): Promise<PreparedTranslationInput>
  discardTranslationInput(params: { importId: string }): Promise<{ success: boolean }>
  completeTranslationImport(params: {
    importId: string
    candidateIds: string[]
    modName: string
    targetLang: string
  }): Promise<CompleteTranslationImportResult>
  getMeta(params: { modName: string; targetLang: string }): Promise<ModMeta>
  upsertMeta(params: { modName: string; meta: ModMeta }): Promise<ModMeta>
  exportTranslatedPackage(params: {
    outputPath: string
    format: 'pak' | 'zip'
    modName: string
    entries: XmlEntry[]
    meta: ModMeta
    bg3LanguageFolder: string
  }): Promise<{ outputPath: string }>
  exportLocalizationPak(params: {
    outputPath: string
    entries: XmlEntry[]
  }): Promise<{ outputPath: string }>
  injectLocalizationPak(params: {
    platform: 'windows' | 'macos'
    entries: XmlEntry[]
  }): Promise<{ pakPath: string; backupCreated: boolean }>
  delete(params: { modName: string }): Promise<DeleteModResult>
  previewDelete(params: { modName: string }): Promise<DeleteModPreview>
  setPriority(params: { modName: string; priority: number | null }): Promise<{ success: boolean }>
  reorderPriority(params: { orderedNames: string[] }): Promise<{ success: boolean }>
  listWithPriority(params?: { lang1?: string; lang2?: string }): Promise<ModWithPriority[]>
}

export interface MergeResult {
  matched: number
  sourceOnly: number
  targetOnly: number
}

export type MergeProgress =
  | { phase: 'parsing' }
  | { phase: 'loading-map' }
  | { phase: 'classifying' }
  | { phase: 'writing'; processed: number; total: number }
  | { phase: 'done'; result: MergeResult }
  | { phase: 'error'; message: string }

export interface MergeApi {
  prepareInput(params: { inputPath: string }): Promise<PreparedTranslationInput>
  discardInput(params: { importId: string }): Promise<{ success: boolean }>
  run(params: {
    sourceImportId: string
    sourceCandidateId: string
    sourceLang: string
    targetImportId: string
    targetCandidateId: string
    targetLang: string
    modName: string
  }): Promise<MergeResult>
  onProgress(cb: (data: MergeProgress) => void): UnsubscribeFn
}

export type XmlLoadProgress =
  | { phase: 'unpacking' }
  | { phase: 'parsing' }
  | { phase: 'loading-cache' }
  | { phase: 'matching'; processed: number; total: number }

export interface XmlApi {
  load(params: {
    inputPath: string
    sourceLang: string
    targetLang: string
    modName?: string
  }): Promise<XmlEntry[]>
  export(params: { outputPath: string; entries: XmlEntry[] }): Promise<void>
  onLoadProgress(cb: (data: XmlLoadProgress) => void): UnsubscribeFn
}

export interface ConfigApi {
  get(params: { key: string }): Promise<{ value: string | null }>
  set(params: { key: string; value: string }): Promise<{ success: boolean }>
  getAll(): Promise<Record<string, string>>
}

export interface AiTranslatePayload {
  // Omitted ⇒ the active provider stored in config is used.
  provider?: AiProviderId
  model?: string
  text: string
  sourceLang: string
  targetLang: string
  // The per-line template (may have been edited in the popup); rendered server-side.
  prompt: string
  examples: AiSimilarityExample[]
}

export interface AiBatchPayload {
  provider?: AiProviderId
  entries: { uid: string; source: string }[]
  sourceLang: string
  targetLang: string
}

// Batch progress/done/error reuse the existing translation:batch* events.
export interface AiApi {
  translate(payload: AiTranslatePayload): Promise<string>
  translateBatch(payload: AiBatchPayload): Promise<{ jobId: string }>
}

export interface PromptSlotApi {
  list(): Promise<PromptSlot[]>
  create(params: { name: string; prompt: string }): Promise<PromptSlot>
  update(params: { id: number; name?: string; prompt?: string }): Promise<PromptSlot>
  delete(params: { id: number }): Promise<{ success: boolean }>
}

export interface WindowApi {
  minimize(): Promise<void>
  maximize(): Promise<void>
  close(): Promise<void>
  relaunch(): Promise<void>
  isMaximized(): Promise<boolean>
  onMaximizeChange(cb: (isMaximized: boolean) => void): UnsubscribeFn
}

export interface DialogueApi {
  open(dialogueName: string): Promise<void>
}

export interface FsApi {
  openDialog(params?: { filters?: Electron.FileFilter[]; multiple?: boolean }): Promise<string[]>
  saveDialog(params?: {
    defaultName?: string
    filters?: Electron.FileFilter[]
  }): Promise<string | null>
  openFolder(): Promise<string | null>
  getPathForFile(file: File): string
}

export interface LogApi {
  getPath(): Promise<string>
  open(): Promise<{ success: boolean }>
  clear(): Promise<{ success: boolean }>
  write(payload: LogPayload): Promise<{ success: boolean }>
}

export type MetricsService = 'deepl' | 'google'
export type MetricsRunService = 'deepl' | 'google' | 'openai' | 'manual'

export interface MetricsUsage {
  service: MetricsService
  consumedChars: number
  charLimit: number
  renewalAt: string
  createdAt: string | null
  updatedAt: string | null
}

export interface MetricsRun {
  id: number
  jobId: string | null
  service: MetricsRunService
  modName: string | null
  sourceLang: string
  targetLang: string
  entriesTotal: number
  entriesTranslated: number
  charsConsumed: number
  startedAt: string
  finishedAt: string
}

export interface MetricsDailyBucket {
  date: string
  entries: number
  chars: number
  runs: number
}

export interface MetricsModBucket {
  modName: string | null
  entries: number
  runs: number
}

export interface MetricsApi {
  getUsage(payload: { service: MetricsService }): Promise<MetricsUsage>
  getAllUsage(): Promise<MetricsUsage[]>
  setLimit(payload: { service: MetricsService; charLimit: number }): Promise<MetricsUsage>
  setRenewalAt(payload: { service: MetricsService; renewalAt: string }): Promise<MetricsUsage>
  setConsumed(payload: { service: MetricsService; consumedChars: number }): Promise<MetricsUsage>
  listRuns(payload?: {
    limit?: number
    service?: MetricsRunService
    from?: string
    to?: string
  }): Promise<MetricsRun[]>
  aggregateByDay(payload: {
    from: string
    to: string
    service?: MetricsRunService
  }): Promise<MetricsDailyBucket[]>
  aggregateByMod(payload: {
    from: string
    to: string
    service?: MetricsRunService
  }): Promise<MetricsModBucket[]>
}

export interface AppApi {
  app: {
    getVersion(): Promise<string>
  }
  translation: TranslationApi
  dictionary: DictionaryApi
  language: LanguageApi
  mod: ModApi
  config: ConfigApi
  ai: AiApi
  promptSlot: PromptSlotApi
  fs: FsApi
  log: LogApi
  xml: XmlApi
  merge: MergeApi
  window: WindowApi
  metrics: MetricsApi
  dialogue: DialogueApi
  workspace: WorkspaceApi
  session: SessionApi
  cloud: CloudApi
  update: UpdateApi
}

export type UpdateState =
  | { status: 'checking' }
  | { status: 'available'; version: string }
  | { status: 'not-available'; version: string }
  | { status: 'downloading'; percent: number }
  | { status: 'downloaded'; version: string }
  | { status: 'error'; message: string }

export interface UpdateApi {
  check(): Promise<void>
  download(): Promise<void>
  install(): Promise<void>
  onState(callback: (state: UpdateState) => void): UnsubscribeFn
}

export interface SessionApi {
  save(params: { key: string; entries: Array<{ uid: string; target: string; matchType: XmlMatchType; needsReview: boolean }> }): Promise<{ success: boolean }>
  load(params: { key: string }): Promise<Array<{ uid: string; target: string; matchType: XmlMatchType; needsReview?: boolean }> | null>
}

export interface WorkspaceApi {
  export(params: { outputPath: string }): Promise<{ outputPath: string }>
  import(params: { inputPath: string }): Promise<{ backupPath: string; stats: { translated: number; total: number } }>
}

export interface CloudApi {
  upload(params?: { sessionKey?: string }): Promise<{ fileName: string; modifiedTime?: string; stats: { translated: number; total: number; fingerprint: string } }>
  download(params?: { sessionKey?: string }): Promise<{ fileName: string; restartRequired: boolean; stats: { translated: number; total: number; fingerprint: string } }>
  syncStamp(): Promise<string | null>
}

export interface AppWindow {
  electron: ElectronAPI
  api: AppApi
}
