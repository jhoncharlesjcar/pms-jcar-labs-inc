/**
 * useGsapStaggerList — Hook para animaciones stagger de listas con GSAP
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

export function useGsapStaggerList(deps: any[] = [], opts: UseGsapStaggerListOptions = {}) {
  const {
    stagger = 0.025,
    from = 'start',
    direction = 'y',
    distance = 20,
    animateOnMount = true,
    grid,
  } = opts;

  const ref = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(0);

  useGSAP(() => {
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
      fromVars.scale = 0.9;
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

    // Animar hijos con stagger
    gsap.fromTo(
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
export function useGsapStaggerChildren(deps: any[] = [], opts: UseGsapStaggerChildrenOptions = {}) {
  const {
    stagger = 0.04,
    from = 'start',
    direction = 'y',
    distance = 20,
    selector = ':scope > *',
  } = opts;

  const ref = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const container = ref.current;
    if (!container) return;

    const children = container.querySelectorAll(selector);
    if (children.length === 0) return;

    const fromVars: any = { opacity: 0 };
    const toVars: any = { opacity: 1 };

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

    gsap.fromTo(
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
  }, { dependencies: [stagger, from, direction, distance, selector, ...deps], scope: ref });

  return ref;
}
