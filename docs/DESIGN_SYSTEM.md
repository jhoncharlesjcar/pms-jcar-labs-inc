# Sistema de diseño

## Principios

- Priorizar lectura operativa rápida sobre decoración.
- Mantener el flujo de recepción, cobro y cierre visible en cualquier tamaño.
- Usar tokens semánticos para soportar modos claro y oscuro.
- Evitar acciones sólo representadas por color; incluir etiqueta accesible o `aria-label`.
- Confirmar acciones destructivas y comunicar éxito o error.

## Dirección visual

La interfaz sigue una estética de hospitalidad ejecutiva: moderna, sobria y diferenciada de un panel SaaS genérico.

- Tipografía principal: `Manrope`, con alta legibilidad operativa.
- Verde bosque: acciones, navegación activa y continuidad de marca.
- Latón suave: acentos hoteleros y jerarquía secundaria.
- Superficies: fondos ligeramente estratificados, bordes suaves y sombras cortas; evitar tarjetas flotantes exageradas.
- Densidad: aprovechar el ancho sin estirar tarjetas de poco contenido.
- Estados: usar una línea de acento, icono, texto y color semántico; nunca depender sólo del color.
- Navegación: la sección activa utiliza alto contraste y debe reconocerse en menos de un segundo.

Las tarjetas de habitación usan `room-card-grid` y `room-card`. El grid conserva un ancho operativo estable con `auto-fill`, por lo que una planta con pocas habitaciones no genera tarjetas excesivamente anchas.

## Responsive

- Mobile: una columna, acciones principales de ancho completo y navegación táctil.
- Tablet: dos columnas cuando el contenido lo permita.
- Desktop: densidad operativa sin superar `max-w-7xl` o el límite específico del módulo.
- Controles interactivos: objetivo táctil mínimo de 44 × 44 px.
- Tablas extensas: versión móvil en tarjetas o desplazamiento explícito.
- Respetar safe areas y `100dvh` en dispositivos móviles.

## Escala de interfaz

La escala compartida vive en `src/index.css` y debe utilizarse antes de añadir medidas locales:

- `page-shell`: ritmo vertical fluido de cada módulo.
- `page-header`: título y acción principal; apila la acción a ancho completo en móvil.
- `ui-card-grid`: separación uniforme entre tarjetas.
- `ui-card-pad`: relleno fluido de 12 a 16 px según el viewport.
- `metric-card`: KPI compacto, con altura base aproximada de 92 a 104 px; sólo crece cuando su contenido lo exige.
- `operational-card`: tarjeta de trabajo para habitaciones, reservas y tareas.
- `operational-card-grid`: utiliza `auto-fill` para impedir que una lista con pocos resultados estire sus tarjetas a todo el ancho.
- `section-card`: contenedor de gráficos, tablas, filtros o formularios.
- `segmented-control`: filtros y vistas horizontales con scroll táctil.

No se deben combinar alturas arbitrarias con los tamaños de `Button`, `Input` o `Select`, salvo que exista una necesidad funcional documentada.

## Botones y controles

- Acción principal: `Button` por defecto, 44 px de alto.
- Acción compacta: `size="sm"`, 36 px en escritorio y objetivo táctil mínimo de 44 px.
- Acción de icono: `size="icon"`, 44 × 44 px.
- Icono compacto: `size="iconSm"`, 36 × 36 px y objetivo táctil mínimo de 44 px.
- Acción prominente o final de flujo: `size="lg"`, 48 px.
- Campos `Input` y `Select`: 44 px de alto, radio de 8 px y foco semántico visible.

Las acciones destructivas usan la variante `destructive`; las acciones secundarias usan `outline`, `secondary` o `ghost`. Un botón no debe depender únicamente del color para explicar su propósito.

## Tokens

Los colores se consumen mediante `background`, `card`, `foreground`, `muted`, `border`, `primary` y estados semánticos definidos en `src/index.css`.

Los estados de habitación son:

- disponible: verde;
- ocupada: rojo;
- reservada: azul o violeta;
- limpieza: celeste;
- mantenimiento: ámbar.

El color comunica prioridad, no sustituye el texto.

## Componentes compartidos

- `Button`: acciones y estados pending.
- `StatusBadge`: estados operativos consistentes.
- `ConfirmDialog`: confirmaciones destructivas.
- `EmptyState`: ausencia de datos con próxima acción.
- `PageSkeleton`: carga inicial y diferida.
- `Sheet` y `Dialog`: formularios adaptables.

## Interacción

- Mostrar feedback inmediato con toast o mensaje inline.
- Deshabilitar la acción mientras exista una mutación pendiente.
- Mantener foco visible y navegación por teclado.
- Respetar `prefers-reduced-motion`.
- Reservar GSAP para transiciones y jerarquía; no animar información crítica de forma que retrase su lectura.

## Mantenimiento

Antes de crear un componente, comprobar si existe una variante compartida. Los estilos específicos de negocio permanecen cerca del módulo; los patrones reutilizables viven en `src/components/common` o `src/components/ui`.
