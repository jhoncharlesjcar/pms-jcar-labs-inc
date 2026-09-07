// Cliente LLM agnóstico de proveedor: Qwen (DashScope, modo compatible OpenAI) y Gemini.
import { fetchWithPolicy, logEvent } from '../_shared/runtime.ts';

declare const Deno: { env: { get(name: string): string | undefined } };

export type AiProvider = 'qwen' | 'gemini';

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ModelReply {
  text: string;
  toolCalls: ToolCall[];
}

// Formato canónico OpenAI-compatible (nativo para Qwen; se mapea para Gemini).
export interface ModelMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
  name?: string;
}

export interface OpenAiTool {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface ModelSession {
  provider: AiProvider;
  messages: ModelMessage[];
  tools: OpenAiTool[];
}

export function resolveProvider(): AiProvider {
  const configured = (Deno.env.get('AI_PROVIDER') || '').toLowerCase();
  if (configured === 'gemini') return 'gemini';
  if (configured === 'qwen') return 'qwen';
  if (Deno.env.get('GEMINI_API_KEY')) return 'gemini';
  return 'qwen';
}

export function resolveApiKey(provider: AiProvider): string {
  if (provider === 'qwen') return Deno.env.get('QWEN_API_KEY') || '';
  return Deno.env.get('GEMINI_API_KEY') || '';
}

function qwenModel(): string {
  const configured = Deno.env.get('QWEN_MODEL') || 'qwen-plus';
  return /^[A-Za-z0-9._-]{3,80}$/.test(configured) ? configured : 'qwen-plus';
}

function qwenEndpoint(): string {
  const base = (Deno.env.get('QWEN_BASE_URL') || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1').replace(/\/$/, '');
  return `${base}/chat/completions`;
}

function geminiEndpoint(): string {
  const configured = Deno.env.get('GEMINI_MODEL') || 'gemini-2.0-flash';
  const model = /^[A-Za-z0-9._-]{3,80}$/.test(configured) ? configured : 'gemini-2.0-flash';
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

function safeJsonParse(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Qwen (DashScope compatible-mode)
// ---------------------------------------------------------------------------

function buildQwenBody(session: ModelSession): unknown {
  return {
    model: qwenModel(),
    messages: session.messages,
    tools: session.tools.length ? session.tools : undefined,
    temperature: 0.2,
    max_tokens: 800,
  };
}

function qwenResponseToReply(data: any): ModelReply {
  const message = data?.choices?.[0]?.message || {};
  const text = typeof message.content === 'string' ? message.content : '';
  const toolCalls: ToolCall[] = (message.tool_calls || []).map((call: any, index: number) => ({
    id: call.id || `qwen-${index}`,
    name: call.function?.name || '',
    args: safeJsonParse(call.function?.arguments || '{}'),
  }));
  return { text, toolCalls };
}

// ---------------------------------------------------------------------------
// Gemini
// ---------------------------------------------------------------------------

function openAiToolsToGemini(tools: OpenAiTool[]): any[] {
  return [{
    functionDeclarations: tools.map((tool) => ({
      name: tool.function.name,
      description: tool.function.description,
      parameters: tool.function.parameters,
    })),
  }];
}

function messagesToGeminiContents(messages: ModelMessage[]): any[] {
  const contents: any[] = [];
  for (const message of messages) {
    if (message.role === 'system') continue;
    if (message.role === 'user') {
      contents.push({ role: 'user', parts: [{ text: message.content || '' }] });
    } else if (message.role === 'assistant') {
      const parts: any[] = [];
      if (message.content) parts.push({ text: message.content });
      for (const call of message.tool_calls || []) {
        parts.push({ functionCall: { name: call.function.name, args: safeJsonParse(call.function.arguments) } });
      }
      contents.push({ role: 'model', parts });
    } else if (message.role === 'tool') {
      contents.push({
        role: 'user',
        parts: [{ functionResponse: { name: message.name || '', response: safeJsonParse(message.content || '{}') } }],
      });
    }
  }
  return contents;
}

function buildGeminiBody(session: ModelSession): unknown {
  const systemMessage = session.messages.find((message) => message.role === 'system');
  return {
    systemInstruction: { parts: [{ text: systemMessage?.content || '' }] },
    contents: messagesToGeminiContents(session.messages),
    tools: session.tools.length ? openAiToolsToGemini(session.tools) : undefined,
    generationConfig: { temperature: 0.2, maxOutputTokens: 800 },
  };
}

function geminiResponseToReply(data: any): ModelReply {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  let text = '';
  const toolCalls: ToolCall[] = [];
  for (const part of parts) {
    if (typeof part.text === 'string') text += part.text;
    if (part.functionCall) {
      toolCalls.push({ id: `gemini-${toolCalls.length}`, name: part.functionCall.name, args: part.functionCall.args || {} });
    }
  }
  return { text, toolCalls };
}

// ---------------------------------------------------------------------------
// Petición unificada
// ---------------------------------------------------------------------------

async function requestModel(session: ModelSession, apiKey: string): Promise<ModelReply> {
  const isQwen = session.provider === 'qwen';
  const url = isQwen ? qwenEndpoint() : geminiEndpoint();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (isQwen) headers['Authorization'] = `Bearer ${apiKey}`;
  else headers['x-goog-api-key'] = apiKey;

  const response = await fetchWithPolicy(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(isQwen ? buildQwenBody(session) : buildGeminiBody(session)),
  }, { timeoutMs: 12_000, attempts: 2 });

  if (!response.ok) {
    logEvent('warn', 'llm_request_failed', { provider: session.provider, status: response.status });
    throw new Error(`LLM API error (${session.provider}): ${response.status}`);
  }
  const data = await response.json();
  return isQwen ? qwenResponseToReply(data) : geminiResponseToReply(data);
}

export function createSession(provider: AiProvider, messages: ModelMessage[], tools: OpenAiTool[]): ModelSession {
  return { provider, messages, tools };
}

/** Envía la conversación y devuelve la respuesta; añade el turno assistant al historial. */
export async function callModel(session: ModelSession, apiKey: string): Promise<ModelReply> {
  const reply = await requestModel(session, apiKey);
  session.messages.push({
    role: 'assistant',
    content: reply.text || null,
    tool_calls: reply.toolCalls.length
      ? reply.toolCalls.map((call) => ({ id: call.id, type: 'function' as const, function: { name: call.name, arguments: JSON.stringify(call.args) } }))
      : undefined,
  });
  return reply;
}

/** Envía los resultados de herramientas y devuelve la siguiente respuesta del modelo. */
export async function submitToolResults(
  session: ModelSession,
  toolResults: Array<{ id: string; name: string; result: unknown }>,
  apiKey: string,
): Promise<ModelReply> {
  for (const result of toolResults) {
    session.messages.push({
      role: 'tool',
      content: JSON.stringify(result.result),
      tool_call_id: result.id,
      name: result.name,
    });
  }
  return callModel(session, apiKey);
}
