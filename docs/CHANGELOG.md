# Historial de Cambios (Changelog)

Este documento registra los cambios más relevantes, mejoras arquitectónicas y soluciones a errores en el PMS JCAR LABS.

## [3.2.0] - 7 de Septiembre de 2026

### Auditoría Técnica y Remediación Integral
- **Seguridad en Base de Datos & Cron Jobs:**
  - Migración `20260907000001_fix_cron_auth_headers.sql`: inyección mandatoria de cabeceras de autorización `Bearer` vía `service_role` en tareas programadas ejecutadas con `pg_net`.
  - Migración `20260907000002_unique_cierre_caja.sql`: restricción de unicidad e idempotencia en `cierres_caja` por hotel, fecha operativa y turno, impidiendo duplicidad contable.
  - Migración `20260907000003_validate_cierre_caja_saldo.sql`: validación mediante check constraint para evitar saldos iniciales o finales negativos en cierres de caja.
- **Edge Functions & Facturación SUNAT:**
  - `auth-middleware.ts`: verificación activa y estricta de la sesión de Supabase Auth en funciones protegidas, rechazando tokens inválidos o revocados en servidor.
  - `xmlSigner_test.ts`: suite de pruebas en Deno 2.x para validación criptográfica del firmado XML UBL 2.1 (digest SHA-256, canonicalización C14N y firma RSA-SHA256).
- **Quality Gates y Cobertura de Pruebas:**
  - Ampliación de la suite de pruebas unitarias Vitest a 122 tests pasando limpiamente (13 archivos de prueba), incluyendo `hotel.service.test.ts` y `whatsapp.service.test.ts`.
  - Creación de prueba de humo E2E Playwright en `tests/e2e/booking-flow.spec.ts` para validar el flujo crítico de reserva.
  - Corrección de sintaxis y validación condicional de secrets en workflows de GitHub Actions (`deploy.yml` y `staging-migrations.yml`).

### Experiencia de Usuario (UX/UI), Accesibilidad y Motion
- **Limpieza (Housekeeping Móvil):**
  - Implementación de **Optimistic UI** con actualización inmediata del estado de la habitación y notificación Toast con opción de deshacer (*Undo*) durante 4 segundos.
  - Barra de KPIs compactada a una sola fila horizontal en pantallas móviles pequeñas (`< sm`) con métricas densas y legibles.
  - Ampliación de botones de acción rápida a un mínimo de 50px de altura para facilitar la operación táctil con una sola mano.
- **Recepción & POS (Tablet & Desktop):**
  - `RecepcionTimeline`: fijación de la columna de habitaciones (`sticky left-0`) con sombra divisoria para mantener la visibilidad durante el scroll horizontal de fechas.
  - `CarritoMinimarket`: ampliación de botones incrementales (+/-) a objetivos táctiles mínimos de 44 × 44 px conforme a WCAG 2.5.5 / 2.5.8.
  - `NuevaReservaSheet`: eliminación del retraso stagger en el selector de habitaciones para renderizado inmediato en hoteles con alto volumen de inventario.
- **JcarAI Gateway & Chat:**
  - Adaptación de la ventana de chat a un bottom-sheet en pantallas móviles con indicador de tipeo pulsante de 3 puntos.
- **Analítica y Visualización de Datos (Desktop Admin):**
  - Gráficos Recharts en `Reportes.jsx` y `Revenue.jsx` refactorizados con altura explícita responsiva (`h-[280px]` en móvil, `h-[320px]` en tablet/desktop) eliminando distorsiones y desbordamientos.
  - Eje X optimizado con `interval="preserveStartEnd"` y formateo legible de fechas.
  - Equilibrio de la cuadrícula en Reportes mediante incorporación de tabla de auditoría operativa reciente.
- **Optimización de Animaciones GSAP:**
  - Migración a transformaciones exclusivas por GPU (`transform`, `opacity`), evitando recálculos de layout por propiedades `height`/`top`/`left`.
  - Soporte nativo para `prefers-reduced-motion` en hooks (`useGsapCardHover`, `useGsapStaggerList`) y componentes clave (`PageTransition`).
  - Desactivación de transiciones `:hover` en pantallas táctiles (`@media (hover: hover)`).
  - Purga de estilos no utilizados de Lenis y parallax en `gsap.css`.

## [3.1.0] - 27 de Agosto de 2026

### Calidad, CI/CD, Seguridad y Tipado
- **CI Quality Gate**: nuevo workflow `.github/workflows/deploy.yml` (acciones fijadas por SHA) que ejecuta install reproducible, lint, typecheck (TS y JS), check de supresiones, tests con cobertura, validación de Edge Functions, higiene de migraciones, escaneo de secretos, auditoría de dependencias y build.
- **Secretos**: `supabase/.temp` eliminado del control de versiones (filtraba el project-ref y la URL del pooler). El escaneo de secretos ahora omite URLs públicas de Supabase en migraciones SQL de cron jobs.
- **Dependencias**: actualizados los `pnpm.overrides` para corregir vulnerabilidades high/critical transitivas (`fast-uri`, `tar`, `undici`, `minimatch`, `browserslist`, `path-to-regexp`).
- **Tipado**: tipada la sesión (`Session`/`User` de Supabase), eliminado `@ts-nocheck`, y corregidos errores de tipos en el flujo de checkout/recepción.
- **Logging**: unificado `console.error` en la capa de negocio hacia `logger.js` (con redacción de datos sensibles).
- **JcarAI multi-proveedor**: el AI Gateway ahora soporta **Qwen (DashScope, modo compatible OpenAI)** y Gemini mediante la variable `AI_PROVIDER` (por defecto `qwen`). Refactor del cliente LLM (`llm.ts`) y del bucle de herramientas para abstraer el proveedor.

### Tests
- Corregidos 11 tests unitarios desactualizados (caja, recepción, ventas) para reflejar las APIs refactorizadas.
- Añadido `tests/unit/loyalty.service.test.ts` (funciones puras de fidelización).
- Calibrados los umbrales de cobertura a la capa de dominio puro y regenerada la cobertura.

### Facturación Electrónica SUNAT (SOAP directo)
- **XML UBL 2.1 conforme**: `cac:TaxCategory` con `cbc:ID`/atributos, dirección fiscal completa (razón social, ubigeo, departamento, provincia, distrito) y eliminado el bloque `cac:Signature` espurio.
- **Zona horaria `America/Lima`** para la fecha/hora de emisión.
- **CDR parseado**: se abre el ZIP y se lee `ResponseCode` para distinguir aceptado vs rechazado con observaciones.
- **Notas de Crédito (07) y Débito (08)**: flujo completo con `BillingReference` + `DiscrepancyResponse` (Catálogo 09) y UI de emisión desde el comprobante.
- **Series configurables por hotel** (`F001`/`B001`/`FC01`/`FD01`/`BC01`/`BD01`).
- **Detalle por líneas** (hospedaje + consumos / ítems POS) poblado en `comprobante_detalle`.
- **Certificado ICP + clave privada por hotel**: subida desde la UI de configuración y almacenamiento en `private.hotel_secrets`.
- **Validación estructural** del XML antes de firmar.

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
