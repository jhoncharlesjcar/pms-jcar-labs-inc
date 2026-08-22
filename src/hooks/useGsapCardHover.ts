/**
 * useGsapCardHover — Hook para micro-interacciones hover en tarjetas con GSAP
 */
import { useEffect } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

export interface UseGsapCardHoverOptions {
  scale?: number;
  glowColor?: string;
  glowSize?: number;
  borderColor?: string;
  duration?: number;
  ease?: string;
}

export function useGsapCardHover(ref: React.RefObject<HTMLElement | null>, opts: UseGsapCardHoverOptions = {}) {
  const {
    scale = 1.02,
    glowColor = 'hsl(var(--primary) / 0.18)',
    glowSize = 28,
    borderColor,
    duration = 0.35,
    ease = 'power2.out',
  } = opts;

  const { contextSafe } = useGSAP({ scope: ref });

  const onEnter = contextSafe(() => {
    const el = ref.current;
    if (!el) return;
    
    // GSAP cannot parse `var(...)` or `hsl(x y z / a)` natively in complex strings.
    let resolvedGlowColor = glowColor;
    if (resolvedGlowColor.includes('var(')) {
      const varMatch = resolvedGlowColor.match(/var\((--[^)]+)\)/);
      if (varMatch) {
        const varValue = getComputedStyle(el).getPropertyValue(varMatch[1]).trim();
        const commaSeparated = varValue.replace(/\s+/g, ', ');
        resolvedGlowColor = resolvedGlowColor.replace(`var(${varMatch[1]})`, commaSeparated);
      }
    }
    // Convert modern hsl(a b c / d) to hsla(a, b, c, d)
    if (resolvedGlowColor.includes('/')) {
      resolvedGlowColor = resolvedGlowColor.replace('hsl(', 'hsla(').replace('/', ',');
    }
    
    gsap.to(el, {
      scale,
      boxShadow: `0 ${glowSize * 0.5}px ${glowSize}px -8px ${resolvedGlowColor}, 0 4px 12px rgba(0,0,0,0.08)`,
      borderColor: borderColor || undefined,
      duration,
      ease,
      overwrite: 'auto',
    });
  });

  const onLeave = contextSafe(() => {
    const el = ref.current;
    if (!el) return;

    gsap.to(el, {
      scale: 1,
      boxShadow: 'none',
      borderColor: borderColor ? 'transparent' : undefined,
      duration: duration * 0.8,
      ease: 'power2.out',
      overwrite: 'auto',
      clearProps: 'boxShadow,borderColor'
    });
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);

    return () => {
      el.removeEventListener('mouseenter', onEnter);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, [ref, onEnter, onLeave]);
}
