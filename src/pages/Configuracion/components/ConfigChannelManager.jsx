import React, { useState, useEffect } from 'react';
import { Network, Link2, Key, Loader2, Save } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/config/supabase';
import logger from '@/lib/logger';
import { useHotelData } from '@/hooks/useHotelData';

export function ConfigChannelManager() {
    const { hotelId } = useHotelData();
    const [loading, setLoading] = useState(false);
    const [channels, setChannels] = useState({
        booking: { is_active: false, api_key: '', hotel_code_ota: '' },
        airbnb: { is_active: false, api_key: '', hotel_code_ota: '' }
    });
    
    // Simulating loading data from ota_config table
    useEffect(() => {
        async function fetchConfig() {
            if (!hotelId) return;
            const { data, error } = await supabase.from('ota_config').select('*').eq('hotel_id', hotelId);
            if (!error && data) {
                const newChannels = { ...channels };
                data.forEach(c => {
                    if (newChannels[c.ota_name]) {
                        newChannels[c.ota_name] = c;
                    }
                });
                setChannels(newChannels);
            }
        }
        fetchConfig();
    }, [hotelId]);

    const handleSave = async (ota_name) => {
        setLoading(true);
        try {
            const config = channels[ota_name];
            
            // Validate
            if (config.is_active && (!config.api_key || !config.hotel_code_ota)) {
                toast.error('Llena todos los campos para activar el canal');
                setLoading(false);
                return;
            }

            const { error } = await supabase.from('ota_config').upsert({
                hotel_id: hotelId,
                ota_name,
                is_active: config.is_active,
                api_key: config.api_key,
                hotel_code_ota: config.hotel_code_ota
            }, { onConflict: 'hotel_id, ota_name' });

            if (error) throw error;
            toast.success(`Configuración de ${ota_name} guardada`);
        } catch (error) {
            toast.error('Error guardando la configuración OTA');
            logger.error('Error guardando configuración OTA', error);
        } finally {
            setLoading(false);
        }
    };

    const ChannelCard = ({ name, title, colorClass, icon: Icon }) => {
        const config = channels[name];
        
        return (
            <div className={`p-5 rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm space-y-4 shadow-sm`}>
                <div className="flex justify-between items-center border-b border-border/40 pb-3">
                    <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorClass}`}>
                            <Icon className="w-4 h-4" />
                        </div>
                        <h3 className="font-bold text-base">{title}</h3>
                    </div>
                    <Switch 
                        checked={config.is_active}
                        onCheckedChange={v => setChannels({...channels, [name]: { ...config, is_active: v }})}
                    />
                </div>
                
                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Hotel ID (Booking)</Label>
                        <Input 
                            value={config.hotel_code_ota}
                            onChange={e => setChannels({...channels, [name]: { ...config, hotel_code_ota: e.target.value }})}
                            placeholder="Ej. 1234567"
                            className="bg-background/50 h-9 text-sm"
                            disabled={!config.is_active}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">API Key / Token</Label>
                        <Input 
                            type="password"
                            value={config.api_key}
                            onChange={e => setChannels({...channels, [name]: { ...config, api_key: e.target.value }})}
                            placeholder="••••••••••••••••"
                            className="bg-background/50 h-9 text-sm font-mono tracking-widest"
                            disabled={!config.is_active}
                        />
                    </div>
                    <Button onClick={() => handleSave(name)} disabled={loading} size="sm" className="w-full gap-2">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Guardar {title}
                    </Button>
                </div>
            </div>
        );
    };

    return (
        <div className="bg-card/40 backdrop-blur-xl rounded-xl border border-border/40 p-5 space-y-6 shadow-sm">
            <div className="flex items-center gap-3 border-b border-border/40 pb-4">
                <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center border border-blue-500/20 shadow-xs">
                    <Network className="w-4 h-4 text-blue-500" />
                </div>
                <div>
                    <h2 className="font-extrabold text-lg text-foreground tracking-tight">Channel Manager (OTAs)</h2>
                    <p className="text-[10px] font-bold text-muted-foreground">Sincronización de inventario con agencias</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ChannelCard 
                    name="booking" 
                    title="Booking.com" 
                    colorClass="bg-[#003580]/10 text-[#003580] border-[#003580]/20" 
                    icon={Link2} 
                />
                <ChannelCard 
                    name="airbnb" 
                    title="Airbnb" 
                    colorClass="bg-[#FF5A5F]/10 text-[#FF5A5F] border-[#FF5A5F]/20" 
                    icon={Link2} 
                />
            </div>
            
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mt-6 flex items-start gap-3">
                <Key className="w-5 h-5 text-amber-600 mt-0.5" />
                <div className="text-sm text-amber-700 dark:text-amber-400">
                    <p className="font-bold mb-1">Mapeo de Habitaciones</p>
                    <p className="text-xs">
                        Una vez guardadas las credenciales, el sistema descargará el inventario de la OTA y podrás mapear tus habitaciones locales con las virtuales.
                    </p>
                </div>
            </div>
        </div>
    );
}
