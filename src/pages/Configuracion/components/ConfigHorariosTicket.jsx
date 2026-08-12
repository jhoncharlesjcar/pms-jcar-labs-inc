import React from 'react';
import { Clock, MessageSquare } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

export function ConfigHorariosTicket({ form, setForm }) {
    return (
        <>
            {/* Horarios */}
            <div className="bg-card/40 backdrop-blur-xl rounded-xl border border-border/40 p-5 space-y-5 shadow-sm">
                <div className="flex items-center gap-3 border-b border-border/40 pb-4">
                    <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center border border-blue-500/20 shadow-xs">
                        <Clock className="w-4 h-4 text-blue-500" />
                    </div>
                    <div>
                        <h2 className="font-extrabold text-lg text-foreground tracking-tight">Horarios</h2>
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-0.5">Hora estándar de entrada y salida</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="hora_checkin" className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Hora de Check-in</Label>
                        <Input id="hora_checkin" type="time" value={form.hora_checkin} onChange={e => setForm({ ...form, hora_checkin: e.target.value })} className="bg-background/50 h-9 rounded-md border-border/40 focus-visible:ring-primary/30 shadow-inner px-3 text-xs font-bold tabular-nums" />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="hora_checkout" className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Hora de Check-out</Label>
                        <Input id="hora_checkout" type="time" value={form.hora_checkout} onChange={e => setForm({ ...form, hora_checkout: e.target.value })} className="bg-background/50 h-9 rounded-md border-border/40 focus-visible:ring-primary/30 shadow-inner px-3 text-xs font-bold tabular-nums" />
                    </div>
                </div>
            </div>

            {/* Ticket */}
            <div className="bg-card/40 backdrop-blur-xl rounded-xl border border-border/40 p-5 space-y-5 shadow-sm mt-4">
                <div className="flex items-center gap-3 border-b border-border/40 pb-4">
                    <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center border border-amber-500/20 shadow-xs">
                        <MessageSquare className="w-4 h-4 text-amber-500" />
                    </div>
                    <div>
                        <h2 className="font-extrabold text-lg text-foreground tracking-tight">Mensaje en el Ticket</h2>
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-0.5">Se imprime al final de cada comprobante</p>
                    </div>
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="mensaje_ticket" className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Mensaje de agradecimiento</Label>
                    <Input id="mensaje_ticket" value={form.mensaje_ticket} onChange={e => setForm({ ...form, mensaje_ticket: e.target.value })} placeholder="¡Gracias por su preferencia!" className="bg-background/50 h-9 rounded-md border-border/40 focus-visible:ring-primary/30 shadow-inner px-3 text-xs font-bold" />
                </div>
            </div>
        </>
    );
}
