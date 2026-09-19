# Phase 4: Performance, Seguridad & P2 (Semanas 10-12)

## Objetivo
Escalabilidad, cumplimiento y diferencial competitivo

## Issues a crear

### 4.1 Code-splitting por dominio + Virtualización (Semana 10)
**Labels:** `performance`, `frontend`, `phase-4`, `p1`
**Priority:** P1

**Description:**
Dividir chunks por dominio y virtualizar listas grandes.

**Entregables:**

**Vite config:** `vite.config.js`
```javascript
export default defineConfig({
  // ... existing
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-select', '@radix-ui/react-switch', 'lucide-react'],
          'vendor-charts': ['recharts'],
          'vendor-ai': ['@gsap/react', 'gsap'],
          'vendor-pdf': ['jspdf', 'jspdf-autotable'],
          'recepcion': [
            './src/pages/Recepcion/hooks/useRecepcionData.js',
            './src/components/recepcion/RecepcionTimeline.jsx',
            './src/components/recepcion/RecepcionCockpit.jsx',
            './src/pages/Recepcion/components/ReservaCard.jsx',
            './src/pages/Recepcion/components/NuevaReservaSheet.jsx'
          ],
          'pos': [
            './src/pages/PuntoVenta/hooks/usePuntoVentaLogic.js',
            './src/components/pos/CarritoMinimarket.jsx',
            './src/components/pos/CatalogoMinimarket.jsx',
            './src/components/pos/PagoModal.jsx'
          ],
          'reportes': [
            './src/pages/Reportes/hooks/useReportesData.js',
            './src/pages/Revenue/hooks/useRevenueData.js',
            './src/components/dashboard/WeeklyAnalysisChart.jsx'
          ],
          'housekeeping': [
            './src/pages/Limpieza/hooks/useLimpiezaData.js',
            './src/pages/Limpieza/components/HousekeepingTurntable.jsx'
          ],
          'config': [
            './src/pages/Configuracion/hooks/useConfiguracionData.js',
            './src/components/admin/GestionHotelesAdmin.jsx',
            './src/components/dev/AuditCenter.jsx'
          ]
        }
      }
    }
  }
})
```

**Virtualización:** `RecepcionTimeline` y `ReservaCard` list
```javascript
// src/components/recepcion/VirtualizedRoomList.jsx
import { useVirtualizer } from '@tanstack/react-virtual'

export function VirtualizedRoomList({ rooms, onRoomClick, height = 600 }) {
  const parentRef = useRef(null)
  const virtualizer = useVirtualizer({
    count: rooms.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120,
    overscan: 5,
  })
  
  return (
    <div ref={parentRef} className="h-full overflow-auto" style={{ height }}>
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map(virtualRow => (
          <div
            key={rooms[virtualRow.index].id}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`
            }}
          >
            <ReservaCard reserva={rooms[virtualRow.index]} onClick={onRoomClick} />
          </div>
        ))}
      </div>
    </div>
  )
}
```

**Tests:** Lighthouse CI budgets actualizados, bundle analyzer report.

**Acceptance Criteria:**
- [ ] Chunks separados cargan bajo demanda (Network tab verifica)
- [ ] `RecepcionTimeline` con 100+ habitaciones: 60fps scroll
- [ ] Bundle principal <200KB gzipped
- [ ] Lighthouse Performance ≥80 en páginas críticas

---

### 4.2 Seguridad: Scanner DNI a Edge + HMAC Webhooks + Pentest (Semana 11)
**Labels:** `security`, `compliance`, `phase-4`, `p0`
**Priority:** P0

**Description:**
Mover procesamiento DNI (Tesseract) del cliente a Edge, firmar webhooks con HMAC rotativo, pentest OWASP ZAP.

**Entregables:**

**Edge Function:** `supabase/functions/process-dni/index.ts`
```typescript
import { serve } from 'std/http/server.ts'
import { createWorker } from 'tesseract.js'
import { supabaseAdmin } from '../_shared/supabase.ts'

serve(async (req) => {
  const { hotelId, imageBase64 } = await req.json()
  
  // Validar hotel y permisos
  const worker = await createWorker('spa')
  const { data: { text } } = await worker.recognize(imageBase64)
  await worker.terminate()
  
  // Parsear campos DNI peruano (regex)
  const parsed = parseDNIPeru(text)
  
  // Borrar imagen de memoria inmediatamente
  // No almacenar en BD ni Storage
  
  return Response.json({ success: true, data: parsed })
})

function parseDNIPeru(text: string) { ... }
```

**Frontend:** `ScannerDNIModal.jsx` → llama Edge Function en lugar de Tesseract local.

**HMAC Webhooks:** `supabase/functions/webhook-gateway/index.ts`
```typescript
// Secret por hotel en private.hotel_secrets (clave: webhook_hmac_secret)
// Rotación: Edge Function rotate-webhook-secret (cron mensual)
function verifyHMAC(payload: string, signature: string, secret: string): boolean {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
  )
  return crypto.subtle.verify('HMAC', key, hexToBytes(signature), encoder.encode(payload))
}
```

**Pentest:** Ejecutar OWASP ZAP contra:
- `/booking/:hotelId` (SQLi, XSS, IDOR)
- `/public-checkin/:token` (token enumeration, info disclosure)
- `/portal/:token` (auth bypass, data leakage)
- `/api` endpoints (rate limiting, auth)

**CI Integration:** `.github/workflows/security-scan.yml` (semanal)

**Acceptance Criteria:**
- [ ] DNI se procesa en Edge, nunca en cliente (verificar Network tab)
- [ ] Imagen no persiste en memoria >5s
- [ ] Webhooks validan HMAC, rechazan sin firma válida
- [ ] Secreto rota mensualmente sin downtime
- [ ] ZAP report: 0 critical, 0 high, documentar medium/low
- [ ] Fixes aplicados y re-scan verde

---

### 4.3 Multimoneda (PEN base + USD daily SUNAT) (Semana 11-12)
**Labels:** `feature`, `billing`, `multicurrency`, `phase-4`, `p2`
**Priority:** P2

**Description:**
Soporte USD con tipo de cambio SUNAT diario vía Edge Function.

**Entregables:**

**Migración:** `20260926000001_multicurrency.sql`
```sql
-- Tipo de cambio diario (cache)
CREATE TABLE public.tipo_cambio_sunat (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha date NOT NULL UNIQUE,
  moneda_origen text NOT NULL DEFAULT 'USD',
  moneda_destino text NOT NULL DEFAULT 'PEN',
  tasa_compra numeric(10,4) NOT NULL,
  tasa_venta numeric(10,4) NOT NULL,
  fuente text DEFAULT 'SUNAT',
  obtenido_en timestamptz DEFAULT now()
);
CREATE INDEX idx_tc_fecha ON public.tipo_cambio_sunat(fecha DESC);

-- Configuración moneda por hotel
ALTER TABLE public.hoteles ADD COLUMN IF NOT EXISTS moneda_base text DEFAULT 'PEN' CHECK (moneda_base IN ('PEN','USD'));
ALTER TABLE public.hoteles ADD COLUMN IF NOT EXISTS monedas_aceptadas text[] DEFAULT ARRAY['PEN'];

-- Comprobantes: agregar moneda y tasa
ALTER TABLE public.comprobantes ADD COLUMN IF NOT EXISTS moneda text DEFAULT 'PEN';
ALTER TABLE public.comprobantes ADD COLUMN IF NOT EXISTS tasa_cambio numeric(10,4);
ALTER TABLE public.comprobantes ADD COLUMN IF NOT EXISTS total_moneda_base numeric(12,2);

-- RLS
ALTER TABLE public.tipo_cambio_sunat ENABLE ROW LEVEL SECURITY;
CREATE POLICY tc_select ON public.tipo_cambio_sunat FOR SELECT TO anon, authenticated USING (true);
```

**Edge Function:** `fetch-sunat-rate` (cron 06:00 America/Lima)
- Scrapea SUNAT o usa API oficial → upsert `tipo_cambio_sunat`
- Fallback: último valor conocido

**Hook:** `src/hooks/useTipoCambio.js`
- `useTipoCambio(fecha?)` → tasa del día
- `convertir(monto, de, a, fecha?)` → monto convertido

**UI:** 
- Configuración hotel: selector moneda base (PEN/USD), monedas aceptadas
- POS/Recepción: selector moneda al cobrar, muestra conversión
- Comprobantes: guardan moneda, tasa, total en moneda base
- Reportes: toggle moneda de visualización

**Tests:** Unit (conversión, fallback), E2E (venta USD → comprobante PEN)

**Acceptance Criteria:**
- [ ] Tipo de cambio SUNAT se actualiza diariamente
- [ ] Venta en USD genera comprobante con totales en PEN y USD
- [ ] Reportes permiten visualizar en ambas monedas
- [ ] Fallback a último valor si SUNAT no disponible
- [ ] RLS correcto

---

### 4.4 Split Payment + Pagos Parciales/Anticipados (Semana 12)
**Labels:** `feature`, `payments`, `checkout`, `phase-4`, `p2`
**Priority:** P2

**Description:**
Múltiples métodos de pago en un checkout + pagos parciales/anticipados ligados a reserva.

**Entregables:**

**Migración:** `20260927000001_split_payments.sql`
```sql
-- Pagos de reserva (parciales, anticipados, split)
CREATE TABLE public.reserva_pagos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reserva_id uuid NOT NULL REFERENCES public.reservas(id) ON DELETE CASCADE,
  hotel_id uuid NOT NULL REFERENCES public.hoteles(id),
  monto numeric(10,2) NOT NULL,
  moneda text NOT NULL DEFAULT 'PEN',
  tasa_cambio numeric(10,4),
  metodo_pago text NOT NULL, -- 'efectivo','tarjeta','yape','plin','transferencia','mixto'
  referencia_externa text, -- ID transacción proveedor
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','confirmado','rechazado','reembolsado')),
  tipo_pago text NOT NULL DEFAULT 'parcial' CHECK (tipo_pago IN ('anticipo','parcial','total','split')),
  grupo_pago_id uuid, -- agrupa pagos split de un mismo checkout
  notas text,
  creado_por uuid REFERENCES auth.users(id),
  creado_en timestamptz DEFAULT now(),
  confirmado_en timestamptz
);
CREATE INDEX idx_rp_reserva ON public.reserva_pagos(reserva_id);
CREATE INDEX idx_rp_grupo ON public.reserva_pagos(grupo_pago_id);
CREATE INDEX idx_rp_hotel_fecha ON public.reserva_pagos(hotel_id, creado_en);

-- RLS
ALTER TABLE public.reserva_pagos ENABLE ROW LEVEL SECURITY;
CREATE POLICY rp_all ON public.reserva_pagos FOR ALL TO authenticated USING (hotel_id = get_user_hotel_id()) WITH CHECK (hotel_id = get_user_hotel_id());
```

**Checkout Atomic:** Modificar `checkout_reserva_atomic` para:
- Aceptar array `pagos: [{metodo, monto, moneda, referencia}]`
- Validar `SUM(pagos.monto_en_moneda_base) >= reserva.total_pendiente`
- Crear múltiples `reserva_pagos` en misma transacción
- Actualizar `reserva.saldo_pendiente`

**UI:** `src/components/checkout/SplitPaymentSelector.jsx`
- Paso en checkout: "Métodos de pago"
- Añadir líneas: método + monto (auto-calcula resto)
- Validación visual: total cubierto ✓ / faltante ✗
- Soporte anticipos: botón "Registrar anticipo" en ReservaCard

**JcarAI Tool:** `create_payment_request` extendido para `split_payments`

**Tests:** Unit (validación sumas, conversión moneda), E2E (split 3 métodos, anticipo + saldo)

**Acceptance Criteria:**
- [ ] Checkout acepta 2+ métodos de pago simultáneos
- [ ] Anticipos reducen saldo pendiente de reserva
- [ ] Comprobante único o multiple según config hotel
- [ ] Caja refleja cada método por separado
- [ ] RLS por hotel

---

### 4.5 CRM Huéspedes + Segmentos WhatsApp (Semana 12)
**Labels:** `feature`, `crm`, `marketing`, `phase-4`, `p2`
**Priority:** P2

**Description:**
Historial completo, tags VIP/blacklist, segmentos para campañas WhatsApp opt-in.

**Entregables:**

**Migración:** `20260928000001_crm_guests.sql`
```sql
-- Tags de huésped
CREATE TABLE public.huesped_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hoteles(id),
  nombre text NOT NULL,
  color text DEFAULT '#6366f1',
  tipo text NOT NULL CHECK (tipo IN ('vip','blacklist','preferencia','alerta','custom')),
  created_at timestamptz DEFAULT now(),
  UNIQUE (hotel_id, nombre)
);

-- Tags asignados
CREATE TABLE public.huesped_tags_asignados (
  hotel_id uuid NOT NULL REFERENCES public.hoteles(id),
  tipo_documento text NOT NULL,
  numero_documento text NOT NULL,
  tag_id uuid NOT NULL REFERENCES public.huesped_tags(id),
  asignado_por uuid REFERENCES auth.users(id),
  asignado_en timestamptz DEFAULT now(),
  notas text,
  PRIMARY KEY (hotel_id, tipo_documento, numero_documento, tag_id)
);

-- Opt-in WhatsApp
CREATE TABLE public.huesped_whatsapp_optin (
  hotel_id uuid NOT NULL REFERENCES public.hoteles(id),
  tipo_documento text NOT NULL,
  numero_documento text NOT NULL,
  telefono text NOT NULL, -- E.164 format
  optin boolean DEFAULT false,
  optin_en timestamptz,
  optout_en timestamptz,
  canal text DEFAULT 'whatsapp',
  PRIMARY KEY (hotel_id, tipo_documento, numero_documento)
);

-- Segmentos dinámicos (para campañas)
CREATE TABLE public.huesped_segmentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hoteles(id),
  nombre text NOT NULL,
  descripcion text,
  criterios jsonb NOT NULL, -- {field, operator, value}[] ej: {total_estancias: {gte: 5}}
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- RPC para evaluar segmento
CREATE OR REPLACE FUNCTION public.evaluar_segmento_huespedes(p_segmento_id uuid)
RETURNS SETOF public.loyalty_accounts LANGUAGE sql SECURITY INVOKER SET search_path = public, pg_catalog AS $$
  SELECT la.* FROM public.loyalty_accounts la
  JOIN public.huesped_segmentos s ON s.id = p_segmento_id
  WHERE la.hotel_id = s.hotel_id
    AND (
      (s.criterios->>'total_estancias')::int IS NULL OR 
      (SELECT COUNT(*) FROM public.reservas r WHERE r.huesped_dni = la.numero_documento AND r.hotel_id = la.hotel_id) >= (s.criterios->>'total_estancias')::int
    )
    -- más criterios...
$$;
```

**Hook:** `src/pages/Huespedes/hooks/useCRMData.js`
- `useHuespedTags()`, `useHuespedSegmentos()`
- `asignarTag(documento, tagId)`, `quitarTag(documento, tagId)`
- `useWhatsAppOptin(documento)` → toggle opt-in
- `getSegmentMembers(segmentoId)` → lista huéspedes

**UI:** `src/pages/Huespedes/components/HuespedCRMPanel.jsx`
- Perfil huésped: timeline estancias, consumos, tags, opt-in WhatsApp
- Panel tags: chips coloreados, click para asignar/quitar
- Segmentos: lista + botón "Ver miembros" + "Enviar campaña" (integra whatsapp.service.ts)

**Tests:** Unit (RPC segmento), E2E (asignar tag → campaña WhatsApp)

**Acceptance Criteria:**
- [ ] Tags VIP/blacklist visibles en Recepción/Booking
- [ ] Opt-in WhatsApp respeta preferencia (no enviar si false)
- [ ] Segmentos dinámicos evalúan correctamente
- [ ] Campaña WhatsApp envía solo a opt-in + segmento
- [ ] RLS por hotel

---

### 4.6 Facturación Contingencia UI (Semana 12)
**Labels:** `feature`, `sunat`, `billing`, `phase-4`, `p2`
**Priority:** P2

**Description:**
UI para monitorear DLQ de facturación y retry manual con idempotencia.

**Entregables:**

**Migración:** (ya existe `sunat_envios` con estado, lease, DLQ)

**Hook:** `src/pages/Ventas/hooks/useFacturacionContingencia.js`
- `useSunatEnvios(filtros)` → lista con estados: pendiente, enviado, aceptado, rechazado, dead_letter
- `retryEnvio(comprobanteId)` → re-invoca `facturacion-worker` con mismo lease
- `forceRequeue(comprobanteId)` → mueve de DLQ a pendiente (admin only)

**UI:** `src/pages/Ventas/components/FacturacionContingenciaPanel.jsx`
- Tabla filtrable: fecha, hotel, tipo, serie, número, estado, CDR, acciones
- Badge estado con colores: 🟡 pendiente, 🔄 enviado, ✅ aceptado, ❌ rechazado, 🔴 dead_letter
- Botones: "Reintentar" (pendiente/enviado), "Forzar requeue" (dead_letter, solo admin)
- Detalle modal: XML generado, CDR parseado, observaciones SUNAT, logs worker
- KPIs: pendientes >1h, dead_letter count, tasa aceptación 24h

**Integración:** `facturacion-worker` ya tiene lease/ACK/NACK/DLQ → UI solo expone controles.

**Tests:** Unit (retry logic), E2E (simular rechazo SUNAT → retry → aceptado)

**Acceptance Criteria:**
- [ ] Panel muestra todos los envíos con estado real
- [ ] Reintentar respeta idempotencia (no duplica envío)
- [ ] Forzar requeue solo admin, logea en auditoría
- [ ] CDR parseado visible en detalle
- [ ] KPIs alertan si pendientes >1h o DLQ crece

---

## Métricas de éxito Fase 4
| Área | KPI | Target |
|------|-----|--------|
| Performance | Lighthouse Perf (recepcion, pos, dashboard) | ≥80 |
| Bundle | Main chunk gzipped | <200KB |
| Seguridad | ZAP critical/high | 0 |
| Multimoneda | Transacciones USD sin errores | 100% |
| Split Payment | Checkouts con >1 método | ≥30% |
| CRM | Huéspedes con tags | ≥50% |
| Facturación | DLQ resuelta <24h | 100% |

## Riesgos Fase 4
| Riesgo | Mitigación |
|--------|------------|
| Code-splitting rompe lazy loading | Test exhaustivo en staging; feature flag por chunk |
| Scanner DNI Edge falla | Fallback a cliente (feature flag); monitor error rate |
| SUNAT rate API cambia | Scraper robusto + fallback manual; alerta si fetch falla 2 días |
| Split payment complejidad contable | Validar con contable; tests de arqueo de caja |
| CRM WhatsApp spam complaints | Double opt-in obligatorio; rate limit 1 msg/semana/segmento |