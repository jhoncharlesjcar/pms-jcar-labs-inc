import { useState, useMemo, memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    PieChart, Pie, Cell, Legend
} from 'recharts';
import { 
    Download, TrendingUp, 
    ShoppingCart, Hotel, Wallet, ArrowUpRight, FileText,
    Table as TableIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useHotelData } from '@/hooks/use-hotel-data';
import { cn } from '@/lib/utils';
import { useGsapStaggerList } from '@/hooks/useGsapStaggerList';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear, isWithinInterval, parseISO } from 'date-fns';
// jsPDF y XLSX se importan dinámicamente para evitar cargarlos en todas las páginas

// ─── Funciones puras desde el servicio de Ventas ──────────────────────────
import { consolidarVentas } from '@/services/ventas.service';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const Reportes = memo(function Reportes() {
    const { db: hotelDb, hotelId } = useHotelData();
    const [periodo, setPeriodo] = useState('mes'); // dia, mes, año, personalizado
    const [tipoReporte, setTipoReporte] = useState('ambos'); // ambos, hotel, pos
    const [turno, setTurno] = useState('completo'); // completo, mañana, tarde, noche
    const [fechaInicio, setFechaInicio] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    const [fechaFin, setFechaFin] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

    // Consultas de datos
    const { data: ventasHotel = [], isLoading: loadHotel } = useQuery({
        queryKey: ['ventas', hotelId],
        queryFn: () => hotelDb.Venta.list(),
        enabled: !!hotelId,
    });

    const { data: ventasPOS = [], isLoading: loadPOS } = useQuery({
        queryKey: ['ventaspos', hotelId],
        queryFn: () => hotelDb.VentaPOS.list(),
        enabled: !!hotelId,
    });

    // VEN-001: Consolidación de ventas Hotel + POS (función pura del servicio)
    const todasLasVentas = useMemo(
        () => consolidarVentas(ventasHotel, ventasPOS),
        [ventasHotel, ventasPOS],
    );

    // Filtrado por periodo, tipo y turno
    const filtradas = useMemo(() => {
        let start = parseISO(fechaInicio);
        let end = parseISO(fechaFin);

        if (periodo === 'dia') {
            start = startOfDay(new Date());
            end = endOfDay(new Date());
        } else if (periodo === 'mes') {
            start = startOfMonth(new Date());
            end = endOfMonth(new Date());
        } else if (periodo === 'año') {
            start = startOfYear(new Date());
            end = endOfYear(new Date());
        }

        return todasLasVentas
            .filter(v => {
                if (!v.fecha_pago) return false;
                const f = parseISO(v.fecha_pago);
                return isWithinInterval(f, { start, end });
            })
            .filter(v => {
                if (tipoReporte === 'ambos') return true;
                return v._tipo === tipoReporte;
            })
            .filter(v => {
                if (turno === 'completo') return true;
                if (!v.fecha_pago) return false;
                const hora = new Date(v.fecha_pago).getHours();
                if (turno === 'mañana') return hora >= 7 && hora < 15;
                if (turno === 'tarde') return hora >= 15 && hora < 23;
                if (turno === 'noche') return hora >= 23 || hora < 7;
                return true;
            });
    }, [todasLasVentas, periodo, tipoReporte, turno, fechaInicio, fechaFin]);

    // Estadísticas
    const stats = useMemo(() => {
        const total = filtradas.reduce((sum, v) => sum + Number(v.total || 0), 0);
        const hotel = filtradas.filter(v => v._tipo === 'hotel').reduce((sum, v) => sum + Number(v.total || 0), 0);
        const pos = filtradas.filter(v => v._tipo === 'pos').reduce((sum, v) => sum + Number(v.total || 0), 0);
        
        const metodos = filtradas.reduce((acc, v) => {
            const m = v.metodo_pago || 'efectivo';
            acc[m] = (acc[m] || 0) + Number(v.total || 0);
            return acc;
        }, {});

        const metodosData = Object.entries(metodos).map(([name, value]) => ({ name: name.toUpperCase(), value }));

        // Agrupación por fecha para gráfico
        const porFecha = filtradas.reduce((acc, v) => {
            const fechaKey = v.fecha_pago ? v.fecha_pago.split('T')[0] : 'Sin fecha';
            if (!acc[fechaKey]) acc[fechaKey] = { fecha: fechaKey, hotel: 0, pos: 0, total: 0 };
            const monto = Number(v.total || 0);
            if (v._tipo === 'hotel') acc[fechaKey].hotel += monto;
            else acc[fechaKey].pos += monto;
            acc[fechaKey].total += monto;
            return acc;
        }, {});

        const lineData = Object.values(porFecha).sort((a, b) => a.fecha.localeCompare(b.fecha));

        return { total, hotel, pos, metodosData, lineData };
    }, [filtradas]);

    // Stagger animación
    const mainRef = useGsapStaggerList([filtradas.length, periodo, tipoReporte, turno], {
        stagger: 0.06,
        distance: 12,
    });

    const exportarPDF = async () => {
        const { default: jsPDF } = await import('jspdf');
        const { default: autoTable } = await import('jspdf-autotable');
        const doc = new jsPDF();
        
        doc.setFontSize(18);
        doc.text('Reporte de Ventas', 14, 20);
        doc.setFontSize(11);
        doc.text(`Periodo: ${fechaInicio} al ${fechaFin}`, 14, 30);
        doc.text(`Tipo: ${tipoReporte.toUpperCase()} | Turno: ${turno.toUpperCase()}`, 14, 36);
        doc.text(`Generado: ${new Date().toLocaleString()}`, 14, 42);

        const tableData = filtradas.map(v => [
            v.fecha_pago.split('T')[0],
            v.numero_ticket || '-',
            v.huesped_nombre || 'Cliente Mostrador',
            v._tipo.toUpperCase(),
            v.metodo_pago.toUpperCase(),
            `S/ ${Number(v.total).toFixed(2)}`
        ]);

        autoTable(doc, {
            startY: 48,
            head: [['Fecha', 'Ticket', 'Cliente', 'Tipo', 'Pago', 'Total']],
            body: tableData,
            foot: [['', '', '', '', 'TOTAL', `S/ ${stats.total.toFixed(2)}`]],
            theme: 'striped',
            headStyles: { fillColor: [0, 112, 65] }
        });

        doc.save(`Reporte_Ventas_${fechaInicio}_${fechaFin}.pdf`);
    };

    const exportarExcel = async () => {
        const XLSX = await import('xlsx');
        const data = filtradas.map(v => ({
            Fecha: v.fecha_pago.split('T')[0],
            Ticket: v.numero_ticket,
            Cliente: v.huesped_nombre || 'Cliente Mostrador',
            Tipo: v._tipo,
            'Método Pago': v.metodo_pago,
            Total: Number(v.total)
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Reporte Ventas");
        XLSX.writeFile(wb, `Reporte_Ventas_${fechaInicio}_${fechaFin}.xlsx`);
    };

    return (
        <div ref={mainRef} className="pt-1 sm:pt-2 pb-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-4 page-enter">

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card/40 backdrop-blur-xl border border-border/40 p-4 rounded-xl shadow-sm">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 shadow-xs">
                            <FileText className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">Reportes</h1>
                            <p className="text-muted-foreground text-[10px] sm:text-xs font-bold uppercase tracking-widest mt-0.5">Análisis detallado de ingresos y operaciones</p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={exportarExcel} variant="outline" className="h-9 rounded-md gap-1.5 px-4 border-border/40 bg-card/40 text-[10px] font-extrabold uppercase tracking-widest hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500/30 active:scale-95 transition-all shadow-xs">
                        <TableIcon className="w-3.5 h-3.5 text-emerald-500" /> Excel
                    </Button>
                    <Button onClick={exportarPDF} className="h-9 rounded-md gap-1.5 px-4 shadow-md text-[10px] font-extrabold uppercase tracking-widest active:scale-95 transition-all">
                        <Download className="w-3.5 h-3.5" /> PDF
                    </Button>
                </div>
            </div>

            <div className="bg-card/40 backdrop-blur-xl p-4 sm:p-5 rounded-xl border border-border/40 shadow-sm space-y-3">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Periodo</label>
                        <Select value={periodo} onValueChange={setPeriodo}>
                            <SelectTrigger className="h-9 rounded-md bg-background/50 text-xs font-bold border-border/40 focus:ring-primary/30 shadow-inner"><SelectValue /></SelectTrigger>
                            <SelectContent className="rounded-md border-border/40 shadow-xl">
                                <SelectItem value="dia" className="text-xs font-bold">Hoy</SelectItem>
                                <SelectItem value="mes" className="text-xs font-bold">Este Mes</SelectItem>
                                <SelectItem value="año" className="text-xs font-bold">Este Año</SelectItem>
                                <SelectItem value="personalizado" className="text-xs font-bold">Personalizado</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Origen</label>
                        <Select value={tipoReporte} onValueChange={setTipoReporte}>
                            <SelectTrigger className="h-9 rounded-md bg-background/50 text-xs font-bold border-border/40 focus:ring-primary/30 shadow-inner"><SelectValue /></SelectTrigger>
                            <SelectContent className="rounded-md border-border/40 shadow-xl">
                                <SelectItem value="ambos" className="text-xs font-bold">Ambos</SelectItem>
                                <SelectItem value="hotel" className="text-xs font-bold">Hotel</SelectItem>
                                <SelectItem value="pos" className="text-xs font-bold">Minimarket</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Turno</label>
                        <Select value={turno} onValueChange={setTurno}>
                            <SelectTrigger className="h-9 rounded-md bg-background/50 text-xs font-bold border-border/40 focus:ring-primary/30 shadow-inner"><SelectValue /></SelectTrigger>
                            <SelectContent className="rounded-md border-border/40 shadow-xl">
                                <SelectItem value="completo" className="text-xs font-bold">Día Completo</SelectItem>
                                <SelectItem value="mañana" className="text-xs font-bold">Mañana (07-15)</SelectItem>
                                <SelectItem value="tarde" className="text-xs font-bold">Tarde (15-23)</SelectItem>
                                <SelectItem value="noche" className="text-xs font-bold">Noche (23-07)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {periodo === 'personalizado' && (
                        <div className="col-span-2 lg:col-span-1 flex gap-2">
                            <div className="flex-1 space-y-1.5">
                                <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Desde</label>
                                <Input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className="h-9 rounded-md bg-background/50 text-xs font-bold border-border/40 shadow-inner" />
                            </div>
                            <div className="flex-1 space-y-1.5">
                                <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Hasta</label>
                                <Input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} className="h-9 rounded-md bg-background/50 text-xs font-bold border-border/40 shadow-inner" />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-4">
                {[
                    { label: 'Ingresos Totales', val: stats.total, icon: Wallet, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                    { label: 'Ventas Hotel', val: stats.hotel, icon: Hotel, color: 'text-blue-500', bg: 'bg-blue-500/10' },
                    { label: 'Ventas Minimarket', val: stats.pos, icon: ShoppingCart, color: 'text-amber-500', bg: 'bg-amber-500/10' },
                ].map((stat) => (
                    <div 
                        key={stat.label}
                        className="bg-card/40 backdrop-blur-xl border border-border/40 p-4 rounded-xl shadow-sm relative overflow-hidden group hover:-translate-y-1 hover:shadow-md transition-all"
                    >
                        <div className="flex justify-between items-start mb-3">
                            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center font-bold flex-shrink-0 group-hover:scale-105 transition-transform shadow-xs", stat.bg)}>
                                <stat.icon className={cn("w-4 h-4", stat.color)} />
                            </div>
                            <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground bg-secondary/30 px-1.5 py-0.5 rounded shadow-xs border border-border/40">Consolidado</span>
                        </div>
                        <p className="text-2xl font-extrabold mb-0.5 tabular-nums tracking-tighter leading-none text-foreground">S/ {stat.val.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</p>
                        <div className="flex items-center gap-1 mt-1">
                            <p className="text-[9px] text-muted-foreground font-black uppercase tracking-widest">{stat.label}</p>
                            <ArrowUpRight className={cn("w-3.5 h-3.5", stat.color)} />
                        </div>
                        <div className={cn("absolute top-0 right-0 w-24 h-24 blur-3xl rounded-full -mr-12 -mt-12 opacity-50", stat.bg)} />
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-2">
                <div className="lg:col-span-2 bg-card/40 backdrop-blur-xl p-4 sm:p-5 rounded-xl border border-border/40 shadow-sm flex flex-col justify-between min-h-[300px] sm:min-h-[350px] overflow-hidden group hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-extrabold text-sm sm:text-base tracking-tight text-foreground flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-primary" /> Curva de Ingresos
                        </h3>
                    </div>
                    <div className="flex-1 w-full min-h-[220px] pb-1">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.lineData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="fecha" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold', fill: 'currentColor', opacity: 0.5 }} dy={6} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold', fill: 'currentColor', opacity: 0.5 }} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '0.75rem', border: '1px solid hsl(var(--border))', fontSize: '10px', fontWeight: 'bold' }}
                                    cursor={{ fill: 'rgba(var(--primary), 0.05)' }}
                                />
                                <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: '9px', fontWeight: 'bold' }} />
                                <Bar dataKey="hotel" name="Hotel" fill="#2D63ED" radius={[4, 4, 0, 0]} barSize={12} />
                                <Bar dataKey="pos" name="POS" fill="#D97706" radius={[4, 4, 0, 0]} barSize={12} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-card/40 backdrop-blur-xl p-4 sm:p-5 rounded-xl border border-border/40 shadow-sm flex flex-col justify-between min-h-[300px] sm:min-h-[350px] overflow-hidden group hover:shadow-md transition-all">
                    <h3 className="font-extrabold text-sm sm:text-base tracking-tight text-foreground mb-4 flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-primary" /> Métodos de Pago
                    </h3>
                    <div className="flex-1 w-full min-h-[220px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stats.metodosData}
                                    cx="50%"
                                    cy="45%"
                                    innerRadius={45}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {stats.metodosData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ fontSize: '10px', fontWeight: 'bold', borderRadius: '0.75rem', backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                                <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '9px', fontWeight: 'bold' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>


            {/* Tabla / Tarjetas de Detalle */}
            <div className="bg-card/40 rounded-xl border border-border/40 overflow-hidden shadow-sm mt-4">
                <div className="p-4 border-b border-border/40 flex items-center justify-between bg-primary/5">
                    <h3 className="font-extrabold text-sm sm:text-base tracking-tight text-foreground">Detalle de Transacciones</h3>
                    <span className="px-3 py-1 bg-primary/10 text-primary rounded-md text-[9px] font-black uppercase tracking-widest shadow-xs border border-primary/20">
                        {filtradas.length} Registros
                    </span>
                </div>

                {/* Vista Desktop (Tabla) */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="text-left bg-muted/30 border-b border-border/40">
                                <th className="px-4 py-3 font-black text-[9px] uppercase tracking-widest text-muted-foreground">Fecha</th>
                                <th className="px-4 py-3 font-black text-[9px] uppercase tracking-widest text-muted-foreground">Ticket</th>
                                <th className="px-4 py-3 font-black text-[9px] uppercase tracking-widest text-muted-foreground">Cliente</th>
                                <th className="px-4 py-3 font-black text-[9px] uppercase tracking-widest text-muted-foreground">Origen</th>
                                <th className="px-4 py-3 font-black text-[9px] uppercase tracking-widest text-muted-foreground">Pago</th>
                                <th className="px-4 py-3 font-black text-[9px] uppercase tracking-widest text-muted-foreground text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20">
                            {filtradas.map((v, i) => (
                                <tr key={`${v._tipo}-${v.id || i}`} className="hover:bg-primary/5 transition-colors group">
                                    <td className="px-4 py-2.5 font-bold text-muted-foreground">{v.fecha_pago.split('T')[0]}</td>
                                    <td className="px-4 py-2.5 font-extrabold text-foreground tracking-tight">#{v.numero_ticket}</td>
                                    <td className="px-4 py-2.5 font-bold tracking-tight">{v.huesped_nombre || 'Cliente Mostrador'}</td>
                                    <td className="px-4 py-2.5">
                                        <span className={cn(
                                            "text-[8px] px-2 py-0.5 rounded font-black uppercase tracking-widest shadow-xs border",
                                            v._tipo === 'hotel' ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                        )}>
                                            {v._tipo}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2.5 capitalize font-bold text-muted-foreground">{v.metodo_pago}</td>
                                    <td className="px-4 py-2.5 text-right font-black text-foreground tabular-nums tracking-tighter">S/ {Number(v.total).toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Vista Móvil (Cards) */}
                <div className="md:hidden divide-y divide-border/20">
                    {filtradas.map((v, i) => (
                        <div key={`mob-${v._tipo}-${v.id || i}`} className="p-4 space-y-3 active:bg-secondary/20 transition-colors">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1.5">
                                        {v.fecha_pago.split('T')[0]} • #{v.numero_ticket}
                                    </p>
                                    <h4 className="text-xs sm:text-sm font-extrabold text-foreground tracking-tight">{v.huesped_nombre || 'Cliente Mostrador'}</h4>
                                </div>
                                <span className={cn(
                                    "text-[8px] px-2 py-0.5 rounded font-black uppercase tracking-widest border shadow-xs",
                                    v._tipo === 'hotel' ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                )}>
                                    {v._tipo}
                                </span>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-border/20">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                                    <p className="text-[10px] font-bold text-muted-foreground capitalize">{v.metodo_pago}</p>
                                </div>
                                <p className="font-black text-sm text-foreground tabular-nums tracking-tighter">S/ {Number(v.total).toFixed(2)}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
});
Reportes.displayName = 'Reportes';
export default Reportes;
