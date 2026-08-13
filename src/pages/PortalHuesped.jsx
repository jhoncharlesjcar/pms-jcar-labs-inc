import { useState, memo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import {
    Wifi, Coffee, MessageCircle, 
    Clock, Utensils, Info 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export const PortalHuesped = memo(function PortalHuesped() {
    const { reservaId } = useParams();
    const [activeTab, setActiveTab] = useState('resumen');

    // Fetch Reserva
    const { data: reserva, isLoading: loadReserva } = useQuery({
        queryKey: ['portal_reserva', reservaId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('reservas')
                .select('*, hoteles(nombre, celular, telefono)')
                .eq('id', reservaId)
                .single();
            if (error) throw error;
            return data;
        },
        enabled: !!reservaId
    });

    // Fetch Servicios Extra (Minimarket / Room Service)
    const { data: extras = [] } = useQuery({
        queryKey: ['portal_extras', reserva?.hotel_id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('servicios_extra')
                .select('*')
                .eq('hotel_id', reserva.hotel_id)
                .eq('disponible', true);
            if (error) throw error;
            return data;
        },
        enabled: !!reserva?.hotel_id
    });

    if (loadReserva) {
        return <div className="flex h-screen items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
    }

    if (!reserva) {
        return <div className="p-8 text-center text-red-500">No se encontró la reserva.</div>;
    }

    const handleRoomService = (extra) => {
        toast.success(`Pedido de ${extra.nombre} enviado a recepción.`, {
            description: "Se lo llevaremos a su habitación en breve."
        });
        // En el futuro, esto se inserta en ventas_pos con estado "pendiente"
    };

    const handleWhatsApp = () => {
        const telefono = reserva.hoteles?.celular || reserva.hoteles?.telefono;
        if (!telefono) {
            toast.error("El hotel no tiene WhatsApp configurado.");
            return;
        }
        let numLimpio = telefono.replace(/\D/g, '');
        if (!numLimpio.startsWith('51') && numLimpio.length === 9) numLimpio = '51' + numLimpio;
        const msg = `Hola Recepción, soy el huésped de la habitación ${reserva.habitacion_numero}. Necesito ayuda con: `;
        window.open(`https://wa.me/${numLimpio}?text=${encodeURIComponent(msg)}`, '_blank');
    };

    return (
        <div className="min-h-screen bg-muted/30 pb-20 font-inter">
            {/* Cabecera Móvil */}
            <div className="bg-primary px-6 pt-10 pb-6 rounded-b-[2.5rem] shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-xl" />
                <div className="relative z-10 flex justify-between items-center text-white">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-primary-foreground/80">Bienvenido(a)</p>
                        <h1 className="text-2xl font-extrabold tracking-tight">{reserva.huesped_nombre?.split(' ')[0]}</h1>
                    </div>
                    <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20">
                        <span className="font-black text-lg">H{reserva.habitacion_numero}</span>
                    </div>
                </div>
            </div>

            {/* Contenido */}
            <div className="px-5 -mt-4 relative z-20 space-y-4">
                
                {activeTab === 'resumen' && (
                    <div className="space-y-4 fade-in">
                        {/* Tarjeta de WiFi */}
                        <div className="bg-card rounded-2xl p-5 shadow-sm border border-border/50 flex items-center gap-4">
                            <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center shrink-0">
                                <Wifi className="w-6 h-6 text-blue-500" />
                            </div>
                            <div>
                                <h3 className="font-bold text-sm">Red WiFi: <span className="text-foreground">{reserva.hoteles?.nombre || 'Hotel'} Guest</span></h3>
                                <p className="text-xs text-muted-foreground mt-0.5 font-mono bg-muted px-2 py-0.5 rounded inline-block">Pass: bienvenidos2026</p>
                            </div>
                        </div>

                        {/* Tarjeta de Estadía */}
                        <div className="bg-card rounded-2xl p-5 shadow-sm border border-border/50">
                            <h3 className="font-extrabold text-sm mb-3 flex items-center gap-2"><Clock className="w-4 h-4 text-primary" /> Tu Estadía</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Check-out</p>
                                    <p className="font-bold text-foreground text-sm mt-0.5">{reserva.fecha_salida}</p>
                                    <p className="text-xs text-muted-foreground">Antes de las 12:00 PM</p>
                                </div>
                                <div>
                                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Saldo Cuenta</p>
                                    <p className="font-black text-primary text-xl tabular-nums mt-0.5">S/ {reserva.total}</p>
                                    <p className="text-xs text-muted-foreground">Estado: {reserva.estado.toUpperCase()}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'room_service' && (
                    <div className="space-y-4 fade-in pb-4">
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-3 text-amber-700 dark:text-amber-500">
                            <Utensils className="w-5 h-5 shrink-0" />
                            <p className="text-xs">Los pedidos se cargarán automáticamente a la cuenta de su habitación tras ser entregados.</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {extras.map(extra => (
                                <div key={extra.id} className="bg-card border border-border/50 rounded-2xl p-4 flex flex-col items-center text-center shadow-sm">
                                    <span className="text-3xl mb-2">{extra.emoji || '🍽️'}</span>
                                    <h4 className="font-bold text-xs leading-tight mb-1">{extra.nombre}</h4>
                                    <p className="font-black italic text-primary text-sm mt-auto">S/ {extra.precio}</p>
                                    <Button onClick={() => handleRoomService(extra)} size="sm" className="w-full h-8 mt-3 text-[10px] font-bold uppercase rounded-lg">Pedir</Button>
                                </div>
                            ))}
                            {extras.length === 0 && (
                                <div className="col-span-2 text-center text-xs text-muted-foreground py-8">
                                    No hay productos disponibles en este momento.
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'conserje' && (
                    <div className="space-y-4 fade-in">
                        <div className="bg-card rounded-2xl p-6 shadow-sm border border-border/50 text-center">
                            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/20">
                                <MessageCircle className="w-8 h-8 text-green-500" />
                            </div>
                            <h3 className="font-extrabold text-lg mb-2">¿Necesitas algo?</h3>
                            <p className="text-xs text-muted-foreground mb-6">
                                Toallas extra, ayuda con el equipaje, o recomendaciones de restaurantes locales. Estamos a un mensaje de distancia.
                            </p>
                            <Button onClick={handleWhatsApp} className="w-full h-12 bg-[#25D366] hover:bg-[#128C7E] text-white font-bold rounded-xl gap-2">
                                <MessageCircle className="w-5 h-5" /> Hablar por WhatsApp
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Tab Bar (Mobile App Style) */}
            <div className="fixed bottom-0 left-0 right-0 bg-card/80 backdrop-blur-xl border-t border-border/50 px-6 py-3 flex justify-between items-center z-50">
                <button 
                    onClick={() => setActiveTab('resumen')}
                    className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'resumen' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                >
                    <Info className={`w-6 h-6 ${activeTab === 'resumen' ? 'fill-primary/20' : ''}`} />
                    <span className="text-[10px] font-bold">Resumen</span>
                </button>
                <button 
                    onClick={() => setActiveTab('room_service')}
                    className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'room_service' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                >
                    <Coffee className={`w-6 h-6 ${activeTab === 'room_service' ? 'fill-primary/20' : ''}`} />
                    <span className="text-[10px] font-bold">Servicios</span>
                </button>
                <button 
                    onClick={() => setActiveTab('conserje')}
                    className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'conserje' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                >
                    <MessageCircle className={`w-6 h-6 ${activeTab === 'conserje' ? 'fill-primary/20' : ''}`} />
                    <span className="text-[10px] font-bold">Conserje</span>
                </button>
            </div>
            
            <style>{`
                .fade-in { animation: fadeIn 0.3s ease-in-out; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
});

export default PortalHuesped;
