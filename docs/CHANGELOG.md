# Historial de Cambios (Changelog)

Este documento registra los cambios más relevantes, mejoras arquitectónicas y soluciones a errores en el PMS JCAR LABS.

## [3.0.0] - 26 de Agosto de 2026 (Go-Live a Producción)

### Infraestructura y Estabilización (Hotfixes de Producción)
- **Supabase Vault para Tareas Cron:** Se refactorizaron los `pg_cron` jobs (`facturacion-worker`, `expire-ai-booking-artifacts`, `expire-loyalty-points`) para no depender de configuraciones de variables globales bloqueadas en instancias manejadas. Ahora el `service_role_key` se desencripta en tiempo real desde Supabase Vault (migración `20260825000003_setup_cron_jobs.sql`).
- **Completado de Esquema:** Se inyectaron en producción las columnas faltantes (`logo_url`, `qr_yape_url`, `qr_plin_url`) requeridas por el frontend para las pasarelas de pago, mitigando fallos silenciosos HTTP 400 (migración `20260826000001_add_missing_hotel_columns.sql`).
- **Remediación de Auditoría:** Se completaron exitosamente todas las observaciones de la matriz de remediación de agosto 2026, consolidando el soporte Multi-Tenant (RLS perfecto), idempotencia de IA y transacciones atómicas de Caja.

### Frontend Refactoring Masivo (Arquitectura React Hooks)
- **Extracción de Lógica de UI (Separación Cerebro-Músculo):** Refactorización integral del 100% de las pantallas monolíticas (Dashboard, Habitaciones, Ventas, Limpieza, Recepción, Reportes, Huéspedes, Configuración, Booking Público, Revenue, POS y Login).
- **Hooks de Negocio (Domain Logic):** Toda la lógica de componentes (`useQuery`, `useMutation`, estados locales masivos, reglas de validación) extraída a hooks especializados (e.g. `useRecepcionData.js`, `useConfiguracionData.js`) alojados en el directorio `src/pages/<PageName>/hooks/`.
- **Estandarización de Componentes Puros:** Las páginas en `src/pages/` ahora son componentes React presentacionales casi al 100%, más testeables y fáciles de mantener, integrando animaciones GSAP de forma segura y declarativa.
- **Reducción de Deuda Técnica y Optimización Linting:** Resolución global de advertencias de variables sin uso, correcciones de importaciones y adherencia estricta a reglas de ESLint en toda la base de código.

## [2.0.0] - 22 de Agosto de 2026

### Nuevas Características Mayores (Supabase Edge Functions)
- **Facturación Electrónica SUNAT:** Nuevo módulo completo de generación de comprobantes (Facturas y Boletas). Implementación de Edge Functions nativas en Deno (`facturacion`, `xmlGenerator`, `xmlSigner`) con firmado criptográfico usando `xml-crypto` y envío al servicio web de SUNAT.
- **JcarAI (AI Gateway):** Integración con Google Gemini 2.0 Flash para habilitar un asistente conversacional inteligente. Incluye soporte nativo para *Tool Calling* permitiendo a la IA interactuar con la base de datos (inventario, políticas, disponibilidad) y responder contextualmente.
- **Channel Manager (OTA Sync):** Nuevas integraciones para sincronizar inventario (`ota-sync-inventory`) y tarifas (`ota-sync-rates`) bidireccionalmente con Agencias de Viajes Online (OTAs).
- **Pasarela de Pagos y Webhooks:** Nuevo ecosistema de pagos mediante `generate-payment`, `validate-gateway`, y `webhook-gateway` para procesar transacciones en línea de manera segura.
- **Portal del Huésped (Guest Portal & Pre-Checkin):** Rutas seguras (`public-booking`, `public-checkin`, `guest-portal`) para que los huéspedes gestionen su estancia antes de llegar al hotel.

### Integraciones y Mejoras Adicionales
- Integración oficial con DIRCETUR / MINCETUR para exportación de registros de huéspedes.
- Mensajería automatizada integrada vía WhatsApp (`whatsapp.service.ts`).
- Refactorización de dependencias Deno usando configuración explícita (`deno.json`) aislando el entorno Edge de Node.js, resolviendo problemas de caché (npm) y colisiones de LSP.

## [1.0.1] - 16 de Agosto de 2026

### Mejoras Arquitectónicas y Rendimiento (Web Workers & GSAP)
- **Migración a Web Workers para PDFs:** Se optimizó la generación de tickets POS y comprobantes (Facturas/Boletas) mediante el uso de Web Workers. Esto evita que el hilo principal del navegador se bloquee al generar documentos PDF con `jsPDF`, mejorando drásticamente la responsividad en dispositivos de gama baja.
- **Animaciones GSAP (`@gsap/react`):** Se integró la librería `gsap` para proveer animaciones y transiciones fluidas de alto rendimiento (aceleradas por GPU), reemplazando animaciones pesadas de CSS o estados de React en componentes críticos como el inicio de sesión y ventanas modales.

### UI/UX y Diseño Responsivo
- **Modal de Tickets (Ventas):** Se ajustaron los _paddings_ internos y externos del `DialogContent` en `Ventas.jsx` para evitar el desbordamiento horizontal en pantallas móviles.
- **Botones de Compartición (Inline Flex):** Se reescribió la disposición (`layout`) de los botones "PC / Web", "Android PWA", "Imprimir" y "Compartir" en los tickets para usar proporciones equitativas (`flex-1`) en vez de anchos fijos o envoltorios de grilla absolutos.
- **Tarjetas de Recepción (ReservaCard):** El botón de WhatsApp ahora implementa el icono SVG oficial, omitiendo texto innecesario y adoptando una forma de píldora compacta (`size="iconSm"`) que mantiene armonía geométrica con los botones contiguos de DIRCETUR y Check-out.

### TypeScript y Calidad de Código
- **Tipado Estricto de Recepción:** Se añadieron a la interfaz `Reserva` las propiedades requeridas para las declaraciones al Mincetur (`tipo_documento`, `huesped_fecha_nacimiento`, `huesped_profesion`, `huesped_estado_civil`, `huesped_destino`).
- **Compatibilidad del Servicio WhatsApp:** Se actualizó el contrato en `whatsapp.service.ts` para ingerir un objeto `Hotel` en vez del primitivo `ConfigHotel` (el cual carecía de la propiedad `nombre`).
- **Limpieza ESLint (CI/CD Quality Gate):** Se purgó la base de código de múltiples `imports` en desuso (ej. iconos de `lucide-react` y variables sin invocar en modales) para satisfacer las restricciones rígidas del pipeline en GitHub Actions (`eslint --max-warnings=0`).
