import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/db';
import { useHotel } from '@/lib/HotelContext';
import { useAuth } from '@/lib/AuthContext';
import { 
    Wallet, Plus, MinusCircle, History, CheckCircle2, 
    TrendingUp, TrendingDown, Landmark, Receipt,
    Calendar, User, DollarSign, ArrowRightLeft,
    AlertCircle, FileText, Download, Filter, Printer,
    FileSpreadsheet, FileJson
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { printCashClosure } from '@/modules/printer/services/printer.service';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

export default function Caja() {
    const { activeHotel } = useHotel();
    const { user } = useAuth();
    const qc = useQueryClient();
    const hotelDb = db.forHotel(activeHotel?.id);

    const [expenseModal, setExpenseModal] = useState(false);
    const [closureModal, setClosureModal] = useState(false);
    const [filterTab, setFilterTab] = useState('hoy');

    // --- DATA FETCHING ---
    const { data: ventasHotel = [] } = useQuery({
        queryKey: ['ventas-hotel', activeHotel?.id],
        queryFn: () => hotelDb.Venta.list(),
        enabled: !!activeHotel?.id
    });

    const { data: ventasPOS = [] } = useQuery({
        queryKey: ['ventas-pos', activeHotel?.id],
        queryFn: () => hotelDb.VentaPOS.list(),
        enabled: !!activeHotel?.id
    });

    const { data: egresos = [] } = useQuery({
        queryKey: ['egresos', activeHotel?.id],
        queryFn: () => hotelDb.Egreso.list(),
        enabled: !!activeHotel?.id
    });

    const { data: cierres = [] } = useQuery({
        queryKey: ['cierres', activeHotel?.id],
        queryFn: () => hotelDb.CierreCaja.list(),
        enabled: !!activeHotel?.id
    });

    // --- MUTATIONS ---
    const addEgreso = useMutation({
        mutationFn: (/** @type {any} */ vars) => hotelDb.Egreso.create(vars),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['egresos'] });
            setExpenseModal(false);
        }
    });

    const addCierre = useMutation({
        mutationFn: (/** @type {any} */ vars) => hotelDb.CierreCaja.create(vars),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['cierres'] });
            setClosureModal(false);
        }
    });

    // --- CALCULATIONS ---
    const stats = useMemo(() => {
        const hoy = new Date().toISOString().split('T')[0];
        
        const hHoy = ventasHotel.filter(v => (v.fecha_pago || v.fecha_venta || v.created_date || '').startsWith(hoy));
        const pHoy = ventasPOS.filter(v => (v.fecha_venta || v.created_date || '').startsWith(hoy));
        const egHoy = egresos.filter(e => (e.fecha || e.created_date || '').startsWith(hoy));

        const totalHotel = hHoy.reduce((acc, v) => acc + (Number(v.monto_pagado || v.total) || 0), 0);
        const totalPOS = pHoy.reduce((acc, v) => acc + (Number(v.total) || 0), 0);
        const totalEgresos = egHoy.reduce((acc, e) => acc + (Number(e.monto) || 0), 0);
        
        const totalIngresos = totalHotel + totalPOS;

        return {
            ingresos: totalIngresos,
            hotel: totalHotel,
            pos: totalPOS,
            egresos: totalEgresos,
            balance: totalIngresos - totalEgresos,
            countHotel: hHoy.length,
            countPOS: pHoy.length,
            countEgresos: egHoy.length,
            hHoy,
            pHoy,
            egHoy
        };
    }, [ventasHotel, ventasPOS, egresos]);

    // --- EXPORT FUNCTIONS ---
    const handlePrintTicket = () => {
        printCashClosure({
            hotelName: activeHotel?.nombre,
            address: activeHotel?.direccion,
            userName: user?.full_name || user?.email,
            date: new Date(),
            hotelCount: stats.countHotel,
            hotelTotal: stats.hotel,
            posCount: stats.countPOS,
            posTotal: stats.pos,
            egresosCount: stats.countEgresos,
            egresosTotal: stats.egresos,
            saldoFinal: stats.balance
        });
    };

    const handleExportPDF = () => {
        const doc = new jsPDF();
        const now = format(new Date(), "dd/MM/yyyy HH:mm");

        doc.setFontSize(20);
        doc.text("Reporte de Cierre de Caja", 105, 15, { align: 'center' });
        
        doc.setFontSize(10);
        doc.text(`Hotel: ${activeHotel?.nombre || 'General'}`, 14, 25);
        doc.text(`Fecha: ${now}`, 14, 30);
        doc.text(`Responsable: ${user?.full_name || user?.email}`, 14, 35);

        // Resumen
        const summaryData = [
            ["Categoría", "Transacciones", "Total"],
            ["Ventas Hotel", stats.countHotel, `S/ ${stats.hotel.toFixed(2)}`],
            ["Ventas Minimarket", stats.countPOS, `S/ ${stats.pos.toFixed(2)}`],
            ["Egresos / Gastos", stats.countEgresos, `- S/ ${stats.egresos.toFixed(2)}`],
            ["SALDO FINAL", "", `S/ ${stats.balance.toFixed(2)}`]
        ];

        doc.autoTable({
            startY: 45,
            head: [summaryData[0]],
            body: summaryData.slice(1),
            theme: 'striped',
            headStyles: { fillColor: [0, 112, 65] }
        });

        doc.save(`Cierre_Caja_${format(new Date(), "yyyyMMdd")}.pdf`);
    };

    const handleExportExcel = () => {
        const wb = XLSX.utils.book_new();
        
        // Hoja 1: Resumen
        const resData = [
            ["REPORTE DE CIERRE DE CAJA"],
            ["Hotel", activeHotel?.nombre],
            ["Fecha", format(new Date(), "dd/MM/yyyy HH:mm")],
            ["Responsable", user?.full_name || user?.email],
            [],
            ["CATEGORÍA", "TRANSACCIONES", "TOTAL"],
            ["Ventas Hotel", stats.countHotel, stats.hotel],
            ["Ventas Minimarket", stats.countPOS, stats.pos],
            ["Egresos", stats.countEgresos, stats.egresos],
            ["SALDO FINAL", "", stats.balance]
        ];
        const wsRes = XLSX.utils.aoa_to_sheet(resData);
        XLSX.utils.book_append_sheet(wb, wsRes, "Resumen");

        // Hoja 2: Detalle Hotel
        const hotelData = stats.hHoy.map(v => ({
            Fecha: format(new Date(v.fecha_pago || v.created_date), "dd/MM/yyyy HH:mm"),
            Cliente: v.cliente_nombre || 'General',
            Concepto: v.habitacion_numero ? `Hab. ${v.habitacion_numero}` : 'Alojamiento',
            Total: v.monto_pagado || v.total
        }));
        const wsHotel = XLSX.utils.json_to_sheet(hotelData);
        XLSX.utils.book_append_sheet(wb, wsHotel, "Ventas Hotel");

        // Hoja 3: Detalle POS
        const posData = stats.pHoy.map(v => ({
            Fecha: format(new Date(v.created_date), "dd/MM/yyyy HH:mm"),
            Cliente: v.cliente_nombre || 'General',
            Total: v.total
        }));
        const wsPOS = XLSX.utils.json_to_sheet(posData);
        XLSX.utils.book_append_sheet(wb, wsPOS, "Minimarket");

        XLSX.writeFile(wb, `Cierre_Caja_${format(new Date(), "yyyyMMdd")}.xlsx`);
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { 
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
    };

    return (
        <motion.div 
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            className="p-3 sm:p-4 lg:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8 page-enter"
        >
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="flex-1">
                    <motion.div variants={itemVariants} className="flex items-center gap-3 mb-2">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Wallet className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-black font-display tracking-tight">Caja</h1>
                    </motion.div>
                    <motion.p variants={itemVariants} className="text-muted-foreground text-xs sm:text-sm max-w-md hidden sm:block">
                        Gestión diaria de flujos de efectivo, registro de gastos operativos y cierres de turno.
                    </motion.p>
                </div>

                <motion.div variants={itemVariants} className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                    <Button 
                        variant="outline" 
                        className="flex-1 sm:flex-none gap-2 border-primary/20 hover:bg-primary/5 h-10 sm:h-11 text-xs sm:text-sm"
                        onClick={() => setClosureModal(true)}
                    >
                        <ArrowRightLeft className="w-4 h-4" />
                        Cierre
                    </Button>
                    <Button 
                        className="flex-1 sm:flex-none gap-2 bg-primary hover:bg-primary/90 h-10 sm:h-11 shadow-lg shadow-primary/20 text-xs sm:text-sm"
                        onClick={() => setExpenseModal(true)}
                    >
                        <Plus className="w-4 h-4" />
                        Egreso
                    </Button>
                </motion.div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <motion.div variants={itemVariants} className="glass-card p-5 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] relative overflow-hidden group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-green-500/10 flex items-center justify-center">
                            <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-green-500" />
                        </div>
                        <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-green-500/60 bg-green-500/5 px-2 py-1 rounded-full">Ingresos</span>
                    </div>
                    <p className="text-2xl sm:text-3xl font-black font-display mb-1">S/ {stats.ingresos.toFixed(2)}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">{stats.countHotel + stats.countPOS} transacciones</p>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-green-500/10 transition-colors" />
                </motion.div>

                <motion.div variants={itemVariants} className="glass-card p-5 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] relative overflow-hidden group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-red-500/10 flex items-center justify-center">
                            <TrendingDown className="w-5 h-5 sm:w-6 sm:h-6 text-red-500" />
                        </div>
                        <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-red-500/60 bg-red-500/5 px-2 py-1 rounded-full">Egresos</span>
                    </div>
                    <p className="text-2xl sm:text-3xl font-black font-display mb-1">S/ {stats.egresos.toFixed(2)}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">{stats.countEgresos} salidas</p>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-red-500/10 transition-colors" />
                </motion.div>

                <motion.div variants={itemVariants} className="bg-primary/5 border border-primary/20 p-5 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] relative overflow-hidden group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-primary/10 flex items-center justify-center">
                            <Landmark className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                        </div>
                        <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-primary/60 bg-primary/10 px-2 py-1 rounded-full">Balance</span>
                    </div>
                    <p className="text-2xl sm:text-3xl font-black font-display mb-1 text-primary">S/ {stats.balance.toFixed(2)}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground/80 font-medium">Efectivo disponible</p>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-3xl rounded-full -mr-16 -mt-16" />
                </motion.div>
            </div>

            {/* Main Content Tabs */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: List of Egresos */}
                <motion.div variants={itemVariants} className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between px-2">
                        <h3 className="font-bold text-lg flex items-center gap-2">
                            <History className="w-5 h-5 text-muted-foreground" />
                            Movimientos Recientes
                        </h3>
                        <div className="flex gap-2">
                            {['hoy', 'semana', 'todos'].map(t => (
                                <button
                                    key={t}
                                    onClick={() => setFilterTab(t)}
                                    className={cn(
                                        "px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all",
                                        filterTab === t ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"
                                    )}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-3">
                        {egresos.length > 0 ? (
                            egresos.slice(0, 10).map((e, idx) => (
                                <motion.div 
                                    key={e.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    className="glass-card p-3 sm:p-4 rounded-[1.25rem] sm:rounded-2xl flex items-center justify-between hover:bg-card/80 transition-all border-l-4 border-l-red-500/50"
                                >
                                    <div className="flex items-center gap-3 sm:gap-4">
                                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-red-500/5 flex items-center justify-center border border-red-500/10">
                                            <MinusCircle className="w-5 h-5 text-red-500" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-xs sm:text-sm text-foreground">{e.concepto || 'Egreso sin concepto'}</p>
                                            <div className="flex items-center gap-2 text-[9px] sm:text-[10px] text-muted-foreground mt-0.5">
                                                <Calendar className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                                <span className="truncate max-w-[80px] sm:max-w-none">{format(new Date(e.fecha || e.created_date), "dd MMM, HH:mm", { locale: es })}</span>
                                                <span className="opacity-30">•</span>
                                                <User className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                                <span className="truncate max-w-[60px] sm:max-w-none">{e.usuario_nombre || 'Staff'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-black text-red-500">- S/ {Number(e.monto).toFixed(2)}</p>
                                        <span className="text-[9px] font-bold uppercase tracking-tighter text-muted-foreground/40">{e.categoria || 'Operativo'}</span>
                                    </div>
                                </motion.div>
                            ))
                        ) : (
                            <div className="text-center py-20 bg-muted/20 border border-dashed rounded-3xl">
                                <AlertCircle className="w-10 h-10 text-muted-foreground/30 mx-auto mb-4" />
                                <p className="text-muted-foreground font-medium">No se registran egresos recientes</p>
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* Right Column: History of Closures */}
                <motion.div variants={itemVariants} className="space-y-6">
                    <h3 className="font-bold text-lg px-2 flex items-center gap-2">
                        <History className="w-5 h-5 text-muted-foreground" />
                        Historial de Cierres
                    </h3>

                    <div className="space-y-4">
                        {cierres.length > 0 ? (
                            cierres.slice(0, 5).map((c, idx) => (
                                <div key={c.id} className="glass-card p-5 rounded-3xl border-t-4 border-t-primary/20 relative overflow-hidden">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">Cierre de Caja</p>
                                            <p className="font-bold text-sm">{format(new Date(c.fecha || c.created_date), "EEEE, d 'de' MMMM", { locale: es })}</p>
                                        </div>
                                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-border/50">
                                        <div>
                                            <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-tight">Total Ventas</p>
                                            <p className="font-black text-xs text-foreground">S/ {Number(c.total_ventas).toFixed(2)}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-tight">Saldo Final</p>
                                            <p className="font-black text-xs text-primary">S/ {Number(c.saldo_final).toFixed(2)}</p>
                                        </div>
                                    </div>
                                    <div className="mt-4 flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
                                            <span className="text-[8px] font-bold">{(c.usuario_nombre || '?')[0]}</span>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground italic">Cerrado por {c.usuario_nombre || 'Sistema'}</p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-10 bg-muted/10 border border-dashed rounded-3xl">
                                <p className="text-xs text-muted-foreground italic">Aún no hay cierres registrados</p>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>

            {/* MODAL: REGISTRAR EGRESO */}
            <Dialog open={expenseModal} onOpenChange={setExpenseModal}>
                <DialogContent className="max-w-md p-0 overflow-hidden rounded-[2.5rem] border-none shadow-2xl">
                    <div className="bg-primary p-8 text-white relative overflow-hidden">
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-black font-display flex items-center gap-2">
                                <TrendingDown className="w-6 h-6" />
                                Nuevo Egreso
                            </DialogTitle>
                        </DialogHeader>
                        <p className="text-white/60 text-xs mt-1">Registra gastos operativos o compras para el hotel.</p>
                        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 blur-3xl rounded-full -mr-20 -mt-20" />
                    </div>

                    <form onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.target);
                        addEgreso.mutate({
                            monto: Number(formData.get('monto')),
                            concepto: formData.get('concepto'),
                            categoria: formData.get('categoria'),
                            fecha: new Date().toISOString(),
                            usuario_id: user?.id,
                            usuario_nombre: user?.full_name || user?.email
                        });
                    }} className="p-8 space-y-5 bg-card">
                        <div className="space-y-2">
                            <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/60">Monto del Gasto (S/)</Label>
                            <div className="relative">
                                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/40" />
                                <Input 
                                    name="monto" 
                                    type="number" 
                                    step="0.01" 
                                    required 
                                    className="pl-12 h-14 bg-muted/30 border-none rounded-2xl text-lg font-bold focus:ring-primary/20"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/60">Concepto / Detalle</Label>
                            <div className="relative">
                                <FileText className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/40" />
                                <Input 
                                    name="concepto" 
                                    required 
                                    className="pl-12 h-14 bg-muted/30 border-none rounded-2xl focus:ring-primary/20"
                                    placeholder="Ej. Compra de insumos de limpieza"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/60">Categoría</Label>
                            <select 
                                name="categoria"
                                className="w-full h-14 px-5 bg-muted/30 border-none rounded-2xl text-sm font-medium focus:ring-primary/20 appearance-none"
                            >
                                <option value="operativo">Gasto Operativo</option>
                                <option value="servicios">Servicios (Luz, Agua, Internet)</option>
                                <option value="insumos">Insumos y Limpieza</option>
                                <option value="mantenimiento">Mantenimiento</option>
                                <option value="personal">Adelanto Personal</option>
                                <option value="otros">Otros</option>
                            </select>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <Button type="button" variant="ghost" onClick={() => setExpenseModal(false)} className="flex-1 h-12 rounded-2xl">Cancelar</Button>
                            <Button disabled={addEgreso.isPending} className="flex-1 h-12 rounded-2xl bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
                                {addEgreso.isPending ? 'Guardando...' : 'Registrar Gasto'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* MODAL: CIERRE DE CAJA */}
            <Dialog open={closureModal} onOpenChange={setClosureModal}>
                <DialogContent className="max-w-md p-0 overflow-hidden rounded-[2.5rem] border-none shadow-2xl">
                    <div className="bg-amber-500 p-8 text-white relative overflow-hidden">
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-black font-display flex items-center gap-2">
                                <Landmark className="w-6 h-6" />
                                Cierre de Turno
                            </DialogTitle>
                        </DialogHeader>
                        <p className="text-white/60 text-xs mt-1">Confirma el balance actual y cierra la sesión de caja.</p>
                        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 blur-3xl rounded-full -mr-20 -mt-20" />
                    </div>

                    <div className="p-8 space-y-6 bg-card">
                        <div className="bg-amber-50 border border-amber-200 p-5 rounded-3xl space-y-3">
                            <div className="flex justify-between items-center text-amber-900/60 font-bold text-[10px] uppercase tracking-widest">
                                <span>Resumen de Turno</span>
                                <span>{format(new Date(), "dd/MM/yyyy")}</span>
                            </div>
                            <div className="space-y-1.5 pt-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground font-medium italic">Ventas Hotel (Alojamiento):</span>
                                    <span className="font-bold text-foreground">S/ {stats.hotel.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground font-medium italic">Ventas Minimarket (POS):</span>
                                    <span className="font-bold text-foreground">S/ {stats.pos.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm pt-1">
                                    <span className="text-muted-foreground font-medium">Subtotal Ingresos:</span>
                                    <span className="font-black text-green-600">S/ {stats.ingresos.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground font-medium">Egresos Registrados:</span>
                                    <span className="font-black text-red-500">- S/ {stats.egresos.toFixed(2)}</span>
                                </div>
                                <div className="pt-3 border-t border-amber-200 flex justify-between items-end">
                                    <span className="text-amber-900 font-black text-xs uppercase">Efectivo en Caja:</span>
                                    <span className="font-black text-2xl text-amber-600 leading-none">S/ {stats.balance.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Export Buttons */}
                        <div className="grid grid-cols-3 gap-2">
                            <Button variant="outline" size="sm" onClick={handlePrintTicket} className="flex-col h-auto py-3 gap-2 border-border/50 hover:bg-primary/5">
                                <Printer className="w-4 h-4 text-primary" />
                                <span className="text-[10px] font-bold">Ticket</span>
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleExportPDF} className="flex-col h-auto py-3 gap-2 border-border/50 hover:bg-red-500/5">
                                <FileText className="w-4 h-4 text-red-500" />
                                <span className="text-[10px] font-bold">PDF</span>
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleExportExcel} className="flex-col h-auto py-3 gap-2 border-border/50 hover:bg-green-500/5">
                                <FileSpreadsheet className="w-4 h-4 text-green-500" />
                                <span className="text-[10px] font-bold">Excel</span>
                            </Button>
                        </div>

                        <div className="space-y-3">
                            <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/60">Notas del Cierre (Opcional)</Label>
                            <textarea 
                                className="w-full p-4 bg-muted/30 border-none rounded-2xl text-sm focus:ring-amber-500/20 min-h-[80px]"
                                placeholder="Indique novedades o diferencias de caja..."
                            />
                        </div>

                        <div className="flex gap-3 pt-2">
                            <Button variant="ghost" onClick={() => setClosureModal(false)} className="flex-1 h-12 rounded-2xl">Volver</Button>
                            <Button 
                                className="flex-1 h-12 rounded-2xl bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-500/20"
                                onClick={() => addCierre.mutate({
                                    fecha: new Date().toISOString(),
                                    total_ventas: stats.ingresos,
                                    total_egresos: stats.egresos,
                                    saldo_final: stats.balance,
                                    usuario_id: user?.id,
                                    usuario_nombre: user?.full_name || user?.email,
                                    hotel_id: activeHotel?.id
                                })}
                            >
                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                Confirmar Cierre
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </motion.div>
    );
}
