export interface RetryOptions {
  timeoutMs?: number;
  attempts?: number;
  retryStatuses?: number[];
}

const DEFAULT_RETRY_STATUSES = [408, 425, 429, 500, 502, 503, 504];
const upstreamCircuits = new Map<string, { failures: number; openUntil: number }>();

function upstreamKey(input: string | URL | Request): string {
  try {
    const raw = input instanceof Request ? input.url : String(input);
    return new URL(raw).origin;
  } catch {
    return 'unknown-upstream';
  }
}

export function requestId(req: Request): string {
  const supplied = req.headers.get('x-request-id')?.trim() || '';
  return /^[A-Za-z0-9._:-]{8,100}$/.test(supplied) ? supplied : crypto.randomUUID();
}

export function logEvent(
  level: 'info' | 'warn' | 'error',
  event: string,
  fields: Record<string, unknown> = {},
): void {
  const record = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...fields,
  });
  if (level === 'error') console.error(record);
  else if (level === 'warn') console.warn(record);
  else console.log(record);
}

export async function fetchWithPolicy(
  input: string | URL | Request,
  init: RequestInit = {},
  options: RetryOptions = {},
): Promise<Response> {
  const timeoutMs = Math.min(Math.max(options.timeoutMs ?? 8_000, 500), 30_000);
  const attempts = Math.min(Math.max(options.attempts ?? 1, 1), 3);
  const retryStatuses = options.retryStatuses ?? DEFAULT_RETRY_STATUSES;
  let lastError: unknown;
  const circuitKey = upstreamKey(input);
  const circuit = upstreamCircuits.get(circuitKey);
  if (circuit && circuit.openUntil > Date.now()) throw new Error('upstream_circuit_open');

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort('upstream_timeout'), timeoutMs);
    try {
      const response = await fetch(input, { ...init, signal: controller.signal });
      if (attempt < attempts && retryStatuses.includes(response.status)) {
        await response.body?.cancel();
        await new Promise((resolve) => setTimeout(resolve, 150 * attempt + Math.floor(Math.random() * 100)));
        continue;
      }
      if (retryStatuses.includes(response.status)) {
        const failures = (upstreamCircuits.get(circuitKey)?.failures || 0) + 1;
        upstreamCircuits.set(circuitKey, {
          failures,
          openUntil: failures >= 5 ? Date.now() + 30_000 : 0,
        });
      } else {
        upstreamCircuits.delete(circuitKey);
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt >= attempts) {
        const failures = (upstreamCircuits.get(circuitKey)?.failures || 0) + 1;
        upstreamCircuits.set(circuitKey, {
          failures,
          openUntil: failures >= 5 ? Date.now() + 30_000 : 0,
        });
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 150 * attempt + Math.floor(Math.random() * 100)));
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('upstream_request_failed');
}

export function noStoreJson(body: unknown, status = 200, extraHeaders: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, max-age=0',
      ...Object.fromEntries(new Headers(extraHeaders).entries()),
    },
  });
}
