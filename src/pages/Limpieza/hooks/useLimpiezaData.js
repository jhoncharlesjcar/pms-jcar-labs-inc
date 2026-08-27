import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useHotelData } from '@/hooks/useHotelData';
import { canTransitionRoomStatus } from '@/constants/roomStatus';
import { formatErrorMessage } from '@/utils/errorMapping';

export function useLimpiezaData() {
    const qc = useQueryClient();
    const { db: hotelDb, hotelId } = useHotelData();
    const [verTodas, setVerTodas] = useState(false);
    const [busqueda, setBusqueda] = useState('');
    const [currentTime, setCurrentTime] = useState(new Date());
    const [mantenimientoModal, setMantenimientoModal] = useState({ open: false, hab: null, motivo: '' });

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const { data: habitaciones = [], isLoading } = useQuery({
        queryKey: ['habitaciones', hotelId],
        queryFn: () => hotelDb.Habitacion.list(),
        enabled: !!hotelId,
    });

    /** @type {import('@tanstack/react-query').UseMutationResult<any, Error, { id: any, estado: string, motivo?: string }>} */
    const actualizarEstado = useMutation({
        mutationFn: ({ id, estado, motivo }) => {
            const currentRoom = habitaciones.find(h => h.id === id);
            if (!currentRoom || !canTransitionRoomStatus(currentRoom.estado, estado)) {
                throw new Error(`No se puede cambiar una habitación de ${currentRoom?.estado || 'estado desconocido'} a ${estado}`);
            }
            let descripcionObj = {};
            try {
                if (currentRoom?.descripcion) {
                    descripcionObj = JSON.parse(currentRoom.descripcion);
                }
            } catch {}

            if (estado === 'limpieza') {
                descripcionObj.limpieza_start = new Date().toISOString();
            } else if (estado === 'disponible') {
                delete descripcionObj.limpieza_start;
                delete descripcionObj.motivo_mantenimiento;
            } else if (estado === 'mantenimiento' && motivo) {
                descripcionObj.motivo_mantenimiento = motivo;
            }

            return hotelDb.Habitacion.update(id, { 
                estado, 
                descripcion: JSON.stringify(descripcionObj) 
            });
        },
        onMutate: async ({ id, estado, motivo }) => {
            await qc.cancelQueries({ queryKey: ['habitaciones', hotelId] });
            const previousHabitaciones = qc.getQueryData(['habitaciones', hotelId]);

            qc.setQueryData(['habitaciones', hotelId], (/** @type {any[]} */ old) => {
                if (!old) return [];
                return old.map(hab => {
                    if (hab.id === id) {
                        let descripcionObj = {};
                        try {
                            if (hab.descripcion) {
                                descripcionObj = JSON.parse(hab.descripcion);
                            }
                        } catch {}

                        if (estado === 'limpieza') {
                            descripcionObj.limpieza_start = new Date().toISOString();
                        } else if (estado === 'disponible') {
                            delete descripcionObj.limpieza_start;
                            delete descripcionObj.motivo_mantenimiento;
                        } else if (estado === 'mantenimiento' && motivo) {
                            descripcionObj.motivo_mantenimiento = motivo;
                        }
                        return {
                            ...hab,
                            estado,
                            descripcion: JSON.stringify(descripcionObj)
                        };
                    }
                    return hab;
                });
            });

            return { previousHabitaciones };
        },
        onError: (err, newVariables, context) => {
            if (context?.previousHabitaciones) {
                qc.setQueryData(['habitaciones', hotelId], context.previousHabitaciones);
            }
            toast.error(formatErrorMessage(err, 'Error al actualizar el estado de la habitación'));
        },
        onSettled: () => {
            qc.invalidateQueries({ queryKey: ['habitaciones', hotelId] });
            setMantenimientoModal({ open: false, hab: null, motivo: '' });
        },
        onSuccess: () => {
            toast.success('Estado actualizado');
        },
    });

    const metrics = useMemo(() => {
        const sucias = habitaciones.filter(h => h.estado === 'limpieza').length;
        const mantenimiento = habitaciones.filter(h => h.estado === 'mantenimiento').length;
        const disponibles = habitaciones.filter(h => h.estado === 'disponible').length;
        const ocupadas = habitaciones.filter(h => h.estado === 'ocupada').length;
        return { sucias, mantenimiento, disponibles, ocupadas };
    }, [habitaciones]);

    const filtradas = useMemo(() => {
        return habitaciones
            .filter(h => {
                const coincideBusqueda = !busqueda || 
                    String(h.numero).toLowerCase().includes(busqueda.toLowerCase()) || 
                    (h.tipo || '').toLowerCase().includes(busqueda.toLowerCase());
                
                const coincideFiltro = verTodas || h.estado === 'limpieza' || h.estado === 'mantenimiento';
                return coincideBusqueda && coincideFiltro;
            })
            .sort((a, b) => {
                const numA = parseInt(a.numero, 10);
                const numB = parseInt(b.numero, 10);
                if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                return String(a.numero).localeCompare(String(b.numero));
            });
    }, [habitaciones, verTodas, busqueda]);

    return {
        verTodas, setVerTodas,
        busqueda, setBusqueda,
        currentTime,
        mantenimientoModal, setMantenimientoModal,
        habitaciones,
        isLoading,
        actualizarEstado,
        metrics,
        filtradas
    };
}
