import React from 'react';
import { format } from 'date-fns';
import DOMPurify from 'dompurify';

/**
 * @param {{
 *   unverifiedEvidence: Array<{ id: string, observed_amount: number, observed_at: string, submitted_by: string }>,
 *   selectedEvidenceId: string,
 *   onEvidenceChange: (id: string) => void,
 *   onOpenEvidence: () => void,
 *   isReviewingEvidence: boolean,
 *   paymentReference: string,
 *   onPaymentReferenceChange: (value: string) => void,
 *   onVerifyPayment: () => void,
 *   isVerifyingPayment: boolean,
 *   locale: import('date-fns').Locale,
 * }} props
 */
export default function PaymentVerificationPanel({
    unverifiedEvidence,
    selectedEvidenceId,
    onEvidenceChange,
    onOpenEvidence,
    isReviewingEvidence,
    paymentReference,
    onPaymentReferenceChange,
    onVerifyPayment,
    isVerifyingPayment,
    locale,
}) {
    return (
        <div className="flex flex-col gap-3 border-b border-amber-500/20 bg-amber-500/5 p-4 sm:flex-row sm:items-end">
            <label className="flex-1 space-y-1 text-xs font-semibold">
                Evidencia recibida
                <select
                    value={selectedEvidenceId}
                    onChange={(event) => onEvidenceChange(event.target.value)}
                    className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-normal"
                >
                    <option value="">Selecciona una evidencia no verificada</option>
                    {unverifiedEvidence.map((evidence) => (
                        <option key={evidence.id} value={evidence.id}>
                            {Number(evidence.observed_amount).toFixed(2)} ·{' '}
                            {format(new Date(evidence.observed_at), 'dd/MM HH:mm', { locale })} ·{' '}
                            {DOMPurify.sanitize(evidence.submitted_by || '')}
                        </option>
                    ))}
                </select>
                <button
                    type="button"
                    onClick={onOpenEvidence}
                    disabled={!selectedEvidenceId || isReviewingEvidence}
                    className="mt-2 rounded border px-3 py-1.5 text-xs disabled:opacity-50"
                >
                    {isReviewingEvidence ? 'Abriendo…' : 'Revisar archivo y hash'}
                </button>
            </label>
            <label className="flex-1 space-y-1 text-xs font-semibold">
                Referencia del pago manual
                <input
                    value={paymentReference}
                    onChange={(event) => onPaymentReferenceChange(event.target.value)}
                    placeholder="Ej. operación 845921"
                    className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-normal"
                />
            </label>
            <button
                type="button"
                disabled={
                    !selectedEvidenceId ||
                    paymentReference.trim().length < 3 ||
                    isVerifyingPayment
                }
                onClick={onVerifyPayment}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
                {isVerifyingPayment ? 'Verificando…' : 'Verificar y confirmar'}
            </button>
        </div>
    );
}
