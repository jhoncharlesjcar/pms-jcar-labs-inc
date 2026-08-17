/**
 * Configuración GSAP
 *
 * Registro centralizado de plugins GSAP y utilidades de ScrollTrigger.
 */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// ─── Registro de plugins GSAP ───────────────────────────────────────────
gsap.registerPlugin(ScrollTrigger);

/**
 * Refresca ScrollTrigger (llamar en cambios de ruta o actualizaciones del DOM).
 */
export function refreshScrollTriggers() {
  ScrollTrigger.refresh();
}
