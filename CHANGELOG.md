# Changelog

## [1.0.1] - 2026-11-05

### Added

- Added Quests, Books, Items, and NPCs to Game Data, with grouped quest/subquest trees, item categories and rarities, NPC groups, wiki links, and translation status rings.
- Added persistent display of Romanian item titles and hid NPC descriptions when they are not present in the loaded localization XML.
- Added node totals and translation status rings to Dialogue Nodes groups, with groups ordered by game progression.
- Added undo and redo for translation edits, available from the title bar throughout the app.
- Added a Translate warning filter for missing or changed Larian tags and source/translation capitalization mismatches. The filter shows the affected-string count and appears only when warnings exist.
- Added a No speakers filter and expanded selected-string clipboard formats to include source text, source plus translation, and source plus translation with IDs.
- Added Gemini 3.6 Flash as the default model and migration of saved Gemini 2.x model selections.
- Added a persistent floating navigation bar toggle, animated hide/show behavior, and title-bar Home navigation.

### Improved

- Reworked Game Data into a side-by-side source/translation layout and aligned its list width with Dialogue Nodes.
- Opened the corresponding BG3 Wiki page when selecting a Game Data entry.
- Reordered NPC groups by game progression and grouped melee and ranged weapons by weapon type.
- Colored item entries by rarity and moved their translation status rings to the end of each row.
- Updated Translate selection copy options and made their labels more compact.
- Matched spell group headings to the Dialogue Nodes text style and used normal title casing for spell levels.
- Refined navigation icons, tooltips, and title-bar text styling.

### Fixed

- Fixed `pnpm dev` failing when generated reference indexes were missing by generating the required indexes before starting the dev server.
- Matched “The Dark Urge (Origin)” to the localization source name “The Dark Urge”.
- Hid NPC description panels when no matching source string exists in the loaded XML.
- Fixed spell description editors rendering the translation twice.
- Fixed the navigation-bar toggle changing its appearance without actually hiding the bar, and prevented title-bar double-clicks on buttons from maximizing the window.
- Removed redundant tooltip text from Translate controls.
