import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/db';
import { useAuth } from '@/lib/AuthContext';
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

export default function PanelDesarrollador() {
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
        <div className="space-y-6">
            <div className="flex items-center gap-3 flex-wrap">
                <div className="w-11 h-11 bg-amber-500 rounded-xl flex items-center justify-center shadow-lg">
                    <Code2 className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h1 className="font-display text-2xl font-bold text-foreground">Panel de Desarrollador</h1>
                    <p className="text-sm text-muted-foreground">Control total del sistema · Multi-Tenant ANGELICA FREY</p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <span className="bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1.5 rounded-full border border-amber-300">🔧 DEV MODE</span>
                    <span className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1.5 rounded-full border border-green-300">v{sysConfig.version}</span>
                </div>
            </div>

            <DevStats stats={statsGlobales} />

            <div className="flex gap-1 border-b border-border overflow-x-auto">
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                        className={cn("flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px whitespace-nowrap",
                            tab === t.id ? "border-amber-500 text-amber-600" : "border-transparent text-muted-foreground hover:text-foreground")}>
                        <t.icon className="w-4 h-4" />{t.label}
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
                {tab === 'sistema' && <SystemInfo version={sysConfig.version} hotelesCount={hoteles.length} />}
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
}