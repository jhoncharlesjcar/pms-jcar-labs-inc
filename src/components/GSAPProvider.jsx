/**
 * GSAPProvider — Mantiene ScrollTrigger sincronizado con cambios de ruta
 *
 * Anteriormente inicializaba Lenis Smooth Scroll. Eliminado porque
 * en una app de gestión hotelera el smooth scroll ralentiza la UX.
 * ScrollTrigger.refresh() sigue siendo necesario para animaciones
 * que dependen del layout (como el parallax del Dashboard).
 */

import React, { useEffect, memo } from 'react';
import { useLocation } from 'react-router-dom';
import { refreshScrollTriggers } from '@/lib/gsap';

const GSAPProvider = memo(function GSAPProvider({ children }) {
  const location = useLocation();

  // ─── Refresh ScrollTrigger on route change ────────────────────────────
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
