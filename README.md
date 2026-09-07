# PMS JCAR LABS

PMS hotelero multi-tenant para gestionar recepción, habitaciones, huéspedes,
limpieza, ventas, POS, caja, inventario, reportes, revenue y configuración de
propiedades.

**Versión del proyecto:** 3.2.0 **Documentación actualizada:** 7 de septiembre
de 2026 **Rama productiva:** `main`

## Capacidades

- Operación de reservas, check-in, estadía y checkout.
- Estados centralizados de habitación: disponible, reservada, ocupada, limpieza
  y mantenimiento.
- Ventas del hotel y punto de venta con múltiples medios de pago.
- Caja, egresos, arqueo y cierre de turno.
- Limpieza e inventario de suministros.
- **Facturación electrónica SUNAT (SOAP directo):** Generación y firmado XML UBL
  2.1 con certificado ICP, emisión de Facturas (01), Boletas (03), Notas de
  Crédito (07) y Notas de Débito (08), con parseo del CDR, series configurables
  y detalle por líneas.
- **Inteligencia Artificial (AI Gateway):** Asistente conversacional
  multi-proveedor (Qwen vía DashScope o Gemini 2.0) con _Tool Calling_ y base de
  conocimiento dinámica.
- **Channel Manager (OTA Sync):** Sincronización bidireccional de inventario y
  tarifas con Agencias de Viajes Online (OTAs).
- **Pasarela de Pagos y Portales:** Portal del huésped, Booking Engine
  integrado, Pre-Checkin y webhooks de validación de pagos.
- **Integraciones:** Notificaciones vía WhatsApp y exportación a
  DIRCETUR/MINCETUR.
- Administración multi-hotel con aislamiento estricto por `hotel_id`.
- Interfaz PWA responsiva con modos claro y oscuro.

## Roles

| Rol             | Alcance principal                                                |
| --------------- | ---------------------------------------------------------------- |
| `developer`     | Administración global y acceso a todos los módulos               |
| `admin`         | Gestión integral de las propiedades autorizadas                  |
| `recepcionista` | Recepción, huéspedes, habitaciones, ventas, POS, caja y reportes |
| `limpieza`      | Habitaciones y tareas de housekeeping                            |

La matriz ejecutable de permisos vive en
[`src/constants/permissions.ts`](src/constants/permissions.ts). Las
restricciones del frontend mejoran la experiencia, pero la autorización efectiva
depende de PostgreSQL RLS y de las Edge Functions.

## Tecnología

- React 18, React Router y Vite 6.
- Supabase Auth, PostgreSQL, RLS, Realtime y 15+ Edge Functions.
- TanStack Query con persistencia selectiva en IndexedDB.
- Tailwind CSS, Radix UI, Manrope, Lucide, `@gsap/react` y Recharts.
- Web Workers nativos para generación asíncrona de reportes y tickets PDF
  (`jsPDF`).
- Deno 2.x, `xml-crypto` y `node-forge` para firmado criptográfico de
  Facturación SUNAT.
- LLM multi-proveedor (Qwen vía DashScope y Google Gemini 2.0) para Inteligencia
  Artificial y Function Calling.
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
VITE_TURNSTILE_SITE_KEY=<turnstile-site-key>
```

No se deben exponer mediante `VITE_*` claves `service_role`, contraseñas SOL,
certificados, secretos de pasarela ni credenciales de proveedores.

## Comandos

| Comando                   | Propósito                                                  |
| ------------------------- | ---------------------------------------------------------- |
| `pnpm dev`                | Iniciar el servidor local                                  |
| `pnpm lint`               | Ejecutar ESLint sobre `src` sin aceptar advertencias       |
| `pnpm typecheck`          | Validar TypeScript sin generar archivos                    |
| `pnpm typecheck:js`       | Validar la línea base JavaScript compartida                |
| `pnpm test:coverage`      | Ejecutar unitarias con umbrales de cobertura               |
| `pnpm test:e2e`           | Ejecutar smoke tests de escritorio y móvil                 |
| `pnpm check:edge`         | Validar todas las Edge Functions con Deno y lock congelado |
| `pnpm check:migrations`   | Verificar higiene y orden de migraciones                   |
| `pnpm check:secrets`      | Bloquear secretos y configuraciones peligrosas             |
| `pnpm build`              | Generar el bundle de producción en `dist/`                 |
| `pnpm preview`            | Servir localmente el bundle compilado                      |
| `ANALYZE=true pnpm build` | Generar `bundle-report.html` para análisis local           |

El workflow [`Production Quality Gate`](.github/workflows/deploy.yml) ejecuta
instalación reproducible, lint, typecheck, auditoría de dependencias y build en
cada push o pull request hacia `main` o `master`. El workflow valida y publica
el artefacto `dist`; no despliega automáticamente el sitio.

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
- [Runbook operativo](docs/OPERATIONS_RUNBOOK.md)
- [Especificaciones de dominio](specs/)

## Seguridad

- No confirmar archivos `.env` ni credenciales.
- No usar `service_role` en el navegador.
- No editar migraciones que ya hayan sido aplicadas.
- Toda consulta operativa debe conservar el contexto de `hotel_id`.
- Una ruta pública nunca debe depender de una consulta anónima directa a tablas
  sensibles.
- Ante un cambio de identidad, se purgan caché persistida y colas offline del
  usuario anterior.
