// supabase/functions/ai-gateway/index.ts
// Router principal - redirige a los submódulos

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.44.0";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/auth-middleware.ts";

const routes = [
  { pattern: /^\/bootstrap$/, module: 'ai-gateway-bootstrap' },
  { pattern: /^\/channel-auth$/, module: 'ai-gateway-channel-auth' },
  { pattern: /^\/credential-provision$/, module: 'ai-gateway-credential-provision' },
  { pattern: /^\/message-intake$/, module: 'ai-gateway-message-intake' },
  { pattern: /^\/conversation$/, module: 'ai-gateway-conversation' },
  { pattern: /^\/llm$/, module: 'ai-gateway-llm' },
  { pattern: /^\/channel-ops$/, module: 'ai-gateway-channel-ops' },
  { pattern: /^\/payment-evidence$/, module: 'ai-gateway-payment-evidence' },
];

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errorResponse('Method Not Allowed', 405);

  const url = new URL(req.url);
  const path = url.pathname.replace('/functions/v1/ai-gateway', '') || '/';
  
  // Find matching route
  const route = routes.find(r => r.pattern.test(path));
  if (!route) {
    return errorResponse('Not found', 404);
  }

  // Forward to sub-module
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const targetUrl = `${supabaseUrl}/functions/v1/${route.module}${path.replace(/^\/[^/]+/, '')}`;
  
  const response = await fetch(targetUrl, {
    method: req.method,
    headers: req.headers,
    body: req.body,
  });

  return new Response(response.body, {
    status: response.status,
    headers: response.headers,
  });
});

serve(serve);