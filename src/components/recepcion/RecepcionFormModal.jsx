// @ts-nocheck
import React, { useEffect, useState, memo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { format, addDays } from 'date-fns';
import { User, Camera, Users as UsersIcon, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

import MatrizHabitaciones from '@/components/recepcion/MatrizHabitaciones';
import ScannerDNIModal from '@/components/recepcion/ScannerDNIModal';
import { recepcionSchema } from '@/schemas/recepcion.schema';
import { useTarifador } from '@/hooks/useTarifador';
import { useIdentity } from '@/hooks/useIdentity';
import { calcularNoches } from '@/services/recepcion.service';

const defaultFormValues = {
    habitacion_id: '', habitacion_numero: '', habitacion_tipo: '',
    huesped_nombre: '', huesped_dni: '', tipo_documento: 'DNI',
    huesped_fecha_nacimiento: '', huesped_sexo: 'no_especificado',
    huesped_telefono: '', huesped_email: '',
    huesped_procedencia: '', huesped_pais_residencia: 'Perú', huesped_ciudad_residencia: '',
    nacionalidad: 'Peruana', motivo_viaje: 'turismo',
    huesped_profesion: '', huesped_estado_civil: '', huesped_destino: '',
    fecha_entrada: format(new Date(), 'yyyy-MM-dd'),
    fecha_salida: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
    noches: 1, precio_noche: 0, total: 0,
    incluye_igv: true, moneda_pago: 'PEN', tipo_cambio_dia: 0,
    num_adultos: 1, num_ninos: 0, tiene_menores: false, tipo_relacion_menor: 'padre',
    observaciones: '', estado: 'activa',
    pre_checkin_id: '',
};

/**
 * @param {{
 *   open: boolean,
 *   setOpen: function,
 *   initialData: any,
 *   habitacionesDisp: any[],
 *   tarifas: any[],
 *   saveReserva: any,
 *   configs: any[]
 * }} props
 */
const RecepcionFormModal = memo(function RecepcionFormModal({
    open,
    setOpen,
    initialData,
    habitacionesDisp,
    tarifas,
    saveReserva,
    configs
}) {
    const [scannerOpen, setScannerOpen] = useState(false);
    
    const hotelAplicaIGV = configs?.[0]?.aplica_igv !== false;
    const hotelTipoCambio = configs?.[0]?.tipo_cambio || 3.80;

    const form = useForm({
        resolver: zodResolver(recepcionSchema),
        defaultValues: { ...defaultFormValues, incluye_igv: hotelAplicaIGV, tipo_cambio_dia: hotelTipoCambio },
    });

    const { control, handleSubmit, watch, setValue, reset, formState: { errors } } = form;

    // Reset form when modal opens with new data
    useEffect(() => {
        if (open) {
            const dataToSet = { ...defaultFormValues, incluye_igv: hotelAplicaIGV, tipo_cambio_dia: hotelTipoCambio, ...initialData };
            // Asegurar que nulls o undefineds se traten adecuadamente
            Object.keys(dataToSet).forEach(key => {
                if (dataToSet[key] === null || dataToSet[key] === undefined) {
                    dataToSet[key] = defaultFormValues[key] || '';
                }
            });
            reset(dataToSet);
        }
    }, [open, initialData, reset, hotelAplicaIGV, hotelTipoCambio]);

    const watchValues = watch();
    const { fetchIdentity, loadingIdentity } = useIdentity();

    // Autocompletado de DNI/RUC
    useEffect(() => {
        if (watchValues.tipo_documento === 'DNI' && watchValues.huesped_dni?.length === 8) {
            fetchIdentity('DNI', watchValues.huesped_dni).then(res => {
                if (res?.data?.nombreCompleto) {
                    setValue('huesped_nombre', res.data.nombreCompleto, { shouldValidate: true });
                    toast.success(`Huésped identificado (${res.source})`);
                }
            });
        } else if (watchValues.tipo_documento === 'RUC' && watchValues.huesped_dni?.length === 11) {
            fetchIdentity('RUC', watchValues.huesped_dni).then(res => {
                if (res?.data?.razonSocial) {
                    setValue('huesped_nombre', res.data.razonSocial, { shouldValidate: true });
                    toast.success(`Empresa identificada (${res.source})`);
                }
            });
        }
    }, [watchValues.huesped_dni, watchValues.tipo_documento]);

    // Adaptador para useTarifador
    const pseudoSetForm = (updater) => {
        const nextState = typeof updater === 'function' ? updater(watchValues) : updater;
        Object.entries(nextState).forEach(([key, value]) => {
            if (watchValues[key] !== value) {
                setValue(key, value, { shouldValidate: true });
            }
        });
    };

    useTarifador({ form: watchValues, setForm: pseudoSetForm, tarifas, habitaciones: habitacionesDisp });

    const seleccionarHab = (hab) => {
        const { noches } = calcularNoches({
            fechaEntrada: watchValues.fecha_entrada,
            fechaSalida: watchValues.fecha_salida,
        });
        const precioBase = hab.precio ?? hab.precio_noche ?? 0;
        setValue('habitacion_id', hab.id);
        setValue('habitacion_numero', hab.numero);
        setValue('habitacion_tipo', hab.tipo);
        setValue('precio_noche', precioBase);
        setValue('noches', noches);
        setValue('total', precioBase * noches);
    };

    const onSubmit = (data) => {
        saveReserva.mutate(data);
    };

    const onError = (errors) => {
        const firstErrorKey = Object.keys(errors)[0];
        toast.error(errors[firstErrorKey]?.message || "Error en el formulario", {
            style: {
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                color: '#ef4444',
                backdropFilter: 'blur(16px)'
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-w-3xl glass-panel border-border/80 shadow-2xl rounded-[2.5rem] p-0 overflow-hidden">
                <div className="h-[90vh] flex flex-col">
                    <DialogHeader className="p-5 sm:p-8 pb-0">
                        <DialogTitle className="font-display text-2xl sm:text-3xl font-black text-foreground">Registro de Reserva</DialogTitle>
                        <p className="text-muted-foreground text-[10px] sm:text-sm font-medium uppercase tracking-widest mt-1">Completa el registro oficial</p>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-5 sm:p-8 pt-6 space-y-6 sm:space-y-8 custom-scrollbar">
                        <form id="recepcion-form" onSubmit={handleSubmit(onSubmit, onError)}>
                            {/* Sección 1: Selección de Habitación */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-1 h-4 bg-primary rounded-full" />
                                    <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest">1. Selección de Habitación</h3>
                                </div>
                                <MatrizHabitaciones 
                                    habitacionesDisp={habitacionesDisp} 
                                    form={watchValues} 
                                    seleccionarHab={seleccionarHab} 
                                />
                                {errors.habitacion_id && <p className="text-red-500 text-xs mt-1">{errors.habitacion_id.message}</p>}
                            </div>

                            {/* Sección 2: Datos del Huésped */}
                            <div className="space-y-4 mt-8">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-1 h-4 bg-primary rounded-full" />
                                    <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest">2. Información del Huésped</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                                    <div className="md:col-span-2 space-y-2">
                                        <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Nombre Completo</Label>
                                        <div className="relative group">
                                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                            <Controller name="huesped_nombre" control={control} render={({field}) => (
                                                <Input {...field} placeholder="Ej: Juan Pérez" className="pl-11 bg-background/50 h-12 rounded-xl" />
                                            )} />
                                        </div>
                                        {errors.huesped_nombre && <p className="text-red-500 text-xs">{errors.huesped_nombre.message}</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Tipo de Documento</Label>
                                        <Controller name="tipo_documento" control={control} render={({field}) => (
                                            <Select value={field.value} onValueChange={field.onChange}>
                                                <SelectTrigger className="h-12 bg-background/50 rounded-xl"><SelectValue /></SelectTrigger>
                                                <SelectContent className="rounded-xl">
                                                    <SelectItem value="DNI">DNI</SelectItem>
                                                    <SelectItem value="pasaporte">Pasaporte</SelectItem>
                                                    <SelectItem value="carnet_extranjeria">Carnet Extranjería</SelectItem>
                                                    <SelectItem value="otro">Otro</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )} />
                                    </div>
                                    <div className="space-y-2 relative">
                                        <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">
                                            N° Documento
                                            {loadingIdentity && <span className="ml-2 animate-pulse text-purple-500">Buscando...</span>}
                                        </Label>
                                        <div className="flex gap-2">
                                            <Controller name="huesped_dni" control={control} render={({field}) => (
                                                <Input {...field} placeholder="Número" className="bg-background/50 h-12 rounded-xl flex-1" />
                                            )} />
                                            <Button 
                                                type="button"
                                                variant="outline" 
                                                size="icon" 
                                                className="h-12 w-12 rounded-xl shrink-0 border-primary/20 text-primary hover:bg-primary/10"
                                                onClick={() => setScannerOpen(true)}
                                                title="Escanear DNI con cámara"
                                            >
                                                <Camera className="w-5 h-5" />
                                            </Button>
                                        </div>
                                        {errors.huesped_dni && <p className="text-red-500 text-xs">{errors.huesped_dni.message}</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Sexo (DIRCETUR)</Label>
                                        <Controller name="huesped_sexo" control={control} render={({field}) => (
                                            <Select value={field.value} onValueChange={field.onChange}>
                                                <SelectTrigger className="h-12 bg-background/50 rounded-xl"><SelectValue /></SelectTrigger>
                                                <SelectContent className="rounded-xl">
                                                    <SelectItem value="masculino">Masculino</SelectItem>
                                                    <SelectItem value="femenino">Femenino</SelectItem>
                                                    <SelectItem value="no_especificado">No Especificado</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Fec. Nacimiento</Label>
                                        <Controller name="huesped_fecha_nacimiento" control={control} render={({field}) => (
                                            <Input type="date" {...field} className="bg-background/50 h-12 rounded-xl" />
                                        )} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">País de Residencia</Label>
                                        <Controller name="huesped_pais_residencia" control={control} render={({field}) => (
                                            <Input {...field} placeholder="Ej: Perú" className="bg-background/50 h-12 rounded-xl" />
                                        )} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Ciudad de Residencia</Label>
                                        <Controller name="huesped_ciudad_residencia" control={control} render={({field}) => (
                                            <Input {...field} placeholder="Ej: Lima" className="bg-background/50 h-12 rounded-xl" />
                                        )} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Teléfono</Label>
                                        <Controller name="huesped_telefono" control={control} render={({field}) => (
                                            <Input {...field} placeholder="N° de contacto" className="bg-background/50 h-12 rounded-xl" />
                                        )} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Correo Electrónico</Label>
                                        <Controller name="huesped_email" control={control} render={({field}) => (
                                            <Input type="email" {...field} placeholder="correo@ejemplo.com" className="bg-background/50 h-12 rounded-xl" />
                                        )} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Procedencia</Label>
                                        <Controller name="huesped_procedencia" control={control} render={({field}) => (
                                            <Input {...field} placeholder="Lugar de procedencia" className="bg-background/50 h-12 rounded-xl" />
                                        )} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Destino</Label>
                                        <Controller name="huesped_destino" control={control} render={({field}) => (
                                            <Input {...field} placeholder="Lugar de destino" className="bg-background/50 h-12 rounded-xl" />
                                        )} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Profesión/Ocupación</Label>
                                        <Controller name="huesped_profesion" control={control} render={({field}) => (
                                            <Input {...field} placeholder="Ocupación" className="bg-background/50 h-12 rounded-xl" />
                                        )} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Estado Civil</Label>
                                        <Controller name="huesped_estado_civil" control={control} render={({field}) => (
                                            <Select value={field.value} onValueChange={field.onChange}>
                                                <SelectTrigger className="h-12 bg-background/50 rounded-xl"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                                                <SelectContent className="rounded-xl">
                                                    <SelectItem value="soltero">Soltero(a)</SelectItem>
                                                    <SelectItem value="casado">Casado(a)</SelectItem>
                                                    <SelectItem value="viudo">Viudo(a)</SelectItem>
                                                    <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Nacionalidad</Label>
                                        <Controller name="nacionalidad" control={control} render={({field}) => (
                                            <Input {...field} placeholder="Ej: Peruana" className="bg-background/50 h-12 rounded-xl" />
                                        )} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Motivo de Viaje</Label>
                                        <Controller name="motivo_viaje" control={control} render={({field}) => (
                                            <Select value={field.value} onValueChange={field.onChange}>
                                                <SelectTrigger className="h-12 bg-background/50 rounded-xl"><SelectValue /></SelectTrigger>
                                                <SelectContent className="rounded-xl">
                                                    <SelectItem value="turismo">Turismo / Recreación</SelectItem>
                                                    <SelectItem value="negocios">Negocios / Trabajo</SelectItem>
                                                    <SelectItem value="educacion">Estudios / Capacitación</SelectItem>
                                                    <SelectItem value="salud">Salud / Tratamiento</SelectItem>
                                                    <SelectItem value="transito">Tránsito</SelectItem>
                                                    <SelectItem value="otros">Otros</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Tipo de Registro</Label>
                                        <Controller name="estado" control={control} render={({field}) => (
                                            <Select value={field.value} onValueChange={field.onChange}>
                                                <SelectTrigger className="h-12 bg-background/50 rounded-xl"><SelectValue /></SelectTrigger>
                                                <SelectContent className="rounded-xl">
                                                    <SelectItem value="activa">Check-in (Entrada)</SelectItem>
                                                    <SelectItem value="pendiente">Reserva (Pendiente)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )} />
                                    </div>
                                </div>
                            </div>

                            {/* Sección 3: Fechas e Importes */}
                            <div className="space-y-4 mt-8">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-1 h-4 bg-primary rounded-full" />
                                    <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest">3. Fechas e Importes</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Fecha Entrada</Label>
                                        <Controller name="fecha_entrada" control={control} render={({field}) => (
                                            <DatePicker
                                                selected={field.value ? new Date(field.value + 'T12:00:00') : null}
                                                onChange={date => field.onChange(format(date, 'yyyy-MM-dd'))}
                                                dateFormat="dd/MM/yyyy"
                                                className="bg-background/50 h-12 rounded-xl w-full border border-border/50 px-4 text-sm"
                                                placeholderText="Seleccionar fecha"
                                            />
                                        )} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Fecha Salida</Label>
                                        <Controller name="fecha_salida" control={control} render={({field}) => (
                                            <DatePicker
                                                selected={field.value ? new Date(field.value + 'T12:00:00') : null}
                                                onChange={date => field.onChange(format(date, 'yyyy-MM-dd'))}
                                                dateFormat="dd/MM/yyyy"
                                                className="bg-background/50 h-12 rounded-xl w-full border border-border/50 px-4 text-sm"
                                                placeholderText="Seleccionar fecha"
                                                minDate={watchValues.fecha_entrada ? new Date(watchValues.fecha_entrada + 'T12:00:00') : null}
                                            />
                                        )} />
                                        {errors.fecha_salida && <p className="text-red-500 text-xs">{errors.fecha_salida.message}</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Noches</Label>
                                        <Input type="number" readOnly value={watchValues.noches} className="bg-secondary/30 h-12 rounded-xl font-bold text-center" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Moneda de Pago</Label>
                                        <Controller name="moneda_pago" control={control} render={({field}) => (
                                            <Select value={field.value} onValueChange={v => {
                                                field.onChange(v);
                                                setValue('tipo_cambio_dia', v === 'USD' ? hotelTipoCambio : 0);
                                            }}>
                                                <SelectTrigger className="h-12 bg-background/50 rounded-xl"><SelectValue /></SelectTrigger>
                                                <SelectContent className="rounded-xl">
                                                    <SelectItem value="PEN">Soles (PEN)</SelectItem>
                                                    <SelectItem value="USD">Dólares (USD)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Total a Pagar</Label>
                                        <div className="h-12 bg-primary/10 border border-primary/20 rounded-xl flex flex-col items-center justify-center px-4">
                                            <span className="text-base font-black text-primary italic">S/ {watchValues.total?.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Sección 4: Detalles Adicionales y Menores */}
                            <div className="space-y-4 mt-8">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-1 h-4 bg-primary rounded-full" />
                                    <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest">4. Acompañantes y Menores</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Adultos</Label>
                                        <div className="relative">
                                            <UsersIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                            <Controller name="num_adultos" control={control} render={({field}) => (
                                                <Input type="number" min={1} {...field} onChange={e => field.onChange(Number(e.target.value))} className="pl-11 bg-background/50 h-12 rounded-xl" />
                                            )} />
                                        </div>
                                        {errors.num_adultos && <p className="text-red-500 text-xs">{errors.num_adultos.message}</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Niños (Menores de edad)</Label>
                                        <Controller name="num_ninos" control={control} render={({field}) => (
                                            <Input type="number" min={0} {...field} onChange={e => {
                                                const val = Number(e.target.value);
                                                field.onChange(val);
                                                setValue('tiene_menores', val > 0);
                                            }} className="bg-background/50 h-12 rounded-xl" />
                                        )} />
                                    </div>
                                </div>
                                
                                {watchValues.tiene_menores && (
                                    <div className="bg-secondary/30 rounded-xl p-5 border border-border/50 space-y-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Info className="w-4 h-4 text-amber-500" />
                                            <h4 className="text-sm font-bold text-foreground">Ley N° 30802 - Registro Obligatorio de Menores</h4>
                                        </div>
                                        <div className="space-y-2 md:w-1/3">
                                            <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Parentesco del Titular con el(los) menor(es)</Label>
                                            <Controller name="tipo_relacion_menor" control={control} render={({field}) => (
                                                <Select value={field.value} onValueChange={field.onChange}>
                                                    <SelectTrigger className="h-12 bg-background rounded-xl"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="padre">Padre</SelectItem>
                                                        <SelectItem value="madre">Madre</SelectItem>
                                                        <SelectItem value="tutor_legal">Tutor Legal</SelectItem>
                                                        <SelectItem value="responsable_autorizado">Responsable Autorizado</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            )} />
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-2">
                                            * Se requiere mantener copia de la autorización o DNI que acredite el parentesco. Para esta versión base, los datos de los menores se incluirán en las observaciones.
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Observaciones / Datos de Menores</Label>
                                    <div className="relative">
                                        <Info className="absolute left-4 top-4 w-4 h-4 text-muted-foreground" />
                                        <Controller name="observaciones" control={control} render={({field}) => (
                                            <textarea
                                                {...field}
                                                placeholder={watchValues.tiene_menores ? "Escriba los Nombres y DNI de los menores aquí..." : "Cualquier detalle especial..."}
                                                className="w-full pl-11 pr-4 py-3 bg-background/50 border border-border/50 rounded-2xl min-h-[100px] focus:outline-none focus:border-primary/50 transition text-sm"
                                            />
                                        )} />
                                    </div>
                                    {errors.observaciones && <p className="text-red-500 text-xs">{errors.observaciones.message}</p>}
                                </div>
                            </div>
                        </form>
                    </div>

                    <div className="p-5 sm:p-8 bg-background/40 border-t border-border/50 flex flex-col sm:flex-row gap-3">
                        <Button type="button" variant="outline" className="h-12 sm:h-14 rounded-2xl text-sm font-bold border-border/50 hover:bg-secondary order-2 sm:order-1" onClick={() => setOpen(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" form="recepcion-form" className="flex-1 h-12 sm:h-14 rounded-2xl text-sm sm:text-base font-black shadow-2xl shadow-primary/30 order-1 sm:order-2"
                            disabled={saveReserva.isPending || !watchValues.habitacion_id || !watchValues.huesped_nombre}>
                            {saveReserva.isPending ? 'Procesando...' : 'Finalizar Registro'}
                        </Button>
                    </div>
                </div>
            </DialogContent>

            <ScannerDNIModal 
                open={scannerOpen} 
                onOpenChange={setScannerOpen} 
                onScanSuccess={(data) => {
                    if (data.dni) {
                        setValue('huesped_dni', data.dni, { shouldValidate: true });
                        setValue('tipo_documento', 'DNI', { shouldValidate: true });
                    }
                }} 
            />
        </Dialog>
    );
});
RecepcionFormModal.displayName = 'RecepcionFormModal';
export default RecepcionFormModal;
