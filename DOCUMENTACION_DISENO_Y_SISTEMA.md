# 🏨 DOCUMENTACIÓN MAESTRA DE DISEÑO, ANIMACIONES Y SISTEMA (SDD)
## **PMS JCAR LABS — Guía Integral de UI/UX, Componentes y Layouts Hotel Enterprise v4**

**Versión:** 4.0 Hotel Enterprise SDD (Fase 4 Completada)  
**Fecha de actualización:** Agosto 2026  
**Enfoque de Producto:** Benchmark frente a PMS líderes (*Cloudbeds, Mews, Oracle Opera Cloud, HotelKey*)  
**Metodología:** Specification-Driven Development (SDD)  
**Stack Visual:** Tailwind CSS v3 + Framer Motion v11 + GSAP 3 + Lucide Icons + Recharts  

---

## 📑 TABLA DE CONTENIDOS
1. [Filosofía de Diseño Hotelero Ejecutivo](#1-filosofía-de-diseño-hotelero-ejecutivo)
2. [Estructura de Módulos y Agrupamiento del Sidebar](#2-estructura-de-módulos-y-agrupamiento-del-sidebar)
3. [Nuevas Features Arquitectónicas (v4.0)](#3-nuevas-features-arquitectónicas-v40)
4. [Paleta de Colores Semántica & Multi-Modo](#4-paleta-de-colores-semántica--multi-modo)
5. [Jerarquía Tipográfica & Cifras Tabulares](#5-jerarquía-tipográfica--cifras-tabulares)
6. [Arquetipos de Tarjeta Operativa Hotelera](#6-arquetipos-de-tarjeta-operativa-hotelera)
7. [Sistema de Animaciones GSAP & Tiempos](#7-sistema-de-animaciones-gsap--tiempos)
8. [Componentes Reutilizables Compartidos](#8-componentes-reutilizables-compartidos)
9. [Reglas de Adaptabilidad Móvil y Ultra-Wide](#9-reglas-de-adaptabilidad-móvil-y-ultra-wide)
10. [Prácticas de Tipado y Code Quality (TS)](#10-prácticas-de-tipado-y-code-quality-ts)

---

## 1. Filosofía de Diseño Hotelero Ejecutivo

**PMS JCAR LABS** adopta una identidad visual **Hotel Enterprise**, distanciándose de dashboards genéricos para alinearse con los mejores PMS de la industria:
- **Lectura Inmediata Operativa (< 0.5s):** Reconocimiento cromático y numérico instantáneo de estados de habitaciones, saldos pendientes y Check-in/Check-out.
- **Densidad Ejecutiva Informativa:** +40% de datos útiles por pantalla (Ocupación %, ADR, RevPAR, Arqueo de Caja y comprobantes DIRCETUR/SUNAT) sin saturación visual.
- **Ergonomía Anti-Fatiga (Jornadas 8-12 Horas):** Alto contraste WCAG 2.2 AA en Light Mode y Dark Mode OLED (`#0a0a0a`), con cifras monetarias en `tabular-nums font-extrabold`. Se priorizan colores semánticos puros (`bg-background`, `bg-card`, `text-foreground`).
- **Identidad de Hotelería de Lujo (Esmeralda & Oro):** Acentos en verde esmeralda (disponibilidad y hospitalidad) y oro harvest (finanzas y fidelidad).

---

## 2. Estructura de Módulos y Agrupamiento del Sidebar

El sistema cuenta con 11 módulos organizados en 3 bloques funcionales dentro de la navegación principal (`Layout.jsx`):

### 📌 RECEPCIÓN Y HABITACIONES
| Módulo | Ruta | Ícono | Descripción Operativa |
| :--- | :--- | :--- | :--- |
| **Dashboard** | `/` | `<LayoutGrid />` | Visión ejecutiva, ocupación real, ADR, RevPAR y Bento Grid |
| **Recepción** | `/recepcion` | `<CalendarDays />` | Matriz de reservas, Check-in / Check-out, **Timeline Horizontal** y WhatsApp/DIRCETUR |
| **Habitaciones** | `/habitaciones` | `<BedDouble />` | Catálogo de cuartos organizados en **Floor Plan** arquitectónico |
| **Huéspedes** | `/huespedes` | `<Users />` | Directorio de clientes y fichas oficiales DIRCETUR |
| **Limpieza** | `/limpieza` | `<BroomIcon />` | Control de ama de llaves, estado de aseo y cronómetro |

### 💰 FINANZAS & INVENTARIO
| Módulo | Ruta | Ícono | Descripción Operativa |
| :--- | :--- | :--- | :--- |
| **Ventas y Tickets** | `/ventas` | `<CreditCard />` | Historial consolidado de ventas del hotel y Minimarket POS |
| **Caja** | `/caja` | `<Wallet />` | Arqueo de caja, egresos, ingresos de turno y SUNAT |
| **Punto de Venta** | `/pos` | `<ShoppingCart />` | Ventas al contado y consumos cargados a la habitación |
| **Insumos** | `/insumos` | `<Package />` | Inventario interno de ropa de cama, aseo y repuestos |

---

## 3. Nuevas Features Arquitectónicas (v4.0)

Durante la implementación integral del rediseño, se integraron patrones estructurales avanzados:

1. **Floor Plan Visual (Habitaciones):**
   Las habitaciones ahora se renderizan mediante la estructura de datos `habitacionesAgrupadas`, separando visualmente los niveles del hotel mediante "Sticky Headers" (Piso 1, Piso 2, etc.).
2. **Timeline Horizontal de Recepción (Gantt):**
   Un componente especializado (`RecepcionTimeline.jsx`) basado en `date-fns` que calcula de forma nativa los intervalos de fechas para dibujar "bloques de reservas" a través del tiempo. Mejora la predicción de ocupación a 14 días.
3. **Command Palette Global (⌘K):**
   Un motor de búsqueda contextual omnipotente (`GlobalCommand.jsx`). Permite la búsqueda inteligente por número de habitación y muestra atajos directos (ej: Check-in rápido) sin recargar la página.
4. **GSAP Page Transitions (SPA Pura):**
   Las transiciones entre módulos están administradas por el `<PageTransition />` wrapper en el `Layout.jsx`, ejecutando animaciones interpoladas `fade-slide` en cada cambio de ruta (`key={location.pathname}`).
5. **Shimmer Skeleton Loaders:**
   Se incorporó un componente `PageSkeleton.jsx` que proporciona feedback inmediato durante el fetch de datos asíncronos con TanStack Query, mejorando el "Perceived Performance".

---

## 4. Paleta de Colores Semántica & Multi-Modo

El sistema está construido íntegramente sobre tokens semánticos (CSS variables en `index.css`), permitiendo una conmutación ininterrumpida entre **Light Mode** y **Dark Mode (OLED)** sin forzar clases rígidas (`slate-900`, etc.).

- Superficies globales: `bg-background`
- Superficies elevadas (Paneles): `bg-card` o `bg-popover`
- Bordes estructurales: `border-border`
- Textos primarios: `text-foreground` y `text-muted-foreground`

### 🛌 Estados de Habitación (`state.*`)
| Estado | Token Tailwind | Hex Base (Light/Dark) | Propósito Operativo |
| :--- | :--- | :--- | :--- |
| **Disponible** | `state-disponible` | Emerald `#10B981` | Limpia y lista para Check-in |
| **Ocupada** | `state-ocupada` | Red `#EF4444` | Huésped hospedado activamente |
| **Reservada** | `state-reservada` | Purple/Blue | Check-in pendiente programado |
| **Mantenimiento** | `state-mantenimiento` | Amber `#F59E0B` | Fuera de servicio por reparación |
| **Limpieza** | `state-limpieza` | Light Blue | Habitación sucia o en aseo |

---

## 5. Jerarquía Tipográfica & Cifras Tabulares

- **Fuente UI:** `Inter` (`font-inter`, sans-serif).
- **Fuente Display:** `Playfair Display` (para facturas premium, checks, headers de lujo).
- **Cifras Monetarias & Conteos:** `tabular-nums font-extrabold tracking-tight` en todas las pantallas.

| Elemento | Clases Tailwind | Propósito |
| :--- | :--- | :--- |
| **Display Totales** | `text-2xl sm:text-4xl font-extrabold tabular-nums` | Totales de Caja y POS |
| **H1 (Módulo)** | `text-2xl sm:text-3xl font-black tracking-tight` | Encabezado principal de cada módulo |
| **H2 (Sección)** | `text-base sm:text-lg font-bold tracking-tight` | Títulos de bloques, Bento Cards |
| **KPI Numbers** | `text-2xl sm:text-3xl font-bold tabular-nums` | Cifras financieras y ocupación % |
| **Form Labels** | `text-[10px] font-black uppercase tracking-widest` | Etiquetas de entradas y headers tabla |

---

## 6. Arquetipos de Tarjeta Operativa Hotelera

1. **Enterprise Card 2.0 (`.enterprise-card`):**
   Clase CSS maestra (`index.css`) que implementa la estética Stripe/Linear. Unifica bordes translúcidos (`border-border/60`), múltiples capas de `box-shadow` suaves y animaciones GSAP integradas de escalado al pasar el cursor (Hover States).
2. **Glass Panel (`.glass-panel`):**
   Superficie ultraligera con `backdrop-blur-3xl`, empleada de forma exclusiva en modales, Command Palette y menús flotantes.
3. **KPI Gerencial Card:** Métrica de 28-32px, etiqueta superior 11px uppercase y chip porcentual animado.

---

## 7. Sistema de Animaciones GSAP & Tiempos

El PMS utiliza **GreenSock (GSAP 3)** acoplado a React (`gsap.context`) para prevenir problemas de ciclo de vida en *Strict Mode*.

- **Transiciones de Página:** `<PageTransition />` ejecuta una interpolación limpia de `y: 8px -> 0px` y `opacity: 0 -> 1` con duración de `350ms` (Curva `power3.out`).
- **Feedback Háptico Visual (CSS):** Regla global en `index.css`: `button:active { transform: scale(0.97); }` que otorga al software un peso físico inmediato al hacer clic.
- **Micro-interacciones (Staggers):** Las listas renderizadas emplean `gsap.fromTo` con `stagger: 0.04` para generar un efecto dominó fluido sin comprometer los frames del navegador.

---

## 8. Componentes Reutilizables Compartidos

1. **`<StatusBadge status="..." />`:**
   Atributo ARIA `role="status"`, opacidad del 15% y bordes de alta definición adaptables al modo oscuro.
2. **`<Button />`:**
   Botonería táctil de `min-h-[40px]` (cumplimiento móvil) y `rounded-xl`.
3. **`<PageTransition />`:**
   Wrapper oficial de páginas inyectado en `Layout.jsx` en el `<Outlet />`.
4. **`<PageSkeleton />`:**
   Loader semántico animado en CSS infinito (`bg-[length:200%_100%]`).

---

## 9. Reglas de Adaptabilidad Móvil y Ultra-Wide

1. **Contenedor Ultra-Wide:** `max-w-[1800px] w-full mx-auto` para pantallas de 1920px a 2560px.
2. **Touch Targets:** Mínimo 40px a 44px de área táctil en teléfonos y tablets de recepción.
3. **Responsive Mobile Nav:** Barra flotante inferior (`safe-bottom`) con `backdrop-blur-2xl` que agrupa accesos rápidos (Inicio, Recepción, Rooms, POS) para operación a 1 mano.

---

## 10. Prácticas de Tipado y Code Quality (TS)

A pesar de ser un proyecto nativo en JavaScript (`.jsx`), el código ha sido enriquecido con anotaciones JSDoc inline para garantizar soporte pleno de autocompletado y validación de tipos en entornos de desarrollo (IDE como VS Code) a través del Language Server de TypeScript (`@ts-check`).

1. **Componentes Puros (`memo`)**:
   Se utiliza el patrón de casting inline `/** @type {any} */` o especificaciones exhaustivas JSDoc dentro de la firma de la función envuelta, para asegurar validación correcta de props sin generar errores de tipo Intrínseco.
2. **Hooks de Mutación (React Query)**:
   Se ha estabilizado el tipado explícito de argumentos (por ejemplo, en `useMutation`) para prevenir inferencia `void` por parte de TypeScript, asegurando la escalabilidad del sistema sin falsos positivos en los lint checks.
3. **Cero Errores:** La consola y el panel de Problemas del IDE se mantienen siempre en `0` errores, reflejando altos estándares de ingeniería y código seguro en producción.
