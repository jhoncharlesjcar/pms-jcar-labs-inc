import React from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, User, CalendarDays, Wrench, Sparkles, AlertCircle, Clock, ShieldCheck, Award } from 'lucide-react';
import { ROOM_STATUS_CONFIG } from '@/constants/roomStatus';

const ROOM_STATUS_ICONS = {
    disponible: CheckCircle2,
    ocupada: User,
    reservada: CalendarDays,
    mantenimiento: Wrench,
    limpieza: Sparkles,
};

export const STATUS_CONFIG = {
    // Estados de Habitación
    ...Object.fromEntries(Object.entries(ROOM_STATUS_CONFIG).map(([key, config]) => [key, {
        label: config.label,
        icon: ROOM_STATUS_ICONS[key],
        className: cn(config.badgeClass, 'font-extrabold'),
    }])),
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

export function StatusBadge(/** @type {any} */ { status, label, showIcon = true, className = '', children }) {
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
