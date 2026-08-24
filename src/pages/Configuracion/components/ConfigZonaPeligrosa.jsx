import React, { memo } from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';

/**
 * La eliminación masiva directa de reservas/ventas se deshabilitó porque
 * rompe trazabilidad fiscal, auditoría e idempotencia. La retención aprobada
 * se ejecuta mediante jobs de servidor y nunca elimina evidencia fiscal.
 */
export const ConfigZonaPeligrosa = memo(function ConfigZonaPeligrosa() {
    return (
        <section className="space-y-4 rounded-xl border border-amber-500/25 bg-amber-500/5 p-5" aria-labelledby="data-governance-title">
            <div className="flex items-start gap-3">
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-2 text-amber-600">
                    <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                    <h2 id="data-governance-title" className="font-extrabold text-foreground">Gobierno y retención de datos</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        La eliminación masiva desde el navegador está deshabilitada. Las reservas, ventas, comprobantes y eventos de auditoría requieren trazabilidad y no pueden borrarse por rango desde esta pantalla.
                    </p>
                </div>
            </div>
            <div className="flex gap-3 rounded-lg border bg-background/60 p-4 text-sm">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <p>
                    La anonimización y purga permitida se ejecutan mediante el mantenimiento del servidor según la política de retención. Para una solicitud extraordinaria, utiliza el procedimiento auditado del runbook y conserva previamente el respaldo fiscal requerido.
                </p>
            </div>
        </section>
    );
});
