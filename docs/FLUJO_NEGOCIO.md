# Flujo de negocio hotelero

**Última revisión:** 16 de agosto de 2026

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
- las mutaciones offline se conservan por usuario y hotel hasta sincronizarse.

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

## 5. Comprobantes

El sistema diferencia:

- `ticket_interno`;
- `sunat_pendiente`;
- `sunat_emitido`;
- `sunat_rechazado`.

Un ticket interno o pendiente no debe presentarse como comprobante tributario aceptado. Solamente un documento aceptado puede mostrar la representación electrónica y su QR fiscal.

En modo automático, la Edge Function de facturación intenta emitir el documento después de registrar la operación. Si el proveedor no responde, la venta no desaparece: queda pendiente o rechazada según el resultado registrado. En modo manual, la emisión se ejecuta posteriormente desde el flujo autorizado.

El centro de entrega permite imprimir, compartir o descargar PDF sin reiniciar el checkout. Una vez aceptado por SUNAT, los datos fiscales del documento no se modifican desde la copia visual.

## 6. Limpieza y mantenimiento

Después del checkout:

1. la habitación aparece pendiente de limpieza;
2. housekeeping inicia y completa la tarea;
3. si no hay incidencia, la habitación pasa a disponible;
4. si existe una falla, pasa a mantenimiento;
5. una habitación en mantenimiento vuelve primero a limpieza antes de quedar disponible.

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
6. Se confirma el cierre y se conserva su trazabilidad.
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

- **Sin conexión:** mostrar estado offline y conservar solamente mutaciones soportadas por la cola.
- **Error de sincronización:** trasladar el cambio a dead letter y exigir revisión.
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
