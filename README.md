# HOSPEDAJE ANGELICA FREY - System Hotel By Jcar Labs 🚀

[![Build and Deploy](https://github.com/jhoncharlesjcar/SISTEMA-GESTION-HOSPEDAJES/actions/workflows/deploy.yml/badge.svg)](https://github.com/jhoncharlesjcar/SISTEMA-GESTION-HOSPEDAJES/actions/workflows/deploy.yml)

Sistema de Gestión de Hospedajes profesional, diseñado con una arquitectura **Multi-Tenant** y **SaaS-Ready**, optimizado para el mercado peruano. Este sistema ofrece una solución integral desde la recepción hasta el punto de venta, garantizando seguridad, rapidez y una experiencia de usuario premium.

---

## 🌟 Características Principales

### 🏨 Gestión Hotelera Integral
*   **Dashboard Interactivo**: Visualización en tiempo real de ocupación, ingresos y estados de habitación.
*   **Control de Recepción**: Check-in/Check-out rápido con generación automática de tickets.
*   **Gestión de Habitaciones**: Clasificación por tipos (Simple, Doble, Suite, etc.) y estados dinámicos.

### 🛒 Punto de Venta (POS) Minimarket
*   **Catálogo Digital**: Gestión de productos y servicios extra.
*   **Ventas Rápidas**: Interfaz optimizada para pantallas táctiles y tablets.
*   **Integración de Pagos**: Soporte para Efectivo, Yape, Plin, Transferencias y Tarjetas.

### 🛡️ Seguridad y Arquitectura
*   **Multi-Tenancy Real**: Aislamiento de datos total mediante **Row Level Security (RLS)** de Supabase. Cada hotel opera en su propio contenedor lógico.
*   **Roles y Permisos**: Niveles de acceso diferenciados (Developer, Admin, Recepcionista).
*   **PWA Ready**: Instalable en dispositivos móviles con soporte para funcionamiento offline mediante Service Workers.

---

## 🛠️ Stack Tecnológico

*   **Frontend**: React 18 + Vite (Velocidad de carga superior).
*   **Styling**: Tailwind CSS + Shadcn/UI (Diseño moderno y profesional).
*   **Backend**: Supabase (PostgreSQL) con autenticación integrada.
*   **State Management**: TanStack Query (Caché inteligente y sincronización).
*   **Iconografía**: Lucide React.
*   **PWA**: Vite Plugin PWA.

---

## 🚀 Instalación y Configuración

### 1. Clonar el repositorio
```bash
git clone https://github.com/jhoncharlesjcar/SISTEMA-GESTION-HOSPEDAJES.git
cd SISTEMA-GESTION-HOSPEDAJES
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Variables de Entorno
Crea un archivo `.env` en la raíz con tus credenciales de Supabase:
```env
VITE_SUPABASE_URL=tu_url_de_supabase
VITE_SUPABASE_ANON_KEY=tu_anon_key
```

### 4. Iniciar en Desarrollo
```bash
npm run dev
```

---

## 📦 Despliegue (Production)

El proyecto incluye un pipeline de **CI/CD** mediante GitHub Actions. Para compilar manualmente:
```bash
npm run build
```
Los archivos optimizados se generarán en la carpeta `dist/`.

---

## 📜 Licencia y Propiedad Intelectual

**© Jcar Labs - Todos los derechos reservados.**

Este software y su código fuente son propiedad exclusiva de **Jcar Labs**. Queda prohibida la reproducción, distribución o modificación no autorizada de este código sin el consentimiento expreso del propietario.

*   **Desarrollado por**: Jcar Labs
*   **Branding**: HOSPEDAJE ANGELICA FREY
*   **Versión**: 2.1.0 (Producción)

---

> **Nota**: Este sistema ha sido auditado para garantizar la máxima estabilidad en entornos de alta demanda. Para soporte técnico, contactar con el equipo de **Jcar Labs**.
