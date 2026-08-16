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
import { useHotelData } from '@/hooks/use-hotel-data';
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
const avatarColors = {
    activa: 'from-primary to-primary/70',
    pendiente: 'from-orange-500 to-amber-500',
    finalizada: 'from-green-500 to-emerald-500',
    cancelada: 'from-red-500 to-rose-500',
};

const operationalStateClasses = {
    destructive: 'border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400',
    warning: 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400',
    info: 'border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400',
    success: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    neutral: 'border-border bg-muted/50 text-muted-foreground',
};

const formatReservationDate = value => value
    ? format(typeof value === 'string' ? parseISO(value) : new Date(value), 'dd/MM')
    : '--';

const ReservaCard = React.memo(({ r, hotelActual, hotelId, user, actualizarEstado, setVentaModal, hotelDb }) => {
    const initials = (r.huesped_nombre || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const { confirmProps, requestConfirm } = useConfirmDialog();
    const operationalState = getReservationOperationalState(r);
    const operationalConfig = OPERATIONAL_STATE_CONFIG[operationalState];
    
    return (
        <article className="enterprise-card operational-card ui-card-pad group transition-all duration-300 ease-out hover:shadow-md">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm bg-gradient-to-br text-white font-bold text-sm", avatarColors[r.estado] || 'from-gray-500 to-gray-600')}>
                        {initials}
                    </div>
                    <div className="min-w-0 flex flex-col gap-0.5">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <p className="font-bold text-sm text-foreground tracking-tight leading-none">{r.huesped_nombre}</p>
                            <StatusBadge status={r.estado} className="text-[10px] px-1.5 py-0.5 rounded-sm" />
                            {operationalState !== 'history' && (
                                <span className={cn(
                                    'rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold',
                                    operationalStateClasses[operationalConfig.tone]
                                )}>
                                    {operationalConfig.label}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground font-medium">
                            Habitación <span className="text-foreground font-semibold">#{r.habitacion_numero}</span> <span className="opacity-50 mx-1">•</span> {r.noches} {r.noches === 1 ? 'noche' : 'noches'}
                        </p>
                        <p className="text-[11px] font-medium text-muted-foreground flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-1">
                            <CalendarDays className="w-3.5 h-3.5 text-muted-foreground/80" />
                            {formatReservationDate(r.fecha_entrada)} → {formatReservationDate(r.fecha_salida)} <span className="opacity-50 mx-1">•</span> DNI: <span className="text-foreground">{r.huesped_dni || 'N/A'}</span>
                        </p>
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between lg:justify-end gap-4 mt-1 lg:mt-0 pt-3 lg:pt-0 border-t lg:border-0 border-border/40">
                    <div className="text-left sm:text-right">
                        <p className="text-xl font-bold text-foreground tracking-tight tabular-nums leading-none whitespace-nowrap">S/ {r.total?.toFixed(2)}</p>
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mt-1">Ref: #{r.numero_reserva}</p>
                    </div>
                    <div className="w-px h-8 bg-border/40 hidden sm:block mx-1" />
                    <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-nowrap sm:items-center">
                        {(r.estado === 'pendiente' || r.estado === 'activa') && (
                            <Button size="sm" variant="outline" className="order-2 gap-1.5 border-emerald-500/30 bg-emerald-500/10 px-2.5 text-emerald-600 shadow-xs hover:bg-emerald-500/20 dark:text-emerald-400 sm:order-none"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    WhatsAppService.enviarMensajeReserva(r, hotelActual, { hotelId, user });
                                }}>
                                <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
                            </Button>
                        )}
                        {r.estado === 'activa' && (
                            <Button size="sm" variant="outline" className="order-2 gap-1.5 border-blue-500/30 bg-blue-500/10 px-2.5 text-blue-600 shadow-xs hover:bg-blue-500/20 dark:text-blue-400 sm:order-none"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    generarFichaMincetur(r, {
                                        nombre: hotelActual?.nombre || 'PMS JCAR LABS',
                                        ruc: hotelActual?.ruc || ''
                                    });
                                }}>
                                <FileText className="w-3.5 h-3.5" /> DIRCETUR
                            </Button>
                        )}
                        {r.estado === 'pendiente' && (
                            <Button size="sm" variant="emerald" className="order-first col-span-2 gap-1.5 px-3 shadow-sm sm:order-none sm:col-span-1"
                                onClick={() => {
                                    actualizarEstado.mutate({ id: r.id, estado: 'activa', hab_id: r.habitacion_id, estadoAnterior: r.estado });
                                    setVentaModal(r);
                                }}>
                                <LogIn className="w-3.5 h-3.5" /> Check-in
                            </Button>
                        )}
                        {r.estado === 'activa' && (
                            <Button size="sm" variant="emerald" className="order-first col-span-2 gap-1.5 px-3 shadow-xs sm:order-none sm:col-span-1"
                                onClick={async () => {
                                    const ventasRes = await hotelDb.Venta.filter({ reserva_id: r.id });
                                    const pagado = ventasRes.length > 0;
                                    
                                    if (!pagado) {
                                        requestConfirm({
                                            title: 'La estancia todavía no tiene un pago registrado',
                                            description: 'Antes de finalizar el check-out debes registrar el cobro de la estadía.',
                                            confirmText: 'Registrar pago',
                                            onConfirm: () => setVentaModal(r),
                                        });
                                        return;
                                    }

                                    requestConfirm({
                                        title: '¿Finalizar la estancia?',
                                        description: `La habitación #${r.habitacion_numero} pasará a pendiente de limpieza.`,
                                        confirmText: 'Finalizar y enviar a limpieza',
                                        onConfirm: () => actualizarEstado.mutate({ id: r.id, estado: 'finalizada', hab_id: r.habitacion_id, estadoAnterior: r.estado }),
                                    });
                                }}>
                                <CheckCircle2 className="w-3.5 h-3.5" /> Check-out
                            </Button>
                        )}
                        {(r.estado === 'pendiente' || r.estado === 'activa') && (
                            <Button size="iconSm" variant="ghost" aria-label={r.estado === 'activa' ? 'Anular estancia' : 'Cancelar reserva'} title={r.estado === 'activa' ? 'Anular estancia' : 'Cancelar reserva'} className="order-3 col-span-2 w-full px-2 text-red-500/70 hover:bg-red-500/10 hover:text-red-500 sm:order-none sm:col-span-1 sm:w-9 sm:p-0"
                                onClick={() => {
                                    const msg = r.estado === 'activa'
                                        ? '¿Anular esta estadía activa? La habitación pasará a limpieza y no se emitirá ningún comprobante.'
                                        : '¿Cancelar esta reserva pendiente?';
                                    requestConfirm({
                                        title: r.estado === 'activa' ? '¿Anular la estancia activa?' : '¿Cancelar la reserva?',
                                        description: msg,
                                        variant: 'destructive',
                                        confirmText: r.estado === 'activa' ? 'Anular estancia' : 'Cancelar reserva',
                                        onConfirm: () => actualizarEstado.mutate({ id: r.id, estado: 'cancelada', hab_id: r.habitacion_id, estadoAnterior: r.estado }),
                                    });
                                }}>
                                <XCircle className="w-4 h-4" />
                                <span className="sm:sr-only">{r.estado === 'activa' ? 'Anular estancia' : 'Cancelar reserva'}</span>
                            </Button>
                        )}
                    </div>
                </div>
            </div>
            <ConfirmDialog {...confirmProps} isPending={actualizarEstado.isPending} />
        </article>
    );
});
ReservaCard.displayName = 'ReservaCard';

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
                            ))
                        )}
                    </div>
                </>
            ) : (
                <RecepcionTimeline reservas={reservas} habitaciones={habitaciones} />
            )}
            {/* Slide-over nueva reserva (FULL FORM) */}
            <Sheet open={open} onOpenChange={setOpen}>
                <SheetContent side="right" className="w-full sm:max-w-3xl bg-card border-l border-border shadow-xl p-0 overflow-hidden flex flex-col h-full">
                    <div className="flex-1 overflow-hidden flex flex-col relative">
                        <SheetHeader className="p-4 sm:p-5 pb-0 shrink-0 z-10">
                            <SheetTitle className="text-xl font-bold text-foreground">Registro de Reserva</SheetTitle>
                            <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wider mt-0.5">Completa el registro oficial</p>
                        </SheetHeader>
 
                        <div className="flex-1 overflow-y-auto p-4 sm:p-5 pt-4 space-y-5 sm:space-y-6 custom-scrollbar relative z-0">
                            <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-card to-transparent pointer-events-none z-10 -mt-4" />
                            {/* Sección 1: Selección de Habitación */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-1 h-4 bg-primary rounded-full" />
                                    <h3 className="text-xs font-semibold text-muted-foreground/90 uppercase tracking-wider">1. Selección de Habitación</h3>
                                </div>
                                <div ref={roomGridRef} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                    {habitacionesDisp.map(h => (
                                        <button key={h.id} onClick={() => seleccionarHab(h)}
                                            className={cn(
                                                "p-3 rounded-xl border text-left transition-all duration-300 relative overflow-hidden group h-20 flex flex-col justify-between hover:-translate-y-1 hover:shadow-md",
                                                form.habitacion_id === h.id
                                                    ? "border-primary bg-primary/10 shadow-md ring-1 ring-primary/50"
                                                    : "border-border/40 bg-card/40 hover:bg-card/60 backdrop-blur-xl shadow-sm"
                                            )}>
                                            <div>
                                                <p className="font-bold text-lg leading-none tabular-nums text-foreground">#{h.numero}</p>
                                                <p className="text-[9px] text-muted-foreground uppercase font-semibold tracking-widest mt-1 truncate">{h.tipo}</p>
                                            </div>
                                            <p className="text-xs font-bold text-foreground tracking-tight">S/ {h.precio_noche}</p>
                                            {form.habitacion_id === h.id && (
                                                <div className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-sm" />
                                            )}
                                        </button>
                                    ))}
                                    {habitacionesDisp.length === 0 && <p className="col-span-full py-8 text-center text-sm font-bold text-muted-foreground bg-secondary/20 rounded-2xl border border-dashed border-border/60">No hay habitaciones disponibles</p>}
                                </div>                              </div>
                              {/* Sección 2: Datos del Huésped */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-1 h-4 bg-primary rounded-full" />
                                    <h3 className="text-xs font-semibold text-muted-foreground/90 uppercase tracking-wider">2. Información del Huésped</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <div className="md:col-span-2 space-y-1.5">
                                        <Label htmlFor="huesped_nombre" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider ml-1">Nombre Completo</Label>
                                        <div className="relative group">
                                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                            <Input id="huesped_nombre" value={form.huesped_nombre} onChange={e => setForm({ ...form, huesped_nombre: e.target.value })} placeholder="Ej: Juan Pérez" className="pl-9 bg-background h-9 rounded-md text-sm border border-input focus:ring-1 focus:ring-primary" />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider ml-1">Tipo de Doc.</Label>
                                        <Select value={form.tipo_documento} onValueChange={v => setForm({ ...form, tipo_documento: v })}>
                                            <SelectTrigger className="h-9 bg-background rounded-md border border-input text-sm"><SelectValue /></SelectTrigger>
                                            <SelectContent className="rounded-md">
                                                <SelectItem value="DNI">DNI (Documento Nacional)</SelectItem>
                                                <SelectItem value="RUC">RUC (Registro Único)</SelectItem>
                                                <SelectItem value="CE">Carnet de Extranjería</SelectItem>
                                                <SelectItem value="PASAPORTE">Pasaporte</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="huesped_dni" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider ml-1 flex items-center justify-between">
                                            <span>
                                                Número de Doc.
                                                {loadingIdentity && <span className="ml-2 animate-pulse text-purple-500 text-[9px]">Buscando...</span>}
                                            </span>
                                            {loyaltyAccount && (loyaltyAccount.points_balance || 0) > 0 && (
                                                <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full text-[9px] font-extrabold border border-amber-500/20 inline-flex items-center gap-1">
                                                    <Sparkles className="w-3 h-3 text-amber-500" />
                                                    Cliente Frecuente: {loyaltyAccount.points_balance} Pts
                                                </span>
                                            )}
                                        </Label>
                                        <div className="flex gap-2">
                                            <Input 
                                                id="huesped_dni" 
                                                type="text"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                value={form.huesped_dni} 
                                                onChange={e => setForm({ ...form, huesped_dni: e.target.value })} 
                                                onBlur={e => handleDniBlur(e.target.value)} 
                                                placeholder="Número de Documento" 
                                                className="bg-background h-9 flex-1 rounded-md text-sm border border-input focus:ring-1 focus:ring-primary font-mono" 
                                            />
                                            <Button 
                                                type="button"
                                                variant="outline" 
                                                size="icon" 
                                                className="h-9 w-9 shrink-0 border-primary/20 text-primary hover:bg-primary/10 rounded-md"
                                                onClick={() => setScannerOpen(true)}
                                                title="Escanear DNI con cámara"
                                            >
                                                <Camera className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="huesped_telefono" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider ml-1">Teléfono</Label>
                                        <Input 
                                            id="huesped_telefono" 
                                            type="tel"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            value={form.huesped_telefono} 
                                            onChange={e => setForm({ ...form, huesped_telefono: e.target.value })} 
                                            placeholder="Ej: 987654321" 

                                            className="bg-background h-10 rounded-lg text-sm border border-input focus:ring-1 focus:ring-primary font-mono" 
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider ml-1">Sexo</Label>
                                        <Select value={form.huesped_sexo} onValueChange={v => setForm({ ...form, huesped_sexo: v })}>
                                            <SelectTrigger className="h-9 bg-background rounded-md border border-input text-sm"><SelectValue /></SelectTrigger>
                                            <SelectContent className="rounded-md">
                                                <SelectItem value="masculino">Masculino</SelectItem>
                                                <SelectItem value="femenino">Femenino</SelectItem>
                                                <SelectItem value="no_especificado">No especificado</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="huesped_fecha_nacimiento" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider ml-1">Fec. Nacimiento</Label>
                                        <Input id="huesped_fecha_nacimiento" type="date" value={form.huesped_fecha_nacimiento} onChange={e => setForm({ ...form, huesped_fecha_nacimiento: e.target.value })} className="bg-background h-9 rounded-md text-sm border border-input focus:ring-1 focus:ring-primary" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="huesped_profesion" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider ml-1">Profesión</Label>
                                        <Input id="huesped_profesion" value={form.huesped_profesion} onChange={e => setForm({ ...form, huesped_profesion: e.target.value })} placeholder="Ej: Ingeniero" className="bg-background h-9 rounded-md text-sm border border-input focus:ring-1 focus:ring-primary" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider ml-1">Estado Civil</Label>
                                        <Select value={form.huesped_estado_civil} onValueChange={v => setForm({ ...form, huesped_estado_civil: v })}>
                                            <SelectTrigger className="h-9 bg-background rounded-md border border-input text-sm"><SelectValue /></SelectTrigger>
                                            <SelectContent className="rounded-md">
                                                <SelectItem value="soltero">Soltero(a)</SelectItem>
                                                <SelectItem value="casado">Casado(a)</SelectItem>
                                                <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                                                <SelectItem value="viudo">Viudo(a)</SelectItem>
                                                <SelectItem value="conviviente">Conviviente</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="huesped_procedencia" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider ml-1">Procedencia</Label>
                                        <div className="relative">
                                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                            <Input id="huesped_procedencia" value={form.huesped_procedencia} onChange={e => setForm({ ...form, huesped_procedencia: e.target.value })} placeholder="Origen" className="pl-9 bg-background h-9 rounded-md text-sm border border-input focus:ring-1 focus:ring-primary" />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="huesped_destino" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider ml-1">Destino</Label>
                                        <Input id="huesped_destino" value={form.huesped_destino} onChange={e => setForm({ ...form, huesped_destino: e.target.value })} placeholder="Destino" className="bg-background h-9 rounded-md text-sm border border-input focus:ring-1 focus:ring-primary" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider ml-1">Tipo de Registro</Label>
                                        <Select value={form.estado} onValueChange={v => setForm({ ...form, estado: v })}>
                                            <SelectTrigger className="h-9 bg-background rounded-md border border-input text-sm"><SelectValue /></SelectTrigger>
                                            <SelectContent className="rounded-md">
                                                <SelectItem value="activa">Check-in (Entrada Inmediata)</SelectItem>
                                                <SelectItem value="pendiente">Reserva (Pendiente)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="nacionalidad" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider ml-1">Nacionalidad</Label>
                                        <Input id="nacionalidad" value={form.nacionalidad} onChange={e => setForm({ ...form, nacionalidad: e.target.value })} placeholder="Ej: Peruana" className="bg-background h-9 rounded-md text-sm border border-input focus:ring-1 focus:ring-primary" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider ml-1">Motivo de Viaje</Label>
                                        <Select value={form.motivo_viaje} onValueChange={v => setForm({ ...form, motivo_viaje: v })}>
                                            <SelectTrigger className="h-9 bg-background rounded-md border border-input text-sm"><SelectValue /></SelectTrigger>
                                            <SelectContent className="rounded-md">
                                                <SelectItem value="turismo">Turismo</SelectItem>
                                                <SelectItem value="negocios">Negocios</SelectItem>
                                                <SelectItem value="estudios">Estudios</SelectItem>
                                                <SelectItem value="salud">Salud</SelectItem>
                                                <SelectItem value="otros">Otros</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
 
                            {/* Sección 3: Fechas y Estancia */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-1 h-4 bg-primary rounded-full" />
                                    <h3 className="text-xs font-semibold text-muted-foreground/90 uppercase tracking-wider">3. Fechas y Estancia</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="fecha_entrada" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider ml-1">Fecha Entrada</Label>
                                        <Input id="fecha_entrada" type="date" value={form.fecha_entrada} onChange={e => setForm({ ...form, fecha_entrada: e.target.value })} className="bg-background h-9 rounded-md text-sm border border-input focus:ring-1 focus:ring-primary" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="fecha_salida" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider ml-1">Fecha Salida</Label>
                                        <Input id="fecha_salida" type="date" value={form.fecha_salida} onChange={e => setForm({ ...form, fecha_salida: e.target.value })} className="bg-background h-9 rounded-md text-sm border border-input focus:ring-1 focus:ring-primary" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="noches" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider ml-1">Noches</Label>
                                        <Input id="noches" type="number" readOnly value={noches} className="bg-secondary/30 h-9 rounded-md border border-border text-sm font-semibold text-center" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider ml-1">Total a Pagar</Label>
                                        <div className="h-9 bg-primary/10 border border-primary/20 rounded-md flex items-center justify-center px-4">
                                            <span className="text-sm font-semibold text-primary">S/ {total?.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
 
                            {/* Sección 4: Detalles Adicionales */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-1 h-4 bg-primary rounded-full" />
                                    <h3 className="text-xs font-semibold text-muted-foreground/90 uppercase tracking-wider">4. Detalles Adicionales</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="num_adultos" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider ml-1">Adultos</Label>
                                        <div className="relative">
                                            <UsersIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                            <Input id="num_adultos" type="number" min={1} value={form.num_adultos} onChange={e => setForm({ ...form, num_adultos: Number(e.target.value) })} className="pl-9 bg-background h-9 rounded-md text-sm border border-input focus:ring-1 focus:ring-primary" />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="num_ninos" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider ml-1">Niños</Label>
                                        <Input id="num_ninos" type="number" min={0} value={form.num_ninos} onChange={e => setForm({ ...form, num_ninos: Number(e.target.value) })} className="bg-background h-9 rounded-md text-sm border border-input focus:ring-1 focus:ring-primary" />
                                    </div>
                                    <div className="md:col-span-3 space-y-1.5">
                                        <Label htmlFor="observaciones" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider ml-1">Observaciones</Label>
                                        <div className="relative">
                                            <Info className="absolute left-3 top-3 w-3.5 h-3.5 text-muted-foreground" />
                                            <textarea
                                                id="observaciones"
                                                value={form.observaciones}
                                                onChange={e => setForm({ ...form, observaciones: e.target.value })}
                                                placeholder="Cualquier detalle especial..."
                                                className="w-full pl-9 pr-4 py-2 bg-background border border-input rounded-md min-h-[70px] focus:outline-none focus:ring-1 focus:ring-primary transition-all text-sm"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
 
                        {/* Footer con Botones */}
                        <div className="p-4 bg-muted/10 border-t border-border flex flex-col sm:flex-row gap-3">
                            <Button variant="outline" className="order-2 sm:order-1" onClick={() => setOpen(false)}>
                                Cancelar
                            </Button>
                            <Button className="order-1 flex-1 shadow-sm sm:order-2"
                                onClick={() => {
                                    if (form.huesped_dni && form.huesped_dni.length !== 8 && form.huesped_dni.length !== 11 && form.huesped_dni.length !== 12) {
                                        toast.error('El documento ingresado no tiene un formato válido (DNI 8, RUC 11, CE 12)');
                                        return;
                                    }
                                    saveReserva.mutate({ ...form, noches, total });
                                }}
                                disabled={saveReserva.isPending || !form.habitacion_id || !form.huesped_nombre}>
                                {saveReserva.isPending ? 'Procesando...' : 'Finalizar Registro'}
                            </Button>

                        </div>
                    </div>
                </SheetContent>
            </Sheet>

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

