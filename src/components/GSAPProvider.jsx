/**
 * GSAPProvider — Mantiene ScrollTrigger sincronizado con cambios de ruta.
 *
 * ScrollTrigger.refresh() es necesario para animaciones que dependen
 * del layout (como el parallax del Dashboard).
 */

import React, { useEffect, memo } from 'react';
import { useLocation } from 'react-router-dom';
import { refreshScrollTriggers } from '@/lib/gsap';

const GSAPProvider = memo(function GSAPProvider({ children }) {
  const location = useLocation();

  // ─── Refrescar ScrollTrigger en cada cambio de ruta ───────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      refreshScrollTriggers();
    }, 100);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  return <>{children}</>;
});
GSAPProvider.displayName = 'GSAPProvider';
export default GSAPProvider;
