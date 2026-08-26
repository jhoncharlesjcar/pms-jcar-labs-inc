# Contribución a PMS JCAR LABS

## Ramas
- `main` — rama productiva, protegida
- `feat/*` — nuevas funcionalidades
- `fix/*` — correcciones
- `refactor/*` — mejoras internas sin cambio de funcionalidad

## Commits
Formato: `tipo(módulo): descripción`
Ejemplos:
- `feat(recepcion): agregar validación de menor de edad`
- `fix(checkout): prevenir doble cobro en checkout offline`
- `refactor(layout): extraer sidebar a componente independiente`

## Pull Requests
1. Debe pasar Quality Gate (lint + typecheck + tests + build)
2. Mínimo 1 revisor
3. No reducir coverage sin justificación
4. Nuevas funciones de servicio → test unitario obligatorio

## Servicios puros
Los archivos en `src/services/` son funciones puras. NO importar supabase ni toast.
Mover side effects a hooks (`src/hooks/`) o a la capa API (`src/api/`).

## Migraciones
- Nunca editar una migración ya aplicada
- Prefijo temporal: `YYYYMMDD000001`
- Incluir prerequisite check si depende de migraciones anteriores
