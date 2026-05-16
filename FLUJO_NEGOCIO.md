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
2. **Cálculo de Deuda:** El sistema suma el `Precio por Noche × Cantidad de Noches`.
3. **Selección de Pago:** El huésped decide cómo pagar. El sistema ofrece un abanico omnicanal:
   * **Efectivo** (Suma a la caja física).
   * **Billeteras Digitales:** Yape, Plin (Suma a cuenta bancaria móvil).
   * **Tarjetas o Transferencias**.
4. **Liberación:** Al procesar el pago, el sistema obedece la regla de inventario: cambia el cuarto a **Disponible** o a **Mantenimiento** (si requiere limpieza profunda antes del próximo cliente).

---

## 4. Fase 4: Comprobantes y Entrega (Facturación)

Una vez el pago es ingresado al sistema, la transacción debe ser respaldada físicamente.

1. **Generación de Ticket:** El sistema compila silenciosamente los datos del hotel (RUC, Dirección), los datos del cliente, la habitación y los montos pagados.
2. **Impresión Térmica:** Sin abrir ventanas adicionales que estorben, el sistema manda la orden (vía RawBT Bluetooth) a la mini-impresora térmica del mostrador, cortando el ticket físico (formato ESC/POS) para el cliente en segundos.
3. **Control Tributario:** El estado del comprobante se marca. Puede ser un simple *Ticket de Control Interno* o enviarse a cola para *Declaración SUNAT* dependiendo de si el cliente pidió Boleta/Factura.

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

---

### 👑 Valor Añadido del Negocio
El flujo está diseñado para que un recepcionista nuevo pueda atender, cobrar e imprimir en menos de **3 clics**, mientras que el dueño tiene visibilidad financiera y protección contra ventas "no registradas" gracias a la trazabilidad digital.
