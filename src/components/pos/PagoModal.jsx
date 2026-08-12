import { useState, useEffect, memo } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import logger from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, ExternalLink } from 'lucide-react';
import TicketPOSPDF from '@/components/pos/TicketPOSPDF';
import { useHotelData } from '@/hooks/use-hotel-data';
import { YapeIcon, PlinIcon, EfectivoIcon, TarjetaIcon } from '@/components/PaymentIcons';
import { toast } from 'sonner';
import { crearComprobante } from '@/api/facturacion';
import ComprobanteModal from '@/components/comprobantes/ComprobanteModal';

const METODOS = [
    { value: 'efectivo', label: <span className="flex items-center gap-1"><EfectivoIcon /> Efectivo</span> },
    { value: 'yape', label: <span className="flex items-center gap-1"><YapeIcon /> Yape</span> },
    { value: 'plin', label: <span className="flex items-center gap-1"><PlinIcon /> Plin</span> },
    { value: 'transferencia', label: '🏦 Transferencia' },
    { value: 'tarjeta', label: <span className="flex items-center gap-1"><TarjetaIcon /> Tarjeta</span> },
];

/**
 * @param {Object} props
 * @param {boolean} props.open
 * @param {function} props.onClose
 * @param {any} props.resumen
 * @param {any} props.reservaSeleccionada
 * @param {function} props.onExito
 */
const PagoModal = memo(function PagoModal(/** @type {any} */ { open, onClose, resumen, reservaSeleccionada, onExito }) {
    const qc = useQueryClient();
    const { db: hotelDb, hotelId } = useHotelData();
    const [metodoPago, setMetodoPago] = useState('efectivo');
    const [descuento, setDescuento] = useState(0);
    const [tipoComprobante, setTipoComprobante] = useState('ninguno');
    const [rucCliente, setRucCliente] = useState('');
    const [razonSocial, setRazonSocial] = useState('');
    const [dniCliente, setDniCliente] = useState('');
    const [nombreCliente, setNombreCliente] = useState('');
    const [notas, setNotas] = useState('');
    const [ventaCreada, setVentaCreada] = useState(null);
    const [showComprobante, setShowComprobante] = useState(false);

    const { data: configs = [] } = useQuery({
        queryKey: ['config', hotelId],
        queryFn: () => hotelDb.ConfigHotel.list(),
        enabled: !!hotelId,
    });
    const config = configs[0] || {};

    // Prefill customer document details
    useEffect(() => {
        if (reservaSeleccionada) {
            setDniCliente(reservaSeleccionada.huesped_dni || '');
            setNombreCliente(reservaSeleccionada.huesped_nombre || '');
        } else {
            setDniCliente('');
            setNombreCliente('Cliente mostrador');
        }
    }, [reservaSeleccionada]);

    // Auto-select boleta if SUNAT is automatic
    useEffect(() => {
        if (config.modo_sunat === 'automatico') {
            setTipoComprobante('boleta');
        }
    }, [config.modo_sunat]);

    const totalFinal = Math.max(0, resumen.total - descuento);
    const estadoComprobante = tipoComprobante === 'ninguno' ? 'ticket_interno' : 'sunat_pendiente';

    const registrar = useMutation({
        mutationFn: async () => {
            const numeroTicket = `POS${Date.now().toString().slice(-6)}`;
            const ahora = new Date().toISOString();

            // 1. Crear la venta
            const venta = await hotelDb.VentaPOS.create({
                numero_ticket: numeroTicket,
                tipo: reservaSeleccionada ? (resumen.items.length > 0 ? 'estadía_extras' : 'solo_estadía') : 'solo_extras',
                habitacion_numero: reservaSeleccionada?.habitacion_numero || '',
                huesped_nombre: tipoComprobante === 'factura' ? razonSocial : (tipoComprobante === 'boleta' ? nombreCliente : (reservaSeleccionada?.huesped_nombre || 'Cliente mostrador')),
                huesped_dni: tipoComprobante === 'factura' ? rucCliente : (tipoComprobante === 'boleta' ? dniCliente : (reservaSeleccionada?.huesped_dni || '')),
                reserva_id: reservaSeleccionada?.id || null,
                items: resumen.items,
                subtotal_estadia: resumen.subtotalEstadia,
                subtotal_extras: resumen.subtotalExtras,
                descuento: Number(descuento),
                total: totalFinal,
                metodo_pago: metodoPago,
                estado_comprobante: estadoComprobante,
                tipo_comprobante: tipoComprobante,
                ruc_cliente: tipoComprobante === 'factura' ? rucCliente : '',
                razon_social: tipoComprobante === 'factura' ? razonSocial : '',
                notas,
                fecha_venta: ahora, // Usamos timestamp para precisión
            });

            // 2. Descontar stock de cada producto vendido
            if (resumen.items && resumen.items.length > 0) {
                const promises = resumen.items.map(async (item) => {
                    if (item.id) {
                        // Obtener stock actual del producto
                        const [prod] = await hotelDb.Producto.filter({ id: item.id });
                        if (prod && prod.stock !== undefined) {
                            const nuevoStock = Math.max(0, (prod.stock || 0) - (item.cantidad || 1));
                            return hotelDb.Producto.update(item.id, { stock: nuevoStock });
                        }
                    }
                });
                await Promise.all(promises);
            }

            // 3. Si hay reserva vinculada, marcarla como finalizada
            if (reservaSeleccionada) {
                await hotelDb.Reserva.update(reservaSeleccionada.id, { estado: 'finalizada' });
                await hotelDb.Habitacion.update(reservaSeleccionada.habitacion_id, { estado: 'disponible' });
            }

            // 4. Si SUNAT es automático y se requiere comprobante, facturar vía API
            if (config.modo_sunat === 'automatico' && tipoComprobante !== 'ninguno') {
                try {
                    const compRes = await crearComprobante({
                        hotel_id: hotelId,
                        tipo: tipoComprobante === 'factura' ? 'Factura' : 'Boleta',
                        serie: tipoComprobante === 'factura' ? 'F001' : 'B001',
                        numero: `${tipoComprobante === 'factura' ? 'F001' : 'B001'}-${Date.now()}`,
                        cliente_tipo: tipoComprobante === 'factura' ? '6' : (dniCliente ? '1' : '0'), // 6 = RUC, 1 = DNI, 0 = Doc. sin documento (Varios)
                        cliente_documento: tipoComprobante === 'factura' ? rucCliente : (dniCliente || '00000000'),
                        cliente_nombre: tipoComprobante === 'factura' ? razonSocial : (nombreCliente || 'Cliente Varios'),
                        subtotal: totalFinal / 1.18,
                        igv: (totalFinal / 1.18) * 0.18,
                        total: totalFinal,
                    });

                    // Actualizar el estado a sunat_emitido
                    const updatedVenta = await hotelDb.VentaPOS.update(venta.id, {
                        estado_comprobante: 'sunat_emitido',
                        notas: `${venta.notas || ''} [SUNAT: ${compRes.estado || 'Emitido'}]`.trim()
                    });
                    return updatedVenta;
                } catch (err) {
                    logger.error('Error enviando a SUNAT automáticamente (POS):', err);
                    toast.error(`Cobro registrado, pero falló el envío a SUNAT: ${err.message}`);
                    return {
                        ...venta,
                        _sunatError: err.message
                    };
                }
            }

            return venta;
        },
        onSuccess: (venta) => {
            qc.invalidateQueries({ queryKey: ['ventaspos', hotelId] });
            qc.invalidateQueries({ queryKey: ['reservas', hotelId] });
            qc.invalidateQueries({ queryKey: ['habitaciones', hotelId] });
            qc.invalidateQueries({ queryKey: ['productos-minimarket', hotelId] }); // refrescar stock
            if (venta._sunatError) {
                toast.success('Cobro registrado localmente (SUNAT pendiente)');
            } else if (config.modo_sunat === 'automatico' && venta.estado_comprobante === 'sunat_emitido') {
                toast.success('Comprobante emitido con éxito en SUNAT');
            } else {
                toast.success('Venta registrada con éxito');
            }
            setVentaCreada(venta);
            if (tipoComprobante !== 'ninguno') {
                setShowComprobante(true);
            }
        },
        onError: (err) => {
            logger.error('Error al registrar venta:', err);
            toast.error(`Error al registrar cobro: ${err.message || 'Error desconocido'}`);
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
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto rounded-xl glass-panel border-border/80 shadow-xl">
                <DialogHeader>
                    <DialogTitle className="font-display">
                        {ventaCreada ? '✅ Venta Registrada' : 'Confirmar Cobro'}
                    </DialogTitle>
                </DialogHeader>

                {!ventaCreada ? (
                    <div className="space-y-3">
                        {/* Resumen */}
                        <div className="bg-secondary/50 rounded-lg p-3 space-y-1.5 text-xs">
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
                            <div className="border-t border-border pt-1.5 mt-1.5">
                                <div className="flex justify-between text-muted-foreground">
                                    <span>Subtotal</span><span>S/ {resumen.total.toFixed(2)}</span>
                                </div>
                                {descuento > 0 && <div className="flex justify-between text-green-600"><span>Descuento</span><span>-S/ {Number(descuento).toFixed(2)}</span></div>}
                                <div className="flex justify-between font-bold text-foreground text-sm mt-1">
                                    <span>TOTAL</span><span>S/ {totalFinal.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Descuento */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label className="text-xs">Descuento (S/)</Label>
                                <Input type="number" min="0" className="mt-1 h-9 text-xs rounded-md" value={descuento} onChange={e => setDescuento(Number(e.target.value))} placeholder="0.00" />
                            </div>
                            <div>
                                <Label className="text-xs">Método de pago</Label>
                                <Select value={metodoPago} onValueChange={setMetodoPago}>
                                    <SelectTrigger className="mt-1 h-9 text-xs rounded-md"><SelectValue /></SelectTrigger>
                                    <SelectContent>{METODOS.map(m => <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Comprobante */}
                        <div>
                            <Label className="text-xs">Comprobante</Label>
                            <Select value={tipoComprobante} onValueChange={setTipoComprobante}>
                                <SelectTrigger className="mt-1 h-9 text-xs rounded-md"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ninguno" className="text-xs">Ticket interno (sin SUNAT)</SelectItem>
                                    <SelectItem value="boleta" className="text-xs">Boleta de Venta</SelectItem>
                                    <SelectItem value="factura" className="text-xs">Factura</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {tipoComprobante === 'boleta' && (
                            <div className="space-y-3">
                                <div>
                                    <Label className="text-xs">DNI / Documento del cliente</Label>
                                    <Input className="mt-1 h-9 text-xs rounded-md" value={dniCliente} onChange={e => setDniCliente(e.target.value)} placeholder="DNI, CE o Pasaporte" />
                                </div>
                                <div>
                                    <Label className="text-xs">Nombre completo</Label>
                                    <Input className="mt-1 h-9 text-xs rounded-md" value={nombreCliente} onChange={e => setNombreCliente(e.target.value)} placeholder="Nombre del cliente" />
                                </div>
                            </div>
                        )}

                        {tipoComprobante === 'factura' && (
                            <div className="space-y-3">
                                <div>
                                    <Label className="text-xs">RUC del cliente</Label>
                                    <Input className="mt-1 h-9 text-xs rounded-md" value={rucCliente} onChange={e => setRucCliente(e.target.value)} placeholder="20XXXXXXXXX" />
                                </div>
                                <div>
                                    <Label className="text-xs">Razón Social</Label>
                                    <Input className="mt-1 h-9 text-xs rounded-md" value={razonSocial} onChange={e => setRazonSocial(e.target.value)} placeholder="Empresa S.A.C." />
                                </div>
                            </div>
                        )}

                        {config.modo_sunat === 'automatico' && tipoComprobante !== 'ninguno' && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                                Se generará y enviará el comprobante electrónico a la SUNAT de forma automática.
                            </div>
                        )}

                        <div>
                            <Label className="text-xs">Notas internas</Label>
                            <Input className="mt-1 h-9 text-xs rounded-md" value={notas} onChange={e => setNotas(e.target.value)} placeholder="Observaciones opcionales..." />
                        </div>

                        <div className="flex gap-2 pt-2">
                            <Button variant="outline" className="flex-1 h-9 text-xs rounded-md" onClick={handleClose}>Cancelar</Button>
                            <Button className="flex-1 h-9 text-xs rounded-md" disabled={registrar.isPending}
                                onClick={() => {
                                    if (tipoComprobante === 'factura' && (!rucCliente || rucCliente.length !== 11)) {
                                        toast.error('El RUC debe tener 11 dígitos para emitir factura.');
                                        return;
                                    }
                                    if (tipoComprobante === 'boleta') {
                                        if (dniCliente && dniCliente.length > 0 && dniCliente.length < 8) {
                                            toast.error('Si ingresas un DNI, debe tener al menos 8 dígitos.');
                                            return;
                                        }
                                        if (!dniCliente && totalFinal >= 700) {
                                            toast.error('Para ventas mayores a S/ 700, el DNI es obligatorio.');
                                            return;
                                        }
                                    }
                                    registrar.mutate();
                                }}>
                                {registrar.isPending ? 'Procesando...' : `Cobrar S/ ${totalFinal.toFixed(2)}`}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="text-center py-4">
                            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                                <CheckCircle className="w-6 h-6 text-green-600" />
                            </div>
                            <p className="font-bold text-foreground">S/ {ventaCreada.total?.toFixed(2)}</p>
                            <p className="text-xs text-muted-foreground">Ticket #{ventaCreada.numero_ticket}</p>
                        </div>

                        <TicketPOSPDF venta={ventaCreada} config={config} />

                        {ventaCreada.estado_comprobante === 'sunat_pendiente' && (
                            <Button onClick={() => window.open('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', '_blank')}
                                className="w-full gap-2 bg-blue-600 hover:bg-blue-700 h-9 text-xs rounded-md">
                                <ExternalLink className="w-3.5 h-3.5" /> Emitir en Portal SUNAT
                            </Button>
                        )}

                        <Button variant="outline" className="w-full h-9 text-xs rounded-md" onClick={handleClose}>Cerrar y nueva venta</Button>
                    </div>
                )}
            </DialogContent>
            {showComprobante && ventaCreada && (
                <ComprobanteModal
                    isOpen={showComprobante}
                    onClose={() => {
                        setShowComprobante(false);
                        handleClose();
                    }}
                    ventaPos={ventaCreada}
                    hotel={config}
                    onEmitido={(filename, tipo) => {
                        logger.info(`Comprobante ${tipo} generado:`, filename);
                    }}
                />
            )}
        </Dialog>
    );
});
PagoModal.displayName = 'PagoModal';
export default PagoModal;