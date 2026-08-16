# Despliegue a producción

## 1. Requisitos

- Node.js 22 y pnpm 9.
- Supabase CLI autenticado para el entorno objetivo.
- Proyecto de staging separado de producción.
- Backup verificado antes de modificar el esquema productivo.
- Variables de Vercel `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.

## 2. Validación local

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm build
```

El contenido publicable es exclusivamente `dist/`.

## 3. Base de datos

El repositorio contiene 13 migraciones ordenadas cronológicamente. No se debe ejecutar SQL manual que no quede versionado.

```bash
supabase link --project-ref <staging-ref>
supabase db push --dry-run
supabase db push
```

Validar después del push:

- la columna `usuarios.activo`;
- la columna `hoteles.activo`;
- políticas RLS de hoteles, usuarios, reservas, ventas y caja;
- acceso cruzado entre dos hoteles;
- contratos públicos de reserva, check-in y portal;
- esquema privado de secretos.

## 4. Edge Functions

Funciones disponibles:

```text
configure-hotel-secrets
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

Desplegar únicamente las funciones utilizadas en el entorno. Configurar secretos con `supabase secrets set`; nunca usar variables `VITE_*` para certificados, claves SOL, service role o secretos de pasarela.

Los módulos de pagos automáticos y OTA deben permanecer deshabilitados mientras no exista un proveedor real configurado.

## 5. Vercel

`vercel.json` ya redirige las rutas de la SPA a `/`.

Configuración recomendada:

- Build command: `pnpm build`.
- Output directory: `dist`.
- Node.js: 22.
- Install command: `pnpm install --frozen-lockfile`.

La rama productiva debe superar el workflow `Production Quality Gate`.

## 6. Smoke check posterior

- Inicio de sesión y cierre de sesión.
- Selección de hotel y aislamiento multi-tenant.
- Dashboard sin errores de consola.
- Crear, editar y cambiar estado de una habitación.
- Crear reserva y completar check-in.
- Registrar venta y movimiento de caja.
- Checkout y transición de habitación a limpieza.
- Generar ticket interno.
- Rutas públicas con token válido, vencido e inválido.
- Instalación y actualización de la PWA.

## 7. Observabilidad y reversión

Monitorear errores de Edge Functions, respuestas PostgREST, rechazos RLS y comprobantes SUNAT.

Ante un incidente:

1. Deshabilitar el flujo público o integración afectada.
2. Revocar tokens comprometidos y rotar secretos.
3. Restaurar la versión anterior del frontend o Edge Function.
4. Corregir el esquema mediante una migración nueva.
5. Restaurar backup sólo con aprobación y evidencia del alcance.

Nunca usar `db reset --linked` en producción.
