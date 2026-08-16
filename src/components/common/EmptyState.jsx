import { memo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

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
        'flex flex-col items-center justify-center px-5 py-14 sm:px-8 sm:py-20',
        className
      )}
    >
      {/* Icon Container */}
      <div className="relative mb-5 empty-enter">
        <div className="enterprise-card flex h-16 w-16 items-center justify-center rounded-2xl shadow-sm sm:h-[72px] sm:w-[72px]">
          {Icon ? (
            <Icon className="h-7 w-7 text-muted-foreground/45 sm:h-8 sm:w-8" />
          ) : (
            <div className="h-8 w-8 rounded-full bg-muted-foreground/10" />
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
        <div className="mt-6 empty-enter-delay-2">
          <Button
            onClick={action.onClick}
          >
            {action.icon && <action.icon className="w-4 h-4" />}
            {action.label}
          </Button>
        </div>
      )}
    </div>
  );
}

const EmptyState = memo(EmptyStateInner);
EmptyState.displayName = 'EmptyState';
export default EmptyState;
