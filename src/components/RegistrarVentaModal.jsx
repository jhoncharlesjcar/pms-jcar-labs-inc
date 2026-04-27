import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { db } from '@/api/db';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExternalLink, CheckCircle } from 'lucide-react';
import TicketPDF from '@/components/TicketPDF';
import { useHotel } from '@/lib/HotelContext';

export default function RegistrarVentaModal({ reserva, onClose, onSuccess }) {
    const qc = useQueryClient();
    const { hotelActual } = useHotel();
    const hotelId = hotelActual?.id;
    const [metodo, setMetodo] = useState('efectivo');
    const [descuento, setDescuento] = useState(0);
    const [requiereComprobante, setRequiereComprobante] = useState(false);
    const [tipoComprobante, setTipoComprobante] = useState('boleta');
    const [rucCliente, setRucCliente] = useState('');
    const [razonSocial, setRazonSocial] = useState('');
    const [ventaCreada, setVentaCreada] = useState(null);

    const { data: configs = [] } = useQuery({
        queryKey: ['config', hotelId],
        queryFn: () => db.entities.ConfigHotel.filter({ hotel_id: hotelId }),
        enabled: !!hotelId,
    });
    const config = configs[0] || {};

    const total = (reserva.total || 0) - Number(descuento || 0);

    const registrar = useMutation({
        mutationFn: () => db.entities.Venta.create({
            hotel_id: hotelId,
            numero_ticket: `T${Date.now().toString().slice(-6)}`,
            reserva_id: reserva.id,
            numero_reserva: reserva.numero_reserva,
            habitacion_numero: reserva.habitacion_numero,
            habitacion_tipo: reserva.habitacion_tipo,
            huesped_nombre: reserva.huesped_nombre,
            huesped_dni: reserva.huesped_dni,
            fecha_entrada: reserva.fecha_entrada,
            fecha_salida: reserva.fecha_salida,
            noches: reserva.noches,
            precio_noche: reserva.precio_noche,
            subtotal: reserva.total,
            descuento: Number(descuento),
            total,
            metodo_pago: metodo,
            estado_comprobante: requiereComprobante ? 'sunat_pendiente' : 'ticket_interno',
            tipo_comprobante: requiereComprobante ? tipoComprobante : 'ninguno',
            ruc_cliente: rucCliente,
            razon_social: razonSocial,
            fecha_pago: new Date().toLocaleDateString('sv-SE'),
        }),
        onSuccess: (venta) => {
            qc.invalidateQueries({ queryKey: ['ventas'] });
            setVentaCreada(venta);
        },
    });

    const abrirSunat = () => {
        window.open('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', '_blank');
    };

    if (ventaCreada) {
        return (
            <Dialog open onOpenChange={onClose}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="font-display flex items-center gap-2 text-green-700">
                            <CheckCircle className="w-5 h-5" /> Pago Registrado
                        </DialogTitle>
                    </DialogHeader>
                    <div className="text-center space-y-4">
                        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                            <p className="text-2xl font-bold text-green-700">S/ {ventaCreada.total?.toFixed(2)}</p>
                            <p className="text-sm text-green-600">Ticket #{ventaCreada.numero_ticket} · {ventaCreada.metodo_pago}</p>
                        </div>

                        <TicketPDF venta={ventaCreada} config={config} />

                        {ventaCreada.estado_comprobante === 'sunat_pendiente' && (
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-left">
                                <p className="text-sm font-semibold text-blue-800 mb-2">El cliente solicitó comprobante SUNAT</p>
                                <p className="text-xs text-blue-600 mb-3">Ingresa al portal de SUNAT para emitir la {ventaCreada.tipo_comprobante}</p>
                                <Button onClick={abrirSunat} className="w-full gap-2 bg-blue-600 hover:bg-blue-700">
                                    <ExternalLink className="w-4 h-4" /> Ir a Portal SUNAT
                                </Button>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <Button variant="outline" className="flex-1" onClick={() => { onSuccess(); onClose(); }}>
                                Cerrar
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="font-display">Registrar Cobro — Hab. #{reserva.habitacion_numero}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    {/* Resumen */}
                    <div className="bg-secondary rounded-xl p-4 text-sm space-y-1">
                        <div className="flex justify-between"><span className="text-muted-foreground">Huésped</span><span className="font-medium">{reserva.huesped_nombre}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Habitación</span><span className="font-medium">#{reserva.habitacion_numero} ({reserva.habitacion_tipo})</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Noches</span><span className="font-medium">{reserva.noches}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">S/ {reserva.precio_noche} × {reserva.noches}</span><span className="font-medium">S/ {reserva.total?.toFixed(2)}</span></div>
                    </div>

                    {/* Descuento */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label>Descuento (S/)</Label>
                            <Input type="number" min={0} value={descuento} onChange={e => setDescuento(e.target.value)} className="mt-1" />
                        </div>
                        <div>
                            <Label>Método de pago</Label>
                            <Select value={metodo} onValueChange={setMetodo}>
                                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {['efectivo', 'yape', 'plin', 'transferencia', 'tarjeta'].map(m => (
                                        <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Total */}
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex justify-between items-center">
                        <span className="font-semibold text-foreground">TOTAL A COBRAR</span>
                        <span className="text-2xl font-bold text-primary">S/ {total.toFixed(2)}</span>
                    </div>

                    {/* Comprobante SUNAT */}
                    <div className="border border-border rounded-xl p-4 space-y-3">
                        <p className="text-sm font-semibold text-foreground">¿El cliente requiere comprobante?</p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setRequiereComprobante(false)}
                                className={`flex-1 py-2 rounded-xl border-2 text-sm font-medium transition-all ${!requiereComprobante ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground'}`}
                            >
                                No — Ticket rápido
                            </button>
                            <button
                                onClick={() => setRequiereComprobante(true)}
                                className={`flex-1 py-2 rounded-xl border-2 text-sm font-medium transition-all ${requiereComprobante ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-border text-muted-foreground'}`}
                            >
                                Sí — Emitir en SUNAT
                            </button>
                        </div>

                        {requiereComprobante && (
                            <div className="space-y-3 pt-1">
                                <div>
                                    <Label>Tipo de comprobante</Label>
                                    <Select value={tipoComprobante} onValueChange={setTipoComprobante}>
                                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="boleta">Boleta de Venta</SelectItem>
                                            <SelectItem value="factura">Factura</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {tipoComprobante === 'factura' && (
                                    <>
                                        <div>
                                            <Label>RUC del cliente</Label>
                                            <Input value={rucCliente} onChange={e => setRucCliente(e.target.value)} placeholder="20XXXXXXXXX" className="mt-1" />
                                        </div>
                                        <div>
                                            <Label>Razón social</Label>
                                            <Input value={razonSocial} onChange={e => setRazonSocial(e.target.value)} placeholder="Empresa SAC" className="mt-1" />
                                        </div>
                                    </>
                                )}
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                                    Al registrar, se marcará como pendiente. Luego podrás emitirlo directamente en el portal SUNAT.
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-3">
                        <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
                        <Button className="flex-1" onClick={() => registrar.mutate()} disabled={registrar.isPending}>
                            {registrar.isPending ? 'Registrando...' : 'Registrar Pago'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}