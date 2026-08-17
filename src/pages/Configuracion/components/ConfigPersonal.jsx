import React, { useState, useRef, useEffect, memo } from 'react';
import { Users, UserPlus, Trash2 } from 'lucide-react';
import { gsap } from 'gsap';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import logger from '@/lib/logger';
import { supabase } from '@/config/supabase';
import { db } from '@/api/db';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { generateUUID } from '@/lib/utils';
import { Button } from '@/components/ui/button';

/** @type {React.FC<{hotelId: string}>} */
export const ConfigPersonal = memo(function ConfigPersonal({ hotelId }) {
    const qc = useQueryClient();
    const [staffForm, setStaffForm] = useState({ full_name: '', email: '', role: 'recepcionista' });
    const [showStaffModal, setShowStaffModal] = useState(false);

    const { data: personal = [] } = useQuery({
        queryKey: ['personal', hotelId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('usuarios')
                .select('*')
                .eq('hotel_id', hotelId);
            if (error) throw error;
            return data || [];
        },
        enabled: !!hotelId,
    });

    const personalListRef = useRef(null);
    const gsapAnimRef = useRef(null);

    // GSAP stagger en lista de personal
    useEffect(() => {
        if (!personalListRef.current) return;
        const items = personalListRef.current.querySelectorAll(':scope > div');
        if (items.length === 0) return;

        if (gsapAnimRef.current) gsapAnimRef.current.kill();

        const tween = gsap.fromTo(
            items,
            { opacity: 0, x: -10 },
            {
                opacity: 1,
                x: 0,
                duration: 0.3,
                ease: 'power2.out',
                stagger: { each: 0.05, from: 'start' },
            }
        );

        gsapAnimRef.current = tween;
        return () => { if (gsapAnimRef.current) { gsapAnimRef.current.kill(); gsapAnimRef.current = null; } };
    }, [personal.length]);

    const agregarPersonal = useMutation({
        /** @param {any} nuevo */
        mutationFn: async (nuevo) => {
            let newUserId = generateUUID();
            try {
                const authData = await db.users.inviteUser(nuevo.email, nuevo.role, hotelId);
                if (authData?.user?.id) {
                    newUserId = authData.user.id;
                }
            } catch (authErr) {
                logger.warn('No se pudo invitar por Auth, usando UUID local:', authErr);
            }

            const { data, error } = await supabase
                .from('usuarios')
                .insert({
                    id: newUserId,
                    hotel_id: hotelId,
                    ...nuevo
                })
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['personal', hotelId] });
            toast.success('Miembro del personal registrado con éxito');
            setShowStaffModal(false);
            setStaffForm({ full_name: '', email: '', role: 'recepcionista' });
        },
        onError: (err) => {
            logger.error(err);
            toast.error('Error al registrar personal');
        }
    });

    const actualizarPersonal = useMutation({
        /** @param {{id: string, updates: any}} params */
        mutationFn: async ({ id, updates }) => {
            const { data, error } = await supabase
                .from('usuarios')
                .update(updates)
                .eq('id', id);
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['personal', hotelId] });
            toast.success('Rol actualizado con éxito');
        },
        onError: (err) => {
            logger.error(err);
            toast.error('Error al actualizar rol');
        }
    });

    const eliminarPersonal = useMutation({
        mutationFn: async (id) => {
            const { error } = await supabase
                .from('usuarios')
                .delete()
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['personal', hotelId] });
            toast.success('Miembro del personal eliminado');
        },
        onError: (err) => {
            logger.error(err);
            toast.error('Error al eliminar personal');
        }
    });

    return (
        <div className="bg-card/40 backdrop-blur-xl rounded-xl border border-border/40 p-5 space-y-5 shadow-sm">
            <div className="flex items-center justify-between flex-wrap gap-4 border-b border-border/40 pb-4">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-indigo-500/10 rounded-lg flex items-center justify-center border border-indigo-500/20 shadow-xs">
                        <Users className="w-4 h-4 text-indigo-500" />
                    </div>
                    <div>
                        <h2 className="font-extrabold text-foreground text-lg tracking-tight">Personal y Roles</h2>
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-0.5">Gestión de accesos y permisos de colaboradores</p>
                    </div>
                </div>
                <Button 
                    onClick={() => {
                        setStaffForm({ full_name: '', email: '', role: 'recepcionista' });
                        setShowStaffModal(true);
                    }} 
                    className="gap-2 shadow-xs text-indigo-500 border-indigo-500/20 bg-indigo-500/5 hover:bg-indigo-500/10 rounded-md h-9 text-[9px] font-extrabold uppercase tracking-widest px-4 active:scale-95 transition-all"
                >
                    <UserPlus className="w-3.5 h-3.5" /> Agregar Personal
                </Button>
            </div>

            <div ref={personalListRef} className="grid gap-3">
                {personal.map(u => {
                    const initials = (u.full_name || u.email || '?')[0].toUpperCase();
                    return (
                        <div key={u.id} className="bg-card/40 border border-border/40 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:bg-card/60 shadow-sm hover:border-indigo-500/30">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-indigo-500/10 rounded-lg flex items-center justify-center border border-indigo-500/20 flex-shrink-0 shadow-xs">
                                    <span className="text-sm font-extrabold text-indigo-500">{initials}</span>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="font-extrabold text-foreground text-sm truncate tracking-tight">{u.full_name || '(Sin Nombre)'}</p>
                                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground truncate">{u.email}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 justify-end">
                                <select 
                                    value={u.role || 'recepcionista'} 
                                    onChange={e => actualizarPersonal.mutate({ id: u.id, updates: { role: e.target.value } })}
                                    className="h-9 rounded-md border border-border/40 bg-background/50 px-3 text-xs font-bold text-foreground focus:ring-indigo-500/30 shadow-inner transition-all hover:border-indigo-500/30 cursor-pointer"
                                >
                                    <option value="admin">👑 Administrador</option>
                                    <option value="recepcionista">🛎️ Recepcionista</option>
                                    <option value="limpieza">🧹 Personal Limpieza</option>
                                    <option value="developer">🔧 Desarrollador</option>
                                </select>
                                <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    onClick={() => {
                                        toast(`¿Está seguro de eliminar a ${u.full_name || u.email}?`, {
                                            action: {
                                                label: 'Eliminar',
                                                onClick: () => eliminarPersonal.mutate(u.id)
                                            },
                                            cancel: { label: 'Cancelar', onClick: () => {} }
                                        });
                                    }}
                                    className="h-9 w-9 text-red-500/70 hover:text-red-500 hover:bg-red-500/10 rounded-md flex-shrink-0 active:scale-95 transition-all"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    );
                })}
                {personal.length === 0 && (
                    <div className="text-center py-8 border border-dashed border-border/50 rounded-xl bg-background/20">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Cargando personal...</p>
                    </div>
                )}
            </div>

            <div className="mt-4 border border-border/40 rounded-xl bg-card/40 overflow-hidden shadow-sm">
                <div className="p-4 bg-card/60 border-b border-border/40">
                    <p className="text-[9px] font-black uppercase tracking-widest text-foreground">Matriz de Permisos por Rol</p>
                </div>
                <div className="overflow-x-auto no-scrollbar">
                    <table className="w-full text-left border-collapse text-[10px]">
                        <thead>
                            <tr className="border-b border-border/40 text-muted-foreground bg-background/30">
                                <th className="p-3 font-black uppercase tracking-widest">Módulo</th>
                                <th className="p-3 font-black uppercase tracking-widest text-center">Admin / Dev</th>
                                <th className="p-3 font-black uppercase tracking-widest text-center">Recepcionista</th>
                                <th className="p-3 font-black uppercase tracking-widest text-center">Limpieza</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="border-b border-border/10 hover:bg-foreground/5">
                                <td className="p-2.5 font-medium">Dashboard (Ingresos)</td>
                                <td className="p-2.5 text-center text-emerald-400 font-medium">✓</td>
                                <td className="p-2.5 text-center text-emerald-400 font-medium">✓</td>
                                <td className="p-2.5 text-center text-red-400/50">✗</td>
                            </tr>
                            <tr className="border-b border-border/10 hover:bg-foreground/5">
                                <td className="p-2.5 font-medium">Recepción (Reservas)</td>
                                <td className="p-2.5 text-center text-emerald-400 font-medium">✓</td>
                                <td className="p-2.5 text-center text-emerald-400 font-medium">✓</td>
                                <td className="p-2.5 text-center text-red-400/50">✗</td>
                            </tr>
                            <tr className="border-b border-border/10 hover:bg-foreground/5">
                                <td className="p-2.5 font-medium">Caja y Cierres</td>
                                <td className="p-2.5 text-center text-emerald-400 font-medium">✓</td>
                                <td className="p-2.5 text-center text-emerald-400 font-medium">✓</td>
                                <td className="p-2.5 text-center text-red-400/50">✗</td>
                            </tr>
                            <tr className="border-b border-border/10 hover:bg-foreground/5">
                                <td className="p-2.5 font-medium">Habitaciones y Estado</td>
                                <td className="p-2.5 text-center text-emerald-400 font-medium">✓</td>
                                <td className="p-2.5 text-center text-emerald-400 font-medium">✓</td>
                                <td className="p-2.5 text-center text-emerald-400 font-medium">✓</td>
                            </tr>
                            <tr className="border-b border-border/10 hover:bg-foreground/5">
                                <td className="p-2.5 font-medium">Reportes Financieros</td>
                                <td className="p-2.5 text-center text-emerald-400 font-medium">✓</td>
                                <td className="p-2.5 text-center text-red-400/50">✗</td>
                                <td className="p-2.5 text-center text-red-400/50">✗</td>
                            </tr>
                            <tr className="hover:bg-foreground/5">
                                <td className="p-2.5 font-medium">Configuración y SUNAT</td>
                                <td className="p-2.5 text-center text-emerald-400 font-medium">✓</td>
                                <td className="p-2.5 text-center text-red-400/50">✗</td>
                                <td className="p-2.5 text-center text-red-400/50">✗</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal para Agregar Personal */}
            {showStaffModal && (
                <Dialog open={showStaffModal} onOpenChange={setShowStaffModal}>
                    <DialogContent className="sm:max-w-md glass-panel border-border/80 rounded-xl p-5 shadow-2xl">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-3 text-indigo-500 font-extrabold text-lg tracking-tight">
                                <div className="w-8 h-8 bg-indigo-500/10 rounded-lg flex items-center justify-center border border-indigo-500/20 shadow-xs">
                                    <UserPlus className="w-4 h-4" /> 
                                </div>
                                Registrar Colaborador
                            </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="staff_fullname" className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Nombre Completo *</Label>
                                <Input 
                                    id="staff_fullname"
                                    value={staffForm.full_name} 
                                    onChange={e => setStaffForm(prev => ({ ...prev, full_name: e.target.value }))}
                                    placeholder="Ej: Juan Pérez Romero"
                                    className="bg-background/50 h-9 rounded-md border-border/40 focus-visible:ring-indigo-500/30 shadow-inner px-3 text-xs font-bold"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="staff_email" className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Email / Usuario *</Label>
                                <Input 
                                    id="staff_email"
                                    value={staffForm.email} 
                                    onChange={e => setStaffForm(prev => ({ ...prev, email: e.target.value }))}
                                    placeholder="juan.perez@hotel.com"
                                    className="bg-background/50 h-9 rounded-md border-border/40 focus-visible:ring-indigo-500/30 shadow-inner px-3 text-xs font-bold"
                                    type="email"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="staff_role" className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Rol / Acceso *</Label>
                                <select 
                                    id="staff_role"
                                    value={staffForm.role} 
                                    onChange={e => setStaffForm(prev => ({ ...prev, role: e.target.value }))}
                                    className="flex h-9 w-full rounded-md border border-border/40 bg-background/50 px-3 py-1.5 text-xs text-foreground font-bold focus:ring-indigo-500/30 shadow-inner cursor-pointer"
                                >
                                    <option value="admin">👑 Administrador</option>
                                    <option value="recepcionista">🛎️ Recepcionista</option>
                                    <option value="limpieza">🧹 Personal Limpieza</option>
                                    <option value="developer">🔧 Desarrollador</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-3 justify-end pt-4 border-t border-border/40">
                            <Button 
                                variant="outline" 
                                onClick={() => setShowStaffModal(false)}
                                className="rounded-md font-bold h-9 px-4 text-[9px] uppercase tracking-widest active:scale-95 transition-all border-border/40"
                            >
                                Cancelar
                            </Button>
                            <Button 
                                onClick={() => agregarPersonal.mutate(staffForm)}
                                disabled={!staffForm.full_name || !staffForm.email || agregarPersonal.isPending}
                                className="rounded-md font-extrabold text-[9px] uppercase tracking-widest h-9 px-4 bg-indigo-600 hover:bg-indigo-700 text-white active:scale-95 transition-all shadow-sm"
                            >
                                {agregarPersonal.isPending ? 'Registrando...' : 'Registrar'}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
});
ConfigPersonal.displayName = 'ConfigPersonal';
