# Matriz de remediación de auditoría — agosto 2026

Esta matriz vincula cada observación reportada con evidencia ejecutable. `CI` significa que el control queda bloqueante al subir cambios; los recorridos con proveedores reales requieren secretos y cuentas de staging.

| ID | Hallazgo | Estado | Evidencia/cambio | Prueba de cierre |
| --- | --- | --- | --- | --- |
| P0-01 | Checkout no transaccional y duplicable | Corregido | `checkout_reserva_atomic`, restricción idempotente y `useCheckout` usando un solo RPC | pgTAP de función + E2E de negocio en staging |
| P0-02 | Booking público bloqueaba inventario sin pago | Corregido | `create_public_booking_checkout` crea hold/payment y `public-booking` no inserta reserva directa | Reconstrucción DB + prueba de hold vencido |
| P1-01 | Pago tardío podía perderse al vencer hold | Corregido | Estado `paid_needs_reconciliation` y RPC administrativo auditado | Pruebas SQL de evento tardío e idempotencia |
| P1-02 | Inyección entre hoteles en mensajes AI | Corregido | FKs compuestas `(conversation_id, hotel_id)` | Prueba SQL con dos hoteles debe rechazar FK |
| P1-03 | Limpieza podía leer PII excesiva | Corregido | RLS por rol y vistas/columnas operativas mínimas | Matriz RLS multi-rol en DB local |
| P1-04 | Tokens originales expuestos en eventos/modelo | Corregido | Tokens solo hasheados; Gemini recibe acción opaca, no URL/token | Búsqueda estática + prueba de tool response |
| P1-05 | PII completa enviada a Gemini | Corregido | DTO mínimo y redacción de historial/resultados | Unit test de redacción + inspección de payload |
| P1-06 | Secreto global de conectores | Corregido | Credencial por conexión, HMAC con timestamp/nonce y replay protection | Pruebas de firma incorrecta, nonce repetido y tenant cruzado |
| P1-07 | Mensajes salientes quedaban en `processing` | Corregido | Lease, ACK/NACK, backoff, requeue y dead letter | Pruebas SQL de lease vencido y máximo de intentos |
| P1-08 | Pre-check-in no atómico | Corregido | `public-checkin` concentra consulta/consumo en RPC; UI ya no usa `guest-portal` | Pruebas concurrentes con token de un solo uso |
| P1-09 | Enumeración pública de DNI/RUC | Corregido | Booking fail-closed con Turnstile, rate limit y challenge ligado al flujo | 400/429 sin challenge; staging Turnstile válido |
| P1-10 | Pago automático anunciado sin adaptador | Corregido de forma segura | Capacidad permanece deshabilitada/fail-closed hasta configurar proveedor real | `501/503` esperado sin proveedor y UI no promete confirmación |
| P1-11 | Recepción calculaba disponibilidad/precio en cliente | Corregido | Servicio usa `ai_search_availability_v2` y cotización del servidor | Prueba de reserva futura + hold + tarifa dinámica |
| P1-12 | Handoff humano incompleto | Corregido | Respuesta humana, toma y devolución de control implementadas | Smoke de tomar, responder y liberar |
| F-01 | Booking descartaba enlaces | Corregido | UI conserva respuesta del checkout y presenta siguiente acción | E2E de booking staging |
| F-02 | Ruta `/checkin/:token` inexistente | Corregido | Generadores usan `/public-checkin/:token` | Búsqueda estática + smoke de ruta |
| F-03 | Config AI quedaba obsoleta al cambiar hotel | Corregido | Campos controlados y reset por `hotelId/config` | Prueba de cambio multi-hotel |
| F-04 | Estancia futura podía activarse | Corregido | Regla de servidor y UI impiden check-in fuera de ventana | Prueba SQL/servicio con fecha futura |
| F-05 | Pasaporte y CE rechazados por validador numérico | Corregido | Validador central por tipo admite formatos alfanuméricos permitidos | Pruebas parametrizadas DNI/CE/pasaporte |
| F-06 | Errores AI aparecían como cero/vacío | Corregido | Estados de error explícitos en dashboard, listas y conocimiento | Prueba de query rechazada |
| F-07 | Tokens, PII y conversaciones globales en IndexedDB | Corregido | Persistencia allowlist por identidad, purga de sesión y mutaciones offline fail-closed sin replay | Test de query persister, mutación offline rechazada y logout |
| F-08 | Chat recuperaba sesión pero no historial | Corregido | Bootstrap/historial seguro de la conversación | Smoke de recarga de sesión |
| Q-01 | No existían pruebas automatizadas | Corregido | Vitest, cobertura, pgTAP y Playwright incluidos | `pnpm test:coverage`, `pnpm test:e2e`, `supabase test db` |
| Q-02 | Typecheck ignoraba la mayoría de JS | Corregido | `typecheck:js` cubre todo `src/**/*.js` y `src/**/*.jsx`, sin `@ts-nocheck`, `@ts-ignore` ni `@ts-expect-error` | `pnpm typecheck:js` y búsqueda de supresiones en CI |
| Q-03 | CI no validaba Edge/migraciones/RLS/E2E | Corregido | Jobs separados `edge`, `database`, `browser` | Quality Gate de GitHub |
| Q-04 | No existía `supabase/config.toml` | Corregido | Config reproducible y `verify_jwt` explícito por función | `supabase start` + deploy staging |
| Q-05 | Auditoría inmutable caía a localStorage | Corregido | Auditoría append-only de servidor; fallback sensible eliminado del camino crítico | Intentos UPDATE/DELETE deben fallar |
| Q-06 | Proveedores sin timeout/backoff/circuit breaker | Corregido | Runtime compartido aplicado a Gemini, identidad, SUNAT y webhooks | Unit/integration tests de timeout y 5xx |
| Q-06B | Emisión SUNAT sin cola idempotente | Corregido | `facturacion` firma/encola con 202; `facturacion-worker` usa claim/lease/ACK/NACK/backoff | Prueba de timeout, lease vencido y reintento sin doble envío |
| Q-07 | Sin observabilidad estructurada/correlación | Corregido | Logger JSON redactado, correlation ID, release y ErrorBoundary/global handlers | Unit test de redacción e inspección de evento |
| O-01 | Despliegue manual no reproducible | Corregido | `promote.yml` promueve un ref inmutable a Environment staging/production | Dry run staging y aprobación de Environment |
| O-02 | Vercel sin headers/CSP/cache | Corregido | `vercel.json` con CSP, HSTS, permisos y cache de assets/SW | `curl -I` en preview |
| O-03 | PWA con icono incorrecto/auto-update riesgoso | Corregido | Iconos SVG any/maskable, `lang=es-PE`, precache y actualización con confirmación | Lighthouse + prueba de nueva versión |
| O-04 | Sin retención, RPO/RTO, crons ni runbooks | Corregido documental/operativo | `OPERATIONS_RUNBOOK.md` define ventanas, schedules, restore e incidentes | Restore drill y monitor de cron por entorno |
| S-01 | Supply chain sin mantenimiento/pines | Corregido | Actions por SHA, lock frozen, Dependabot y audit | CI + PR semanal Dependabot |
| S-02 | URL/JWT Supabase real y patrón service-role Vite | Corregido en código; rotación requerida | Eliminados `scratch/test.js` y `check.mjs`; escáner bloqueante | `pnpm check:secrets` y revocación en Supabase |
| S-03 | Sesiones del chat no eran revocables | Corregido | Sesiones opacas, hasheadas, expirables y revocables en servidor; se eliminó el secreto de sesión global | Pruebas SQL de expiración/revocación y bootstrap inválido |
| S-04 | Evidencia manual de pago podía autoconfirmarse | Corregido | Carga privada, hash, usuario/canal remitente y revisión separada por personal autorizado | Prueba SQL: remitente no verifica su propia evidencia; URL firmada temporal |
| S-05 | Credenciales de canales se guardaban desde el navegador | Corregido | RPC privilegiado para metadatos y provisión server-side cifrada; DML directo revocado | Prueba RLS/RPC multi-hotel y secreto visible una sola vez |
| F-09 | Enlaces de huésped se persistían o emitían antes del pago | Corregido | Emisión JIT autenticada, token hasheado de un uso y ausencia de enlace en reservas pendientes | Prueba SQL y smoke de reserva confirmada/pendiente |
| F-10 | Eliminación masiva desde interfaz sin gobernanza | Corregido | Zona peligrosa sustituida por aviso operativo; no existe mutación destructiva masiva desde el cliente | Búsqueda estática y control administrativo server-side |

## Evidencia obligatoria antes de declarar producción

1. Quality Gate verde sobre el commit exacto.
2. `supabase db push --dry-run` y pruebas RLS con dos hoteles en staging.
3. Turnstile, crons, alertas y credenciales por conexión configurados en staging.
4. Restore drill dentro de RPO/RTO y backup productivo reciente.
5. Smoke de reserva/pago/handoff/pre-check-in con cuentas sandbox reales.
6. Aprobación manual del GitHub Environment `production`.

La rotación del antiguo JWT anónimo y la configuración de servicios externos no pueden demostrarse desde Git; son tareas operativas obligatorias registradas en el runbook.
