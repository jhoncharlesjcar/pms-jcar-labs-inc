/**
 * GSAP Configuration
 *
 * Centralized GSAP plugin registration and ScrollTrigger utilities.
 * Lenis smooth scroll has been removed — this is a PMS app, not a portfolio.
 */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// ─── Register GSAP Plugins ──────────────────────────────────────────────
gsap.registerPlugin(ScrollTrigger);

/**
 * Refresh ScrollTrigger (call on route change / DOM update).
 */
export function refreshScrollTriggers() {
  ScrollTrigger.refresh();
}

/**
 * Kill all ScrollTrigger instances (call on unmount).
 */
export function killAllScrollTriggers() {
  ScrollTrigger.getAll().forEach((st) => st.kill());
}
