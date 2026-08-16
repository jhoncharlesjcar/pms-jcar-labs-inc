import { AlertTriangle, CheckCircle2, Clock3, ReceiptText } from 'lucide-react';
import { cn } from '@/lib/utils';

export const COMPROBANTE_STATUS = {
    ticket_interno: {
        label: 'Ticket interno',
        description: 'Constancia de pago no tributaria.',
        icon: ReceiptText,
        className: 'border-border bg-muted/50 text-muted-foreground',
    },
    sunat_pendiente: {
        label: 'Pendiente de SUNAT',
        description: 'La entrega puede continuar; la emisión tributaria sigue pendiente.',
        icon: Clock3,
        className: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400',
    },
    sunat_emitido: {
        label: 'Aceptado por SUNAT',
        description: 'Comprobante electrónico listo para entregar.',
        icon: CheckCircle2,
        className: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    },
    sunat_rechazado: {
        label: 'Rechazado por SUNAT',
        description: 'Corrige los datos y reintenta la emisión.',
        icon: AlertTriangle,
        className: 'border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-400',
    },
};

export function getComprobanteStatus(status) {
    return COMPROBANTE_STATUS[status] || COMPROBANTE_STATUS.ticket_interno;
}

export default function ComprobanteStatus({ status, compact = false, className }) {
    const config = getComprobanteStatus(status);
    const Icon = config.icon;

    return (
        <div className={cn('flex items-start gap-2.5 rounded-lg border px-3 py-2', config.className, className)} role="status">
            <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
                <p className="text-xs font-semibold">{config.label}</p>
                {!compact && <p className="mt-0.5 text-[11px] leading-snug opacity-80">{config.description}</p>}
            </div>
        </div>
    );
}
