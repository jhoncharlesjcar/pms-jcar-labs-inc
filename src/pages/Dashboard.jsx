import { useEffect, useMemo, useRef, useState } from 'react';
import { useHotelData } from '@/hooks/useHotelData';
import { useQuery } from '@tanstack/react-query';
import logger from '@/lib/logger';

import { Link, useNavigate } from 'react-router-dom';
import { format, subDays } from 'date-fns';
import {
    BedDouble, Wallet, Receipt, CalendarDays, TrendingUp, CheckCircle2, User,
    LogIn, ShoppingCart, FileText, AlertTriangle, ArrowUpRight, Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/config/supabase';
import { gsap } from 'gsap';
import { useGsapCardHover } from '@/hooks/useGsapCardHover';
import { useGsapStaggerList } from '@/hooks/useGsapStaggerList';
import { useAuth } from '@/contexts/AuthContext';
import BroomIcon from '@/components/ui/icons/BroomIcon';
import { DailyAuditSummary } from '@/components/dashboard/DailyAuditSummary';
import { calcularDesgloseMetodosPago, calcularDesgloseSunat } from '@/services/caja.service';

import { KpiCard } from './Dashboard/components/KpiCard';
import { WeeklyAnalysisChart } from './Dashboard/components/WeeklyAnalysisChart';
import { InventoryStatus } from './Dashboard/components/InventoryStatus';
import { RecentActivity } from './Dashboard/components/RecentActivity';

/** Helper: saludo según hora del día */
function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 18) return 'Buenas tardes';
    return 'Buenas noches';
}

/** Donut chart colors */
const DONUT_COLORS = {
    libres: 'hsl(158, 95%, 36%)',
    ocupadas: 'hsl(224, 71%, 50%)',
    limpieza: 'hsl(262, 83%, 55%)',
    mantenimiento: 'hsl(42, 78%, 50%)',
};

/** ─── Glow colors for bento cards ─── */
const BENTO_GLOWS = {
    chart: 'hsla(var(--primary), 0.12)',
    income: 'hsla(158, 95%, 36%, 0.14)',
    occupation: 'hsla(224, 71%, 50%, 0.12)',
    activity: 'hsla(var(--primary), 0.10)',
};

Dashboard.displayName = 'Dashboard';
export default function Dashboard() {
    const { db, hotelId } = useHotelData();
    const { user } = useAuth();
    const navigate = useNavigate();

    const [queueCount, setQueueCount] = useState(0);
    const [isOffline, setIsOffline] = useState(!navigator.onLine);

    useEffect(() => {
        const handleOffline = () => setIsOffline(true);
        const handleOnline = () => setIsOffline(false);
        const handleQueue = (e) => setQueueCount(e.detail);

        window.addEventListener('offline', handleOffline);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline_queue_updated', handleQueue);

        // Initial check
        if (user?.id && hotelId) {
            import('@/lib/sync-queue').then(m => m.getPendingCount(user.id, hotelId).then(setQueueCount));
        }

        return () => {
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline_queue_updated', handleQueue);
        };
    }, [user?.id, hotelId]);

    const { data: reservas = [] } = useQuery({
        queryKey: ["reservas", hotelId],
        queryFn: () => db.Reserva.list(null, null, "id, estado, fecha_entrada, total"),
        enabled: !!hotelId
    });

    const { data: ventasHotel = [] } = useQuery({
        queryKey: ["ventas", hotelId, "7d"],
        queryFn: async () => {
            const hace7Dias = new Date();
            hace7Dias.setDate(hace7Dias.getDate() - 7);
            const { data } = await supabase
                .from('ventas')
                .select('id, total, fecha_pago, created_date, metodo_pago, estado_comprobante, numero_ticket, huesped_nombre, habitacion_numero')
                .eq('hotel_id', hotelId)
                .gte('created_date', hace7Dias.toISOString())
                .order('created_date', { ascending: false });
            return data || [];
        },
        enabled: !!hotelId
    });

    const { data: ventasPos = [] } = useQuery({
        queryKey: ["ventaspos", hotelId, "7d"],
        queryFn: async () => {
            const hace7Dias = new Date();
            hace7Dias.setDate(hace7Dias.getDate() - 7);
            const { data } = await supabase
                .from('ventas_pos')
                .select('id, total, fecha_venta, created_date, metodo_pago, estado_comprobante, numero_ticket, huesped_nombre, habitacion_numero')
                .eq('hotel_id', hotelId)
                .gte('created_date', hace7Dias.toISOString())
                .order('created_date', { ascending: false });
            return data || [];
        },
        enabled: !!hotelId
    });

    const { data: dbStats = null } = useQuery({
        queryKey: ["dashboardStats", hotelId],
        queryFn: async () => {
            const { data, error } = await supabase.rpc('get_dashboard_stats', { p_hotel_id: hotelId });
            if (error) {
                logger.error("Error fetching RPC stats:", error);
                return null;
            }
            return data;
        },
        enabled: !!hotelId,
        refetchInterval: 60000 // Refetch every 60s as this is a fast RPC
    });

    const metrics = useMemo(() => {
        const hoy = new Date();
        const hoyYMD = format(hoy, 'yyyy-MM-dd');

        const todasLasVentas = [
            ...ventasHotel.map(v => ({ ...v, _tipo: 'hotel' })),
            ...ventasPos.map(v => ({ ...v, _tipo: 'pos', fecha_pago: v.fecha_venta }))
        ];
        const ventasHoy = todasLasVentas.filter(v => (v.fecha_pago || v.created_date || '').split('T')[0] === hoyYMD);
        const metodosHoy = calcularDesgloseMetodosPago(ventasHoy);
        const sunatHoy = calcularDesgloseSunat(ventasHoy);

        // Chart Data calculations using only the last 7 days of local data
        const chartData = Array.from({ length: 10 }).map((_, i) => {
            const d = subDays(hoy, 6 - i);
            const ymd = format(d, 'yyyy-MM-dd');
            const ddm = format(d, 'dd/MM');
            const esFuturo = i > 6;

            let sumHotel = 0;
            let sumPos = 0;

            if (esFuturo) {
                sumHotel = reservas.filter(r =>
                    (r.fecha_entrada || '').startsWith(ymd) && ['pendiente', 'activa'].includes(r.estado)
                ).reduce((acc, r) => acc + Number(r.total || 0), 0);
            } else {
                sumHotel = ventasHotel.filter(v => (v.fecha_pago || v.created_date || '').split('T')[0] === ymd).reduce((acc, v) => acc + Number(v.total || 0), 0);
                sumPos = ventasPos.filter(v => (v.fecha_venta || v.created_date || '').split('T')[0] === ymd).reduce((acc, v) => acc + Number(v.total || 0), 0);
            }

            return {
                name: ddm,
                Hospedaje: !esFuturo ? sumHotel : null,
                Minimarket: !esFuturo ? sumPos : null,
                Proyeccion: i >= 6 ? (sumHotel + sumPos) : null,
                Total: sumHotel + sumPos,
                esFuturo
            };
        });

        const llegadasHoy = reservas.filter(r => (r.fecha_entrada || '').startsWith(hoyYMD) && ['pendiente', 'activa'].includes(r.estado));
        const salidasHoy = reservas.filter(r => (r.fecha_salida || '').startsWith(hoyYMD) && ['activa'].includes(r.estado));

        // ─── Cálculo de variaciones vs ayer ───
        const ayerYMD = format(subDays(hoy, 1), 'yyyy-MM-dd');
        const ingresosAyer = ventasHotel.filter(v => (v.fecha_pago || v.created_date || '').split('T')[0] === ayerYMD).reduce((s, v) => s + Number(v.total || 0), 0)
            + ventasPos.filter(v => (v.fecha_venta || v.created_date || '').split('T')[0] === ayerYMD).reduce((s, v) => s + Number(v.total || 0), 0);

        const ingresosHoyCalc = dbStats?.ingresos_hoy || 0;
        const variacionIngresos = ingresosAyer > 0 ? ((ingresosHoyCalc - ingresosAyer) / ingresosAyer * 100) : null;

        // Use RPC data if available, fallback to 0 or local calc
        return {
            libres: dbStats?.libres || 0,
            ocupadas: dbStats?.ocupadas || 0,
            reservasActivas: dbStats?.reservas_activas || 0,
            mantenimiento: dbStats?.mantenimiento || 0,
            limpieza: dbStats?.limpieza || 0,
            todasLasVentas,
            ingresosHoy: ingresosHoyCalc,
            ocupacionPct: dbStats?.ocupacion_pct || 0,
            adr: dbStats?.ocupadas > 0 ? (dbStats.ingresos_hoy / dbStats.ocupadas) : 0,
            revpar: dbStats?.habitaciones_total > 0 ? (dbStats.ingresos_hoy / dbStats.habitaciones_total) : 0,
            chartData,
            ocupadasYPendientes: dbStats?.ocupadas_y_pendientes || 0,
            ingresosHospedajeHoy: dbStats?.ingresos_hospedaje_hoy || 0,
            ingresosPosHoy: dbStats?.ingresos_pos_hoy || 0,
            acumuladoMes: dbStats?.acumulado_mes || 0,
            ticketsPOS: dbStats?.tickets_pos || 0,
            llegadasHoy,
            salidasHoy,
            variacionIngresos,
            habitacionesTotal: dbStats?.habitaciones_total || 0,
            metodosHoy,
            sunatHoy,
            transaccionesHoy: ventasHoy.length,
        };
    }, [ventasHotel, ventasPos, reservas, dbStats]);

    const {
        libres, ocupadas, mantenimiento, limpieza,
        todasLasVentas, ingresosHoy, ocupacionPct,
        chartData, ocupadasYPendientes, ingresosHospedajeHoy, ingresosPosHoy,
        acumuladoMes, llegadasHoy, salidasHoy, variacionIngresos, habitacionesTotal,
        metodosHoy, sunatHoy, transaccionesHoy
    } = metrics;

    const kpis = [
        {
            label: "Ocupación",
            value: ocupacionPct,
            unit: "%",
            icon: BedDouble,
            theme: "blue",
            border: "",
            bgIcon: "bg-blue-500/10 text-blue-500 dark:bg-blue-950/50 dark:text-blue-400",
            barColor: "bg-blue-500",
            isMoney: false,
            variation: null,
            subtitle: `${ocupadas} de ${habitacionesTotal} hab.`
        },
        {
            label: "Ingresos Hoy",
            value: ingresosHoy,
            unit: "S/",
            icon: Wallet,
            theme: "green",
            border: "",
            bgIcon: "bg-emerald-500/10 text-emerald-500 dark:bg-emerald-950/50 dark:text-emerald-400",
            barColor: "bg-emerald-500",
            isMoney: true,
            variation: variacionIngresos,
            subtitle: 'vs. ayer'
        },
        {
            label: "Libres",
            value: libres,
            unit: "",
            icon: CheckCircle2,
            theme: "orange",
            border: "",
            bgIcon: "bg-amber-500/10 text-amber-500 dark:bg-amber-950/50 dark:text-amber-400",
            barColor: "bg-amber-500",
            isMoney: false,
            variation: null,
            subtitle: 'habitaciones disponibles'
        },
        {
            label: "Reservas",
            value: ocupadasYPendientes || 0,
            unit: "",
            icon: User,
            theme: "purple",
            border: "",
            bgIcon: "bg-purple-500/10 text-purple-500 dark:bg-purple-950/50 dark:text-purple-400",
            barColor: "bg-purple-500",
            isMoney: false,
            variation: null,
            subtitle: 'activas y pendientes'
        }
    ];

    /** ─── Quick Actions ─── */
    const quickActions = [
        { label: 'Nuevo Check-in', icon: LogIn, color: 'text-emerald-500', bg: 'bg-emerald-500/10 hover:bg-emerald-500/20', action: () => navigate('/recepcion') },
        { label: 'Registrar Venta', icon: Receipt, color: 'text-blue-500', bg: 'bg-blue-500/10 hover:bg-blue-500/20', action: () => navigate('/ventas') },
        { label: 'Abrir Caja', icon: Wallet, color: 'text-amber-500', bg: 'bg-amber-500/10 hover:bg-amber-500/20', action: () => navigate('/caja') },
        { label: 'Punto de Venta', icon: ShoppingCart, color: 'text-purple-500', bg: 'bg-purple-500/10 hover:bg-purple-500/20', action: () => navigate('/pos') },
        { label: 'Reportes', icon: FileText, color: 'text-cyan-500', bg: 'bg-cyan-500/10 hover:bg-cyan-500/20', action: () => navigate('/reportes') },
        { label: 'Limpieza', icon: BroomIcon, color: 'text-orange-500', bg: 'bg-orange-500/10 hover:bg-orange-500/20', action: () => navigate('/limpieza') },
    ];

    /** ─── Donut chart data ─── */
    const donutData = useMemo(() => [
        { name: 'Libres', value: libres || 0, fill: DONUT_COLORS.libres },
        { name: 'Ocupadas', value: ocupadas || 0, fill: DONUT_COLORS.ocupadas },
        { name: 'Limpieza', value: limpieza || 0, fill: DONUT_COLORS.limpieza },
        { name: 'Mantenimiento', value: mantenimiento || 0, fill: DONUT_COLORS.mantenimiento },
    ].filter(d => d.value > 0), [libres, ocupadas, limpieza, mantenimiento]);

    const totalHabitaciones = (libres || 0) + (ocupadas || 0) + (limpieza || 0) + (mantenimiento || 0);

    /** ─── Operational Alerts ─── */
    const alerts = useMemo(() => {
        const items = [];
        if (limpieza > 0) items.push({ type: 'warning', icon: BroomIcon, msg: `${limpieza} habitación(es) pendientes de limpieza`, color: 'border-l-amber-500 bg-amber-500/5' });
        if (mantenimiento > 0) items.push({ type: 'info', icon: AlertTriangle, msg: `${mantenimiento} habitación(es) en mantenimiento`, color: 'border-l-blue-500 bg-blue-500/5' });
        if (llegadasHoy.length > 0) items.push({ type: 'info', icon: LogIn, msg: `${llegadasHoy.length} llegada(s) programada(s) para hoy`, color: 'border-l-emerald-500 bg-emerald-500/5' });
        if (salidasHoy.length > 0) items.push({ type: 'info', icon: CalendarDays, msg: `${salidasHoy.length} salida(s) programada(s) para hoy`, color: 'border-l-orange-500 bg-orange-500/5' });
        return items;
    }, [limpieza, mantenimiento, llegadasHoy, salidasHoy]);

    // ─── GSAP Scroll Animations ────────────────────────────────────────
    // Stagger 2D wave para las KPI cards + bento cards en grid 4-columnas
    const kpiGridRef = useGsapStaggerList([kpis], {
        stagger: 0.05,
        direction: 'y',
        distance: 30,
        grid: 'auto',
        from: 'start',
    });
    const chartCardRef = useRef(null);
    const incomeCardRef = useRef(null);
    const occupationCardRef = useRef(null);
    const activityCardRef = useRef(null);
    const progressBarRef = useRef(null);

    // ─── Micro-interacciones hover en cards bento ───
    useGsapCardHover(incomeCardRef, { scale: 1.01, glowColor: BENTO_GLOWS.income, glowSize: 32, duration: 0.35 });
    useGsapCardHover(occupationCardRef, { scale: 1.01, glowColor: BENTO_GLOWS.occupation, glowSize: 32, duration: 0.35 });
    useGsapCardHover(activityCardRef, { scale: 1.008, glowColor: BENTO_GLOWS.activity, glowSize: 32, duration: 0.35 });

    // Effect 2: Progress bar (al montar y cuando cambia el valor)
    useEffect(() => {
        if (!progressBarRef.current) return;
        gsap.to(progressBarRef.current, {
            width: `${ocupacionPct}%`,
            duration: 1.5,
            ease: 'power3.out',
            delay: 0.4,
        });
    }, [ocupacionPct]);



    return (
        <div className="page-shell">
            {/* ═══ Header — Saludo Personalizado ═══ */}
            <div className="page-header lg:items-center">
                <div>
                    <p className="text-sm font-medium text-muted-foreground mb-0.5">
                        {getGreeting()}, <span className="font-display font-bold text-foreground">{user?.full_name?.split(' ')[0] || 'Admin'}</span> 👋
                    </p>
                    <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">Esto es lo que pasa en tu hotel hoy</h1>
                    <div className="flex items-center gap-2 mt-1.5">
                        <CalendarDays className="w-3.5 h-3.5 text-muted-foreground/50" />
                        <p className="text-xs font-medium text-muted-foreground/60 tracking-wide capitalize">
                            {new Date().toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2 items-center">
                    <div className={cn("px-3 py-1.5 border rounded-xl flex items-center gap-2.5 shadow-sm transition-all duration-300",
                        isOffline ? "bg-red-500/10 border-red-500/30" : "bg-card/80 border-border/50"
                    )}>
                        <div className={cn("w-2 h-2 rounded-full", isOffline ? "bg-red-500" : "bg-emerald-500 animate-pulse")} />
                        <div className="flex flex-col">
                            <span className="text-xs font-bold text-foreground leading-none">
                                {isOffline ? 'Modo Offline' : 'Sistema Operativo'}
                            </span>
                            <span className={cn("text-[9px] font-medium mt-0.5", isOffline ? "text-red-500 font-bold" : "text-muted-foreground")}>
                                {isOffline
                                    ? (queueCount > 0 ? `${queueCount} cambios pendientes` : 'Sin internet')
                                    : 'Sincronizado'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* MAIN BENTO GRID UNIFICADO */}
            <div ref={kpiGridRef} className="ui-card-grid grid grid-cols-2 lg:grid-cols-4">
                {/* 1. KPIs (4 celdas 1x1) */}
                {kpis.map((kpi) => (
                    <KpiCard key={kpi.label} kpi={kpi} />
                ))}

                <DailyAuditSummary
                    total={ingresosHoy}
                    transactions={transaccionesHoy}
                    methods={metodosHoy}
                    sunat={sunatHoy}
                    onOpenCaja={() => navigate('/caja')}
                />

                {/* 2. Análisis Semanal Chart (Toma 3 columnas) */}
                <WeeklyAnalysisChart chartData={chartData} cardRef={chartCardRef} />

                {/* 3. Ingresos Diarios Card (Toma 1 columna, al lado del chart) */}
                <div ref={incomeCardRef} className="enterprise-card section-card ui-card-pad col-span-2 flex flex-col justify-between transition-all duration-300 ease-out hover:shadow-md lg:col-span-1">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-6 h-6 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-sm flex-shrink-0">
                            <TrendingUp className="w-3.5 h-3.5" />
                        </div>
                        <h3 className="text-sm font-bold text-foreground tracking-tight leading-tight">Ingresos Hoy</h3>
                    </div>

                    <div className="space-y-4 flex-1 justify-center flex flex-col">
                        <div className="space-y-1">
                            <div className="flex justify-between items-center">
                                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Hospedaje</span>
                                <span className="text-sm font-medium text-foreground tabular-nums">S/ {ingresosHospedajeHoy.toFixed(2)}</span>
                            </div>
                            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-primary rounded-full" style={{ width: ingresosHoy > 0 ? `${(ingresosHospedajeHoy / ingresosHoy) * 100}%` : '0%' }} />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <div className="flex justify-between items-center">
                                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Tienda (POS)</span>
                                <span className="text-sm font-medium text-foreground tabular-nums">S/ {ingresosPosHoy.toFixed(2)}</span>
                            </div>
                            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-amber-500 rounded-full" style={{ width: ingresosHoy > 0 ? `${(ingresosPosHoy / ingresosHoy) * 100}%` : '0%' }} />
                            </div>
                        </div>

                        {/* KPIs Gerenciales: ADR & RevPAR */}
                        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/50">
                            <div className="bg-muted/30 p-3 rounded-lg flex flex-col justify-between">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">ADR</p>
                                <p className="text-base font-bold text-foreground mt-1 tabular-nums">S/ {metrics.adr ? metrics.adr.toFixed(2) : '0.00'}</p>
                            </div>
                            <div className="bg-muted/30 p-3 rounded-lg flex flex-col justify-between">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">RevPAR</p>
                                <p className="text-base font-bold text-foreground mt-1 tabular-nums">S/ {metrics.revpar ? metrics.revpar.toFixed(2) : '0.00'}</p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-border/50">
                        <div className="flex justify-between items-center">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Acumulado Mes</p>
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-[9px] text-amber-600 font-semibold uppercase border border-amber-500/20">Live</span>
                        </div>
                        <p className="text-xl sm:text-2xl font-bold text-foreground tracking-tight tabular-nums mt-0.5">S/ {Math.round(acumuladoMes).toLocaleString()}</p>
                    </div>
                </div>

                {/* 4. Estado del Inventario — Donut Chart (Toma 2 columnas) */}
                <InventoryStatus 
                    cardRef={occupationCardRef}
                    donutData={donutData}
                    totalHabitaciones={totalHabitaciones}
                    libres={libres}
                    ocupadas={ocupadas}
                    limpieza={limpieza}
                    mantenimiento={mantenimiento}
                    ocupacionPct={ocupacionPct}
                    progressBarRef={progressBarRef}
                />

                {/* 5. Actividad Reciente Premium (Toma 2 columnas) */}
                <RecentActivity cardRef={activityCardRef} todasLasVentas={todasLasVentas} />

                {/* 6. Quick Actions (Toma 2 columnas) */}
                <div className="enterprise-card section-card ui-card-pad col-span-2 flex flex-col transition-all duration-300 ease-out lg:col-span-2">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Zap className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <h3 className="text-sm font-bold text-foreground tracking-tight">Acciones Rápidas</h3>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 flex-1">
                        {quickActions.map((a) => {
                            const Icon = a.icon;
                            return (
                                <button
                                    key={a.label}
                                    onClick={a.action}
                                    className={cn(
                                        'flex flex-col items-center justify-center gap-2 p-3 rounded-xl transition-all duration-200 group/qa',
                                        a.bg
                                    )}
                                >
                                    <Icon className={cn('w-5 h-5 transition-transform group-hover/qa:scale-110', a.color)} />
                                    <span className="text-[10px] font-bold text-foreground leading-tight text-center">{a.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 7. Alertas Operacionales (Toma 2 columnas) */}
                <div className="enterprise-card section-card ui-card-pad col-span-2 flex flex-col transition-all duration-300 ease-out lg:col-span-2">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                            </div>
                            <h3 className="text-sm font-bold text-foreground tracking-tight">Alertas</h3>
                        </div>
                        {alerts.length > 0 && (
                            <span className="text-[9px] font-bold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-md">{alerts.length}</span>
                        )}
                    </div>
                    <div className="space-y-2 flex-1">
                        {alerts.length > 0 ? alerts.map((alert, i) => {
                            const AlertIcon = alert.icon;
                            return (
                                <div key={i} className={cn('flex items-center gap-3 p-3 rounded-xl border-l-[3px] transition-colors', alert.color)}>
                                    <AlertIcon className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                                    <p className="text-xs font-medium text-foreground flex-1">{alert.msg}</p>
                                </div>
                            );
                        }) : (
                            <div className="flex flex-col items-center justify-center flex-1 py-6 text-muted-foreground">
                                <CheckCircle2 className="w-8 h-8 mb-2 text-emerald-500/40" />
                                <p className="text-xs font-medium">Todo en orden</p>
                                <p className="text-[10px] text-muted-foreground/60 mt-0.5">No hay alertas pendientes</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* 8. Panel de Llegadas y Salidas de Hoy (Toma 4 columnas completas) */}
                <div className="enterprise-card section-card ui-card-pad col-span-2 flex flex-col transition-all duration-300 ease-out lg:col-span-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-foreground tracking-tight flex items-center gap-2">
                            <CalendarDays className="w-4 h-4 text-primary" />
                            Llegadas y Salidas de Hoy
                        </h3>
                        <Link to="/recepcion">
                            <span className="text-[10px] font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1">Ir a Recepción <ArrowUpRight className="w-3 h-3" /></span>
                        </Link>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Llegadas */}
                        <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-500 mb-3 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Llegadas ({llegadasHoy.length})
                            </h4>
                            {llegadasHoy.length > 0 ? (
                                <div className="space-y-2">
                                    {llegadasHoy.map(r => {
                                        const ini = (r.huesped_nombre || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                                        return (
                                            <div key={r.id} className="flex items-center justify-between p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">{ini}</div>
                                                    <div>
                                                        <p className="text-xs font-bold text-foreground">{r.huesped_nombre}</p>
                                                        <p className="text-[10px] text-muted-foreground">Habitación {r.habitacion_numero || 'Sin asignar'}</p>
                                                    </div>
                                                </div>
                                                <span className="text-[10px] px-2 py-1 bg-emerald-500/10 text-emerald-600 rounded-md font-semibold uppercase">{r.estado}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="p-4 bg-muted/20 border border-border/40 rounded-xl flex flex-col items-center justify-center text-muted-foreground">
                                    <span className="text-xs">No hay llegadas programadas para hoy</span>
                                </div>
                            )}
                        </div>
                        {/* Salidas */}
                        <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-orange-500 mb-3 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                                Salidas ({salidasHoy.length})
                            </h4>
                            {salidasHoy.length > 0 ? (
                                <div className="space-y-2">
                                    {salidasHoy.map(r => {
                                        const ini = (r.huesped_nombre || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                                        return (
                                            <div key={r.id} className="flex items-center justify-between p-3 bg-orange-500/5 border border-orange-500/10 rounded-xl">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">{ini}</div>
                                                    <div>
                                                        <p className="text-xs font-bold text-foreground">{r.huesped_nombre}</p>
                                                        <p className="text-[10px] text-muted-foreground">Habitación {r.habitacion_numero}</p>
                                                    </div>
                                                </div>
                                                <span className="text-[10px] px-2 py-1 bg-orange-500/10 text-orange-600 rounded-md font-semibold uppercase">{r.estado}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="p-4 bg-muted/20 border border-border/40 rounded-xl flex flex-col items-center justify-center text-muted-foreground">
                                    <span className="text-xs">No hay salidas programadas para hoy</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
