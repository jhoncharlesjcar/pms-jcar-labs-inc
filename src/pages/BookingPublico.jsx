import { useState, useRef, useEffect, memo } from 'react';
import { useParams } from 'react-router-dom';
import logger from '@/lib/logger';
import { useQuery, useMutation } from '@tanstack/react-query';
import { CalendarDays, User, Search, CheckCircle, ShoppingBag, PlusCircle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { differenceInDays, format, addDays } from 'date-fns';

import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { supabase } from '@/lib/supabaseClient';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const BookingPublico = memo(function BookingPublico() {
    const { hotelId } = useParams();
    const [step, setStep] = useState(1); // 1: Búsqueda, 2: Datos, 3: Éxito
    const [buscado, setBuscado] = useState(false);
    
    const [searchForm, setSearchForm] = useState({
        fecha_entrada: format(new Date(), 'yyyy-MM-dd'),
        fecha_salida: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
        adultos: 1,
        ninos: 0,
    });

    const [selectedHab, setSelectedHab] = useState(null);
    const [selectedExtras, setSelectedExtras] = useState([]);

    const [guestForm, setGuestForm] = useState({
        huesped_nombre: '',
        tipo_documento: 'DNI',
        huesped_dni: '',
        huesped_telefono: '',
        huesped_email: '',
        observaciones: '',
    });

    // Cargar datos del hotel
    const { data: hotelInfo } = useQuery({
        queryKey: ['hotel_public', hotelId],
        queryFn: async () => {
            const { data, error } = await supabase.from('hoteles').select('*').eq('id', hotelId).single();
            if (error) throw error;
            return data;
        },
        enabled: !!hotelId
    });

    // Cargar todas las habitaciones y reservas para cruzar disponibilidad
    const { data: todasHabitaciones = [] } = useQuery({
        queryKey: ['habitaciones_public', hotelId],
        queryFn: async () => {
            const { data, error } = await supabase.from('habitaciones').select('*').eq('hotel_id', hotelId);
            if (error) throw error;
            return data;
        },
        enabled: !!hotelId
    });

    const { data: todasReservas = [] } = useQuery({
        queryKey: ['reservas_public', hotelId],
        queryFn: async () => {
            const { data, error } = await supabase.from('reservas').select('*').eq('hotel_id', hotelId).in('estado', ['pendiente', 'activa']);
            if (error) throw error;
            return data;
        },
        enabled: !!hotelId
    });

    const { data: tarifas = [] } = useQuery({
        queryKey: ['tarifas_public', hotelId],
        queryFn: async () => {
            const { data, error } = await supabase.from('tarifas_dinamicas').select('*').eq('hotel_id', hotelId).eq('activo', true);
            if (error) throw error;
            return data;
        },
        enabled: !!hotelId
    });

    // Cargar servicios extra (Upselling)
    const { data: extras = [] } = useQuery({
        queryKey: ['extras_public', hotelId],
        queryFn: async () => {
            const { data, error } = await supabase.from('servicios_extra').select('*').eq('hotel_id', hotelId).eq('disponible', true);
            if (error) throw error;
            return data;
        },
        enabled: !!hotelId
    });

    const [disponibles, setDisponibles] = useState([]);

    const calcularPrecioDinamico = (hab) => {
        const diff = differenceInDays(new Date(searchForm.fecha_salida), new Date(searchForm.fecha_entrada));
        const n = diff > 0 ? diff : 1;
        const precioBase = hab.precio ?? hab.precio_noche ?? 80;
        let totalAcumulado = 0;
        const entrada = new Date(searchForm.fecha_entrada + 'T12:00:00');

        for (let i = 0; i < n; i++) {
            const diaEvaluado = addDays(entrada, i);
            const diaSemana = diaEvaluado.getDay();
            const fechaStr = format(diaEvaluado, 'yyyy-MM-dd');

            let factorAplicado = 1.0;

            const reglasAplicables = tarifas.filter(t => 
                t.habitacion_tipo === 'todos' || t.habitacion_tipo === hab.tipo
            );

            const reglaTemporada = reglasAplicables.find(t => 
                t.tipo === 'temporada' && 
                t.fecha_inicio <= fechaStr && 
                t.fecha_fin >= fechaStr
            );

            if (reglaTemporada) {
                factorAplicado = Number(reglaTemporada.factor_ajuste);
            } else {
                const reglaDia = reglasAplicables.find(t => 
                    t.tipo === 'dia_semana' && 
                    Array.isArray(t.dias_semana) && t.dias_semana.includes(diaSemana)
                );
                if (reglaDia) {
                    factorAplicado = Number(reglaDia.factor_ajuste);
                }
            }

            totalAcumulado += (precioBase * factorAplicado);
        }

        return {
            total: totalAcumulado,
            promedioNoche: totalAcumulado / n
        };
    };

    // Filtrar habitaciones disponibles que no choquen con ninguna reserva
    const buscarHabitaciones = () => {
        if (!searchForm.fecha_entrada || !searchForm.fecha_salida) {
            toast.error("Seleccione ambas fechas");
            return;
        }

        const entrada = searchForm.fecha_entrada;
        const salida = searchForm.fecha_salida;

        // Filtrar habitaciones que NO tengan choques en el rango de fechas
        const libres = todasHabitaciones.filter(hab => {
            if (hab.estado === 'mantenimiento') return false;

            const tieneChoque = todasReservas.some(res => {
                if (res.habitacion_id !== hab.id) return false;
                // Lógica de colisión de fechas
                return res.fecha_entrada < salida && res.fecha_salida > entrada;
            });

            return !tieneChoque;
        });

        setDisponibles(libres);
        setBuscado(true);
    };

    const crearReservaPublica = useMutation({
        mutationFn: async (/** @type {any} */ payload) => {
            const { data, error } = await supabase.from('reservas').insert([payload]).select().single();
            if (error) throw error;
            return data;
        },
        onSuccess: (data) => {
            setStep(3);
            toast.success("¡Reserva confirmada con éxito!");
            
            // REDIRECCIÓN A WHATSAPP (Opción B del Sprint 2)
            const telefonoHotel = hotelInfo?.telefono || hotelInfo?.celular;
            if (telefonoHotel) {
                let numLimpio = telefonoHotel.replace(/\D/g, '');
                if (!numLimpio.startsWith('51') && numLimpio.length === 9) {
                    numLimpio = '51' + numLimpio; // Prefijo Perú
                }
                
                const { total } = calcularPrecioDinamico(selectedHab);
                const mensaje = `🏨 *Nueva Pre-Reserva Web* (Cod: ${data.numero_reserva})\n\n👤 *Huésped:* ${guestForm.huesped_nombre}\n🛏️ *Habitación:* ${selectedHab.numero} (${selectedHab.tipo})\n📅 *Fechas:* ${searchForm.fecha_entrada} al ${searchForm.fecha_salida}\n💰 *Total a pagar:* S/ ${total.toFixed(2)}\n\nHola, acabo de reservar en la web. ¿Me pueden enviar los números de cuenta o Yape/Plin para enviar el voucher y confirmar?`;
                const urlWa = `https://wa.me/${numLimpio}?text=${encodeURIComponent(mensaje)}`;
                
                // Redirigir después de 2.5 segundos para que vean el check de éxito
                setTimeout(() => {
                    window.open(urlWa, '_blank');
                }, 2500);
            }
        },
        onError: (err) => {
            logger.error("Error al crear reserva:", err);
            toast.error("Error al registrar su reserva. Inténtelo de nuevo.");
        }
    });

    const handleConfirmBooking = () => {
        if (!guestForm.huesped_nombre || !guestForm.huesped_dni || !guestForm.huesped_telefono) {
            toast.error("Por favor complete los campos obligatorios (*)");
            return;
        }

        const diff = differenceInDays(new Date(searchForm.fecha_salida), new Date(searchForm.fecha_entrada));
        const noches = diff > 0 ? diff : 1;
        const { total, promedioNoche } = calcularPrecioDinamico(selectedHab);

        const payload = {
            hotel_id: hotelId,
            habitacion_id: selectedHab.id,
            habitacion_numero: selectedHab.numero,
            habitacion_tipo: selectedHab.tipo,
            huesped_nombre: guestForm.huesped_nombre,
            huesped_dni: guestForm.huesped_dni,
            tipo_documento: guestForm.tipo_documento,
            huesped_telefono: guestForm.huesped_telefono,
            huesped_email: guestForm.huesped_email,
            fecha_entrada: searchForm.fecha_entrada,
            fecha_salida: searchForm.fecha_salida,
            noches: noches,
            precio_noche: promedioNoche,
            total: total,
            num_adultos: searchForm.adultos,
            num_ninos: searchForm.ninos,
            observaciones: `[AUTO-RESERVA ONLINE] ${guestForm.observaciones}`,
            estado: 'pendiente', // Siempre entra como pendiente de confirmación por el staff
            numero_reserva: `W${Date.now().toString().slice(-6)}`,
            origen: 'booking_engine',
            servicios_extra_ids: selectedExtras.map(e => e.id)
        };

        const extrasTotal = selectedExtras.reduce((sum, e) => sum + Number(e.precio), 0);
        payload.total += extrasTotal;

        crearReservaPublica.mutate(payload);
    };

    // ─── GSAP Scroll Animations ────────────────────────────────────────
    const headerRef = useRef(null);
    const searchPanelRef = useRef(null);
    const resultsRef = useRef(null);

    useEffect(() => {
        const ctx = gsap.context(() => {
            // Scroll-triggered reveals for each section
            const sections = [headerRef.current, searchPanelRef.current].filter(Boolean);
            sections.forEach((el) => {
                if (!el) return;
                gsap.fromTo(
                    el,
                    { opacity: 0, y: 30 },
                    {
                        opacity: 1,
                        y: 0,
                        duration: 0.8,
                        ease: 'power3.out',
                        scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none reverse' },
                    }
                );
            });

            // Stagger on available rooms when they appear
            if (disponibles.length > 0 && resultsRef.current) {
                const cardsNodeList = resultsRef.current.querySelectorAll('[data-room-card]');
                const cards = Array.from(cardsNodeList).filter(Boolean);
                if (cards.length > 0) {
                    gsap.fromTo(
                        cards,
                        { opacity: 0, y: 20, scale: 0.98 },
                        {
                            opacity: 1,
                            y: 0,
                            scale: 1,
                            duration: 0.5,
                            ease: 'power2.out',
                            stagger: 0.08,
                            scrollTrigger: { trigger: resultsRef.current, start: 'top 85%', toggleActions: 'play none none reverse' },
                        }
                    );
                }
            }
        });

        return () => ctx.revert();
    }, [disponibles.length]);

    return (
        <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary selection:text-foreground px-4 py-8 flex flex-col items-center">
            {/* Header del Hotel */}
            <div ref={headerRef} className="max-w-xl w-full text-center mb-8">
                <span className="text-xs text-primary uppercase font-black tracking-widest bg-primary/10 border border-primary/20 px-3 py-1 rounded-full" data-reveal="fade-up">
                    Reservas Online
                </span>
                <h1 className="text-3xl font-black font-display tracking-tight mt-3 text-foreground" data-reveal="fade-up">
                    {hotelInfo?.nombre || 'PMS JCAR LABS'}
                </h1>
                <p className="text-xs text-muted-foreground mt-1.5 uppercase font-black tracking-wider" data-reveal="fade-up">
                    Ficha de Reserva Directa
                </p>
            </div>

            <div className="max-w-xl w-full">
                <AnimatePresence mode="wait">
                    {step === 1 && (
                        <motion.div
                            key="search"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="space-y-6"
                        >
                            {/* Panel de Búsqueda */}
                            <div ref={searchPanelRef} className="bg-card/40 backdrop-blur-xl border border-border/50 rounded-3xl p-6 space-y-4" data-reveal>
                                <h3 className="text-sm font-black text-primary uppercase tracking-widest flex items-center gap-2">
                                    <CalendarDays className="w-4 h-4" /> 1. Fechas de Estadía
                                </h3>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Entrada</Label>
                                        <DatePicker
                                            selected={new Date(searchForm.fecha_entrada + 'T12:00:00')}
                                            onChange={date => setSearchForm({ ...searchForm, fecha_entrada: format(date, 'yyyy-MM-dd') })}
                                            dateFormat="dd/MM/yyyy"
                                            minDate={new Date()}
                                            className="w-full bg-background border border-border/50 rounded-xl px-4 py-3 text-sm font-bold text-foreground focus:outline-none focus:border-primary"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Salida</Label>
                                        <DatePicker
                                            selected={new Date(searchForm.fecha_salida + 'T12:00:00')}
                                            onChange={date => setSearchForm({ ...searchForm, fecha_salida: format(date, 'yyyy-MM-dd') })}
                                            dateFormat="dd/MM/yyyy"
                                            minDate={addDays(new Date(searchForm.fecha_entrada + 'T12:00:00'), 1)}
                                            className="w-full bg-background border border-border/50 rounded-xl px-4 py-3 text-sm font-bold text-foreground focus:outline-none focus:border-primary"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Adultos</Label>
                                        <Input 
                                            type="number" 
                                            min={1} 
                                            value={searchForm.adultos} 
                                            onChange={e => setSearchForm({ ...searchForm, adultos: Number(e.target.value) })}
                                            className="bg-background border-border/50 h-12 rounded-xl text-center font-bold"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Niños</Label>
                                        <Input 
                                            type="number" 
                                            min={0} 
                                            value={searchForm.ninos} 
                                            onChange={e => setSearchForm({ ...searchForm, ninos: Number(e.target.value) })}
                                            className="bg-background border-border/50 h-12 rounded-xl text-center font-bold"
                                        />
                                    </div>
                                </div>

                                <Button 
                                    onClick={buscarHabitaciones} 
                                    className="w-full h-14 rounded-full font-black text-xs uppercase tracking-[0.2em] gap-0 bg-primary shadow-lg shadow-primary/20 flex justify-between p-1.5 pl-6"
                                >
                                    <span>Buscar Habitaciones Disponibles</span>
                                    <div className="w-11 h-11 rounded-full bg-white text-primary flex items-center justify-center shadow-sm">
                                        <Search className="w-4 h-4" />
                                    </div>
                                </Button>
                            </div>

                            {/* Resultados */}
                            {buscado && (
                                <div className="space-y-4">
                                    <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">
                                        Habitaciones Disponibles ({disponibles.length})
                                    </h3>
                                    
                                    {disponibles.length === 0 ? (
                                        <div className="bg-muted/50 border border-dashed border-border/50 rounded-3xl p-10 text-center text-muted-foreground text-sm font-semibold">
                                            No hay habitaciones totalmente libres en las fechas seleccionadas. Modifique sus fechas.
                                        </div>
                                    ) : (
                                        <div ref={resultsRef} className="grid grid-cols-1 gap-4">
                                            {disponibles.map((hab, idx) => (
                                                <div 
                                                    key={hab.id} 
                                                    data-room-card
                                                    className="bg-muted/30 border border-border/50 rounded-2xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-primary/30 transition hover:shadow-lg hover:-translate-y-0.5"
                                                    style={{ transitionDelay: `${idx * 80}ms` }}
                                                >
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-muted flex-shrink-0 relative group">
                                                                <img 
                                                                    src={`https://images.unsplash.com/photo-1611892440504-42a792e24d32?q=80&w=200&auto=format&fit=crop&ixlib=rb-4.0.3`} 
                                                                    alt={`Habitación ${hab.tipo} número ${hab.numero}`} 
                                                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200"
                                                                />
                                                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                                                                <span className="absolute bottom-1.5 left-2 text-[9px] font-black uppercase tracking-widest text-foreground">
                                                                    {hab.tipo}
                                                                </span>
                                                            </div>
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <strong className="text-foreground text-lg sm:text-xl font-black">Hab. {hab.numero}</strong>
                                                                </div>
                                                                <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-xs">
                                                                    {hab.descripcion || 'Confortable habitación totalmente equipada para su descanso ideal.'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    <div className="flex sm:flex-col items-end justify-between w-full sm:w-auto gap-4 pt-3 sm:pt-0 border-t sm:border-0 border-border/50">
                                                        <div className="text-left sm:text-right">
                                                            <span className="text-xs text-muted-foreground block">Promedio por noche</span>
                                                            <strong className="text-xl font-black text-primary italic">S/ {calcularPrecioDinamico(hab).promedioNoche.toFixed(2)}</strong>
                                                        </div>
                                                        <Button 
                                                            onClick={() => {
                                                                setSelectedHab(hab);
                                                                setStep(1.5);
                                                            }}
                                                            size="sm" 
                                                            className="rounded-xl px-4 font-bold uppercase tracking-wider text-xs"
                                                        >
                                                            Reservar
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {step === 1.5 && (
                        <motion.div
                            key="upsell"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="bg-card/40 backdrop-blur-xl border border-border/50 rounded-3xl p-6 space-y-6"
                        >
                            <div>
                                <h3 className="text-sm font-black text-primary uppercase tracking-widest flex items-center gap-2">
                                    <ShoppingBag className="w-4 h-4" /> Mejora tu estadía
                                </h3>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Añade servicios extra a tu reserva. Puedes pagarlos al llegar al hotel.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {extras.map(extra => {
                                    const isSelected = selectedExtras.find(e => e.id === extra.id);
                                    return (
                                        <div 
                                            key={extra.id}
                                            className={`p-4 rounded-2xl border transition-all cursor-pointer flex justify-between items-center ${isSelected ? 'bg-primary/10 border-primary text-primary' : 'bg-muted/30 border-border/50 hover:border-primary/50'}`}
                                            onClick={() => {
                                                if (isSelected) {
                                                    setSelectedExtras(prev => prev.filter(e => e.id !== extra.id));
                                                } else {
                                                    setSelectedExtras(prev => [...prev, extra]);
                                                }
                                            }}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="text-2xl">{extra.emoji || '✨'}</div>
                                                <div>
                                                    <h4 className="font-bold text-sm text-foreground">{extra.nombre}</h4>
                                                    <p className="text-xs text-muted-foreground">{extra.categoria}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <strong className="text-sm font-black italic">S/ {extra.precio}</strong>
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center border ${isSelected ? 'bg-primary border-primary text-white' : 'border-border'}`}>
                                                    {isSelected ? <Check className="w-3 h-3" /> : <PlusCircle className="w-3 h-3 text-muted-foreground" />}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {extras.length === 0 && (
                                    <div className="col-span-1 sm:col-span-2 text-center text-sm text-muted-foreground py-8">
                                        No hay servicios extra configurados por el momento.
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3 pt-4">
                                <Button 
                                    variant="outline" 
                                    className="h-12 rounded-xl text-xs font-bold border-border/50 hover:bg-muted" 
                                    onClick={() => setStep(1)}
                                >
                                    Atrás
                                </Button>
                                <Button 
                                    onClick={() => setStep(2)} 
                                    className="flex-1 h-12 rounded-xl font-black text-xs uppercase tracking-[0.2em] bg-primary"
                                >
                                    Continuar ({selectedExtras.length} extras)
                                </Button>
                            </div>
                        </motion.div>
                    )}

                    {step === 2 && (
                        <motion.div
                            key="guest"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="bg-card/40 backdrop-blur-xl border border-border/50 rounded-3xl p-6 space-y-6"
                        >
                            <div>
                                <h3 className="text-sm font-black text-primary uppercase tracking-widest flex items-center gap-2">
                                    <User className="w-4 h-4" /> 2. Ficha de Registro del Huésped
                                </h3>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Completa tus datos personales para asegurar la reserva de la **Hab. {selectedHab.numero}** ({selectedHab.tipo}).
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="sm:col-span-2 space-y-2">
                                    <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Nombre Completo *</Label>
                                    <Input 
                                        value={guestForm.huesped_nombre} 
                                        onChange={e => setGuestForm({ ...guestForm, huesped_nombre: e.target.value })} 
                                        placeholder="Ej: Juan Pérez" 
                                        className="bg-background border-border/50 h-11 rounded-xl text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Tipo de Documento</Label>
                                    <Select 
                                        value={guestForm.tipo_documento} 
                                        onValueChange={v => setGuestForm({ ...guestForm, tipo_documento: v })}
                                    >
                                        <SelectTrigger className="h-11 bg-background border-border/50 rounded-xl text-base sm:text-sm"><SelectValue /></SelectTrigger>
                                        <SelectContent className="rounded-xl">
                                            <SelectItem value="DNI">DNI</SelectItem>
                                            <SelectItem value="pasaporte">Pasaporte</SelectItem>
                                            <SelectItem value="otro">Otro</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">N° de Documento *</Label>
                                    <Input 
                                        value={guestForm.huesped_dni} 
                                        onChange={e => setGuestForm({ ...guestForm, huesped_dni: e.target.value })} 
                                        placeholder="Número" 
                                        className="bg-background border-border/50 h-11 rounded-xl text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Teléfono / Celular *</Label>
                                    <Input 
                                        value={guestForm.huesped_telefono} 
                                        onChange={e => setGuestForm({ ...guestForm, huesped_telefono: e.target.value })} 
                                        placeholder="Ej: 999888777" 
                                        className="bg-background border-border/50 h-11 rounded-xl text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Email (opcional)</Label>
                                    <Input 
                                        type="email" 
                                        value={guestForm.huesped_email} 
                                        onChange={e => setGuestForm({ ...guestForm, huesped_email: e.target.value })} 
                                        placeholder="ejemplo@email.com" 
                                        className="bg-background border-border/50 h-11 rounded-xl text-sm"
                                    />
                                </div>
                                <div className="sm:col-span-2 space-y-2">
                                    <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Notas / Petición especial</Label>
                                    <textarea 
                                        value={guestForm.observaciones} 
                                        onChange={e => setGuestForm({ ...guestForm, observaciones: e.target.value })} 
                                        placeholder="Ej: Habitación en piso alto, almohadas extra..." 
                                        className="w-full bg-background border border-border/50 rounded-2xl min-h-[80px] p-4 text-sm focus:outline-none focus:border-primary"
                                    />
                                </div>
                            </div>

                            <div className="bg-muted/20 border border-border/50 rounded-2xl p-4 text-xs space-y-2 text-muted-foreground">
                                <div className="flex justify-between font-bold text-foreground text-sm">
                                    <span>Estancia ({differenceInDays(new Date(searchForm.fecha_salida), new Date(searchForm.fecha_entrada))} noches)</span>
                                    <span className="italic text-primary">S/ {calcularPrecioDinamico(selectedHab).total.toFixed(2)}</span>
                                </div>
                                <div className="w-full h-px bg-border/50 my-1" />
                                <div className="flex justify-between">
                                    <span>Entrada</span>
                                    <span>{searchForm.fecha_entrada} (a partir de las {hotelInfo?.hora_checkin || '14:00'})</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Salida</span>
                                    <span>{searchForm.fecha_salida} (hasta las {hotelInfo?.hora_checkout || '12:00'})</span>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <Button 
                                    variant="outline" 
                                    className="h-12 rounded-xl text-xs font-bold border-border/50 hover:bg-muted" 
                                    onClick={() => setStep(1)}
                                >
                                    Volver
                                </Button>
                                <Button 
                                    onClick={handleConfirmBooking} 
                                    disabled={crearReservaPublica.isPending}
                                    className="flex-1 h-14 rounded-full font-black text-xs uppercase tracking-[0.2em] gap-0 bg-primary shadow-lg shadow-primary/20 flex justify-between p-1.5 pl-6"
                                >
                                    <span>{crearReservaPublica.isPending ? 'Confirmando...' : 'Confirmar Pre-Reserva'}</span>
                                    <div className="w-11 h-11 rounded-full bg-white text-primary flex items-center justify-center shadow-sm">
                                        <CheckCircle className="w-4 h-4" />
                                    </div>
                                </Button>
                            </div>
                        </motion.div>
                    )}

                    {step === 3 && (
                        <motion.div
                            key="success"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-card/40 backdrop-blur-xl border border-border/50 rounded-3xl p-8 text-center space-y-6"
                        >
                            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10 animate-bounce">
                                <CheckCircle className="w-8 h-8 text-emerald-500" />
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-xl font-black text-foreground">¡Pre-Reserva Registrada!</h3>
                                <p className="text-xs text-muted-foreground leading-relaxed max-w-sm mx-auto">
                                    Hemos guardado sus datos. Para hacer efectiva su reserva, debe realizar el pago.
                                </p>
                                <div className="inline-flex mt-4 items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 text-green-400 rounded-xl text-xs font-bold animate-pulse">
                                    Redirigiendo a WhatsApp del Hotel...
                                </div>
                            </div>

                            <div className="bg-muted/20 border border-border/50 rounded-2xl p-5 max-w-xs mx-auto text-xs space-y-2 text-left">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Habitación</span>
                                    <strong className="text-foreground">Hab. {selectedHab.numero} ({selectedHab.tipo})</strong>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Huésped</span>
                                    <strong className="text-foreground">{guestForm.huesped_nombre}</strong>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Fecha Entrada</span>
                                    <strong className="text-foreground">{searchForm.fecha_entrada}</strong>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Fecha Salida</span>
                                    <strong className="text-foreground">{searchForm.fecha_salida}</strong>
                                </div>
                                <div className="w-full h-px bg-border/50 my-1" />
                                <div className="flex justify-between text-sm font-black">
                                    <span className="text-muted-foreground">Total Estimado (incl. Extras)</span>
                                    <span className="text-primary italic">S/ {(calcularPrecioDinamico(selectedHab).total + selectedExtras.reduce((sum, e) => sum + Number(e.precio), 0)).toFixed(2)}</span>
                                </div>
                            </div>

                            <Button 
                                onClick={() => {
                                    setStep(1);
                                    setBuscado(false);
                                    setSelectedHab(null);
                                    setGuestForm({
                                        huesped_nombre: '', tipo_documento: 'DNI', huesped_dni: '',
                                        huesped_telefono: '', huesped_email: '', observaciones: ''
                                    });
                                }}
                                className="w-full h-12 rounded-xl font-bold text-xs uppercase tracking-widest bg-secondary hover:bg-secondary/80 text-foreground"
                            >
                                Hacer Nueva Consulta
                            </Button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
});
BookingPublico.displayName = 'BookingPublico';
export default BookingPublico;
