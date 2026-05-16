# 📊 Diagrama de Flujo Operativo - Hospedaje Angelica Frey

Este diagrama ilustra gráficamente el ciclo completo que sigue un cliente y cómo el sistema y el personal interactúan con él paso a paso.

```mermaid
graph TD
    %% Estilos Globales
    classDef inicio fill:#10b981,stroke:#047857,stroke-width:2px,color:white,font-weight:bold
    classDef proceso fill:#3b82f6,stroke:#1d4ed8,stroke-width:2px,color:white
    classDef decision fill:#f59e0b,stroke:#b45309,stroke-width:2px,color:white,font-weight:bold
    classDef baseDatos fill:#8b5cf6,stroke:#5b21b6,stroke-width:2px,color:white
    classDef hardware fill:#64748b,stroke:#334155,stroke-width:2px,color:white
    classDef fin fill:#ef4444,stroke:#b91c1c,stroke-width:2px,color:white,font-weight:bold

    A([🚶‍♂️ Inicio: Llega el Huésped]) :::inicio --> B{¿Reserva Previa?} :::decision
    
    B -->|Sí| C[🔍 Buscar en Sistema] :::proceso
    B -->|No| D[🛏️ Consultar Recepción/Disponibilidad] :::proceso
    
    C --> E[✍️ Tomar Datos (DNI/Nombre)] :::proceso
    D --> E
    
    E --> F[(💾 Guardar Check-in)] :::baseDatos
    F --> G[🛑 Estado: Habitación Ocupada] :::proceso
    
    G --> H{¿Consumo Extra?} :::decision
    
    H -->|Sí, Snacks/Bebidas| I[🛒 Punto de Venta POS] :::proceso
    I --> J{¿Cobro?} :::decision
    J -->|Inmediato| K[(💾 Registrar Venta Directa)] :::baseDatos
    J -->|Cargar a Cuarto| L[(💾 Sumar a la Deuda de Reserva)] :::baseDatos
    
    H -->|No| M[⏳ Fin de la Estadía] :::proceso
    K --> M
    L --> M
    
    M --> N[🛎️ Solicitar Check-out] :::proceso
    N --> O[💰 Liquidación: Total Noches + Consumos] :::proceso
    
    O --> P{💳 Método de Pago} :::decision
    
    P -->|Efectivo| Q[(💵 Registrar en Caja Efectivo)] :::baseDatos
    P -->|Yape/Plin| R[(📱 Registrar Billetera Digital)] :::baseDatos
    P -->|Tarjeta| S[(💳 Registrar Tarjeta)] :::baseDatos
    
    Q --> T[🧹 Liberar Cuarto] :::proceso
    R --> T
    S --> T
    
    T --> U[Estado: Habitación a Mantenimiento] :::proceso
    
    T --> V[🖨️ Enviar Comando a RawBT] :::hardware
    V --> W[🧾 Imprimir Ticket Térmico por Bluetooth] :::hardware
    
    W --> X([👋 Fin: Entregar Ticket y Despedida]) :::fin
```

### 🔍 Leyenda de Colores
*   🟩 **Verde:** Puntos de inicio.
*   🟦 **Azul:** Tareas operativas del recepcionista.
*   🟧 **Naranja:** Decisiones que cambian el rumbo del flujo.
*   🟪 **Morado:** Acciones silenciosas en la Base de Datos.
*   ⬛ **Gris oscuro:** Interacción con hardware externo (Impresora).
*   🟥 **Rojo:** Fin del ciclo de servicio.
