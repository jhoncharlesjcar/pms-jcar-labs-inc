import React, { useState, memo } from 'react';
import { Globe, CheckCircle, Copy, ExternalLink, Share2, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const ConfigEnlacesPublicos = memo(function ConfigEnlacesPublicos({ hotelId, setShowQrModal }) {
    const [copiedBooking, setCopiedBooking] = useState(false);
    const [copiedCheckin, setCopiedCheckin] = useState(false);

    const bookingUrl = `${window.location.origin}/booking/${hotelId}`;
    const checkinUrl = `${window.location.origin}/public-checkin/${hotelId}`;

    const handleCopy = (text, type) => {
        navigator.clipboard.writeText(text);
        if (type === 'booking') {
            setCopiedBooking(true);
            setTimeout(() => setCopiedBooking(false), 2000);
        } else {
            setCopiedCheckin(true);
            setTimeout(() => setCopiedCheckin(false), 2000);
        }
    };

    return (
        <div className="bg-card/40 backdrop-blur-xl rounded-xl border border-border/40 p-5 space-y-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-border/40 pb-4">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center border border-emerald-500/20 shadow-xs">
                        <Globe className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div>
                        <h2 className="font-extrabold text-lg text-foreground tracking-tight">Enlaces Públicos y Autogestión</h2>
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-0.5">Links directos para tus clientes (0% comisión)</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {/* Canal 1: Motor de Reservas */}
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 space-y-4">
                    <div className="flex justify-between items-start">
                        <div className="">
                            <span className="text-[8px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 shadow-xs">
                                0% Comisión
                            </span>
                            <h3 className="font-extrabold text-sm sm:text-base text-foreground mt-2 tracking-tight">Motor de Reservas Directo</h3>
                            <p className="text-[10px] sm:text-xs font-bold text-muted-foreground mt-1">
                                Permite a tus huéspedes cotizar, ver tarifas dinámicas y reservar desde su móvil.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 bg-background/50 p-2 rounded-lg border border-border/40 shadow-inner">
                        <span className="text-[10px] sm:text-xs text-muted-foreground truncate flex-1 px-2 font-mono font-bold">
                            {bookingUrl}
                        </span>
                        <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => handleCopy(bookingUrl, 'booking')}
                            className="h-8 w-8 p-0 rounded-md text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 active:scale-95 transition-all"
                        >
                            {copiedBooking ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                        </Button>
                    </div>

                    <div className="flex gap-2">
                        <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => window.open(bookingUrl, '_blank')}
                            className="flex-1 text-[9px] font-extrabold uppercase tracking-widest gap-1 h-8 rounded-lg border-border/40 hover:bg-emerald-500/5 active:scale-95 transition-all"
                        >
                            <ExternalLink className="w-3.5 h-3.5" /> Probar
                        </Button>
                        <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                                const text = `🏨 *Reserva Directamente con Nosotros* 🏨\n\nEvita comisiones y asegura el mejor precio reservando directamente desde nuestro portal web:\n\n🔗 ${bookingUrl}\n\n¡Te esperamos!`;
                                window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
                            }}
                            className="flex-1 text-[9px] font-extrabold uppercase tracking-widest gap-1 h-8 rounded-lg border-emerald-500/20 hover:bg-emerald-500/10 hover:text-emerald-600 text-emerald-500 bg-emerald-500/5 active:scale-95 transition-all shadow-xs"
                        >
                            <Share2 className="w-3.5 h-3.5" /> Compartir
                        </Button>
                        <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => setShowQrModal({ title: 'QR de Reservas Directas', url: bookingUrl })}
                            className="h-8 w-8 p-0 rounded-lg border-border/40 hover:bg-emerald-500/5 active:scale-95 transition-all"
                            title="Mostrar Código QR"
                        >
                            <QrCode className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                </div>

                {/* Canal 2: Check-in Digital */}
                <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-4 space-y-4">
                    <div className="flex justify-between items-start">
                        <div className="">
                            <span className="text-[8px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 shadow-xs">
                                Cumplimiento MINCETUR
                            </span>
                            <h3 className="font-extrabold text-sm sm:text-base text-foreground mt-2 tracking-tight">Check-in Digital Auto-registro</h3>
                            <p className="text-[10px] sm:text-xs font-bold text-muted-foreground mt-1">
                                Envía este link a tus huéspedes antes del ingreso para agilizar el registro legal.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 bg-background/50 p-2 rounded-lg border border-border/40 shadow-inner">
                        <span className="text-[10px] sm:text-xs text-muted-foreground truncate flex-1 px-2 font-mono font-bold">
                            {checkinUrl}
                        </span>
                        <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => handleCopy(checkinUrl, 'checkin')}
                            className="h-8 w-8 p-0 rounded-md text-muted-foreground hover:text-indigo-500 hover:bg-indigo-500/10 active:scale-95 transition-all"
                        >
                            {copiedCheckin ? <CheckCircle className="w-4 h-4 text-indigo-500" /> : <Copy className="w-4 h-4" />}
                        </Button>
                    </div>

                    <div className="flex gap-2">
                        <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => window.open(checkinUrl, '_blank')}
                            className="flex-1 text-[9px] font-extrabold uppercase tracking-widest gap-1 h-8 rounded-lg border-border/40 hover:bg-indigo-500/5 active:scale-95 transition-all"
                        >
                            <ExternalLink className="w-3.5 h-3.5" /> Probar
                        </Button>
                        <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                                const text = `🏨 *Pre-registro Check-in Digital* 🏨\n\nPara agilizar tu ingreso y cumplir con las normativas legales, por favor completa tu ficha de huésped antes de llegar al hotel ingresando aquí:\n\n🔗 ${checkinUrl}\n\n¡Gracias por tu colaboración!`;
                                window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
                            }}
                            className="flex-1 text-[9px] font-extrabold uppercase tracking-widest gap-1 h-8 rounded-lg border-indigo-500/20 hover:bg-indigo-500/10 hover:text-indigo-600 text-indigo-500 bg-indigo-500/5 active:scale-95 transition-all shadow-xs"
                        >
                            <Share2 className="w-3.5 h-3.5" /> Compartir
                        </Button>
                        <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => setShowQrModal({ title: 'QR de Check-in Digital', url: checkinUrl })}
                            className="h-8 w-8 p-0 rounded-lg border-border/40 hover:bg-indigo-500/5 active:scale-95 transition-all"
                            title="Mostrar Código QR"
                        >
                            <QrCode className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                </div>
            </div>

            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-[10px] text-emerald-600 dark:text-emerald-400 leading-relaxed font-bold shadow-xs">
                <strong className="font-black uppercase tracking-widest">💡 Consejo Pro:</strong> Puedes imprimir los códigos QR y colocarlos físicamente en un cartel acrílico en el mostrador de recepción o en el lobby. Así tus huéspedes pueden auto-registrarse escaneando desde su celular, reduciendo tiempos de espera a cero.
            </div>
        </div>
    );
});
ConfigEnlacesPublicos.displayName = 'ConfigEnlacesPublicos';
