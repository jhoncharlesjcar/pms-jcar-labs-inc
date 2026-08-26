import React from 'react';
import { Plus, Search, CalendarDays, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useHotelData } from '@/hooks/useHotelData';
import RecepcionTimeline from '@/components/recepcion/RecepcionTimeline';
import RecepcionCockpit from '@/components/recepcion/RecepcionCockpit';

import { useGsapStaggerList } from '@/hooks/useGsapStaggerList';
import { useAuthStore } from '@/store/auth.store';
import EmptyState from '@/components/common/EmptyState';
import { ReservaCard } from './Recepcion/components/ReservaCard';
import { NuevaReservaSheet } from './Recepcion/components/NuevaReservaSheet';
import { useRecepcionData } from './Recepcion/hooks/useRecepcionData';
import ScannerDNIModal from '@/components/recepcion/ScannerDNIModal';
import RegistrarVentaModal from '@/components/RegistrarVentaModal';

Recepcion.displayName = 'Recepcion';
export default function Recepcion() {
    const { hotelActual } = useHotelData();
    const { user } = useAuthStore();
    
    const {
        hotelDb, hotelId,
        open, setOpen,
        ventaModal, setVentaModal,
        createdReserva, setCreatedReserva,
        form, setForm,
        busqueda, setBusqueda,
        filtro, setFiltro,
        vista, setVista,
        scannerOpen, setScannerOpen,
        reservas, habitaciones,
        loadingIdentity, handleDniBlur, handleScanSuccess,
        availabilityQuery, habitacionesDisp,
        saveReserva, actualizarEstado,
        noches, total, seleccionarHab,
        receptionSummary, filtradas, loyaltyAccount
    } = useRecepcionData();

    // ─── Stagger mount para secciones principales ───
    const pageRef = useGsapStaggerList([], {
        stagger: 0.08,
        direction: 'y',
        distance: 15,
    });

    // Stagger 2D wave para el grid de habitaciones en el Sheet (5 columnas en desktop)
    const roomGridRef = useGsapStaggerList([open, habitacionesDisp.length], {
        stagger: 0.05,
        direction: 'y',
        distance: 12,
        grid: 'auto',
        from: 'start',
    });

    return (
        <div className="page-shell">
            <div ref={pageRef} className="space-y-4">
            <div className="page-header md:items-center">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Recepción</h1>
                    <p className="text-sm text-muted-foreground mt-1">Prioriza llegadas, estancias y salidas del día</p>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                    <div className="segmented-control w-full sm:w-auto">
                        <button type="button" aria-pressed={vista === 'lista'} onClick={() => setVista('lista')} className={cn("flex-1 sm:flex-none px-4 py-1.5 text-xs font-semibold rounded-md transition-all", vista === 'lista' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                            Lista
                        </button>
                        <button type="button" aria-pressed={vista === 'timeline'} onClick={() => setVista('timeline')} className={cn("flex-1 sm:flex-none px-4 py-1.5 text-xs font-semibold rounded-md transition-all", vista === 'timeline' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                            Timeline
                        </button>
                    </div>
                    <Button onClick={() => setOpen(true)} className="w-full gap-2 sm:w-auto">
                        <Plus className="w-4 h-4" /> Nueva Reserva
                    </Button>
                </div>
            </div>
            {/* Lista de Reservas o Timeline */}
            {vista === 'lista' ? (
                <>
                    <RecepcionCockpit summary={receptionSummary} filter={filtro} onFilterChange={setFiltro} />

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <div className="relative flex-1">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                            <Input
                                inputMode="text"
                                placeholder="Buscar por huésped, DNI o habitación..."
                                className="pl-11 bg-background/50 h-10 rounded-xl text-sm focus:ring-1 focus:ring-primary shadow-xs"
                                value={busqueda}
                                onChange={e => setBusqueda(e.target.value)}
                            />
                        </div>
                        <p className="shrink-0 text-xs font-medium text-muted-foreground" aria-live="polite">
                            {filtradas.length} resultado{filtradas.length === 1 ? '' : 's'}
                        </p>
                    </div>
                    
                    <div className="space-y-4">
                        {filtradas.length === 0 ? (
                            <EmptyState
                                icon={filtro === 'atencion' ? CheckCircle2 : CalendarDays}
                                title={filtro === 'atencion' ? 'Todo está al día' : 'No hay reservas'}
                                description={filtro === 'atencion' ? 'No hay llegadas ni salidas que requieran atención ahora.' : 'No se encontraron reservas con los filtros actuales.'}
                                action={{ label: 'Nueva Reserva', icon: Plus, onClick: () => setOpen(true) }}
                            />
                        ) : (
                            filtradas.map(r => (
                                <ReservaCard
                                    key={r.id}
                                    r={r}
                                    hotelActual={hotelActual}
                                    hotelId={hotelId}
                                    user={user}
                                    actualizarEstado={actualizarEstado}
                                    setVentaModal={setVentaModal}
                                    hotelDb={hotelDb}
                                />
                            ))
                        )}
                    </div>
                </>
            ) : (
                <RecepcionTimeline reservas={reservas} habitaciones={habitaciones} />
            )}

            <NuevaReservaSheet 
                open={open} setOpen={setOpen}
                form={form} setForm={setForm}
                saveReserva={saveReserva}
                availabilityQuery={availabilityQuery}
                habitacionesDisp={habitacionesDisp}
                seleccionarHab={seleccionarHab}
                noches={noches} total={total}
                roomGridRef={roomGridRef}
                createdReserva={createdReserva} setCreatedReserva={setCreatedReserva}
                loyaltyAccount={loyaltyAccount}
                loadingIdentity={loadingIdentity}
                setScannerOpen={setScannerOpen}
                handleDniBlur={handleDniBlur}
            />

            {/* Modal Scanner de DNI Inteligente */}
            <ScannerDNIModal
                open={scannerOpen}
                onOpenChange={setScannerOpen}
                onScanSuccess={handleScanSuccess}
            />

            {/* Modal para Check-Out y Ventas POS Rápidas */}
            {ventaModal && (
                <RegistrarVentaModal 
                    onClose={() => setVentaModal(null)} 
                    reserva={ventaModal} 
                />
            )}
            </div>
        </div>
    );
}
