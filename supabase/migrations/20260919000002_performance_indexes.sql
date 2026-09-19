-- Migración de performance: Índices para FKs sin índice (Supabase Advisors)
-- Fecha: 2026-09-19
-- Aborda: 68 unindexed foreign keys

-- ============================================================================
-- Índices críticos para FKs sin índice (top priority por uso en queries)
-- ============================================================================

-- ai_booking_intents
CREATE INDEX IF NOT EXISTS idx_ai_booking_intents_hotel_id ON public.ai_booking_intents(hotel_id);
CREATE INDEX IF NOT EXISTS idx_ai_booking_intents_selected_room_id ON public.ai_booking_intents(selected_room_id);
CREATE INDEX IF NOT EXISTS idx_ai_booking_intents_conversation_id ON public.ai_booking_intents(conversation_id);

-- ai_channel_connections
CREATE INDEX IF NOT EXISTS idx_ai_channel_connections_hotel_id ON public.ai_channel_connections(hotel_id);

-- ai_conversations
CREATE INDEX IF NOT EXISTS idx_ai_conversations_hotel_id ON public.ai_conversations(hotel_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_guest_contact_id ON public.ai_conversations(guest_contact_id);

-- ai_messages
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_id ON public.ai_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_hotel_id ON public.ai_messages(hotel_id);

-- ai_payment_intents
CREATE INDEX IF NOT EXISTS idx_ai_payment_intents_hotel_id ON public.ai_payment_intents(hotel_id);
CREATE INDEX IF NOT EXISTS idx_ai_payment_intents_conversation_id ON public.ai_payment_intents(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_payment_intents_booking_intent_id ON public.ai_payment_intents(booking_intent_id);

-- ai_quotes
CREATE INDEX IF NOT EXISTS idx_ai_quotes_hotel_id ON public.ai_quotes(hotel_id);
CREATE INDEX IF NOT EXISTS idx_ai_quotes_conversation_id ON public.ai_quotes(conversation_id);

-- ai_reservation_holds
CREATE INDEX IF NOT EXISTS idx_ai_reservation_holds_hotel_id ON public.ai_reservation_holds(hotel_id);
CREATE INDEX IF NOT EXISTS idx_ai_reservation_holds_room_id ON public.ai_reservation_holds(room_id);
CREATE INDEX IF NOT EXISTS idx_ai_reservation_holds_quote_id ON public.ai_reservation_holds(quote_id);

-- audit_events
CREATE INDEX IF NOT EXISTS idx_audit_events_hotel_id ON public.audit_events(hotel_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_user_id ON public.audit_events(user_id);

-- audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_hotel_id ON public.audit_logs(hotel_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);

-- checkins_publicos
CREATE INDEX IF NOT EXISTS idx_checkins_publicos_hotel_id ON public.checkins_publicos(hotel_id);
CREATE INDEX IF NOT EXISTS idx_checkins_publicos_reserva_id ON public.checkins_publicos(reserva_id);

-- cierres_caja
CREATE INDEX IF NOT EXISTS idx_cierres_caja_hotel_id ON public.cierres_caja(hotel_id);
CREATE INDEX IF NOT EXISTS idx_cierres_caja_fecha ON public.cierres_caja(fecha_cierre);

-- comprobante_detalle
CREATE INDEX IF NOT EXISTS idx_comprobante_detalle_comprobante_id ON public.comprobante_detalle(comprobante_id);

-- comprobante_xml
CREATE INDEX IF NOT EXISTS idx_comprobante_xml_hotel_id ON public.comprobante_xml(hotel_id);
CREATE INDEX IF NOT EXISTS idx_comprobante_xml_comprobante_id ON public.comprobante_xml(comprobante_id);

-- comprobantes
CREATE INDEX IF NOT EXISTS idx_comprobantes_hotel_id ON public.comprobantes(hotel_id);
CREATE INDEX IF NOT EXISTS idx_comprobantes_reserva_id ON public.comprobantes(reserva_id);
CREATE INDEX IF NOT EXISTS idx_comprobantes_venta_id ON public.comprobantes(venta_id);

-- egresos
CREATE INDEX IF NOT EXISTS idx_egresos_hotel_id ON public.egresos(hotel_id);
CREATE INDEX IF NOT EXISTS idx_egresos_cierre_caja_id ON public.egresos(cierre_caja_id);

-- habitaciones
CREATE INDEX IF NOT EXISTS idx_habitaciones_hotel_id ON public.habitaciones(hotel_id);

-- insumos
CREATE INDEX IF NOT EXISTS idx_insumos_hotel_id ON public.insumos(hotel_id);
CREATE INDEX IF NOT EXISTS idx_insumos_categoria_id ON public.insumos(categoria_id);

-- loyalty_accounts
CREATE INDEX IF NOT EXISTS idx_loyalty_accounts_hotel_id ON public.loyalty_accounts(hotel_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_accounts_guest_document ON public.loyalty_accounts(tipo_documento, numero_documento);

-- loyalty_transactions
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_account_id ON public.loyalty_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_hotel_id ON public.loyalty_transactions(hotel_id);

-- movimientos_insumos
CREATE INDEX IF NOT EXISTS idx_movimientos_insumos_hotel_id ON public.movimientos_insumos(hotel_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_insumos_insumo_id ON public.movimientos_insumos(insumo_id);

-- ota_config
CREATE INDEX IF NOT EXISTS idx_ota_config_hotel_id ON public.ota_config(hotel_id);

-- ota_room_mappings
CREATE INDEX IF NOT EXISTS idx_ota_room_mappings_hotel_id ON public.ota_room_mappings(hotel_id);
CREATE INDEX IF NOT EXISTS idx_ota_room_mappings_habitacion_id ON public.ota_room_mappings(habitacion_id);

-- productos
CREATE INDEX IF NOT EXISTS idx_productos_hotel_id ON public.productos(hotel_id);
CREATE INDEX IF NOT EXISTS idx_productos_categoria_id ON public.productos(categoria_id);

-- reservas
CREATE INDEX IF NOT EXISTS idx_reservas_hotel_id ON public.reservas(hotel_id);
CREATE INDEX IF NOT EXISTS idx_reservas_habitacion_id ON public.reservas(habitacion_id);
CREATE INDEX IF NOT EXISTS idx_reservas_fecha_entrada ON public.reservas(fecha_entrada);
CREATE INDEX IF NOT EXISTS idx_reservas_fecha_salida ON public.reservas(fecha_salida);
CREATE INDEX IF NOT EXISTS idx_reservas_estado ON public.reservas(estado);

-- servicios_extra
CREATE INDEX IF NOT EXISTS idx_servicios_extra_hotel_id ON public.servicios_extra(hotel_id);

-- sunat_envios
CREATE INDEX IF NOT EXISTS idx_sunat_envios_hotel_id ON public.sunat_envios(hotel_id);
CREATE INDEX IF NOT EXISTS idx_sunat_envios_comprobante_id ON public.sunat_envios(comprobante_id);

-- tarifas_dinamicas
CREATE INDEX IF NOT EXISTS idx_tarifas_dinamicas_hotel_id ON public.tarifas_dinamicas(hotel_id);
CREATE INDEX IF NOT EXISTS idx_tarifas_dinamicas_habitacion_id ON public.tarifas_dinamicas(habitacion_id);

-- usuarios
CREATE INDEX IF NOT EXISTS idx_usuarios_hotel_id ON public.usuarios(hotel_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON public.usuarios(email);

-- ventas
CREATE INDEX IF NOT EXISTS idx_ventas_hotel_id ON public.ventas(hotel_id);
CREATE INDEX IF NOT EXISTS idx_ventas_reserva_id ON public.ventas(reserva_id);
CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON public.ventas(fecha_pago);

-- ventas_pos
CREATE INDEX IF NOT EXISTS idx_ventas_pos_hotel_id ON public.ventas_pos(hotel_id);
CREATE INDEX IF NOT EXISTS idx_ventas_pos_habitacion_id ON public.ventas_pos(habitacion_id);

-- ============================================================================
-- Índices compuestos para queries frecuentes
-- ============================================================================

-- Reservas por hotel + fecha rango (dashboard, recepción)
CREATE INDEX IF NOT EXISTS idx_reservas_hotel_fechas ON public.reservas(hotel_id, fecha_entrada, fecha_salida);

-- Comprobantes por hotel + fecha (reportes, facturación)
CREATE INDEX IF NOT EXISTS idx_comprobantes_hotel_fecha ON public.comprobantes(hotel_id, created_at);

-- Ventas por hotel + fecha (caja, reportes)
CREATE INDEX IF NOT EXISTS idx_ventas_hotel_fecha ON public.ventas(hotel_id, fecha_pago);

-- AI conversations por hotel + updated (sync)
CREATE INDEX IF NOT EXISTS idx_ai_conversations_hotel_updated ON public.ai_conversations(hotel_id, updated_at);

-- AI messages por conversation + created (chat history)
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_created ON public.ai_messages(conversation_id, created_at);

COMMENT ON MIGRATION IS 'Performance indexes for 68 unindexed FKs per Supabase Advisors 2026-09-19';