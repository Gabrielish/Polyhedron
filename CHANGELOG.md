# Changelog

## 2.2.5

### Added

- Added gender variants for translations: Default, Female and Neutral, including export support.
- Added Dialogue Nodes browsing by act and region, with translation editing and online node access.
- Added Game Data categories for weapons, armour, objects, spells, passives, statuses and interrupts.
- Added Game Data search, translation fields, online wiki links and Reveal-in-Translate by ContentUID.
- Added Larian tag rendering in Translate and Game Data source/translation fields.
- Added Copy, Paste, Undo and Needs Review controls with synchronized translation state.
- Added search highlighting with theme-colored underlines and safe handling of Larian tags/placeholders.
- Added developer-note filtering for internal `%` and `|...|` strings.
- Added configurable interface options, including rows per page, progress checkpoint and hidden Game Interface tab.
- Added automatic cloud sync status refresh and improved Google Drive workspace synchronization.
- Added macOS localization injection with the bundled Divine runtime workflow.
- Added Polyhedron branding and updated publisher metadata to Gabrielish.

### Fixed

- Fixed Game Data category switching and internal list scrolling.
- Fixed UID Reveal navigation so Translate waits for the page and searches the requested ContentUID.
- Fixed Larian tags being lost or displayed as plain text in Game Data descriptions.
- Fixed mobile/PWA editing, search performance and iOS input zoom behavior.
- Fixed native dialog branding and Windows/macOS injection availability states.
