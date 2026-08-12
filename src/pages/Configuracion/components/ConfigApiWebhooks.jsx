import { useState } from 'react';

import { Key, Webhook, BookOpen, Plus, Trash2, Copy, AlertTriangle, Link as LinkIcon, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export function ConfigApiWebhooks({ _hotelId }) {
    const [apiKey, setApiKey] = useState(null);
    const [webhooks, setWebhooks] = useState([
        { id: 1, evento: 'reserva.creada', url: 'https://hooks.zapier.com/hooks/catch/123456/abcde', activo: true }
    ]);
    const [nuevoWebhook, setNuevoWebhook] = useState({ evento: 'reserva.creada', url: '' });

    // En un entorno real, la API Key se encriptaría y se llamaría a una Edge Function para generarla.
    const generarApiKey = () => {
        const nuevaKey = 'pk_live_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        setApiKey(nuevaKey);
        toast.success("API Key generada con éxito");
    };

    const copiarApiKey = () => {
        if (!apiKey) return;
        navigator.clipboard.writeText(apiKey);
        toast.success("API Key copiada al portapapeles");
    };

    const addWebhook = () => {
        if (!nuevoWebhook.url) {
            toast.error("Ingresa una URL válida");
            return;
        }
        setWebhooks([...webhooks, { ...nuevoWebhook, id: Date.now(), activo: true }]);
        setNuevoWebhook({ ...nuevoWebhook, url: '' });
        toast.success("Webhook añadido");
    };

    const deleteWebhook = (id) => {
        setWebhooks(webhooks.filter(w => w.id !== id));
        toast.success("Webhook eliminado");
    };

    return (
        <div className="space-y-8">
            <div className="border-b border-border/50 pb-5">
                <h2 className="text-xl font-extrabold flex items-center gap-2">
                    <Webhook className="w-5 h-5 text-primary" /> Ecosistema de Integración (APIs)
                </h2>
                <p className="text-muted-foreground text-sm mt-1">Conecta tu hotel con cientos de aplicaciones externas como Zapier, CRMs contables o sistemas de llaves electrónicas.</p>
            </div>

            {/* API Keys */}
            <div className="bg-card border border-border/50 p-6 rounded-2xl shadow-sm space-y-4">
                <div className="flex items-center gap-2 mb-4">
                    <div className="p-1.5 bg-blue-500/10 rounded-md">
                        <Key className="w-4 h-4 text-blue-500" />
                    </div>
                    <h3 className="font-bold text-base">Claves de API (API Keys)</h3>
                </div>

                {!apiKey ? (
                    <div className="bg-muted/30 p-6 rounded-xl border border-dashed text-center space-y-3">
                        <p className="text-sm text-muted-foreground">No tienes ninguna API Key activa para este hotel.</p>
                        <Button onClick={generarApiKey} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold h-10">
                            <Plus className="w-4 h-4" /> Generar API Key Principal
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl flex gap-3 text-blue-700 dark:text-blue-400">
                            <AlertTriangle className="w-5 h-5 shrink-0" />
                            <div className="text-sm">
                                <p className="font-bold">Guarda esta clave en un lugar seguro.</p>
                                <p className="text-xs mt-0.5">Por motivos de seguridad, no volveremos a mostrar la clave completa una vez que cierres esta pantalla. Si la pierdes, tendrás que generar una nueva.</p>
                            </div>
                        </div>

                        <div className="flex gap-2 items-center">
                            <Input 
                                readOnly 
                                value={apiKey} 
                                className="font-mono bg-background text-foreground tracking-wider h-12"
                            />
                            <Button onClick={copiarApiKey} variant="secondary" className="h-12 px-6 gap-2 font-bold">
                                <Copy className="w-4 h-4" /> Copiar
                            </Button>
                            <Button onClick={() => setApiKey(null)} variant="destructive" className="h-12 px-4" title="Revocar Key">
                                <RefreshCcw className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Webhooks */}
            <div className="bg-card border border-border/50 p-6 rounded-2xl shadow-sm space-y-6">
                <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 bg-primary/10 rounded-md">
                        <LinkIcon className="w-4 h-4 text-primary" />
                    </div>
                    <h3 className="font-bold text-base">Webhooks (Eventos en tiempo real)</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-muted/30 p-4 rounded-xl border border-border/50">
                    <div className="md:col-span-4 space-y-1">
                        <Label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Evento</Label>
                        <Select value={nuevoWebhook.evento} onValueChange={(v) => setNuevoWebhook({...nuevoWebhook, evento: v})}>
                            <SelectTrigger className="h-10 bg-background"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="reserva.creada">reserva.creada</SelectItem>
                                <SelectItem value="reserva.cancelada">reserva.cancelada</SelectItem>
                                <SelectItem value="checkin.completado">checkin.completado</SelectItem>
                                <SelectItem value="pago.registrado">pago.registrado</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="md:col-span-6 space-y-1">
                        <Label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">URL de Destino (Endpoint)</Label>
                        <Input 
                            placeholder="https://hooks.zapier.com/..." 
                            value={nuevoWebhook.url}
                            onChange={(e) => setNuevoWebhook({...nuevoWebhook, url: e.target.value})}
                            className="h-10 bg-background"
                        />
                    </div>
                    <div className="md:col-span-2">
                        <Button onClick={addWebhook} className="w-full h-10 gap-2 font-bold text-xs"><Plus className="w-4 h-4" /> Añadir</Button>
                    </div>
                </div>

                {webhooks.length > 0 && (
                    <div className="space-y-2 mt-4">
                        {webhooks.map(wh => (
                            <div key={wh.id} className="flex items-center justify-between p-3 bg-background border border-border/50 rounded-lg shadow-sm">
                                <div>
                                    <span className="bg-primary/10 text-primary text-[10px] uppercase tracking-widest font-black px-2 py-0.5 rounded border border-primary/20 mr-2">
                                        {wh.evento}
                                    </span>
                                    <span className="text-sm font-mono text-muted-foreground">{wh.url}</span>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => deleteWebhook(wh.id)} className="text-red-500 hover:text-red-600 hover:bg-red-500/10">
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Documentation Hub */}
            <div className="bg-gradient-to-r from-primary/10 to-transparent border border-primary/20 p-6 rounded-2xl flex items-center justify-between">
                <div>
                    <h3 className="font-extrabold text-foreground flex items-center gap-2 mb-1">
                        <BookOpen className="w-5 h-5 text-primary" /> Documentación para Desarrolladores
                    </h3>
                    <p className="text-sm text-muted-foreground">Encuentra tutoriales, ejemplos de código y la especificación OpenAPI 3.0 completa.</p>
                </div>
                <Button variant="outline" className="gap-2 border-primary/30 text-primary hover:bg-primary/10 font-bold hidden sm:flex">
                    Ir al Developer Hub <ArrowUpRight className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
}

// ArrowUpRight icon missing in imports, adding it here or replacing it. I'll import it above in the multi-replace if it fails.
import { ArrowUpRight } from 'lucide-react';
