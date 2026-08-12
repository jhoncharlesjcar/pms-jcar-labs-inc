import { useState, memo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/db';
import { UserPlus, Mail, RefreshCw, Check, UserX, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const ROLES = [
    { value: 'developer', label: '🔧 Developer', desc: 'Acceso total + Panel Dev' },
    { value: 'admin', label: '👑 Admin', desc: 'Gestión completa del hotel' },
    { value: 'recepcionista', label: '🛎️ Recepcionista', desc: 'Recepción, reservas y ventas' },
];

const StaffManager = memo(function StaffManager({ usuarios, hoteles }) {
    const qc = useQueryClient();
    const [inviteModal, setInviteModal] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('recepcionista');
    const [inviteHotelId] = useState('');
    const [inviteStatus, setInviteStatus] = useState(null);
    const [error, setError] = useState(null);

    const updateUser = useMutation({
        mutationFn: ({ id, data }) => db.entities.User.update(id, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['usuarios'] });
            setError(null);
        },
        onError: (err) => setError(err.message || "Error al actualizar usuario")
    });

    const toggleActivo = (user) => {
        const nuevoEstado = !(user.activo ?? true);
        updateUser.mutate({ id: user.id, data: { activo: nuevoEstado } });
    };

    const handleInvite = async () => {
        if (!inviteEmail) return;
        setInviteStatus('loading');
        setError(null);
        try {
            const appRole = inviteRole === 'developer' || inviteRole === 'admin' ? 'admin' : 'recepcionista';
            await db.users.inviteUser(inviteEmail, appRole, inviteHotelId);
            setInviteStatus('ok');
            setInviteEmail('');
            setTimeout(() => { setInviteStatus(null); setInviteModal(false); }, 2500);
        } catch (err) {
            setInviteStatus('error');
            setError(err.message || "Error al enviar invitación");
        }
    };

    // Separar usuarios activos e inactivos
    const activos = usuarios.filter(u => u.activo !== false);
    const inactivos = usuarios.filter(u => u.activo === false);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <p className="font-extrabold text-sm tracking-tight text-foreground">Staff & Accesos</p>
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-0.5">Gestiona roles, asignación por hotel y estado de cuenta</p>
                </div>
                <Button onClick={() => setInviteModal(true)} className="gap-1.5 bg-amber-500 hover:bg-amber-600 h-9 px-3 text-[10px] font-extrabold uppercase tracking-widest rounded-md shadow-sm">
                    <UserPlus className="w-3.5 h-3.5" /> Invitar Staff
                </Button>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-3 text-xs font-medium text-red-500">
                    {error}
                </div>
            )}

            <div className="flex gap-2 flex-wrap pb-2">
                {ROLES.map(r => (
                    <span key={r.value} className="text-[9px] font-black uppercase tracking-widest bg-secondary/50 text-secondary-foreground px-2 py-1 rounded-sm border border-border/40">
                        {r.label} — {r.desc}
                    </span>
                ))}
            </div>

            {/* Usuarios Activos */}
            {activos.length > 0 && (
                <div>
                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-2 ml-1">
                        Activos ({activos.length})
                    </p>
                    <div className="grid gap-2">
                        {activos.map(u => renderUserCard(u, hoteles, ROLES, updateUser, toggleActivo))}
                    </div>
                </div>
            )}

            {/* Usuarios Inactivos */}
            {inactivos.length > 0 && (
                <div className="mt-4">
                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-2 ml-1">
                        Inactivos ({inactivos.length})
                    </p>
                    <div className="grid gap-2">
                        {inactivos.map(u => renderUserCard(u, hoteles, ROLES, updateUser, toggleActivo))}
                    </div>
                </div>
            )}

            <Dialog open={inviteModal} onOpenChange={v => { setInviteModal(v); if (!v) setInviteStatus(null); }}>
                <DialogContent className="max-w-sm p-5 rounded-xl border border-border/40 bg-background/95 backdrop-blur-xl">
                    <DialogHeader><DialogTitle className="text-lg font-extrabold tracking-tight">Invitar Colaborador</DialogTitle></DialogHeader>
                    {inviteStatus === 'ok' ? (
                        <div className="text-center py-6 space-y-2">
                            <div className="w-10 h-10 bg-green-500/10 rounded-full flex items-center justify-center mx-auto border border-green-500/20"><Check className="w-5 h-5 text-green-500" /></div>
                            <p className="font-extrabold text-foreground tracking-tight">¡Invitación enviada!</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div><Label className="text-[9px] font-black uppercase tracking-widest">Email *</Label><Input className="h-9 px-3 text-xs rounded-md font-bold mt-1 shadow-inner border-border/40 bg-background/50" type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} /></div>
                            <div>
                                <Label className="text-[9px] font-black uppercase tracking-widest">Rol</Label>
                                <Select value={inviteRole} onValueChange={setInviteRole}>
                                    <SelectTrigger className="h-9 px-3 text-xs rounded-md font-bold mt-1 shadow-inner border-border/40 bg-background/50"><SelectValue /></SelectTrigger>
                                    <SelectContent>{ROLES.map(r => <SelectItem key={r.value} value={r.value} className="text-xs font-bold">{r.label}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <Button className="w-full gap-2 bg-amber-500 hover:bg-amber-600 h-9 text-[10px] font-extrabold uppercase tracking-widest rounded-md mt-2 shadow-sm" disabled={!inviteEmail || inviteStatus === 'loading'} onClick={handleInvite}>
                                {inviteStatus === 'loading' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />} Invitar
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
});
StaffManager.displayName = 'StaffManager';
export default StaffManager;

function renderUserCard(u, hoteles, ROLES, updateUser, toggleActivo) {
    const hotelAsignado = hoteles.find(h => h.id === u.hotel_id);
    const rolInfo = ROLES.find(r => r.value === u.role);
    const isActive = u.activo !== false;

    return (
        <div
            key={u.id}
            className={cn(
                "border rounded-xl p-3 flex items-center gap-4 transition-all duration-200 shadow-sm",
                isActive
                    ? "bg-card/60 backdrop-blur-sm border-border/40 hover:border-amber-500/30"
                    : "bg-muted/10 border-dashed border-muted-foreground/20 opacity-70"
            )}
        >
            <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 shadow-xs border border-border/20",
                isActive ? "bg-primary/10" : "bg-muted/50"
            )}>
                <span className={cn(
                    "text-xs font-extrabold tracking-tight",
                    isActive ? "text-primary" : "text-muted-foreground"
                )}>
                    {(u.full_name || u.email || '?')[0].toUpperCase()}
                </span>
            </div>
            <div className="flex-1 min-w-0">
                <p className={cn(
                    "font-extrabold text-xs tracking-tight truncate",
                    isActive ? "text-foreground" : "text-muted-foreground line-through"
                )}>
                    {u.full_name || '(Sin nombre)'}
                </p>
                <p className="text-[10px] font-bold text-muted-foreground truncate leading-tight">{u.email}</p>
                <div className="flex items-center gap-2 mt-1">
                    {rolInfo && (
                        <span className={cn(
                            "text-[9px] px-2 py-0.5 rounded-sm border uppercase font-black tracking-widest",
                            isActive
                                ? "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-500"
                                : "bg-muted/50 text-muted-foreground border-border/40"
                        )}>
                            {rolInfo.label}
                        </span>
                    )}
                    {!isActive && (
                        <span className="text-[9px] uppercase font-black tracking-widest bg-red-500/10 text-red-500 px-2 py-0.5 rounded-sm border border-red-500/20">
                            Desactivado
                        </span>
                    )}
                    {hotelAsignado && (
                        <span className={cn(
                            "text-[9px] uppercase font-black tracking-widest px-2 py-0.5 rounded-sm border",
                            isActive ? "bg-primary/10 text-primary border-primary/20" : "bg-muted/50 text-muted-foreground border-border/40"
                        )}>
                            {hotelAsignado.nombre}
                        </span>
                    )}
                </div>
            </div>
            <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                {isActive ? (
                    <>
                        <Select value={u.role || 'recepcionista'} onValueChange={v => updateUser.mutate({ id: u.id, data: { role: v } })}>
                            <SelectTrigger className="w-32 h-8 text-[10px] font-bold uppercase tracking-widest rounded-md border-border/40 shadow-inner bg-background/50"><SelectValue /></SelectTrigger>
                            <SelectContent>{ROLES.map(r => <SelectItem key={r.value} value={r.value} className="text-xs font-bold">{r.label}</SelectItem>)}</SelectContent>
                        </Select>
                        {hoteles.length > 0 && (
                            <Select value={u.hotel_id || ''} onValueChange={v => updateUser.mutate({ id: u.id, data: { hotel_id: v || null } })}>
                                <SelectTrigger className="w-32 h-8 text-[10px] font-bold uppercase tracking-widest rounded-md border-border/40 shadow-inner bg-background/50"><SelectValue placeholder="Sin hotel" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={null} className="text-xs font-bold">Sin asignar</SelectItem>
                                    {hoteles.map(h => <SelectItem key={h.id} value={h.id} className="text-xs font-bold">{h.nombre}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        )}
                    </>
                ) : (
                    <div className="w-32" /> /* spacer when inactive */
                )}
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleActivo(u)}
                    className={cn(
                        "h-8 px-3 rounded-md text-[9px] font-black uppercase tracking-widest transition-colors",
                        isActive
                            ? "text-red-500 hover:text-red-600 hover:bg-red-500/10"
                            : "text-green-600 hover:text-green-500 hover:bg-green-500/10"
                    )}
                    title={isActive ? "Desactivar usuario" : "Reactivar usuario"}
                >
                    {isActive ? (
                        <><UserX className="w-3.5 h-3.5 mr-1" /> Desactivar</>
                    ) : (
                        <><UserCheck className="w-3.5 h-3.5 mr-1" /> Reactivar</>
                    )}
                </Button>
            </div>
        </div>
    );
}
