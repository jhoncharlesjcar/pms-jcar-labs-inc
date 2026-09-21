# PMS JCAR LABS

Property Management System para hospedajes en Perú. SPA Vite + React, PostgreSQL/RLS en Supabase, facturación SUNAT y módulo JCAR AI.

[![Live](https://img.shields.io/badge/Live-Vercel-black?style=flat-square)](https://pms-jcar-labs-inc.vercel.app)
[![GitHub](https://img.shields.io/badge/GitHub-PMS--JCAR--LABS-181717?style=flat-square)](https://github.com/jhoncharlesjcar/PMS-JCAR-LABS)

**Versión documentada:** 3.3.0 (21 septiembre 2026)

---

## Qué hace

Operación diaria de un hotel multi-propiedad:

| Módulo | Ruta | Roles |
| --- | --- | --- |
| Dashboard | `/` | admin, developer |
| Recepción y reservas | `/recepcion` | admin, developer, recepcionista |
| Habitaciones | `/habitaciones` | admin, developer, recepcionista, limpieza |
| Huéspedes | `/huespedes` | admin, developer, recepcionista |
| Limpieza | `/limpieza` | admin, developer, recepcionista, limpieza |
| Ventas / tickets | `/ventas` | admin, developer, recepcionista |
| Caja (día Lima) | `/caja` | admin, developer, recepcionista |
| Punto de venta | `/pos` | admin, developer, recepcionista |
| Insumos | `/insumos` | admin, developer |
| Revenue | `/revenue` | admin, developer |
| JCAR AI | `/jcar-ai` | admin, developer |
| Reportes | `/reportes` | admin, developer, recepcionista |
| Configuración | `/configuracion` | admin, developer |

Rutas públicas: booking, check-in y portal de huésped (Edge Functions con `verify_jwt` según el contrato de cada función).

No hay API REST `/api/rooms`. El cliente habla con PostgREST (`supabase-js`), RPCs y Edge Functions.

---

## Stack

| Capa | Tecnología |
| --- | --- |
| Frontend | React 18, Vite 6, Tailwind, páginas `.jsx` + JSDoc, servicios `.ts` |
| Estado | TanStack Query, store de sesión, hotel activo |
| Backend | Supabase (PostgreSQL + RLS, Auth, Realtime, Edge Functions) |
| Fiscal | UBL 2.1, XMLDSig, SOAP SUNAT (`sunat-wrapper` + `facturacion`) |
| IA | Edge Function `ai-gateway` (widget y staff). Las carpetas `ai-gateway-*` del repo no están en prod hasta que `list_edge_functions` las liste |
| CI | GitHub Actions `deploy.yml` (lint, typecheck, typecheck:js, tests, Playwright Chromium, build) |
| Hosting | Vercel (SPA/PWA) |

---

## Arranque local

Requisitos: Node 22+, pnpm 9.15.9. En Windows, si el shim de Corepack falla:

```bash
git clone https://github.com/jhoncharlesjcar/PMS-JCAR-LABS.git
cd "PMS JCAR LABS"
npm exec pnpm@9.15.9 install --frozen-lockfile
cp .env.example .env.local
npm exec pnpm@9.15.9 dev
```

App: `http://localhost:5173`

Variables públicas (nunca `service_role` en `VITE_*`):

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-or-publishable-key>
VITE_TURNSTILE_SITE_KEY=<opcional>
```

---

## Quality gate

```bash
npm exec pnpm@9.15.9 run lint
npm exec pnpm@9.15.9 run typecheck
npm exec pnpm@9.15.9 run typecheck:js
npm exec pnpm@9.15.9 run test
npm exec pnpm@9.15.9 run build
```

En CI también: `check:ts-suppressions`, `check:secrets`, `check:migrations`, `check:edge`, `playwright install --with-deps chromium`, `test:e2e`.

Tests unitarios actuales: **132** (Vitest node). No importar `dompurify` en unit tests.

---

## Producción — operación

Zona horaria de caja, dashboard “hoy” y fechas de recepción: **America/Lima** (`src/lib/limaDate.ts` → `hoyLima()`).

### Hoteles de prueba

| Hotel | UUID | Contenido |
| --- | --- | --- |
| HOSPEDAJE ANGELICA FREY | `11111111-1111-1111-1111-111111111111` | Seed histórico (habitaciones, reservas, POS) |
| PMS JCAR LABS | `6dbaf2c2-e294-460a-87f0-26e914a10a5d` | Seed operativo (10 hab, reservas de hoy, catálogo POS) |

El selector del header muestra el **nombre** de la propiedad. Si un hotel no tiene habitaciones, `HotelOperationalBanner` ofrece cambiar de propiedad. No se cambia el hotel en silencio.

Caja solo lista el **día civil Lima**. Reservas de meses pasados no aparecen ahí; en Recepción el filtro por defecto es **Todas**.

### RPCs de staff vs IA

- Recepción consulta `staff_search_availability` (SECURITY DEFINER, rol + hotel).
- Esa función llama `ai_search_availability_v2`, que **no** tiene `EXECUTE` para `authenticated`.
- Un 403 `permission denied for function ai_search_availability_v2` no es “sin cupo”: es GRANT/INVOKER mal puesto.

`listHoteles()` no usa `select('*')` (columnas bytea de secretos rompen PostgREST y filtran credenciales).

Funciones que devuelven secretos (`get_sunat_encryption_key`) solo `service_role`.

---

## Estructura

```
src/
  api/           entidades, cache, offline, auth (capa síncrona db.forHotel)
  components/    UI compartida, POS, layout
  pages/         módulos (.jsx + JSDoc)
  services/      reglas puras (.ts)
  lib/           limaDate, logger, sync-queue
supabase/
  migrations/    esquema, RLS, seeds idempotentes
  functions/     facturacion, ai-gateway, public-booking, …
sunat-wrapper/   microservicio SOAP/UBL
docs/            operación, diseño, despliegue
specs/           contratos de dominio
tests/unit/      Vitest
tests/e2e/       Playwright
```

---

## Documentación

| Documento | Uso |
| --- | --- |
| [Índice](docs/README.md) | Mapa de docs |
| [Producción](docs/PRODUCTION.md) | Estado live, incidentes frecuentes |
| [Changelog](docs/CHANGELOG.md) | Historial |
| [Flujo de negocio](docs/FLUJO_NEGOCIO.md) | Reserva → caja |
| [Despliegue](docs/DEPLOYMENT.md) | CI, Vercel, migraciones |
| [Runbook](docs/OPERATIONS_RUNBOOK.md) | Backups, crons, incidentes |
| [Arquitectura](specs/architecture.md) | Capas y seguridad |
| [Contribuir](CONTRIBUTING.md) | Ramas, commits, gates |

---

## Seguridad

- No commitear `.env` ni `service_role`.
- No editar migraciones ya aplicadas; crear otra.
- Toda query de negocio filtra `hotel_id` (RLS + RPC).
- Prevent leaked passwords de Supabase Auth es feature **Pro**; no se habilita en este plan.

---

## Licencia

Uso interno JCAR Labs. Consultar al autor antes de redistribuir.

**Jhon Charles Almanacén Romero** — [GitHub](https://github.com/jhoncharlesjcar)
