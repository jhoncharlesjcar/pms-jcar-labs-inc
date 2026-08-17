/**
 * PageTransition — Transiciones de página premium con GSAP.
 *
 * Envuelve el contenido de la página con transiciones suaves de
 * desvanecimiento y deslizamiento usando GSAP.
 */

import { useRef, useEffect, memo } from 'react';
import { gsap } from 'gsap';

const PageTransition = memo(function PageTransition(/** @type {any} */ { children }) {
  const containerRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Cancelar animación existente
    if (animRef.current) {
      animRef.current.kill();
    }

    // Estado inicial (oculto, ligeramente desplazado hacia abajo)
    gsap.set(el, { 
      opacity: 0, 
      y: 8,
    });

    // Animar entrada
    animRef.current = gsap.to(el, {
      opacity: 1,
      y: 0,
      duration: 0.35,
      ease: 'power3.out',
    });

    return () => {
      if (animRef.current) {
        animRef.current.kill();
      }
    };
  }, []);

  return (
    <div ref={containerRef} className="w-full will-change-transform will-change-opacity">
      {children}
    </div>
  );
});
PageTransition.displayName = 'PageTransition';
export default PageTransition;
