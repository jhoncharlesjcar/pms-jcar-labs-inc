import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, CalendarDays, User, CheckCircle2, Sparkles, XCircle, LogIn, MapPin, Users as UsersIcon, Info, FileText, MessageSquare, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { differenceInDays, format, addDays, parseISO } from 'date-fns';
import RegistrarVentaModal from '@/components/RegistrarVentaModal';
import { useHotelData } from '@/hooks/useHotelData';
import RecepcionTimeline from '@/components/recepcion/RecepcionTimeline';
import RecepcionCockpit from '@/components/recepcion/RecepcionCockpit';

import { useGsapStaggerList } from '@/hooks/useGsapStaggerList';
import { generarFichaMincetur } from '@/lib/exportMincetur';
import { WhatsAppService } from '@/services/whatsapp.service';
import { useAuthStore } from '@/store/auth.store';
import { toast } from 'sonner';
import { useIdentity } from '@/hooks/useIdentity';
import { useLoyaltyAccount } from '@/hooks/useLoyalty';
import { StatusBadge } from '@/components/ui/StatusBadge';
import EmptyState from '@/components/common/EmptyState';
import ScannerDNIModal from '@/components/recepcion/ScannerDNIModal';
import { roomStatusForReservationTransition } from '@/constants/roomStatus';
import ConfirmDialog, { useConfirmDialog } from '@/components/common/ConfirmDialog';
import {
    buildReceptionSummary,
    getReservationOperationalState,
    matchesReceptionFilter,
    OPERATIONAL_STATE_CONFIG,
    sortReservationsByOperationalPriority,
} from '@/lib/recepcionCockpit';
import { ReservaCard } from './Recepcion/components/ReservaCard';
import { NuevaReservaSheet } from './Recepcion/components/NuevaReservaSheet';

const createEmptyForm = () => ({
    habitacion_id: '', habitacion_numero: '', habitacion_tipo: '',
    huesped_nombre: '', huesped_dni: '', huesped_telefono: '', huesped_procedencia: '',
    nacionalidad: 'Peruana', motivo_viaje: 'turismo',
    fecha_entrada: format(new Date(), 'yyyy-MM-dd'),
    fecha_salida: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
    noches: 1, precio_noche: 0, total: 0,
    num_adultos: 1, num_ninos: 0, observaciones: '', estado: 'activa',
    huesped_fecha_nacimiento: '',
    huesped_profesion: '',
    huesped_estado_civil: 'soltero',
    huesped_destino: '',
    huesped_sexo: 'no_especificado',
    tipo_documento: 'DNI',
});

Recepcion.displayName = 'Recepcion';
export default function Recepcion() {
    const qc = useQueryClient();
    const { db: hotelDb, hotelId, hotelActual } = useHotelData();
    const { user } = useAuthStore();
    const [open, setOpen] = useState(false);
    const [ventaModal, setVentaModal] = useState(null);
    const [form, setForm] = useState(createEmptyForm);
    const [busqueda, setBusqueda] = useState('');
    const [filtro, setFiltro] = useState('atencion');
    const [vista, setVista] = useState('lista'); // 'lista' | 'timeline'
    const [scannerOpen, setScannerOpen] = useState(false);

    // ─── Stagger mount para secciones principales ───
    const pageRef = useGsapStaggerList([], {
        stagger: 0.08,
        direction: 'y',
        distance: 15,
    });

    const { fetchIdentity, loadingIdentity } = useIdentity();
    const { data: loyaltyAccount } = useLoyaltyAccount(hotelId, form.huesped_dni);

    const { data: reservas = [] } = useQuery({
        queryKey: ['reservas', hotelId],
        queryFn: () => hotelDb.Reserva.list(),
        enabled: !!hotelId,
    });

    // Tarea 3.1: Autocompletado de huésped recurrente o vía Identity Service
    const handleDniBlur = async (dni) => {
        if (!dni || dni.length < 8) return;
        try {
            // 1. Búsqueda Rápida Local (IndexedDB Cache via React Query) - O(N) memory scan
            const reservaLocal = reservas.find(r => r.huesped_dni === dni && r.huesped_nombre);
            
            if (reservaLocal) {
                setForm(prev => ({
                    ...prev,
                    huesped_nombre: reservaLocal.huesped_nombre || prev.huesped_nombre,
                    huesped_telefono: reservaLocal.huesped_telefono || prev.huesped_telefono,
                    huesped_sexo: reservaLocal.huesped_sexo || prev.huesped_sexo,
                    huesped_fecha_nacimiento: reservaLocal.huesped_fecha_nacimiento || prev.huesped_fecha_nacimiento,
                    huesped_profesion: reservaLocal.huesped_profesion || prev.huesped_profesion,
                    huesped_estado_civil: reservaLocal.huesped_estado_civil || prev.huesped_estado_civil,
                    huesped_procedencia: reservaLocal.huesped_procedencia || prev.huesped_procedencia,
                    huesped_destino: reservaLocal.huesped_destino || prev.huesped_destino,
                    nacionalidad: reservaLocal.nacionalidad || prev.nacionalidad,
                    motivo_viaje: reservaLocal.motivo_viaje || prev.motivo_viaje
                }));
                toast.success('Huésped frecuente recuperado (Cache Local ⚡)');
                return; // Termina en < 1 segundo sin consumir red
            }

            // 2. Si no hay historial, usar el Identity Service (SUNAT/RENIEC)
            const docType = form.tipo_documento === 'RUC' ? 'RUC' : 'DNI';
            const res = await fetchIdentity(docType, dni);
            if (res?.data) {
                const nombreEncontrado = res.data.nombreCompleto || res.data.razonSocial;
                if (nombreEncontrado) {
                    setForm(prev => ({ ...prev, huesped_nombre: nombreEncontrado }));
                    toast.success(`Huésped identificado (${res.source})`);
                }
            }
        } catch (err) {
            logger.error('Error al autocompletar huésped:', err);
            toast.error('Error al obtener datos del huésped');
        }
    };



    const handleScanSuccess = async (data) => {
        const dniScanned = data.dni || data.numero || '';
        const nombreScanned = data.nombreCompleto || `${data.nombre || ''} ${data.apellidos || ''}`.trim();

        setForm(prev => ({
            ...prev,
            tipo_documento: 'DNI',
            huesped_dni: dniScanned || prev.huesped_dni,
            huesped_nombre: nombreScanned || prev.huesped_nombre,
            huesped_fecha_nacimiento: data.fechaNacimiento || prev.huesped_fecha_nacimiento,
            huesped_sexo: data.sexo || prev.huesped_sexo,
            huesped_estado_civil: data.estadoCivil || prev.huesped_estado_civil,
            huesped_procedencia: data.procedencia || prev.huesped_procedencia,
        }));
        
        toast.success(`DNI ${dniScanned} escaneado correctamente`);
        
        if (dniScanned) {
            await handleDniBlur(dniScanned);
        }
    };

    const { data: habitaciones = [] } = useQuery({
        queryKey: ['habitaciones', hotelId],
        queryFn: () => hotelDb.Habitacion.list(),
        enabled: !!hotelId,
    });

    // Las ventas se cargan on-demand al hacer check-out para mejorar rendimiento

    const saveReserva = useMutation({
        /** @param {any} data */
        mutationFn: async (data) => {
            const nueva = await hotelDb.Reserva.create({
                ...data,
                numero_reserva: `R${Date.now().toString().slice(-6)}`,
            });

            if (nueva.habitacion_id) {
                await hotelDb.Habitacion.update(nueva.habitacion_id, {
                    estado: nueva.estado === 'activa' ? 'ocupada' : 'reservada'
                });
            }
            return nueva;
        },
        onSuccess: (nueva) => {
            qc.invalidateQueries({ queryKey: ['reservas', hotelId] });
            qc.invalidateQueries({ queryKey: ['habitaciones', hotelId] });
            setOpen(false);
            if (nueva.estado === 'activa') {
                setVentaModal(nueva);
            }
            setForm(createEmptyForm());
        },
    });

    const actualizarEstado = useMutation({
        /** @param {any} params */
        mutationFn: ({ id, estado, hab_id, estadoAnterior }) => {
            const updates = [hotelDb.Reserva.update(id, { estado })];
            const nextRoomStatus = roomStatusForReservationTransition(estadoAnterior, estado);
            if (hab_id && nextRoomStatus) {
                updates.push(hotelDb.Habitacion.update(hab_id, { estado: nextRoomStatus }));
            }
            return Promise.all(updates);
        },
        onMutate: async ({ id, estado, hab_id, estadoAnterior }) => {
            // Cancel outgoing refetches so they don't overwrite our optimistic update
            await qc.cancelQueries({ queryKey: ['reservas', hotelId] });
            await qc.cancelQueries({ queryKey: ['habitaciones', hotelId] });

            // Snapshot the previous values
            const previousReservas = qc.getQueryData(['reservas', hotelId]);
            const previousHabitaciones = qc.getQueryData(['habitaciones', hotelId]);

            // Optimistically update reservas list
            qc.setQueryData(['reservas', hotelId], (old) => {
                if (!old) return [];
                return old.map(r => r.id === id ? { ...r, estado } : r);
            });

            // Optimistically update habitaciones list if check-out (finalizada/cancelada) or check-in (activa)
            if (hab_id) {
                const nextRoomStatus = roomStatusForReservationTransition(estadoAnterior, estado);
                qc.setQueryData(['habitaciones', hotelId], (old) => {
                    if (!old) return [];
                    return old.map(h => {
                        if (h.id === hab_id && nextRoomStatus) {
                            return { ...h, estado: nextRoomStatus };
                        }
                        return h;
                    });
                });
            }

            return { previousReservas, previousHabitaciones };
        },
        onError: (err, newVariables, context) => {
            if (context?.previousReservas) {
                qc.setQueryData(['reservas', hotelId], context.previousReservas);
            }
            if (context?.previousHabitaciones) {
                qc.setQueryData(['habitaciones', hotelId], context.previousHabitaciones);
            }
            toast.error('Error al actualizar el estado de la reserva');
        },
        onSettled: () => {
            qc.invalidateQueries({ queryKey: ['reservas', hotelId] });
            qc.invalidateQueries({ queryKey: ['habitaciones', hotelId] });
        },
        onSuccess: () => {
            toast.success('Estado actualizado correctamente');
        },
    });

    const noches = useMemo(() => {
        if (!form.fecha_entrada || !form.fecha_salida) return 1;
        const diff = differenceInDays(new Date(form.fecha_salida), new Date(form.fecha_entrada));
        return diff > 0 ? diff : 1;
    }, [form.fecha_entrada, form.fecha_salida]);

    const total = noches * (form.precio_noche || 0);

    const seleccionarHab = (hab) => {
        setForm({
            ...form,
            habitacion_id: hab.id,
            habitacion_numero: hab.numero,
            habitacion_tipo: hab.tipo,
            precio_noche: hab.precio_noche
        });
    };

    const receptionSummary = useMemo(
        () => buildReceptionSummary(reservas, habitaciones),
        [reservas, habitaciones]
    );

    const filtradas = useMemo(() => {
        const matchingReservations = reservas.filter(r => {
            if (!matchesReceptionFilter(r, filtro)) return false;
            if (!busqueda) return true;
            const b = busqueda.toLowerCase();
            return (
                r.huesped_nombre?.toLowerCase().includes(b) ||
                String(r.habitacion_numero || '').toLowerCase().includes(b) ||
                String(r.huesped_dni || '').toLowerCase().includes(b)
            );
        });
        return sortReservationsByOperationalPriority(matchingReservations);
    }, [reservas, filtro, busqueda]);

    const habitacionesDisp = useMemo(() => {
        return habitaciones
            .filter(h => h.estado === 'disponible')
            .sort((a, b) => {
                const pisoA = parseInt(a.piso, 10);
                const pisoB = parseInt(b.piso, 10);
                const hasPisoA = !isNaN(pisoA);
                const hasPisoB = !isNaN(pisoB);
                
                if (hasPisoA && hasPisoB) {
                    if (pisoA !== pisoB) return pisoA - pisoB;
                } else if (hasPisoA) {
                    return -1;
                } else if (hasPisoB) {
                    return 1;
                }

                const numA = parseInt(a.numero, 10);
                const numB = parseInt(b.numero, 10);
                if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                return String(a.numero).localeCompare(String(b.numero));
            });
    }, [habitaciones]);

    // Stagger 2D wave para el grid de habitaciones en el Sheet (5 columnas en desktop)
    // NOTA: debe ir DESPUÉS de habitacionesDisp para evitar temporal dead zone
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
                open={open}
                setOpen={setOpen}
                form={form}
                setForm={setForm}
                habitacionesDisp={habitacionesDisp}
                roomGridRef={roomGridRef}
                seleccionarHab={seleccionarHab}
                loadingIdentity={loadingIdentity}
                loyaltyAccount={loyaltyAccount}
                handleDniBlur={handleDniBlur}
                setScannerOpen={setScannerOpen}
                noches={noches}
                total={total}
                saveReserva={saveReserva}
            />

            <ScannerDNIModal 
                open={scannerOpen} 
                onOpenChange={setScannerOpen} 
                onScanSuccess={handleScanSuccess} 
            />

            {ventaModal && (
                <RegistrarVentaModal
                    reserva={ventaModal}
                    onClose={() => setVentaModal(null)}
                    onSuccess={() => {
                        setVentaModal(null);
                    }}
                />
            )}
            </div>
        </div>
    );
}
