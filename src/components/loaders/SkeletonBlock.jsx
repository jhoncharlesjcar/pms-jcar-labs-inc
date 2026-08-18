/**
 * SkeletonBlock — Componente base para esqueletos de carga
 * 
 * Renderiza un bloque placeholder con animación shimmer premium.
 * Todas las variantes de página usan este componente base.
 * 
 * @example
 * <SkeletonBlock className="h-8 w-48" />
 * <SkeletonBlock className="h-12 w-full rounded-xl" />
 * <SkeletonBlock as="circle" className="w-10 h-10" />
 */

import { memo } from 'react';
import { cn } from '@/lib/utils';

const SkeletonBlock = memo(function SkeletonBlock(/** @type {any} */ { className, as, variant = 'text' }) {
  const baseClasses = 'animate-pulse bg-muted/60';
  const cardClasses = 'bg-card border border-border/40 rounded-2xl shadow-sm';

  // Circle variant
  if (variant === 'circle' || as === 'circle') {
    return <div className={cn(baseClasses, 'rounded-full', className)} />;
  }

  // Avatar variant
  if (variant === 'avatar') {
    return (
      <div className="flex items-center gap-3">
        <div className={cn(baseClasses, 'rounded-lg w-10 h-10 flex-shrink-0', className)} />
        <div className="flex-1 space-y-2">
          <div className={cn(baseClasses, 'h-3 w-3/4', className)} />
          <div className={cn(baseClasses, 'h-2 w-1/2', className)} />
        </div>
      </div>
    );
  }

  // Card variant
  if (variant === 'card') {
    return (
      <div className={cn(cardClasses, 'space-y-3 p-3', className)}>
        <div className="flex items-center gap-3">
          <div className={cn(baseClasses, 'h-8 w-8 rounded-lg')} />
          <div className="flex-1 space-y-2">
            <div className={cn(baseClasses, 'h-3 w-2/3')} />
            <div className={cn(baseClasses, 'h-2.5 w-1/3')} />
          </div>
        </div>
        <div className={cn(baseClasses, 'h-5 w-1/2')} />
      </div>
    );
  }

  // Line chart variant
  if (variant === 'chart') {
    return (
      <div className={cn(cardClasses, 'space-y-4 p-4', className)}>
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <div className={cn(baseClasses, 'h-3 w-24')} />
            <div className={cn(baseClasses, 'h-5 w-40')} />
          </div>
          <div className={cn(baseClasses, 'h-8 w-8 rounded-lg')} />
        </div>
        <div className="flex items-end gap-2 h-32 pt-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className={cn(baseClasses, 'flex-1 rounded-t-md')}
              style={{ height: `${30 + Math.random() * 70}%` }}
            />
          ))}
        </div>
      </div>
    );
  }

  // Table row variant
  if (variant === 'table-row') {
    return (
      <div className="flex items-center gap-4 p-4 border-b border-border/50">
        <div className={cn(baseClasses, 'w-8 h-8 rounded-lg flex-shrink-0')} />
        <div className="flex-1 space-y-2">
          <div className={cn(baseClasses, 'h-3 w-1/3')} />
          <div className={cn(baseClasses, 'h-2.5 w-1/5')} />
        </div>
        <div className={cn(baseClasses, 'h-3 w-16')} />
        <div className={cn(baseClasses, 'h-3 w-20')} />
        <div className={cn(baseClasses, 'h-8 w-20 rounded-lg')} />
      </div>
    );
  }

  // Button variant
  if (variant === 'button') {
    return <div className={cn(baseClasses, 'h-10 rounded-lg', className)} />;
  }

  // Default: simple text block
  return <div className={cn(baseClasses, className)} />;
});
SkeletonBlock.displayName = 'SkeletonBlock';
export default SkeletonBlock;
