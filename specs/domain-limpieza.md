# Spec: Limpieza — Housekeeping y Control de Aseo

**Dominio:** Limpieza / Housekeeping  
**Prioridad:** P1  
**Versión:** 3.0 Enterprise  
**Última actualización:** Agosto 2026  
**Dependencias:** `specs/domain-habitaciones.md`, `specs/domain-recepcion.md`, `specs/architecture.md`, `specs/domain-insumos.md`

---

## 1. Propósito

Gestiona el ciclo operacional completo de limpieza de habitaciones post-check-out, el monitoreo visual en tiempo real mediante tarjetas de alta densidad y la alerta de averías de mantenimiento. El módulo de limpieza es el eslabón entre el check-out de un huésped y la disponibilidad de la habitación para el siguiente check-in.

*(El control de inventario de suministros se gestiona independientemente en `specs/domain-insumos.md`).*

---

## 2. Flujo Canónico

### 2.1 Flujo Operacional de Housekeeping

```mermaid
graph TD
    A[Check-out o Solicitud de Limpieza] --> B[Habitación cambia a 'limpieza']
    B --> C[Se inicia cronómetro de tiempo transcurrido en 'limpieza_start']
    C --> D[Personal de ama de llaves visualiza tarjeta en Grid 5-columnas]
    D --> E{¿Requiere Mantenimiento por Falla?}
    E -->|Sí| F[Ingresar Motivo de Avería → Estado 'mantenimiento']
    E -->|No| G[Finalizar Aseo → Marcar 'disponible']
    G --> H[Eliminar limpieza_start → Habitación Lista para Check-in]
```

---

## 3. Componentes de la Interfaz (UX/UI Enterprise v2.0)

### 3.1 Encabezado e Identidad Visual
- **Vector Icon Badge:** Escoba personalizada con partículas SVG `<BroomIcon />` en contenedor `w-10 h-10 rounded-xl bg-primary/15 border border-primary/20`.
- **Título de Módulo:** `Limpieza` (`text-2xl sm:text-3xl font-bold tracking-tight text-foreground`).

### 3.2 Barra Superior de KPIs de Housekeeping
El módulo incluye 4 mini-tarjetas de métricas calculadas en tiempo real en contenedores `bg-card/60 backdrop-blur-xl border border-border/50 rounded-2xl shadow-xs`:
1. 🧼 **Por Limpiar (Sucias):** Cantidad de habitaciones en estado `limpieza`.
2. 🛠️ **En Mantenimiento:** Cantidad bloqueada por reparaciones en estado `mantenimiento`.
3. ✨ **Listas / Disponibles:** Cantidad limpia lista para Check-in (`disponible`).
4. 👥 **Ocupadas:** Cantidad alojando huéspedes actualmente (`ocupada`).

### 3.3 Rejilla Responsiva de Alta Densidad (`w-full`)
- Layout extendido a **ancho completo de pantalla (`w-full`)**.
- Grid adaptable de alta densidad: `grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4`.

### 3.4 Tarjetas de Habitación e Indicadores
- **Status Badge Unificado:** `<StatusBadge status={hab.estado} />`.
- **Cronómetro de Tiempo Transcurrido:** Muestra la duración exacta del proceso de aseo (`⏱️ En proceso: 25m`).
- **Alerta de Mantenimiento:** Muestra el motivo redactado de la falla reportada.
- **Acciones Táctiles Directas:**
  - `✨ Marcar Lista`: `<Button variant="emerald">` (cambia a `disponible`).
  - `🧼 Marcar Sucia`: `<Button variant="outline">` (cambia a `limpieza`).
  - `🛠️ Reportar Falla`: Abre modal para especificar motivo y cambiar a `mantenimiento`.

---

## 4. Reglas de Negocio

### RN-LIM-001: Inicio de Cronómetro de Limpieza
- Al cambiar a estado `limpieza`, la aplicación registra la marca de tiempo `limpieza_start` en el objeto JSON de la columna `habitaciones.descripcion`.

### RN-LIM-002: Liberación de Habitación
- Al cambiar a estado `disponible`, se eliminan las llaves `limpieza_start` y `motivo_mantenimiento` del JSON de la habitación, dejándola 100% limpia.

### RN-LIM-003: Bloqueo por Mantenimiento
- Para pasar una habitación a `mantenimiento`, se requiere ingresar un motivo obligatorio en el modal de fallas.
