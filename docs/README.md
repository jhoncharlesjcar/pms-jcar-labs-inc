# Documentación

Documentación vigente del PMS JCAR LABS:

| Documento | Alcance |
| --- | --- |
| [Arquitectura](../specs/architecture.md) | Componentes, límites y estructura técnica |
| [Flujo de negocio](FLUJO_NEGOCIO.md) | Check-in, estadía, checkout, limpieza y caja |
| [Sistema de diseño](DESIGN_SYSTEM.md) | UX/UI, responsive y componentes compartidos |
| [Despliegue](DEPLOYMENT.md) | Checklist de Supabase, Vercel, seguridad y reversión |
| [Especificaciones](../specs/) | Reglas y contratos de cada dominio |

## Criterio de mantenimiento

- Las decisiones operativas viven en `specs/domain-*.md`.
- La evolución de la base vive únicamente en migraciones nuevas; una migración aplicada no se edita.
- Los secretos nunca se documentan con valores reales.
- Los documentos históricos, auditorías temporales y reportes generados no forman parte de la documentación permanente.
