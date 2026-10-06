export const SECRET_CONFIG_KEYS = [
  'openai_key', 'deepl_key', 'google_key', 'anthropic_key', 'gemini_key', 'grok_key'
] as const

// This is a presence indicator, never an API credential.
export const STORED_SECRET_MARKER = '__POLYHEDRON_SECRET_SAVED__'

export function isSecretConfigKey(key: string): boolean {
  return (SECRET_CONFIG_KEYS as readonly string[]).includes(key)
}

export function isSensitiveConfigKey(key: string): boolean {
  return isSecretConfigKey(key) || /(?:secret|token|password|credential|api.?key)/i.test(key)
}
