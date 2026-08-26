# Runbook de operaciones y continuidad

**Vigencia:** 24 de agosto de 2026
**Alcance:** frontend Vercel, Supabase, Edge Functions y conectores JcarAI

## Objetivos de continuidad

Estos son objetivos internos; deben compararse con el plan contratado en Supabase y Vercel antes de prometerlos a clientes.

| Servicio | RPO objetivo | RTO objetivo | Degradación segura |
| --- | ---: | ---: | --- |
| Reservas, pagos y caja | 15 minutos | 2 horas | Deshabilitar altas y operar una bitácora manual numerada |
| Recepción y habitaciones | 1 hora | 4 horas | Solo lectura y procedimiento manual |
| JcarAI y canales | 4 horas | 8 horas | Handoff humano; no confirmar pagos ni inventario sin PMS |
| Reportes y analítica | 24 horas | 24 horas | Diferir generación |

Se requiere backup administrado con recuperación a un punto en el tiempo para cumplir el RPO de 15 minutos. Si el plan contratado no lo soporta, el RPO real es el intervalo del último backup verificado y debe comunicarse como tal.

## Backups y restauración

- Backup diario y retención mínima de 30 días.
- Prueba de restauración mensual en un proyecto aislado, nunca sobre producción.
- Registrar fecha, responsable, punto restaurado, duración, conteos de reservas/ventas y resultado.
- Antes de una migración productiva: confirmar backup reciente y ejecutar el dry run en staging.
- Una migración aplicada no se edita; la reversión de esquema se hace con una migración compensatoria.

Prueba mínima: restaurar, ejecutar `supabase test db`, comparar conteos agregados por hotel y verificar que un usuario de un hotel no lea otro tenant.

## Retención

| Dato | Ventana operativa | Acción |
| --- | ---: | --- |
| Nonces de conectores | Hasta 24 horas tras expirar | Purga automática |
| Tokens de huésped vencidos/revocados | 7 días | Purga automática; nunca conservar token en claro |
| Eventos de dominio publicados | 30 días | Purga automática |
| Mensajes/eventos en dead letter | 90 días | Resolver o exportar evidencia técnica sin PII y purgar |
| Telemetría técnica del navegador | 30 días | Agregación y purga; no admitir PII |
| Conversaciones JcarAI | 180 días tras cierre | Anonimizar o eliminar salvo retención consentida |
| Auditoría, ventas y comprobantes | Según política fiscal/legal aprobada | No purgar con el job operativo |

El responsable de privacidad debe aprobar las ventanas legales del último renglón. El job de mantenimiento no debe ejecutar `DELETE` sobre ventas, comprobantes ni auditoría.

## Tareas programadas obligatorias

| Tarea | Frecuencia | Autenticación | Alerta |
| --- | --- | --- | --- |
| `expire-ai-booking-artifacts` | Cada minuto | `Supabase Vault (service_role)` | Una falla o ausencia durante 5 minutos |
| `facturacion-worker` | Cada minuto | `Supabase Vault (service_role)` | Una falla, lease fiscal vencido o DLQ fiscal creciente |
| `expire-loyalty-points` | Diaria 02:15 America/Lima | `Supabase Vault (service_role)` | Una ejecución fallida |
| Recuperar leases/retención | Incluido en `expire-ai-booking-artifacts` | RPC service-only desde cron | DLQ creciente o job ausente 5 minutos |
| Restore drill | Mensual | Operador autorizado | Prueba no ejecutada o RTO incumplido |

El scheduler se configura por entorno mediante scripts SQL (`pg_cron`) inyectando directamente los endpoints. Las credenciales de autorización se extraen en tiempo real de **Supabase Vault** (`vault.decrypted_secrets`), eliminando la necesidad de gestionar secretos globales de Postgres. Nunca colocar el `service_role_key` en claro ni en variables `VITE_*`.

## Observabilidad sin PII

El navegador emite eventos JSON desde `src/lib/logger.js` con `timestamp`, `level`, `event`, `correlation_id`, `release` y `environment`. Se redactan claves y patrones de email, documento, teléfono, token, cookies, autorización y contenido conversacional.

Un proveedor de error tracking solo puede conectarse mediante el evento `jcar:telemetry` y tras revisar su contrato, residencia de datos, retención y CSP. No hay envío externo por defecto. Prohibido adjuntar objetos completos de reserva, huésped, pago o conversación.

Alertas mínimas:

- checkout atómico fallido o idempotencia rechazada;
- pago `paid_needs_reconciliation` sin resolver;
- subida sostenida de 401/403/429/5xx;
- leases vencidos, reintentos y dead letters;
- ausencia de crons;
- error rate del frontend por `release`;
- latencia y circuit breaker abierto de proveedores externos.

## Respuesta a incidentes

1. Declarar severidad, responsable, inicio y `correlation_id`; no copiar PII al canal del incidente.
2. Contener: desactivar booking/integración afectada, pasar JcarAI a handoff o revocar credencial.
3. Preservar evidencia técnica redactada y determinar hoteles/operaciones afectados.
4. Para pagos, consultar el proveedor por su identificador idempotente; no repetir un cobro.
5. Restaurar la versión anterior del frontend/función o aplicar migración compensatoria.
6. Validar aislamiento multi-tenant, conteos contables, colas y recorridos smoke.
7. Comunicar cierre y completar postmortem sin culpa en 5 días hábiles.

### Pago confirmado sin reserva

- No crear manualmente otra transacción de pago.
- Localizar `ai_payment_intents.status = 'paid_needs_reconciliation'`.
- Verificar importe y evento original en el proveedor.
- Reasignar inventario solo mediante el RPC administrativo previsto y con autorización; si no hay inventario, seguir el proceso de reembolso del proveedor.
- Registrar decisión en auditoría y notificar al huésped por canal humano.

### Mensaje bloqueado o dead letter

- Confirmar que el lease expiró antes de reintentar.
- Usar ACK/NACK con el mismo `worker_id`; no insertar un mensaje nuevo.
- Tras el máximo de intentos, revisar la DLQ, corregir la causa y reencolar de forma explícita.

### Comprobante SUNAT pendiente

- `facturacion` solo firma y encola; una respuesta HTTP 202 no significa aceptación de SUNAT.
- `facturacion-worker` reclama con lease, envía una vez y confirma con ACK/NACK. No reenviar manualmente mientras el lease esté vigente.
- Consultar el estado persistido por `comprobante_id`; ante timeout, conservar el mismo trabajo e idempotencia.
- Si llega a dead letter, verificar credenciales/certificado y la consulta del proveedor antes de reencolar.

## Rotación de secretos

Rotar inmediatamente ante exposición y al cambiar responsables. En particular, debe rotarse la clave anónima que estuvo en el antiguo `scratch/test.js`; aunque sea pública, su proyecto real no debe permanecer reutilizable desde el historial. Rotar además credenciales por conector, webhook, cron, Turnstile, Gemini, Vercel, Supabase y proveedores. Validar primero staging y revocar el valor anterior después del corte.
