# Historial de Cambios (Changelog)

Este documento registra los cambios más relevantes, mejoras arquitectónicas y soluciones a errores en el PMS JCAR LABS.

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
