import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/db';
import { Key, Plus, Copy, Check, Trash2, RefreshCw, ShieldCheck, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Generador de código aleatorio
const generarCodigo = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const segment = (n) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `${segment(4)}-${segment(4)}-${segment(4)}`;
};

export default function GeneradorCodigos() {
    const qc = useQueryClient();
    const [descripcion, setDescripcion] = useState('');
    const [copiado, setCopiado] = useState(null);

    const { data: codigos = [] } = useQuery({
        queryKey: ['codigos-desbloqueo'],
        queryFn: () => db.entities.CodigoDesbloqueo.list('-created_date'),
    });

    const crearCodigo = useMutation({
        mutationFn: (data) => db.entities.CodigoDesbloqueo.create(data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['codigos-desbloqueo'] }); setDescripcion(''); setCodigoNuevo(''); },
    });

    const deleteCodigo = useMutation({
        mutationFn: (id) => db.entities.CodigoDesbloqueo.delete(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['codigos-desbloqueo'] }),
    });

    const generarYCrear = () => {
        const codigo = generarCodigo();
        crearCodigo.mutate({ codigo, descripcion: descripcion || 'Sin descripción', usado: false });
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
            <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-amber-500" />
                <h3 className="font-semibold text-foreground">Códigos de Desbloqueo</h3>
            </div>

            <p className="text-xs text-muted-foreground bg-secondary rounded-xl p-3">
                Genera códigos únicos de un solo uso para que los administradores puedan agregar hoteles o gestionar staff. Cada código solo puede usarse <strong>una vez</strong>.
            </p>

            {/* Formulario nuevo código */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
                <p className="text-sm font-semibold text-amber-800">Generar nuevo código</p>
                <div>
                    <Label className="text-xs">Descripción (para qué admin / hotel)</Label>
                    <Input
                        className="mt-1 text-sm"
                        value={descripcion}
                        onChange={e => setDescripcion(e.target.value)}
                        placeholder="Ej: Para Hotel Los Andes - Waldesmit"
                    />
                </div>
                <Button
                    className="w-full gap-2 bg-amber-500 hover:bg-amber-600"
                    onClick={generarYCrear}
                    disabled={crearCodigo.isPending}
                >
                    {crearCodigo.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Generar Código de Desbloqueo
                </Button>
            </div>

            {/* Códigos disponibles */}
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-green-500" />
                    <p className="text-sm font-semibold text-foreground">Disponibles ({disponibles.length})</p>
                </div>
                {disponibles.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4 border border-dashed rounded-xl">Sin códigos disponibles</p>
                )}
                {disponibles.map(c => (
                    <div key={c.id} className="bg-card border border-green-200 rounded-xl p-3 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                            <p className="font-mono font-bold text-foreground tracking-wider text-sm">{c.codigo}</p>
                            {c.descripcion && <p className="text-xs text-muted-foreground mt-0.5 truncate">{c.descripcion}</p>}
                        </div>
                        <button
                            onClick={() => copiar(c.codigo)}
                            className="p-2 rounded-lg hover:bg-secondary transition-all flex-shrink-0"
                            title="Copiar código"
                        >
                            {copiado === c.codigo
                                ? <Check className="w-4 h-4 text-green-600" />
                                : <Copy className="w-4 h-4 text-muted-foreground" />
                            }
                        </button>
                        <button
                            onClick={() => { if (confirm('¿Eliminar este código?')) deleteCodigo.mutate(c.id); }}
                            className="p-2 rounded-lg hover:bg-red-50 hover:text-red-600 transition-all flex-shrink-0"
                        >
                            <Trash2 className="w-4 h-4 text-muted-foreground" />
                        </button>
                    </div>
                ))}
            </div>

            {/* Códigos usados */}
            {usados.length > 0 && (
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-muted-foreground" />
                        <p className="text-sm font-semibold text-muted-foreground">Usados ({usados.length})</p>
                    </div>
                    {usados.map(c => (
                        <div key={c.id} className="bg-secondary/50 border border-border rounded-xl p-3 flex items-center gap-3 opacity-60">
                            <div className="flex-1 min-w-0">
                                <p className="font-mono text-sm text-muted-foreground line-through tracking-wider">{c.codigo}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Usado por: {c.usado_por || 'desconocido'} {c.fecha_uso ? `· ${c.fecha_uso}` : ''}
                                </p>
                            </div>
                            <button onClick={() => deleteCodigo.mutate(c.id)} className="p-2 rounded-lg hover:bg-red-50 hover:text-red-600 transition-all flex-shrink-0">
                                <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}