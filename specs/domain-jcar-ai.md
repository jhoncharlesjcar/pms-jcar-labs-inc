# Spec: JcarAI — agente conversacional multicanal

**Prioridad:** P0  
**Versión:** 1.0  
**Última actualización:** 23 de agosto de 2026

## Propósito

JcarAI atiende interesados y huéspedes en WhatsApp, Instagram, Facebook, web y portal del huésped. El modelo genera lenguaje natural; disponibilidad, tarifas, pagos y reservas siempre se resuelven mediante servicios transaccionales del PMS.

## Flujo canónico de venta

```text
LEAD
→ QUALIFIED
→ AVAILABILITY_CHECKED
→ QUOTE_CREATED
→ RESERVATION_HOLD
→ PAYMENT_PENDING
→ PAYMENT_VERIFIED
→ RESERVATION_CONFIRMED
```

Una fecha de entrada aislada no es una estancia válida. Antes de consultar disponibilidad deben existir fecha de salida, adultos y niños.

## Máquinas de estado

La etapa general de la conversación no reemplaza los estados propios de cada agregado:

- cotización: `pending`, `accepted`, `expired`, `rejected`;
- hold: `active`, `payment_pending`, `converted`, `expired`, `cancelled`;
- pago: `created`, `pending`, `awaiting_manual_review`, `paid`, `failed`, `expired`, `cancelled`, `refunded`;
- reserva PMS: `pendiente`, `confirmada`, `activa`, `finalizada`, `cancelada`.

## Herramientas autorizadas para el modelo

```text
search_availability()
create_quote()
create_reservation_hold()
create_payment_request()
check_payment_status()
get_hotel_policies()
handoff_to_human()
```

`confirm_reservation()` no es una herramienta del modelo. La confirmación solamente puede originarse en un evento de pago validado o en la revisión manual de un usuario autorizado.

## Reglas de pricing

1. El modelo nunca suministra `precio_noche` ni `total`.
2. PostgreSQL parte de `habitaciones.precio_noche`.
3. Para cada noche aplica el mayor factor activo que corresponda por temporada, día de semana u ocupación.
4. La cotización conserva el desglose diario y una fecha de vencimiento.
5. Una cotización vencida debe recalcularse antes de ofrecerse nuevamente.

## Inventario y concurrencia

- Disponibilidad considera reservas activas y holds no vencidos.
- La creación del hold bloquea la fila de habitación y vuelve a validar el rango.
- Una restricción de exclusión impide holds simultáneos sobre la misma habitación y rango.
- Un trigger obliga a cualquier origen de reserva a respetar los holds activos.
- Confirmar el pago convierte el hold y crea la reserva dentro de la misma transacción.

## Pagos

- `ai_payment_intents` es la fuente del estado de pago del ciclo JcarAI.
- Un evento de proveedor debe coincidir exactamente en proveedor, moneda e importe.
- Los eventos son idempotentes por `(provider, provider_event_id)`.
- Yape, Plin y transferencia se mantienen pendientes hasta revisión humana.
- Una imagen o texto enviado por el huésped no confirma por sí solo el pago.

## Contrato de canal normalizado

Los conectores externos llaman a `ai-gateway` con `X-Jcar-Channel-Secret` y este contrato:

```json
{
  "action": "message",
  "hotel_id": "uuid",
  "channel": "whatsapp",
  "external_account_id": "hotel-account",
  "external_contact_id": "customer-id",
  "external_message_id": "provider-message-id",
  "message": "¿Hay habitaciones disponibles?"
}
```

El identificador externo del mensaje es obligatorio y evita procesar dos veces los reintentos del canal.
La respuesta incluye `delivery.message_id` y `delivery.delay_seconds`. El conector aplica ese delay en su propia cola y luego informa `sent`, `delivered`, `read` o `failed` mediante la acción `delivery_status`.

Los mensajes asincrónicos —por ejemplo, la confirmación que nace después de validar un pago— se retiran mediante `pull_outbound`:

```json
{
  "action": "pull_outbound",
  "hotel_id": "uuid",
  "channel": "whatsapp",
  "external_account_id": "hotel-account",
  "limit": 10
}
```

El gateway reclama los mensajes con bloqueo transaccional y devuelve `message_id`, `external_contact_id` y `content`. El conector aplica su ritmo de envío y confirma el resultado con `delivery_status`.

## Handoff

Al tomar control humano:

1. `human_controlled` cambia a `true`;
2. el agente deja de responder;
3. la conversación queda asignada al usuario;
4. pagos, holds y reservas conservan su estado;
5. toda verificación manual registra usuario y referencia.

## Expiración

La función `expire-ai-booking-artifacts` debe ejecutarse periódicamente con `X-Cron-Secret`. Expira cotizaciones, holds y pagos cuyo plazo haya finalizado.

## Criterios de aceptación

- Ninguna respuesta afirma disponibilidad sin consultar el PMS.
- Web y JcarAI producen el mismo precio para los mismos datos.
- El modelo no puede modificar un importe.
- Dos solicitudes concurrentes no retienen la misma habitación.
- Un webhook duplicado no crea dos reservas.
- Una reserva confirmada siempre referencia un pago pagado y un hold convertido.
- Un pago manual exige revisión de recepción.
- Los conectores no pueden cruzar datos entre hoteles.
