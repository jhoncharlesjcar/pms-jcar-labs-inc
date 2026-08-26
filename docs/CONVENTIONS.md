# Convenciones de Código — PMS JCAR LABS

## Manejo de Fechas (timezone-safe)

Cuando se comparan o calculan diferencias entre fechas que representan SOLO el día
(sin hora), siempre parsear con hora fija `T12:00:00` para evitar bugs de timezone:

    const fecha = new Date(fechaStr + 'T12:00:00');

Nunca usar `new Date(fechaStr)` para fecha-only strings, ya que los navegadores
pueden interpretar la hora como 00:00 UTC y causar desfase de un día.

## Convención de columnas de fecha

| Tablas | Columna |
|---|---|
| `usuarios`, `hoteles`, `audit_events`, `loyalty_*` | `created_at` |
| Todas las demás (`reservas`, `ventas`, `habitaciones`, etc.) | `created_date` |

## Funciones puras (servicios)

Los archivos en `src/services/` deben contener SOLO funciones puras sin side effects.
No importar `supabase`, `toast`, ni `queryClient`. El único import externo permitido
es `@/constants/*` y `@/types/*`.

**Excepción:** `habitaciones.service.ts` y `loyalty.service.ts` actúan como service layer
con acceso a Supabase. Documentar con `@sideeffect` en JSDoc.
