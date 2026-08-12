import React from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, User, CalendarDays, Wrench, Sparkles, AlertCircle, Clock, ShieldCheck, Award } from 'lucide-react';

export const STATUS_CONFIG = {
    // Estados de Habitación
    disponible: {
        label: 'Disponible',
        icon: CheckCircle2,
        className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    },
    ocupada: {
        label: 'Ocupada',
        icon: User,
        className: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
    },
    reservada: {
        label: 'Reservada',
        icon: CalendarDays,
        className: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
    },
    mantenimiento: {
        label: 'Mantenimiento',
        icon: Wrench,
        className: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
    },
    limpieza: {
        label: 'Limpieza',
        icon: Sparkles,
        className: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30',
    },
    // Estados de Transacción / Venta
    pendiente: {
        label: 'Pendiente',
        icon: Clock,
        className: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30',
    },
    activa: {
        label: 'Activa',
        icon: CheckCircle2,
        className: 'bg-primary/15 text-primary border-primary/30',
    },
    finalizada: {
        label: 'Finalizada',
        icon: ShieldCheck,
        className: 'bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30',
    },
    cancelada: {
        label: 'Cancelada',
        icon: AlertCircle,
        className: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
    },
    loyalty: {
        label: 'Fidelidad',
        icon: Award,
        className: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
    },
};

export function StatusBadge({ status, label, showIcon = true, className = '', children }) {
    const key = (status || '').toLowerCase();
    const config = STATUS_CONFIG[key] || {
        label: label || status || 'General',
        icon: AlertCircle,
        className: 'bg-muted text-muted-foreground border-border/50',
    };

    const Icon = config.icon;
    const textLabel = children || label || config.label;

    return (
        <span
            role="status"
            aria-label={`Estado: ${textLabel}`}
            className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider border shadow-2xs transition-colors select-none',
                config.className,
                className
            )}
        >
            {showIcon && Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0" />}
            <span>{textLabel}</span>
        </span>
    );
}

export default StatusBadge;
