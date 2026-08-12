import { useState, useRef, useEffect, memo } from 'react';
import { useParams } from 'react-router-dom';
import logger from '@/lib/logger';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { format, addDays } from 'date-fns';
import { User, CreditCard, Phone, Mail, MapPin, CalendarDays, Users, Info, Sparkles, Building2, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { toast } from 'sonner';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const CheckinPublico = memo(function CheckinPublico() {
    const { hotelId } = useParams();
    const [submited, setSubmited] = useState(false);
    // ─── GSAP Scroll Animations ────────────────────────────────────────
    const headerRef = useRef(null);
    const sectionsRef = useRef([]);

    useEffect(() => {
        const els = [headerRef.current, ...sectionsRef.current.filter(Boolean)];
        els.forEach((el) => {
            if (!el) return;
            gsap.fromTo(
                el,
                { opacity: 0, y: 25 },
                {
                    opacity: 1,
                    y: 0,
                    duration: 0.7,
                    ease: 'power3.out',
                    scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none reverse' },
                }
            );
        });

        // Parallax effect on the decorative background blobs
        const bgBlobs = document.querySelectorAll('[data-parallax-bg]');
        bgBlobs.forEach((blob) => {
            gsap.to(blob, {
                y: () => window.innerHeight * 0.15,
                ease: 'none',
                scrollTrigger: { trigger: blob, start: 'top bottom', end: 'bottom top', scrub: 1.5 },
            });
        });

        return () => {
            ScrollTrigger.getAll().forEach((st) => st.kill());
        };
    }, []);

    const [form, setForm] = useState({
        huesped_nombre: '',
        tipo_documento: 'DNI',
        huesped_dni: '',
        huesped_sexo: 'no_especificado',
        huesped_fecha_nacimiento: '',
        huesped_telefono: '',
        huesped_email: '',
        huesped_pais_residencia: 'Perú',
        huesped_ciudad_residencia: '',
        nacionalidad: 'Peruana',
        motivo_viaje: 'turismo',
        fecha_entrada: format(new Date(), 'yyyy-MM-dd'),
        fecha_salida: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
        num_adultos: 1,
        num_ninos: 0,
        tiene_menores: false,
        tipo_relacion_menor: 'padre',
        observaciones: '',
    });

    // Consultar nombre del hotel
    const { data: hotel } = useQuery({
        queryKey: ['public_hotel', hotelId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('hoteles')
                .select('nombre')
                .eq('id', hotelId)
                .single();
            if (error) throw error;
            return data;
        },
        enabled: !!hotelId,
        retry: false,
    });

    // Mutation para enviar pre-registro
    const saveCheckin = useMutation({
        mutationFn: async (/** @type {any} */ data) => {
            const { data: res, error } = await supabase
                .from('checkins_publicos')
                .insert({
                    ...data,
                    hotel_id: hotelId,
                })
                .select()
                .single();
            if (error) throw error;
            return res;
        },
        onSuccess: () => {
            setSubmited(true);
            toast.success("¡Pre-registro enviado con éxito!");
        },
        onError: (err) => {
            logger.error(err);
            toast.error("Error al enviar el pre-registro. Verifique los campos.");
        }
    });

    const handleFormSubmit = (e) => {
        e.preventDefault();
        
        // Validaciones básicas
        if (!form.huesped_nombre || form.huesped_nombre.trim().length < 3) {
            toast.error("El nombre completo es requerido (mínimo 3 caracteres)");
            return;
        }
        if (!form.huesped_dni) {
            toast.error("El número de documento es obligatorio");
            return;
        }
        if (form.tipo_documento === 'DNI' && !/^\d{8}$/.test(form.huesped_dni.trim())) {
            toast.error("El DNI debe tener exactamente 8 dígitos numéricos");
            return;
        }
        if (form.tipo_documento === 'RUC' && !/^\d{11}$/.test(form.huesped_dni.trim())) {
            toast.error("El RUC debe tener exactamente 11 dígitos numéricos");
            return;
        }
        
        // Ley 30802
        if (form.tiene_menores && (!form.observaciones || form.observaciones.trim().length < 5)) {
            toast.error("Por la Ley N° 30802, debe indicar los Nombres y DNI de los menores en observaciones");
            return;
        }

        const entrada = new Date(form.fecha_entrada + 'T12:00:00');
        const salida = new Date(form.fecha_salida + 'T12:00:00');
        if (salida <= entrada) {
            toast.error("La fecha de salida debe ser posterior a la fecha de entrada");
            return;
        }

        saveCheckin.mutate(form);
    };

    if (submited) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4 font-sans select-none text-foreground overflow-hidden relative">
                {/* Background gradient */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />

                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="max-w-md w-full bg-card/80 backdrop-blur-3xl border border-border/50 p-8 rounded-[2.5rem] text-center shadow-2xl space-y-6"
                >
                    <div className="w-20 h-20 bg-card/80 border border-emerald-500/20 rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/5 animate-pulse">
                        <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                    </div>

                    <div className="space-y-2">
                        <h2 className="font-display text-2xl font-black tracking-tight text-foreground">¡Registro Enviado!</h2>
                        <p className="text-xs font-bold uppercase tracking-widest text-emerald-500">{hotel?.nombre || 'PMS JCAR LABS'}</p>
                    </div>

                    <p className="text-muted-foreground text-sm font-medium leading-relaxed">
                        Tus datos han sido enviados directamente a la recepción del hotel. Por favor, acércate al mostrador para completar la asignación de tu habitación y la entrega de llaves.
                    </p>

                    <div className="pt-4 border-t border-border/10 text-xs text-muted-foreground font-medium">
                        Cumplimiento legal y tributario garantizado bajo la normativa peruana.
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background flex flex-col font-sans text-foreground relative pb-10">
            {/* Background elements with parallax */}
            <div data-parallax-bg className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
            <div data-parallax-bg className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="max-w-2xl w-full mx-auto px-4 pt-8 z-10 flex-1">
                {/* Header */}
                <div ref={headerRef} className="text-center mb-8" data-reveal="fade-up">
                    <div className="w-14 h-14 bg-primary/20 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-primary/30 shadow-lg mx-auto mb-4">
                        <Building2 className="w-7 h-7 text-primary" />
                    </div>
                    <h1 className="font-display text-2xl sm:text-3xl font-black text-foreground leading-tight tracking-tight">Check-in Digital</h1>
                    <p className="text-xs font-black text-primary uppercase tracking-[0.2em] mt-1">{hotel?.nombre || 'Auto-Registro de Huésped'}</p>
                </div>

                {/* Form Wrapper */}
                <motion.form 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    onSubmit={handleFormSubmit}
                    className="bg-card/80 backdrop-blur-3xl border border-border/50 rounded-[2.5rem] p-6 sm:p-8 space-y-6 sm:space-y-8 shadow-2xl"
                >
                    {/* Sección 1: Datos Personales */}
                    <div ref={(el) => (sectionsRef.current[0] = el)} className="space-y-4" data-reveal>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-1 h-4 bg-primary rounded-full" />
                            <h3 className="text-xs font-black text-primary uppercase tracking-widest">1. Información del Huésped</h3>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="sm:col-span-2 space-y-2">
                                <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Nombre Completo</Label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input 
                                        value={form.huesped_nombre} 
                                        onChange={e => setForm({ ...form, huesped_nombre: e.target.value })} 
                                        placeholder="Ej: Juan Pérez" 
                                        className="pl-11 bg-background/60 h-12 rounded-xl text-foreground border-border/50" 
                                        required 
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Tipo de Documento</Label>
                                <Select value={form.tipo_documento} onValueChange={v => setForm({ ...form, tipo_documento: v, huesped_dni: '' })}>
                                    <SelectTrigger className="h-12 bg-background/60 rounded-xl border-border/50 text-foreground text-base sm:text-sm"><SelectValue /></SelectTrigger>
                                    <SelectContent className="bg-popover border-border/50 text-foreground rounded-xl">
                                        <SelectItem value="DNI">DNI (Perú)</SelectItem>
                                        <SelectItem value="RUC">RUC (Empresas)</SelectItem>
                                        <SelectItem value="pasaporte">Pasaporte</SelectItem>
                                        <SelectItem value="carnet_extranjeria">Carnet Extranjería</SelectItem>
                                        <SelectItem value="otro">Otro</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">N° de Documento</Label>
                                <div className="relative">
                                    <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input 
                                        value={form.huesped_dni} 
                                        onChange={e => setForm({ ...form, huesped_dni: e.target.value })} 
                                        placeholder="Número de documento" 
                                        className="pl-11 bg-background/60 h-12 rounded-xl text-foreground border-border/50" 
                                        required 
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Sexo (DIRCETUR)</Label>
                                <Select value={form.huesped_sexo} onValueChange={v => setForm({ ...form, huesped_sexo: v })}>
                                    <SelectTrigger className="h-12 bg-background/60 rounded-xl border-border/50 text-foreground text-base sm:text-sm"><SelectValue /></SelectTrigger>
                                    <SelectContent className="bg-popover border-border/50 text-foreground rounded-xl">
                                        <SelectItem value="masculino">Masculino</SelectItem>
                                        <SelectItem value="femenino">Femenino</SelectItem>
                                        <SelectItem value="no_especificado">No Especificado</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Fecha Nacimiento</Label>
                                <Input 
                                    type="date" 
                                    value={form.huesped_fecha_nacimiento} 
                                    onChange={e => setForm({ ...form, huesped_fecha_nacimiento: e.target.value })} 
                                    className="bg-background/60 h-12 rounded-xl text-foreground border-border/50" 
                                    required 
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Teléfono</Label>
                                <div className="relative">
                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input 
                                        value={form.huesped_telefono} 
                                        onChange={e => setForm({ ...form, huesped_telefono: e.target.value })} 
                                        placeholder="Ej: +51 987654321" 
                                        className="pl-11 bg-background/60 h-12 rounded-xl text-foreground border-border/50" 
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Correo Electrónico</Label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input 
                                        type="email" 
                                        value={form.huesped_email} 
                                        onChange={e => setForm({ ...form, huesped_email: e.target.value })} 
                                        placeholder="Ej: correo@ejemplo.com" 
                                        className="pl-11 bg-background/60 h-12 rounded-xl text-foreground border-border/50" 
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Sección 2: Procedencia e i18n */}
                    <div ref={(el) => (sectionsRef.current[1] = el)} className="space-y-4" data-reveal>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-1 h-4 bg-primary rounded-full" />
                            <h3 className="text-xs font-black text-primary uppercase tracking-widest">2. Procedencia y Residencia</h3>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">País de Residencia</Label>
                                <div className="relative">
                                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input 
                                        value={form.huesped_pais_residencia} 
                                        onChange={e => setForm({ ...form, huesped_pais_residencia: e.target.value })} 
                                        placeholder="Ej: Perú" 
                                        className="pl-11 bg-background/60 h-12 rounded-xl text-foreground border-border/50" 
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Ciudad de Procedencia</Label>
                                <Input 
                                    value={form.huesped_ciudad_residencia} 
                                    onChange={e => setForm({ ...form, huesped_ciudad_residencia: e.target.value })} 
                                    placeholder="Ej: Cusco" 
                                    className="bg-background/60 h-12 rounded-xl text-foreground border-border/50" 
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Nacionalidad</Label>
                                <Input 
                                    value={form.nacionalidad} 
                                    onChange={e => setForm({ ...form, nacionalidad: e.target.value })} 
                                    placeholder="Ej: Peruana" 
                                    className="bg-background/60 h-12 rounded-xl text-foreground border-border/50" 
                                />
                            </div>
                        </div>
                    </div>

                    {/* Sección 3: Fechas y Estancia */}
                    <div ref={(el) => (sectionsRef.current[2] = el)} className="space-y-4" data-reveal>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-1 h-4 bg-primary rounded-full" />
                            <h3 className="text-xs font-black text-primary uppercase tracking-widest">3. Fechas de Estancia</h3>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Fecha de Ingreso (Check-in)</Label>
                                <div className="relative">
                                    <CalendarDays className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input 
                                        type="date" 
                                        value={form.fecha_entrada} 
                                        onChange={e => setForm({ ...form, fecha_entrada: e.target.value })} 
                                        className="pl-11 bg-background/60 h-12 rounded-xl text-foreground border-border/50" 
                                        required 
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Fecha de Salida (Check-out)</Label>
                                <div className="relative">
                                    <CalendarDays className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input 
                                        type="date" 
                                        value={form.fecha_salida} 
                                        onChange={e => setForm({ ...form, fecha_salida: e.target.value })} 
                                        className="pl-11 bg-background/60 h-12 rounded-xl text-foreground border-border/50" 
                                        required 
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Sección 4: Menores y acompañantes */}
                    <div ref={(el) => (sectionsRef.current[3] = el)} className="space-y-4" data-reveal>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-1 h-4 bg-primary rounded-full" />
                            <h3 className="text-xs font-black text-primary uppercase tracking-widest">4. Acompañantes y Menores</h3>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">N° de Adultos</Label>
                                <div className="relative">
                                    <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input 
                                        type="number" 
                                        min={1} 
                                        value={form.num_adultos} 
                                        onChange={e => setForm({ ...form, num_adultos: Number(e.target.value) })} 
                                        className="pl-11 bg-background/60 h-12 rounded-xl text-foreground border-border/50" 
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">N° de Niños (Menores)</Label>
                                <Input 
                                    type="number" 
                                    min={0} 
                                    value={form.num_ninos} 
                                    onChange={e => setForm({ ...form, num_ninos: Number(e.target.value), tiene_menores: Number(e.target.value) > 0 })} 
                                    className="bg-background/60 h-12 rounded-xl text-foreground border-border/50" 
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Motivo de Viaje</Label>
                                <Select value={form.motivo_viaje} onValueChange={v => setForm({ ...form, motivo_viaje: v })}>
                                    <SelectTrigger className="h-12 bg-background/60 rounded-xl border-border/50 text-foreground text-base sm:text-sm"><SelectValue /></SelectTrigger>
                                    <SelectContent className="bg-popover border-border/50 text-foreground rounded-xl">
                                        <SelectItem value="turismo">Turismo</SelectItem>
                                        <SelectItem value="negocios">Trabajo / Negocios</SelectItem>
                                        <SelectItem value="estudios">Estudios</SelectItem>
                                        <SelectItem value="salud">Salud</SelectItem>
                                        <SelectItem value="otros">Otros</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {form.tiene_menores && (
                            <motion.div 
                                initial={{ opacity: 0, height: 0 }} 
                                animate={{ opacity: 1, height: 'auto' }} 
                                className="bg-background/40 rounded-xl p-5 border border-amber-500/20 space-y-4"
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <Info className="w-4 h-4 text-amber-500 animate-bounce" />
                                    <h4 className="text-sm font-bold text-foreground">Ley N° 30802 - Registro de Menores de Edad</h4>
                                </div>
                                <div className="space-y-2 sm:w-1/2">
                                    <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Parentesco del responsable legal</Label>
                                    <Select value={form.tipo_relacion_menor} onValueChange={v => setForm({ ...form, tipo_relacion_menor: v })}>
                                        <SelectTrigger className="h-12 bg-popover rounded-xl border-border/50 text-foreground text-base sm:text-sm"><SelectValue /></SelectTrigger>
                                        <SelectContent className="bg-popover border-border/50 text-foreground rounded-xl">
                                            <SelectItem value="padre">Padre / Madre</SelectItem>
                                            <SelectItem value="tutor_legal">Tutor Legal</SelectItem>
                                            <SelectItem value="familiar">Familiar Autorizado</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="text-xs text-muted-foreground leading-relaxed">
                                    * De acuerdo con la Ley Peruana, es obligatorio registrar los datos completos de los menores de edad y acreditar la filiación mediante DNI o carta poder.
                                </div>
                            </motion.div>
                        )}

                        <div className="space-y-2">
                            <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">
                                {form.tiene_menores ? "Observaciones (Nombres y DNI de los menores obligatorio)" : "Observaciones / Detalles especiales"}
                            </Label>
                            <textarea 
                                value={form.observaciones}
                                onChange={e => setForm({ ...form, observaciones: e.target.value })}
                                placeholder={form.tiene_menores ? "Ej: Menor 1: Mateo Pérez, DNI: 77777777..." : "Cualquier indicación especial..."}
                                className="w-full h-24 bg-background/60 border border-border/50 rounded-2xl p-4 text-xs font-medium focus:outline-none focus:border-primary/50 text-foreground resize-none"
                            />
                        </div>
                    </div>

                    {/* Submit Button */}
                    <div ref={(el) => (sectionsRef.current[4] = el)} className="pt-4" data-reveal>
                        <Button 
                            type="submit" 
                            disabled={saveCheckin.isPending}
                            className="w-full h-14 bg-primary hover:bg-primary/95 text-foreground font-black text-base tracking-wider uppercase rounded-2xl shadow-xl shadow-primary/20 transition duration-200 gap-2"
                        >
                            <Sparkles className="w-5 h-5 animate-pulse" />
                            {saveCheckin.isPending ? 'Enviando Registro...' : 'Enviar Pre-registro'}
                        </Button>
                    </div>
                </motion.form>
            </div>
        </div>
    );
});
CheckinPublico.displayName = 'CheckinPublico';
export default CheckinPublico;
