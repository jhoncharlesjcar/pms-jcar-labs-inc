# PMS JCAR LABS - Sistema de Gestión Hotelera Avanzado

![PMS JCAR LABS Cover](./public/logo.png)

**PMS JCAR LABS** es un Sistema de Gestión de Propiedades (PMS - Property Management System) de última generación, multi-tenant (multi-hotel) y diseñado específicamente para el mercado hotelero moderno, cumpliendo estrictamente con las regulaciones gubernamentales (como DIRCETUR en Perú).

La plataforma permite gestionar de manera unificada las reservas, housekeeping, el punto de venta (POS), reportes analíticos y la auditoría de seguridad, con una interfaz **altamente adaptativa (Mobile-First y Responsiva)**.

---

## 🚀 Características Principales y Novedades

### 🏨 Gestión Integral de Recepción (Front Desk)
- **Matriz de Habitaciones Dinámica:** Visualización interactiva del estado de todas las habitaciones (disponible, ocupada, reservada, limpieza, mantenimiento).
- **Registro de Huéspedes e Integración DIRCETUR:** Captura completa de datos de huéspedes y generación de la Ficha de Registro Oficial en PDF.
- **Tarjetas Dinámicas Responsivas:** Interfaz adaptativa en móviles con visualización compacta de cobros y acciones rápidas (WhatsApp, Check-out, PDF).

### 💳 Punto de Venta (POS) y Minimarket
- **Catálogo Visual y Táctil:** Minimarket integrado con categorías deslizables (UI optimizada con `flex-shrink-0` para pantallas táctiles).
- **Cobros Consolidados:** Venta de productos directos a la cuenta de la habitación o al contado.
- **Historial de Ventas Detallado:** Tabla de registros que permite rastrear fácilmente origen (Hotel vs POS) y método de pago (Efectivo, Tarjeta, Yape, Plin).

### 🧹 Gobernancia y Control Operativo
- **Panel Mobile para Limpieza:** Interfaz optimizada para que el personal de limpieza reporte habitaciones terminadas desde el celular sin romper el diseño de pantalla.
- **Mantenimiento Técnico:** Capacidad de bloquear habitaciones temporalmente con notas técnicas.

### 🇵🇪 Facturación Electrónica SUNAT Automatizada (API REST & Edge Function)
- **API REST Serverless**: Endpoint en Supabase Edge Function (`/functions/facturacion`) que aísla por completo las operaciones tributarias de la interfaz de usuario.
- **Firmado Digital XAdES-BES & UBL 2.1**: Generación de archivos XML UBL 2.1 oficiales de Boletas (tipo `03`) y Facturas (tipo `01`) firmados en tiempo real con certificados digitales en memoria (Deno).
- **Emisión en Tiempo Real & SOAP**: Envío automático de archivos ZIP a través del protocolo SOAP a los servidores de SUNAT (Sandbox/Producción) y almacenamiento nativo de las Constancias de Recepción (CDR) y tickets de envío.
- **Credenciales en Ajustes**: Panel animado para configurar RUC Emisor, Usuario SOL y Clave SOL directamente desde la vista del Administrador.

### 🪪 Autocompletado DNI/RUC (Microservicio Decolecta)
- **Extracción Nativa:** Auto-llenado instantáneo de nombres y razones sociales en modales de Check-in y Facturación con solo digitar el documento.
- **Caché Inteligente DB:** Edge Function que optimiza peticiones y ahorra saldo guardando temporalmente (TTL 30 días para DNI, 1 día RUC) las consultas recurrentes directamente en la base de datos PostgreSQL de Supabase.
- **Fallback Automático:** Resuelve fallos de API de terceros con alertas amigables tipo Toast en la UI.

### 📊 Dashboard e Inteligencia de Negocios
- **Reportes Analíticos:** Gráficos de barras y tortas interactivos (Recharts) comparando ingresos de Hotel y POS.
- **Panel de Desarrollador y Auditoría Inmutable:** Registro de seguridad en tiempo real que traza todas las acciones de los usuarios (Check-ins, cobros, anulaciones) para garantizar la transparencia.

---

## 📈 Documentación del Flujo de Negocio (Business Flow)

El sistema PMS JCAR LABS modela la operación diaria de un hotel a través de un flujo interconectado:

### 1. Ingreso y Registro (Check-in)
El usuario (Recepcionista) crea una nueva reserva. El sistema solicita datos del cliente (nombre, DNI/Pasaporte) y detalles de la estancia (fechas, número de acompañantes). Una vez confirmada, el estado de la habitación cambia a **"Ocupada"** o **"Reservada"**.
> *Acción secundaria:* El recepcionista puede generar la ficha DIRCETUR en PDF y enviarla por WhatsApp.

### 2. Consumos Durante la Estancia (Punto de Venta)
A lo largo de la estancia, el huésped puede adquirir productos del Minimarket. El recepcionista registra estos consumos desde la vista **POS** y puede cobrarlos al instante o asignarlos a la cuenta de la habitación (para cobro al final).

### 3. Salida y Cobro (Check-out)
Al concluir la estancia, el recepcionista selecciona "Check-out" desde la Recepción. El sistema consolida automáticamente el costo de las noches más cualquier consumo del Minimarket pendiente en la cuenta. Se procede al pago seleccionando el método (Efectivo, Yape, Tarjeta) y se emite un comprobante virtual (Ticket). El estado de la habitación pasa inmediatamente a **"Limpieza"**.

### 4. Gobernancia y Limpieza
El personal de limpieza, ingresando al sistema desde su dispositivo móvil, visualiza las habitaciones que requieren atención. Una vez finalizada la limpieza, el usuario cambia el estado a **"Disponible"**, retornándola al circuito de ventas de la Recepción.

### 5. Cierres de Caja y Auditoría
Al finalizar un turno, el administrador o recepcionista ingresa al módulo de **Caja** para generar el reporte de turno, cuadrado con todos los métodos de pago. Paralelamente, el **Audit Center** guarda una bitácora inmutable de seguridad que registra (Usuario, Fecha, Acción y Monto) para prevenir fraude interno.

---

## 🛠️ Stack Tecnológico

**Frontend:**
- **React 18** + **Vite** con PWA habilitado (Offline caching & NetworkFirst strategy).
- **Tailwind CSS** + **Framer Motion** (Animaciones fluidas y UI/UX mobile-first premium).
- **React Query (TanStack Query v5)** para gestión asíncrona robusta.

**Backend & Base de Datos:**
- **Supabase (PostgreSQL)** (Autenticación y BaaS en tiempo real).
- **Row Level Security (RLS)** asegurando un entorno Multi-Tenant (Cada hotel solo ve su data).

---

## ⚙️ Configuración y Despliegue Local

### 1. Variables de Entorno
Crea el archivo `.env.local`:
```env
VITE_SUPABASE_URL=https://<tu-proyecto>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUz...
```

### 2. Instalación y Ejecución
```bash
npm install
npm run dev
```

*Nota para PWA:* El sistema usa Vite PWA plugin. Si realizas cambios en el esquema de base de datos, incrementa la versión de `cacheName` en `vite.config.js` para forzar la actualización de los navegadores móviles de los clientes.

---

**© 2026 JCAR LABS.** *Transformando la hotelería con tecnología moderna, fluida y segura.*
