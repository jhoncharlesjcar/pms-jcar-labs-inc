// Pruebas del cliente LLM agnóstico (Qwen + Gemini) sin llamadas de red reales.
import { callModel, createSession, resolveProvider, submitToolResults } from './llm.ts';
import type { ModelMessage, OpenAiTool } from './llm.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

interface RecordedRequest {
  url: string;
  headers: Headers;
  body: Record<string, any>;
}

let recorded: RecordedRequest | null = null;

function mockFetchWith(responses: unknown[]): () => void {
  const originalFetch = globalThis.fetch;
  let index = 0;
  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    recorded = { url: String(input), headers: new Headers(init?.headers || {}), body };
    const payload = responses[Math.min(index, responses.length - 1)];
    index += 1;
    return Promise.resolve(new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
  }) as typeof fetch;
  return () => { globalThis.fetch = originalFetch; };
}

const tools: OpenAiTool[] = [{
  type: 'function',
  function: {
    name: 'search_availability',
    description: 'busca disponibilidad',
    parameters: { type: 'object', properties: { check_in: { type: 'string' } } },
  },
}];

const systemMessage: ModelMessage = { role: 'system', content: 'Eres un agente de hotel' };
const userMessage: ModelMessage = { role: 'user', content: 'Hola, ¿hay habitaciones?' };

Deno.test('resolveProvider respeta AI_PROVIDER y el fallback por defecto', () => {
  const prevProvider = Deno.env.get('AI_PROVIDER');
  const prevGemini = Deno.env.get('GEMINI_API_KEY');
  try {
    Deno.env.set('AI_PROVIDER', 'qwen');
    assert(resolveProvider() === 'qwen', 'AI_PROVIDER=qwen no se respetó');

    Deno.env.set('AI_PROVIDER', 'gemini');
    assert(resolveProvider() === 'gemini', 'AI_PROVIDER=gemini no se respetó');

    Deno.env.delete('AI_PROVIDER');
    Deno.env.delete('GEMINI_API_KEY');
    assert(resolveProvider() === 'qwen', 'sin configuración debería usar qwen por defecto');

    Deno.env.set('GEMINI_API_KEY', 'g-key');
    assert(resolveProvider() === 'gemini', 'con GEMINI_API_KEY y sin AI_PROVIDER debería usar gemini');
  } finally {
    if (prevProvider) Deno.env.set('AI_PROVIDER', prevProvider); else Deno.env.delete('AI_PROVIDER');
    if (prevGemini) Deno.env.set('GEMINI_API_KEY', prevGemini); else Deno.env.delete('GEMINI_API_KEY');
  }
});

Deno.test('Qwen: construye request compatible y parsea tool_calls', async () => {
  Deno.env.set('AI_PROVIDER', 'qwen');
  const restore = mockFetchWith([{
    choices: [{
      message: {
        role: 'assistant',
        content: 'Claro, reviso disponibilidad.',
        tool_calls: [{
          id: 'call_1',
          type: 'function',
          function: {
            name: 'search_availability',
            arguments: '{"check_in":"2026-01-01","check_out":"2026-01-03","adults":2}',
          },
        }],
      },
    }],
  }]);
  try {
    const session = createSession('qwen', [systemMessage, userMessage], tools);
    const reply = await callModel(session, 'test-key');

    assert(recorded, 'no se registró la petición');
    assert(recorded.url.includes('dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions'), 'endpoint Qwen incorrecto');
    assert(recorded.headers.get('authorization') === 'Bearer test-key', 'header de autorización Qwen incorrecto');
    assert(recorded.body.model === 'qwen-plus', 'modelo Qwen incorrecto');
    assert(Array.isArray(recorded.body.messages) && recorded.body.messages[0].role === 'system', 'mensaje system ausente');
    assert(recorded.body.tools[0].type === 'function' && recorded.body.tools[0].function.name === 'search_availability', 'tools en formato OpenAI incorrecto');

    assert(reply.text === 'Claro, reviso disponibilidad.', 'texto de respuesta Qwen no parseado');
    assert(reply.toolCalls.length === 1, 'tool_call no parseado');
    assert(reply.toolCalls[0].name === 'search_availability', 'nombre de tool incorrecto');
    assert(reply.toolCalls[0].args.check_in === '2026-01-01', 'argumentos JSON no parseados');
  } finally {
    restore();
  }
});

Deno.test('Gemini: mapea contents/functionDeclarations y parsea functionCall', async () => {
  Deno.env.set('AI_PROVIDER', 'gemini');
  const restore = mockFetchWith([{
    candidates: [{
      content: {
        parts: [
          { text: 'Te transfiero a recepción.' },
          { functionCall: { name: 'handoff_to_human', args: { reason: 'queja' } } },
        ],
      },
    }],
  }]);
  try {
    const session = createSession('gemini', [systemMessage, userMessage], tools);
    const reply = await callModel(session, 'g-key');

    assert(recorded, 'no se registró la petición');
    assert(recorded.url.includes('generativelanguage.googleapis.com'), 'endpoint Gemini incorrecto');
    assert(recorded.headers.get('x-goog-api-key') === 'g-key', 'header Gemini incorrecto');
    assert(recorded.body.tools[0].functionDeclarations[0].name === 'search_availability', 'functionDeclarations no mapeado');
    assert(recorded.body.contents[0].role === 'user', 'contents no mapeado a role user/model');

    assert(reply.text === 'Te transfiero a recepción.', 'texto de respuesta Gemini no parseado');
    assert(reply.toolCalls[0].name === 'handoff_to_human', 'functionCall Gemini no parseado');
    assert(reply.toolCalls[0].args.reason === 'queja', 'argumentos Gemini no parseados');
  } finally {
    restore();
  }
});

Deno.test('round-trip de tool-calling envía el resultado como mensaje tool', async () => {
  Deno.env.set('AI_PROVIDER', 'qwen');
  const restore = mockFetchWith([
    { choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'search_availability', arguments: '{}' } }] } }] },
    { choices: [{ message: { role: 'assistant', content: 'Hay 3 habitaciones disponibles.' } }] },
  ]);
  try {
    const session = createSession('qwen', [systemMessage, userMessage], tools);
    const first = await callModel(session, 'k');
    assert(first.toolCalls.length === 1, 'primer tool_call no detectado');

    const second = await submitToolResults(session, [{
      id: 'call_1',
      name: 'search_availability',
      result: { habitaciones: [] },
    }], 'k');

    assert(recorded, 'segunda petición no registrada');
    const toolMessages = recorded.body.messages.filter((m: any) => m.role === 'tool');
    assert(toolMessages.length === 1, 'mensaje tool no enviado en el round-trip');
    assert(toolMessages[0].tool_call_id === 'call_1', 'tool_call_id no coincide con el id de la llamada');
    assert(second.text === 'Hay 3 habitaciones disponibles.', 'respuesta final no parseada');
    assert(second.toolCalls.length === 0, 'no debería haber más tool calls');
  } finally {
    restore();
  }
});
