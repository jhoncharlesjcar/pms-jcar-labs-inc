import { useQuery } from '@tanstack/react-query';
import { useHotelData } from '@/hooks/use-hotel-data';
import { BedDouble, Users, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
    const { db: hotelDb, hotelId } = useHotelData();

    const { data: habitaciones = [] } = useQuery({
        queryKey: ['habitaciones', hotelId],
        queryFn: () => hotelDb.Habitacion.list(),
        enabled: !!hotelId,
    });

    const { data: reservas = [] } = useQuery({
        queryKey: ['reservas', hotelId],
        queryFn: () => hotelDb.Reserva.list(),
        enabled: !!hotelId,
    });

    const { data: ventas = [] } = useQuery({
        queryKey: ['ventas', hotelId],
        queryFn: () => hotelDb.Venta.list(),
        enabled: !!hotelId,
    });

    const disponibles = habitaciones.filter(h => h.estado === 'disponible').length;
    const ocupadas = habitaciones.filter(h => h.estado === 'ocupada').length;
    const reservasActivas = reservas.filter(r => r.estado === 'activa').length;

    const hoy = new Date().toLocaleDateString('sv-SE'); // Formato YYYY-MM-DD local
    const ventasHoy = ventas.filter(v => v.fecha_pago === hoy);
    const ingresoHoy = ventasHoy.reduce((s, v) => s + (v.total || 0), 0);

    const ingresoMes = ventas.reduce((s, v) => s + (v.total || 0), 0);

    const stats = [
        { label: 'Habitaciones Disponibles', value: disponibles, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', link: '/habitaciones' },
        { label: 'Habitaciones Ocupadas', value: ocupadas, icon: BedDouble, color: 'text-primary', bg: 'bg-primary/10', link: '/habitaciones' },
        { label: 'Reservas Activas', value: reservasActivas, icon: Users, color: 'text-orange-600', bg: 'bg-orange-50', link: '/recepcion' },
        { label: 'Ingresos del Mes', value: `S/ ${ingresoMes.toFixed(2)}`, icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50', link: '/ventas' },
    ];

    const ocupacionPct = habitaciones.length > 0 ? Math.round((ocupadas / habitaciones.length) * 100) : 0;

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="font-display text-3xl font-bold text-foreground">Dashboard</h1>
                <p className="text-muted-foreground mt-1">
                    {new Date().toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map(({ label, value, icon: Icon, color, bg, link }) => (
                    <Link key={label} to={link} className="bg-card/80 backdrop-blur-md rounded-2xl p-5 border border-border/50 hover:shadow-lg hover:border-primary/30 transition-all duration-300 group">
                        <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center mb-3`}>
                            <Icon className={`w-5 h-5 ${color}`} />
                        </div>
                        <p className="text-2xl font-bold text-foreground">{value}</p>
                        <p className="text-xs text-muted-foreground mt-1">{label}</p>
                    </Link>
                ))}
            </div>

            {/* Ocupación + Ingresos hoy */}
            <div className="grid lg:grid-cols-2 gap-6">
                {/* Ocupación */}
                <div className="bg-card/80 backdrop-blur-md rounded-2xl border border-border/50 p-6 shadow-sm">
                    <h2 className="font-semibold text-foreground mb-4">Ocupación hoy</h2>
                    <div className="flex items-end gap-4 mb-3">
                        <span className="text-4xl font-bold text-foreground">{ocupacionPct}%</span>
                        <span className="text-muted-foreground mb-1">{ocupadas} de {habitaciones.length} hab.</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-3">
                        <div
                            className="bg-primary h-3 rounded-full transition-all duration-700"
                            style={{ width: `${ocupacionPct}%` }}
                        />
                    </div>
                    <div className="flex gap-4 mt-4 text-sm">
                        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /><span className="text-muted-foreground">Disponibles: {disponibles}</span></div>
                        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-primary inline-block" /><span className="text-muted-foreground">Ocupadas: {ocupadas}</span></div>
                        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" /><span className="text-muted-foreground">Reservadas: {reservas.filter(r => r.estado === 'pendiente').length}</span></div>
                    </div>
                </div>

                {/* Ingresos hoy */}
                <div className="bg-card/80 backdrop-blur-md rounded-2xl border border-border/50 p-6 shadow-sm">
                    <h2 className="font-semibold text-foreground mb-4">Ingresos de hoy</h2>
                    <div className="text-4xl font-bold text-foreground mb-1">S/ {ingresoHoy.toFixed(2)}</div>
                    <p className="text-sm text-muted-foreground mb-4">{ventasHoy.length} transacciones registradas</p>
                    <div className="space-y-2">
                        {['efectivo', 'yape', 'plin', 'transferencia', 'tarjeta'].map(metodo => {
                            const monto = ventasHoy.filter(v => v.metodo_pago === metodo).reduce((s, v) => s + (v.total || 0), 0);
                            if (!monto) return null;
                            return (
                                <div key={metodo} className="flex justify-between items-center text-sm">
                                    <span className="capitalize text-muted-foreground">{metodo}</span>
                                    <span className="font-medium text-foreground">S/ {monto.toFixed(2)}</span>
                                </div>
                            );
                        })}
                        {ventasHoy.length === 0 && <p className="text-sm text-muted-foreground">Sin transacciones hoy</p>}
                    </div>
                </div>
            </div>

            {/* Alertas */}
            {habitaciones.filter(h => h.estado === 'mantenimiento').length > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0" />
                    <p className="text-sm text-orange-800">
                        <strong>{habitaciones.filter(h => h.estado === 'mantenimiento').length} habitación(es)</strong> en mantenimiento
                    </p>
                </div>
            )}

            {/* Últimas ventas */}
            <div className="bg-card/80 backdrop-blur-md rounded-2xl border border-border/50 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-border/50 flex items-center justify-between">
                    <h2 className="font-semibold text-foreground">Últimas ventas</h2>
                    <Link to="/ventas" className="text-sm text-primary hover:underline">Ver todas</Link>
                </div>
                <div className="divide-y divide-border">
                    {ventas.slice(0, 5).map(v => (
                        <div key={v.id} className="p-4 flex items-center justify-between">
                            <div>
                                <p className="font-medium text-foreground text-sm">{v.huesped_nombre}</p>
                                <p className="text-xs text-muted-foreground">Hab. {v.habitacion_numero} · {v.noches} noche(s) · {v.metodo_pago}</p>
                            </div>
                            <div className="text-right">
                                <p className="font-semibold text-foreground">S/ {v.total?.toFixed(2)}</p>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${v.estado_comprobante === 'sunat_emitido' ? 'bg-green-100 text-green-700' :
                                    v.estado_comprobante === 'sunat_pendiente' ? 'bg-orange-100 text-orange-700' :
                                        'bg-secondary text-secondary-foreground'
                                    }`}>
                                    {v.estado_comprobante === 'sunat_emitido' ? 'SUNAT ✓' :
                                        v.estado_comprobante === 'sunat_pendiente' ? 'SUNAT pend.' : 'Ticket'}
                                </span>
                            </div>
                        </div>
                    ))}
                    {ventas.length === 0 && (
                        <div className="p-8 text-center text-muted-foreground text-sm">
                            Sin ventas registradas aún
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}