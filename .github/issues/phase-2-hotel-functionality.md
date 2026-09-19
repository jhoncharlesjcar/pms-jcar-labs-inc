# Phase 2: Funcionalidad Hotelera P1 (Semanas 4-7)

## Objetivo
4 features operativas de alto impacto deployadas sin hotfixes en 2 semanas

## Issues a crear

### 2.1 Housekeeping Turntable (Semana 4)
**Labels:** `feature`, `housekeeping`, `phase-2`, `p1`
**Priority:** P0

**Description:**
Sistema completo de gestión de limpieza con checklist, incidencias con foto y scoring.

**Entregables:**

**Migración:** `20260920000001_housekeeping_turntable.sql`
```sql
-- Tareas de limpieza por habitación/fecha
CREATE TABLE public.housekeeping_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hoteles(id),
  habitacion_id uuid NOT NULL REFERENCES public.habitaciones(id),
  fecha_operativa date NOT NULL,
  asignado_a uuid REFERENCES auth.users(id),
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','en_progreso','completada','omitida')),
  checklist jsonb NOT NULL DEFAULT '[]', -- [{item, completado, notas}]
  puntuacion integer, -- 0-100
  iniciada_en timestamptz,
  completada_en timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (habitacion_id, fecha_operativa)
);
CREATE INDEX idx_hk_tasks_hotel_fecha ON public.housekeeping_tasks(hotel_id, fecha_operativa);
CREATE INDEX idx_hk_tasks_asignado ON public.housekeeping_tasks(asignado_a, fecha_operativa);

-- Incidencias con media
CREATE TABLE public.housekeeping_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hoteles(id),
  habitacion_id uuid NOT NULL REFERENCES public.habitaciones(id),
  task_id uuid REFERENCES public.housekeeping_tasks(id),
  reportado_por uuid NOT NULL REFERENCES auth.users(id),
  tipo text NOT NULL CHECK (tipo IN ('rotura','suciedad','falta_insumo','mantenimiento','otro')),
  descripcion text,
  severidad text NOT NULL DEFAULT 'media' CHECK (severidad IN ('baja','media','alta','critica')),
  media_urls text[], -- URLs firmadas Storage
  estado text NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta','en_proceso','resuelta','cerrada')),
  resuelta_por uuid REFERENCES auth.users(id),
  resuelta_en timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_hk_incidents_hotel_fecha ON public.housekeeping_incidents(hotel_id, created_at);

-- RLS policies
ALTER TABLE public.housekeeping_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY hk_tasks_all ON public.housekeeping_tasks FOR ALL TO authenticated USING (hotel_id = get_user_hotel_id()) WITH CHECK (hotel_id = get_user_hotel_id());

ALTER TABLE public.housekeeping_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY hk_incidents_all ON public.housekeeping_incidents FOR ALL TO authenticated USING (hotel_id = get_user_hotel_id()) WITH CHECK (hotel_id = get_user_hotel_id());
```

**Edge Function:** `upload-housekeeping-media` (signed URL + auto-purge 24h)

**Hook:** `src/pages/Limpieza/hooks/useHousekeepingData.js`
- `useHousekeepingTasks(fecha)` → tasks + KPIs
- `useHousekeepingIncidents(habitacionId?)` → CRUD incidencias
- `completeTask(taskId, checklist, score)` → optimistic update + undo 4s
- `reportIncident(data)` → upload media → create incident

**UI:** `src/pages/Limpieza/components/HousekeepingTurntable.jsx`
- Vista día: grid habitaciones × estado + asignado
- Drawer tarea: checklist interactivo, score auto-calculado, botón "Reportar incidencia" → cámara
- KPIs row: pendientes, en progreso, completadas, score promedio
- Undo toast 4s (pattern existente)

**Tests:** `tests/unit/hooks/useHousekeepingData.test.js` (≥5 tests)

**Acceptance Criteria:**
- [ ] CRUD tareas + incidencias funciona en staging
- [ ] Foto incidente se sube a Storage, URL firmada expira 24h
- [ ] Optimistic UI + undo 4s funciona
- [ ] KPIs calculados correctamente
- [ ] RLS aisla por hotel
- [ ] Tests unitarios + E2E móvil pasan

---

### 2.2 Minibar & Consumos con Stock (Semana 5)
**Labels:** `feature`, `minibar`, `pos`, `phase-2`, `p1`
**Priority:** P0

**Description:**
Gestión de minibar por habitación con stock en tiempo real, QR reposición, bloqueo venta si stock ≤0.

**Entregables:**

**Migración:** `20260921000001_minibar_stock.sql`
```sql
-- Items de minibar configurables por hotel
CREATE TABLE public.minibar_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hoteles(id),
  producto_id uuid NOT NULL REFERENCES public.productos(id),
  habitacion_tipo_id uuid REFERENCES public.habitaciones(id), -- NULL = todas
  stock_actual integer NOT NULL DEFAULT 0,
  stock_minimo integer NOT NULL DEFAULT 1,
  precio_venta numeric(10,2) NOT NULL,
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE (hotel_id, producto_id, habitacion_tipo_id)
);
CREATE INDEX idx_minibar_hotel ON public.minibar_items(hotel_id, activo);

-- Consumos por habitación/estancia
CREATE TABLE public.minibar_consumos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hoteles(id),
  reserva_id uuid NOT NULL REFERENCES public.reservas(id),
  habitacion_id uuid NOT NULL REFERENCES public.habitaciones(id),
  minibar_item_id uuid NOT NULL REFERENCES public.minibar_items(id),
  cantidad integer NOT NULL DEFAULT 1,
  precio_unitario numeric(10,2) NOT NULL,
  consumido_en timestamptz DEFAULT now(),
  consumido_por uuid REFERENCES auth.users(id),
  facturado boolean DEFAULT false
);
CREATE INDEX idx_minibar_consumos_reserva ON public.minibar_consumos(reserva_id);
CREATE INDEX idx_minibar_consumos_hotel_fecha ON public.minibar_consumos(hotel_id, consumido_en);

-- RLS
ALTER TABLE public.minibar_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY minibar_items_all ON public.minibar_items FOR ALL TO authenticated USING (hotel_id = get_user_hotel_id()) WITH CHECK (hotel_id = get_user_hotel_id());

ALTER TABLE public.minibar_consumos ENABLE ROW LEVEL SECURITY;
CREATE POLICY minibar_consumos_all ON public.minibar_consumos FOR ALL TO authenticated USING (hotel_id = get_user_hotel_id()) WITH CHECK (hotel_id = get_user_hotel_id());
```

**Edge Function:** `minibar-restock-qr` → genera QR por piso/habitación que abre UI de reposición

**Hook:** `src/pages/Habitaciones/hooks/useMinibarData.js` (o nuevo `src/pages/Minibar/hooks/`)
- `useMinibarStock(habitacionId)` → items con stock actual
- `useMinibarConsumo(reservaId)` → registrar consumo, auto-descuenta stock
- `useRestockQR(piso)` → genera QR signed URL

**UI:**
- `src/components/minibar/MinibarScanner.jsx` — cámara escanea QR piso → UI reposición (sumar stock)
- `src/components/minibar/MinibarConsumoDrawer.jsx` — desde Recepción/POS: selecciona items, valida stock >0, registra consumo
- Integración en `ReservaCard` y `PuntoVenta`: botón "Minibar" abre drawer

**Bloqueo venta:** En `useRegistrarVenta` / `create_pos_sale_atomic` validar stock antes de permitir venta de productos minibar.

**Tests:** Unit + E2E (scan QR → reposición → consumo → verifica stock)

**Acceptance Criteria:**
- [ ] Stock se descuenta automáticamente al registrar consumo
- [ ] Venta bloqueada si stock ≤0 (mensaje claro al usuario)
- [ ] QR por piso funciona y abre UI reposición en móvil
- [ ] Reposición actualiza stock en tiempo real
- [ ] Consumos aparecen en checkout/reserva
- [ ] RLS por hotel

---

### 2.3 Motor de Tarifas Dinámicas Configurable (Semana 6)
**Labels:** `feature`, `revenue`, `pricing`, `phase-2`, `p1`
**Priority:** P0

**Description:**
Reglas de precio: temporada × día-semana × ocupación → factor. UI admin CRUD + preview calendario. Cron nocturno recalcula.

**Entregables:**

**Migración:** `20260922000001_dynamic_pricing.sql`
```sql
-- Temporadas
CREATE TABLE public.tarifa_temporadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hoteles(id),
  nombre text NOT NULL,
  fecha_inicio date NOT NULL,
  fecha_fin date NOT NULL,
  factor numeric(4,3) NOT NULL DEFAULT 1.000, -- ej 1.200 = +20%
  prioridad integer DEFAULT 0, -- mayor = prioridad
  activa boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_tarifa_temporadas_hotel_fechas ON public.tarifa_temporadas(hotel_id, fecha_inicio, fecha_fin);

-- Reglas día-semana
CREATE TABLE public.tarifa_reglas_dia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hoteles(id),
  dia_semana integer NOT NULL CHECK (dia_semana BETWEEN 0 AND 6), -- 0=domingo
  factor numeric(4,3) NOT NULL DEFAULT 1.000,
  aplica_solo_si_temporada_id uuid REFERENCES public.tarifa_temporadas(id),
  activa boolean DEFAULT true
);
CREATE UNIQUE INDEX uq_tarifa_regla_hotel_dia ON public.tarifa_reglas_dia(hotel_id, dia_semana) WHERE activa;

-- Reglas ocupación
CREATE TABLE public.tarifa_reglas_ocupacion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hoteles(id),
  ocupacion_min_pct integer NOT NULL CHECK (ocupacion_min_pct BETWEEN 0 AND 100),
  ocupacion_max_pct integer NOT NULL CHECK (ocupacion_max_pct BETWEEN 0 AND 100),
  factor numeric(4,3) NOT NULL DEFAULT 1.000,
  activa boolean DEFAULT true
);

-- Tarifas calculadas (cache nocturno)
CREATE TABLE public.tarifas_calculadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hoteles(id),
  habitacion_id uuid NOT NULL REFERENCES public.habitaciones(id),
  fecha date NOT NULL,
  precio_base numeric(10,2) NOT NULL,
  factor_temporada numeric(4,3) DEFAULT 1.000,
  factor_dia numeric(4,3) DEFAULT 1.000,
  factor_ocupacion numeric(4,3) DEFAULT 1.000,
  precio_final numeric(10,2) NOT NULL,
  calculada_en timestamptz DEFAULT now(),
  UNIQUE (habitacion_id, fecha)
);
CREATE INDEX idx_tarifas_calc_hotel_fecha ON public.tarifas_calculadas(hotel_id, fecha);

-- RLS
ALTER TABLE public.tarifa_temporadas ENABLE ROW LEVEL SECURITY;
CREATE POLICY tt_all ON public.tarifa_temporadas FOR ALL TO authenticated USING (hotel_id = get_user_hotel_id()) WITH CHECK (hotel_id = get_user_hotel_id());
-- ... similar para otras tablas
```

**Edge Function:** `recalculate-rates` (cron 02:00 America/Lima)
- Para cada hotel/habitación/fecha (próximos 90 días):
  - precio_base = habitaciones.precio_noche
  - factor_temporada = mayor factor de temporada activa en fecha
  - factor_dia = regla día-semana activa
  - factor_ocupación = regla ocupación según ocupación proyectada (reservas + holds / total hab)
  - precio_final = precio_base × factor_temporada × factor_dia × factor_ocupación
  - upsert en `tarifas_calculadas`

**Hook:** `src/pages/Revenue/hooks/useTarifasDinamicas.js`
- `useTemporadas()`, `useReglasDia()`, `useReglasOcupacion()` → CRUD
- `useTarifasCalculadas(fechaInicio, fechaFin)` → preview grid
- `recalculateNow()` → invoca Edge Function

**UI:** `src/pages/Configuracion/components/TarifasDinamicasConfig.jsx`
- Tabs: Temporadas, Reglas Día, Reglas Ocupación
- Cada tab: tabla editable + botón "Añadir regla"
- Preview: calendario 3 meses con precio final por habitación/día (color heatmap)
- Botón "Recalcular ahora" + estado último cron

**Integración JcarAI:** Tool `search_availability` usa `tarifas_calculadas.precio_final` en lugar de `habitaciones.precio_noche`.

**Tests:** Unit (cálculo factores), E2E (crear regla → verifica precio en preview)

**Acceptance Criteria:**
- [ ] CRUD reglas completo en UI
- [ ] Preview calendario muestra precios correctos (heatmap)
- [ ] Cron nocturno recalcula y popula `tarifas_calculadas`
- [ ] `search_availability` devuelve precios dinámicos
- [ ] Factor ocupación se basa en reservas+holds reales
- [ ] RLS por hotel

---

### 2.4 Paquetes/Add-ons en Booking Público (Semana 7)
**Labels:** `feature`, `booking`, `packages`, `phase-2`, `p1`
**Priority:** P0

**Description:**
Paquetes vendibles (desayuno, late checkout, traslado) con precio fijo o %, adjuntos a reserva en booking público.

**Entregables:**

**Migración:** `20260923000001_paquetes_addons.sql`
```sql
-- Paquetes configurables por hotel
CREATE TABLE public.paquetes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hoteles(id),
  nombre text NOT NULL,
  descripcion text,
  tipo text NOT NULL CHECK (tipo IN ('desayuno','late_checkout','traslado','spa','otro')),
  precio_tipo text NOT NULL CHECK (precio_tipo IN ('fijo','porcentaje_estadia','por_noche','por_persona')),
  precio_valor numeric(10,2) NOT NULL, -- monto fijo o % (ej 15.00 = 15% o S/ 50.00)
  moneda text DEFAULT 'PEN',
  activo boolean DEFAULT true,
  requiere_confirmacion boolean DEFAULT false, -- ej traslado necesita coordinación
  imagen_url text,
  orden integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_paquetes_hotel_activo ON public.paquetes(hotel_id, activo);

-- Paquetes en reserva
CREATE TABLE public.reserva_paquetes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reserva_id uuid NOT NULL REFERENCES public.reservas(id) ON DELETE CASCADE,
  paquete_id uuid NOT NULL REFERENCES public.paquetes(id),
  cantidad integer NOT NULL DEFAULT 1,
  precio_unitario numeric(10,2) NOT NULL, -- precio al momento de agregar
  subtotal numeric(10,2) NOT NULL,
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','confirmado','cancelado')),
  notas text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_reserva_paquetes_reserva ON public.reserva_paquetes(reserva_id);

-- RLS
ALTER TABLE public.paquetes ENABLE ROW LEVEL SECURITY;
CREATE POLICY paquetes_select ON public.paquetes FOR SELECT TO anon, authenticated USING (hotel_id = get_user_hotel_id() AND activo = true);
CREATE POLICY paquetes_admin ON public.paquetes FOR ALL TO authenticated USING (hotel_id = get_user_hotel_id() AND get_user_role() IN ('developer','admin')) WITH CHECK (hotel_id = get_user_hotel_id() AND get_user_role() IN ('developer','admin'));

ALTER TABLE public.reserva_paquetes ENABLE ROW LEVEL SECURITY;
CREATE POLICY rp_all ON public.reserva_paquetes FOR ALL TO authenticated USING (
  reserva_id IN (SELECT id FROM public.reservas WHERE hotel_id = get_user_hotel_id())
) WITH CHECK (
  reserva_id IN (SELECT id FROM public.reservas WHERE hotel_id = get_user_hotel_id())
);
```

**Booking Público:** Modificar `useBookingData` y `BookingPublico.jsx`
- Paso nuevo en wizard: "Servicios adicionales" (después de selección habitación)
- Renderiza paquetes activos del hotel con imagen, descripción, precio calculado
- Checkbox para añadir, cantidad (+/-)
- Subtotal se suma al total de la reserva

**JcarAI Tool:** `suggest_upsells(reserva_id)` → devuelve paquetes compatibles (filtrados por tipo, fechas, disponibilidad)

**Edge Function:** `public-booking` ya existe → extender para crear `reserva_paquetes` al confirmar reserva.

**Tests:** Unit (cálculo precios), E2E booking completo con paquetes

**Acceptance Criteria:**
- [ ] Paquetes se muestran en booking público con precio correcto
- [ ] Selección persiste al crear reserva
- [ ] `reserva_paquetes` poblado correctamente
- [ ] JcarAI `suggest_upsells` devuelve paquetes relevantes
- [ ] Precio fijo y % funcionan
- [ ] RLS: anon ve solo activos, admin CRUD completo

---

## Métricas de éxito Fase 2
| Feature | Deploy target | KPI |
|---------|---------------|-----|
| Housekeeping Turntable | Semana 4 | 90% tareas completadas a tiempo, <5% incidencias abiertas >24h |
| Minibar Stock | Semana 5 | 0 ventas bloqueadas por stock (reposición proactiva), 100% consumos facturados |
| Tarifas Dinámicas | Semana 6 | RevPAR +10% vs tarifa fija, 0 errores cálculo |
| Paquetes Booking | Semana 7 | Attach rate ≥20%, ingreso paquete ≥5% total |

## Riesgos y mitigaciones
| Riesgo | Mitigación |
|--------|------------|
| Migraciones conflictivas | Una por PR, staging-migrations.yml valida |
| Performance `tarifas_calculadas` (90d × N hab) | Índices compuestos, particionar por hotel si >10k hab |
| JcarAI tool breaking changes | Versionar tools, test sintético 100 casos |
| Scope creep | Timebox 1 semana/feature, MVP definido arriba |