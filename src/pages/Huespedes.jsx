// @ts-nocheck
import { useState, memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
    Users, Search, Phone, MapPin, Calendar, 
    CreditCard, User as UserIcon, TrendingUp,
    ArrowUpDown, Eye,
    ArrowLeft, Mail, Star, History,
    Clock, DollarSign, FileText, Download
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useHotelData } from '@/hooks/use-hotel-data';
import { useGsapStaggerList } from '@/hooks/useGsapStaggerList';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear, isWithinInterval, parseISO } from 'date-fns';
import { toast } from 'sonner';
// xlsx, jsPDF, autoTable se importan dinámicamente para evitar carga en todas las páginas
import PageSkeleton from '@/components/loaders/PageSkeleton';

const Huespedes = memo(function Huespedes() {
    const { db: hotelDb, hotelId } = useHotelData();
    const [busqueda, setBusqueda] = useState('');
    const [orden, setOrden] = useState('nombre');
    const [activeTab, setActiveTab] = useState('directorio');
    const [selectedHuesped, setSelectedHuesped] = useState(null);
    const [exportDialogOpen, setExportDialogOpen] = useState(false);
    const [periodoExport, setPeriodoExport] = useState('mes');
    const [fechaExport, setFechaExport] = useState(format(new Date(), 'yyyy-MM-dd'));

    const { data: reservas = [], isLoading } = useQuery({
        queryKey: ['reservas-huespedes', hotelId],
        queryFn: () => hotelDb.Reserva.list(),
        enabled: !!hotelId,
    });

    /** @param {string} formato */
    const exportarDircetur = async (formato = 'excel') => {
        let start, end;
        const selectedDate = parseISO(fechaExport);
        if (periodoExport === 'dia') {
            start = startOfDay(selectedDate);
            end = endOfDay(selectedDate);
        } else if (periodoExport === 'mes') {
            start = startOfMonth(selectedDate);
            end = endOfMonth(selectedDate);
        } else if (periodoExport === 'año') {
            start = startOfYear(selectedDate);
            end = endOfYear(selectedDate);
        }

        const filtradas = reservas.filter(r => {
            if (!r.fecha_entrada) return false;
            const f = parseISO(r.fecha_entrada);
            return isWithinInterval(f, { start, end });
        }).sort((a, b) => new Date(a.fecha_entrada).getTime() - new Date(b.fecha_entrada).getTime());

        if (filtradas.length === 0) {
            toast.error('No hay huéspedes registrados en este periodo');
            return;
        }

        if (formato === 'excel') {
            const XLSX = await import('xlsx');
            const data = filtradas.map(r => ({
                'Nombres y Apellidos': r.huesped_nombre || '',
                'Tipo Documento': r.tipo_documento || 'DNI',
                'Número Documento': r.huesped_dni || '',
                'Nacionalidad': r.nacionalidad || r.huesped_procedencia || '',
                'Fecha Nacimiento': r.huesped_fecha_nacimiento || '',
                'Profesión/Ocupación': r.huesped_profesion || '',
                'Estado Civil': r.huesped_estado_civil ? r.huesped_estado_civil.toUpperCase() : '',
                'Procedencia': r.huesped_procedencia || '',
                'Destino': r.huesped_destino || '',
                'Motivo de Viaje': r.motivo_viaje ? r.motivo_viaje.toUpperCase() : '',
                'Fecha de Ingreso': r.fecha_entrada || '',
                'Fecha de Salida': r.fecha_salida || '',
                'Habitación': r.habitacion_numero || ''
            }));

            const ws = XLSX.utils.json_to_sheet(data);
            ws['!cols'] = [
                { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, 
                { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 20 }, 
                { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 10 }
            ];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "DIRCETUR");
            XLSX.writeFile(wb, `Reporte_DIRCETUR_${periodoExport}_${fechaExport}.xlsx`);
        } else if (formato === 'pdf') {
            const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
                import('jspdf'),
                import('jspdf-autotable'),
            ]);
            const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });
            doc.setFontSize(14);
            doc.text('Reporte DIRCETUR (Libro de Registro de Huéspedes)', 14, 20);
            doc.setFontSize(10);
            doc.text(`Periodo: ${periodoExport.toUpperCase()} - Fecha Ref: ${fechaExport}`, 14, 28);
            
            const tableData = filtradas.map(r => [
                r.huesped_nombre || '',
                `${r.tipo_documento || 'DNI'}: ${r.huesped_dni || ''}`,
                r.nacionalidad || r.huesped_procedencia || '',
                r.huesped_fecha_nacimiento || '',
                r.huesped_estado_civil ? r.huesped_estado_civil.toUpperCase() : '',
                r.huesped_procedencia || '',
                r.motivo_viaje ? r.motivo_viaje.toUpperCase() : '',
                r.fecha_entrada ? format(new Date(r.fecha_entrada + 'T12:00:00'), 'dd/MM/yy') : '',
                r.fecha_salida ? format(new Date(r.fecha_salida + 'T12:00:00'), 'dd/MM/yy') : '',
                r.habitacion_numero || ''
            ]);

            autoTable(doc, {
                startY: 35,
                head: [['Nombres', 'Documento', 'Nacionalidad', 'F. Nac.', 'E. Civil', 'Procedencia', 'Motivo', 'Ingreso', 'Salida', 'Hab.']],
                body: tableData,
                styles: { fontSize: 7, cellPadding: 2 },
                headStyles: { fillColor: [41, 128, 185] }
            });

            doc.save(`Reporte_DIRCETUR_${periodoExport}_${fechaExport}.pdf`);
        }

        setExportDialogOpen(false);
        toast.success(`Reporte DIRCETUR generado en ${formato.toUpperCase()}`);
    };

    // Procesar datos para obtener una lista única de huéspedes
    const huespedes = reservas.reduce((acc, res) => {
        const key = res.huesped_dni || res.huesped_nombre;
        if (!acc[key]) {
            acc[key] = {
                nombre: res.huesped_nombre,
                dni: res.huesped_dni,
                telefono: res.huesped_telefono,
                procedencia: res.huesped_procedencia,
                totalEstancias: 0,
                totalGasto: 0,
                ultimaVisita: res.fecha_entrada,
                habitacionFavorita: res.habitacion_numero,
                tipoHabFavorita: res.habitacion_tipo,
                registradoDesde: res.created_date || res.fecha_entrada,
                email: 'No registrado', // No hay campo email en reservas según el esquema
                nacionalidad: res.huesped_procedencia || 'No registrada',
                nochesTotales: 0,
                reservas: []
            };
        }
        
        acc[key].totalEstancias += 1;
        acc[key].totalGasto += (res.total || 0);
        acc[key].nochesTotales += Number(res.noches || 0);
        acc[key].reservas.push(res);
        
        if (new Date(res.fecha_entrada) > new Date(acc[key].ultimaVisita)) {
            acc[key].ultimaVisita = res.fecha_entrada;
            acc[key].habitacionFavorita = res.habitacion_numero;
            acc[key].tipoHabFavorita = res.habitacion_tipo;
        }
        
        return acc;
    }, {});

    const listaHuespedes = Object.values(huespedes).filter(h => {
        const b = busqueda.toLowerCase();
        return (
            h.nombre?.toLowerCase().includes(b) ||
            h.dni?.toLowerCase().includes(b) ||
            h.procedencia?.toLowerCase().includes(b)
        );
    }).sort((a, b) => {
        if (orden === 'nombre') return a.nombre.localeCompare(b.nombre);
        if (orden === 'estancias') return b.totalEstancias - a.totalEstancias;
        return 0;
    });

    const gridRef = useGsapStaggerList([listaHuespedes.length, busqueda, orden], {
        stagger: 0.05,
        direction: 'y',
        distance: 12,
    });

    if (selectedHuesped) {
        const h = selectedHuesped;
        const initials = h.nombre.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
        
        return (
            <div className="space-y-6 pb-12">

                {/* Profile Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:bg-muted/50 rounded-md px-2 py-2 h-auto shadow-sm"
                            onClick={() => setSelectedHuesped(null)}
                        >
                            <ArrowLeft className="w-3.5 h-3.5" /> Volver
                        </Button>
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20 shadow-sm text-primary font-extrabold text-xl">
                            {initials}
                        </div>
                        <div>
                            <h1 className="text-2xl font-extrabold tracking-tighter text-foreground leading-none">{h.nombre}</h1>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1.5">Cliente desde {new Date(h.registradoDesde).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-6">
                    {/* Información de Contacto */}
                    <div className="enterprise-card p-5 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="p-1.5 bg-primary/10 rounded-md">
                                <UserIcon className="w-3.5 h-3.5 text-primary" />
                            </div>
                            <h3 className="font-extrabold text-base tracking-tight">Información de Contacto</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="space-y-1">
                                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                                    <Mail className="w-3 h-3" /> Email
                                </p>
                                <p className="font-extrabold text-foreground truncate text-xs">{h.email}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                                    <Phone className="w-3 h-3" /> Teléfono
                                </p>
                                <p className="font-extrabold text-foreground text-xs">{h.telefono || 'No registrado'}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                                    <CreditCard className="w-3 h-3" /> Documento
                                </p>
                                <p className="font-extrabold text-foreground text-xs">DNI {h.dni || 'N/A'}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                                    <MapPin className="w-3 h-3" /> Nacionalidad
                                </p>
                                <p className="font-extrabold text-foreground text-xs">{h.nacionalidad}</p>
                            </div>
                        </div>
                    </div>

                    {/* Estadísticas del Huésped */}
                    <div className="enterprise-card p-5 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="p-1.5 bg-primary/10 rounded-md">
                                <TrendingUp className="w-3.5 h-3.5 text-primary" />
                            </div>
                            <h3 className="font-extrabold text-base tracking-tight">Estadísticas de Actividad</h3>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="flex flex-col items-center text-center gap-3 bg-background/50 border border-border/40 p-3 rounded-lg shadow-xs hover:border-blue-500/30 transition-colors">
                                <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center border border-blue-500/20 shadow-sm">
                                    <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Estancias</p>
                                    <p className="text-2xl font-extrabold text-foreground tabular-nums tracking-tighter leading-none mt-1">{h.totalEstancias}</p>
                                </div>
                            </div>
                            <div className="flex flex-col items-center text-center gap-3 bg-background/50 border border-border/40 p-3 rounded-lg shadow-xs hover:border-green-500/30 transition-colors">
                                <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center border border-green-500/20 shadow-sm">
                                    <DollarSign className="w-4 h-4 text-green-600 dark:text-green-400" />
                                </div>
                                <div>
                                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Gastado</p>
                                    <p className="text-2xl font-extrabold text-foreground tabular-nums tracking-tighter leading-none mt-1">S/ {h.totalGasto}</p>
                                </div>
                            </div>
                            <div className="flex flex-col items-center text-center gap-3 bg-background/50 border border-border/40 p-3 rounded-lg shadow-xs hover:border-amber-500/30 transition-colors">
                                <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center border border-amber-500/20 shadow-sm">
                                    <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                </div>
                                <div>
                                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Noches Prom.</p>
                                    <p className="text-2xl font-extrabold text-foreground tabular-nums tracking-tighter leading-none mt-1">{(h.nochesTotales / h.totalEstancias).toFixed(1)}</p>
                                </div>
                            </div>
                            <div className="flex flex-col items-center text-center gap-3 bg-background/50 border border-border/40 p-3 rounded-lg shadow-xs hover:border-purple-500/30 transition-colors">
                                <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center border border-purple-500/20 shadow-sm">
                                    <Star className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                </div>
                                <div>
                                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Hab. Fav.</p>
                                    <p className="text-base font-extrabold text-foreground truncate max-w-[120px] mt-1 leading-none">{h.tipoHabFavorita || 'N/A'}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Historial de Estancias */}
                    <div className="enterprise-card p-5 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="p-1.5 bg-primary/10 rounded-md">
                                <History className="w-3.5 h-3.5 text-primary" />
                            </div>
                            <h3 className="font-extrabold text-base tracking-tight">Historial de Estancias <span className="text-muted-foreground font-semibold text-xs ml-1">({h.reservas.length})</span></h3>
                        </div>
                        <div className="space-y-2.5">
                            {h.reservas.sort((a, b) => new Date(b.fecha_entrada) - new Date(a.fecha_entrada)).map((res, i) => (
                                <div key={i} className="flex items-center justify-between p-3 bg-background/50 rounded-lg border border-border/40 hover:bg-muted/50 hover:border-border/60 transition-all shadow-xs group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-1 h-8 bg-primary/30 group-hover:bg-primary/70 rounded-full transition-colors" />
                                        <div>
                                            <p className="font-extrabold text-xs text-foreground">{res.fecha_entrada} — {res.fecha_salida}</p>
                                            <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase mt-0.5">Habitación #{res.habitacion_numero} • {res.habitacion_tipo}</p>
                                        </div>
                                    </div>
                                    <span className={cn(
                                        "text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded border shadow-xs",
                                        res.estado === 'finalizada' ? "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20" :
                                        res.estado === 'activa' ? "bg-primary/10 text-primary border-primary/20" :
                                        "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20"
                                    )}>
                                        {res.estado}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-12">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20 shadow-sm">
                            <Users className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tighter leading-none">Huéspedes</h1>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1.5">
                                Directorio y gestión de clientes
                            </p>
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center justify-center sm:justify-end gap-3">
                    <div className="enterprise-card px-4 py-2 rounded-xl shadow-sm text-right flex flex-col justify-center">
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Total Registrados</p>
                        <p className="text-2xl font-extrabold text-primary leading-none tabular-nums tracking-tighter">{listaHuespedes.length} <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Pers.</span></p>
                    </div>
                </div>
            </div>

            {/* Pestañas (CRM) */}
            <div className="flex items-center gap-2 border-b border-border/50 pb-px overflow-x-auto">
                <Button 
                    variant="ghost" 
                    className={cn("rounded-none border-b-2 px-4 py-2 h-10 text-xs font-bold uppercase tracking-widest transition-all", activeTab === 'directorio' ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
                    onClick={() => setActiveTab('directorio')}
                >
                    Directorio
                </Button>
                <Button 
                    variant="ghost" 
                    className={cn("rounded-none border-b-2 px-4 py-2 h-10 text-xs font-bold uppercase tracking-widest transition-all", activeTab === 'segmentos' ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
                    onClick={() => setActiveTab('segmentos')}
                >
                    Segmentos
                </Button>
                <Button 
                    variant="ghost" 
                    className={cn("rounded-none border-b-2 px-4 py-2 h-10 text-xs font-bold uppercase tracking-widest transition-all", activeTab === 'campanas' ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
                    onClick={() => setActiveTab('campanas')}
                >
                    Campañas
                </Button>
                <Button 
                    variant="ghost" 
                    className={cn("rounded-none border-b-2 px-4 py-2 h-10 text-xs font-bold uppercase tracking-widest transition-all", activeTab === 'plantillas' ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
                    onClick={() => setActiveTab('plantillas')}
                >
                    Plantillas
                </Button>
            </div>

            {activeTab === 'directorio' && (
                <>
                    {/* Controls Section */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-8 relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input 
                        placeholder="Buscar por nombre, DNI o procedencia..." 
                        className="pl-9 h-9 bg-card border-border/80 rounded-md text-xs font-semibold focus-visible:ring-primary/30 focus-visible:border-primary/50 shadow-sm transition-all"
                        value={busqueda}
                        onChange={e => setBusqueda(e.target.value)}
                    />
                </div>
                <div className="md:col-span-4 flex gap-2">
                    <Button 
                        variant="outline" 
                        className={cn(
                            "flex-1 h-9 rounded-md gap-2 text-[10px] uppercase tracking-widest font-bold transition-all border-border/40 shadow-sm active:scale-95",
                            orden === 'nombre' ? "bg-primary text-primary-foreground border-primary" : "bg-card/40 text-muted-foreground hover:bg-muted"
                        )}
                        onClick={() => setOrden('nombre')}
                    >
                        <ArrowUpDown className="w-3.5 h-3.5" /> A-Z
                    </Button>
                    <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
                        <DialogTrigger asChild>
                            <Button 
                                variant="outline" 
                                className="flex-1 h-9 rounded-md gap-2 text-[10px] uppercase tracking-widest font-bold transition-all border-border/40 bg-card/40 text-muted-foreground shadow-sm hover:bg-primary/10 hover:text-primary hover:border-primary/30 active:scale-95"
                            >
                                <FileText className="w-3.5 h-3.5" /> DIRCETUR
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>Reporte DIRCETUR</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="space-y-2">
                                    <Label>Agrupar por</Label>
                                    <Select value={periodoExport} onValueChange={setPeriodoExport}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccionar..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="dia">Por Día</SelectItem>
                                            <SelectItem value="mes">Por Mes</SelectItem>
                                            <SelectItem value="año">Por Año</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Fecha Referencia</Label>
                                    <Input 
                                        type={periodoExport === 'año' ? "number" : periodoExport === 'mes' ? "month" : "date"} 
                                        value={fechaExport}
                                        onChange={(e) => setFechaExport(e.target.value)}
                                        className=""
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setExportDialogOpen(false)} className="">Cancelar</Button>
                                <Button onClick={() => exportarDircetur('pdf')} variant="secondary" className="gap-2"><FileText className="w-4 h-4" /> PDF</Button>
                                <Button onClick={() => exportarDircetur('excel')} className="gap-2"><Download className="w-4 h-4" /> Excel</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* List Section */}
            {isLoading ? (
                <PageSkeleton variant="huespedes" />
            ) : (
                <div ref={gridRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {listaHuespedes.map((h) => (
                            <div
                                key={h.dni || h.nombre}
                                onClick={() => setSelectedHuesped(h)}
                                className="enterprise-card p-5 group hover:shadow-md hover:-translate-y-1 transition-all duration-300 overflow-hidden relative cursor-pointer shadow-sm flex flex-col"
                            >
                                {/* Background Accent */}
                                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-primary/10 transition-colors" />

                                <div className="flex gap-3 relative z-10">
                                    {/* Avatar Column */}
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20 shadow-sm group-hover:scale-105 transition-transform duration-300">
                                            <span className="text-primary font-bold text-base">{h.nombre.substring(0, 1).toUpperCase()}</span>
                                        </div>
                                        <div className="bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
                                            <p className="text-[8px] font-black text-primary uppercase tracking-widest">{h.totalEstancias} {h.totalEstancias === 1 ? 'Visita' : 'Visitas'}</p>
                                        </div>
                                    </div>

                                    <div className="flex-1 space-y-3">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <h3 className="text-base font-extrabold text-foreground group-hover:text-primary transition-colors tracking-tight leading-tight">{h.nombre}</h3>
                                                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                                                    <span className="text-[9px] font-bold tracking-widest uppercase text-muted-foreground flex items-center gap-1">
                                                        <CreditCard className="w-3 h-3" /> {h.dni || 'S/D'}
                                                    </span>
                                                    <span className="text-[9px] font-bold tracking-widest uppercase text-muted-foreground flex items-center gap-1">
                                                        <MapPin className="w-3 h-3" /> {h.procedencia || 'N/E'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="p-1.5 rounded-md bg-card/60 border border-border/40 shadow-xs text-muted-foreground group-hover:text-primary group-hover:border-primary/40 group-hover:bg-primary/10 transition-all">
                                                <Eye className="w-3.5 h-3.5" />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-border/40">
                                            <div className="space-y-1">
                                                <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">Última Visita</p>
                                                <div className="flex items-center gap-1.5 text-foreground">
                                                    <Calendar className="w-3 h-3 text-primary" />
                                                    <span className="text-[11px] font-extrabold">{h.ultimaVisita}</span>
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">Hab. Pref.</p>
                                                <div className="flex items-center gap-1.5 text-foreground">
                                                    <div className="w-3.5 h-3.5 bg-primary/10 rounded border border-primary/20 flex items-center justify-center shadow-xs">
                                                        <span className="text-[8px] font-black text-primary">#</span>
                                                    </div>
                                                    <span className="text-[11px] font-extrabold tabular-nums">{h.habitacionFavorita || 'N/A'}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between pt-2.5">
                                            <div className="flex items-center gap-1.5 text-muted-foreground">
                                                <Phone className="w-3 h-3" />
                                                <span className="text-[10px] font-bold tracking-wider">{h.telefono || 'S/T'}</span>
                                            </div>
                                            <div className="bg-green-500/10 px-1.5 py-0.5 rounded border border-green-500/20 shadow-xs">
                                                <span className="text-[10px] font-extrabold text-green-600 dark:text-green-400 tabular-nums">S/ {h.totalGasto}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                </div>
            )}


            {/* Empty State */}
            {!isLoading && listaHuespedes.length === 0 && (
                <div className="text-center py-16 bg-card border border-dashed border-border rounded-2xl flex flex-col items-center justify-center shadow-sm">
                    <div className="w-12 h-12 bg-muted/30 rounded-xl flex items-center justify-center mb-4 border border-border/50 shadow-sm text-muted-foreground">
                        <Users className="w-6 h-6" />
                    </div>
                    <p className="text-lg font-extrabold text-foreground tracking-tight">No se encontraron huéspedes</p>
                    <p className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mt-1.5 max-w-sm">Intenta ajustando los filtros o la búsqueda.</p>
                </div>
            )}
                </>
            )}

            {activeTab === 'segmentos' && (
                <div className="enterprise-card p-10 text-center space-y-4 shadow-sm border-dashed">
                    <div className="w-16 h-16 bg-primary/10 rounded-2xl mx-auto flex items-center justify-center border border-primary/20">
                        <Users className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                        <h3 className="font-extrabold text-lg text-foreground">Segmentación de Huéspedes</h3>
                        <p className="text-muted-foreground text-sm max-w-md mx-auto mt-2">
                            Crea grupos de clientes (Ej: VIPs, Frecuentes, Familias) para enviarles campañas específicas.
                        </p>
                    </div>
                    <Button className="mt-4 text-xs font-bold uppercase tracking-widest">Crear Segmento</Button>
                </div>
            )}

            {activeTab === 'campanas' && (
                <div className="enterprise-card p-10 text-center space-y-4 shadow-sm border-dashed">
                    <div className="w-16 h-16 bg-primary/10 rounded-2xl mx-auto flex items-center justify-center border border-primary/20">
                        <Mail className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                        <h3 className="font-extrabold text-lg text-foreground">Campañas Automáticas</h3>
                        <p className="text-muted-foreground text-sm max-w-md mx-auto mt-2">
                            Envía correos masivos a tus segmentos (Promociones, Ofertas de temporada, Recordatorios).
                        </p>
                    </div>
                    <Button className="mt-4 text-xs font-bold uppercase tracking-widest">Nueva Campaña</Button>
                </div>
            )}

            {activeTab === 'plantillas' && (
                <div className="enterprise-card p-10 text-center space-y-4 shadow-sm border-dashed">
                    <div className="w-16 h-16 bg-primary/10 rounded-2xl mx-auto flex items-center justify-center border border-primary/20">
                        <FileText className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                        <h3 className="font-extrabold text-lg text-foreground">Plantillas de Correo y WhatsApp</h3>
                        <p className="text-muted-foreground text-sm max-w-md mx-auto mt-2">
                            Diseña los correos electrónicos o mensajes de WhatsApp que enviarás en tus campañas.
                        </p>
                    </div>
                    <Button className="mt-4 text-xs font-bold uppercase tracking-widest">Crear Plantilla</Button>
                </div>
            )}
        </div>
    );
});
Huespedes.displayName = 'Huespedes';
export default Huespedes;
