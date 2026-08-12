# PMS JCAR LABS — Sistema de Gestión Hotelera Avanzado

![PMS JCAR LABS Cover](./public/logo.png)

**PMS JCAR LABS** es un Sistema de Gestión de Propiedades (PMS - Property Management System) de última generación, multi-tenant (multi-hotel) y diseñado específicamente para el mercado hotelero moderno, cumpliendo estrictamente con las regulaciones gubernamentales (como DIRCETUR en Perú) y la Facturación Electrónica SUNAT.

El sistema cuenta con una interfaz **SaaS Premium v2.0 Enterprise** basada en **Glassmorphism**, densidad ejecutiva de datos, componentes responsivos (PWA) y soporte para 11 módulos operativos independientes.

---

## 🚀 Características Principales y Novedades (V5 Enterprise Completa)

### 🎨 Estilo Visual & UX SaaS Premium v2.0
- **Glassmorphism:** Componentes y tarjetas con `bg-card/60 backdrop-blur-xl border border-border/50 shadow-xs`.
- **Estándar de Encabezado Icono Badge:** Todas las vistas poseen un contenedor de icono representativo (`w-10 h-10 rounded-xl bg-primary/15 border border-primary/20`) y tipografía `text-2xl sm:text-3xl font-bold tracking-tight`.
- **Cifras Financieras Tabulares:** Presentación numérica alineada con `tabular-nums` para lectura rápida.
- **Botonería de Acción Compacta:** Botones operativos ajustados a la escala `h-8` y `h-9` con radios `rounded-xl`.

### 🏨 Recepción y Front Desk (Check-in / Check-out)
- **Matriz de Habitaciones Dinámica:** Control interactivo de estados (*disponible*, *ocupada*, *reservada*, *limpieza*, *mantenimiento*).
- **Huéspedes e Integración DIRCETUR:** Autocompletado instantáneo por DNI/RUC con la API Decolecta y exportación oficial de Fichas de Registro DIRCETUR en Excel y PDF.
- **OCR Integrado (El Cerebro y el Ojo):** Escaneo de DNIs mediante la cámara web usando Tesseract.js para autocompletar formularios en menos de 4 segundos.
- **Fuzzy Search & Offline-First:** Búsqueda difusa ultrarrápida de clientes recurrentes cacheada en IndexedDB para respuestas instantáneas.

### 🛒 Punto de Venta (POS) y Minimarket
- **Catálogo Visual Táctil:** Minimarket con categorías deslizables y precios destacados en `text-base font-extrabold text-emerald-600`.
- **Cobros Asignados o al Contado:** Capacidad de cargar consumos directo a la cuenta de la habitación o efectuar cobros inmediatos.
- **Configuración Dual de Pagos (El Switch de Oro):** Alterna fácilmente entre cobros manuales (QRs estáticos en Supabase Storage) o automáticos (Pasarelas como Culqi, Izipay, Niubiz) mediante llaves cifradas con AES-256.
- **Flujo de Cobro Inteligente y Webhooks:** Generación de QRs dinámicos, integración con Webhooks vía Edge Functions y sincronización Real-Time con UI (efecto de éxito automático sin recargar la página).

### 🧹 Limpieza & Housekeeping (Vector `<BroomIcon />`)
- **Gestión de Aseo:** Identidad visual única con vector SVG de escoba `<BroomIcon />`, cronómetro de tiempo transcurrido en aseo y botón directo para marcar habitaciones listas.

### 📦 Insumos y Suministros (Módulo Independiente `/insumos`)
- **Control de Inventario Interno:** Gestión de artículos de aseo, sábanas y repuestos con 4 tarjetas KPI (*Ítems registrados, Stock bajo, Ingresos hoy, Salidas hoy*).
- **Generación Automática de Egresos:** Registro automático en Caja cuando una compra de insumos incluye costo.

### 💰 Caja y Auditoría Financiera
- **Optimización de Layout:** Elevación del encabezado en un ~20% y métricas compactas (*Ingresos, Egresos, Balance*).
- **Auditoría Inmutable:** Registro de trazabilidad de operaciones para control anti-fraude.

### 📊 Reportes y Analítica
- **Filtros por Origen y Turno:** Filtros por periodo, origen (*Hotel / POS*) y turno de trabajo (*Mañana, Tarde, Noche*).
- **Gráficos Interactivos Recharts:** Curva temporal de ingresos y gráfico de torta de métodos de pago con exportación a PDF y Excel.

### 🇵🇪 Facturación Electrónica SUNAT (Edge Functions)
- **Firma UBL 2.1 & XML:** Emisión automática de Boletas y Facturas firmadas mediante Supabase Edge Functions con certificados PEM.

### 📈 Revenue Management & Business Intelligence (Sprint 5)
- **Dashboard Analítico Avanzado:** KPIs en tiempo real (ADR, RevPAR, Ocupación %) y forecasting de 7 días.
- **Yield Management Inteligente:** Sugerencias automáticas de ajuste de tarifas basadas en picos de demanda y ocupación (Estrategia Acumulativa-Multiplicativa).

### 🎯 Marketing CRM Integrado (Sprint 6)
- **Segmentación de Huéspedes:** Creación de públicos objetivos (VIPs, Frecuentes, Corporativos).
- **Campañas y Plantillas:** Diseño de campañas de Email y plantillas de WhatsApp para impulsar reservas directas.

### 🛎️ Portal del Huésped / Guest Experience (Sprint 7)
- **WebApp "Mobile-First":** Acceso sin descargas (`/portal/:reservaId`) vía código QR en la habitación.
- **Room Service & Conserjería:** Catálogo en vivo de productos del Minimarket para pedir a la habitación, y contacto instantáneo con Recepción mediante WhatsApp pre-configurado.

### 🌐 Ecosistema Abierto (APIs y Webhooks) (Sprint 8)
- **Developer Hub Integrado:** Panel para propietarios donde pueden generar **API Keys** seguras y registrar endpoints de **Webhooks** (e.g. `reserva.creada`, `pago.registrado`) para conectar con Zapier, Make.com o ERPs de terceros.

---

## 🗺️ Mapa de Módulos del Sistema

| Módulo | Ruta | Icono Badge | Descripción Operativa |
| :--- | :--- | :--- | :--- |
| **Dashboard** | `/dashboard` | `<LayoutGrid />` | Visión ejecutiva y Bento Grid de ocupación |
| **Recepción** | `/recepcion` | `<ConciergeBell />` | Matriz de cuartos, check-in y asignaciones |
| **Habitaciones** | `/habitaciones` | `<BedDouble />` | Administración de catálogo de cuartos y tarifas |
| **Huéspedes** | `/huespedes` | `<Users />` | Directorio de clientes y reportes DIRCETUR |
| **Ventas y Tickets** | `/ventas` | `<Receipt />` | Historial consolidado de ventas de Hotel y POS |
| **Caja** | `/caja` | `<Wallet />` | Arqueo de caja, egresos y comprobantes |
| **Punto de Venta** | `/pos` | `<ShoppingCart />` | Ventas al contado y consumo rápido de Minimarket |
| **Limpieza** | `/limpieza` | `<BroomIcon />` | Control de ama de llaves y estado de aseo |
| **Insumos y Suministros** | `/insumos` | `<Package />` | Inventario interno de limpieza y compras |
| **Reportes** | `/reportes` | `<FileText />` | Analítica de ingresos, gráficos y descargas |
| **Configuración** | `/configuracion` | `<Settings />` | Datos del hotel, SUNAT, APIs, Webhooks y preferencias |
| **Panel Desarrollador**| `/dev` | `<Terminal />` | Diagnóstico, Logs, Auditoría y Control de Tenants |
| **Portal Huésped**| `/portal/:id` | `<Globe />` | (Pública) WebApp para Room Service, Saldo y Conserjería |
| **Booking Engine**| `/booking/:id` | `<Calendar />` | (Pública) Motor de Reservas Directas sin comisiones OTA |

---

## 🛠️ Stack Tecnológico

- **Frontend:** React 18 + Vite 6 + Tailwind CSS v3 + Framer Motion v11 + GSAP 3 + Canvas Confetti
- **Data Fetching:** TanStack React Query v5
- **Iconos & UI:** Lucide React + shadcn/ui
- **Type Checking:** Soporte JSDoc estricto (`@ts-check`) en entornos puros JS para 0 errores de Lint.
- **Backend & DB:** Supabase (PostgreSQL 15 con Row Level Security Multi-Tenant, Realtime WebSockets)
- **Edge Functions (Deno):**
  - Facturación XML SUNAT UBL 2.1
  - Consulta Decolecta DNI/RUC
  - Validación de Pasarelas y Webhook Gateway (`generate-payment`, `webhook-gateway`, `validate-gateway`)
- **Inteligencia:** Tesseract.js para OCR de documentos de identidad.

---

## ⚙️ Ejecución Local

```bash
# 1. Instalar dependencias
pnpm install

# 2. Iniciar servidor de desarrollo
pnpm run dev
```

---

**© 2026 JCAR LABS.** *Transformando la hotelería con tecnología moderna, fluida y segura.*
