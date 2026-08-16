# 🏢 Flujo de Negocio: Sistema de Gestión Hospedajes (PWA)
**Hospedaje Angelica Frey - By Jcar Labs**

Este documento detalla el **Ciclo de Vida Operativo** del negocio. Describe paso a paso cómo el sistema interactúa con el personal del hotel (Recepcionistas, Administradores) y los huéspedes, cubriendo desde la llegada hasta el cierre de caja.

---

## 1. Fase 1: Llegada y Registro (Check-in)

El ciclo de negocio comienza cuando un huésped llega al establecimiento solicitando alojamiento.

1. **Consulta de Disponibilidad:** El recepcionista ingresa al módulo de **Recepción**. El sistema muestra una grilla visual (Mapa de Calor) donde las habitaciones **Verdes** están limpias y listas.
2. **Toma de Datos:** El recepcionista selecciona una habitación disponible y el sistema abre la ficha de registro. Se ingresa:
   * Nombre del huésped.
   * Documento de Identidad (DNI/Pasaporte).
   * Cantidad de Noches proyectadas.
3. **Confirmación de Ingreso:** Al confirmar, el sistema ejecuta la regla de negocio:
   * Bloquea la habitación cambiándola a color **Rojo (Ocupada)** para el resto del equipo.
   * Crea una "Reserva Activa" a nombre del huésped.

---

## 2. Fase 2: Estadía y Consumos Adicionales (Cross-Selling)

Durante el tiempo que el huésped está alojado, el sistema permite la gestión de ventas secundarias (Minimarket).

1. **Punto de Venta (POS):** Si el huésped desea comprar snacks, bebidas o servicios extra (ej. Lavandería), el personal usa el módulo de Punto de Venta.
2. **Método de Cobro:** El negocio permite dos modalidades:
   * **Cobro Inmediato:** El cliente paga el snack al momento (por Yape, Efectivo, etc.) y se registra como venta directa.
   * **Cargar a la Habitación:** (Si la lógica del minimarket lo integra), se asocia la deuda al folio del huésped para cobrar todo al final.

---

## 3. Fase 3: Salida y Liquidación (Check-out)

Es el proceso financiero más crítico donde se consolida la deuda y se libera el inventario.

1. **Liquidación de Cuenta:** El recepcionista ubica la habitación roja (Ocupada) y selecciona "Terminar/Checkout".
2. **Revisión guiada:** El panel de cobro presenta en una sola vista la estadía, consumos adicionales, descuentos e impuestos. El total y la acción principal permanecen visibles durante todo el proceso.
3. **Cobro:** El recepcionista elige directamente Efectivo, Yape, Plin, Transferencia o Tarjeta. Los pagos digitales solicitan su referencia antes de habilitar la confirmación.
4. **Comprobante y cierre:** Se emite ticket interno, boleta o factura según corresponda. Al confirmar el pago, la reserva finaliza y la habitación pasa a **Limpieza**.

---

## 4. Fase 4: Comprobantes y Entrega (Facturación)

Una vez el pago es ingresado al sistema, la transacción debe ser respaldada físicamente.

1. **Generación de Ticket:** El sistema compila silenciosamente los datos del hotel (RUC, Dirección), los datos del cliente, la habitación y los montos pagados.
2. **Impresión Térmica:** Sin abrir ventanas adicionales que estorben, el sistema manda la orden (vía RawBT Bluetooth) a la mini-impresora térmica del mostrador, cortando el ticket físico (formato ESC/POS) para el cliente en segundos.
3. **Control Tributario (Facturación Electrónica Automática)**: Si el módulo de SUNAT en Configuración se encuentra en **modo automático**, al procesar la venta en Recepción o en el Minimarket (POS), el sistema llama de forma transparente al API REST del PMS (`/functions/facturacion`), el cual construye el XML UBL 2.1, lo firma digitalmente con XAdES-BES, lo empaqueta en ZIP y lo envía en tiempo real a la SUNAT. El sistema recibe la Constancia de Recepción (CDR) aceptada, actualizando la base de datos de manera inmediata y emitiendo el comprobante oficial. Si está en **modo manual**, el comprobante se mantiene en estado "pendiente" para ser emitido a voluntad o desde el portal web de SUNAT.
4. **Centro de Entrega:** Después del cobro, el personal dispone de un único panel responsivo con los datos del cliente, una vista previa y acciones persistentes para **imprimir**, **compartir** o **descargar PDF**, sin tener que reiniciar el flujo entre canales.
5. **Estado Fiscal Explícito:** La interfaz diferencia `Ticket interno`, `Pendiente`, `Aceptado` y `Rechazado`. Solo un comprobante aceptado muestra QR y leyenda de representación electrónica; las constancias internas y pendientes indican expresamente que no son comprobantes tributarios.
6. **Integridad del Documento:** Cuando SUNAT ya aceptó el comprobante, el tipo y los datos del cliente quedan bloqueados en la entrega para evitar que una copia visual contradiga el documento fiscal emitido.

---

## 5. Fase 5: Auditoría y Cierre (Métricas Gerenciales)

Proceso reservado para administradores y dueños del negocio al finalizar el turno o el día.

1. **Visión en Tiempo Real (Dashboard):** El dueño entra al Dashboard y el sistema le da la salud financiera del día:
   * **Ocupación Hoy:** Qué porcentaje del hotel logró venderse.
   * **Ingresos de Hoy:** Dinero total recolectado.
2. **Arqueo de Caja (Desglose):** El sistema segmenta automáticamente el dinero que entró hoy. Le dice al dueño exactamente:
   * "Tienes S/ 500 en la caja física (Efectivo)".
   * "Tienes S/ 300 en la app de Yape".
   * "Tienes S/ 150 en POS de Tarjeta".
   Esto permite cuadrar la caja del recepcionista en 2 minutos sin matemáticas manuales.
3. **Lectura Gerencial:** El Dashboard presenta el total del día desglosado por Efectivo, Yape, Plin, Transferencia y Tarjeta, junto con alertas de comprobantes pendientes o rechazados.
4. **Arqueo Físico:** Caja distingue el **saldo neto** de todos los medios y el **efectivo esperado** en el cajón. Antes de cerrar, el responsable ingresa el efectivo contado y el sistema calcula automáticamente faltante, sobrante o caja cuadrada.
5. **Trazabilidad de Diferencias:** Si existe una diferencia, el cierre exige una explicación. El esperado, contado, diferencia y observación se guardan dentro de las notas del cierre existente, sin alterar el modelo contable ni sus fórmulas.
6. **Respaldo del Turno:** Antes de confirmar se pueden imprimir los movimientos o exportar PDF/CSV con ventas, egresos, medios de pago y control SUNAT. Las acciones permanecen accesibles en móvil y escritorio.

---

### 👑 Valor Añadido del Negocio
El flujo está diseñado para que un recepcionista nuevo pueda atender, cobrar e imprimir en menos de **3 clics**, mientras que el dueño tiene visibilidad financiera y protección contra ventas "no registradas" gracias a la trazabilidad digital.
