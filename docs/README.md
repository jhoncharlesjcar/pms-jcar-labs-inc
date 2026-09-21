# Documentación del PMS JCAR LABS

**Estado:** vigente para la versión 3.3.0
**Última revisión:** 21 de septiembre de 2026

Este directorio contiene las guías operativas y técnicas permanentes. Las reglas detalladas de negocio viven en `specs/`.

## Guías principales

| Documento | Alcance |
| --- | --- |
| [README del proyecto](../README.md) | Instalación, comandos, módulos y acceso rápido |
| [Producción](PRODUCTION.md) | Estado live, hoteles de prueba, incidentes 403/500 |
| [Historial de Cambios (Changelog)](CHANGELOG.md) | Registro histórico de novedades, arquitectura y parches |
| [Arquitectura](../specs/architecture.md) | Capas, rutas, seguridad y sincronización |
| [Flujo de negocio](FLUJO_NEGOCIO.md) | Ciclo operativo desde reserva hasta cierre |
| [Sistema de diseño](DESIGN_SYSTEM.md) | UX/UI, responsive, accesibilidad y componentes |
| [Despliegue](DEPLOYMENT.md) | Quality gate, Supabase, Vercel, smoke check y reversión |
| [Runbook operativo](OPERATIONS_RUNBOOK.md) | RPO/RTO, backups, retención, crons, alertas e incidentes |

## Contratos de dominio

| Dominio | Documento |
| --- | --- |
| Autenticación y roles | [domain-auth.md](../specs/domain-auth.md) |
| Hotel y multi-tenant | [domain-hotel.md](../specs/domain-hotel.md) |
| Habitaciones | [domain-habitaciones.md](../specs/domain-habitaciones.md) |
| Recepción y reservas | [domain-recepcion.md](../specs/domain-recepcion.md) |
| Checkout | [domain-checkout.md](../specs/domain-checkout.md) |
| Ventas y POS | [domain-ventas.md](../specs/domain-ventas.md) |
| Caja | [domain-caja.md](../specs/domain-caja.md) |
| Limpieza | [domain-limpieza.md](../specs/domain-limpieza.md) |
| Insumos | [domain-insumos.md](../specs/domain-insumos.md) |
| Fidelización | [domain-fidelidad.md](../specs/domain-fidelidad.md) |

## Fuentes de verdad

| Materia | Fuente |
| --- | --- |
| Rutas privadas y públicas | `src/App.jsx` |
| Permisos por rol | `src/constants/permissions.ts` |
| Estados de habitación | `src/constants/roomStatus.ts` |
| Acceso multi-tenant | `src/api/db.js`, RLS y migraciones |
| Esquema y políticas | `supabase/migrations/` |
| Operaciones privilegiadas | `supabase/functions/` |
| Tokens y patrones visuales | `src/index.css` y `src/components/ui/` |
| Quality gate | `.github/workflows/deploy.yml` |

Cuando una explicación contradiga el código o una migración aplicada, debe corregirse el documento en el mismo cambio que modifica la implementación.

## Mantenimiento

- Actualizar la fecha de revisión cuando cambie un contrato documentado.
- No documentar secretos con valores reales.
- No editar migraciones ya aplicadas; crear una nueva.
- Conservar los escenarios de validación de los specs aunque el repositorio productivo no incluya suites de pruebas.
- Eliminar auditorías temporales, TODO históricos y documentación duplicada.
- Verificar enlaces y el quality gate (`lint`, `typecheck`, `typecheck:js`, `test`, `build`) antes de publicar una versión.
