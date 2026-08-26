import { memo } from 'react';
import { 
    Users, Search, Phone, MapPin, Calendar, 
    CreditCard,
    ArrowUpDown, Eye, Mail, FileText, Download
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useGsapStaggerList } from '@/hooks/useGsapStaggerList';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import PageSkeleton from '@/components/loaders/PageSkeleton';
import { HuespedProfile } from './Huespedes/components/HuespedProfile';
import { exportarDircetur } from './Huespedes/services/dircetur.service';
import { useHuespedesData } from './Huespedes/hooks/useHuespedesData';

const Huespedes = memo(function Huespedes() {
    const {
        busqueda, setBusqueda,
        orden, setOrden,
        activeTab, setActiveTab,
        selectedHuesped, setSelectedHuesped,
        exportDialogOpen, setExportDialogOpen,
        periodoExport, setPeriodoExport,
        fechaExport, setFechaExport,
        reservas,
        isLoading,
        listaHuespedes
    } = useHuespedesData();

    const gridRef = useGsapStaggerList([listaHuespedes.length, busqueda, orden], {
        stagger: 0.05,
        direction: 'y',
        distance: 12,
    });

    if (selectedHuesped) {
        return (
            <HuespedProfile 
                huesped={selectedHuesped} 
                onBack={() => setSelectedHuesped(null)} 
            />
        );
    }

    return (
        <div className="page-shell">
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
                                <Button onClick={() => exportarDircetur(reservas, 'pdf', /** @type {any} */ (periodoExport), fechaExport)} variant="secondary" className="gap-2"><FileText className="w-4 h-4" /> PDF</Button>
                                <Button onClick={() => exportarDircetur(reservas, 'excel', /** @type {any} */ (periodoExport), fechaExport)} className="gap-2"><Download className="w-4 h-4" /> CSV</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* List Section */}
            {isLoading ? (
                <PageSkeleton variant="huespedes" />
            ) : (
                <div ref={gridRef} className="ui-card-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                        {listaHuespedes.map((h) => (
                            <div
                                key={h.dni || h.nombre}
                                onClick={() => setSelectedHuesped(h)}
                                className="enterprise-card operational-card ui-card-pad group relative flex cursor-pointer flex-col overflow-hidden shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
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
                <div className="enterprise-card section-card ui-card-pad space-y-4 border-dashed text-center shadow-sm">
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
                <div className="enterprise-card section-card ui-card-pad space-y-4 border-dashed text-center shadow-sm">
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
                <div className="enterprise-card section-card ui-card-pad space-y-4 border-dashed text-center shadow-sm">
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
