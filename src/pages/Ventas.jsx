import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Receipt, Search, ExternalLink, Printer, TrendingUp, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import TicketPDF from '@/components/TicketPDF';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const estadoComp = {
    ticket_interno: { label: 'Ticket Interno', color: 'bg-secondary text-muted-foreground' },
    sunat_pendiente: { label: 'SUNAT Pendiente', color: 'bg-orange-100 text-orange-700' },
    sunat_emitido: { label: 'SUNAT Emitido', color: 'bg-green-100 text-green-700' },
};

const metodoPagoIcon = { efectivo: '💵', yape: '📱', plin: '📲', transferencia: '🏦', tarjeta: '💳' };

export default function Ventas() {
    const qc = useQueryClient();
    const [busqueda, setBusqueda] = useState('');
    const [filtroMetodo, setFiltroMetodo] = useState('todos');
    const [ventaDetalle, setVentaDetalle] = useState(null);

    const { data: ventas = [], isLoading } = useQuery({
        queryKey: ['ventas'],
        queryFn: () => base44.entities.Venta.list('-created_date'),
    });

    const { data: configs = [] } = useQuery({
        queryKey: ['config'],
        queryFn: () => base44.entities.ConfigHotel.list(),
    });
    const config = configs[0] || {};

    const marcarSunatEmitido = useMutation({
        mutationFn: (id) => base44.entities.Venta.update(id, { estado_comprobante: 'sunat_emitido' }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['ventas'] }),
    });

    const filtradas = ventas.filter(v => {
        const matchBusq = !busqueda || v.huesped_nombre?.toLowerCase().includes(busqueda.toLowerCase()) || v.numero_ticket?.includes(busqueda) || v.habitacion_numero?.includes(busqueda);
        const matchMetodo = filtroMetodo === 'todos' || v.metodo_pago === filtroMetodo;
        return matchBusq && matchMetodo;
    });

    const totalFiltrado = filtradas.reduce((s, v) => s + (v.total || 0), 0);
    const totalGeneral = ventas.reduce((s, v) => s + (v.total || 0), 0);

    const porMetodo = {};
    ventas.forEach(v => { porMetodo[v.metodo_pago] = (porMetodo[v.metodo_pago] || 0) + (v.total || 0); });

    return (
        <div className="space-y-6">
            <div>
                <h1 className="font-display text-3xl font-bold text-foreground">Ventas & Tickets</h1>
                <p className="text-muted-foreground mt-1">Historial de cobros y comprobantes</p>
            </div>

            {/* Resumen */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-card rounded-2xl border border-border p-5 col-span-2 lg:col-span-1">
                    <p className="text-xs text-muted-foreground mb-1">Total Ingresos</p>
                    <p className="text-2xl font-bold text-foreground">S/ {totalGeneral.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">{ventas.length} transacciones</p>
                </div>
                {Object.entries(porMetodo).map(([metodo, monto]) => (
                    <div key={metodo} className="bg-card rounded-2xl border border-border p-5">
                        <p className="text-xs text-muted-foreground mb-1 capitalize">{metodoPagoIcon[metodo]} {metodo}</p>
                        <p className="text-xl font-bold text-foreground">S/ {monto.toFixed(2)}</p>
                    </div>
                ))}
            </div>

            {/* Filtros */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar ticket, huésped..." className="pl-9" />
                </div>
                <div className="flex gap-2 flex-wrap">
                    {['todos', 'efectivo', 'yape', 'plin', 'transferencia', 'tarjeta'].map(m => (
                        <button key={m} onClick={() => setFiltroMetodo(m)} className={cn(
                            "px-3 py-2 rounded-xl text-xs font-medium border transition-all capitalize",
                            filtroMetodo === m ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:bg-secondary"
                        )}>
                            {m === 'todos' ? 'Todos' : `${metodoPagoIcon[m]} ${m}`}
                        </button>
                    ))}
                </div>
            </div>

            {busqueda || filtroMetodo !== 'todos' ? (
                <div className="text-sm text-muted-foreground">
                    Mostrando {filtradas.length} resultado(s) · Total: <strong>S/ {totalFiltrado.toFixed(2)}</strong>
                </div>
            ) : null}

            {/* Tabla */}
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border bg-secondary/50">
                                <th className="text-left px-5 py-3 font-medium text-muted-foreground">Ticket</th>
                                <th className="text-left px-5 py-3 font-medium text-muted-foreground">Huésped</th>
                                <th className="text-left px-5 py-3 font-medium text-muted-foreground">Habitación</th>
                                <th className="text-left px-5 py-3 font-medium text-muted-foreground">Pago</th>
                                <th className="text-right px-5 py-3 font-medium text-muted-foreground">Total</th>
                                <th className="text-left px-5 py-3 font-medium text-muted-foreground">Comprobante</th>
                                <th className="text-left px-5 py-3 font-medium text-muted-foreground">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {filtradas.map(v => {
                                const comp = estadoComp[v.estado_comprobante] || estadoComp.ticket_interno;
                                return (
                                    <tr key={v.id} className="hover:bg-secondary/30 transition-colors">
                                        <td className="px-5 py-4">
                                            <p className="font-medium text-foreground">#{v.numero_ticket}</p>
                                            <p className="text-xs text-muted-foreground">{v.fecha_pago}</p>
                                        </td>
                                        <td className="px-5 py-4">
                                            <p className="font-medium">{v.huesped_nombre}</p>
                                            <p className="text-xs text-muted-foreground">DNI: {v.huesped_dni || 'N/A'}</p>
                                        </td>
                                        <td className="px-5 py-4">
                                            <p>Hab. #{v.habitacion_numero}</p>
                                            <p className="text-xs text-muted-foreground">{v.noches} noche(s)</p>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className="capitalize">{metodoPagoIcon[v.metodo_pago]} {v.metodo_pago}</span>
                                        </td>
                                        <td className="px-5 py-4 text-right font-bold text-foreground">
                                            S/ {v.total?.toFixed(2)}
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className={cn("text-xs px-2 py-1 rounded-full font-medium", comp.color)}>
                                                {comp.label}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex gap-2">
                                                <button onClick={() => setVentaDetalle(v)} className="text-xs text-primary hover:underline flex items-center gap-1">
                                                    <Printer className="w-3 h-3" /> Ticket
                                                </button>
                                                {v.estado_comprobante === 'sunat_pendiente' && (
                                                    <>
                                                        <button
                                                            onClick={() => window.open('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', '_blank')}
                                                            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                                                        >
                                                            <ExternalLink className="w-3 h-3" /> SUNAT
                                                        </button>
                                                        <button
                                                            onClick={() => marcarSunatEmitido.mutate(v.id)}
                                                            className="text-xs text-green-600 hover:underline"
                                                        >
                                                            ✓ Marcar emitido
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filtradas.length === 0 && !isLoading && (
                                <tr>
                                    <td colSpan={7} className="text-center py-16 text-muted-foreground">
                                        <Receipt className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                        <p>Sin ventas registradas</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal ticket detalle */}
            {ventaDetalle && (
                <Dialog open onOpenChange={() => setVentaDetalle(null)}>
                    <DialogContent className="max-w-sm">
                        <DialogHeader>
                            <DialogTitle className="font-display">Ticket #{ventaDetalle.numero_ticket}</DialogTitle>
                        </DialogHeader>
                        <TicketPDF venta={ventaDetalle} config={config} />
                        {ventaDetalle.estado_comprobante === 'sunat_pendiente' && (
                            <Button
                                onClick={() => window.open('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', '_blank')}
                                className="w-full gap-2 bg-blue-600 hover:bg-blue-700"
                            >
                                <ExternalLink className="w-4 h-4" /> Ir a Portal SUNAT
                            </Button>
                        )}
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}