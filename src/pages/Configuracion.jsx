// @ts-nocheck
import React, { useState, useEffect, useRef, memo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, CheckCircle, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHotelData } from '@/hooks/use-hotel-data';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { encryptData } from '@/lib/crypto';
import { useGsapStaggerList } from '@/hooks/useGsapStaggerList';
import { useGsapCardHover } from '@/hooks/useGsapCardHover';
import { cn } from '@/lib/utils';

// Subcomponentes importados
import { ConfigDatosHotel } from './Configuracion/components/ConfigDatosHotel';
import { ConfigEnlacesPublicos } from './Configuracion/components/ConfigEnlacesPublicos';
import { ConfigHorariosTicket } from './Configuracion/components/ConfigHorariosTicket';
import { ConfigSunat } from './Configuracion/components/ConfigSunat';
import { ConfigPersonal } from './Configuracion/components/ConfigPersonal';
import { ConfigTarifas } from './Configuracion/components/ConfigTarifas';
import { ConfigImportadorExcel } from './Configuracion/components/ConfigImportadorExcel';
import { ConfigFidelidad } from './Configuracion/components/ConfigFidelidad';
import { ConfigZonaPeligrosa } from './Configuracion/components/ConfigZonaPeligrosa';
import { ConfigPagos } from './Configuracion/components/ConfigPagos';
import { ConfigChannelManager } from './Configuracion/components/ConfigChannelManager';
import { ConfigYield } from './Configuracion/components/ConfigYield';
import { ConfigMotorReservas } from './Configuracion/components/ConfigMotorReservas';
import { ConfigApiWebhooks } from './Configuracion/components/ConfigApiWebhooks';

/** ─── Wrapper de sección con hover micro-interactions ─── */
/** @param {{children: any, className?: string}} props */
function ConfigSection({ children, className = '' }) {
    const ref = useRef(null);

    useGsapCardHover(ref, {
        scale: 1.005,
        glowColor: 'hsla(var(--primary), 0.08)',
        glowSize: 24,
        duration: 0.35,
    });

    return (
        <div
            ref={ref}
            className={cn(className)}
        >
            {children}
        </div>
    );
}
ConfigSection.displayName = 'ConfigSection';

const Configuracion = memo(function Configuracion() {
    const queryClient = useQueryClient();
    const { db: hotelDb, hotelId } = useHotelData();
    const [saved, setSaved] = useState(false);
    const [showQrModal, setShowQrModal] = useState(null);
    const [activeTab, setActiveTab] = useState('general');

    const [form, setForm] = useState({
        nombre: '',
        direccion: '',
        telefono: '',
        ruc: '',
        razon_social: '',
        check_in_hora: '13:00',
        check_out_hora: '12:00',
        tolerancia_minutos: 15,
        sunat_usuario_sol: '',
        sunat_clave_sol: '',
        sunat_certificado_pem: '',
        sunat_modo_prueba: true,
        pts_por_sol: 1,
        soles_por_punto: 0.1,
        modo_automatico: false,
        pasarela_activa: 'culqi',
        pasarela_public_key: '',
        pasarela_private_key: '',
        qr_yape_url: '',
        qr_plin_url: '',
    });

    const { data: hotel } = useQuery({
        queryKey: ['hotel-config', hotelId],
        queryFn: () => hotelDb.Hotel.get(hotelId),
        enabled: !!hotelId,
    });

    useEffect(() => {
        if (hotel) {
            setForm({
                nombre: hotel.nombre || '',
                direccion: hotel.direccion || '',
                telefono: hotel.telefono || '',
                ruc: hotel.ruc || '',
                razon_social: hotel.razon_social || '',
                check_in_hora: hotel.check_in_hora || '13:00',
                check_out_hora: hotel.check_out_hora || '12:00',
                tolerancia_minutos: hotel.tolerancia_minutos ?? 15,
                sunat_usuario_sol: hotel.sunat_usuario_sol || '',
                sunat_clave_sol: hotel.sunat_clave_sol || '',
                sunat_certificado_pem: hotel.sunat_certificado_pem || '',
                sunat_modo_prueba: hotel.sunat_modo_prueba ?? true,
                pts_por_sol: hotel.pts_por_sol ?? 1,
                soles_por_punto: hotel.soles_por_punto ?? 0.1,
                modo_automatico: hotel.modo_automatico ?? false,
                pasarela_activa: hotel.pasarela_activa || 'culqi',
                pasarela_public_key: hotel.pasarela_public_key || '',
                pasarela_private_key: hotel.pasarela_private_key || '', // En la base de datos estará encriptada, idealmente el back la desencriptaría, pero para este demo lo dejamos así.
                qr_yape_url: hotel.qr_yape_url || '',
                qr_plin_url: hotel.qr_plin_url || '',
            });
        }
    }, [hotel]);

    const guardar = useMutation({
        mutationFn: () => {
            const dataToSave = { ...form };
            if (dataToSave.sunat_clave_sol && dataToSave.sunat_clave_sol.length < 50) { // rudimentario check de si ya está cifrada
                dataToSave.sunat_clave_sol = encryptData(dataToSave.sunat_clave_sol);
            }
            if (dataToSave.pasarela_private_key && dataToSave.pasarela_private_key.length < 50) {
                dataToSave.pasarela_private_key = encryptData(dataToSave.pasarela_private_key);
            }
            return hotelDb.Hotel.update(hotelId, dataToSave);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['hotel-config'] });
            queryClient.invalidateQueries({ queryKey: ['hotel-actual'] });
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        },
    });

    const sectionsRef = useGsapStaggerList([hotelId], {
        stagger: 0.05,
        direction: 'y',
        distance: 12,
    });

    return (
        <div className="pt-1 sm:pt-2 pb-12 max-w-2xl mx-auto space-y-4 page-enter">
            {/* Header */}
            <div className="enterprise-card p-4 rounded-xl shadow-sm mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 shadow-xs">
                        <Settings className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">Configuración</h1>
                        <p className="text-muted-foreground mt-0.5 text-[9px] font-black uppercase tracking-widest">Datos del hospedaje y preferencias</p>
                    </div>
                </div>
            </div>

            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                <Button variant={activeTab === 'general' ? 'default' : 'ghost'} className={cn('justify-start h-9 px-3', activeTab === 'general' ? 'bg-primary/20 text-primary hover:bg-primary/30 shadow-none' : '')} onClick={() => setActiveTab('general')}><Settings className="w-4 h-4 mr-2" /> General</Button>
                <Button variant={activeTab === 'ventas' ? 'default' : 'ghost'} className={cn('justify-start h-9 px-3', activeTab === 'ventas' ? 'bg-primary/20 text-primary hover:bg-primary/30 shadow-none' : '')} onClick={() => setActiveTab('ventas')}><Settings className="w-4 h-4 mr-2" /> Ventas & Pagos</Button>
                <Button variant={activeTab === 'distribucion' ? 'default' : 'ghost'} className={cn('justify-start h-9 px-3', activeTab === 'distribucion' ? 'bg-primary/20 text-primary hover:bg-primary/30 shadow-none' : '')} onClick={() => setActiveTab('distribucion')}><Settings className="w-4 h-4 mr-2" /> Distribución</Button>
                <Button variant={activeTab === 'integraciones' ? 'default' : 'ghost'} className={cn('justify-start h-9 px-3', activeTab === 'integraciones' ? 'bg-primary/20 text-primary hover:bg-primary/30 shadow-none' : '')} onClick={() => setActiveTab('integraciones')}><Settings className="w-4 h-4 mr-2" /> OTAs & Canales</Button>
                <Button variant={activeTab === 'api' ? 'default' : 'ghost'} className={cn('justify-start h-9 px-3', activeTab === 'api' ? 'bg-primary/20 text-primary hover:bg-primary/30 shadow-none' : '')} onClick={() => setActiveTab('api')}><Settings className="w-4 h-4 mr-2" /> APIs & Webhooks</Button>
                <Button variant={activeTab === 'avanzado' ? 'default' : 'ghost'} className={cn('justify-start h-9 px-3', activeTab === 'avanzado' ? 'bg-primary/20 text-primary hover:bg-primary/30 shadow-none' : '')} onClick={() => setActiveTab('avanzado')}><Settings className="w-4 h-4 mr-2" /> Avanzado</Button>
            </div>

            {/* Sub-componentes con stagger + hover micro-interactions */}
            <div ref={sectionsRef} className="space-y-4">
                {activeTab === 'general' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <ConfigSection><ConfigDatosHotel form={form} setForm={setForm} /></ConfigSection>
                        <ConfigSection><ConfigEnlacesPublicos hotelId={hotelId} setShowQrModal={setShowQrModal} /></ConfigSection>
                        <ConfigSection><ConfigHorariosTicket form={form} setForm={setForm} /></ConfigSection>
                    </div>
                )}
                {activeTab === 'ventas' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <ConfigSection><ConfigPagos form={form} setForm={setForm} /></ConfigSection>
                        <ConfigSection><ConfigSunat form={form} setForm={setForm} /></ConfigSection>
                        <ConfigSection><ConfigFidelidad form={form} setForm={setForm} /></ConfigSection>
                    </div>
                )}
                {activeTab === 'distribucion' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <ConfigSection><ConfigMotorReservas hotelId={hotelId} /></ConfigSection>
                    </div>
                )}
                {activeTab === 'integraciones' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <ConfigSection><ConfigChannelManager hotelId={hotelId} /></ConfigSection>
                        <ConfigSection><ConfigYield hotelId={hotelId} /></ConfigSection>
                    </div>
                )}
                {activeTab === 'api' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <ConfigSection><ConfigApiWebhooks hotelId={hotelId} /></ConfigSection>
                    </div>
                )}
                {activeTab === 'avanzado' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <ConfigSection><ConfigPersonal hotelId={hotelId} /></ConfigSection>
                        <ConfigSection><ConfigTarifas hotelId={hotelId} /></ConfigSection>
                        <ConfigSection><ConfigImportadorExcel hotelId={hotelId} /></ConfigSection>
                        <ConfigSection><ConfigZonaPeligrosa hotelId={hotelId} /></ConfigSection>
                    </div>
                )}
            </div>

            {/* Guardar */}
            <div className="flex items-center gap-3 pt-4 border-t border-border/40 mt-6">
                <Button 
                    onClick={() => guardar.mutate()} 
                    disabled={guardar.isPending || !form.nombre} 
                    className="gap-2 px-6 h-10 rounded-md text-xs font-extrabold uppercase tracking-widest shadow-md active:scale-95 transition-all"
                >
                    {saved ? <><CheckCircle className="w-4 h-4" /> Guardado</> : <><Save className="w-4 h-4" /> {guardar.isPending ? 'Guardando...' : 'Guardar Configuración'}</>}
                </Button>
                {saved && <span className="text-[10px] text-emerald-500 font-black uppercase tracking-widest bg-emerald-500/10 px-2 py-1.5 rounded border border-emerald-500/20 shadow-xs">¡Configuración guardada!</span>}
            </div>

            {/* Modal para mostrar el Código QR (Global a ConfigEnlacesPublicos) */}
            {showQrModal && (
                <Dialog open={!!showQrModal} onOpenChange={() => setShowQrModal(null)}>
                    <DialogContent className="max-w-xs p-0 overflow-hidden rounded-xl border border-border/40 shadow-2xl bg-card/80 backdrop-blur-3xl text-center">
                        <div className="bg-primary/10 p-5 relative overflow-hidden border-b border-primary/20">
                            <DialogHeader>
                                <DialogTitle className="text-base font-extrabold text-foreground tracking-tight">
                                    {showQrModal.title}
                                </DialogTitle>
                            </DialogHeader>
                            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 blur-3xl rounded-full -mr-12 -mt-12" />
                        </div>
                        <div className="flex flex-col items-center justify-center p-5 space-y-4">
                            <div className="bg-white p-3 rounded-xl border border-border/40 shadow-sm relative overflow-hidden">
                                <img 
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(showQrModal.url)}`}
                                    alt="QR Code"
                                    className="w-40 h-40 rounded-lg"
                                />
                            </div>
                            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground leading-relaxed">
                                Escanea este código con la cámara de tu celular para acceder directamente.
                            </p>
                            <Button 
                                onClick={() => setShowQrModal(null)} 
                                variant="outline"
                                className="w-full h-9 rounded-md text-[10px] font-extrabold uppercase tracking-widest hover:bg-muted active:scale-95 transition-all border-border/40 shadow-xs"
                            >
                                Cerrar
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
});
Configuracion.displayName = 'Configuracion';
export default Configuracion;
