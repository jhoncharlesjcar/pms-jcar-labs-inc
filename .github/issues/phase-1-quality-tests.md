# Phase 1: Quality & Tests Foundation (Semanas 2-3)

## Objetivo
Cobertura ≥75% statements / ≥60% branches en dominio puro + E2E autenticado crítico

## Issues a crear

### 1.1 Ampliar coverage config (vitest.config.js)
**Labels:** `quality`, `testing`, `phase-1`
**Priority:** P0

**Description:**
Ampliar `include` en `vitest.config.js` para cubrir hooks de dominio y componentes críticos:

```js
include: [
  'src/services/**/*.ts',
  'src/pages/*/hooks/**/*.{js,ts}',
  'src/components/checkout/**/*.{ts,tsx,js,jsx}',
  'src/components/recepcion/**/*.{ts,tsx,js,jsx}',
  'src/components/pos/**/*.{ts,tsx,js,jsx}',
  'src/components/comprobantes/**/*.{ts,tsx,js,jsx}',
  'src/constants/roomStatus.ts',
  'src/utils/errorMapping.ts',
  'src/lib/utils.js',
  'src/lib/logger.js',
],
```

Subir thresholds progresivamente:
- Sprint 1: statements 70, branches 55, functions 70, lines 70
- Sprint 2: statements 75, branches 60, functions 75, lines 75

**Acceptance Criteria:**
- [ ] `pnpm test:coverage` reporta nuevos archivos en coverage
- [ ] Thresholds mínimos cumplidos en CI
- [ ] No regresiones en tests existentes (122 tests verdes)

---

### 1.2 Tests unitarios para hooks de dominio (15-20 archivos)
**Labels:** `quality`, `testing`, `phase-1`, `hooks`
**Priority:** P0

**Description:**
Crear tests para cada hook en `src/pages/*/hooks/`:

| Hook | Archivo test | Tests mínimos |
|------|--------------|---------------|
| `useDashboardData` | `useDashboardData.test.js` | carga, error, métricas vacías, invalidate |
| `useRecepcionData` | `useRecepcionData.test.js` | filtrado, búsqueda, creación reserva, actualizar estado |
| `useCajaData` | `useCajaData.test.js` | apertura, cierre, arqueo, validación saldos |
| `useVentasData` | `useVentasData.test.js` | listado, filtros, comprobantes |
| `useConfiguracionData` | `useConfiguracionData.test.js` | CRUD hotel, secretos, facturación |
| `useHabitacionesData` | `useHabitacionesData.test.js` | estados, limpieza, mantenimiento |
| `useHuespedesData` | `useHuespedesData.test.js` | búsqueda, fidelidad, historial |
| `useLimpiezaData` | `useLimpiezaData.test.js` | actualización estado, undo, KPIs |
| `useReportesData` | `useReportesData.test.js` | rangos, exportación, gráficos |
| `useRevenueData` | `useRevenueData.test.js` | ADR, RevPAR, ocupación |
| `usePuntoVentaLogic` | `usePuntoVentaLogic.test.js` | carrito, pago, ticket |
| `useBookingData` | `useBookingData.test.js` | disponibilidad, quote, hold, pago |
| `useLoginLogic` | `useLoginLogic.test.js` | auth, errores, redirect |

**Pattern por hook:**
```javascript
// tests/unit/hooks/useRecepcionData.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useRecepcionData } from '@/pages/Recepcion/hooks/useRecepcionData'
import { createMockDb, createMockUser } from '@/test/utils'

describe('useRecepcionData', () => {
  it('carga reservas y habitaciones al montar', async () => {
    const { result } = renderHook(() => useRecepcionData(mockUser, mockHotelId, mockDb))
    await waitFor(() => expect(result.current.reservas.length).toBeGreaterThan(0))
  })
  
  it('filtra por estado correctamente', () => { ... })
  it('crea reserva y actualiza cache', () => { ... })
  it('maneja error de red', () => { ... })
  it('invalida queries tras mutación', () => { ... })
})
```

**Acceptance Criteria:**
- [ ] Cada hook tiene ≥5 tests: carga, error, mutación, invalidación, edge-case
- [ ] Coverage de hooks ≥80%
- [ ] Tests corren en <10s totales

---

### 1.3 E2E autenticado Playwright: flujos críticos
**Labels:** `quality`, `testing`, `e2e`, `phase-1`
**Priority:** P0

**Description:**
Añadir specs en `tests/e2e/`:

1. **`critical-flow.spec.ts`** - Login → Recepción → Check-in → Venta POS → Checkout → Cierre Caja
2. **`housekeeping-mobile.spec.ts`** - Limpieza móvil (device emulation iPhone/Android)
3. **`booking-public.spec.ts`** - Booking público completo con pago

**Setup requerido:**
```typescript
// tests/e2e/fixtures/auth.ts
import { test as base } from '@playwright/test'
export const test = base.extend({
  authenticatedPage: async ({ page }, use) => {
    await page.goto('/login')
    await page.fill('[name=email]', process.env.E2E_TEST_EMAIL!)
    await page.fill('[name=password]', process.env.E2E_TEST_PASSWORD!)
    await page.click('button[type=submit]')
    await page.waitForURL('/')
    await use(page)
  }
})
```

**Selectores estables (data-testid):**
Añadir `data-testid` a elementos clave en componentes:
- `RecepcionTimeline` → `data-testid="room-{numero}-status"`
- `Caja` → `data-testid="caja-abrir"`, `data-testid="caja-cerrar"`
- `PuntoVenta` → `data-testid="pos-producto-{id}"`, `data-testid="pos-pagar"`

**Acceptance Criteria:**
- [ ] `pnpm test:e2e` pasa en CI (Chromium + Mobile Chrome)
- [ ] Flujos cubren happy path + 1 error path cada uno
- [ ] Tiempo total <5 min
- [ ] No flakiness (re-run 3x verde)

---

### 1.4 AppError + ErrorCodes unificados
**Labels:** `quality`, `architecture`, `phase-1`
**Priority:** P1

**Description:**
Crear `src/lib/errors.ts`:
```typescript
export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public statusCode: number = 500,
    public metadata?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export enum ErrorCode {
  // Auth
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  UNAUTHORIZED = 'UNAUTHORIZED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  // Tenant
  HOTEL_NOT_FOUND = 'HOTEL_NOT_FOUND',
  HOTEL_INACTIVE = 'HOTEL_INACTIVE',
  CROSS_TENANT_ACCESS = 'CROSS_TENANT_ACCESS',
  // Domain
  ROOM_NOT_AVAILABLE = 'ROOM_NOT_AVAILABLE',
  RESERVATION_CONFLICT = 'RESERVATION_CONFLICT',
  INSUFFICIENT_STOCK = 'INSUFFICIENT_STOCK',
  INVALID_PAYMENT = 'INVALID_PAYMENT',
  SUNAT_REJECTED = 'SUNAT_REJECTED',
  // Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  // External
  PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',
  RATE_LIMITED = 'RATE_LIMITED',
}

export function isAppError(err: unknown): err is AppError { ... }
export function toAppError(err: unknown): AppError { ... }
```

Migrar `console.error` → `logger.error(AppError)` en components/hooks/services.

**Acceptance Criteria:**
- [ ] `grep -r "console\\.error" src/components` = 0
- [ ] Todos los catch blocks usan `toAppError` o `isAppError`
- [ ] ErrorBoundary muestra códigos amigables al usuario

---

### 1.5 Lighthouse CI gate
**Labels:** `quality`, `performance`, `phase-1`, `ci`
**Priority:** P1

**Description:**
Añadir a `.github/workflows/deploy.yml`:
```yaml
- name: Lighthouse CI
  uses: treosh/lighthouse-ci-action@v11
  with:
    urls: |
      http://localhost:5173
      http://localhost:5173/recepcion
      http://localhost:5173/pos
    budgetPath: ./lighthouse-budget.json
    uploadArtifacts: true
```

Crear `lighthouse-budget.json`:
```json
{
  "ci": {
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.8 }],
        "categories:accessibility": ["error", { "minScore": 0.9 }],
        "categories:best-practices": ["warn", { "minScore": 0.8 }],
        "categories:seo": ["warn", { "minScore": 0.8 }]
      }
    }
  }
}
```

**Acceptance Criteria:**
- [ ] CI falla si performance <80 o a11y <90
- [ ] Presupuestos definidos para páginas críticas
- [ ] Artefactos subidos para inspección