import React, { useState, useEffect, useRef, memo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, CheckCircle, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHotelData } from '@/hooks/useHotelData';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/config/supabase';
import logger from '@/lib/logger';
import { toast } from 'sonner';
import { useGsapStaggerList } from '@/hooks/useGsapStaggerList';
import { useGsapCardHover } from '@/hooks/useGsapCardHover';
import { cn } from '@/lib/utils';
import { useConfiguracionData } from './Configuracion/hooks/useConfiguracionData';

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
    const {
        hotelId,
        form, setForm,
        activeTab, setActiveTab,
        showQrModal, setShowQrModal,
        saved, guardar,
        isLoading
    } = useConfiguracionData();

    const sectionsRef = useGsapStaggerList([hotelId], {
        stagger: 0.05,
        direction: 'y',
        distance: 12,
    });

    return (
        <div className="page-shell page-enter mx-auto max-w-5xl pt-1 sm:pt-2">
            {/* Header */}
            <div className="enterprise-card section-card ui-card-pad flex items-center justify-between shadow-sm">
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

            <div className="config-tabs" role="tablist" aria-label="Secciones de configuración">
                <Button role="tab" aria-selected={activeTab === 'general'} size="sm" variant={activeTab === 'general' ? 'default' : 'ghost'} className={cn('min-w-0 justify-center', activeTab === 'general' ? 'bg-card text-primary hover:bg-card shadow-sm' : '')} onClick={() => setActiveTab('general')}><Settings className="w-4 h-4 shrink-0" /> <span>General</span></Button>
                <Button role="tab" aria-selected={activeTab === 'ventas'} size="sm" variant={activeTab === 'ventas' ? 'default' : 'ghost'} className={cn('min-w-0 justify-center', activeTab === 'ventas' ? 'bg-card text-primary hover:bg-card shadow-sm' : '')} onClick={() => setActiveTab('ventas')}><Settings className="w-4 h-4 shrink-0" /> <span>Ventas &amp; Pagos</span></Button>
                <Button role="tab" aria-selected={activeTab === 'distribucion'} size="sm" variant={activeTab === 'distribucion' ? 'default' : 'ghost'} className={cn('min-w-0 justify-center', activeTab === 'distribucion' ? 'bg-card text-primary hover:bg-card shadow-sm' : '')} onClick={() => setActiveTab('distribucion')}><Settings className="w-4 h-4 shrink-0" /> <span>Distribución</span></Button>
                <Button role="tab" aria-selected={activeTab === 'integraciones'} size="sm" variant={activeTab === 'integraciones' ? 'default' : 'ghost'} className={cn('min-w-0 justify-center', activeTab === 'integraciones' ? 'bg-card text-primary hover:bg-card shadow-sm' : '')} onClick={() => setActiveTab('integraciones')}><Settings className="w-4 h-4 shrink-0" /> <span>OTAs &amp; Canales</span></Button>
                <Button role="tab" aria-selected={activeTab === 'api'} size="sm" variant={activeTab === 'api' ? 'default' : 'ghost'} className={cn('min-w-0 justify-center', activeTab === 'api' ? 'bg-card text-primary hover:bg-card shadow-sm' : '')} onClick={() => setActiveTab('api')}><Settings className="w-4 h-4 shrink-0" /> <span>APIs &amp; Webhooks</span></Button>
                <Button role="tab" aria-selected={activeTab === 'avanzado'} size="sm" variant={activeTab === 'avanzado' ? 'default' : 'ghost'} className={cn('min-w-0 justify-center', activeTab === 'avanzado' ? 'bg-card text-primary hover:bg-card shadow-sm' : '')} onClick={() => setActiveTab('avanzado')}><Settings className="w-4 h-4 shrink-0" /> <span>Avanzado</span></Button>
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
                        <ConfigSection><ConfigMotorReservas /></ConfigSection>
                    </div>
                )}
                {activeTab === 'integraciones' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <ConfigSection><ConfigChannelManager /></ConfigSection>
                        <ConfigSection><ConfigYield /></ConfigSection>
                    </div>
                )}
                {activeTab === 'api' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <ConfigSection><ConfigApiWebhooks /></ConfigSection>
                    </div>
                )}
                {activeTab === 'avanzado' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <ConfigSection><ConfigPersonal hotelId={hotelId} /></ConfigSection>
                        <ConfigSection><ConfigTarifas hotelId={hotelId} /></ConfigSection>
                        <ConfigSection><ConfigImportadorExcel hotelId={hotelId} /></ConfigSection>
                        <ConfigSection><ConfigZonaPeligrosa /></ConfigSection>
                    </div>
                )}
            </div>

            {/* Guardar */}
            <div className="flex items-center gap-3 pt-4 border-t border-border/40 mt-6">
                <Button 
                    onClick={() => guardar.mutate()} 
                    disabled={guardar.isPending || !form.nombre} 
                    className="gap-2 px-6 text-xs font-extrabold uppercase tracking-widest"
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
                                className="w-full text-[10px] font-extrabold uppercase tracking-widest"
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
