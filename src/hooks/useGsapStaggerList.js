/**
 * useGsapStaggerList — Hook para animaciones stagger de listas con GSAP
 *
 * Anima los hijos de un contenedor con stagger cuando la lista cambia.
 * Soporta fade-in-up, fade-in-left, scale-in.
 *
 * @example
 * function MiLista({ items }) {
 *   const listRef = useGsapStaggerList(items, { stagger: 0.05, from: 'start', direction: 'y' });
 *   return (
 *     <div ref={listRef}>
 *       {items.map(item => <div key={item.id}>...</div>)}
 *     </div>
 *   );
 * }
 */

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

/**
 * @param {any[]} deps - Dependencias que disparan la animación (ej. items, filteredList)
 * @param {Object} [opts]
 * @param {number} [opts.stagger=0.04] - Tiempo entre cada elemento (segundos)
 * @param {'start'|'center'|'end'|'random'|'edges'} [opts.from='start'] - Dirección del stagger
 * @param {'y'|'x'|'scale'|'none'} [opts.direction='y'] - Tipo de animación
 * @param {number} [opts.distance=20] - Distancia en píxeles
 * @param {boolean} [opts.animateOnMount=true] - Animar al montar el componente
 * @param {'auto'|'row'|'column'|[number,number]} [opts.grid] - Modo grid 2D: 'auto' detecta columnas automáticamente,
 *   'row' stagger por filas, 'column' por columnas, o [rows, cols] para grid explícito.
 *   Usar con el stagger estándar (0.02-0.04s) para un efecto wave natural.
 * @returns {React.RefObject}
 */
export function useGsapStaggerList(deps = [], opts = {}) {
  const {
    stagger = 0.025,
    from = 'start',
    direction = 'y',
    distance = 20,
    animateOnMount = true,
    grid,
  } = opts;

  const ref = useRef(null);
  const prevLengthRef = useRef(0);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    const children = container.children;
    if (!children || children.length === 0) return;

    // No animar al montar si está deshabilitado
    if (!animateOnMount && prevLengthRef.current === 0) {
      prevLengthRef.current = children.length;
      return;
    }

    // Determinar animación según direction
    const fromVars = {};
    const toVars = {};

    if (direction === 'y') {
      fromVars.opacity = 0;
      fromVars.y = distance;
      toVars.opacity = 1;
      toVars.y = 0;
    } else if (direction === 'x') {
      fromVars.opacity = 0;
      fromVars.x = -distance;
      toVars.opacity = 1;
      toVars.x = 0;
    } else if (direction === 'scale') {
      fromVars.opacity = 0;
      fromVars.scale = 0.9;
      toVars.opacity = 1;
      toVars.scale = 1;
    } else {
      fromVars.opacity = 0;
      toVars.opacity = 1;
    }

    // Configurar stagger: si hay grid, pasar grid al objeto de stagger
    const staggerConfig = {
      each: stagger,
      from,
    };
    if (grid) {
      // Si el grid está presente, agregarlo al config de stagger
      // 'auto' detecta automáticamente columnas, 'row'/'column' son modos explícitos
      staggerConfig.grid = grid;
    }

    // Animar hijos con stagger
    const tweens = gsap.fromTo(
      children,
      { ...fromVars },
      {
        ...toVars,
        duration: 0.25,
        ease: 'power3.out',
        stagger: staggerConfig,
      }
    );

    prevLengthRef.current = children.length;

    return () => {
      if (tweens) {
        tweens.kill();
      }
    };
    // Spread deps para evitar re-ejecución por cambio de referencia del array
  }, [stagger, from, direction, distance, animateOnMount, grid, ...deps]);

  return ref;
}

/**
 * Versión para animar un subconjunto de hijos (ej. slice(0, N)).
 *
 * @param {any[]} deps
 * @param {Object} [opts]
 * @param {string} [opts.selector=':scope > *'] - Selector de hijos a animar
 * @returns {React.RefObject}
 */
export function useGsapStaggerChildren(deps = [], opts = {}) {
  const {
    stagger = 0.04,
    from = 'start',
    direction = 'y',
    distance = 20,
    selector = ':scope > *',
  } = opts;

  const ref = useRef(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    const children = container.querySelectorAll(selector);
    if (children.length === 0) return;

    const fromVars = { opacity: 0 };
    const toVars = { opacity: 1 };

    if (direction === 'y') {
      fromVars.y = distance;
      toVars.y = 0;
    } else if (direction === 'x') {
      fromVars.x = -distance;
      toVars.x = 0;
    } else if (direction === 'scale') {
      fromVars.scale = 0.9;
      toVars.scale = 1;
    }

    const tweens = gsap.fromTo(
      children,
      { ...fromVars },
      {
        ...toVars,
        duration: 0.4,
        ease: 'power3.out',
        stagger: {
          each: stagger,
          from,
        },
      }
    );

    return () => {
      if (tweens) tweens.kill();
    };
    // Spread deps para evitar re-ejecución por cambio de referencia del array
  }, [stagger, from, direction, distance, selector, ...deps]);

  return ref;
}
