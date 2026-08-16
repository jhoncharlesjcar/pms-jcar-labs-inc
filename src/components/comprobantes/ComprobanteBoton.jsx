import { useState, memo } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Receipt } from 'lucide-react';
import ComprobanteModal from './ComprobanteModal';
import { getComprobanteStatus } from './ComprobanteStatus';

/**
 * Reusable button to open the ComprobanteModal.
 * Supports different layout variants: 'default', 'compact', or 'icon'.
 * @param {{ventaPos: object, hotel: object, variant?: string, onEmitido?: function}} props
 */
const ComprobanteBoton = memo(function ComprobanteBoton({ ventaPos, hotel, variant = 'default', onEmitido }) {
  const [open, setOpen] = useState(false);

  if (!ventaPos) return null;

  const status = getComprobanteStatus(ventaPos.estado_comprobante);
  const actionLabel = ventaPos.estado_comprobante === 'sunat_emitido'
    ? 'Ver comprobante'
    : ventaPos.estado_comprobante === 'sunat_rechazado'
      ? 'Revisar comprobante'
      : ventaPos.estado_comprobante === 'sunat_pendiente'
        ? 'Preparar comprobante'
        : 'Entregar ticket';
  const accessibleLabel = `${actionLabel}. Estado: ${status.label}`;

  return (
    <>
      {variant === 'icon' && (
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setOpen(true)}
          title={accessibleLabel}
          aria-label={accessibleLabel}
          className="h-8 w-8 text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-md"
        >
          <FileText className="w-4 h-4" />
        </Button>
      )}

      {variant === 'compact' && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setOpen(true)}
          title={accessibleLabel}
          className="h-8 px-2.5 gap-1 border-purple-200 text-purple-600 hover:bg-purple-50 hover:text-purple-700 rounded-md text-[11px] font-semibold tracking-wide"
        >
          <Receipt className="w-3.5 h-3.5" />
          {ventaPos.estado_comprobante === 'ticket_interno' ? 'Ticket' : 'Comprobante'}
        </Button>
      )}

      {variant === 'default' && (
        <Button
          onClick={() => setOpen(true)}
          title={accessibleLabel}
          className="gap-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold"
        >
          <Receipt className="w-4 h-4" />
          {actionLabel}
        </Button>
      )}

      {open && (
        <ComprobanteModal
          isOpen={open}
          onClose={() => setOpen(false)}
          ventaPos={ventaPos}
          hotel={hotel}
          onEmitido={onEmitido}
        />
      )}
    </>
  );
});
ComprobanteBoton.displayName = 'ComprobanteBoton';
export default ComprobanteBoton;
