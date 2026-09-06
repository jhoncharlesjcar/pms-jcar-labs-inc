import { useEffect, useState, memo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { crearNotaComprobante } from '@/api/facturacion';
import { toast } from 'sonner';

// Catálogo 09 (tipo de nota) — códigos habituales para NC y ND.
const TIPOS_NOTA = {
  nota_credito: [
    { value: '01', label: '01 - Anulación de la operación' },
    { value: '03', label: '03 - Corrección por error en la descripción' },
    { value: '04', label: '04 - Descuento global' },
    { value: '06', label: '06 - Devolución total' },
    { value: '07', label: '07 - Devolución por ítem' },
    { value: '09', label: '09 - Disminución en el valor' },
    { value: '10', label: '10 - Otros conceptos' },
  ],
  nota_debito: [
    { value: '01', label: '01 - Intereses por mora' },
    { value: '02', label: '02 - Aumento en el valor' },
    { value: '03', label: '03 - Penalidades / Otros' },
  ],
};

const NotaComprobanteDialog = memo(function NotaComprobanteDialog(/** @type {any} */ { open, onClose, comprobante }) {
  const [tipo, setTipo] = useState('nota_credito');
  const [tipoNota, setTipoNota] = useState('01');
  const [motivo, setMotivo] = useState('');
  const [subtotal, setSubtotal] = useState('0.00');
  const [igv, setIgv] = useState('0.00');
  const [total, setTotal] = useState('0.00');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (open && comprobante) {
      setTipo('nota_credito');
      setTipoNota('01');
      setMotivo('');
      setSubtotal(Number(comprobante.subtotal || 0).toFixed(2));
      setIgv(Number(comprobante.igv || 0).toFixed(2));
      setTotal(Number(comprobante.total || 0).toFixed(2));
    }
  }, [open, comprobante]);

  const handleTipoChange = (value) => {
    setTipo(value);
    setTipoNota(value === 'nota_credito' ? '01' : '01');
  };

  const emitir = async () => {
    if (!comprobante?.id) {
      toast.error('No se encontró el comprobante original');
      return;
    }
    const montoTotal = Number(total);
    if (!Number.isFinite(montoTotal) || montoTotal <= 0) {
      toast.error('El total de la nota debe ser mayor a 0');
      return;
    }
    setEnviando(true);
    try {
      await crearNotaComprobante({
        comprobante_ref_id: comprobante.id,
        tipo,
        tipo_nota: tipoNota,
        motivo: motivo.trim() || undefined,
        subtotal: Number(subtotal),
        igv: Number(igv),
        total: montoTotal,
      });
      toast.success('Nota encolada para emisión SUNAT');
      onClose();
    } catch (err) {
      toast.error(err?.message || 'No se pudo emitir la nota');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Emitir Nota de Crédito / Débito</DialogTitle>
          <p className="text-xs text-muted-foreground">
            Referencia: {comprobante?.serie}-{comprobante?.numero} ({comprobante?.tipo})
          </p>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Tipo de nota</Label>
            <Select value={tipo} onValueChange={handleTipoChange}>
              <SelectTrigger className="h-9 rounded-lg bg-background/50"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nota_credito">Nota de Crédito (07)</SelectItem>
                <SelectItem value="nota_debito">Nota de Débito (08)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Motivo (Catálogo 09)</Label>
            <Select value={tipoNota} onValueChange={setTipoNota}>
              <SelectTrigger className="h-9 rounded-lg bg-background/50"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(TIPOS_NOTA[tipo] || []).map((op) => (
                  <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Descripción / motivo</Label>
            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. Anulación de boleta por error" className="h-9 rounded-lg bg-background/50 text-xs" />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Base (S/)</Label>
              <Input value={subtotal} onChange={(e) => setSubtotal(e.target.value)} inputMode="decimal" className="h-9 rounded-lg bg-background/50 text-xs tabular-nums" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">IGV (S/)</Label>
              <Input value={igv} onChange={(e) => setIgv(e.target.value)} inputMode="decimal" className="h-9 rounded-lg bg-background/50 text-xs tabular-nums" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Total (S/)</Label>
              <Input value={total} onChange={(e) => setTotal(e.target.value)} inputMode="decimal" className="h-9 rounded-lg bg-background/50 text-xs tabular-nums" />
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground">
            Para anulación total, deja los montos iguales a los del comprobante original.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={enviando}>Cancelar</Button>
          <Button onClick={emitir} disabled={enviando}>
            {enviando ? 'Enviando…' : 'Emitir nota'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
NotaComprobanteDialog.displayName = 'NotaComprobanteDialog';
export default NotaComprobanteDialog;
