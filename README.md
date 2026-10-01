# Polyhedron

Polyhedron is a desktop translation workspace for **Baldur's Gate 3** localization projects. It helps translators import, edit, search, review, organize, and export large XML localization files while preserving the tags and identifiers required by the game.

The application is built with Electron, React, TypeScript, and SQLite. It runs on Windows and macOS, with an optional browser/PWA version for lightweight translation work.

## What it helps with

- Translate thousands of BG3 strings in a focused editor.
- Keep translations connected to their unique `contentuid` values.
- Find a string by English text, Romanian text, full content UID, or the short ID shown by BG3 mods.
- Work with the same translation session across the desktop app, cloud storage, and the PWA.
- Export translated content for use in a BG3 mod.
- Keep local sessions, reusable database translations, glossary terms, and review metadata separate.

## Main features

### Translation workspace

- Virtualized translation lists designed for large files.
- Source and target editing with a compact desktop layout and responsive mobile layout.
- Search with debouncing, exact-match mode, UID/short-ID search, and status filters.
- Optional Content ID display and ID-based search when IDs are enabled in the current tab.
- Filters for All, Untranslated, Translated, XML tags, and review status.
- Review statuses for `Untranslated`, `Not verified`, `Needs review`, and `Verified`.
- Speaker filtering with searchable speaker names and speaker labels on matching entries.
- Configurable ordering, including default, most repeated first, and least repeated first.
- Developer-note filtering for internal strings such as `%%%` notes and pipe-delimited technical notes.
- Per-entry `Needs review` flag for translations that may need another pass.
- Gender variants for `Default`, `Female`, and `Neutral` strings.
- Preserves XML tags such as `LSTag`, placeholders, line breaks, and other localization markup.
- Optional AI translation actions and batch translation support.
- `Ask Gemini` suggestions with one to three faithful Romanian variants, similarity examples, editable prompts, copy actions, and manual `Use this` selection.
- Progress statistics and translation milestones.
- Keyboard shortcuts, including `Ctrl+F` for search and `Ctrl+S` for saving.

### Glossary

- A separate reusable glossary/dictionary database.
- Entries are keyed by unique content IDs rather than only by visible text.
- Exact-match glossary search.
- CSV import and export.
- Search by term, translation, mod, or UID.
- The glossary does not silently overwrite translations in the Translate workspace.
- The Database tab can be hidden from navigation while its reusable translation data remains available to Translate and import/matching pipelines.

### Dialogue Nodes

- Browse dialogue content organized by game act and category.
- Search dialogue node names and source lines.
- Filter dialogue entries by speaker and search the complete speaker list.
- View related dialogue entries together.
- Navigate directly from a translation entry to its dialogue node.
- Includes source, translation, gender variants, and save support.
- Shows cached node metadata such as speakers, categories, and node relationships when available.

### BG3 references and game data

- Reference indexes for BG3 objects, weapons, armor, spells, statuses, characters, and other game data.
- Dialogue and game-reference filters that help identify context while translating.
- Online reference links where additional game context is useful.

### Import, export, and packaging

- Import existing localization XML files.
- Save and restore translation sessions locally.
- Export translated XML.
- Convert localization XML to `.loca` through the bundled LSLib/ConverterApp tools.
- Build a BG3 `.pak` package from the configured localization folder structure.
- Supports gender localization files when they are present in the package.

### Cloud sync

- Upload and download the workspace through Google Drive.
- Shows `Synced` or `Not synced` status.
- Displays translation statistics and upload/download progress during cloud operations.
- Shows the connected Google account, last upload, and last download in Settings.
- Supports automatic sync intervals, including 10 minutes, 30 minutes, 1 hour, and 2 hours.
- Detects remote Drive changes and pauses automatic sync when a newer remote workspace is detected.
- Keeps translation metadata, review flags, and gender variants in sync.
- Uses Google OAuth authentication; credentials are kept outside the source code.

### Themes and responsive UI

- Liquid Glass is the primary interface theme.
- Additional dark themes are available in Settings.
- Responsive layouts for desktop, narrow windows, and mobile/PWA use.
- Mobile navigation with compact previous/next controls and Liquid Glass styling.
- Compact dropdowns with searchable speakers, status controls, and inline clear actions.

## Data and safety

Local application data is stored in the Electron user-data directory, including the SQLite database and saved sessions. The application does not require the source project to be inside the repository.

Before moving to another computer, copy or export the workspace and keep a backup of the local application data. Never commit Google Drive credentials, API keys, personal tokens, or translation databases to GitHub.

## Development

Requirements:

- Node.js
- pnpm

Install dependencies:

```bash
pnpm install
```

Run the desktop application in development mode:

```bash
pnpm dev
```

Run checks:

```bash
pnpm typecheck
pnpm lint
```

Build installers:

```bash
pnpm build:win
pnpm build:mac
pnpm build:linux
```

The Windows build generates an NSIS installer and a portable build. Update metadata such as `latest.yml` is generated by electron-builder and must be uploaded with the corresponding release artifacts when publishing GitHub releases.

Windows installers can be built from macOS with Wine installed, although a Windows GitHub Actions runner is recommended for repeatable release builds and code signing.

Build the optional PWA:

```bash
pnpm pwa:build
```

## Repository

[github.com/Gabrielish/Polyhedron](https://github.com/Gabrielish/Polyhedron)

## License

See the repository for the current license and project notices.
