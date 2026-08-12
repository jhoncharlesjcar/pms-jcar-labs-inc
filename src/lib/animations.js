/**
 * Animation curves & configurations.
 * Note: framer-motion presets removed (springSmooth, easeApple, etc.)
 * GSAP-powered animations are now the standard.
 * Easing curves kept as pure arrays for utility use.
 */

// Premium ease curves (inspired by Stripe/Linear)
export const easings = {
  fast: [0.16, 1, 0.3, 1],
  standard: [0.2, 0.8, 0.2, 1],
  smooth: [0.22, 1, 0.36, 1],
  exit: [0.32, 0, 0.67, 0],
};
