# Polyhedron

A translation workspace for **Baldur's Gate 3**, **Divinity: Original Sin** and **Divinity: Original Sin 2**. Available on **Windows and macOS**, with a browser/PWA companion for working on your translations from other devices.

[Website & browser companion](https://gabrielish.github.io/Polyhedron/) · [Downloads](https://github.com/Gabrielish/Polyhedron/releases) · [Report an issue](https://github.com/Gabrielish/Polyhedron/issues)

## Features

- **Translate:** edit large localization files, search with match-case and whole-word options, find and replace, filter by speaker or status, and review translations.
- **Translation tools:** reusable translations, term glossary, local XML suggestion files and optional AI assistance.
- **BG3 context:** Dialogue Nodes, Game Data, spell cards, Creature Guide and gender variants.
- **Import & export:** localization XML, saved workspace backups and BG3 `.loca`/`.pak` tools, including localization injection into packages.
- **Google Drive:** upload and download your workspace, use automatic sync, and continue in the browser companion.
- **Appearance:** customizable accent colors, button text and app icons.

BG3-specific references and packaging tools are not available for Divinity projects. The browser companion supports translation and reference browsing; desktop packaging tools remain desktop-only.

## Get started

1. Download the Windows installer or macOS disk image from [Releases](https://github.com/Gabrielish/Polyhedron/releases).
2. Install Polyhedron and import your localization file.
3. Translate, save your workspace and export your work.

Google Drive and AI features are optional and require their respective account/API configuration.

## Development

Requires Node.js and pnpm. Run from the repository root:

```sh
pnpm install
pnpm dev
```

Check and build:

```sh
pnpm typecheck
pnpm lint
pnpm build:win
pnpm build:mac
pnpm pwa:build
```

Built with Electron, React, TypeScript and SQLite.

## Project layout

- `src/` — desktop application
- `pwa/` — website and browser companion
- `config/` — build configuration
- `resources/` — artwork, migrations, references and tools
- `scripts/` — build and maintenance utilities
- `tests/` — regression checks and fixtures
- `docs/` — documentation and presentation assets

See [Project structure](docs/PROJECT_STRUCTURE.md), [Changelog](docs/CHANGELOG.md) and [Security](SECURITY.md) for details.

## Your data

Projects, settings and imported suggestion files stay in your local application-data directory. Suggestion XML files are not committed, bundled or synced through Drive. Keep workspace backups, and never commit account tokens, API keys or personal databases.
