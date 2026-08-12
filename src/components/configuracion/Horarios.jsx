import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Clock, MessageSquare } from 'lucide-react';

export function Horarios({ form, setForm }) {
    return (
        <>
            <div className="glass-panel rounded-[2rem] border border-border/50 p-8 space-y-6 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-3xl -z-10 rounded-full pointer-events-none" />
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-foreground/5 rounded-2xl flex items-center justify-center border border-blue-500/20 shadow-[inset_0_0_15px_rgba(59,130,246,0.1)]">
                        <Clock className="w-5 h-5 text-blue-400 drop-shadow-[0_0_10px_currentColor] brightness-110" />
                    </div>
                    <div>
                        <h2 className="font-bold text-foreground text-lg">Horarios</h2>
                        <p className="text-xs text-foreground/60">Hora estándar de entrada y salida</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-2">
                        <Label className="text-xs font-black text-foreground/50 uppercase tracking-widest ml-1">Hora de Check-in</Label>
                        <Input type="time" value={form.hora_checkin} onChange={e => setForm({ ...form, hora_checkin: e.target.value })} className="glass-panel border-border/50 text-foreground h-12 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs font-black text-foreground/50 uppercase tracking-widest ml-1">Hora de Check-out</Label>
                        <Input type="time" value={form.hora_checkout} onChange={e => setForm({ ...form, hora_checkout: e.target.value })} className="glass-panel border-border/50 text-foreground h-12 rounded-xl" />
                    </div>
                </div>
            </div>

            {/* Ticket */}
            <div className="glass-panel rounded-[2rem] border border-border/50 p-8 space-y-6 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 blur-3xl -z-10 rounded-full pointer-events-none" />
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-foreground/5 rounded-2xl flex items-center justify-center border border-amber-500/20 shadow-[inset_0_0_15px_rgba(245,158,11,0.1)]">
                        <MessageSquare className="w-5 h-5 text-amber-400 drop-shadow-[0_0_10px_currentColor] brightness-110" />
                    </div>
                    <div>
                        <h2 className="font-bold text-foreground text-lg">Mensaje en el Ticket</h2>
                        <p className="text-xs text-foreground/60">Se imprime al final de cada comprobante</p>
                    </div>
                </div>
                <div className="space-y-2">
                    <Label className="text-xs font-black text-foreground/50 uppercase tracking-widest ml-1">Mensaje de agradecimiento</Label>
                    <Input value={form.mensaje_ticket} onChange={e => setForm({ ...form, mensaje_ticket: e.target.value })} placeholder="¡Gracias por su preferencia!" className="glass-panel border-border/50 text-foreground placeholder:text-foreground/30 h-12 rounded-xl" />
                </div>
            </div>
        </>
    );
}
