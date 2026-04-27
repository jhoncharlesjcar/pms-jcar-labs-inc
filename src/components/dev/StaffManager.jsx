import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/db';
import { UserPlus, Mail, RefreshCw, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const ROLES = [
    { value: 'developer', label: '🔧 Developer', desc: 'Acceso total + Panel Dev' },
    { value: 'admin', label: '👑 Admin', desc: 'Gestión completa del hotel' },
    { value: 'recepcionista', label: '🛎️ Recepcionista', desc: 'Recepción, reservas y ventas' },
];

export default function StaffManager({ usuarios, hoteles }) {
    const qc = useQueryClient();
    const [inviteModal, setInviteModal] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('recepcionista');
    const [inviteHotelId] = useState('');
    const [inviteStatus, setInviteStatus] = useState(null);

    const updateUser = useMutation({
        mutationFn: ({ id, data }) => db.entities.User.update(id, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['usuarios'] });
            setError(null);
        },
        onError: (err) => setError(err.message || "Error al actualizar usuario")
    });

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

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <p className="font-semibold text-foreground">Staff & Accesos</p>
                    <p className="text-xs text-muted-foreground">Gestiona roles y asignación por hotel</p>
                </div>
                <Button onClick={() => setInviteModal(true)} className="gap-2 bg-amber-500 hover:bg-amber-600" size="sm">
                    <UserPlus className="w-4 h-4" /> Invitar Staff
                </Button>
            </div>

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
                                <span className="text-sm font-bold text-primary">{(u.full_name || u.email || '?')[0].toUpperCase()}</span>
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

            <Dialog open={inviteModal} onOpenChange={v => { setInviteModal(v); if (!v) setInviteStatus(null); }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader><DialogTitle>Invitar Colaborador</DialogTitle></DialogHeader>
                    {inviteStatus === 'ok' ? (
                        <div className="text-center py-6 space-y-2">
                            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto"><Check className="w-6 h-6 text-green-600" /></div>
                            <p className="font-bold text-foreground">¡Invitación enviada!</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div><Label>Email *</Label><Input className="mt-1" type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} /></div>
                            <div>
                                <Label>Rol</Label>
                                <Select value={inviteRole} onValueChange={setInviteRole}>
                                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                    <SelectContent>{ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <Button className="w-full gap-2 bg-amber-500 hover:bg-amber-600" disabled={!inviteEmail || inviteStatus === 'loading'} onClick={handleInvite}>
                                {inviteStatus === 'loading' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />} Invitar
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
