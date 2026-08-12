import { memo } from 'react';
import { cn } from '@/lib/utils';

/**
 * @param {{ icon?: any, title?: string, description?: string, action?: any, className?: string }} props
 */
function EmptyStateInner({
  icon: Icon,
  title = 'Sin datos',
  description = 'No hay elementos para mostrar en esta sección.',
  action = null,
  className = '',
}) {

  return (
    <div
      data-empty-state="true"
      className={cn(
        'flex flex-col items-center justify-center py-24 px-6',
        className
      )}
    >
      {/* Icon Container */}
      <div className="relative mb-6 empty-enter">
        <div className="w-20 h-20 enterprise-card rounded-2xl flex items-center justify-center shadow-sm">
          {Icon ? (
            <Icon className="w-9 h-9 text-muted-foreground/40" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-muted-foreground/10" />
          )}
        </div>
        {/* Decorative ring */}
        <div className="absolute -inset-2 rounded-3xl border border-border/20 -z-10" />
      </div>

      {/* Text Content */}
      <div className="text-center max-w-sm empty-enter-delay-1">
        <h3 className="text-lg font-bold text-foreground tracking-tight mb-1.5">
          {title}
        </h3>
        <p className="text-sm text-muted-foreground/70 leading-relaxed">
          {description}
        </p>
      </div>

      {/* Optional Action Button */}
      {action && (
        <div className="mt-8 empty-enter-delay-2">
          <button
            onClick={action.onClick}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 active:scale-[0.97] transition-all shadow-lg shadow-primary/10"
          >
            {action.icon && <action.icon className="w-4 h-4" />}
            {action.label}
          </button>
        </div>
      )}
    </div>
  );
}

const EmptyState = memo(EmptyStateInner);
EmptyState.displayName = 'EmptyState';
export default EmptyState;
