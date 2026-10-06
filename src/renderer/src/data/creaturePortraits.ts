// Curated portraits shipped with the app. User-selected local replacements
// remain separate and take precedence without changing the bundled collection.
const files = import.meta.glob<string>('../assets/creatures/*.{jpg,png,webp}', {
  eager: true,
  query: '?url',
  import: 'default'
})

export const creaturePortraits: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([filename, url]) => [
    filename.split('/').pop()!.replace(/\.[^.]+$/, ''),
    url
  ])
)
