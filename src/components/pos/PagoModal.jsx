import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, Printer, ExternalLink } from 'lucide-react';
import TicketPOSPDF from '@/components/pos/TicketPOSPDF';

const METODOS = [
    { value: 'efectivo', label: '💵 Efectivo' },
    { value: 'yape', label: '📱 Yape' },
    { value: 'plin', label: '📲 Plin' },
    { value: 'transferencia', label: '🏦 Transferencia' },
    { value: 'tarjeta', label: '💳 Tarjeta' },
];

export default function PagoModal({ open, onClose, resumen, reservaSeleccionada, onExito }) {
    const qc = useQueryClient();
    const [metodoPago, setMetodoPago] = useState('efectivo');
    const [descuento, setDescuento] = useState(0);
    const [tipoComprobante, setTipoComprobante] = useState('ninguno');
    const [rucCliente, setRucCliente] = useState('');
    const [razonSocial, setRazonSocial] = useState('');
    const [notas, setNotas] = useState('');
    const [ventaCreada, setVentaCreada] = useState(null);

    const { data: configs = [] } = useQuery({ queryKey: ['config'], queryFn: () => base44.entities.ConfigHotel.list() });
    const config = configs[0] || {};

    const totalFinal = Math.max(0, resumen.total - descuento);
    const estadoComprobante = tipoComprobante === 'ninguno' ? 'ticket_interno' : 'sunat_pendiente';

    const registrar = useMutation({
        mutationFn: async () => {
            const numeroTicket = `POS${Date.now().toString().slice(-6)}`;
            const hoy = new Date().toISOString().split('T')[0];

            const venta = await base44.entities.VentaPOS.create({
                numero_ticket: numeroTicket,
                tipo: reservaSeleccionada ? (resumen.items.length > 0 ? 'estadía_extras' : 'solo_estadía') : 'solo_extras',
                habitacion_numero: reservaSeleccionada?.habitacion_numero || '',
                huesped_nombre: reservaSeleccionada?.huesped_nombre || 'Cliente mostrador',
                huesped_dni: reservaSeleccionada?.huesped_dni || '',
                reserva_id: reservaSeleccionada?.id || '',
                items: resumen.items,
                subtotal_estadía: resumen.subtotalEstadia,
                subtotal_extras: resumen.subtotalExtras,
                descuento: Number(descuento),
                total: totalFinal,
                metodo_pago: metodoPago,
                estado_comprobante: estadoComprobante,
                tipo_comprobante: tipoComprobante,
                ruc_cliente: rucCliente,
                razon_social: razonSocial,
                notas,
                fecha_venta: hoy,
            });

            // Si hay reserva vinculada, marcarla como finalizada
            if (reservaSeleccionada) {
                await base44.entities.Reserva.update(reservaSeleccionada.id, { estado: 'finalizada' });
                await base44.entities.Habitacion.update(reservaSeleccionada.habitacion_id, { estado: 'disponible' });
            }

            return venta;
        },
        onSuccess: (venta) => {
            qc.invalidateQueries({ queryKey: ['ventaspos'] });
            qc.invalidateQueries({ queryKey: ['reservas'] });
            qc.invalidateQueries({ queryKey: ['habitaciones'] });
            setVentaCreada(venta);
        },
    });

    const handleClose = () => {
        setVentaCreada(null);
        setDescuento(0);
        setTipoComprobante('ninguno');
        setMetodoPago('efectivo');
        setRucCliente('');
        setRazonSocial('');
        setNotas('');
        onClose();
        if (ventaCreada) onExito();
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="font-display">
                        {ventaCreada ? '✅ Venta Registrada' : 'Confirmar Cobro'}
                    </DialogTitle>
                </DialogHeader>

                {!ventaCreada ? (
                    <div className="space-y-4">
                        {/* Resumen */}
                        <div className="bg-secondary/50 rounded-xl p-4 space-y-2 text-sm">
                            {reservaSeleccionada && resumen.subtotalEstadia > 0 && (
                                <div className="flex justify-between text-muted-foreground">
                                    <span>🏨 Estadía ({reservaSeleccionada.noches} noche(s))</span>
                                    <span>S/ {resumen.subtotalEstadia.toFixed(2)}</span>
                                </div>
                            )}
                            {resumen.items.map((item, i) => (
                                <div key={i} className="flex justify-between text-muted-foreground">
                                    <span>{item.emoji || '📦'} {item.nombre} ×{item.cantidad}</span>
                                    <span>S/ {(item.precio * item.cantidad).toFixed(2)}</span>
                                </div>
                            ))}
                            <div className="border-t border-border pt-2">
                                <div className="flex justify-between text-muted-foreground">
                                    <span>Subtotal</span><span>S/ {resumen.total.toFixed(2)}</span>
                                </div>
                                {descuento > 0 && <div className="flex justify-between text-green-600"><span>Descuento</span><span>-S/ {Number(descuento).toFixed(2)}</span></div>}
                                <div className="flex justify-between font-bold text-foreground text-base mt-1">
                                    <span>TOTAL</span><span>S/ {totalFinal.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Descuento */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Descuento (S/)</Label>
                                <Input type="number" min="0" className="mt-1" value={descuento} onChange={e => setDescuento(Number(e.target.value))} placeholder="0.00" />
                            </div>
                            <div>
                                <Label>Método de pago</Label>
                                <Select value={metodoPago} onValueChange={setMetodoPago}>
                                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                    <SelectContent>{METODOS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Comprobante */}
                        <div>
                            <Label>Comprobante</Label>
                            <Select value={tipoComprobante} onValueChange={setTipoComprobante}>
                                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ninguno">Ticket interno (sin SUNAT)</SelectItem>
                                    <SelectItem value="boleta">Boleta de Venta</SelectItem>
                                    <SelectItem value="factura">Factura</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {tipoComprobante === 'factura' && (
                            <div className="space-y-3">
                                <div>
                                    <Label>RUC del cliente</Label>
                                    <Input className="mt-1" value={rucCliente} onChange={e => setRucCliente(e.target.value)} placeholder="20XXXXXXXXX" />
                                </div>
                                <div>
                                    <Label>Razón Social</Label>
                                    <Input className="mt-1" value={razonSocial} onChange={e => setRazonSocial(e.target.value)} placeholder="Empresa S.A.C." />
                                </div>
                            </div>
                        )}

                        <div>
                            <Label>Notas internas</Label>
                            <Input className="mt-1" value={notas} onChange={e => setNotas(e.target.value)} placeholder="Observaciones opcionales..." />
                        </div>

                        <div className="flex gap-3 pt-2">
                            <Button variant="outline" className="flex-1" onClick={handleClose}>Cancelar</Button>
                            <Button className="flex-1" disabled={registrar.isPending}
                                onClick={() => registrar.mutate()}>
                                {registrar.isPending ? 'Procesando...' : `Cobrar S/ ${totalFinal.toFixed(2)}`}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="text-center py-4">
                            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                <CheckCircle className="w-7 h-7 text-green-600" />
                            </div>
                            <p className="font-bold text-foreground">S/ {ventaCreada.total?.toFixed(2)}</p>
                            <p className="text-sm text-muted-foreground">Ticket #{ventaCreada.numero_ticket}</p>
                        </div>

                        <TicketPOSPDF venta={ventaCreada} config={config} />

                        {ventaCreada.estado_comprobante === 'sunat_pendiente' && (
                            <Button onClick={() => window.open('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', '_blank')}
                                className="w-full gap-2 bg-blue-600 hover:bg-blue-700">
                                <ExternalLink className="w-4 h-4" /> Emitir en Portal SUNAT
                            </Button>
                        )}

                        <Button variant="outline" className="w-full" onClick={handleClose}>Cerrar y nueva venta</Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}