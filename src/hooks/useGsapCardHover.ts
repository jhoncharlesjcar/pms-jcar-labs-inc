/**
 * useGsapCardHover — Hook para micro-interacciones hover ligeras en tarjetas con GSAP
 * Optimizada para no jank, GPU-only transforms y soporte a touch y prefers-reduced-motion.
 */
import { useEffect } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

export interface UseGsapCardHoverOptions {
  scale?: number;
  glowColor?: string;
  glowSize?: number;
  borderColor?: string;
  duration?: number;
  ease?: string;
}

export function useGsapCardHover(ref: React.RefObject<HTMLElement | null>, opts: UseGsapCardHoverOptions = {}) {
  const {
    scale = 1.01,
    duration = 0.2,
    ease = 'power2.out',
  } = opts;

  const { contextSafe } = useGSAP({ scope: ref });

  const onEnter = contextSafe(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    gsap.to(el, {
      y: -2,
      scale,
      duration,
      ease,
      overwrite: 'auto',
    });
  });

  const onLeave = contextSafe(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    gsap.to(el, {
      y: 0,
      scale: 1,
      duration: duration * 0.8,
      ease: 'power2.out',
      overwrite: 'auto',
      clearProps: 'transform',
    });
  });

  useEffect(() => {
    // Si no es un dispositivo con cursor hover (ej. móviles y tablets táctiles), no adjuntar listeners
    if (typeof window === 'undefined' || !window.matchMedia('(hover: hover)').matches) return;

    const el = ref.current;
    if (!el) return;

    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);

    return () => {
      el.removeEventListener('mouseenter', onEnter);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, [ref, onEnter, onLeave]);
}
