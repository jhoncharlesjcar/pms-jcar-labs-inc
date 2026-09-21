# Despliegue reproducible

**Última revisión:** 21 de septiembre de 2026 (v3.3.0)
**Frontend:** Vercel SPA/PWA
**Backend:** Supabase PostgreSQL, Auth y Edge Functions

## Quality Gate y Workflows de CI/CD

El proyecto cuenta con dos flujos automatizados en GitHub Actions:

1. **`.github/workflows/deploy.yml` (Production Quality Gate):**
   Se ejecuta en cada push o pull request hacia `main` o `master`, asegurando:
   - Instalación reproducible con `pnpm --frozen-lockfile` (Node 22 / pnpm 9).
   - Verificación de código estático: `pnpm lint` (`--max-warnings=0`), `pnpm typecheck` y `pnpm typecheck:js`.
   - Seguridad y compliance: `pnpm check:secrets` (escaneo preventivo de secretos) y `pnpm check:migrations` (orden e higiene de 42 migraciones).
   - Edge Functions & Deno: `pnpm check:edge` (compilación y suite de pruebas nativas con Deno 2.x).
   - Suite de pruebas: `pnpm test` (132 pruebas unitarias) y E2E Playwright (Chromium instalado en CI con `playwright install --with-deps chromium`).
   - Build de producción y PWA service worker generation.

2. **`.github/workflows/staging-migrations.yml` (Staging Migrations Pipeline):**
   Valida y aplica de forma idempotente las migraciones en el entorno de staging tras verificar la existencia de secretos de proyecto (`SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`).

Validación local sin Docker:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm typecheck:js
pnpm test:coverage
pnpm check:edge
pnpm check:migrations
pnpm check:secrets
pnpm build
```

Validación local completa con Docker:

```bash
pnpm exec supabase start
pnpm exec supabase db reset --local
pnpm exec supabase test db
pnpm exec supabase db lint --local --level warning
pnpm test:e2e:install
pnpm test:e2e
pnpm exec supabase stop --no-backup
```

## Entornos y promoción

Staging y producción deben ser proyectos Supabase/Vercel separados. El workflow manual `Promote release` recibe un commit/tag inmutable y un GitHub Environment `staging` o `production`. Nunca promueve el working tree ni una rama cambiante.

Cada GitHub Environment debe contener, sin valores en el repositorio:

- `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`;
- `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.

Producción debe exigir aprobación humana y branch/tag protegido. El workflow valida el plan, aplica migraciones, despliega funciones usando `supabase/config.toml`, construye con el entorno de Vercel y publica el artefacto precompilado.

## Variables públicas

Configurar por entorno en Vercel:

- `VITE_SUPABASE_URL`;
- `VITE_SUPABASE_ANON_KEY`;
- `VITE_TURNSTILE_SITE_KEY`;
- `VITE_ENVIRONMENT` (`staging` o `production`);
- `VITE_RELEASE` (commit/tag promovido).

Ninguna variable `VITE_*` puede contener `service_role`, contraseñas, certificados, secretos de proveedor, tokens de cron ni claves HMAC.

## Secretos de Edge Functions

Configurar con `supabase secrets set` o el gestor del entorno, nunca en Git:

- `AI_PROVIDER` (`qwen` por defecto; usa `gemini` para Google);
- `QWEN_API_KEY`, `QWEN_MODEL` (def. `qwen-plus`) y `QWEN_BASE_URL` (DashScope compatible-mode);
- `GEMINI_API_KEY` y `GEMINI_MODEL` (alternativa Gemini);
- `CHANNEL_CREDENTIAL_MASTER_KEY` (32 bytes aleatorios codificados base64url) para cifrar credenciales individuales de conectores JcarAI;
- `PUBLIC_APP_URL` HTTPS para que `issue-guest-access` emita enlaces de portal/pre-check-in fuera del modelo;
- `CRON_SECRET`;
- `TURNSTILE_SECRET_KEY`;
- secretos de webhooks/proveedor de pagos;
- `SUNAT_RUC`, `SUNAT_SOL_USERNAME`, `SUNAT_SOL_PASSWORD`, `SUNAT_CERT_PEM` y `SUNAT_CERT_PRIVATE_KEY_PEM` (fallbacks globales opcionales para un único hotel).

### Credenciales SUNAT por hotel

Las credenciales SUNAT (usuario SOL, clave SOL, certificado ICP y su clave privada) se configuran **por hotel** desde la UI (Configuración → Módulo SUNAT) y se almacenan en `private.hotel_secrets` vía la Edge Function `configure-hotel-secrets`. Las variables globales anteriores solo se usan como fallback para entornos de un único hotel.

Tras desplegar, crear y monitorizar los schedules de `expire-ai-booking-artifacts` y `facturacion-worker` cada minuto, y `expire-loyalty-points` diariamente. Los tres usan `CRON_SECRET`; desplegar la función sin schedule/alerta no completa la operación.

`supabase/config.toml` mantiene `verify_jwt=true` para funciones de usuario y `false` únicamente para rutas que aplican autenticación propia: sesión pública firmada, token opaco, challenge Turnstile, HMAC de webhook o secreto de cron. Cambiar ese archivo requiere revisión de seguridad.

### Contrato de conectores JcarAI

Cada conexión obtiene un `key-id` y un secreto individual una sola vez mediante la acción administrativa de aprovisionamiento. Toda llamada del conector a `ai-gateway` envía:

- `X-Jcar-Key-Id`;
- `X-Jcar-Timestamp`: tiempo Unix en segundos dentro de la ventana admitida;
- `X-Jcar-Nonce`: valor aleatorio no reutilizable;
- `X-Jcar-Signature`: HMAC-SHA256 base64url de `timestamp.nonce.rawBody` con el secreto de esa conexión.

El cuerpo debe firmarse byte por byte antes de enviarlo; reserializar JSON cambia la firma. `channel_healthcheck`, recepción de mensajes y acciones de cola (`pull_outbound`, `ack_outbound`, `nack_outbound`) usan la misma firma. ACK/NACK exige el mismo `worker_id` propietario del lease. Un timestamp vencido, nonce repetido, firma incorrecta o conexión de otro hotel debe fallar cerrado.

## Orden de despliegue

1. Quality Gate verde sobre el ref exacto.
2. Backup y restore drill vigente.
3. Promover a staging.
4. Configurar secretos, Turnstile, credenciales por canal y crons de staging.
5. Ejecutar recorridos multi-tenant, reserva, pago sandbox, reconciliación, pre-check-in y handoff.
6. Revisar CSP, headers, PWA y telemetría redactada en preview.
7. Aprobar GitHub Environment de producción.
8. Promover el mismo ref a producción.
9. Ejecutar smoke productivo sin cobro real y monitorizar errores, leases, DLQ y crons.

Las migraciones aplicadas no se editan. Nunca ejecutar `supabase db reset --linked` en staging o producción.

## Vercel, CSP y PWA

`vercel.json` fija build/output, reescritura SPA, HSTS, CSP, anti-framing, Permissions Policy y cache inmutable solo para assets con hash. `sw.js` y el manifest no se cachean de forma permanente. La CSP permite Supabase y Turnstile; cualquier dominio adicional requiere revisión explícita.

La PWA usa iconos `any`/`maskable`, idioma `es-PE`, no cachea APIs y solicita confirmación antes de activar una versión nueva. Validar instalación, modo offline estático y actualización sin interrumpir checkout/caja.

## Reversión

- Frontend: volver a promover el último ref verde; no reconstruirlo con dependencias distintas.
- Edge Function: desplegar la versión anterior compatible con el esquema.
- Base: migración compensatoria revisada y probada en staging.
- Datos: restaurar backup solo con alcance aprobado cuando la compensación no sea suficiente.
- Integración: desactivar proveedor/canal y activar handoff; nunca reintentar cobros a ciegas.

El procedimiento de incidentes, RPO/RTO, retención y crons está en [OPERATIONS_RUNBOOK.md](OPERATIONS_RUNBOOK.md).
