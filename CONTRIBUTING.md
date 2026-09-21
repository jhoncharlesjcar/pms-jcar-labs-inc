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
1. Debe pasar Quality Gate (`lint` + `typecheck` + `typecheck:js` + `test` + `build`)
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

## Entorno de desarrollo

### Requisitos
- Node.js **>= 22** (versión exacta en `package.json > engines.node`)
- pnpm **9.15.9** (fijado en `package.json > packageManager`)

### Instalación recomendada (Windows / Linux / macOS)

```bash
# Opción A: corepack (incluido en Node.js >= 16.9)
corepack enable
corepack prepare pnpm@9.15.9 --activate

# Opción B: npm (si corepack falla)
npm install -g pnpm@9.15.9
```

Verificar:
```bash
pnpm --version   # debe mostrar 9.15.9
node --version   # debe mostrar v22.x.x
```

### Puesta en marcha local
```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
# editar .env.local con tus credenciales de Supabase
pnpm dev
```

En PowerShell:
```powershell
Copy-Item .env.example .env.local
pnpm dev
```

### Comandos de calidad (ejecutar antes de PR)
```bash
pnpm lint              # ESLint --max-warnings=0
pnpm typecheck         # tsc --noEmit
pnpm typecheck:js      # tsc -p tsconfig.jscheck.json
pnpm test:coverage     # vitest + coverage thresholds
pnpm check:edge        # Deno tests para Edge Functions
pnpm check:migrations  # higiene de migraciones
pnpm check:secrets     # escaneo de secretos
pnpm build             # build de producción en dist/
```

### Estructura de carpetas clave
```
src/
  api/                 # acceso a datos + multi-tenant scope
  components/          # UI compartida y de negocio
  constants/           # permisos, estados operativos
  contexts/            # Auth + Hotel activo
  hooks/               # hooks transversales
  pages/<Dominio>/hooks/  # "Cerebro": hooks de dominio (v3.0+)
  pages/<Dominio>.jsx  # "Músculo": JSX + JSDoc (Vite no parsea TypeScript en .jsx)
  services/            # lógica de negocio pura (sin side effects)
  store/               # Zustand: sesión + hotel activo
supabase/
  functions/           # 20 Edge Functions (Deno 2.x)
  migrations/          # 42 migraciones SQL + RLS
```

### Notes sobre pnpm en este repo
- El shim global de `pnpm` (corepack) puede fallar en Windows si la ruta de Node.js contiene espacios. Usar `npm exec pnpm@9.15.9` o `./node_modules/.bin/pnpm` como fallback.
- El lockfile `pnpm-lock.yaml` es **source of truth** — nunca borrar ni editar a mano.
- `pnpm.overrides` en `package.json` fija versiones transitivas de seguridad (fast-uri, tar, undici, minimatch, etc.).
