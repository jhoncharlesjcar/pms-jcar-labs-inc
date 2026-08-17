/**
 * GSAPProvider — Mantiene ScrollTrigger sincronizado con cambios de ruta.
 */

import React, { useEffect, memo } from 'react';
import { useLocation } from 'react-router-dom';
import { refreshScrollTriggers } from '@/lib/gsap';

interface GSAPProviderProps {
  children: React.ReactNode;
}

const GSAPProvider = memo(function GSAPProvider({ children }: GSAPProviderProps) {
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
