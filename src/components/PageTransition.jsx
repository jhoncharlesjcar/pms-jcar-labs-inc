/**
 * PageTransition — GSAP-powered premium page transitions
 * 
 * Wraps page content with smooth fade/slide/scale transitions.
 * Uses GSAP for professional-grade animation control.
 */

import { useRef, useEffect, memo } from 'react';
import { gsap } from 'gsap';

const PageTransition = memo(function PageTransition(/** @type {any} */ { children }) {
  const containerRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Kill any existing animation
    if (animRef.current) {
      animRef.current.kill();
    }

    // Set initial state (hidden, slightly below)
    gsap.set(el, { 
      opacity: 0, 
      y: 8,
    });

    // Animate in
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
