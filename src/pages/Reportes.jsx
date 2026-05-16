import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    PieChart, Pie, Cell, Legend
} from 'recharts';
import { 
    Download, TrendingUp, 
    ShoppingCart, Hotel, Wallet, ArrowUpRight,
    Table as TableIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useHotelData } from '@/hooks/use-hotel-data';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear, isWithinInterval, parseISO } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function Reportes() {
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

    const todasLasVentas = useMemo(() => {
        const h = ventasHotel.map(v => ({ ...v, _tipo: 'hotel', fecha: v.fecha_pago || v.created_date }));
        const p = ventasPOS.map(v => ({ ...v, _tipo: 'pos', fecha: v.fecha_venta || v.created_date }));
        return [...h, ...p];
    }, [ventasHotel, ventasPOS]);

    // Filtrado por periodo
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

        return todasLasVentas.filter(v => {
            if (!v.fecha) return false;
            
            // Filtro por Tipo (Hotel / Minimarket)
            if (tipoReporte !== 'ambos' && v._tipo !== tipoReporte) return false;

            const dateObj = new Date(v.fecha);
            const f = parseISO(v.fecha.split('T')[0]);
            const hour = dateObj.getHours();

            // Filtro por Turno
            // Mañana: 07:00 - 14:59 | Tarde: 15:00 - 22:59 | Noche: 23:00 - 06:59
            if (turno !== 'completo') {
                if (turno === 'mañana' && (hour < 7 || hour >= 15)) return false;
                if (turno === 'tarde' && (hour < 15 || hour >= 23)) return false;
                if (turno === 'noche' && (hour >= 7 && hour < 23)) return false;
            }

            return isWithinInterval(f, { start, end });
        }).sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
    }, [todasLasVentas, periodo, fechaInicio, fechaFin, tipoReporte, turno]);

    // Estadísticas
    const stats = useMemo(() => {
        const total = filtradas.reduce((s, v) => s + Number(v.total || 0), 0);
        const hotel = filtradas.filter(v => v._tipo === 'hotel').reduce((s, v) => s + Number(v.total || 0), 0);
        const pos = filtradas.filter(v => v._tipo === 'pos').reduce((s, v) => s + Number(v.total || 0), 0);
        
        const metodos = filtradas.reduce((acc, v) => {
            const m = v.metodo_pago || 'otro';
            acc[m] = (acc[m] || 0) + Number(v.total || 0);
            return acc;
        }, {});

        const metodosData = Object.entries(metodos).map(([name, value]) => ({ name, value }));

        // Agrupación por fecha para gráfico
        const porFecha = filtradas.reduce((acc, v) => {
            const f = v.fecha.split('T')[0];
            if (!acc[f]) acc[f] = { fecha: f, hotel: 0, pos: 0, total: 0 };
            acc[f][v._tipo] += Number(v.total || 0);
            acc[f].total += Number(v.total || 0);
            return acc;
        }, {});

        const lineData = Object.values(porFecha).sort((a, b) => a.fecha.localeCompare(b.fecha));

        return { total, hotel, pos, metodosData, lineData };
    }, [filtradas]);

    const exportarPDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(20);
        doc.text('Reporte de Ventas - Hospedaje Angelica Frey', 14, 22);
        doc.setFontSize(11);
        doc.text(`Periodo: ${fechaInicio} al ${fechaFin}`, 14, 30);
        doc.text(`Tipo: ${tipoReporte.toUpperCase()} | Turno: ${turno.toUpperCase()}`, 14, 36);
        doc.text(`Generado: ${new Date().toLocaleString()}`, 14, 42);

        const tableData = filtradas.map(v => [
            v.fecha.split('T')[0],
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

    const exportarExcel = () => {
        const data = filtradas.map(v => ({
            Fecha: v.fecha.split('T')[0],
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
        <div className="space-y-8 pb-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="text-center sm:text-left">
                    <h1 className="font-display text-2xl sm:text-4xl font-black text-foreground">Reportes <span className="text-primary italic">Financieros</span></h1>
                    <p className="text-muted-foreground mt-1 text-sm sm:text-lg font-medium">Análisis detallado de ingresos y operaciones</p>
                </div>
                <div className="flex justify-center sm:justify-end gap-2">
                    <Button onClick={exportarExcel} variant="outline" className="flex-1 sm:flex-none h-11 sm:h-12 gap-2 rounded-xl border-border/50 bg-card/40 backdrop-blur-md text-xs sm:text-sm">
                        <TableIcon className="w-4 h-4 text-green-600" /> Excel
                    </Button>
                    <Button onClick={exportarPDF} className="flex-1 sm:flex-none h-11 sm:h-12 gap-2 rounded-xl shadow-lg shadow-primary/20 text-xs sm:text-sm">
                        <Download className="w-4 h-4" /> PDF
                    </Button>
                </div>
            </div>

            {/* Controles de Filtro */}
            <div className="bg-card/40 backdrop-blur-2xl p-4 sm:p-6 rounded-2xl sm:rounded-[2.5rem] border border-border/50 shadow-2xl space-y-4 sm:space-y-6">
                <div className="grid grid-cols-2 lg:flex lg:flex-row items-end gap-3 sm:gap-4">
                    <div className="col-span-1 lg:w-48 space-y-1.5">
                        <label className="text-[9px] sm:text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Periodo</label>
                        <Select value={periodo} onValueChange={setPeriodo}>
                            <SelectTrigger className="h-11 sm:h-12 rounded-xl sm:rounded-2xl bg-background/50 text-xs sm:text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent className="rounded-xl sm:rounded-2xl">
                                <SelectItem value="dia">Hoy</SelectItem>
                                <SelectItem value="mes">Este Mes</SelectItem>
                                <SelectItem value="año">Este Año</SelectItem>
                                <SelectItem value="personalizado">Personalizado</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="col-span-1 lg:w-48 space-y-1.5">
                        <label className="text-[9px] sm:text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Origen</label>
                        <Select value={tipoReporte} onValueChange={setTipoReporte}>
                            <SelectTrigger className="h-11 sm:h-12 rounded-xl sm:rounded-2xl bg-background/50 text-xs sm:text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent className="rounded-xl sm:rounded-2xl">
                                <SelectItem value="ambos">Ambos</SelectItem>
                                <SelectItem value="hotel">Hotel</SelectItem>
                                <SelectItem value="pos">Minimarket</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="col-span-2 lg:w-48 space-y-1.5">
                        <label className="text-[9px] sm:text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Turno</label>
                        <Select value={turno} onValueChange={setTurno}>
                            <SelectTrigger className="h-11 sm:h-12 rounded-xl sm:rounded-2xl bg-background/50 text-xs sm:text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent className="rounded-xl sm:rounded-2xl">
                                <SelectItem value="completo">Día Completo</SelectItem>
                                <SelectItem value="mañana">Mañana (07-15)</SelectItem>
                                <SelectItem value="tarde">Tarde (15-23)</SelectItem>
                                <SelectItem value="noche">Noche (23-07)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {periodo === 'personalizado' && (
                        <div className="col-span-2 flex gap-3">
                            <div className="flex-1 space-y-1.5">
                                <label className="text-[9px] sm:text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Desde</label>
                                <Input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className="h-11 sm:h-12 rounded-xl sm:rounded-2xl bg-background/50 text-xs sm:text-sm" />
                            </div>
                            <div className="flex-1 space-y-1.5">
                                <label className="text-[9px] sm:text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Hasta</label>
                                <Input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} className="h-11 sm:h-12 rounded-xl sm:rounded-2xl bg-background/50 text-xs sm:text-sm" />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Resumen Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
                {[
                    { label: 'Ingresos Totales', val: stats.total, icon: Wallet, color: 'text-primary', bg: 'bg-primary/10 border-primary/20' },
                    { label: 'Ventas Hotel', val: stats.hotel, icon: Hotel, color: 'text-blue-500', bg: 'bg-blue-500/10 border-blue-500/20' },
                    { label: 'Ventas Minimarket', val: stats.pos, icon: ShoppingCart, color: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500/20' },
                ].map((stat, i) => (
                    <motion.div 
                        key={stat.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className={cn(
                            "p-5 sm:p-8 rounded-2xl sm:rounded-[2rem] border backdrop-blur-xl shadow-lg",
                            stat.bg,
                            i === 0 ? "sm:col-span-2 md:col-span-1" : ""
                        )}
                    >
                        <div className="flex items-center justify-between mb-3 sm:mb-4">
                            <div className={cn("p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-background/50 border border-current/20 shadow-inner", stat.color)}>
                                <stat.icon className="w-5 h-5 sm:w-6 sm:h-6" />
                            </div>
                            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Consolidado</span>
                        </div>
                        <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-[0.2em] mb-1">{stat.label}</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-xl sm:text-3xl font-black text-foreground">S/ {stat.val.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                            <ArrowUpRight className="w-3 h-3 sm:w-4 sm:h-4 text-green-500" />
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Gráficos */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-card/40 backdrop-blur-2xl p-5 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border border-border/50 shadow-2xl h-[350px] sm:h-[450px]">
                    <div className="flex items-center justify-between mb-6 sm:mb-8">
                        <h3 className="font-bold text-lg sm:text-xl flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-primary" /> Curva de Ingresos
                        </h3>
                    </div>
                    <div className="w-full h-full pb-10">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.lineData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="fecha" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: 'currentColor', opacity: 0.5 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: 'currentColor', opacity: 0.5 }} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '1rem', border: '1px solid hsl(var(--border))', fontSize: '12px' }}
                                    cursor={{ fill: 'rgba(var(--primary), 0.05)' }}
                                />
                                <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: '10px' }} />
                                <Bar dataKey="hotel" name="Hotel" fill="#2D63ED" radius={[4, 4, 0, 0]} barSize={12} />
                                <Bar dataKey="pos" name="POS" fill="#D97706" radius={[4, 4, 0, 0]} barSize={12} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-card/40 backdrop-blur-2xl p-5 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border border-border/50 shadow-2xl h-[350px] sm:h-[450px]">
                    <h3 className="font-bold text-lg sm:text-xl mb-6 sm:mb-8 flex items-center gap-2">
                        <Wallet className="w-5 h-5 text-primary" /> Métodos de Pago
                    </h3>
                    <div className="w-full h-full pb-10">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stats.metodosData}
                                    cx="50%"
                                    cy="45%"
                                    innerRadius={40}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {stats.metodosData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ fontSize: '12px' }} />
                                <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '10px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Tabla / Tarjetas de Detalle */}
            <div className="bg-card/40 backdrop-blur-2xl rounded-2xl sm:rounded-[2.5rem] border border-border/50 overflow-hidden shadow-2xl">
                <div className="p-4 sm:p-6 border-b border-border/50 flex items-center justify-between bg-secondary/5">
                    <h3 className="font-bold text-base sm:text-lg">Detalle de Transacciones</h3>
                    <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest">
                        {filtradas.length} Registros
                    </span>
                </div>

                {/* Vista Desktop (Tabla) */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left bg-secondary/10">
                                <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-muted-foreground">Fecha</th>
                                <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-muted-foreground">Ticket</th>
                                <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-muted-foreground">Cliente</th>
                                <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-muted-foreground">Origen</th>
                                <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-muted-foreground">Pago</th>
                                <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-muted-foreground text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20">
                            {filtradas.map((v, i) => (
                                <tr key={i} className="hover:bg-primary/5 transition-colors">
                                    <td className="px-6 py-4 font-medium text-muted-foreground">{v.fecha.split('T')[0]}</td>
                                    <td className="px-6 py-4 font-bold text-foreground">#{v.numero_ticket}</td>
                                    <td className="px-6 py-4 font-bold">{v.huesped_nombre || 'Cliente Mostrador'}</td>
                                    <td className="px-6 py-4">
                                        <span className={cn(
                                            "text-[9px] px-2 py-0.5 rounded-full font-black uppercase",
                                            v._tipo === 'hotel' ? "bg-blue-500/10 text-blue-500" : "bg-amber-500/10 text-amber-500"
                                        )}>
                                            {v._tipo}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 capitalize font-medium">{v.metodo_pago}</td>
                                    <td className="px-6 py-4 text-right font-black text-foreground">S/ {Number(v.total).toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Vista Móvil (Cards) */}
                <div className="md:hidden divide-y divide-border/20">
                    {filtradas.map((v, i) => (
                        <div key={i} className="p-4 space-y-3 active:bg-secondary/20 transition-colors">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1">
                                        {v.fecha.split('T')[0]} • #{v.numero_ticket}
                                    </p>
                                    <h4 className="font-bold text-foreground">{v.huesped_nombre || 'Cliente Mostrador'}</h4>
                                </div>
                                <span className={cn(
                                    "text-[8px] px-2 py-0.5 rounded-full font-black uppercase",
                                    v._tipo === 'hotel' ? "bg-blue-500/10 text-blue-500" : "bg-amber-500/10 text-amber-500"
                                )}>
                                    {v._tipo}
                                </span>
                            </div>
                            <div className="flex justify-between items-center pt-1">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-primary/40" />
                                    <p className="text-xs font-medium text-muted-foreground capitalize">{v.metodo_pago}</p>
                                </div>
                                <p className="font-black text-foreground">S/ {Number(v.total).toFixed(2)}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
