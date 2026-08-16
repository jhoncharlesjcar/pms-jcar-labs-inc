import { useState, memo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/db';
import { Key, Plus, Copy, Check, Trash2, RefreshCw, ShieldCheck, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

// Generador de código aleatorio
const generarCodigo = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = crypto.getRandomValues(new Uint8Array(12));
    let offset = 0;
    const segment = (n) => Array.from({ length: n }, () => chars[bytes[offset++] & 31]).join('');
    return `${segment(4)}-${segment(4)}-${segment(4)}`;
};

const GeneradorCodigos = memo(function GeneradorCodigos() {
    const qc = useQueryClient();
    const [descripcion, setDescripcion] = useState('');
    const [copiado, setCopiado] = useState(null);

    const { data: codigos = [] } = useQuery({
        queryKey: ['codigos-desbloqueo'],
        queryFn: () => db.entities.CodigoDesbloqueo.list('-created_date'),
    });

    const crearCodigo = useMutation({
        mutationFn: (data) => db.entities.CodigoDesbloqueo.create(data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['codigos-desbloqueo'] }); setDescripcion(''); },
    });

    const deleteCodigo = useMutation({
        mutationFn: (id) => db.entities.CodigoDesbloqueo.delete(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['codigos-desbloqueo'] }),
    });

    const generarYCrear = () => {
        const codigo = generarCodigo();
        /** @type {any} */
        const payload = { codigo, descripcion: descripcion || 'Sin descripción', usado: false };
        crearCodigo.mutate(payload);
    };

    const copiar = (codigo) => {
        navigator.clipboard.writeText(codigo);
        setCopiado(codigo);
        setTimeout(() => setCopiado(null), 2000);
    };

    const disponibles = codigos.filter(c => !c.usado);
    const usados = codigos.filter(c => c.usado);

    return (
        <div className="space-y-5">
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-500" />
                <h3 className="font-extrabold text-sm tracking-tight text-foreground">Códigos de Desbloqueo</h3>
            </div>

            <p className="text-[10px] font-bold text-muted-foreground bg-secondary/50 rounded-xl p-3 border border-border/40">
                Genera códigos únicos de un solo uso para que los administradores puedan agregar hoteles o gestionar staff. Cada código solo puede usarse <strong>una vez</strong>.
            </p>

            {/* Formulario nuevo código */}
            {/* Formulario nuevo código */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 space-y-2 backdrop-blur-sm">
                <p className="text-[9px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-500">Generar nuevo código</p>
                <div>
                    <Label className="text-[9px] font-black uppercase tracking-widest text-amber-600/80 dark:text-amber-500/80">Descripción (para qué admin / hotel)</Label>
                    <Input
                        className="mt-1 text-xs h-9 px-3 rounded-md font-bold shadow-inner border-amber-500/20 bg-background/50"
                        value={descripcion}
                        onChange={e => setDescripcion(e.target.value)}
                        placeholder="Ej: Para Hotel Los Andes - Waldesmit"
                    />
                </div>
                <Button
                    className="w-full gap-2 bg-amber-500 hover:bg-amber-600 h-9 text-[10px] font-extrabold uppercase tracking-widest rounded-md mt-1 shadow-sm"
                    onClick={generarYCrear}
                    disabled={crearCodigo.isPending}
                >
                    {crearCodigo.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Generar Código
                </Button>
            </div>

            {/* Códigos disponibles */}
            {/* Códigos disponibles */}
            <div className="space-y-2">
                <div className="flex items-center gap-1.5 mb-1.5 ml-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-foreground">Disponibles ({disponibles.length})</p>
                </div>
                {disponibles.length === 0 && (
                    <p className="text-[10px] text-muted-foreground text-center py-3 font-bold border border-dashed border-border/40 rounded-xl bg-card/20">Sin códigos disponibles</p>
                )}
                {disponibles.map(c => (
                    <div key={c.id} className="bg-card/60 backdrop-blur-sm border border-border/40 rounded-xl p-2.5 flex items-center gap-3 shadow-sm hover:border-green-500/30 transition-colors">
                        <div className="flex-1 min-w-0">
                            <p className="font-mono font-black text-foreground tracking-widest text-xs">{c.codigo}</p>
                            {c.descripcion && <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5 truncate">{c.descripcion}</p>}
                        </div>
                        <button
                            onClick={() => copiar(c.codigo)}
                            className="p-1.5 rounded-md hover:bg-secondary transition-[transform,opacity] flex-shrink-0"
                            title="Copiar código"
                        >
                            {copiado === c.codigo
                                ? <Check className="w-3.5 h-3.5 text-green-600" />
                                : <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                            }
                        </button>
                        <button
                            onClick={() => {
                                toast('¿Eliminar este código?', {
                                    action: { label: 'Eliminar', onClick: () => deleteCodigo.mutate(c.id) },
                                    cancel: { label: 'Cancelar', onClick: () => {} }
                                });
                            }}
                            className="p-1.5 rounded-md hover:bg-red-500/10 hover:text-red-500 transition-[transform,opacity] flex-shrink-0"
                        >
                            <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                    </div>
                ))}
            </div>

            {/* Códigos usados */}
            {usados.length > 0 && (
                <div className="space-y-2 mt-4">
                    <div className="flex items-center gap-1.5 mb-1.5 ml-1">
                        <AlertCircle className="w-3.5 h-3.5 text-muted-foreground" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Usados ({usados.length})</p>
                    </div>
                    {usados.map(c => (
                        <div key={c.id} className="bg-muted/10 border border-border/40 rounded-xl p-2.5 flex items-center gap-3 opacity-60">
                            <div className="flex-1 min-w-0">
                                <p className="font-mono text-xs font-black text-muted-foreground line-through tracking-widest">{c.codigo}</p>
                                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">
                                    Usado por: {c.usado_por || 'desconocido'} {c.fecha_uso ? `· ${c.fecha_uso}` : ''}
                                </p>
                            </div>
                            <button onClick={() => deleteCodigo.mutate(c.id)} className="p-1.5 rounded-md hover:bg-red-500/10 hover:text-red-500 transition-[transform,opacity] flex-shrink-0">
                                <Trash2 className="w-3 h-3 text-muted-foreground" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
        </div>
    );
});
GeneradorCodigos.displayName = 'GeneradorCodigos';
export default GeneradorCodigos;
