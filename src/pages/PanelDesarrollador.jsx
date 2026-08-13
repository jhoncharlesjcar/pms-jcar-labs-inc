import { useState, memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/db';
import { useAuth } from '@/contexts/AuthContext';
import { Code2, Building2, Users, Settings, Activity, ShieldAlert, Key } from 'lucide-react';
import { cn } from '@/lib/utils';

// Componentes descompuestos
import DevStats from '@/components/dev/DevStats';
import HotelManager from '@/components/dev/HotelManager';
import StaffManager from '@/components/dev/StaffManager';
import GeneradorCodigos from '@/components/dev/GeneradorCodigos';
import SystemInfo from '@/components/dev/SystemInfo';
import AuditCenter from '@/components/dev/AuditCenter';

const TABS = [
    { id: 'hoteles', label: 'Hoteles', icon: Building2 },
    { id: 'usuarios', label: 'Staff & Usuarios', icon: Users },
    { id: 'codigos', label: 'Códigos', icon: Key },
    { id: 'sistema', label: 'Sistema', icon: Settings },
    { id: 'auditoria', label: 'Auditoría', icon: Activity },
];

const PanelDesarrollador = memo(function PanelDesarrollador() {
    const { user } = useAuth();
    const [tab, setTab] = useState('hoteles');
    const [sysConfig] = useState({ mantenimiento: false, debug_mode: false, version: '2.1.0' });

    // Queries globales para el panel
    const { data: hoteles = [], isLoading: loadHoteles } = useQuery({ queryKey: ['hoteles'], queryFn: () => db.entities.Hotel.list() });
    const { data: usuarios = [] } = useQuery({ queryKey: ['usuarios'], queryFn: () => db.entities.User.list() });
    const { data: reservas = [] } = useQuery({ queryKey: ['reservas'], queryFn: () => db.entities.Reserva.list() });
    const { data: ventas = [] } = useQuery({ queryKey: ['ventas'], queryFn: () => db.entities.Venta.list('-created_date', 100) });
    const { data: ventasPOS = [] } = useQuery({ queryKey: ['ventaspos'], queryFn: () => db.entities.VentaPOS.list() });
    const { data: habitaciones = [] } = useQuery({ queryKey: ['habitaciones'], queryFn: () => db.entities.Habitacion.list() });

    if (user && user.role !== 'developer') {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
                <ShieldAlert className="w-16 h-16 text-destructive/40" />
                <h2 className="font-display text-2xl font-bold text-foreground">Acceso Restringido</h2>
                <p className="text-muted-foreground max-w-sm">Solo los <strong>Developers</strong> pueden acceder al Panel de Desarrollador.</p>
            </div>
        );
    }

    const todasVentas = [...ventas, ...ventasPOS];

    const statsGlobales = {
        totalHoteles: hoteles.length,
        totalUsuarios: usuarios.length,
        totalReservas: reservas.length,
        reservasActivas: reservas.filter(r => r.estado === 'activa').length,
        totalVentas: todasVentas.reduce((s, v) => s + Number(v.total || 0), 0),
    };

    return (
        <div className="space-y-5">
            <div className="flex items-center gap-3 flex-wrap bg-card/40 backdrop-blur-xl p-5 rounded-xl border border-border/40 shadow-sm">
                <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center shadow-lg flex-shrink-0">
                    <Code2 className="w-4 h-4 text-white" />
                </div>
                <div>
                    <h1 className="font-extrabold text-xl text-foreground tracking-tight">Panel de Desarrollador</h1>
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-0.5">Control total del sistema · Multi-Tenant PMS JCAR LABS</p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <span className="bg-amber-100 text-amber-700 text-[9px] uppercase tracking-widest font-extrabold px-2 py-1 rounded-sm border border-amber-300">🔧 DEV MODE</span>
                    <span className="bg-green-100 text-green-700 text-[9px] uppercase tracking-widest font-extrabold px-2 py-1 rounded-sm border border-green-300">v{sysConfig.version}</span>
                </div>
            </div>

            <DevStats stats={statsGlobales} />

            <div className="flex gap-1 border-b border-border/40 overflow-x-auto no-scrollbar pb-px">
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                        className={cn("flex items-center gap-2 px-3 py-2 text-[10px] font-black uppercase tracking-widest border-b-2 transition-[transform,opacity] -mb-px whitespace-nowrap",
                            tab === t.id ? "border-amber-500 text-amber-600 dark:text-amber-500" : "border-transparent text-muted-foreground hover:text-foreground hover:bg-foreground/5 rounded-t-md")}>
                        <t.icon className="w-3.5 h-3.5" />{t.label}
                    </button>
                ))}
            </div>

            {/* Renderizado de Tabs */}
            <div className="mt-4">
                {tab === 'hoteles' && (
                    <HotelManager 
                        hoteles={hoteles} 
                        habitaciones={habitaciones} 
                        reservas={reservas} 
                        ventas={todasVentas} 
                        usuarios={usuarios}
                        isLoading={loadHoteles} 
                    />
                )}
                {tab === 'usuarios' && <StaffManager usuarios={usuarios} hoteles={hoteles} />}
                {tab === 'codigos' && <GeneradorCodigos />}
                {tab === 'sistema' && <SystemInfo version={sysConfig.version} hoteles={hoteles} hotelesCount={hoteles.length} />}
                {tab === 'auditoria' && (
                    <AuditCenter 
                        hoteles={hoteles} 
                        habitaciones={habitaciones} 
                        reservas={reservas} 
                        ventas={todasVentas} 
                        usuarios={usuarios} 
                    />
                )}
            </div>
        </div>
    );
});
PanelDesarrollador.displayName = 'PanelDesarrollador';
export default PanelDesarrollador;