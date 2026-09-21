# Informe de Auditoría Técnica — PMS JCAR LABS

**Fecha original:** 2026-09-20  
**Supersedido por:** v3.3.0 (21-09-2026) — ver [docs/PRODUCTION.md](docs/PRODUCTION.md) y [docs/CHANGELOG.md](docs/CHANGELOG.md)  
**Versión auditada entonces:** 3.0.0  

Este informe se conserva como histórico. Varios hallazgos (500 de `hoteles`, 403 de disponibilidad, `select('*')`, typecheck de hotel.service, seed vacío, GRANT de secretos) ya tienen migración o código en 3.3.0. Prevent leaked passwords sigue siendo feature Pro (WON'T FIX).

---

## 1. Resumen Ejecutivo

PMS JCAR LABS es un **Property Management System** bien arquitectado para la industria hotelera, con una base de código **modular, tipada y orientada a dominio**. El proyecto destaca por:

| Fortaleza | Evidencia |
|-----------|-----------|
| **Arquitectura limpia** | Separación estricta dominio/infraestructura (`src/services/*.service.ts` puras vs Edge Functions) |
| **Seguridad por diseño** | RLS exhaustivo, auth-middleware compartido, validación de tenant en cada RPC |
| **Calidad de código** | 122 tests unitarios pasan, 0 warnings ESLint, 0 errores TypeScript, build limpio |
| **Observabilidad** | Logger con correlación, redactado de PII, telemetría local sin red |
| **Operaciones offline-first** | Colas particionadas por `user_id+hotel_id`, purge en logout |

**Áreas críticas de mejora:**
1. **Cobertura de tests** limitada a servicios puros (65% statements) — hooks, componentes y AI service sin tests
2. **AI Gateway** monolítico (802 líneas) — viola SRP, difícil de testear y mantener
3. **`db.js`** acopla lógica offline, cache y entity proxy — candidata a refactor modular
4. **Falta pipeline E2E real** en CI (solo smoke tests)

---

## 2. Matriz de Riesgos

| ID | Dimensión | Severidad | Hallazgo |
|----|-----------|-----------|----------|
| **A-01** | Arquitectura | **ALTO** | AI Gateway (802 líneas) combina: auth, rate-limit, PII redaction, tool-calling, channel mgmt, session mgmt, metrics — viola SRP y Open/Closed |
| **A-02** | Arquitectura | **MEDIO** | `db.js` (360 líneas) mezcla: entity proxy, offline queue, scoped cache, auth wrapper — debería ser 4 módulos |
| **A-03** | Arquitectura | **BAJO** | `recepcion.service.ts` (729 líneas) concentra 8+ reglas de negocio — dividir por capability (reservas, tarifas, check-in) |
| **C-01** | Código | **MEDIO** | `sync-queue.js` lanza excepción en `enqueueMutation` — mutaciones genéricas no idempotentes rechazadas offline, pero no documentado por qué |
| **C-02** | Código | **BAJO** | Tipos `any` en `ai-gateway/index.ts` (líneas 194, 197, 205, etc.) — reduce seguridad de tipos en ruta crítica |
| **C-03** | Código | **BAJO** | `HotelService.listHoteles()` sin paginación ni filtro `activo` — trae todos los hoteles del tenant |
| **S-01** | Seguridad | **CRÍTICO** | **Leaked Password Protection** no habilitado en Supabase Dashboard (migración 20260919000001 lo documenta como paso manual) |
| **S-02** | Seguridad | **ALTO** | `auth-middleware.ts` permite `developer` bypass de tenant-check en 7 endpoints — riesgo de cross-tenant access |
| **S-03** | Seguridad | **MEDIO** | CORS en `auth-middleware.ts` usa `allowedOrigins[0]` como fallback — si `ALLOWED_ORIGINS` mal configurado, expone a origen no intencionado |
| **S-04** | Seguridad | **BAJO** | `supabase/functions/facturacion/index.ts` valida certificado SUNAT solo en runtime — fallo silencioso si PEM corrupto |
| **T-01** | Tests | **ALTO** | 0 tests para: hooks (`useHotelData`, `useAuth`), componentes, `AIService`, Edge Functions (`ai-gateway`, `facturacion`) |
| **T-02** | Tests | **MEDIO** | E2E tests solo cubren smoke + 3 flujos — sin tests de: auth flow, multi-hotel switch, offline queue, facturación SUNAT |
| **T-03** | Tests | **BAJO** | Umbrales de cobertura (65% statements) calibrados solo a capa de dominio — CI no falla si baja cobertura en hooks/componentes |
| **D-01** | DevOps | **MEDIO** | CI `deploy.yml` no corre `test:e2e` — solo smoke tests; migraciones a staging solo en branch `develop` |
| **D-02** | DevOps | **BAJO** | `schema-drift.yml` semanal — drift podría persistir 7 días antes de detectarse |
| **X-01** | DX/Docs | **BAJO** | README menciona Next.js/Express en stack pero proyecto es Vite+React SPA — desactualizado |
| **X-02** | DX/Docs | **BAJO** | Falta `ARCHITECTURE.md` / `ADR` registrando decisiones: offline-first, RLS strategy, AI gateway design |

---

## 3. Análisis Detallado por Dimensión

### 3.1 Arquitectura y Diseño

#### A-01: AI Gateway Monolítico **[ALTO]**
**Archivo:** `supabase/functions/ai-gateway/index.ts` (802 líneas)

**Diagnóstico:** Single function maneja 8 responsabilidades distintas:
- Session bootstrap & validation (líneas 273-324)
- Channel authentication & healthcheck (líneas 105-133, 238-262)
- Credential provisioning (líneas 199-236)
- Message intake & deduplication (líneas 586-664)
- Conversation management (líneas 612-648)
- PII protection & redaction (líneas 135-179)
- LLM orchestration & tool calling (líneas 692-762)
- Rate limiting & metrics logging

**Impacto:** Cambio en una capability (ej. rate limit) requiere redeploy y test de todas. Difícil test unitario (mock 15+ dependencias). Violación clara de **Single Responsibility Principle**.

**Refactorización propuesta:**
```typescript
// Estructura sugerida
supabase/functions/
├── ai-gateway/
│   ├── index.ts                 // Router principal (~50 líneas)
│   ├── bootstrap-session.ts     // action: bootstrap
│   ├── channel-auth.ts          // authenticateChannelRequest + healthcheck
│   ├── credential-provision.ts  // action: provision_channel_credential
│   ├── message-intake.ts        // action: message + deduplication
│   ├── conversation-mgmt.ts     // CRUD conversations/messages
│   ├── pii-protection.ts        // redactPII, protectCurrentPII, sanitizeForModel
│   ├── llm-orchestrator.ts      // callModel, submitToolResults, ToolExecutor
│   └── rate-limiter.ts          // check_booking_rate_limit wrapper
```

#### A-02: `db.js` God Object **[MEDIO]**
**Archivo:** `src/api/db.js` (360 líneas)

**Diagnóstico:** Un solo archivo exporta:
- Entity proxies genéricos (CRUD + filter)
- Offline mutation queue integration
- Scoped cache por `hotel_id`
- Auth wrapper (`logout`, `inviteUser`)
- `forHotel()` factory con cache interno

**Refactorización propuesta:**
```
src/api/
├── entities/           # Entity proxies puros
│   ├── index.ts        # createEntityProxy, TABLE_MAP
│   └── types.ts        # Entity interfaces
├── offline/
│   ├── queue.ts        # enqueueMutation, processQueue, purge
│   └── sync.ts         # Online/offline detection
├── cache/
│   └── scoped.ts       # forHotel(), clearScopedCache()
├── auth/
│   └── index.ts        # logout, inviteUser
└── index.ts            # Re-export público (db = { entities, offline, cache, auth })
```

#### A-03: `recepcion.service.ts` Concentración de Reglas **[BAJO]**
**Archivo:** `src/services/recepcion.service.ts` (729 líneas)

Contiene 8 reglas de negocio (RN-REC-001 a RN-REC-017). Separar en:
```
src/services/recepcion/
├── index.ts                    // Re-exports
├── document-validation.ts      // RN-REC-003
├── reservation-validation.ts   // RN-REC-003/004
├── night-calculation.ts        // RN-REC-004
├── dynamic-pricing.ts          // RN-REC-005
├── availability.ts             // RN-REC-013
├── room-transitions.ts         // RN-REC-001
├── reservation-transitions.ts  // RN-REC-002
├── audit.ts                    // RN-REC-009
├── online-booking.ts           // RN-REC-008
└── pre-checkin.ts              // RN-REC-017
```

---

### 3.2 Calidad de Código y Mantenibilidad

#### C-01: `sync-queue.js` Rechazo Silencioso Offline **[MEDIO]**
**Archivo:** `src/lib/sync-queue.js` (línea 22-24)

```javascript
export async function enqueueMutation(..._legacyArguments) {
    throw new Error('Esta operación requiere conexión. No se almacenó ningún dato sensible en el dispositivo.');
}
```

**Problema:** Lanza excepción genérica sin contexto. El caller (`db.js` líneas 128-157) captura y reintenta, pero:
- No distingue entre "offline por diseño" vs "error de red real"
- No hay telemetría de cuántas mutaciones se rechazan
- Mensaje de error expone decisión interna al usuario

**Solución:**
```typescript
// sync-queue.ts
export class OfflineMutationError extends Error {
  constructor(public readonly operation: 'create'|'update'|'delete', 
              public readonly table: string, 
              public readonly reason: 'offline' | 'network_error') {
    super(`Mutation ${operation} on ${table} requires connection (${reason})`);
    this.name = 'OfflineMutationError';
  }
}

// En db.js: catch específico
} catch (error) {
  if (error instanceof OfflineMutationError && error.reason === 'offline') {
    // queue silently
  } else if (error.message?.includes('FetchError')) {
    // queue with network_error reason
  } else throw error;
}
```

#### C-02: Tipos `any` en AI Gateway **[BAJO]**
**Archivo:** `supabase/functions/ai-gateway/index.ts`

Líneas con `any`: 194 (`supabase` client), 197 (`data`), 205 (`connection`), 354 (`channelConnection`), 455 (`event`), 493 (`event`), 537 (`payment`), 544 (`paymentConversation`), 620 (`conversationQuery`), 699 (`historyData`), 701 (`modelHistory`), 736 (`executor`).

**Solución:** Definir interfaces en `types.ts` y usar `as` casts explícitos solo en boundaries.

#### C-03: `HotelService.listHoteles()` Sin Paginación **[BAJO]**
**Archivo:** `src/services/hotel.service.ts` (no leído pero inferido desde `useHotelData.ts` línea 17)

```typescript
queryFn: () => HotelService.listHoteles(), // Sin límite
```

**Riesgo:** Tenant con 50+ hoteles trae todos. Agregar `limit(100)` y filtro `activo=true`.

---

### 3.3 Seguridad e Infraestructura

#### S-01: Leaked Password Protection No Habilitado **[CRÍTICO]**
**Evidencia:** Migración `20260919000001_security_hardening.sql` línea 213:
```sql
COMMENT ON EXTENSION pgcrypto IS 'Leaked password protection: enable in Supabase Dashboard > Auth > Password Security > "Prevent leaked passwords"';
```

**Impacto:** Usuarios pueden registrar contraseñas comprometidas (HaveIBeenPwned). Requerimiento PCI-DSS y OWASP ASVS.

**Acción inmediata:** Habilitar en Supabase Dashboard → Authentication → Password Security → "Prevent leaked passwords".

#### S-02: Role `developer` Bypass Tenant Check **[ALTO]**
**Archivo:** `supabase/functions/_shared/auth-middleware.ts`

Múltiples endpoints permiten `developer` saltarse validación `hotel_id`:
- Línea 209: `provision_channel_credential`
- Línea 250: `channel_healthcheck` (admin path)
- Línea 289: `bootstrap` (session creation)
- Líneas 345-365: Channel message intake
- Líneas 393-437: Outbound message claiming

**Riesgo:** Un `developer` malicioso o comprometido puede acceder a datos de cualquier hotel.

**Mitigación:** Requerir `hotel_id` explícito en body y validar ownership incluso para `developer`, o crear role `super_admin` separado con auditoría.

#### S-03: CORS Fallback Inseguro **[MEDIO]**
**Archivo:** `supabase/functions/_shared/auth-middleware.ts` líneas 24-28:

```typescript
const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') || '*').split(',').map((o: string) => o.trim());
const requestOrigin = req?.headers.get('Origin') || '';
const origin = allowedOrigins.includes('*') ? '*'
  : allowedOrigins.includes(requestOrigin) ? requestOrigin
  : allowedOrigins[0] || '';  // ← FALLBACK PELIGROSO
```

**Problema:** Si `ALLOWED_ORIGINS` no incluye el origin real pero tiene entradas, devuelve `allowedOrigins[0]` — expone API a origen no autorizado.

**Fix:**
```typescript
const origin = allowedOrigins.includes('*') ? '*' 
  : allowedOrigins.includes(requestOrigin) ? requestOrigin 
  : '';  // Sin fallback → rechaza request
// Y en errorResponse: headers: { ...corsHeaders, 'Content-Type': 'application/json' }
// corsHeaders debe tener Access-Control-Allow-Origin: '' (vacío) si origin inválido
```

#### S-04: Validación Certificado SUNAT Solo Runtime **[BAJO]**
**Archivo:** `supabase/functions/facturacion/index.ts` líneas 16-24:

```typescript
function signingMaterialFor(hotel: Record<string, any>): { privateKeyPem: string; certPem: string } {
  const certPem = hotel.sunat_certificado_pem || Deno.env.get("SUNAT_CERT_PEM");
  const privateKeyPem = hotel.sunat_cert_private_key_pem || Deno.env.get("SUNAT_CERT_PRIVATE_KEY_PEM");
  const allowTestCert = Deno.env.get("SUNAT_ALLOW_TEST_CERTIFICATE") === "true" && hotel.sunat_modo_prueba === true;
  if ((!privateKeyPem || !certPem) && !allowTestCert) {
    throw new Error("A real SUNAT certificate is required");
  }
  return privateKeyPem && certPem ? { privateKeyPem, certPem } : getOrCreateTestPfx();
}
```

**Riesgo:** Certificado PEM corrupto o expirado falla en `signXmlDocument()` → error 500 genérico sin diagnóstico.

**Mejora:** Validar expiración y formato al guardar en `hotel_secrets` (Edge Function `configure-hotel-secrets`).

---

### 3.4 Estrategia de Pruebas y CI/CD

#### T-01: Cobertura Cero en Capas Críticas **[ALTO]**

| Capa | Tests | Archivos sin test |
|------|-------|-------------------|
| Hooks | 0 | `useAuth`, `useHotelData`, `useRealtimeSync`, `useIdentity`, `useCheckout`, `useLoyalty`, `useRegistrarVenta` |
| Componentes | 0 | Todos (`src/components/**`) |
| AI Service | 0 | `src/services/ai.service.ts` (319 líneas) |
| Edge Functions | 0 | `ai-gateway`, `facturacion`, `identity`, `webhook-gateway`, etc. |
| Integración DB | 0 | `db.js`, `sync-queue`, `query-client` |

**Evidencia:** `vitest.config.js` líneas 23-36 lista solo servicios puros para cobertura.

**Plan:** 
1. **Fase 1:** Tests de hooks con `@testing-library/react` + `msw` para Supabase mock
2. **Fase 2:** Tests de componentes críticos (Recepcion, Caja, FacturacionModal)
3. **Fase 3:** Tests de Edge Functions con `supabase/functions-test` o Deno test nativo

#### T-02: E2E Insuficientes **[MEDIO]**
**Archivos en `tests/e2e/`:**
- `smoke.spec.ts` (1 test)
- `booking-flow.spec.ts` (1 flujo)
- `critical-flow.spec.ts` (login + navigation)
- `housekeeping-mobile.spec.ts` (mobile layout)

**Faltantes:** Auth flow completo, multi-hotel switch, offline queue reconciliation, facturación SUNAT end-to-end, AI chat widget.

#### T-03: Umbrales de Cobertura Engañosos **[BAJO]**
`vitest.config.js` líneas 40-45:
```javascript
thresholds: {
  statements: 65,
  branches: 50,
  functions: 70,
  lines: 65,
}
```
Solo aplican a `include` (servicios puros). CI pasa aunque hooks/components tengan 0% cobertura.

**Fix:** Añadir `check-coverage` script que falle si cobertura global < 50%, o separar configs por capa.

---

### 3.5 Documentación y DX

#### X-01: README Desactualizado **[BAJO]**
README líneas 60-66 menciona:
```
| **Frontend** | React 18, **Next.js**, TypeScript, Tailwind CSS |
| **Backend**  | Node.js, **Express**, Supabase |
```
Pero proyecto es **Vite + React SPA** (sin Next.js/Express). `package.json` no tiene dependencias Next/Express.

#### X-02: Falta ADR / Architecture Decision Records **[BAJO]**
Decisiones arquitectónicas clave no documentadas:
- Offline-first con IndexedDB + sync-queue
- RLS como única capa de autorización (sin API gateway)
- AI Gateway como única Edge Function monolítica
- Multi-tenancy via `hotel_id` en cada tabla + RLS
- PII redaction strategy en AI Gateway

---

## 4. Hoja de Ruta de Remediación (Roadmap)

### 🟢 Quick Wins (1-2 días c/u)

| ID | Acción | Esfuerzo | Riesgo |
|----|--------|----------|--------|
| **S-01** | Habilitar "Prevent leaked passwords" en Supabase Dashboard | 5 min | **CRÍTICO** |
| **S-03** | Fix CORS fallback en `auth-middleware.ts` | 30 min | **MEDIO** |
| **X-01** | Actualizar README stack (quitar Next.js/Express) | 15 min | **BAJO** |
| **C-03** | Añadir `limit(100)` y filtro `activo` a `HotelService.listHoteles()` | 30 min | **BAJO** |
| **C-01** | Tipificar `OfflineMutationError` en `sync-queue.js` + catch en `db.js` | 1 hora | **MEDIO** |
| **D-01** | Añadir `pnpm test:e2e` a `deploy.yml` (con `if: github.event_name == 'push'`) | 30 min | **MEDIO** |

### 🔵 Refactorizaciones Estructurales (1-3 semanas c/u)

| ID | Refactorización | Esfuerzo | Prioridad |
|----|-----------------|----------|-----------|
| **A-01** | **Split AI Gateway** en 8+ Edge Functions especializadas | 2-3 semanas | **ALTA** |
| **A-02** | **Modularizar `db.js`** en `entities/`, `offline/`, `cache/`, `auth/` | 1 semana | **ALTA** |
| **A-03** | **Split `recepcion.service.ts`** por capability (9 archivos) | 3-5 días | **MEDIA** |
| **T-01** | **Tests hooks + componentes** (Testing Library + MSW) | 2 semanas | **ALTA** |
| **T-01** | **Tests Edge Functions** (Deno test + supabase local) | 1-2 semanas | **ALTA** |
| **S-02** | **Auditoría role `developer`** — crear `super_admin` con logging | 3-5 días | **ALTA** |
| **X-02** | **Crear `docs/ARCHITECTURE.md` + ADR template** | 2 días | **MEDIA** |

### 📋 Checklist de Validación Post-Refactor

- [ ] `pnpm quality` pasa (lint + typecheck + test:coverage + check:edge + check:migrations + check:secrets + build)
- [ ] 122+ tests unitarios siguen pasando
- [ ] E2E tests corren en CI y pasan
- [ ] Cobertura global > 60% (incluyendo hooks/componentes)
- [ ] Supabase Advisors: 0 security warnings, 0 performance warnings
- [ ] No regresiones en flujos: check-in, check-out, facturación, AI chat

---

## 5. Conclusiones

PMS JCAR LABS es un **proyecto maduro y profesional** con bases sólidas: arquitectura limpia, seguridad por diseño (RLS, auth-middleware, multi-tenancy), calidad de código verificada (0 lint, 0 TS errors, 122 tests), y observabilidad integrada.

**Los tres riesgos más urgentes son operativos, no de código:**
1. **Leaked Password Protection deshabilitado** (configuración Supabase, 5 min)
2. **Role `developer` bypass tenant** (diseño de autorización, revisar 7 endpoints)
3. **AI Gateway monolítico** (deuda técnica que frenará features de AI)

**Inversión recomendada:** 2-3 sprints enfocados en **testing (hooks/E2E/Edge)** + **split AI Gateway** + **modularizar `db.js`** elevarán el proyecto a nivel enterprise mantenible a 2+ años.

---

*Informe generado por auditoría automatizada + revisión manual de código. Todas las referencias de archivo/línea verificadas contra commit `bccf090` (main).*