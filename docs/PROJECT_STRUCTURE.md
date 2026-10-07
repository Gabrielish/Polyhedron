# Project structure

Polyhedron keeps desktop and browser code separate, with common resources and tooling grouped by purpose.

| Folder | Purpose |
| --- | --- |
| `src/` | Desktop application: Electron main process, preload, renderer and shared types. |
| `pwa/` | Public website and browser/mobile companion. Its build remains in `pwa/dist/`. |
| `config/` | Desktop build, TypeScript and database-generation configuration. |
| `resources/` | Installer artwork, database migrations, reference input, package templates, third-party tools and patches. |
| `scripts/` | Build generators and maintenance utilities. |
| `tests/` | Regression checks, benchmarks, platform checks and small test-mod fixtures. |
| `docs/` | Project documentation, changelog and Nexus presentation assets. |
| `.github/` | GitHub Pages deployment workflow. |

## Commands

Run commands from the repository root. Existing commands are unchanged:

```sh
pnpm dev
pnpm run typecheck
pnpm run build
pnpm run build:mac
pnpm run build:win
pnpm run pwa:build
pnpm run test:security
pnpm run test:security:startup
```

Direct regression-check commands now use `tests/`, for example:

```sh
node tests/verify-project-layout.cjs
node tests/verify-pwa-companion.cjs
pnpm exec electron tests/verify-suggestion-sources.cjs
```

`dist/`, `out/`, `pwa/dist/`, generated reference indices and dependencies are build outputs, not application source.

## Private local data

Installed application projects, settings, account credentials and imported translation suggestions stay in the operating system's Polyhedron application-data directory. This restructuring does not relocate or reset that profile.

Imported suggestion XML files are not included in Git, desktop packages, workspace exports or Drive synchronization. The legacy repository copies under `resources/reference/imported-translations/` remain ignored; configured older sources are migrated to private local copies when available.

OAuth preparation may write allowlisted desktop-client metadata under `resources/installer/google-drive/`. That directory is ignored by Git. User authorization tokens must never be committed or packaged.

The files and commands inside resources are resolved explicitly by the build tools. Avoid moving them independently without updating the corresponding configuration and regression checks.
