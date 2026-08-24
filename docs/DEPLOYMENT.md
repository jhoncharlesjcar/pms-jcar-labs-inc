# Despliegue a producción

**Última revisión:** 16 de agosto de 2026
**Frontend:** SPA/PWA en Vercel
**Backend:** Supabase PostgreSQL, Auth y Edge Functions

## 1. Responsabilidades del pipeline

El workflow `.github/workflows/deploy.yml`, llamado **Production Quality Gate**, se ejecuta en pushes y pull requests hacia `main` o `master`.

Valida:

1. instalación con lockfile;
2. ESLint;
3. TypeScript;
4. dependencias con vulnerabilidades de nivel alto;
5. build de Vite;
6. carga del artefacto `dist`.

El workflow no publica automáticamente en Vercel ni aplica cambios en Supabase. La promoción a producción sigue siendo una acción controlada.

Variables requeridas en GitHub Actions:

- `VITE_SUPABASE_URL`;
- `VITE_SUPABASE_ANON_KEY`.

## 2. Requisitos

- Node.js 22 y pnpm 9.
- Supabase CLI autenticado.
- Proyectos Supabase separados para staging y producción.
- Acceso al proyecto Vercel.
- Backup reciente y restauración verificada antes de cambios de esquema.
- Secretos de Edge Functions disponibles fuera del repositorio.

## 3. Validación local

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm build
```

El único directorio publicable del frontend es `dist/`. Los reportes de bundle y archivos `.env` permanecen locales.

## 4. Base de datos

`supabase/migrations/` contiene 13 migraciones ordenadas cronológicamente a la fecha de esta revisión. Esa carpeta es la fuente de verdad del esquema y de RLS.

```bash
supabase link --project-ref <staging-ref>
supabase db push --dry-run
supabase db push
```

Procedimiento:

1. Ejecutar primero contra staging.
2. Revisar el plan y cualquier operación destructiva.
3. Validar las rutas y roles descritos en el smoke check.
4. Crear un backup de producción.
5. Cambiar el vínculo al proyecto productivo y repetir el dry run.
6. Aplicar las migraciones en orden.

Controles mínimos:

- `usuarios.activo` y `hoteles.activo`;
- aislamiento RLS de hoteles, habitaciones, reservas, ventas y caja;
- acceso administrativo limitado al tenant correspondiente;
- funciones públicas sin exposición directa de tablas sensibles;
- esquema privado para credenciales por hotel;
- transiciones de habitación y reserva.

Nunca ejecutar `supabase db reset --linked` en producción ni modificar una migración ya aplicada.

## 5. Edge Functions

Funciones disponibles:

```text
configure-hotel-secrets
ai-gateway
expire-ai-booking-artifacts
expire-loyalty-points
facturacion
generate-payment
guest-portal
identity
invite-user
ota-sync-inventory
ota-sync-rates
public-booking
public-checkin
validate-gateway
webhook-gateway
```

Desplegar solamente las funciones utilizadas en el entorno. Las operaciones autenticadas comparten `supabase/functions/_shared/auth-middleware.ts`.

Configurar con `supabase secrets set`, según los módulos habilitados:

- URL de redirección de invitaciones;
- credenciales de identidad;
- claves y certificados de facturación;
- credenciales de pagos;
- credenciales OTA;
- secretos para validar webhooks.
- `AI_SESSION_SECRET` para firmar sesiones del chat público;
- `CHANNEL_GATEWAY_SECRET` para autenticar los conectores normalizados de WhatsApp, Instagram y Facebook;
- `CRON_SECRET` para ejecutar la expiración programada de cotizaciones, holds y pagos.

Las claves privadas, `service_role`, contraseñas SOL y certificados nunca deben ser variables `VITE_*`. Pagos y OTA deben permanecer deshabilitados si no existe un proveedor real configurado.

## 6. Frontend en Vercel

`vercel.json` reescribe todas las rutas hacia `/` para que React Router resuelva la SPA.

| Ajuste | Valor |
| --- | --- |
| Framework | Vite |
| Node.js | 22 |
| Install command | `pnpm install --frozen-lockfile` |
| Build command | `pnpm build` |
| Output directory | `dist` |

Variables de Vercel:

- `VITE_SUPABASE_URL`;
- `VITE_SUPABASE_ANON_KEY`.

La URL de Supabase debe corresponder al mismo entorno cuyas migraciones y funciones se desplegaron.

## 7. Orden de promoción

1. Quality gate local.
2. Migraciones en staging.
3. Edge Functions y secretos en staging.
4. Smoke check de staging.
5. Backup de producción.
6. Migraciones de producción.
7. Edge Functions y secretos de producción.
8. Publicación de `dist/`.
9. Smoke check productivo.
10. Monitoreo reforzado después del despliegue.

## 8. Smoke check

### Identidad y permisos

- Login y logout con limpieza de caché.
- Usuario inactivo sin acceso.
- Redirección inicial de admin, recepcionista y limpieza.
- Bloqueo de rutas no autorizadas.

### Multi-tenant

- Cambio de propiedad para developer o usuario multi-hotel.
- Ausencia de datos cruzados entre dos hoteles.
- Alta, edición, activación y desactivación de hotel.
- Invitación de personal al hotel correcto.

### Operación

- Crear y editar una habitación.
- Crear reserva y completar check-in.
- Registrar una venta y un movimiento de caja.
- Ejecutar checkout y confirmar transición a limpieza.
- Completar limpieza y liberar la habitación.
- Generar ticket interno y comprobar el estado fiscal.

### Rutas públicas y PWA

- Booking público para un hotel activo.
- Pre-check-in y portal con token válido, vencido e inválido.
- Navegación directa a una ruta interna.
- Instalación, recarga y actualización de la PWA.
- Confirmación de que respuestas autenticadas de Supabase no quedan en el Service Worker.

## 9. Observabilidad y reversión

Monitorear:

- errores de Edge Functions;
- respuestas 401/403 y rechazos RLS;
- errores PostgREST;
- colas offline y dead letters;
- comprobantes pendientes o rechazados;
- fallos de Realtime;
- errores del navegador.

Ante un incidente:

1. detener la integración o ruta pública afectada;
2. rotar secretos o revocar tokens si existe riesgo de exposición;
3. restaurar el frontend o la Edge Function anterior;
4. corregir el esquema mediante una migración nueva;
5. restaurar un backup solamente cuando la reversión lógica no sea suficiente y el alcance esté aprobado;
6. documentar causa, impacto y validación posterior.
