import React, { memo } from 'react';
import { ReceiptText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const ComprobanteSelector = memo(function ComprobanteSelector(/** @type {any} */ {
    requiereComprobante,
    setRequiereComprobante,
    tipoComprobante,
    setTipoComprobante,
    dniCliente,
    setDniCliente,
    nombreCliente,
    setNombreCliente,
    rucCliente,
    setRucCliente,
    razonSocial,
    setRazonSocial,
    config
}) {
    return (
        <section aria-labelledby="checkout-comprobante" className="border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
                <ReceiptText className="h-4 w-4 text-primary" />
                <h3 id="checkout-comprobante" className="text-sm font-semibold text-foreground">Comprobante</h3>
            </div>
            <p className="text-xs text-muted-foreground">¿El cliente requiere comprobante electrónico?</p>
            <div className="flex gap-3">
                <button
                    type="button"
                    aria-pressed={!requiereComprobante}
                    onClick={() => setRequiereComprobante(false)}
                    className={`flex-1 h-10 rounded-lg border text-xs font-semibold transition-[transform,opacity] ${!requiereComprobante ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground'}`}
                >
                    No — Ticket rápido
                </button>
                <button
                    type="button"
                    aria-pressed={requiereComprobante}
                    onClick={() => setRequiereComprobante(true)}
                    className={`flex-1 h-10 rounded-lg border text-xs font-semibold transition-[transform,opacity] ${requiereComprobante ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-border text-muted-foreground'}`}
                >
                    Sí — Emitir en SUNAT
                </button>
            </div>

            {requiereComprobante && (
                <div className="space-y-3 pt-1">
                    <div className="space-y-1">
                        <Label className="text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider ml-1">Tipo de comprobante</Label>
                        <Select value={tipoComprobante} onValueChange={setTipoComprobante}>
                            <SelectTrigger className="h-10 rounded-lg bg-background/50"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="boleta">Boleta de Venta</SelectItem>
                                <SelectItem value="factura">Factura</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {tipoComprobante === 'boleta' && (
                        <>
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider ml-1">DNI / Documento del cliente</Label>
                                <Input value={dniCliente} onChange={e => setDniCliente(e.target.value)} inputMode="text" placeholder="DNI, CE o Pasaporte" className="h-10 rounded-lg bg-background/50 font-mono" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider ml-1">Nombre completo</Label>
                                <Input value={nombreCliente} onChange={e => setNombreCliente(e.target.value)} placeholder="Nombre del cliente" className="h-10 rounded-lg bg-background/50" />
                            </div>
                        </>
                    )}
                    {tipoComprobante === 'factura' && (
                        <>
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider ml-1">RUC del cliente</Label>
                                <Input value={rucCliente} onChange={e => setRucCliente(e.target.value)} inputMode="numeric" pattern="[0-9]*" placeholder="20XXXXXXXXX" className="h-10 rounded-lg bg-background/50 font-mono" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider ml-1">Razón social</Label>
                                <Input value={razonSocial} onChange={e => setRazonSocial(e.target.value)} placeholder="Empresa SAC" className="h-10 rounded-lg bg-background/50" />
                            </div>
                        </>
                    )}
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-xs text-blue-600 dark:text-blue-400">
                        {config.modo_sunat === 'automatico' 
                            ? 'Se generará y enviará el comprobante electrónico a la SUNAT de forma automática.' 
                            : 'Al registrar, se marcará como pendiente. Luego podrás emitirlo directamente en el portal de SUNAT.'}
                    </div>
                </div>
            )}
        </section>
    );
});
