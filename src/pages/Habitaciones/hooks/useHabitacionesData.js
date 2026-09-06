import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/config/supabase';
import { toast } from 'sonner';
import { validarHabitacion, formatearHabitacionParaBD, puedeEliminarHabitacion } from '@/services/habitaciones.service';
import { parseAmenities } from '../utils/amenities';

const empty = { numero: '', tipo: 'simple', precio: 0, precio_noche: 0, capacidad: 1, piso: '', descripcion: '', estado: 'disponible', imagen_url: '' };

export function useHabitacionesData(hotelDb, hotelId) {
    const qc = useQueryClient();
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState(empty);
    const [amenities, setAmenities] = useState({ wifi: false, tv: false, agua: false, bano: false });
    const [editId, setEditId] = useState(null);
    const [filtroEstado, setFiltroEstado] = useState('todos');
    const [deleteTarget, setDeleteTarget] = useState(null);

    const { data: habitaciones = [], isLoading } = useQuery({
        queryKey: ['habitaciones', hotelId],
        queryFn: () => hotelDb.Habitacion.list(),
        enabled: !!hotelId,
    });

    const { data: reservasActivas = [] } = useQuery({
        queryKey: ['reservas-activas-habitacion', hotelId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('reservas')
                .select('id, habitacion_id, estado')
                .in('estado', ['activa', 'pendiente'])
                .eq('hotel_id', hotelId);
            if (error) throw error;
            return data || [];
        },
        enabled: !!hotelId,
        staleTime: 1000 * 30, // 30 segundos
    });

    const save = useMutation({
        mutationFn: (data) => editId ? hotelDb.Habitacion.update(editId, data) : hotelDb.Habitacion.create(data),
        onSuccess: () => { 
            qc.invalidateQueries({ queryKey: ['habitaciones', hotelId] }); 
            setOpen(false); 
            setForm(empty); 
            setEditId(null); 
        },
    });

    const del = useMutation({
        mutationFn: (id) => hotelDb.Habitacion.delete(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['habitaciones', hotelId] });
            setDeleteTarget(null);
            toast.success("Habitación eliminada correctamente.");
        },
    });

    const openEdit = (h) => { 
        const precioVal = h.precio_noche ?? h.precio ?? 0;
        setForm({ ...h, precio: precioVal, precio_noche: precioVal }); 
        setEditId(h.id); 
        setAmenities(parseAmenities(h.descripcion)); 
        setOpen(true); 
    };

    const openNew = () => { 
        setForm(empty); 
        setEditId(null); 
        setAmenities({ wifi: false, tv: false, agua: false, bano: false }); 
        setOpen(true); 
    };

    const handleSave = () => {
        const precioFinal = Number(form.precio_noche) || Number(form.precio) || 0;

        const validation = validarHabitacion({
            numero: form.numero,
            precio_noche: precioFinal,
            capacidad: Number(form.capacidad) || 1,
            tipo: /** @type {any} */ (form.tipo),
        });

        if (!validation.valido) {
            toast.error(validation.errors.join('. '));
            return;
        }

        const isDuplicate = habitaciones.some(
            h => String(h.numero).toLowerCase() === String(form.numero).toLowerCase() && h.id !== editId
        );

        if (isDuplicate) {
            toast.error(`La habitación #${form.numero} ya existe. Por favor, usa un número diferente.`);
            return;
        }

        const limit = 15;
        if (habitaciones.length >= limit && !editId) {
            toast.error(`Límite del Plan Básico alcanzado (${limit} habitaciones). Por favor, actualiza tu suscripción SaaS para registrar más habitaciones.`);
            return;
        }

        const dataToSave = formatearHabitacionParaBD({
            hotel_id: hotelId,
            numero: form.numero,
            piso: form.piso,
            tipo: /** @type {any} */ (form.tipo),
            estado: /** @type {any} */ (form.estado || 'disponible'),
            precio_noche: precioFinal,
            precio: precioFinal,
            capacidad: Number(form.capacidad) || 1,
            descripcion: JSON.stringify(amenities),
            imagen_url: form.imagen_url || null,
        });
        save.mutate(/** @type {any} */ (dataToSave));
    };

    const requestDelete = (h) => {
        const reservasHab = reservasActivas.filter(
            r => r.habitacion_id === h.id && ['activa', 'pendiente'].includes(r.estado)
        );
        const { permite, error } = puedeEliminarHabitacion(reservasHab.length);

        if (!permite) {
            toast.error(error);
            return;
        }

        setDeleteTarget(h);
    };

    return {
        habitaciones,
        isLoading,
        open, setOpen,
        form, setForm,
        amenities, setAmenities,
        editId,
        filtroEstado, setFiltroEstado,
        deleteTarget, setDeleteTarget,
        openEdit, openNew,
        handleSave, requestDelete,
        del, save
    };
}
