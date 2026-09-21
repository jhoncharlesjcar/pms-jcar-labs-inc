import React, { useEffect, useState } from 'react';
import { Camera, Info, MapPin, Sparkles, User, UsersIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { validarDocumento } from '@/services/recepcion.service';
import { supabase } from '@/config/supabase';
import { hoyLima } from '@/lib/limaDate';

export const NuevaReservaSheet = ({
    open,
    setOpen,
    form,
    setForm,
    habitacionesDisp,
    availabilityLoading,
    availabilityError,
    seleccionarHab,
    loadingIdentity,
    loyaltyAccount,
    handleDniBlur,
    setScannerOpen,
    noches,
    total,
    saveReserva,
    createdReserva,
    onCloseSuccess
}) => {
    const [guestAccess, setGuestAccess] = useState(null);
    const [issuingAccess, setIssuingAccess] = useState(false);
    const hoy = hoyLima();

    useEffect(() => setGuestAccess(null), [createdReserva?.id]);

    const issueGuestAccess = async () => {
        if (!createdReserva?.id) return;
        setIssuingAccess(true);
        try {
            const { data, error } = await supabase.functions.invoke('issue-guest-access', {
                body: { reservation_id: createdReserva.id },
            });
            if (error || !data?.checkin_url) throw error || new Error('No se recibió el enlace');
            setGuestAccess(data);
            toast.success('Enlace seguro generado. El anterior quedó revocado.');
        } catch (error) {
            toast.error(error?.message || 'No se pudo generar el enlace seguro');
        } finally {
            setIssuingAccess(false);
        }
    };

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetContent side="right" className="w-full sm:max-w-3xl bg-card border-l border-border shadow-xl p-0 overflow-hidden flex flex-col h-full">
                <div className="flex-1 overflow-hidden flex flex-col relative">
                    <SheetHeader className="p-4 sm:p-5 pb-0 shrink-0 z-10">
                        <SheetTitle className="text-xl font-bold text-foreground">Registro de Reserva</SheetTitle>
                        <SheetDescription className="text-muted-foreground text-[11px] font-medium uppercase tracking-wider mt-0.5">Completa el registro oficial</SheetDescription>
                    </SheetHeader>

                    <div className="flex-1 overflow-y-auto p-4 sm:p-5 pt-4 space-y-5 sm:space-y-6 custom-scrollbar relative z-0">
                        <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-card to-transparent pointer-events-none z-10 -mt-4" />
                        
                        {createdReserva ? (
                            <div className="flex flex-col items-center justify-center py-10 space-y-6 text-center">
                                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-2">
                                    <Sparkles className="w-8 h-8" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-foreground">¡Reserva Registrada!</h2>
                                    <p className="text-muted-foreground mt-2">
                                        La reserva para <strong>{createdReserva.huesped_nombre}</strong> ha sido guardada con éxito.
                                    </p>
                                </div>
                                
                                {guestAccess?.checkin_url ? (
                                    <div className="w-full max-w-sm space-y-3 bg-muted/30 p-4 rounded-xl border">
                                        <p className="text-sm font-medium text-foreground mb-1">Compartir Enlace de Check-in</p>
                                        <p className="text-xs text-muted-foreground mb-4">Envía este enlace al huésped para que complete sus datos antes de llegar.</p>
                                        
                                        <Button 
                                            variant="default" 
                                            className="w-full bg-[#25D366] hover:bg-[#25D366]/90 text-white gap-2"
                                            onClick={() => {
                                                const url = guestAccess.checkin_url;
                                                const text = `Hola ${createdReserva.huesped_nombre}, gracias por tu reserva. Por favor completa tu check-in digital aquí antes de tu llegada:\n\n${url}`;
                                                window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                                            }}
                                        >
                                            Enviar por WhatsApp
                                        </Button>
                                        <Button 
                                            variant="outline" 
                                            className="w-full gap-2"
                                            onClick={() => {
                                                navigator.clipboard.writeText(guestAccess.checkin_url);
                                                toast.success('Enlace copiado al portapapeles');
                                            }}
                                        >
                                            Copiar Enlace
                                        </Button>
                                    </div>
                                ) : (
                                    <Button type="button" variant="outline" disabled={issuingAccess} onClick={issueGuestAccess}>
                                        {issuingAccess ? 'Generando…' : 'Generar enlace seguro de pre check-in'}
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <>
                                {/* Sección 1: Selección de Habitación */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-1 h-4 bg-primary rounded-full" />
                                        <h3 className="text-xs font-semibold text-muted-foreground/90 uppercase tracking-wider">1. Selección de Habitación</h3>
                                    </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                {availabilityLoading && <p role="status" className="col-span-full py-4 text-center text-sm text-muted-foreground">Consultando disponibilidad y tarifas del PMS…</p>}
                                {!availabilityLoading && habitacionesDisp.map(h => (
                                    <button key={h.id} onClick={() => seleccionarHab(h)}
                                        type="button"
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
                                {!availabilityLoading && !availabilityError && habitacionesDisp.length === 0 && (
                                    <p className="col-span-full py-8 text-center text-sm font-medium text-muted-foreground bg-secondary/20 rounded-2xl border border-dashed border-border/60">
                                        No hay habitaciones libres para esas fechas. Prueba otro rango o revisa el inventario.
                                    </p>
                                )}
                                {availabilityError && (
                                    <p role="alert" className="col-span-full rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-3 text-sm text-destructive">
                                        No se pudo consultar disponibilidad. Recarga e inténtalo de nuevo.
                                    </p>
                                )}
                            </div>
                        </div>

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
                                    <Select value={form.tipo_documento} onValueChange={v => setForm({ ...form, tipo_documento: v, huesped_dni: '' })}>
                                        <SelectTrigger className="h-9 bg-background rounded-md border border-input text-sm"><SelectValue /></SelectTrigger>
                                        <SelectContent className="rounded-md">
                                            <SelectItem value="DNI">DNI (Documento Nacional)</SelectItem>
                                            <SelectItem value="RUC">RUC (Registro Único)</SelectItem>
                                            <SelectItem value="CE">Carnet de Extranjería</SelectItem>
                                            <SelectItem value="pasaporte">Pasaporte</SelectItem>
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
                                            inputMode={['DNI', 'RUC'].includes(form.tipo_documento) ? 'numeric' : 'text'}
                                            pattern={['DNI', 'RUC'].includes(form.tipo_documento) ? '[0-9]*' : undefined}
                                            value={form.huesped_dni} 
                                            onChange={e => setForm({ ...form, huesped_dni: e.target.value })} 
                                            onBlur={e => { if (['DNI', 'RUC'].includes(form.tipo_documento)) handleDniBlur(e.target.value); }}
                                            placeholder="Número de Documento" 
                                            className="bg-background h-9 flex-1 rounded-md text-sm border border-input focus:ring-1 focus:ring-primary font-mono" 
                                        />
                                        <Button 
                                            type="button"
                                            variant="outline" 
                                            size="icon" 
                                            className="h-9 w-9 shrink-0 border-primary/20 text-primary hover:bg-primary/10 rounded-md"
                                            onClick={() => setScannerOpen(true)}
                                            disabled={form.tipo_documento !== 'DNI'}
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
                                            <SelectItem value="activa" disabled={form.fecha_entrada > hoy}>Check-in (Entrada Inmediata)</SelectItem>
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
                                    <Input id="fecha_entrada" type="date" min={hoy} value={form.fecha_entrada} onChange={e => setForm({ ...form, fecha_entrada: e.target.value, habitacion_id: '', precio_noche: 0, total: 0, estado: e.target.value > hoy ? 'pendiente' : form.estado })} className="bg-background h-9 rounded-md text-sm border border-input focus:ring-1 focus:ring-primary" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="fecha_salida" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider ml-1">Fecha Salida</Label>
                                    <Input id="fecha_salida" type="date" min={form.fecha_entrada} value={form.fecha_salida} onChange={e => setForm({ ...form, fecha_salida: e.target.value, habitacion_id: '', precio_noche: 0, total: 0 })} className="bg-background h-9 rounded-md text-sm border border-input focus:ring-1 focus:ring-primary" />
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
                                        <Input id="num_adultos" type="number" min={1} value={form.num_adultos} onChange={e => setForm({ ...form, num_adultos: Number(e.target.value), habitacion_id: '', precio_noche: 0, total: 0 })} className="pl-9 bg-background h-9 rounded-md text-sm border border-input focus:ring-1 focus:ring-primary" />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="num_ninos" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider ml-1">Niños</Label>
                                    <Input id="num_ninos" type="number" min={0} value={form.num_ninos} onChange={e => setForm({ ...form, num_ninos: Number(e.target.value), habitacion_id: '', precio_noche: 0, total: 0 })} className="bg-background h-9 rounded-md text-sm border border-input focus:ring-1 focus:ring-primary" />
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
                        </>
                    )}
                    </div>

                    {/* Footer con Botones */}
                    {!createdReserva && (
                        <div className="p-4 bg-muted/10 border-t border-border flex flex-col sm:flex-row gap-3">
                            <Button variant="outline" className="order-2 sm:order-1" onClick={() => setOpen(false)}>
                                Cancelar
                            </Button>
                            <Button className="order-1 flex-1 shadow-sm sm:order-2"
                                onClick={() => {
                                    const documentValidation = validarDocumento({ tipo: form.tipo_documento, documento: form.huesped_dni });
                                    if (!documentValidation.valido) {
                                        toast.error(documentValidation.error);
                                        return;
                                    }
                                    if (form.fecha_salida <= form.fecha_entrada) {
                                        toast.error('La fecha de salida debe ser posterior a la entrada');
                                        return;
                                    }
                                    saveReserva.mutate({ ...form, noches, total });
                                }}
                                disabled={saveReserva.isPending || !form.habitacion_id || !form.huesped_nombre}>
                                {saveReserva.isPending ? 'Procesando...' : 'Finalizar Registro'}
                            </Button>
                        </div>
                    )}
                    
                    {createdReserva && (
                        <div className="p-4 bg-muted/10 border-t border-border flex flex-col sm:flex-row gap-3">
                            <Button variant="outline" className="w-full" onClick={onCloseSuccess}>
                                Cerrar y Volver
                            </Button>
                        </div>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
};
