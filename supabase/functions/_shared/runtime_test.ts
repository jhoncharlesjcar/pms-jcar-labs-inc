import { fetchWithPolicy, noStoreJson, requestId } from './runtime.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test('requestId accepts safe correlation ids and rejects malformed values', () => {
  const accepted = requestId(new Request('https://example.test', { headers: { 'x-request-id': 'request-1234' } }));
  const generated = requestId(new Request('https://example.test', { headers: { 'x-request-id': '../../bad' } }));
  assert(accepted === 'request-1234', 'safe request id was not preserved');
  assert(generated !== '../../bad' && generated.length >= 8, 'unsafe request id was not replaced');
});

Deno.test('noStoreJson prevents caching sensitive responses', async () => {
  const response = noStoreJson({ ok: true }, 202, { 'x-request-id': 'request-1234' });
  assert(response.status === 202, 'unexpected status');
  assert(response.headers.get('cache-control') === 'no-store, max-age=0', 'no-store header missing');
  assert(response.headers.get('x-request-id') === 'request-1234', 'correlation header missing');
  assert((await response.json()).ok === true, 'invalid JSON response');
});

Deno.test('fetchWithPolicy retries transient responses and closes a recovered circuit', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (() => {
    calls += 1;
    return Promise.resolve(new Response('', { status: calls === 1 ? 503 : 200 }));
  }) as typeof fetch;
  try {
    const response = await fetchWithPolicy(`https://retry-${crypto.randomUUID()}.test/path`, {}, { attempts: 2, timeoutMs: 500 });
    assert(response.status === 200, 'transient request did not recover');
    assert(calls === 2, 'request was not retried exactly once');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test('fetchWithPolicy opens the circuit after repeated terminal failures', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (() => {
    calls += 1;
    return Promise.resolve(new Response('', { status: 503 }));
  }) as typeof fetch;
  const endpoint = `https://circuit-${crypto.randomUUID()}.test/path`;
  try {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await fetchWithPolicy(endpoint, {}, { attempts: 1, timeoutMs: 500 });
      assert(response.status === 503, 'terminal upstream status changed unexpectedly');
    }
    let opened = false;
    try {
      await fetchWithPolicy(endpoint, {}, { attempts: 1, timeoutMs: 500 });
    } catch (error) {
      opened = error instanceof Error && error.message === 'upstream_circuit_open';
    }
    assert(opened, 'circuit did not open after five failures');
    assert(calls === 5, 'open circuit still called the upstream');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
