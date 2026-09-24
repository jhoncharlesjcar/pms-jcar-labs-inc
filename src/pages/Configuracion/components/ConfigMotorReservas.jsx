import React, { useState } from 'react';
import { Globe, Code2, Copy, CheckCircle, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useHotelData } from '@/hooks/useHotelData';

export function ConfigMotorReservas() {
    const { hotelId } = useHotelData();
    const [copied, setCopied] = useState(false);
    const [widgetConfig, setWidgetConfig] = useState({
        color: '#10B981', // emerald-500
        theme: 'light',
        height: '600px'
    });

    const publicUrl = window.location.origin + `/booking/${hotelId}`;
    const iframeCode = `<iframe src="${publicUrl}?color=${widgetConfig.color.replace('#', '')}&theme=${widgetConfig.theme}" width="100%" height="${widgetConfig.height}" style="border:none; border-radius:12px; overflow:hidden;" allowtransparency="true"></iframe>`;

    const handleCopy = () => {
        navigator.clipboard.writeText(iframeCode);
        setCopied(true);
        toast.success('Código copiado al portapapeles');
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="bg-card/40 backdrop-blur-xl rounded-xl border border-border/40 p-5 space-y-6 shadow-sm">
            <div className="flex items-center gap-3 border-b border-border/40 pb-4">
                <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center border border-emerald-500/20 shadow-xs">
                    <Globe className="w-4 h-4 text-emerald-500" />
                </div>
                <div>
                    <h2 className="font-extrabold text-lg text-foreground tracking-tight">Motor de Reservas Propio</h2>
                    <p className="text-xs font-bold text-muted-foreground">Vende directo desde tu web sin comisiones</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Panel de Configuración */}
                <div className="space-y-5">
                    <p className="text-sm text-muted-foreground">
                        Personaliza la apariencia de tu motor de reservas y obtén el código para insertarlo en tu página web.
                    </p>

                    <div className="space-y-4 bg-background/50 p-4 rounded-xl border border-border/40">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Color Principal</Label>
                            <div className="flex gap-2">
                                <Input 
                                    type="color" 
                                    value={widgetConfig.color}
                                    onChange={(e) => setWidgetConfig({...widgetConfig, color: e.target.value})}
                                    className="w-12 h-10 p-1 cursor-pointer"
                                />
                                <Input 
                                    type="text" 
                                    value={widgetConfig.color}
                                    onChange={(e) => setWidgetConfig({...widgetConfig, color: e.target.value})}
                                    className="h-10 font-mono text-sm uppercase flex-1"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Tema Base</Label>
                            <select 
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={widgetConfig.theme}
                                onChange={(e) => setWidgetConfig({...widgetConfig, theme: e.target.value})}
                            >
                                <option value="light">Claro (Recomendado)</option>
                                <option value="dark">Oscuro</option>
                            </select>
                        </div>
                        
                        <div className="space-y-1.5">
                            <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Altura del Widget</Label>
                            <Input 
                                type="text" 
                                value={widgetConfig.height}
                                onChange={(e) => setWidgetConfig({...widgetConfig, height: e.target.value})}
                                className="h-10 text-sm"
                                placeholder="ej. 600px o 100vh"
                            />
                        </div>
                    </div>
                </div>

                {/* Vista Previa y Código */}
                <div className="space-y-4">
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex flex-col items-center justify-center text-center gap-2 h-40">
                        <Smartphone className="w-8 h-8 text-emerald-600 mb-2" />
                        <h4 className="font-bold text-sm text-emerald-900 dark:text-emerald-100">Vista Previa Dinámica</h4>
                        <a href={`${publicUrl}?color=${widgetConfig.color.replace('#', '')}&theme=${widgetConfig.theme}`} target="_blank" rel="noreferrer" className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold underline hover:text-emerald-700">
                            Abrir en nueva pestaña
                        </a>
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1 flex items-center gap-1">
                                <Code2 className="w-3 h-3" /> Código de Inserción
                            </Label>
                        </div>
                        <div className="relative group">
                            <textarea 
                                readOnly 
                                value={iframeCode}
                                className="w-full h-24 bg-black/90 text-emerald-400 font-mono text-[11px] p-3 rounded-xl resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                            <Button 
                                size="sm" 
                                onClick={handleCopy}
                                className={`absolute top-2 right-2 h-7 px-2 text-xs transition-all ${copied ? 'bg-green-600 hover:bg-green-600' : 'bg-white/10 hover:bg-white/20 text-white backdrop-blur-md'}`}
                            >
                                {copied ? <CheckCircle className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                                {copied ? 'Copiado' : 'Copiar'}
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground ml-1">
                            Pega este código en el HTML de tu página web (ej. WordPress, Wix, Squarespace) en la sección donde quieras que aparezca el motor de reservas.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
