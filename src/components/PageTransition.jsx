/**
 * PageTransition — Transiciones de página operativas y ligeras con GSAP.
 * Optimizado para cero latencia perceptiva y soporte a prefers-reduced-motion.
 */

import { useRef, useEffect, memo } from 'react';
import { gsap } from 'gsap';

const PageTransition = memo(function PageTransition(/** @type {any} */ { children }) {
  const containerRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (animRef.current) {
      animRef.current.kill();
    }

    // Guarda de accesibilidad y modo rápido
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(el, { opacity: 1, y: 0 });
      return;
    }

    // Transición ágil y sutil (120ms, sin saltos verticales)
    gsap.set(el, { 
      opacity: 0.9, 
    });

    animRef.current = gsap.to(el, {
      opacity: 1,
      duration: 0.12,
      ease: 'power1.out',
    });

    return () => {
      if (animRef.current) {
        animRef.current.kill();
      }
    };
  }, []);

  return (
    <div ref={containerRef} className="w-full">
      {children}
    </div>
  );
});
PageTransition.displayName = 'PageTransition';
export default PageTransition;
