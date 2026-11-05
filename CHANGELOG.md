# Changelog

## [1.0.1] - 2026-11-05

### Added

- Expanded Game Data with structured references for quests, books, items, characters, locations, and character creation.
- Added translation lookup, status summaries, and a persistent title-translation display option across Game Data.
- Added dialogue-node status summaries, app-wide undo and redo, and additional translation filters and copy formats.
- Added quote-style checks, workspace sync confirmations, and updated Gemini model defaults with saved-setting migration.

### Improved

- Reorganized Game Data into a side-by-side translation layout with clearer category, hierarchy, and item groupings.
- Improved navigation controls, floating bar animations, scrolling behavior, and toolbar consistency.
- Refined translation controls, status indicators, and spell category headings.

### Fixed

- Fixed missing Game Data matches caused by trailing whitespace or longer localization strings, and hid descriptions without a matching localized entry.
- Fixed duplicate text in spell description editors and missing generated indexes during development startup.
- Fixed floating navigation bar visibility and spacing behavior, plus window maximization triggered by double-clicking title-bar controls.
