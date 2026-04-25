import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import {
    Code2, Building2, Users, Settings, Activity, Plus, Pencil, Trash2,
    ToggleLeft, ToggleRight, Mail, ShieldAlert, UserPlus, Check,
    RefreshCw, Eye, BedDouble, Receipt, TrendingUp, AlertCircle,
    Clock, Wifi, Database, Server, Zap, Save, ExternalLink, CheckCircle, Key
} from 'lucide-react';
import GeneradorCodigos from '@/components/dev/GeneradorCodigos';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const TABS = [
    { id: 'hoteles', label: 'Hoteles', icon: Building2 },
    { id: 'usuarios', label: 'Staff & Usuarios', icon: Users },
    { id: 'codigos', label: 'Códigos', icon: Key },
    { id: 'sistema', label: 'Sistema', icon: Settings },
    { id: 'auditoria', label: 'Auditoría', icon: Activity },
];

const ROLES = [
    { value: 'developer', label: '🔧 Developer', desc: 'Acceso total + Panel Dev' },
    { value: 'admin', label: '👑 Admin', desc: 'Gestión completa del hotel' },
    { value: 'recepcionista', label: '🛎️ Recepcionista', desc: 'Recepción, reservas y ventas' },
];

const emptyHotel = {
    nombre: '', ruc: '', direccion: '', ciudad: '', telefono: '',
    email: '', hora_checkin: '14:00', hora_checkout: '12:00', activo: true, notas: ''
};

export default function PanelDesarrollador() {
    const { user } = useAuth();
    const qc = useQueryClient();
    const [tab, setTab] = useState('hoteles');

    const [hotelModal, setHotelModal] = useState(false);
    const [editHotel, setEditHotel] = useState(null);
    const [hotelForm, setHotelForm] = useState(emptyHotel);
    const [hotelDetalle, setHotelDetalle] = useState(null);

    const [inviteModal, setInviteModal] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('recepcionista');
    const [inviteHotelId, setInviteHotelId] = useState('');
    const [inviteStatus, setInviteStatus] = useState(null);

    // Sistema config
    const [sysConfig, setSysConfig] = useState({ mantenimiento: false, debug_mode: false, version: '2.1.0' });

    const { data: hoteles = [], isLoading: loadHoteles } = useQuery({
        queryKey: ['hoteles'],
        queryFn: () => base44.entities.Hotel.list(),
    });

    const { data: usuarios = [] } = useQuery({
        queryKey: ['usuarios'],
        queryFn: () => base44.entities.User.list(),
    });

    const { data: reservas = [] } = useQuery({
        queryKey: ['reservas'],
        queryFn: () => base44.entities.Reserva.list(),
    });

    const { data: ventas = [] } = useQuery({
        queryKey: ['ventas'],
        queryFn: () => base44.entities.Venta.list('-created_date', 100),
    });

    const { data: habitaciones = [] } = useQuery({
        queryKey: ['habitaciones'],
        queryFn: () => base44.entities.Habitacion.list(),
    });

    const saveHotel = useMutation({
        mutationFn: (data) => editHotel
            ? base44.entities.Hotel.update(editHotel.id, data)
            : base44.entities.Hotel.create(data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['hoteles'] });
            setHotelModal(false); setEditHotel(null); setHotelForm(emptyHotel);
        },
    });

    const deleteHotel = useMutation({
        mutationFn: (id) => base44.entities.Hotel.delete(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['hoteles'] }),
    });

    const toggleHotel = useMutation({
        mutationFn: ({ id, activo }) => base44.entities.Hotel.update(id, { activo }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['hoteles'] }),
    });

    const updateUser = useMutation({
        mutationFn: ({ id, data }) => base44.entities.User.update(id, data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['usuarios'] }),
    });

    const handleInvite = async () => {
        if (!inviteEmail) return;
        setInviteStatus('loading');
        try {
            const appRole = inviteRole === 'developer' || inviteRole === 'admin' ? 'admin' : 'user';
            await base44.users.inviteUser(inviteEmail, appRole);
            setInviteStatus('ok');
            setInviteEmail('');
            setTimeout(() => { setInviteStatus(null); setInviteModal(false); }, 2500);
        } catch {
            setInviteStatus('error');
        }
    };

    // Solo developer puede entrar
    if (user && user.role !== 'developer') {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
                <ShieldAlert className="w-16 h-16 text-destructive/40" />
                <h2 className="font-display text-2xl font-bold text-foreground">Acceso Restringido</h2>
                <p className="text-muted-foreground max-w-sm">Solo los <strong>Developers</strong> pueden acceder al Panel de Desarrollador.</p>
            </div>
        );
    }

    // Stats por hotel para auditoría
    const statsGlobales = {
        totalHoteles: hoteles.length,
        totalUsuarios: usuarios.length,
        totalReservas: reservas.length,
        reservasActivas: reservas.filter(r => r.estado === 'activa').length,
        totalVentas: ventas.reduce((s, v) => s + (v.total || 0), 0),
        habitaciones: habitaciones.length,
        ocupadas: habitaciones.filter(h => h.estado === 'ocupada').length,
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="w-11 h-11 bg-amber-500 rounded-xl flex items-center justify-center shadow-lg">
                    <Code2 className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h1 className="font-display text-2xl font-bold text-foreground">Panel de Desarrollador</h1>
                    <p className="text-sm text-muted-foreground">Control total del sistema · Multi-Tenant HospedajePRO</p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <span className="bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1.5 rounded-full border border-amber-300">
                        🔧 DEV MODE
                    </span>
                    <span className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1.5 rounded-full border border-green-300">
                        v{sysConfig.version}
                    </span>
                </div>
            </div>

            {/* KPIs globales */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'Hoteles', value: statsGlobales.totalHoteles, icon: Building2, color: 'text-amber-600', bg: 'bg-amber-50' },
                    { label: 'Usuarios', value: statsGlobales.totalUsuarios, icon: Users, color: 'text-primary', bg: 'bg-primary/10' },
                    { label: 'Reservas activas', value: statsGlobales.reservasActivas, icon: BedDouble, color: 'text-green-600', bg: 'bg-green-50' },
                    { label: 'Ingresos totales', value: `S/ ${statsGlobales.totalVentas.toFixed(0)}`, icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' },
                ].map(s => (
                    <div key={s.label} className="bg-card border border-border rounded-2xl p-4">
                        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center mb-2", s.bg)}>
                            <s.icon className={cn("w-4 h-4", s.color)} />
                        </div>
                        <p className="text-xl font-bold text-foreground">{s.value}</p>
                        <p className="text-xs text-muted-foreground">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-border overflow-x-auto">
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                        className={cn("flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px whitespace-nowrap",
                            tab === t.id ? "border-amber-500 text-amber-600" : "border-transparent text-muted-foreground hover:text-foreground")}>
                        <t.icon className="w-4 h-4" />{t.label}
                    </button>
                ))}
            </div>

            {/* ===== TAB HOTELES ===== */}
            {tab === 'hoteles' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-semibold text-foreground">Propiedades Multi-Tenant</p>
                            <p className="text-xs text-muted-foreground">Cada hotel opera de forma independiente con sus propios datos</p>
                        </div>
                        <Button onClick={() => { setEditHotel(null); setHotelForm(emptyHotel); setHotelModal(true); }} className="gap-2 bg-amber-500 hover:bg-amber-600" size="sm">
                            <Plus className="w-4 h-4" /> Nuevo Hotel
                        </Button>
                    </div>

                    <div className="grid gap-4">
                        {hoteles.map(h => {
                            const habsHotel = habitaciones.filter(hab => hab.hotel_id === h.id);
                            const reservasHotel = reservas.filter(r => r.hotel_id === h.id);
                            const ventasHotel = ventas.filter(v => v.hotel_id === h.id);
                            const staffHotel = usuarios.filter(u => u.hotel_id === h.id);

                            return (
                                <div key={h.id} className={cn(
                                    "bg-card border-2 rounded-2xl p-5 transition-all",
                                    h.activo ? "border-border hover:border-amber-200" : "border-dashed border-border opacity-60"
                                )}>
                                    <div className="flex items-start gap-4">
                                        {/* Ícono */}
                                        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0",
                                            h.activo ? "bg-amber-50" : "bg-secondary")}>
                                            <Building2 className={cn("w-6 h-6", h.activo ? "text-amber-600" : "text-muted-foreground")} />
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="font-bold text-foreground">{h.nombre}</p>
                                                <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium border",
                                                    h.activo ? "bg-green-50 text-green-700 border-green-200" : "bg-secondary text-muted-foreground border-border")}>
                                                    {h.activo ? '● Activo' : '○ Inactivo'}
                                                </span>
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {[h.ciudad, h.direccion].filter(Boolean).join(' · ')}
                                            </p>
                                            {h.ruc && <p className="text-xs text-muted-foreground">RUC: {h.ruc} · {h.email}</p>}

                                            {/* Mini stats del hotel */}
                                            <div className="flex gap-4 mt-3">
                                                <div className="text-center">
                                                    <p className="text-sm font-bold text-foreground">{habsHotel.length}</p>
                                                    <p className="text-[10px] text-muted-foreground">Habitaciones</p>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-sm font-bold text-foreground">{reservasHotel.filter(r => r.estado === 'activa').length}</p>
                                                    <p className="text-[10px] text-muted-foreground">Reservas activas</p>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-sm font-bold text-foreground">S/ {ventasHotel.reduce((s, v) => s + (v.total || 0), 0).toFixed(0)}</p>
                                                    <p className="text-[10px] text-muted-foreground">Ingresos</p>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-sm font-bold text-foreground">{staffHotel.length}</p>
                                                    <p className="text-[10px] text-muted-foreground">Staff</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Acciones */}
                                        <div className="flex flex-col gap-1 flex-shrink-0">
                                            <button onClick={() => toggleHotel.mutate({ id: h.id, activo: !h.activo })}
                                                className="p-2 rounded-lg hover:bg-secondary transition-colors" title={h.activo ? 'Desactivar' : 'Activar'}>
                                                {h.activo ? <ToggleRight className="w-5 h-5 text-green-500" /> : <ToggleLeft className="w-5 h-5 text-muted-foreground" />}
                                            </button>
                                            <button onClick={() => { setEditHotel(h); setHotelForm({ ...h }); setHotelModal(true); }}
                                                className="p-2 rounded-lg hover:bg-secondary transition-colors">
                                                <Pencil className="w-4 h-4 text-muted-foreground" />
                                            </button>
                                            <button onClick={() => { if (confirm(`¿Eliminar "${h.nombre}"? Esta acción es irreversible.`)) deleteHotel.mutate(h.id); }}
                                                className="p-2 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors">
                                                <Trash2 className="w-4 h-4 text-muted-foreground" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Horarios */}
                                    {(h.hora_checkin || h.hora_checkout) && (
                                        <div className="mt-3 pt-3 border-t border-border flex gap-4 text-xs text-muted-foreground">
                                            <span>🕐 Check-in: <strong>{h.hora_checkin}</strong></span>
                                            <span>🕐 Check-out: <strong>{h.hora_checkout}</strong></span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {hoteles.length === 0 && !loadHoteles && (
                            <div className="text-center py-16 border-2 border-dashed border-border rounded-2xl text-muted-foreground">
                                <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                <p className="font-medium">Sin hoteles registrados</p>
                                <p className="text-sm mt-1">Crea el primer hotel para comenzar</p>
                                <Button onClick={() => { setEditHotel(null); setHotelForm(emptyHotel); setHotelModal(true); }}
                                    className="mt-4 gap-2" variant="outline">
                                    <Plus className="w-4 h-4" /> Crear primer hotel
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ===== TAB USUARIOS ===== */}
            {tab === 'usuarios' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-semibold text-foreground">Staff & Accesos</p>
                            <p className="text-xs text-muted-foreground">Gestiona roles y asignación por hotel</p>
                        </div>
                        <Button onClick={() => { setInviteStatus(null); setInviteEmail(''); setInviteModal(true); }} className="gap-2 bg-amber-500 hover:bg-amber-600" size="sm">
                            <UserPlus className="w-4 h-4" /> Invitar Staff
                        </Button>
                    </div>

                    {/* Leyenda de roles */}
                    <div className="flex gap-2 flex-wrap">
                        {ROLES.map(r => (
                            <span key={r.value} className="text-xs bg-secondary text-muted-foreground px-3 py-1 rounded-full border border-border">
                                {r.label} — {r.desc}
                            </span>
                        ))}
                    </div>

                    <div className="grid gap-3">
                        {usuarios.map(u => {
                            const hotelAsignado = hoteles.find(h => h.id === u.hotel_id);
                            const rolInfo = ROLES.find(r => r.value === u.role);
                            return (
                                <div key={u.id} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4">
                                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                                        <span className="text-sm font-bold text-primary">
                                            {(u.full_name || u.email || '?')[0].toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-foreground text-sm truncate">{u.full_name || '(Sin nombre)'}</p>
                                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            {rolInfo && <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200 font-medium">{rolInfo.label}</span>}
                                            {hotelAsignado && <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{hotelAsignado.nombre}</span>}
                                        </div>
                                    </div>
                                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                                        <Select value={u.role || 'recepcionista'} onValueChange={v => updateUser.mutate({ id: u.id, data: { role: v } })}>
                                            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                                            <SelectContent>{ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                                        </Select>
                                        {hoteles.length > 0 && (
                                            <Select value={u.hotel_id || ''} onValueChange={v => updateUser.mutate({ id: u.id, data: { hotel_id: v || null } })}>
                                                <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Sin hotel" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value={null}>Sin asignar</SelectItem>
                                                    {hoteles.map(h => <SelectItem key={h.id} value={h.id}>{h.nombre}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ===== TAB CÓDIGOS ===== */}
            {tab === 'codigos' && (
                <div className="max-w-lg">
                    <GeneradorCodigos />
                </div>
            )}

            {/* ===== TAB SISTEMA ===== */}
            {tab === 'sistema' && (
                <div className="space-y-4 max-w-2xl">
                    <p className="text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-700">
                        ⚠️ <strong>Zona de Desarrollador:</strong> Los cambios aquí afectan a todo el sistema globalmente.
                    </p>

                    {/* Info del sistema */}
                    <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                        <h3 className="font-semibold text-foreground flex items-center gap-2"><Server className="w-4 h-4 text-amber-500" /> Estado del Sistema</h3>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { label: 'Versión', value: `HospedajePRO v${sysConfig.version}`, icon: Zap },
                                { label: 'Base de datos', value: 'Supabase · Conectada', icon: Database },
                                { label: 'Auth', value: 'Activa · Requerida', icon: CheckCircle },
                                { label: 'Multi-tenant', value: `${hoteles.length} hotel(es)`, icon: Building2 },
                            ].map(item => (
                                <div key={item.label} className="bg-secondary/50 rounded-xl p-3">
                                    <div className="flex items-center gap-2 mb-1">
                                        <item.icon className="w-3.5 h-3.5 text-muted-foreground" />
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{item.label}</p>
                                    </div>
                                    <p className="text-sm font-semibold text-foreground">{item.value}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Roles del sistema */}
                    <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                        <h3 className="font-semibold text-foreground flex items-center gap-2"><Users className="w-4 h-4 text-amber-500" /> Estructura de Roles</h3>
                        <div className="space-y-2">
                            {[
                                { rol: '🔧 Developer', permisos: 'Panel Dev completo, configuración global, auditoría, gestión de hoteles', badge: 'bg-amber-100 text-amber-700 border-amber-300' },
                                { rol: '👑 Admin', permisos: 'Gestión completa del hotel asignado: habitaciones, reservas, ventas, staff', badge: 'bg-primary/10 text-primary border-primary/20' },
                                { rol: '🛎️ Recepcionista', permisos: 'Recepción, check-in/out, POS, ventas del hotel asignado', badge: 'bg-green-100 text-green-700 border-green-300' },
                            ].map(r => (
                                <div key={r.rol} className="flex items-start gap-3 p-3 rounded-xl bg-secondary/40 border border-border">
                                    <span className={cn("text-xs font-bold px-2 py-1 rounded-full border whitespace-nowrap flex-shrink-0", r.badge)}>{r.rol}</span>
                                    <p className="text-xs text-muted-foreground">{r.permisos}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Links de gestión */}
                    <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                        <h3 className="font-semibold text-foreground flex items-center gap-2"><Settings className="w-4 h-4 text-amber-500" /> Herramientas Externas</h3>
                        <div className="space-y-2">
                            <button onClick={() => window.open('https://e-menu.sunat.gob.pe', '_blank')}
                                className="w-full flex items-center justify-between p-3 rounded-xl border border-border hover:bg-secondary transition-all text-left">
                                <div className="flex items-center gap-3">
                                    <ExternalLink className="w-4 h-4 text-blue-500" />
                                    <div>
                                        <p className="text-sm font-medium text-foreground">Portal SUNAT</p>
                                        <p className="text-xs text-muted-foreground">Emitir comprobantes electrónicos</p>
                                    </div>
                                </div>
                                <span className="text-xs text-muted-foreground">→</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== TAB AUDITORÍA ===== */}
            {tab === 'auditoria' && (
                <div className="space-y-4">
                    <p className="font-semibold text-foreground">Auditoría Global del Sistema</p>

                    {/* Stats por hotel */}
                    <div className="grid gap-4">
                        {hoteles.map(h => {
                            const habsH = habitaciones.filter(hab => hab.hotel_id === h.id || !hab.hotel_id);
                            const resH = reservas.filter(r => r.hotel_id === h.id || !r.hotel_id);
                            const venH = ventas.filter(v => v.hotel_id === h.id || !v.hotel_id);
                            const staffH = usuarios.filter(u => u.hotel_id === h.id);
                            const ingresos = venH.reduce((s, v) => s + (v.total || 0), 0);
                            const ocupacion = habsH.length > 0 ? Math.round((habsH.filter(hb => hb.estado === 'ocupada').length / habsH.length) * 100) : 0;

                            return (
                                <div key={h.id} className="bg-card border border-border rounded-2xl p-5 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center">
                                                <Building2 className="w-5 h-5 text-amber-600" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-foreground">{h.nombre}</p>
                                                <p className="text-xs text-muted-foreground">{h.ciudad}</p>
                                            </div>
                                        </div>
                                        <span className={cn("text-xs px-2 py-1 rounded-full border font-medium",
                                            h.activo ? "bg-green-50 text-green-700 border-green-200" : "bg-secondary text-muted-foreground border-border")}>
                                            {h.activo ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        <div className="bg-secondary/50 rounded-xl p-3 text-center">
                                            <p className="text-lg font-bold text-foreground">{habsH.length}</p>
                                            <p className="text-[10px] text-muted-foreground">Habitaciones</p>
                                        </div>
                                        <div className="bg-secondary/50 rounded-xl p-3 text-center">
                                            <p className="text-lg font-bold text-green-600">{resH.filter(r => r.estado === 'activa').length}</p>
                                            <p className="text-[10px] text-muted-foreground">Reservas activas</p>
                                        </div>
                                        <div className="bg-secondary/50 rounded-xl p-3 text-center">
                                            <p className="text-lg font-bold text-primary">S/ {ingresos.toFixed(0)}</p>
                                            <p className="text-[10px] text-muted-foreground">Ingresos totales</p>
                                        </div>
                                        <div className="bg-secondary/50 rounded-xl p-3 text-center">
                                            <p className="text-lg font-bold text-foreground">{staffH.length}</p>
                                            <p className="text-[10px] text-muted-foreground">Staff asignado</p>
                                        </div>
                                    </div>

                                    {/* Ocupación */}
                                    <div>
                                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                            <span>Ocupación</span>
                                            <span>{ocupacion}%</span>
                                        </div>
                                        <div className="w-full bg-secondary rounded-full h-2">
                                            <div className="bg-amber-500 h-2 rounded-full transition-all" style={{ width: `${ocupacion}%` }} />
                                        </div>
                                    </div>

                                    {/* Staff del hotel */}
                                    {staffH.length > 0 && (
                                        <div className="flex gap-2 flex-wrap">
                                            {staffH.map(u => (
                                                <span key={u.id} className="text-xs bg-secondary px-2 py-1 rounded-full border border-border text-muted-foreground">
                                                    {u.full_name || u.email} · {u.role}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {hoteles.length === 0 && (
                            <div className="text-center py-12 border border-dashed border-border rounded-2xl text-muted-foreground">
                                <Activity className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                <p className="text-sm">Registra hoteles para ver la auditoría</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Modal crear/editar hotel */}
            <Dialog open={hotelModal} onOpenChange={setHotelModal}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="font-display">{editHotel ? 'Editar Hotel' : 'Nuevo Hotel'}</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                            <Label>Nombre del hotel *</Label>
                            <Input className="mt-1" value={hotelForm.nombre} onChange={e => setHotelForm({ ...hotelForm, nombre: e.target.value })} placeholder="Hotel Los Andes" />
                        </div>
                        <div>
                            <Label>RUC</Label>
                            <Input className="mt-1" value={hotelForm.ruc} onChange={e => setHotelForm({ ...hotelForm, ruc: e.target.value })} placeholder="20XXXXXXXXX" />
                        </div>
                        <div>
                            <Label>Ciudad</Label>
                            <Input className="mt-1" value={hotelForm.ciudad} onChange={e => setHotelForm({ ...hotelForm, ciudad: e.target.value })} placeholder="Lima" />
                        </div>
                        <div className="col-span-2">
                            <Label>Dirección</Label>
                            <Input className="mt-1" value={hotelForm.direccion} onChange={e => setHotelForm({ ...hotelForm, direccion: e.target.value })} placeholder="Av. Principal 123" />
                        </div>
                        <div>
                            <Label>Teléfono</Label>
                            <Input className="mt-1" value={hotelForm.telefono} onChange={e => setHotelForm({ ...hotelForm, telefono: e.target.value })} placeholder="01-234-5678" />
                        </div>
                        <div>
                            <Label>Email</Label>
                            <Input className="mt-1" type="email" value={hotelForm.email} onChange={e => setHotelForm({ ...hotelForm, email: e.target.value })} placeholder="info@hotel.com" />
                        </div>
                        <div>
                            <Label>Hora Check-in</Label>
                            <Input className="mt-1" type="time" value={hotelForm.hora_checkin} onChange={e => setHotelForm({ ...hotelForm, hora_checkin: e.target.value })} />
                        </div>
                        <div>
                            <Label>Hora Check-out</Label>
                            <Input className="mt-1" type="time" value={hotelForm.hora_checkout} onChange={e => setHotelForm({ ...hotelForm, hora_checkout: e.target.value })} />
                        </div>
                        <div className="col-span-2">
                            <Label>Notas internas</Label>
                            <Input className="mt-1" value={hotelForm.notas} onChange={e => setHotelForm({ ...hotelForm, notas: e.target.value })} placeholder="Observaciones..." />
                        </div>
                        <div className="col-span-2 flex gap-3 pt-2">
                            <Button variant="outline" className="flex-1" onClick={() => setHotelModal(false)}>Cancelar</Button>
                            <Button className="flex-1 bg-amber-500 hover:bg-amber-600" disabled={saveHotel.isPending || !hotelForm.nombre}
                                onClick={() => saveHotel.mutate(hotelForm)}>
                                {saveHotel.isPending ? 'Guardando...' : editHotel ? 'Actualizar Hotel' : 'Crear Hotel'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Modal invitar staff */}
            <Dialog open={inviteModal} onOpenChange={v => { setInviteModal(v); if (!v) setInviteStatus(null); }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="font-display">Invitar Colaborador</DialogTitle>
                    </DialogHeader>
                    {inviteStatus === 'ok' ? (
                        <div className="text-center py-6 space-y-2">
                            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                                <Check className="w-6 h-6 text-green-600" />
                            </div>
                            <p className="font-bold text-foreground">¡Invitación enviada!</p>
                            <p className="text-sm text-muted-foreground">Recibirá un email para registrarse en el sistema.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div>
                                <Label>Email *</Label>
                                <Input className="mt-1" type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="colaborador@email.com" />
                            </div>
                            <div>
                                <Label>Rol</Label>
                                <Select value={inviteRole} onValueChange={setInviteRole}>
                                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                    <SelectContent>{ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            {hoteles.length > 0 && (
                                <div>
                                    <Label>Hotel asignado</Label>
                                    <Select value={inviteHotelId} onValueChange={setInviteHotelId}>
                                        <SelectTrigger className="mt-1"><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={null}>Sin asignar</SelectItem>
                                            {hoteles.filter(h => h.activo).map(h => <SelectItem key={h.id} value={h.id}>{h.nombre}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            {inviteStatus === 'error' && <p className="text-sm text-destructive">Error al enviar. Verifica el email.</p>}
                            <div className="flex gap-3 pt-1">
                                <Button variant="outline" className="flex-1" onClick={() => setInviteModal(false)}>Cancelar</Button>
                                <Button className="flex-1 gap-2 bg-amber-500 hover:bg-amber-600" disabled={!inviteEmail || inviteStatus === 'loading'} onClick={handleInvite}>
                                    {inviteStatus === 'loading' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                                    Enviar
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}