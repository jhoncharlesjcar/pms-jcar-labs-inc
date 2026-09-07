/**
 * useGsapStaggerList — Hook para animaciones stagger de listas con GSAP
 * Soporta de forma nativa prefers-reduced-motion y transiciones ágiles sin lag.
 */
import { useRef } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

export interface UseGsapStaggerListOptions {
  stagger?: number;
  from?: 'start' | 'center' | 'end' | 'random' | 'edges';
  direction?: 'y' | 'x' | 'scale' | 'none';
  distance?: number;
  animateOnMount?: boolean;
  grid?: 'auto' | 'row' | 'column' | [number, number];
}

export function useGsapStaggerList<T extends HTMLElement = HTMLDivElement>(deps: any[] = [], opts: UseGsapStaggerListOptions = {}) {
  const {
    stagger = 0.02,
    from = 'start',
    direction = 'y',
    distance = 10,
    animateOnMount = true,
    grid,
  } = opts;

  const ref = useRef<T>(null);
  const prevLengthRef = useRef(0);

  useGSAP(() => {
    const container = ref.current;
    if (!container) return;

    const children = container.children;
    if (!children || children.length === 0) return;

    // Guarda de accesibilidad: si el usuario prefiere movimiento reducido
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(children, { opacity: 1, x: 0, y: 0, scale: 1 });
      prevLengthRef.current = children.length;
      return;
    }

    // No animar al montar si está deshabilitado
    if (!animateOnMount && prevLengthRef.current === 0) {
      prevLengthRef.current = children.length;
      return;
    }

    // Determinar animación según direction
    const fromVars: any = {};
    const toVars: any = {};

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
      fromVars.scale = 0.96;
      toVars.opacity = 1;
      toVars.scale = 1;
    } else {
      fromVars.opacity = 0;
      toVars.opacity = 1;
    }

    // Configurar stagger: si hay grid, pasar grid al objeto de stagger
    const staggerConfig: any = {
      each: stagger,
      from,
    };
    if (grid) {
      staggerConfig.grid = grid;
    }

    // Animar hijos con stagger ágil (0.18s)
    gsap.fromTo(
      children,
      { ...fromVars },
      {
        ...toVars,
        duration: 0.18,
        ease: 'power2.out',
        stagger: staggerConfig,
      }
    );

    prevLengthRef.current = children.length;
  }, { dependencies: [stagger, from, direction, distance, animateOnMount, grid, ...deps], scope: ref });

  return ref;
}

export interface UseGsapStaggerChildrenOptions {
  stagger?: number;
  from?: 'start' | 'center' | 'end' | 'random' | 'edges';
  direction?: 'y' | 'x' | 'scale' | 'none';
  distance?: number;
  selector?: string;
}

/**
 * Versión para animar un subconjunto de hijos (ej. slice(0, N)).
 */
export function useGsapStaggerChildren<T extends HTMLElement = HTMLDivElement>(deps: any[] = [], opts: UseGsapStaggerChildrenOptions = {}) {
  const {
    stagger = 0.03,
    from = 'start',
    direction = 'y',
    distance = 12,
    selector = ':scope > *',
  } = opts;

  const ref = useRef<T>(null);

  useGSAP(() => {
    const container = ref.current;
    if (!container) return;

    const children = container.querySelectorAll(selector);
    if (children.length === 0) return;

    // Guarda de accesibilidad
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(children, { opacity: 1, x: 0, y: 0, scale: 1 });
      return;
    }

    const fromVars: any = { opacity: 0 };
    const toVars: any = { opacity: 1 };

    if (direction === 'y') {
      fromVars.y = distance;
      toVars.y = 0;
    } else if (direction === 'x') {
      fromVars.x = -distance;
      toVars.x = 0;
    } else if (direction === 'scale') {
      fromVars.scale = 0.96;
      toVars.scale = 1;
    }

    gsap.fromTo(
      children,
      { ...fromVars },
      {
        ...toVars,
        duration: 0.2,
        ease: 'power2.out',
        stagger: {
          each: stagger,
          from,
        },
      }
    );
  }, { dependencies: [stagger, from, direction, distance, selector, ...deps], scope: ref });

  return ref;
}
