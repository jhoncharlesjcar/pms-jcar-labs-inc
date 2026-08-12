/**
 * useGsapCardHover — Hook para micro-interacciones hover en tarjetas con GSAP
 *
 * Anima scale, glow (box-shadow) y border-color con GSAP.
 * Usa `gsap.quickTo` para el leave (retorno a estado original) como"])
 * high-frequency optimization, reduciendo memory churn en hover repetitivos.
 * Ideal para dashboards, KPI cards, bento cards, etc.
 *
 * @example
 * function MetricCard() {
 *   const ref = useRef(null);
 *   useGsapCardHover(ref, { scale: 1.03, glowColor: 'hsla(158, 95%, 36%, 0.25)' });
 *   return <div ref={ref}>...</div>;
 * }
 */

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

/**
 * @param {React.RefObject} ref - Ref del elemento a animar
 * @param {Object} [opts]
 * @param {number} [opts.scale=1.02] - Factor de escala al hacer hover
 * @param {string} [opts.glowColor='hsla(var(--primary), 0.18)'] - Color del glow (box-shadow)
 * @param {number} [opts.glowSize=28] - Tamaño del blur del glow en px
 * @param {string} [opts.borderColor] - Color del borde al hacer hover (opcional)
 * @param {number} [opts.duration=0.35] - Duración de la animación
 * @param {string} [opts.ease='power2.out'] - Función de easing
 */
export function useGsapCardHover(ref, opts = {}) {
  const {
    scale = 1.02,
    glowColor = 'hsla(var(--primary), 0.18)',
    glowSize = 28,
    borderColor,
    duration = 0.35,
    ease = 'power2.out',
  } = opts;

  const hoverTween = useRef(null);
  const leaveTween = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Guardar estilos originales para restaurarlos al salir
    const originalStyles = {
      boxShadow: el.style.boxShadow || '',
      borderColor: el.style.borderColor || '',
    };

    // quickTo para el leave: alta frecuencia sin crear tweens
    const quickReset = gsap.quickTo ? gsap.quickTo(el, 'scale', { duration: duration * 0.8, ease: 'power2.out' }) : null;

    const onEnter = () => {
      if (leaveTween.current) leaveTween.current.kill();
      if (hoverTween.current) hoverTween.current.kill();

      hoverTween.current = gsap.to(el, {
        scale,
        boxShadow: `0 ${glowSize * 0.5}px ${glowSize}px -8px ${glowColor}, 0 4px 12px rgba(0,0,0,0.08)`,
        borderColor: borderColor || originalStyles.borderColor || undefined,
        duration,
        ease,
        overwrite: 'auto',
      });
    };

    const onLeave = () => {
      if (hoverTween.current) hoverTween.current.kill();
      if (leaveTween.current) leaveTween.current.kill();

      // Usar quickTo para scale (alta frecuencia), gsap.to para propiedades complejas
      if (quickReset) {
        quickReset(1);
      }

      leaveTween.current = gsap.to(el, {
        boxShadow: originalStyles.boxShadow || 'none',
        borderColor: originalStyles.borderColor || '',
        duration: duration * 0.8,
        ease: 'power2.out',
        overwrite: 'auto',
      });
    };

    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);

    return () => {
      el.removeEventListener('mouseenter', onEnter);
      el.removeEventListener('mouseleave', onLeave);
      if (hoverTween.current) hoverTween.current.kill();
      if (leaveTween.current) leaveTween.current.kill();
    };
  }, [ref, scale, glowColor, glowSize, borderColor, duration, ease]);
}
