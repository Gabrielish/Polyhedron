# Creature Guide portraits

These portraits were curated in the installed Polyhedron app and exported from
its `polyhedron-creature-images` collection. The exported bytes are unchanged;
the current app stores uploaded portraits as JPEG images.

Each filename is a Creature Guide entry ID. Vite includes these files in future
desktop builds. A user's local replacement takes precedence over the bundled
portrait; entries without a bundled image keep the upload placeholder.

To add later selections from a local installation, use
`scripts/export-creature-images.cjs` with that profile's exact Local Storage
LevelDB directory and `--export`. It reads the image collection for export,
without modifying the original profile or copying account/project settings.
Verify the collection with `node tests/verify-creature-images.cjs` before
committing new portraits.
