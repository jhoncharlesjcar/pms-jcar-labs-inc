export async function callGemini(
  systemPrompt: string, 
  history: any[], 
  newMessage: string, 
  toolsDefinition: any[],
  apiKey: string
): Promise<any> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  // Formatear historial al formato de Gemini
  // Gemini usa 'user' y 'model' como roles
  const contents = history.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : msg.role,
    parts: [{ text: msg.content }]
  }));

  // Añadir nuevo mensaje
  contents.push({
    role: 'user',
    parts: [{ text: newMessage }]
  });

  const payload = {
    systemInstruction: {
      parts: [{ text: systemPrompt }]
    },
    contents,
    tools: toolsDefinition,
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 800,
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorTxt = await response.text();
    console.error('[Gemini API Error]', errorTxt);
    throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

export async function submitToolResponseToGemini(
  systemPrompt: string,
  history: any[],
  toolResponses: any[],
  toolsDefinition: any[],
  apiKey: string
): Promise<any> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  // Formatear historial
  const contents = history.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : msg.role,
    parts: msg._functionCall ? [{ functionCall: msg._functionCall }] : [{ text: msg.content }]
  }));

  // Añadir tool call functionResponse
  // NOTA: Para simplificar el MVP y evitar complejidades de formateo de multi-turn tool calls en Gemini, 
  // simulamos el toolResult inyectándolo como un mensaje de sistema o user para que Gemini evalúe y responda.
  // La API de Gemini requiere que un 'functionCall' del modelo sea seguido por un 'functionResponse' del usuario.

  // Añadir el function response
  const functionResponsesParts = toolResponses.map(tr => ({
    functionResponse: {
      name: tr.name,
      response: { result: tr.result }
    }
  }));

  contents.push({
    role: 'user', // En Gemini el usuario devuelve el functionResponse
    parts: functionResponsesParts as any
  });

  const payload = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents,
    tools: toolsDefinition,
    generationConfig: { temperature: 0.2 }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorTxt = await response.text();
    console.error('[Gemini API ToolResponse Error]', errorTxt);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  return await response.json();
}
