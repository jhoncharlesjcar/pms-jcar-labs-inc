# Flujo de negocio hotelero

**Última revisión:** 7 de septiembre de 2026 (v3.2.0)

Este documento resume el ciclo operativo que debe conservarse al evolucionar la interfaz o la arquitectura. Las reglas detalladas se encuentran en `specs/domain-*.md`.

## Actores

| Actor | Responsabilidad |
| --- | --- |
| Huésped | Reserva, pre-registro, estadía y recepción de comprobante |
| Recepcionista | Reserva, check-in, cobro, checkout, ventas y caja |
| Limpieza | Preparar habitaciones y reportar mantenimiento |
| Administrador | Configuración, inventario, reportes y control financiero |
| Developer | Administración global y soporte multi-tenant |

## 1. Reserva y pre-llegada

La reserva puede originarse en recepción o en `/booking/:hotelId`.

1. Se consulta disponibilidad para el rango solicitado.
2. Se registran huésped, fechas, ocupación y habitación.
3. La reserva queda pendiente o confirmada según el canal.
4. La habitación pasa de disponible a reservada cuando corresponde.
5. El huésped puede completar el pre-check-in mediante un token limitado.
6. Recepción revisa la información antes de activar la estancia.

Una ruta pública no concede acceso a la operación interna ni permite consultar libremente tablas del hotel.

## 2. Check-in

1. Recepción selecciona una reserva o habitación disponible.
2. Valida identidad, datos de contacto, acompañantes, fechas y tarifa.
3. Confirma el ingreso.
4. La reserva pasa a activa.
5. La habitación pasa a ocupada.
6. El sistema registra la operación en el contexto del hotel activo.

La actualización de reserva y habitación debe conservar consistencia. Si una parte falla, la UI no debe presentar el ingreso como completado.

## 3. Estadía y consumos

Durante la estancia:

- recepción consulta la ocupación y los datos del huésped;
- el POS registra productos o servicios;
- los pagos inmediatos se incorporan a ventas y caja;
- los cargos asociados a la estancia se consideran en la liquidación;
- Realtime mantiene actualizadas las vistas operativas;
- las mutaciones de negocio requieren conexión y fallan de forma explícita si el servidor no está disponible; no se reproducen desde el navegador.

Medios de pago admitidos: efectivo, Yape, Plin, transferencia y tarjeta. Los pagos digitales pueden exigir una referencia.

## 4. Checkout y liquidación

1. Recepción abre el checkout de una estancia activa.
2. Revisa alojamiento, consumos, descuentos, impuestos y total.
3. Selecciona el medio de pago y los datos del comprobante.
4. Confirma el cobro.
5. Se registra la venta.
6. La reserva pasa a finalizada.
7. La habitación pasa a limpieza.
8. Se abre el centro de entrega del comprobante.

La confirmación se bloquea mientras falten datos obligatorios o exista una mutación en curso.

## 5. Comprobantes (Facturación Electrónica SUNAT)

El sistema diferencia el estado de los documentos:

- `ticket_interno`: Documento no fiscal para control interno.
- `sunat_pendiente`: Comprobante generado y esperando firma/envío.
- `sunat_emitido`: Comprobante firmado (XML digital) y aceptado por SUNAT (CDR válido).
- `sunat_rechazado`: Rechazado por SUNAT, requiere corrección.

**Flujo de Facturación (Edge Functions):**
1. Recepción emite una Factura o Boleta durante el checkout o venta POS.
2. La base de datos invoca la Edge Function de `facturacion`.
3. `xmlGenerator.ts` construye el UBL 2.1 estándar de SUNAT.
4. `xmlSigner.ts` utiliza `xml-crypto` y certificados digitales para firmar criptográficamente el XML.
5. Se envía el payload a los web services de SUNAT y se procesa el CDR (Constancia de Recepción).

Un ticket interno o pendiente no debe presentarse como comprobante tributario aceptado. Solamente un documento aceptado puede mostrar la representación electrónica y su QR fiscal.

En modo automático, la Edge Function de facturación intenta emitir el documento después de registrar la operación. Si el proveedor no responde, la venta no desaparece: queda pendiente o rechazada según el resultado registrado. En modo manual, la emisión se ejecuta posteriormente desde el flujo autorizado.

El centro de entrega permite imprimir, compartir o descargar PDF sin reiniciar el checkout. Una vez aceptado por SUNAT, los datos fiscales del documento no se modifican desde la copia visual.

## 6. Limpieza y mantenimiento

Después del checkout:

1. la habitación aparece pendiente de limpieza;
2. housekeeping inicia y completa la tarea;
3. el personal marca la habitación como limpia usando la interfaz móvil con **Optimistic UI** (cambio visual inmediato y toast con ventana de 4 segundos para "Deshacer");
4. si no hay incidencia, la habitación pasa a disponible;
5. si existe una falla, se reporta la avería y pasa a mantenimiento;
6. una habitación en mantenimiento vuelve primero a limpieza antes de quedar disponible.

Transiciones canónicas:

```text
disponible -> reservada -> ocupada -> limpieza -> disponible
disponible -> ocupada -> limpieza -> disponible
cualquier estado operativo permitido -> mantenimiento -> limpieza -> disponible
```

La fuente ejecutable de estas transiciones es `src/constants/roomStatus.ts`.

## 7. Caja y cierre

Caja consolida ingresos del hotel, ventas POS y egresos dentro del hotel activo.

1. El responsable revisa ingresos por medio de pago.
2. El sistema calcula el saldo neto y el efectivo esperado.
3. El responsable ingresa el efectivo contado.
4. Se calcula la diferencia.
5. Una diferencia exige observación.
6. Se confirma el cierre y se conserva su trazabilidad. El cierre aplica validación de idempotencia (`unique_cierre_caja_hotel_fecha_turno`) y restricción de saldos no negativos a nivel de base de datos.
7. El turno puede exportarse en PDF o CSV.

Los comprobantes pendientes o rechazados permanecen visibles para seguimiento; el cierre de caja no debe ocultar su estado fiscal.

## 8. Gestión y análisis

Administración utiliza Dashboard, Revenue y Reportes para revisar:

- ocupación y disponibilidad;
- ingresos y ventas;
- medios de pago;
- caja y egresos;
- estados de comprobantes;
- tareas de limpieza y mantenimiento;
- stock y suministros.

Las métricas siempre se calculan dentro del hotel activo.

## 9. Excepciones operativas

- **Sin conexión:** mostrar estado offline y bloquear mutaciones; la PWA solo conserva activos y consultas públicas allowlist.
- **Error de sincronización de canales:** usar leases y dead letter del servidor; nunca reproducir una mutación PMS desde IndexedDB.
- **Usuario u hotel inactivo:** impedir la operación.
- **RLS denegado:** mostrar error sin intentar evadir el control.
- **Proveedor externo no configurado:** devolver un error explícito; nunca simular éxito.
- **Cambio de propiedad:** invalidar datos del tenant anterior antes de mostrar el nuevo.

## Invariantes

- Ninguna operación puede cruzar datos entre hoteles.
- Una habitación no puede figurar disponible durante una estancia activa.
- Un checkout confirmado siempre deja la habitación en limpieza.
- Una habitación en mantenimiento no se asigna.
- Todo cobro pertenece a un hotel y a un medio de pago.
- El estado fiscal mostrado debe coincidir con el persistido.
- La interfaz responsiva no elimina pasos ni acciones del flujo de negocio.

## 10. Channel Manager y OTA Sync

La conectividad con Agencias de Viajes Online (Booking.com, Expedia, Airbnb) se realiza mediante un flujo bidireccional seguro:

1. **Recepción de Reserva (OTA -> PMS):** Un webhook autenticado recibe el XML/JSON de la reserva.
2. El sistema valida el `hotel_id`, bloquea la disponibilidad real y crea la reserva en estado "Confirmada".
3. **Sincronización de Inventario (PMS -> OTA):** La Edge Function `ota-sync-inventory` envía en tiempo real el ajuste de disponibilidad hacia los canales externos al modificarse una ocupación o bloqueo de limpieza.
4. **Sincronización de Tarifas (PMS -> OTA):** La Edge Function `ota-sync-rates` refleja cualquier cambio de precios (Revenue) hacia las OTAs.

## 11. Asistente Inteligente (JcarAI / AI Gateway)

El hotel puede configurar un agente inteligente accesible para recepcionistas o huéspedes (vía web/WhatsApp):

1. **Interacción:** El usuario o huésped hace una pregunta ("¿Tienen piscina?", "¿Hay cuartos libres hoy?").
2. **Contexto:** Se carga la Base de Conocimiento (Knowledge Manager) específica del `hotel_id` y el historial de la conversación.
3. **Inferencia y Tool Calling:** La Edge Function `ai-gateway` procesa el contexto en Gemini 2.0. Si la consulta requiere datos transaccionales, Gemini solicita invocar un *Tool* local.
4. **Respuesta:** El servidor ejecuta la lectura segura de inventario o políticas y retorna el resultado al modelo para generar la respuesta final natural.
5. El sistema preserva un registro (`ai_messages`) para auditoría y permite "Handoff" (transferencia a un humano) si el modelo no puede resolver la solicitud.
