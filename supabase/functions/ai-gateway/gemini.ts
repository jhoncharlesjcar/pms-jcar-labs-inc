import { fetchWithPolicy, logEvent } from '../_shared/runtime.ts';

declare const Deno: { env: { get(name: string): string | undefined } };

export interface GeminiSession {
  contents: Array<{ role: string; parts: Array<Record<string, unknown>> }>;
  response: any;
}

function endpoint(): string {
  const configured = Deno.env.get('GEMINI_MODEL') || 'gemini-2.0-flash';
  const model = /^[A-Za-z0-9._-]{3,80}$/.test(configured) ? configured : 'gemini-2.0-flash';
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

async function generate(
  systemPrompt: string,
  contents: GeminiSession['contents'],
  toolsDefinition: any[],
  apiKey: string,
): Promise<any> {
  const response = await fetchWithPolicy(endpoint(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      tools: toolsDefinition,
      generationConfig: { temperature: 0.2, maxOutputTokens: 800 },
    }),
  }, { timeoutMs: 12_000, attempts: 2 });

  if (!response.ok) {
    logEvent('warn', 'gemini_request_failed', { status: response.status });
    throw new Error(`Gemini API error: ${response.status}`);
  }
  return response.json();
}

export async function callGemini(
  systemPrompt: string,
  history: any[],
  newMessage: string,
  toolsDefinition: any[],
  apiKey: string,
): Promise<GeminiSession> {
  const contents: GeminiSession['contents'] = history.map((message) => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: String(message.content || '') }],
  }));
  contents.push({ role: 'user', parts: [{ text: newMessage }] });
  return { contents, response: await generate(systemPrompt, contents, toolsDefinition, apiKey) };
}

export async function submitToolResponseToGemini(
  systemPrompt: string,
  session: GeminiSession,
  modelParts: Array<Record<string, unknown>>,
  toolResponses: Array<{ name: string; result: unknown }>,
  toolsDefinition: any[],
  apiKey: string,
): Promise<GeminiSession> {
  const contents: GeminiSession['contents'] = [
    ...session.contents,
    { role: 'model', parts: modelParts },
    {
      role: 'user',
      parts: toolResponses.map((toolResponse) => ({
        functionResponse: {
          name: toolResponse.name,
          response: { result: toolResponse.result },
        },
      })),
    },
  ];
  return { contents, response: await generate(systemPrompt, contents, toolsDefinition, apiKey) };
}
