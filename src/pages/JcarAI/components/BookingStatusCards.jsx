import React from 'react';
import { format } from 'date-fns';
import { CreditCard } from 'lucide-react';

/**
 * @param {{ label: string, value: string, detail?: string, icon?: React.ReactNode }} props
 */
function StatusCard({ label, value, detail, icon = null }) {
    return (
        <div className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {icon}
                {label}
            </div>
            <p className="mt-1 text-sm font-bold capitalize">
                {String(value).replaceAll('_', ' ')}
            </p>
            {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
        </div>
    );
}

/**
 * @param {{ booking: { intent?: any, hold?: any, payment?: any }, locale: import('date-fns').Locale }} props
 */
export default function BookingStatusCards({ booking, locale }) {
    if (!booking?.intent && !booking?.hold && !booking?.payment) return null;

    return (
        <div className="grid grid-cols-1 gap-3 border-b border-border bg-background/40 p-4 md:grid-cols-3">
            {booking.intent && (
                <StatusCard
                    label="Intención"
                    value={booking.intent.status || 'Sin intención'}
                    detail={
                        booking.intent.fecha_entrada && booking.intent.fecha_salida
                            ? `${booking.intent.fecha_entrada} → ${booking.intent.fecha_salida}`
                            : undefined
                    }
                />
            )}
            {booking.hold && (
                <StatusCard
                    label="Hold"
                    value={booking.hold.status || 'Sin hold'}
                    detail={
                        booking.hold.expires_at
                            ? `Vence ${format(new Date(booking.hold.expires_at), 'dd/MM HH:mm', { locale })}`
                            : undefined
                    }
                />
            )}
            {booking.payment && (
                <StatusCard
                    label="Pago"
                    value={booking.payment.status || 'Sin pago'}
                    detail={`${booking.payment.currency} ${Number(booking.payment.amount).toFixed(2)} · ${booking.payment.method}`}
                    icon={<CreditCard className="h-4 w-4" />}
                />
            )}
        </div>
    );
}
