import React, { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/config/supabase';
import { useAuthStore } from '@/store/auth.store';
import { toast } from 'sonner';

export default function ProfileModal({ open, onOpenChange }) {
    const { user, setUser } = useAuthStore();
    const [loading, setLoading] = useState(false);
    
    // Split names and last names if possible, but keep it simple
    const [fullName, setFullName] = useState(user?.full_name || '');
    const [email, setEmail] = useState(user?.email || '');

    const handleSave = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            // 1. Update in auth metadata (optional but good practice)
            const updates = { data: { full_name: fullName } };
            
            // If email changed, try to update it (will require confirmation)
            if (email !== user?.email) {
                updates.email = email;
            }

            const { error: authError } = await supabase.auth.updateUser(updates);
            if (authError) throw authError;

            // 2. Update in usuarios table
            const { error: dbError } = await supabase
                .from('usuarios')
                .update({ 
                    full_name: fullName,
                    // Only update email in table if we actually changed it, 
                    // though usually auth handles the source of truth
                    ...(email !== user?.email ? { email } : {}) 
                })
                .eq('id', user?.id);

            if (dbError) throw dbError;

            // 3. Update local store
            setUser({ ...user, full_name: fullName, ...(email !== user?.email ? { email } : {}) });

            if (email !== user?.email) {
                toast.success('Perfil actualizado. Se envió un correo de confirmación para el cambio de email.');
            } else {
                toast.success('Perfil actualizado correctamente');
            }
            onOpenChange(false);
        } catch (error) {
            console.error('Error al actualizar perfil:', error);
            toast.error(error?.message || 'Ocurrió un error al guardar el perfil');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="flex h-[100dvh] w-full flex-col overflow-hidden border-l border-border/80 p-0 shadow-2xl glass-panel sm:max-w-md">
                <div className="shrink-0 border-b border-border/70 bg-background/95 p-4 pr-12 backdrop-blur sm:p-5 sm:pr-12">
                    <SheetHeader className="space-y-1 text-left">
                        <SheetTitle className="font-semibold text-base text-foreground">Editar Perfil</SheetTitle>
                        <p className="text-xs text-muted-foreground">Actualiza tu información personal</p>
                    </SheetHeader>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 sm:p-5">
                    <form id="profile-form" onSubmit={handleSave} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold">Nombres y Apellidos</label>
                            <Input 
                                value={fullName} 
                                onChange={(e) => setFullName(e.target.value)} 
                                placeholder="Ej: Jhon Charles" 
                                required
                            />
                        </div>
                        
                        <div className="space-y-2">
                            <label className="text-sm font-semibold">Correo Electrónico</label>
                            <Input 
                                type="email"
                                value={email} 
                                onChange={(e) => setEmail(e.target.value)} 
                                placeholder="correo@ejemplo.com"
                                required
                            />
                            <p className="text-[10px] text-muted-foreground">
                                Nota: Cambiar el correo puede requerir confirmación enviada a ambas direcciones.
                            </p>
                        </div>
                        
                        <div className="space-y-2">
                            <label className="text-sm font-semibold">Rol Asignado</label>
                            <Input value={user?.role || ''} disabled className="bg-muted/50 text-muted-foreground capitalize" />
                        </div>
                    </form>
                </div>
                
                <div className="shrink-0 border-t border-border/70 bg-background/95 p-3 backdrop-blur sm:p-4">
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                        <Button type="submit" form="profile-form" disabled={loading}>
                            {loading ? 'Guardando...' : 'Guardar Cambios'}
                        </Button>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
