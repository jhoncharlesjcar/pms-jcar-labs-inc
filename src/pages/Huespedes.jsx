import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
    Users, Search, Phone, MapPin, Calendar, 
    CreditCard, User as UserIcon, TrendingUp,
    Filter, ArrowUpDown, ChevronRight, Eye,
    ArrowLeft, Mail, Star, History, Info,
    Clock, BedDouble, DollarSign
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useHotelData } from '@/hooks/use-hotel-data';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export default function Huespedes() {
    const { db: hotelDb, hotelId } = useHotelData();
    const [busqueda, setBusqueda] = useState('');
    const [orden, setOrden] = useState('nombre');
    const [selectedHuesped, setSelectedHuesped] = useState(null);

    const { data: reservas = [], isLoading } = useQuery({
        queryKey: ['reservas-huespedes', hotelId],
        queryFn: () => hotelDb.Reserva.list(),
        enabled: !!hotelId,
    });

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

    if (selectedHuesped) {
        const h = selectedHuesped;
        const initials = h.nombre.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
        
        return (
            <motion.div 
                initial={{ opacity: 0, x: 20 }} 
                animate={{ opacity: 1, x: 0 }} 
                className="space-y-8 pb-12"
            >
                {/* Profile Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <div className="flex items-center gap-6">
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="gap-2 text-muted-foreground hover:text-foreground p-0"
                            onClick={() => setSelectedHuesped(null)}
                        >
                            <ArrowLeft className="w-4 h-4" /> volver
                        </Button>
                        <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center border border-primary/30 shadow-lg text-primary font-black text-xl">
                            {initials}
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-foreground leading-tight">{h.nombre}</h1>
                            <p className="text-sm text-muted-foreground font-medium">Cliente desde {new Date(h.registradoDesde).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-6">
                    {/* Información de Contacto */}
                    <div className="bg-card/60 backdrop-blur-xl rounded-[2.5rem] border border-border/50 p-8">
                        <div className="flex items-center gap-2 mb-6">
                            <UserIcon className="w-5 h-5 text-primary" />
                            <h3 className="font-bold text-lg">Información de Contacto</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                            <div className="space-y-1">
                                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                    <Mail className="w-3 h-3" /> Email
                                </p>
                                <p className="font-bold text-foreground truncate">{h.email}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                    <Phone className="w-3 h-3" /> Teléfono
                                </p>
                                <p className="font-bold text-foreground">{h.telefono || 'No registrado'}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                    <CreditCard className="w-3 h-3" /> Documento
                                </p>
                                <p className="font-bold text-foreground">DNI {h.dni || 'N/A'}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                    <MapPin className="w-3 h-3" /> Nacionalidad
                                </p>
                                <p className="font-bold text-foreground">{h.nacionalidad}</p>
                            </div>
                        </div>
                    </div>

                    {/* Estadísticas del Huésped */}
                    <div className="bg-card/60 backdrop-blur-xl rounded-[2.5rem] border border-border/50 p-8">
                        <div className="flex items-center gap-2 mb-8">
                            <TrendingUp className="w-5 h-5 text-primary" />
                            <h3 className="font-bold text-lg">Estadísticas del Huésped</h3>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                            <div className="flex flex-col items-center text-center gap-3">
                                <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20">
                                    <Calendar className="w-6 h-6 text-blue-500" />
                                </div>
                                <div>
                                    <p className="text-2xl font-black text-foreground">{h.totalEstancias}</p>
                                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1">Estancias</p>
                                </div>
                            </div>
                            <div className="flex flex-col items-center text-center gap-3">
                                <div className="w-12 h-12 bg-green-500/10 rounded-2xl flex items-center justify-center border border-green-500/20">
                                    <DollarSign className="w-6 h-6 text-green-500" />
                                </div>
                                <div>
                                    <p className="text-2xl font-black text-foreground">S/ {h.totalGasto}</p>
                                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1">Total Gastado</p>
                                </div>
                            </div>
                            <div className="flex flex-col items-center text-center gap-3">
                                <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/20">
                                    <Clock className="w-6 h-6 text-amber-500" />
                                </div>
                                <div>
                                    <p className="text-2xl font-black text-foreground">{(h.nochesTotales / h.totalEstancias).toFixed(1)}</p>
                                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1">Noches Promedio</p>
                                </div>
                            </div>
                            <div className="flex flex-col items-center text-center gap-3">
                                <div className="w-12 h-12 bg-purple-500/10 rounded-2xl flex items-center justify-center border border-purple-500/20">
                                    <Star className="w-6 h-6 text-purple-500" />
                                </div>
                                <div>
                                    <p className="text-xl font-black text-foreground truncate max-w-[120px]">{h.tipoHabFavorita || 'N/A'}</p>
                                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1">Hab. Favorita</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Historial de Estancias */}
                    <div className="bg-card/60 backdrop-blur-xl rounded-[2.5rem] border border-border/50 p-8">
                        <div className="flex items-center gap-2 mb-6">
                            <History className="w-5 h-5 text-primary" />
                            <h3 className="font-bold text-lg">Historial de Estancias ({h.reservas.length})</h3>
                        </div>
                        <div className="space-y-4">
                            {h.reservas.sort((a, b) => new Date(b.fecha_entrada) - new Date(a.fecha_entrada)).map((res, i) => (
                                <div key={i} className="flex items-center justify-between p-5 bg-secondary/20 rounded-2xl border border-border/30 hover:bg-secondary/40 transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="w-1 h-8 bg-primary/30 rounded-full" />
                                        <div>
                                            <p className="font-bold text-foreground">{res.fecha_entrada} - {res.fecha_salida}</p>
                                            <p className="text-xs text-muted-foreground font-medium">Hab. {res.habitacion_numero} ({res.habitacion_tipo})</p>
                                        </div>
                                    </div>
                                    <span className={cn(
                                        "text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border",
                                        res.estado === 'finalizada' ? "bg-green-500/10 text-green-500 border-green-500/20" :
                                        res.estado === 'activa' ? "bg-primary/10 text-primary border-primary/20" :
                                        "bg-orange-500/10 text-orange-500 border-orange-500/20"
                                    )}>
                                        {res.estado}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="space-y-8 pb-12"
        >
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6">
                <div className="text-center sm:text-left">
                    <h1 className="font-display text-2xl sm:text-4xl font-black text-foreground tracking-tight">
                        Directorio de <span className="text-primary italic">Huéspedes</span>
                    </h1>
                    <p className="text-muted-foreground mt-1 text-xs sm:text-base font-medium flex items-center justify-center sm:justify-start gap-2">
                        <Users className="w-3.5 h-3.5" />
                        Gestiona y conoce mejor a tus clientes recurrentes
                    </p>
                </div>
                
                <div className="flex items-center justify-center sm:justify-end gap-3">
                    <div className="bg-primary/10 border border-primary/20 px-4 sm:px-6 py-2 sm:py-3 rounded-xl sm:rounded-2xl">
                        <p className="text-[8px] sm:text-[10px] font-black text-primary uppercase tracking-widest leading-none mb-1">Total Base de Datos</p>
                        <p className="text-lg sm:text-2xl font-black text-foreground leading-none">{listaHuespedes.length} <span className="text-[10px] sm:text-sm font-bold text-muted-foreground">Pers.</span></p>
                    </div>
                </div>
            </div>

            {/* Controls Section */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4">
                <div className="md:col-span-8 relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input 
                        placeholder="Buscar por nombre, DNI o procedencia..." 
                        className="pl-11 sm:pl-12 h-12 sm:h-14 bg-card/40 backdrop-blur-md border-border/50 rounded-xl sm:rounded-[1.25rem] text-sm sm:text-base focus-visible:ring-primary/20"
                        value={busqueda}
                        onChange={e => setBusqueda(e.target.value)}
                    />
                </div>
                <div className="md:col-span-4 flex gap-2">
                    <Button 
                        variant="outline" 
                        className={cn(
                            "flex-1 h-12 sm:h-14 rounded-xl sm:rounded-[1.25rem] gap-2 text-xs sm:text-sm font-bold transition-all border-border/50",
                            orden === 'nombre' ? "bg-primary/10 border-primary/30 text-primary" : "bg-card/40"
                        )}
                        onClick={() => setOrden('nombre')}
                    >
                        <ArrowUpDown className="w-4 h-4" /> A-Z
                    </Button>
                    <Button 
                        variant="outline" 
                        className={cn(
                            "flex-1 h-12 sm:h-14 rounded-xl sm:rounded-[1.25rem] gap-2 text-xs sm:text-sm font-bold transition-all border-border/50",
                            orden === 'estancias' ? "bg-primary/10 border-primary/30 text-primary" : "bg-card/40"
                        )}
                        onClick={() => setOrden('estancias')}
                    >
                        <TrendingUp className="w-4 h-4" /> VIP
                    </Button>
                </div>
            </div>

            {/* List Section */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-32 gap-4">
                    <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                    <p className="font-bold text-muted-foreground animate-pulse">Sincronizando directorio...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    <AnimatePresence mode="popLayout">
                        {listaHuespedes.map((h, idx) => (
                            <motion.div
                                layout
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ delay: idx * 0.05 }}
                                key={h.dni || h.nombre}
                                onClick={() => setSelectedHuesped(h)}
                                className="bg-card/60 backdrop-blur-2xl rounded-[2rem] border border-border/50 p-4 group hover:border-primary/30 transition-all duration-500 overflow-hidden relative cursor-pointer"
                            >
                                {/* Background Accent */}
                                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-primary/10 transition-colors" />

                                <div className="flex gap-4 relative z-10">
                                    {/* Avatar Column */}
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20 shadow-xl group-hover:scale-105 transition-transform duration-500">
                                            <UserIcon className="w-7 h-7 text-primary" />
                                        </div>
                                        <div className="bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                                            <p className="text-[8px] font-black text-primary uppercase">{h.totalEstancias} {h.totalEstancias === 1 ? 'Visita' : 'Visitas'}</p>
                                        </div>
                                    </div>

                                    <div className="flex-1 space-y-3">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <h3 className="text-lg font-black text-foreground group-hover:text-primary transition-colors">{h.nombre}</h3>
                                                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                                                    <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                                        <CreditCard className="w-3 h-3" /> {h.dni || 'S/D'}
                                                    </span>
                                                    <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                                        <MapPin className="w-3 h-3" /> {h.procedencia || 'N/E'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="p-1.5 rounded-lg bg-secondary/30 border border-border/50 text-muted-foreground group-hover:text-primary group-hover:border-primary/30 transition-all">
                                                <Eye className="w-4 h-4" />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/50">
                                            <div className="space-y-0.5">
                                                <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Última Visita</p>
                                                <div className="flex items-center gap-1.5 text-foreground">
                                                    <Calendar className="w-3.5 h-3.5 text-primary" />
                                                    <span className="text-xs font-bold">{h.ultimaVisita}</span>
                                                </div>
                                            </div>
                                            <div className="space-y-0.5">
                                                <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Hab. Pref.</p>
                                                <div className="flex items-center gap-1.5 text-foreground">
                                                    <div className="w-3.5 h-3.5 bg-primary/20 rounded flex items-center justify-center">
                                                        <span className="text-[7px] font-black text-primary">#</span>
                                                    </div>
                                                    <span className="text-xs font-bold">#{h.habitacionFavorita || 'N/A'}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between pt-3">
                                            <div className="flex items-center gap-1.5">
                                                <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                                                <span className="text-xs font-medium">{h.telefono || 'S/T'}</span>
                                            </div>
                                            <div className="bg-secondary/30 px-3 py-1.5 rounded-lg border border-border/50">
                                                <span className="text-[10px] font-black text-foreground">S/ {h.totalGasto}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}

            {/* Empty State */}
            {!isLoading && listaHuespedes.length === 0 && (
                <div className="text-center py-40 bg-card/20 backdrop-blur-sm rounded-[3rem] border border-dashed border-border/50">
                    <div className="w-20 h-20 bg-secondary/30 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                        <Users className="w-10 h-10 text-muted-foreground/30" />
                    </div>
                    <h3 className="text-xl font-black text-foreground">No se encontraron huéspedes</h3>
                    <p className="text-muted-foreground mt-2 font-medium">Intenta ajustando los filtros o el término de búsqueda</p>
                </div>
            )}
        </motion.div>
    );
}
