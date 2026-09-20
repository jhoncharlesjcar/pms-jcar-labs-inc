// supabase/functions/ai-gateway-channel-ops/index.ts
// Operaciones de canal: pull/ack outbound messages, pull/ack events

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.44.0";
import { authenticateRequest, corsHeaders, errorResponse, jsonResponse } from "../_shared/auth-middleware.ts";
import { authenticateChannelRequest } from "../_shared/channel-auth.ts";
import { uuidPattern } from "./_shared/crypto.ts";
import { logEvent } from "../_shared/runtime.ts";

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errorResponse('Method Not Allowed', 405);

  const traceId = crypto.randomUUID();
  try {
    const rawBody = await req.text();
    let body: any;
    try { body = JSON.parse(rawBody); } catch { return errorResponse('Invalid JSON body', 400); }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const hotelId = String(body.hotel_id || '');
    if (!uuidPattern.test(hotelId)) return errorResponse('Invalid hotel_id', 400);

    const channel = body.channel || 'web';
    const isExternalChannel = ['whatsapp', 'instagram', 'facebook', 'guest_portal'].includes(channel);
    const signedCredential = isExternalChannel ? await authenticateChannelRequest(supabase, req, rawBody) : null;
    const isTrustedChannelRequest = Boolean(signedCredential)
      && signedCredential.hotel_id === hotelId
      && signedCredential.channel === channel
      && signedCredential.enabled === true
      && ['connected', 'degraded'].includes(String(signedCredential.status || ''));

    if (isExternalChannel && !isTrustedChannelRequest) return errorResponse('Invalid channel credentials', 401);

    const externalAccountId = String(body.external_account_id || '').trim();
    const externalContactId = String(body.external_contact_id || '').trim();
    const externalMessageId = String(body.external_message_id || '').trim();

    if (isTrustedChannelRequest) {
      if (!externalAccountId) return errorResponse('Missing external account identifier', 400);
      if (externalAccountId !== signedCredential.external_account_id) return errorResponse('Channel account mismatch', 403);
    }

    const action = body.action;
    const workerId = String(body.worker_id || '').trim();
    if (!/^[A-Za-z0-9._:-]{8,128}$/.test(workerId)) return errorResponse('Valid worker_id is required', 400);

    const { data: channelConnection, error: ccError } = await supabase
      .from('ai_channel_connections')
      .select('id,response_delay_seconds,enabled,status,max_concurrent_messages')
      .eq('hotel_id', hotelId).eq('channel', channel).eq('external_account_id', externalAccountId).eq('enabled', true).maybeSingle();

    if (ccError || !channelConnection) return errorResponse('Channel is not enabled for this hotel', 403);
    if (channelConnection.id !== signedCredential.connection_id || !['connected', 'degraded'].includes(channelConnection.status)) {
      return errorResponse('Credential does not belong to the active channel connection', 403);
    }

    // Helper: check outbound belongs to connection
    const outboundBelongsToConnection = async (messageId: string): Promise<boolean> => {
      const { data: outbound } = await supabase.from('ai_messages').select('conversation_id')
        .eq('id', messageId).eq('hotel_id', hotelId).eq('direction', 'outbound').maybeSingle();
      if (!outbound) return false;
      const { data: owner } = await supabase.from('ai_conversations').select('id')
        .eq('id', outbound.conversation_id).eq('hotel_id', hotelId).eq('channel', channel)
        .eq('external_account_id', externalAccountId).maybeSingle();
      return Boolean(owner);
    };

    // Pull outbound messages
    if (action === 'pull_outbound') {
      const requestedLimit = Number(body.limit || 10);
      const { data: outboundMessages, error: outboundError } = await supabase.rpc('ai_claim_channel_messages_v2', {
        p_hotel_id: hotelId, p_channel: channel, p_external_account_id: externalAccountId,
        p_worker_id: workerId,
        p_limit: Math.min(Math.max(Math.trunc(requestedLimit), 1), Number(channelConnection.max_concurrent_messages || 1), 50),
        p_lease_seconds: 60,
      });
      if (outboundError) throw outboundError;
      return jsonResponse({ success: true, messages: outboundMessages || [] });
    }

    // Ack/Nack outbound
    if (action === 'ack_outbound' || action === 'nack_outbound') {
      const deliveryMessageId = String(body.delivery_message_id || '');
      if (!uuidPattern.test(deliveryMessageId)) return errorResponse('Valid delivery_message_id required', 400);
      if (!await outboundBelongsToConnection(deliveryMessageId)) return errorResponse('Outbound message not found', 404);

      if (action === 'ack_outbound' && !String(body.provider_message_id || '').trim()) {
        return errorResponse('provider_message_id is required to acknowledge delivery', 400);
      }

      const rpcName = action === 'ack_outbound' ? 'ai_ack_channel_message' : 'ai_nack_channel_message';
      const rpcArgs = action === 'ack_outbound'
        ? { p_message_id: deliveryMessageId, p_worker_id: workerId, p_external_message_id: String(body.provider_message_id || '').slice(0, 300) || null }
        : { p_message_id: deliveryMessageId, p_worker_id: workerId, p_error: String(body.error_code || 'connector_delivery_failed').slice(0, 500), p_permanent: body.permanent === true };

      const { data: changed, error: mutationError } = await supabase.rpc(rpcName, rpcArgs);
      if (mutationError) throw mutationError;
      if (!changed) return errorResponse('Message lease is not owned by this worker', 409);
      return jsonResponse({ success: true, message_id: deliveryMessageId });
    }

    // Pull events
    if (action === 'pull_events') {
      const requestedLimit = Number(body.limit || 10);
      const { data: events, error: claimError } = await supabase.rpc('ai_claim_domain_events_v2', {
        p_hotel_id: hotelId, p_channel: channel, p_external_account_id: externalAccountId,
        p_worker_id: workerId,
        p_limit: Math.min(Math.max(Math.trunc(requestedLimit), 1), Number(channelConnection.max_concurrent_messages || 1), 50),
        p_lease_seconds: 60,
      });
      if (claimError) throw claimError;

      const publicAppUrl = (Deno.env.get('PUBLIC_APP_URL') || '').replace(/\/$/, '');
      const claimedEvents = [];
      for (const event of events || []) {
        let delivery: Record<string, unknown> | null = null;
        if (['reservation.confirmed', 'guest_access.delivery_requested'].includes(event.event_type)
          && event.aggregate_type === 'reservation' && uuidPattern.test(String(event.aggregate_id || ''))) {
          if (!/^https:\/\/[A-Za-z0-9.-]+(?::\d+)?$/.test(publicAppUrl)) {
            await supabase.rpc('ai_nack_domain_event', { p_event_id: event.id, p_worker_id: workerId, p_error: 'PUBLIC_APP_URL is not configured', p_permanent: false });
            continue;
          }
          const { data: tokens, error: tokenError } = await supabase.rpc('ai_rotate_guest_access_tokens', {
            p_reservation_id: event.aggregate_id,
          });
          if (tokenError || !tokens) {
            await supabase.rpc('ai_nack_domain_event', { p_event_id: event.id, p_worker_id: workerId, p_error: tokenError?.message || 'guest token generation failed', p_permanent: false });
            continue;
          }
          delivery = {
            portal_url: `${publicAppUrl}/portal/${tokens.portal_token}`,
            checkin_url: `${publicAppUrl}/public-checkin/${tokens.checkin_token}`,
            expires_at: tokens.expires_at,
          };
        }
        claimedEvents.push({ ...event, delivery });
      }
      return jsonResponse({ success: true, events: claimedEvents });
    }

    // Ack/Nack events
    if (action === 'ack_event' || action === 'nack_event') {
      const eventId = String(body.event_id || '');
      if (!uuidPattern.test(eventId)) return errorResponse('Valid event_id required', 400);

      const { data: event } = await supabase.from('ai_domain_events').select('id,hotel_id,payload')
        .eq('id', eventId).eq('hotel_id', hotelId).maybeSingle();
      const conversationId = String(event?.payload?.conversation_id || '');
      if (!event || !uuidPattern.test(conversationId)) return errorResponse('Domain event not found', 404);

      const { data: eventConversation } = await supabase.from('ai_conversations').select('id')
        .eq('id', conversationId).eq('hotel_id', hotelId).eq('channel', channel)
        .eq('external_account_id', externalAccountId).maybeSingle();
      if (!eventConversation) return errorResponse('Domain event does not belong to this connection', 403);

      const rpcName = action === 'ack_event' ? 'ai_ack_domain_event' : 'ai_nack_domain_event';
      const rpcArgs = action === 'ack_event'
        ? { p_event_id: eventId, p_worker_id: workerId }
        : { p_event_id: eventId, p_worker_id: workerId, p_error: String(body.error_code || 'event_publish_failed').slice(0, 1000), p_permanent: body.permanent === true };

      const { data: changed, error: mutationError } = await supabase.rpc(rpcName, rpcArgs);
      if (mutationError) throw mutationError;
      if (!changed) return errorResponse('Event lease is not owned by this worker', 409);
      return jsonResponse({ success: true, event_id: eventId });
    }

    return errorResponse('Unknown action', 400);
  } catch (error: any) {
    console.error('[Channel Ops Error]', error);
    return errorResponse('Could not process request', 500);
  }
});