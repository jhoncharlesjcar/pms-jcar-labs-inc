import { memo } from 'react';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    PieChart, Pie, Cell, Legend
} from 'recharts';
import { 
    Download, TrendingUp, 
    ShoppingCart, Hotel, Wallet, FileText,
    Table as TableIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { downloadCsv } from '@/lib/csv';
import { cn } from '@/lib/utils';
import { useGsapStaggerList } from '@/hooks/useGsapStaggerList';
import { useReportesData } from './Reportes/hooks/useReportesData';
import PageSkeleton from '@/components/loaders/PageSkeleton';

import { TopGuestsWidget } from './Reportes/components/TopGuestsWidget';

const COLORS = ['#165B3E', '#D4A348', '#2563EB', '#7C3AED', '#DC2626', '#0D9488'];
const CHART_THEME_COLORS = COLORS;

const Reportes = memo(function Reportes() {
    const {
        periodo, setPeriodo,
        tipoReporte, setTipoReporte,
        turno, setTurno,
        fechaInicio, setFechaInicio,
        fechaFin, setFechaFin,
        filtradas,
        stats,
        isLoading
    } = useReportesData();

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
        downloadCsv(`Reporte_Ventas_${fechaInicio}_${fechaFin}.csv`,
            ['Fecha', 'Ticket', 'Cliente', 'Tipo', 'Método Pago', 'Total'],
            filtradas.map(v => [v.fecha_pago.split('T')[0], v.numero_ticket, v.huesped_nombre || 'Cliente Mostrador', v._tipo, v.metodo_pago, Number(v.total)])
        );
    };

    return (
        <div ref={mainRef} className="page-shell page-enter mx-auto max-w-7xl pt-1 sm:pt-2">

            <div className="enterprise-card section-card ui-card-pad page-header shadow-sm sm:items-center">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 shadow-xs">
                            <FileText className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">Reportes</h1>
                            <p className="text-muted-foreground text-xs sm:text-xs font-bold uppercase tracking-widest mt-0.5">Análisis detallado de ingresos y operaciones</p>
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
                    <Button onClick={exportarExcel} variant="outline" className="w-full sm:w-auto gap-1.5 border-border/40 px-3 sm:px-4 text-xs font-extrabold uppercase tracking-widest hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400">
                        <TableIcon className="w-3.5 h-3.5 text-emerald-500" /> CSV
                    </Button>
                    <Button onClick={exportarPDF} className="w-full sm:w-auto gap-1.5 px-3 sm:px-4 text-xs font-extrabold uppercase tracking-widest">
                        <Download className="w-3.5 h-3.5" /> PDF
                    </Button>
                </div>
            </div>

            <div className="enterprise-card section-card ui-card-pad space-y-3 shadow-sm">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="space-y-1.5">
                        <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Periodo</label>
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
                        <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Origen</label>
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
                        <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Turno</label>
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
                                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Desde</label>
                                <Input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className="h-9 rounded-md bg-background/50 text-xs font-bold border-border/40 shadow-inner" />
                            </div>
                            <div className="flex-1 space-y-1.5">
                                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Hasta</label>
                                <Input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} className="h-9 rounded-md bg-background/50 text-xs font-bold border-border/40 shadow-inner" />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {isLoading ? <PageSkeleton variant="dashboard" /> : (
                <>
            <div className="ui-card-grid grid grid-cols-1 sm:grid-cols-3">
                {[
                    { label: 'Ingresos Totales', val: stats.total, icon: Wallet, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                    { label: 'Ventas Hotel', val: stats.hotel, icon: Hotel, color: 'text-blue-500', bg: 'bg-blue-500/10' },
                    { label: 'Ventas POS', val: stats.pos, icon: ShoppingCart, color: 'text-amber-500', bg: 'bg-amber-500/10' }
                ].map((stat, i) => (
                    <div key={i} className="enterprise-card metric-card ui-card-pad relative overflow-hidden group transition-all hover:shadow-md">
                        <div className="flex items-center gap-2 mb-2">
                            <div className={cn("w-6 h-6 rounded-md flex items-center justify-center font-bold flex-shrink-0 shadow-sm border border-border/50", stat.bg)}>
                                <stat.icon className={cn("w-3 h-3", stat.color)} />
                            </div>
                            <p className="text-xs sm:text-xs text-muted-foreground font-bold uppercase tracking-wider">{stat.label}</p>
                        </div>
                        <p className="text-2xl sm:text-3xl font-extrabold tabular-nums text-foreground tracking-tighter leading-none mt-2">S/ {stat.val.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</p>
                        <TrendingUp className="absolute bottom-4 right-4 w-12 h-12 text-primary/5 opacity-50 group-hover:scale-110 transition-transform" />
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 enterprise-card section-card ui-card-pad flex flex-col shadow-sm">
                    <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 mb-4">
                        <TrendingUp className="w-3.5 h-3.5 text-primary" /> Evolución de Ingresos
                    </h2>
                    <div className="w-full h-[280px] sm:h-[320px] mt-2" style={{ userSelect: 'none' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.lineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.4} />
                                <XAxis 
                                    dataKey="fecha" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} 
                                    interval="preserveStartEnd"
                                    tickFormatter={(val) => {
                                        if (!val) return '';
                                        const parts = val.split('-');
                                        return parts.length === 3 ? `${parts[2]}/${parts[1]}` : val;
                                    }}
                                    dy={8} 
                                />
                                <YAxis 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tickFormatter={v => `S/${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} 
                                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} 
                                />
                                <Tooltip 
                                    cursor={{ fill: 'hsl(var(--primary)/0.06)' }}
                                    isAnimationActive={false}
                                    contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card))', boxShadow: '0 8px 24px -4px rgba(0,0,0,0.12)', fontSize: '11px', fontWeight: 'bold' }}
                                />
                                <Legend wrapperStyle={{ paddingTop: '16px', fontSize: '11px', fontWeight: 'bold' }} />
                                {tipoReporte !== 'pos' && <Bar dataKey="hotel" name="Hotel" fill="#165B3E" radius={[4, 4, 0, 0]} maxBarSize={36} />}
                                {tipoReporte !== 'hotel' && <Bar dataKey="pos" name="POS" fill="#D4A348" radius={[4, 4, 0, 0]} maxBarSize={36} />}
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                
                <div className="enterprise-card section-card ui-card-pad flex flex-col shadow-sm">
                    <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 mb-4">
                        <Wallet className="w-3.5 h-3.5 text-secondary" /> Métodos de Pago
                    </h2>
                    <div className="w-full h-[280px] sm:h-[320px] flex items-center justify-center">
                        {stats.metodosData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={stats.metodosData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                                        {stats.metodosData.map((e, i) => <Cell key={i} fill={CHART_THEME_COLORS[i % CHART_THEME_COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip 
                                        formatter={(v) => `S/ ${Number(v).toFixed(2)}`}
                                        isAnimationActive={false}
                                        contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card))', boxShadow: '0 8px 24px -4px rgba(0,0,0,0.12)', fontSize: '11px', fontWeight: 'bold' }}
                                    />
                                    <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '10px', fontWeight: 'bold' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <p className="text-xs font-bold text-muted-foreground text-center w-full">Sin datos</p>
                        )}
                    </div>
                </div>

                <div className="lg:col-span-1">
                    <TopGuestsWidget huespedes={stats.topGuests} isLoading={isLoading} />
                </div>

                <div className="lg:col-span-2 enterprise-card section-card ui-card-pad flex flex-col shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                            <TableIcon className="w-3.5 h-3.5 text-primary" /> Auditoría Reciente ({filtradas.length} operaciones)
                        </h2>
                    </div>
                    {filtradas.length === 0 ? (
                        <div className="flex flex-1 items-center justify-center py-8 text-xs font-semibold text-muted-foreground">
                            No hay transacciones registradas en este período.
                        </div>
                    ) : (
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-border/60 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                        <th className="pb-2">Fecha</th>
                                        <th className="pb-2">Cliente / Ref</th>
                                        <th className="pb-2">Origen</th>
                                        <th className="pb-2">Método</th>
                                        <th className="pb-2 text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/30">
                                    {filtradas.slice(0, 6).map((v, i) => (
                                        <tr key={i} className="hover:bg-muted/30 transition-colors">
                                            <td className="py-2.5 font-medium tabular-nums text-muted-foreground">{v.fecha_pago?.split('T')[0] || '--'}</td>
                                            <td className="py-2.5 font-bold text-foreground truncate max-w-[160px]">{v.huesped_nombre || 'Cliente Mostrador'}</td>
                                            <td className="py-2.5">
                                                <span className="rounded px-1.5 py-0.5 text-xs font-extrabold uppercase bg-muted text-muted-foreground">
                                                    {v._tipo}
                                                </span>
                                            </td>
                                            <td className="py-2.5 uppercase font-medium text-muted-foreground">{v.metodo_pago}</td>
                                            <td className="py-2.5 font-extrabold text-right tabular-nums text-foreground">S/ {Number(v.total).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
            </>
            )}
        </div>
    );
});
Reportes.displayName = 'Reportes';
export default Reportes;
