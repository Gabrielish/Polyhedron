import type { AiChatRequest, AiProvider } from './ai-provider'
import { requestWithRateLimit } from './rate-limit'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'

// Claude uses the Messages API rather than the OpenAI chat-completions shape, so it gets its
// own adapter: x-api-key header, anthropic-version, and a content[] response array.
export class AnthropicProvider implements AiProvider {
  constructor(private readonly apiKey: string) {}

  async chat({ model, prompt, signal, maxTokens }: AiChatRequest): Promise<string> {
    const response = await requestWithRateLimit({
      providerId: 'anthropic',
      label: 'Anthropic',
      signal,
      doRequest: () =>
        fetch(ANTHROPIC_API_URL, {
          method: 'POST',
          headers: {
            'x-api-key': this.apiKey,
            'anthropic-version': ANTHROPIC_VERSION,
            'Content-Type': 'application/json'
          },
          signal,
          body: JSON.stringify({
            model,
            max_tokens: maxTokens ?? 4000,
            temperature: 0.3,
            messages: [{ role: 'user', content: prompt }]
          })
        })
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => response.statusText)
      throw new Error(`Anthropic API error ${response.status}: ${detail}`)
    }

    const data = (await response.json()) as {
      content?: { type: string; text?: string }[]
    }
    return (
      data.content
        ?.filter((part) => part.type === 'text')
        .map((part) => part.text ?? '')
        .join('')
        .trim() ?? ''
    )
  }
}
