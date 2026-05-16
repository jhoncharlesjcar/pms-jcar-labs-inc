# 🏨 HOSPEDAJE ANGELICA FREY - System Hotel By Jcar Labs 🚀

[![Build and Deploy](https://github.com/jhoncharlesjcar/SISTEMA-GESTION-HOSPEDAJES/actions/workflows/deploy.yml/badge.svg)](https://github.com/jhoncharlesjcar/SISTEMA-GESTION-HOSPEDAJES/actions/workflows/deploy.yml)

Sistema de Gestión de Hospedajes profesional, diseñado con una arquitectura **Serverless / Multi-Tenant** y optimizado para el mercado peruano. Este sistema ofrece una solución integral desde la recepción hasta el punto de venta (POS), garantizando seguridad, rapidez operativa y una experiencia de usuario (UX/UI) **Premium**.

---

## 🌟 Características Principales

### 🏨 Gestión Hotelera Integral
*   **Recepción Dinámica**: Mapa visual interactivo de estado de habitaciones (Verde: Disponible, Rojo: Ocupada). Permite Check-in y Check-out en 3 clics.
*   **Dashboard Gerencial**: Visualización animada en tiempo real de porcentaje de ocupación, ingresos del día y resumen de ventas.
*   **Gestión de Inventario (Habitaciones)**: Control total sobre números, pisos, tipos (Simple, Matrimonial, Queen) y comodidades (WiFi, TV, Baño).
*   **Prevención de Errores**: Sistema anti-duplicados y validación estricta de formularios para mantener la integridad de los datos.

### 🛒 Finanzas y Punto de Venta (POS)
*   **Liquidación Automática**: Suma automática de noches de hospedaje y consumos extras (Minimarket).
*   **Integración de Pagos**: Múltiples opciones de cuadre de caja (Efectivo, Yape, Plin, Transferencia, Tarjetas).
*   **Historial de Ventas**: Registro inmutable de transacciones para facilitar el arqueo de caja al final del turno por parte de gerencia.

### 🖨️ Hardware & Impresión Térmica
*   **Compatibilidad ESC/POS**: El sistema genera el código de impresión en crudo estructurado desde el navegador web.
*   **Conexión Bluetooth Android (RawBT)**: Envía tickets directamente a mini-impresoras térmicas del mostrador sin ventanas emergentes (pop-ups) que estorben el flujo de trabajo.

---

## 🛠️ Arquitectura y Tech Stack

Este proyecto es una **Aplicación Web Progresiva (PWA)** enfocada en la fluidez de interacciones y velocidad extrema, eliminando recargas de página.

*   **Frontend Core**: React 18 + Vite (SPA).
*   **Gestión de Estado y API**: `@tanstack/react-query` v5 (Mutaciones optimistas y sincronización asíncrona).
*   **Base de Datos y Auth**: Supabase (PostgreSQL en la Nube).
*   **Diseño Base y UI**: Tailwind CSS + Shadcn UI + Lucide Icons.
*   **Animaciones y UX Premium**: `framer-motion` (Transiciones fluidas, contadores numéricos estilo odómetro, Glassmorphism activo).
*   **Theme y Colores**: Soporte nativo para *Dark Mode OLED* (Intense Black) y *Light Mode*, preservando la paleta de colores del negocio mediante variables CSS dinámicas.

---

## 🔄 Flujo Operativo del Negocio

1. **Llegada del Huésped**: El recepcionista verifica en el mapa visual la disponibilidad y toma los datos personales e ingresa los días de hospedaje (Check-in). La habitación seleccionada pasa instantáneamente a color **Rojo (Ocupada)**.
2. **Estadía y Consumos Cruzados**: Durante la estadía se pueden registrar los servicios extras o productos adquiridos cargándolos al total de la habitación.
3. **Salida (Check-out)**: El sistema calcula la deuda total consolidada al momento que el huésped entrega la llave.
4. **Liquidación y Cobro**: Se procesa el pago eligiendo el método seleccionado por el cliente (Efectivo, Yape, etc.).
5. **Liberación e Impresión**: Al confirmar el cobro, la habitación pasa a estado de **Mantenimiento/Disponible** e instantáneamente se dispara la impresión térmica del Ticket de control por Bluetooth.
6. **Auditoría Diaria**: El dueño/administrador visualiza en su Dashboard en tiempo real el dinero ingresado, el cual ya está desglosado automáticamente por método de pago para facilitar un cuadre y arqueo de caja perfecto.

---

## 🚀 Instalación y Despliegue Local

Para correr este proyecto en tu entorno local:

1. Clona el repositorio:
   ```bash
   git clone https://github.com/jhoncharlesjcar/SISTEMA-GESTION-HOSPEDAJES.git
   ```
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Configura tus variables de entorno creando un archivo `.env` en la raíz del proyecto:
   ```env
   VITE_SUPABASE_URL=tu_supabase_url
   VITE_SUPABASE_ANON_KEY=tu_supabase_key
   ```
4. Inicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```

## 🌐 Producción

El proyecto está configurado con integración continua (CI/CD) vía GitHub Actions. Cualquier `push` hacia la rama `main` iniciará automáticamente el *build* y se desplegará en producción a través de la plataforma de edge network **Vercel**.

---
*Desarrollado con ❤️ por Jcar Labs para Hospedaje Angelica Frey.*
