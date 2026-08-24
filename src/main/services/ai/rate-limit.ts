// Reactive rate limiting for AI providers. When an API answers 429 we honor its suggested
// retry delay (shared across all in-flight requests of the same provider, so a batch backs
// off together instead of hammering the API) and retry a few times before surfacing a
// friendly error. The full API response is embedded in the error detail so it lands in the
// application logs, while the renderer only shows the localized user-error message.

const MAX_ATTEMPTS = 4
const FALLBACK_DELAYS_MS = [2000, 5000, 10000]

export const RATE_LIMITED_USER_ERROR = '[user-error:translation.aiRateLimited]'

// Shared per-provider cooldown. Module-level is safe: main process and each worker thread
// get their own instance, and requests within one process funnel through here.
const cooldownUntil = new Map<string, number>()

function getCooldownMs(providerId: string): number {
  return Math.max(0, (cooldownUntil.get(providerId) ?? 0) - Date.now())
}

function setCooldown(providerId: string, delayMs: number): void {
  const until = Date.now() + delayMs
  if (until > (cooldownUntil.get(providerId) ?? 0)) cooldownUntil.set(providerId, until)
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abortError = () => signal?.reason ?? new Error('Translation cancelled')
    if (signal?.aborted) {
      reject(abortError())
      return
    }
    const onAbort = () => {
      clearTimeout(timer)
      reject(abortError())
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

// Retry hint from a 429 response: Retry-After header (seconds), a `"retryDelay": "30s"`
// field (Google RetryInfo) or a "retry in 30.5s" fragment in the message body.
function parseRetryDelayMs(response: Response, body: string): number | null {
  const header = response.headers.get('retry-after')
  if (header) {
    const seconds = Number(header)
    if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1000)
  }
  const match = body.match(/"retryDelay"\s*:\s*"([\d.]+)s"/) ?? body.match(/retry in ([\d.]+)\s*s/i)
  if (match) return Math.ceil(Number.parseFloat(match[1]) * 1000)
  return null
}

export interface RateLimitedRequestParams {
  providerId: string
  label: string
  signal?: AbortSignal
  doRequest: () => Promise<Response>
}

// Runs the request, waiting out any active provider cooldown first. On 429 it records the
// server-suggested delay and retries; after MAX_ATTEMPTS it throws the friendly user error
// with the full API response as log-only detail.
export async function requestWithRateLimit(params: RateLimitedRequestParams): Promise<Response> {
  const { providerId, label, signal, doRequest } = params
  let lastBody = ''

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const wait = getCooldownMs(providerId)
    if (wait > 0) await sleep(wait, signal)

    const response = await doRequest()
    if (response.status !== 429) return response

    lastBody = await response.text().catch(() => '')
    const delay =
      parseRetryDelayMs(response, lastBody) ??
      FALLBACK_DELAYS_MS[Math.min(attempt, FALLBACK_DELAYS_MS.length - 1)]
    setCooldown(providerId, delay)
  }

  throw new Error(`${RATE_LIMITED_USER_ERROR} ${label} API error 429: ${lastBody.slice(0, 2000)}`)
}
