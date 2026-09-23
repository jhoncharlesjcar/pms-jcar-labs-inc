# Estado de producción

**Proyecto Supabase:** `nwprnycqplnmztpjicea` (us-west-1)  
**App:** Vercel SPA, puerto local 5173  
**Revisión:** 21 septiembre 2026 (v3.3.0)

Este archivo describe lo que está **live**, no un wishlist. Si contradice el código o una migración aplicada, gana el código.

## Qué quedó estable en 3.3.0

| Tema | Estado |
| --- | --- |
| Listado de hoteles HTTP 500 (`stack depth`) | Corregido: helpers RLS `SECURITY DEFINER` + `row_security off` |
| Recepción 403 al buscar habitaciones | Corregido: `staff_search_availability` DEFINER; `ai_search_availability_v2` solo `service_role` |
| Typecheck `hotel.service.ts` GenericStringError | Corregido: `(data as unknown as Hotel[]) ?? []` |
| Hotel PMS JCAR LABS vacío | Sembrado (10 hab, 2 reservas, POS, extras) |
| Caja / “hoy” distinto entre pantallas | Unificado a `hoyLima()` (`America/Lima`) |
| Selector de hotel invisible | Muestra el nombre; banner si 0 habitaciones |
| Clave SUNAT ejecutable con JWT de staff | `EXECUTE` revocado de `authenticated`/`anon` |
| Dashboard stats bajo RLS | DEFINER + chequeo de hotel + día Lima |

## Hoteles

| Nombre | UUID | Uso |
| --- | --- | --- |
| HOSPEDAJE ANGELICA FREY | `11111111-1111-1111-1111-111111111111` | Seed histórico (mayo–agosto en reservas/ventas) |
| PMS JCAR LABS | `6dbaf2c2-e294-460a-87f0-26e914a10a5d` | Seed operativo del día Lima |

Cambiar de hotel: botón con el nombre en el header (sidebar / móvil).

El entrypoint de producción y del repo debe aceptar `POST /functions/v1/ai-gateway` con `{ action }` en el body (`bootstrap`, `message`, `channel_healthcheck`, `provision_channel_credential`). No desplegar un router por path (`/bootstrap`) mientras el cliente no lo use: responde 404 y tumba JCAR AI.

## Incidentes frecuentes

### 1. Recepción: “No hay habitaciones” + consola 403

Causa: `staff_search_availability` INVOKER llamaba a `ai_search_availability_v2` sin GRANT.

Comprobar:

```sql
select proname, prosecdef from pg_proc
where proname in ('staff_search_availability','ai_search_availability_v2');
```

`staff_search_availability` debe ser DEFINER. No otorgar `ai_search_availability_v2` a `authenticated`.

La UI no debe mostrar el SQL crudo; copy: recargar e intentar de nuevo.

### 2. GET `/hoteles` 500 — stack depth

Causa: policies de `hoteles` → `get_user_hotel_id` INVOKER → JOIN `hoteles` → reentrada RLS.

Fix: helpers `SECURITY DEFINER` + `SET row_security TO off`. Migración `fix_rls_helper_hoteles_recursion`.

### 3. Pantallas vacías

1. ¿Hotel correcto en el selector?
2. Recepción: filtro **Todas** (no Atención).
3. Caja: solo el día Lima. Seed histórico no llena caja.
4. `listHoteles` no debe pedir `select('*')`.

### 4. Disponibilidad sin cupo real

`ai_search_availability_v2` rechaza check-in anterior a `current_date` (UTC del cluster) y estadías > 30 noches. Fechas del formulario: `hoyLima()`.

## Edge Functions en prod

Staff y widget siguen en **`ai-gateway`** (monolito). No apuntar el cliente a `ai-gateway-llm` etc. hasta que existan en `list_edge_functions`.

`facturacion` (`verify_jwt: true`) emite desde una venta persistida. HTTP 202 ≠ SUNAT aceptado; eso lo confirma `facturacion-worker`.

## Quality gate

132 tests unitarios. Lint / typecheck / typecheck:js / build en verde. Playwright en CI instala Chromium.

## Fuera de alcance

- Prevent leaked passwords (Supabase Pro).
- Rotar la clave de cifrado SUNAT sin plan de re-encriptar secretos existentes.
