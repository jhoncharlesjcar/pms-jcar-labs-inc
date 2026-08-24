import React, { memo } from 'react';
import { Button } from '@/components/ui/button';
import { 
    ArrowLeft, UserIcon, Mail, Phone, CreditCard, MapPin, 
    TrendingUp, Calendar, DollarSign, Clock, Star, History 
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const HuespedProfile = memo(function HuespedProfile(/** @type {any} */ { huesped: h, onBack }) {
    if (!h) return null;
    const initials = h.nombre.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

    return (
        <div className="page-shell">
            {/* Profile Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:bg-muted/50 rounded-md px-2 py-2 h-auto shadow-sm"
                        onClick={onBack}
                    >
                        <ArrowLeft className="w-3.5 h-3.5" /> Volver
                    </Button>
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20 shadow-sm text-primary font-extrabold text-xl">
                        {initials}
                    </div>
                    <div>
                        <h1 className="text-2xl font-extrabold tracking-tighter text-foreground leading-none">{h.nombre}</h1>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1.5">
                            Cliente desde {new Date(h.registradoDesde).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {/* Información de Contacto */}
                <div className="enterprise-card section-card ui-card-pad shadow-sm">
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
                <div className="enterprise-card section-card ui-card-pad shadow-sm">
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
                <div className="enterprise-card section-card ui-card-pad shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="p-1.5 bg-primary/10 rounded-md">
                            <History className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <h3 className="font-extrabold text-base tracking-tight">
                            Historial de Estancias <span className="text-muted-foreground font-semibold text-xs ml-1">({h.reservas.length})</span>
                        </h3>
                    </div>
                    <div className="space-y-2.5">
                        {h.reservas.sort((a, b) => new Date(b.fecha_entrada).getTime() - new Date(a.fecha_entrada).getTime()).map((res, i) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-background/50 rounded-lg border border-border/40 hover:bg-muted/50 hover:border-border/60 transition-all shadow-xs group">
                                <div className="flex items-center gap-3">
                                    <div className="w-1 h-8 bg-primary/30 group-hover:bg-primary/70 rounded-full transition-colors" />
                                    <div>
                                        <p className="font-extrabold text-xs text-foreground">{res.fecha_entrada} — {res.fecha_salida}</p>
                                        <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase mt-0.5">
                                            Habitación #{res.habitacion_numero} • {res.habitacion_tipo}
                                        </p>
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
});
