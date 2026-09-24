import React, { useEffect, useState } from 'react';
import { Camera, ChevronDown, Info, MapPin, Sparkles, User, UsersIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { validarDocumento } from '@/services/recepcion.service';
import { supabase } from '@/config/supabase';
import { hoyLima } from '@/lib/limaDate';
import { RoomAvailabilityGrid } from './RoomAvailabilityGrid';
import { cn } from '@/lib/utils';

const fieldLabel = 'text-xs font-medium text-foreground/80';
const fieldInput = 'bg-background h-11 rounded-md text-sm border border-input focus:ring-1 focus:ring-primary';

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
    const [masDatos, setMasDatos] = useState(false);
    const hoy = hoyLima();

    useEffect(() => setGuestAccess(null), [createdReserva?.id]);
    useEffect(() => { if (!open) setMasDatos(false); }, [open]);

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

    const registrar = () => {
        const documentValidation = validarDocumento({ tipo: form.tipo_documento, documento: form.huesped_dni });
        if (!documentValidation.valido) {
            toast.error(documentValidation.error);
            return;
        }
        if (form.fecha_salida <= form.fecha_entrada) {
            toast.error('La salida tiene que ser posterior a la entrada');
            return;
        }
        saveReserva.mutate({ ...form, noches, total });
    };

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetContent side="right" className="w-full sm:max-w-3xl bg-card border-l border-border shadow-xl p-0 overflow-hidden flex flex-col h-full">
                <div className="flex-1 overflow-hidden flex flex-col relative">
                    <SheetHeader className="p-4 sm:p-5 pb-0 shrink-0 z-10">
                        <SheetTitle className="text-xl font-bold text-foreground">Registro de estadía</SheetTitle>
                        <SheetDescription className="text-sm text-muted-foreground mt-1">
                            Primero el rango. Las habitaciones de abajo son para esas fechas, hora de Lima.
                        </SheetDescription>
                    </SheetHeader>

                    <div className="flex-1 overflow-y-auto p-4 sm:p-5 pt-4 space-y-6 custom-scrollbar relative z-0">
                        {createdReserva ? (
                            <div className="flex flex-col items-center justify-center py-10 space-y-6 text-center">
                                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-2">
                                    <Sparkles className="w-8 h-8" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-foreground">Estadía registrada</h2>
                                    <p className="text-muted-foreground mt-2">
                                        La reserva de <strong>{createdReserva.huesped_nombre}</strong> quedó guardada.
                                    </p>
                                </div>
                                {guestAccess?.checkin_url ? (
                                    <div className="w-full max-w-sm space-y-3 bg-muted/30 p-4 rounded-xl border">
                                        <p className="text-sm font-medium text-foreground">Enlace de pre check-in</p>
                                        <p className="text-xs text-muted-foreground">El huésped completa sus datos antes de llegar.</p>
                                        <Button
                                            variant="default"
                                            className="h-11 w-full bg-[#25D366] hover:bg-[#25D366]/90 text-white gap-2"
                                            onClick={() => {
                                                const url = guestAccess.checkin_url;
                                                const text = `Hola ${createdReserva.huesped_nombre}, completa tu check-in aquí:\n\n${url}`;
                                                window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                                            }}
                                        >
                                            Enviar por WhatsApp
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="h-11 w-full"
                                            onClick={() => {
                                                navigator.clipboard.writeText(guestAccess.checkin_url);
                                                toast.success('Enlace copiado');
                                            }}
                                        >
                                            Copiar enlace
                                        </Button>
                                    </div>
                                ) : (
                                    <Button type="button" variant="outline" className="h-11" disabled={issuingAccess} onClick={issueGuestAccess}>
                                        {issuingAccess ? 'Generando…' : 'Generar enlace de pre check-in'}
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <>
                                <section className="space-y-3">
                                    <h3 className="text-sm font-semibold text-foreground">1. Fechas y ocupación</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="fecha_entrada" className={fieldLabel}>Entrada</Label>
                                            <Input id="fecha_entrada" type="date" min={hoy} value={form.fecha_entrada} onChange={e => setForm({ ...form, fecha_entrada: e.target.value, habitacion_id: '', precio_noche: 0, total: 0, estado: e.target.value > hoy ? 'pendiente' : form.estado })} className={fieldInput} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="fecha_salida" className={fieldLabel}>Salida</Label>
                                            <Input id="fecha_salida" type="date" min={form.fecha_entrada} value={form.fecha_salida} onChange={e => setForm({ ...form, fecha_salida: e.target.value, habitacion_id: '', precio_noche: 0, total: 0 })} className={fieldInput} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="num_adultos" className={fieldLabel}>Adultos</Label>
                                            <div className="relative">
                                                <UsersIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                                <Input id="num_adultos" type="number" min={1} value={form.num_adultos} onChange={e => setForm({ ...form, num_adultos: Number(e.target.value), habitacion_id: '', precio_noche: 0, total: 0 })} className={cn(fieldInput, 'pl-9')} />
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="num_ninos" className={fieldLabel}>Niños</Label>
                                            <Input id="num_ninos" type="number" min={0} value={form.num_ninos} onChange={e => setForm({ ...form, num_ninos: Number(e.target.value), habitacion_id: '', precio_noche: 0, total: 0 })} className={fieldInput} />
                                        </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground">{noches} {noches === 1 ? 'noche' : 'noches'} · S/ {Number(total || 0).toFixed(2)}</p>
                                </section>

                                <section className="space-y-3">
                                    <h3 className="text-sm font-semibold text-foreground">2. Habitación</h3>
                                    <RoomAvailabilityGrid
                                        loading={availabilityLoading}
                                        error={availabilityError}
                                        rooms={habitacionesDisp}
                                        selectedId={form.habitacion_id}
                                        onSelect={seleccionarHab}
                                    />
                                </section>

                                <section className="space-y-3">
                                    <h3 className="text-sm font-semibold text-foreground">3. Huésped</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div className="md:col-span-2 space-y-1.5">
                                            <Label htmlFor="huesped_nombre" className={fieldLabel}>Nombre completo</Label>
                                            <div className="relative">
                                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                                <Input id="huesped_nombre" value={form.huesped_nombre} onChange={e => setForm({ ...form, huesped_nombre: e.target.value })} placeholder="Ej: Juan Pérez" className={cn(fieldInput, 'pl-9')} />
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className={fieldLabel}>Tipo de documento</Label>
                                            <Select value={form.tipo_documento} onValueChange={v => setForm({ ...form, tipo_documento: v, huesped_dni: '' })}>
                                                <SelectTrigger className="h-11 bg-background rounded-md border border-input text-sm"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="DNI">DNI</SelectItem>
                                                    <SelectItem value="RUC">RUC</SelectItem>
                                                    <SelectItem value="CE">Carnet de extranjería</SelectItem>
                                                    <SelectItem value="pasaporte">Pasaporte</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="huesped_dni" className={fieldLabel}>Número</Label>
                                            <div className="flex gap-2">
                                                <Input
                                                    id="huesped_dni"
                                                    inputMode={['DNI', 'RUC'].includes(form.tipo_documento) ? 'numeric' : 'text'}
                                                    value={form.huesped_dni}
                                                    onChange={e => setForm({ ...form, huesped_dni: e.target.value })}
                                                    onBlur={e => { if (['DNI', 'RUC'].includes(form.tipo_documento)) handleDniBlur(e.target.value); }}
                                                    placeholder="Documento"
                                                    className={cn(fieldInput, 'flex-1 font-mono')}
                                                />
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className="h-11 w-11 shrink-0"
                                                    onClick={() => setScannerOpen(true)}
                                                    disabled={form.tipo_documento !== 'DNI'}
                                                    aria-label="Escanear DNI"
                                                >
                                                    <Camera className="w-4 h-4" />
                                                </Button>
                                            </div>
                                            {loadingIdentity && <p className="text-xs text-muted-foreground">Buscando documento…</p>}
                                            {loyaltyAccount && (loyaltyAccount.points_balance || 0) > 0 && (
                                                <p className="text-xs text-amber-600 dark:text-amber-400 inline-flex items-center gap-1">
                                                    <Sparkles className="w-3 h-3" /> Cliente frecuente: {loyaltyAccount.points_balance} pts
                                                </p>
                                            )}
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="huesped_telefono" className={fieldLabel}>Teléfono</Label>
                                            <Input id="huesped_telefono" type="tel" inputMode="numeric" value={form.huesped_telefono} onChange={e => setForm({ ...form, huesped_telefono: e.target.value })} placeholder="987654321" className={cn(fieldInput, 'font-mono')} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className={fieldLabel}>Tipo de registro</Label>
                                            <Select value={form.estado} onValueChange={v => setForm({ ...form, estado: v })}>
                                                <SelectTrigger className="h-11 bg-background rounded-md border border-input text-sm"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="activa" disabled={form.fecha_entrada > hoy}>Check-in de hoy</SelectItem>
                                                    <SelectItem value="pendiente">Reserva pendiente</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <button type="button" className="inline-flex items-center gap-1 text-xs font-medium text-primary" onClick={() => setMasDatos(v => !v)} aria-expanded={masDatos}>
                                        <ChevronDown className={cn('h-4 w-4 transition-transform', masDatos && 'rotate-180')} />
                                        {masDatos ? 'Ocultar datos adicionales' : 'Más datos del huésped'}
                                    </button>

                                    {masDatos && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div className="space-y-1.5">
                                                <Label className={fieldLabel}>Sexo</Label>
                                                <Select value={form.huesped_sexo} onValueChange={v => setForm({ ...form, huesped_sexo: v })}>
                                                    <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="masculino">Masculino</SelectItem>
                                                        <SelectItem value="femenino">Femenino</SelectItem>
                                                        <SelectItem value="no_especificado">No especificado</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label htmlFor="huesped_fecha_nacimiento" className={fieldLabel}>Nacimiento</Label>
                                                <Input id="huesped_fecha_nacimiento" type="date" value={form.huesped_fecha_nacimiento} onChange={e => setForm({ ...form, huesped_fecha_nacimiento: e.target.value })} className={fieldInput} />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label htmlFor="huesped_profesion" className={fieldLabel}>Profesión</Label>
                                                <Input id="huesped_profesion" value={form.huesped_profesion} onChange={e => setForm({ ...form, huesped_profesion: e.target.value })} className={fieldInput} />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className={fieldLabel}>Estado civil</Label>
                                                <Select value={form.huesped_estado_civil} onValueChange={v => setForm({ ...form, huesped_estado_civil: v })}>
                                                    <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="soltero">Soltero(a)</SelectItem>
                                                        <SelectItem value="casado">Casado(a)</SelectItem>
                                                        <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                                                        <SelectItem value="viudo">Viudo(a)</SelectItem>
                                                        <SelectItem value="conviviente">Conviviente</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label htmlFor="huesped_procedencia" className={fieldLabel}>Procedencia</Label>
                                                <div className="relative">
                                                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                                    <Input id="huesped_procedencia" value={form.huesped_procedencia} onChange={e => setForm({ ...form, huesped_procedencia: e.target.value })} className={cn(fieldInput, 'pl-9')} />
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label htmlFor="huesped_destino" className={fieldLabel}>Destino</Label>
                                                <Input id="huesped_destino" value={form.huesped_destino} onChange={e => setForm({ ...form, huesped_destino: e.target.value })} className={fieldInput} />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label htmlFor="nacionalidad" className={fieldLabel}>Nacionalidad</Label>
                                                <Input id="nacionalidad" value={form.nacionalidad} onChange={e => setForm({ ...form, nacionalidad: e.target.value })} className={fieldInput} />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className={fieldLabel}>Motivo de viaje</Label>
                                                <Select value={form.motivo_viaje} onValueChange={v => setForm({ ...form, motivo_viaje: v })}>
                                                    <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="turismo">Turismo</SelectItem>
                                                        <SelectItem value="negocios">Negocios</SelectItem>
                                                        <SelectItem value="estudios">Estudios</SelectItem>
                                                        <SelectItem value="salud">Salud</SelectItem>
                                                        <SelectItem value="otros">Otros</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="md:col-span-2 space-y-1.5">
                                                <Label htmlFor="observaciones" className={fieldLabel}>Observaciones</Label>
                                                <div className="relative">
                                                    <Info className="absolute left-3 top-3 w-3.5 h-3.5 text-muted-foreground" />
                                                    <textarea id="observaciones" value={form.observaciones} onChange={e => setForm({ ...form, observaciones: e.target.value })} className="w-full min-h-[88px] rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </section>
                            </>
                        )}
                    </div>

                    {!createdReserva && (
                        <div className="sticky bottom-0 z-20 flex gap-2 border-t border-border bg-card p-4">
                            <Button type="button" variant="outline" className="h-11" onClick={() => setOpen(false)}>Cancelar</Button>
                            <Button type="button" className="h-11 flex-1" onClick={registrar} disabled={saveReserva.isPending || !form.habitacion_id || !form.huesped_nombre}>
                                {saveReserva.isPending ? 'Guardando…' : 'Registrar estadía'}
                            </Button>
                        </div>
                    )}
                    {createdReserva && (
                        <div className="sticky bottom-0 z-20 border-t border-border bg-card p-4">
                            <Button type="button" variant="outline" className="h-11 w-full" onClick={onCloseSuccess}>Cerrar</Button>
                        </div>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
};
