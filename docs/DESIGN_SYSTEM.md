# Sistema de diseño

**Última revisión:** 21 de septiembre de 2026 (v3.3.0)
**Implementación principal:** `src/index.css`, `tailwind.config.js` y `src/components/ui/`

## Principios

- Priorizar la lectura operativa y la siguiente acción.
- Mantener el flujo de recepción, cobro y cierre reconocible en cualquier viewport.
- Evitar tarjetas demasiado grandes cuando contienen poca información.
- Usar texto, icono y color para los estados; nunca depender solo del color.
- Proporcionar foco visible, etiquetas accesibles y confirmación para acciones destructivas.
- Mantener paridad funcional entre móvil, tablet y escritorio.

## Dirección visual

- Tipografía principal: **Manrope**.
- Color de marca: verde bosque para navegación y acciones primarias.
- Acento: latón suave para jerarquía secundaria y contexto hotelero.
- Superficies estratificadas con bordes suaves, radios consistentes y sombras contenidas.
- Densidad compacta: la interfaz utiliza el ancho disponible sin convertir cada elemento en una tarjeta.
- Modo oscuro basado en los mismos tokens semánticos del modo claro.

## Escala estructural

Los patrones compartidos viven en `src/index.css`:

| Clase | Uso |
| --- | --- |
| `page-shell` | Ritmo vertical de cada página |
| `page-header` | Título, descripción y acción principal |
| `ui-card-grid` | Separación uniforme entre tarjetas |
| `ui-card-pad` | Padding fluido de tarjetas |
| `metric-card` | KPI compacto |
| `operational-card` | Reserva, tarea o entidad operativa |
| `operational-card-grid` | Grid con `auto-fill` para evitar tarjetas estiradas |
| `section-card` | Formularios, tablas, gráficos y filtros |
| `segmented-control` | Selector horizontal con scroll explícito |
| `config-tabs` | Pestañas de Configuración en 2, 3 o 6 columnas |
| `room-card-grid` | Grid de habitaciones con ancho operativo estable |
| `room-card` | Tarjeta de habitación y acento por estado |

Una tarjeta no debe declarar una altura fija salvo que la continuidad visual del módulo lo requiera. Se prefieren `min-height`, `auto-fill`, `minmax()` y contenido intrínseco.

## Responsive

| Rango | Comportamiento esperado |
| --- | --- |
| Menos de 640 px | Una columna, acciones principales a ancho completo, navegación táctil |
| Desde 640 px | Dos o tres columnas según la densidad del módulo |
| Desde 1024 px | Sidebar persistente y mayor densidad operativa |
| Pantallas amplias | El contenido conserva un ancho máximo específico y no estira tarjetas pequeñas |

Reglas:

- Objetivo táctil mínimo: 44 × 44 px.
- Usar `100dvh` y safe areas para la aplicación móvil.
- Las tablas complejas requieren vista móvil, scroll explícito o transformación a tarjetas.
- Las pestañas de Configuración muestran 2 columnas en móvil, 3 en tablet y 6 en escritorio.
- El sidebar mantiene la opción activa completamente visible.
- Ninguna acción crítica puede existir únicamente en hover.

## Tarjetas

### Métricas

- Altura aproximada entre 92 y 104 px.
- Una cifra, una etiqueta corta y, como máximo, un icono contextual.
- No deben crecer para rellenar filas con poco contenido.

### Habitaciones

- Ancho mínimo operativo cercano a 260 px.
- Número, tipo, tarifa, estado y amenidades deben leerse sin abrir el detalle.
- El estado usa una línea lateral, icono, etiqueta y color semántico.
- Las plantas se separan visualmente sin añadir contenedores redundantes.

### Operación

- Limpieza, caja y recepción utilizan grids automáticos compactos.
- La acción principal permanece cerca del dato que modifica.
- Los empty states reemplazan grids vacíos y ofrecen la siguiente acción posible.

## Botones y campos

| Variante | Medida y uso |
| --- | --- |
| Default | 44 px; acción primaria habitual |
| `size="sm"` | 36 px visuales en escritorio; objetivo táctil protegido |
| `size="icon"` | 44 × 44 px |
| `size="iconSm"` | 36 px visuales; objetivo táctil protegido |
| `size="lg"` | 48 px; confirmación o cierre de flujo |

- `destructive`: eliminar, anular o desactivar.
- `outline`, `secondary` y `ghost`: acciones secundarias.
- `Input` y `Select`: 44 px, borde visible y foco semántico.
- Durante una mutación, deshabilitar la acción y mostrar estado de progreso.
- Los botones de solo icono requieren `aria-label`.

## Estados semánticos

La fuente ejecutable es `src/constants/roomStatus.ts`.

| Estado | Color principal | Resultado operativo |
| --- | --- | --- |
| Disponible | Verde | Lista para asignar |
| Reservada | Azul | Separada para una reserva |
| Ocupada | Rojo | Estancia activa |
| Limpieza | Violeta | Pendiente de housekeeping |
| Mantenimiento | Ámbar | Fuera de servicio |

Los estados fiscales, de sincronización y de caja deben usar `StatusBadge` o un patrón equivalente con etiqueta explícita.

## Componentes compartidos

- `Button`: acciones y estados pending.
- `StatusBadge`: estados operativos.
- `ConfirmDialog`: confirmaciones destructivas.
- `EmptyState`: ausencia de datos con siguiente acción.
- `PageSkeleton`: carga inicial o diferida.
- `Dialog` y `Sheet`: formularios adaptables.
- `CheckoutProgress`: progreso del checkout.
- `ComprobanteStatus`: estado fiscal.

Antes de crear un componente nuevo, comprobar si existe una variante compartida.

## Optimistic UI y Feedback Inmediato

En flujos de alta frecuencia y baja fricción (ej. actualización de estados de limpieza por personal de housekeeping):
- La interfaz actualiza el estado local de forma inmediata (0ms latency visual).
- Se presenta una notificación Toast (`sonner`) con una ventana de 4 segundos que incluye un botón explícito de **Deshacer (Undo)**.
- Si el usuario no pulsa "Deshacer", la mutación remota se confirma; si pulsa "Deshacer", se revierte el estado local de forma atómica y se cancela la sincronización.
- Si ocurre un error de red o de servidor, la interfaz revierte automáticamente al estado previo y muestra un toast de error descriptivo.

## Visualización de Datos (Recharts Responsivo)

Los componentes analíticos y de gráficos (`Reportes.jsx`, `Revenue.jsx`) deben seguir estrictamente:
- **Alturas explícitas responsivas:** Contenedor padre con `h-[280px] sm:h-[320px] w-full`, envolviendo a `<ResponsiveContainer width="100%" height="100%">` para evitar colapsos o distorsiones de SVG.
- **Formateo de Ejes:**
  - Eje X (`XAxis`): usar `interval="preserveStartEnd"`, ticks legibles con formato de fecha conciso (ej. `dd/MMM`) y rotación (`angle={-25}`) en viewports móviles si la densidad de datos lo amerita.
  - Eje Y (`YAxis`): formateo numérico o de moneda abreviado (`S/ k`), ancho controlado (`width={60}`) para evitar desplazamiento horizontal del gráfico.
- **Paleta Semántica:** Usar tokens HSL del tema (`hsl(var(--primary))`, `hsl(var(--chart-1))` a `chart-5`), evitando colores fijos que no respondan al modo oscuro.
- **Tooltips Táctiles:** `<Tooltip>` con fondo `bg-popover/95`, borde semántico, texto contrastado y soporte para eventos táctiles sin requerir `hover` persistente.

## Rendimiento de Animaciones y GSAP

- **Microinteracciones rápidas:** Duración máxima de 120ms a 180ms para transiciones y listas (`stagger: 0.03` a `0.05`).
- **Compositing por GPU:** Animar exclusivamente `transform` (`x`, `y`, `scale`) y `opacity`. Queda estrictamente prohibido animar propiedades de layout como `height`, `width`, `top` o `left`.
- **Preferencia de Movimiento Reducido (`prefers-reduced-motion`):**
  Todos los hooks y componentes GSAP (`useGsapCardHover`, `useGsapStaggerList`, `PageTransition`) deben consultar `window.matchMedia('(prefers-reduced-motion: reduce)')`. Si está activo, retornar de inmediato y renderizar la interfaz con opacidad 1 y sin desplazamientos espaciales.
- **Soporte Táctil sin Hover Fantasma:**
  Las animaciones basadas en puntero deben encapsularse con la media query `@media (hover: hover)` para evitar que queden atascadas en dispositivos móviles o tablets tras un toque.
- **Eliminación de Stagger en Vistas de Alta Densidad:**
  No aplicar animaciones secuenciales en selectores donde el usuario necesite actuar de inmediato (ej. selector de habitaciones en reservas o catálogo POS).

## Accesibilidad e interacción

- Mantener navegación completa por teclado y foco visible en todos los elementos interactivos (`ring-2 ring-primary ring-offset-2`).
- Usar `aria-current` en navegación y `aria-selected` en pestañas.
- Asociar errores de campo mediante `aria-describedby`.
- Anunciar resultados con toast o mensajes inline accesibles a lectores de pantalla.
- Respetar `prefers-reduced-motion` globalmente.
- Objetivos táctiles mínimos: 44 × 44 px en botones secundarios e iconos; 50 px de altura en botones de acción rápida móvil.
- Confirmar eliminar, anular y otras acciones irreversibles mediante `ConfirmDialog`.

## Checklist visual

Revisar como mínimo:

- 360 × 800 (móviles estándar);
- 390 × 844 (iOS);
- 768 × 1024 (tablets en vertical - iPad);
- 1024 × 768 (tablets en horizontal / POS de mostrador);
- 1366 × 768 (laptops estándar);
- 1920 × 1080 (pantallas de administración desktop);
- modo claro y oscuro;
- zoom de navegador al 200 %;
- navegación solo con teclado;
- estados loading, vacío, error, offline y contenido extenso.

