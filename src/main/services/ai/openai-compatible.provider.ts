import type { AiChatRequest, AiProvider } from './ai-provider'
import { requestWithRateLimit } from './rate-limit'

// Single adapter for every OpenAI-compatible chat-completions API: OpenAI, Google Gemini
// (its OpenAI-compat endpoint) and xAI Grok. They differ only by base URL + model + key.
export class OpenAICompatibleProvider implements AiProvider {
  constructor(
    private readonly providerId: string,
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly label: string
  ) {}

  async chat({ model, prompt, signal }: AiChatRequest): Promise<string> {
    const response = await requestWithRateLimit({
      providerId: this.providerId,
      label: this.label,
      signal,
      doRequest: () =>
        fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          signal,
          body: JSON.stringify({
            model,
            temperature: 0.3,
            messages: [{ role: 'user', content: prompt }]
          })
        })
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => response.statusText)
      throw new Error(`${this.label} API error ${response.status}: ${detail}`)
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    return data.choices?.[0]?.message?.content?.trim() ?? ''
  }
}
