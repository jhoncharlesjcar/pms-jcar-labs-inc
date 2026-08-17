# PMS JCAR LABS

PMS hotelero multi-tenant para gestionar recepción, habitaciones, huéspedes, limpieza, ventas, POS, caja, inventario, reportes, revenue y configuración de propiedades.

**Versión del proyecto:** 1.0.1
**Documentación actualizada:** 16 de agosto de 2026
**Rama productiva:** `main`

## Capacidades

- Operación de reservas, check-in, estadía y checkout.
- Estados centralizados de habitación: disponible, reservada, ocupada, limpieza y mantenimiento.
- Ventas del hotel y punto de venta con múltiples medios de pago.
- Caja, egresos, arqueo y cierre de turno.
- Limpieza e inventario de suministros.
- Comprobantes internos y flujo de facturación electrónica.
- Booking, pre-check-in y portal del huésped mediante rutas públicas controladas.
- Administración multi-hotel con aislamiento por `hotel_id`.
- Interfaz PWA responsiva con modos claro y oscuro.

## Roles

| Rol | Alcance principal |
| --- | --- |
| `developer` | Administración global y acceso a todos los módulos |
| `admin` | Gestión integral de las propiedades autorizadas |
| `recepcionista` | Recepción, huéspedes, habitaciones, ventas, POS, caja y reportes |
| `limpieza` | Habitaciones y tareas de housekeeping |

La matriz ejecutable de permisos vive en [`src/constants/permissions.ts`](src/constants/permissions.ts). Las restricciones del frontend mejoran la experiencia, pero la autorización efectiva depende de PostgreSQL RLS y de las Edge Functions.

## Tecnología

- React 18, React Router y Vite 6.
- Supabase Auth, PostgreSQL, RLS, Realtime y Edge Functions.
- TanStack Query con persistencia selectiva en IndexedDB.
- Tailwind CSS, Radix UI, Manrope, Lucide, `@gsap/react` y Recharts.
- Web Workers nativos para generación asíncrona de reportes y tickets PDF (`jsPDF`).
- PWA con actualización automática mediante Workbox.
- pnpm 9 y Node.js 22.

## Inicio local

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

En PowerShell:

```powershell
Copy-Item .env.example .env.local
pnpm dev
```

Variables públicas requeridas:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

No se deben exponer mediante `VITE_*` claves `service_role`, contraseñas SOL, certificados, secretos de pasarela ni credenciales de proveedores.

## Comandos

| Comando | Propósito |
| --- | --- |
| `pnpm dev` | Iniciar el servidor local |
| `pnpm lint` | Ejecutar ESLint sobre `src` sin aceptar advertencias |
| `pnpm typecheck` | Validar TypeScript sin generar archivos |
| `pnpm build` | Generar el bundle de producción en `dist/` |
| `pnpm preview` | Servir localmente el bundle compilado |
| `ANALYZE=true pnpm build` | Generar `bundle-report.html` para análisis local |

El workflow [`Production Quality Gate`](.github/workflows/deploy.yml) ejecuta instalación reproducible, lint, typecheck, auditoría de dependencias y build en cada push o pull request hacia `main` o `master`. El workflow valida y publica el artefacto `dist`; no despliega automáticamente el sitio.

## Estructura

```text
src/
  api/                 acceso a datos y ámbito multi-tenant
  components/          componentes compartidos y de negocio
  constants/           permisos y estados operativos
  contexts/            autenticación y propiedad activa
  hooks/               consultas y orquestación de interfaz
  pages/               módulos y rutas de la aplicación
  services/            lógica de negocio reutilizable
  store/               estado de sesión y hotel activo
supabase/
  functions/           operaciones privilegiadas e integraciones
  migrations/          esquema, políticas RLS y evolución de datos
docs/                  operación, diseño y despliegue
specs/                 contratos de dominio
public/                activos estáticos
```

## Despliegue

1. Validar en staging las migraciones de `supabase/migrations`.
2. Desplegar las Edge Functions requeridas y configurar sus secretos.
3. Ejecutar `pnpm lint`, `pnpm typecheck` y `pnpm build`.
4. Publicar `dist/` como SPA con reescritura hacia `/`.
5. Ejecutar el smoke check multi-rol y multi-hotel.

La guía operativa completa está en [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Documentación

- [Índice de documentación](docs/README.md)
- [Historial de Cambios (Changelog)](docs/CHANGELOG.md)
- [Arquitectura](specs/architecture.md)
- [Flujo de negocio](docs/FLUJO_NEGOCIO.md)
- [Sistema de diseño](docs/DESIGN_SYSTEM.md)
- [Despliegue](docs/DEPLOYMENT.md)
- [Especificaciones de dominio](specs/)

## Seguridad

- No confirmar archivos `.env` ni credenciales.
- No usar `service_role` en el navegador.
- No editar migraciones que ya hayan sido aplicadas.
- Toda consulta operativa debe conservar el contexto de `hotel_id`.
- Una ruta pública nunca debe depender de una consulta anónima directa a tablas sensibles.
- Ante un cambio de identidad, se purgan caché persistida y colas offline del usuario anterior.
