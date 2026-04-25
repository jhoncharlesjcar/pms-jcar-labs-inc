import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/db';
import { useAuth } from '@/lib/AuthContext';
import {
    Building2, Plus, Pencil, Trash2, ToggleLeft, ToggleRight,
    Users, UserPlus, Mail, Check, RefreshCw, Lock, Unlock, Key, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const ROLES_STAFF = [
    { value: 'admin', label: '👑 Admin' },
    { value: 'recepcionista', label: '🛎️ Recepcionista' },
];

const emptyHotel = { nombre: '', ruc: '', direccion: '', ciudad: '', telefono: '', email: '', hora_checkin: '14:00', hora_checkout: '12:00', activo: true, notas: '' };

export default function GestionHotelesAdmin({ onClose }) {
    const { user } = useAuth();
    const qc = useQueryClient();

    // Estado del código de desbloqueo
    const [codigoInput, setCodigoInput] = useState('');
    const [desbloqueado, setDesbloqueado] = useState(false);
    const [codigoError, setCodigoError] = useState('');
    const [verificando, setVerificando] = useState(false);

    const [tab, setTab] = useState('hoteles');
    const [hotelModal, setHotelModal] = useState(false);
    const [editHotel, setEditHotel] = useState(null);
    const [hotelForm, setHotelForm] = useState(emptyHotel);

    const [inviteModal, setInviteModal] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('recepcionista');
    const [inviteHotelId, setInviteHotelId] = useState('');
    const [inviteStatus, setInviteStatus] = useState(null);

    const { data: hoteles = [] } = useQuery({
        queryKey: ['hoteles'],
        queryFn: () => db.entities.Hotel.list(),
        enabled: desbloqueado,
    });

    const { data: usuarios = [] } = useQuery({
        queryKey: ['usuarios'],
        queryFn: () => db.entities.User.list(),
        enabled: desbloqueado,
    });

    const { data: codigos = [] } = useQuery({
        queryKey: ['codigos-desbloqueo'],
        queryFn: () => db.entities.CodigoDesbloqueo.list(),
    });

    const saveHotel = useMutation({
        mutationFn: (data) => editHotel
            ? db.entities.Hotel.update(editHotel.id, data)
            : db.entities.Hotel.create(data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['hoteles'] });
            setHotelModal(false); setEditHotel(null); setHotelForm(emptyHotel);
        },
    });

    const deleteHotel = useMutation({
        mutationFn: (id) => db.entities.Hotel.delete(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['hoteles'] }),
    });

    const toggleHotel = useMutation({
        mutationFn: ({ id, activo }) => db.entities.Hotel.update(id, { activo }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['hoteles'] }),
    });

    const marcarCodigoUsado = useMutation({
        mutationFn: ({ id }) => db.entities.CodigoDesbloqueo.update(id, {
            usado: true,
            usado_por: user?.email,
            fecha_uso: new Date().toISOString().split('T')[0],
        }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['codigos-desbloqueo'] }),
    });

    // Verificar código
    const verificarCodigo = async () => {
        if (!codigoInput.trim()) return;
        setVerificando(true);
        setCodigoError('');
        // Buscar código válido y no usado
        const match = codigos.find(c => c.codigo === codigoInput.trim() && !c.usado);
        if (match) {
            await marcarCodigoUsado.mutateAsync({ id: match.id });
            setDesbloqueado(true);
            setCodigoInput('');
        } else {
            const yaUsado = codigos.find(c => c.codigo === codigoInput.trim() && c.usado);
            setCodigoError(yaUsado ? 'Este código ya fue utilizado anteriormente.' : 'Código inválido. Solicita uno nuevo al developer.');
        }
        setVerificando(false);
    };

    const handleInvite = async () => {
        if (!inviteEmail) return;
        setInviteStatus('loading');
        try {
            const appRole = inviteRole === 'admin' ? 'admin' : 'recepcionista';
            await db.users.inviteUser(inviteEmail, appRole, inviteHotelId);
            setInviteStatus('ok');
            setInviteEmail('');
            setTimeout(() => { setInviteStatus(null); setInviteModal(false); }, 2500);
        } catch {
            setInviteStatus('error');
        }
    };

    // ===== PANTALLA: INGRESAR CÓDIGO =====
    if (!desbloqueado) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                        <Lock className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                        <h2 className="font-bold text-foreground">Gestión de Hoteles & Staff</h2>
                        <p className="text-xs text-muted-foreground">Requiere código de desbloqueo del developer</p>
                    </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-4">
                    <p className="text-sm text-amber-800">
                        Para agregar un hotel o gestionar staff, necesitas un <strong>código de desbloqueo</strong> proporcionado por el Developer del sistema.
                    </p>
                    <div>
                        <Label>Código de desbloqueo</Label>
                        <Input
                            className="mt-1 font-mono tracking-widest text-center text-lg uppercase"
                            value={codigoInput}
                            onChange={e => { setCodigoInput(e.target.value.toUpperCase()); setCodigoError(''); }}
                            placeholder="XXXX-XXXX-XXXX"
                            onKeyDown={e => e.key === 'Enter' && verificarCodigo()}
                            maxLength={20}
                        />
                        {codigoError && <p className="text-xs text-destructive mt-1.5">{codigoError}</p>}
                    </div>
                    <Button className="w-full gap-2 bg-amber-500 hover:bg-amber-600" onClick={verificarCodigo} disabled={!codigoInput || verificando}>
                        {verificando ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                        {verificando ? 'Verificando...' : 'Desbloquear'}
                    </Button>
                </div>

                <p className="text-xs text-center text-muted-foreground">
                    Cada código permite una sola operación. Si necesitas agregar otro hotel, solicita un nuevo código.
                </p>
            </div>
        );
    }

    // ===== PANTALLA: GESTIÓN DESBLOQUEADA =====
    return (
        <div className="space-y-4">
            {/* Header desbloqueado */}
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5">
                <Unlock className="w-4 h-4 text-green-600" />
                <p className="text-sm text-green-700 font-medium flex-1">Acceso desbloqueado</p>
                <Button variant="ghost" size="sm" onClick={() => setDesbloqueado(false)} className="h-6 text-xs text-muted-foreground">
                    Cerrar
                </Button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-border">
                {['hoteles', 'staff'].map(t => (
                    <button key={t} onClick={() => setTab(t)}
                        className={cn("px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px capitalize",
                            tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
                        {t === 'hoteles' ? '🏨 Hoteles' : '👥 Staff'}
                    </button>
                ))}
            </div>

            {/* TAB HOTELES */}
            {tab === 'hoteles' && (
                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <p className="text-sm text-muted-foreground">{hoteles.length} propiedad(es)</p>
                        <Button size="sm" className="gap-1 bg-amber-500 hover:bg-amber-600" onClick={() => { setEditHotel(null); setHotelForm(emptyHotel); setHotelModal(true); }}>
                            <Plus className="w-4 h-4" /> Nuevo Hotel
                        </Button>
                    </div>
                    {hoteles.map(h => (
                        <div key={h.id} className={cn("bg-card border rounded-2xl p-4 flex items-center gap-3", h.activo ? "border-border" : "border-dashed border-border opacity-60")}>
                            <Building2 className="w-8 h-8 text-primary/60 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-foreground text-sm">{h.nombre}</p>
                                <p className="text-xs text-muted-foreground">{[h.ciudad, h.ruc ? `RUC ${h.ruc}` : null].filter(Boolean).join(' · ')}</p>
                            </div>
                            <div className="flex gap-1">
                                <button onClick={() => toggleHotel.mutate({ id: h.id, activo: !h.activo })} className="p-2 rounded-lg hover:bg-secondary">
                                    {h.activo ? <ToggleRight className="w-5 h-5 text-green-500" /> : <ToggleLeft className="w-5 h-5 text-muted-foreground" />}
                                </button>
                                <button onClick={() => { setEditHotel(h); setHotelForm({ ...h }); setHotelModal(true); }} className="p-2 rounded-lg hover:bg-secondary">
                                    <Pencil className="w-4 h-4 text-muted-foreground" />
                                </button>
                                <button onClick={() => { if (confirm(`¿Eliminar "${h.nombre}"?`)) deleteHotel.mutate(h.id); }} className="p-2 rounded-lg hover:bg-red-50 hover:text-red-600">
                                    <Trash2 className="w-4 h-4 text-muted-foreground" />
                                </button>
                            </div>
                        </div>
                    ))}
                    {hoteles.length === 0 && (
                        <div className="text-center py-10 border border-dashed rounded-2xl text-muted-foreground">
                            <Building2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                            <p className="text-sm">Sin hoteles. Crea el primero.</p>
                        </div>
                    )}
                </div>
            )}

            {/* TAB STAFF */}
            {tab === 'staff' && (
                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <p className="text-sm text-muted-foreground">{usuarios.length} usuario(s)</p>
                        <Button size="sm" className="gap-1 bg-amber-500 hover:bg-amber-600" onClick={() => { setInviteStatus(null); setInviteEmail(''); setInviteModal(true); }}>
                            <UserPlus className="w-4 h-4" /> Invitar Staff
                        </Button>
                    </div>
                    {usuarios.filter(u => u.role !== 'developer').map(u => (
                        <div key={u.id} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
                            <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                                <span className="text-sm font-bold text-primary">{(u.full_name || u.email || '?')[0].toUpperCase()}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm text-foreground truncate">{u.full_name || '(Sin nombre)'}</p>
                                <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                            </div>
                            <span className={cn("text-[10px] font-bold px-2 py-1 rounded-full border",
                                u.role === 'admin' ? "bg-primary/10 text-primary border-primary/20" : "bg-green-50 text-green-700 border-green-200")}>
                                {u.role === 'admin' ? '👑 Admin' : '🛎️ Recepcionista'}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal Hotel */}
            <Dialog open={hotelModal} onOpenChange={setHotelModal}>
                <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editHotel ? 'Editar Hotel' : 'Nuevo Hotel'}</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2"><Label>Nombre *</Label><Input className="mt-1" value={hotelForm.nombre} onChange={e => setHotelForm({ ...hotelForm, nombre: e.target.value })} /></div>
                        <div><Label>RUC</Label><Input className="mt-1" value={hotelForm.ruc} onChange={e => setHotelForm({ ...hotelForm, ruc: e.target.value })} /></div>
                        <div><Label>Ciudad</Label><Input className="mt-1" value={hotelForm.ciudad} onChange={e => setHotelForm({ ...hotelForm, ciudad: e.target.value })} /></div>
                        <div className="col-span-2"><Label>Dirección</Label><Input className="mt-1" value={hotelForm.direccion} onChange={e => setHotelForm({ ...hotelForm, direccion: e.target.value })} /></div>
                        <div><Label>Teléfono</Label><Input className="mt-1" value={hotelForm.telefono} onChange={e => setHotelForm({ ...hotelForm, telefono: e.target.value })} /></div>
                        <div><Label>Email</Label><Input className="mt-1" type="email" value={hotelForm.email} onChange={e => setHotelForm({ ...hotelForm, email: e.target.value })} /></div>
                        <div><Label>Check-in</Label><Input className="mt-1" type="time" value={hotelForm.hora_checkin} onChange={e => setHotelForm({ ...hotelForm, hora_checkin: e.target.value })} /></div>
                        <div><Label>Check-out</Label><Input className="mt-1" type="time" value={hotelForm.hora_checkout} onChange={e => setHotelForm({ ...hotelForm, hora_checkout: e.target.value })} /></div>
                        <div className="col-span-2 flex gap-3 pt-2">
                            <Button variant="outline" className="flex-1" onClick={() => setHotelModal(false)}>Cancelar</Button>
                            <Button className="flex-1" disabled={saveHotel.isPending || !hotelForm.nombre} onClick={() => saveHotel.mutate(hotelForm)}>
                                {saveHotel.isPending ? 'Guardando...' : editHotel ? 'Actualizar' : 'Crear Hotel'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Modal Invitar */}
            <Dialog open={inviteModal} onOpenChange={v => { setInviteModal(v); if (!v) setInviteStatus(null); }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader><DialogTitle>Invitar Colaborador</DialogTitle></DialogHeader>
                    {inviteStatus === 'ok' ? (
                        <div className="text-center py-6 space-y-2">
                            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto"><Check className="w-6 h-6 text-green-600" /></div>
                            <p className="font-bold text-foreground">¡Invitación enviada!</p>
                            <p className="text-sm text-muted-foreground">Recibirá un email para registrarse.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div><Label>Email *</Label><Input className="mt-1" type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="staff@hotel.com" /></div>
                            <div>
                                <Label>Rol</Label>
                                <Select value={inviteRole} onValueChange={setInviteRole}>
                                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                    <SelectContent>{ROLES_STAFF.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
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
                            <div className="flex gap-3">
                                <Button variant="outline" className="flex-1" onClick={() => setInviteModal(false)}>Cancelar</Button>
                                <Button className="flex-1 gap-2 bg-amber-500 hover:bg-amber-600" disabled={!inviteEmail || inviteStatus === 'loading'} onClick={handleInvite}>
                                    {inviteStatus === 'loading' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                                    Invitar
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}