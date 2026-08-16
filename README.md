# PMS JCAR LABS

Sistema de gestión hotelera multi-tenant para recepción, habitaciones, huéspedes, caja, ventas, POS, limpieza, reportes y facturación electrónica.

## Stack

- React 18 y Vite 6.
- Supabase: Auth, PostgreSQL, RLS, Realtime y Edge Functions.
- TanStack Query con persistencia en IndexedDB.
- Tailwind CSS, Radix UI, GSAP y Recharts.
- PWA desplegable como SPA en Vercel.

## Requisitos

- Node.js 22.
- pnpm 9.
- Un proyecto Supabase configurado.

## Configuración local

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

Variables requeridas:

```env
VITE_SUPABASE_URL=https://<proyecto>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

No se deben incluir claves de servicio, certificados, contraseñas SOL ni secretos de pasarela en variables `VITE_*`.

## Comandos

| Comando | Propósito |
| --- | --- |
| `pnpm dev` | Servidor local |
| `pnpm lint` | Análisis estático |
| `pnpm typecheck` | Validación TypeScript |
| `pnpm build` | Bundle de producción |
| `pnpm preview` | Previsualización del bundle |
| `ANALYZE=true pnpm build` | Reporte local del bundle |

## Despliegue

El frontend requiere una reescritura SPA hacia `/`, ya configurada en `vercel.json`. Antes de desplegar:

1. Aplicar en orden las migraciones de `supabase/migrations`.
2. Desplegar las Edge Functions necesarias.
3. Configurar secretos exclusivamente en Supabase.
4. Ejecutar `pnpm lint`, `pnpm typecheck` y `pnpm build`.
5. Confirmar RLS y aislamiento entre hoteles.

La guía completa está en [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Estructura

```text
src/                  aplicación React
supabase/migrations/  evolución versionada de PostgreSQL y RLS
supabase/functions/   Edge Functions y adaptadores externos
specs/                reglas de negocio por dominio
docs/                 arquitectura, operación y despliegue
public/               activos públicos
```

## Documentación

- [Índice técnico](docs/README.md)
- [Arquitectura](specs/architecture.md)
- [Flujo de negocio](docs/FLUJO_NEGOCIO.md)
- [Sistema de diseño](docs/DESIGN_SYSTEM.md)
- [Preparación de producción](docs/DEPLOYMENT.md)
