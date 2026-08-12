import { useState, useRef, useEffect, memo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Hotel, Mail, Lock, Eye, EyeOff, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { gsap } from 'gsap';
import { useGsapStaggerList } from '@/hooks/useGsapStaggerList';

const Login = memo(function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState({});
    const [touched, setTouched] = useState({});

    const logoRef = useRef(null);
    const titleRef = useRef(null);
    const subtitleRef = useRef(null);
    const cardRef = useRef(null);
    const footerRef = useRef(null);
    const bgRef = useRef(null);

    const formRef = useGsapStaggerList([], {
        stagger: 0.1,
        direction: 'y',
        distance: 15,
    });

    // Validación inline
    const validateField = (name, value) => {
        if (name === 'email') {
            if (!value) return 'El email es requerido';
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Formato de email inválido';
            return '';
        }
        if (name === 'password') {
            if (!value) return 'La contraseña es requerida';
            if (value.length < 6) return 'Mínimo 6 caracteres';
            return '';
        }
        return '';
    };

    const handleBlur = (e) => {
        const { name, value } = e.target;
        setTouched(prev => ({ ...prev, [name]: true }));
        const fieldError = validateField(name, value);
        setFieldErrors(prev => ({ ...prev, [name]: fieldError }));
    };

    const handleFieldChange = (name, value, setter) => {
        setter(value);
        if (touched[name]) {
            const fieldError = validateField(name, value);
            setFieldErrors(prev => ({ ...prev, [name]: fieldError }));
        }
        if (error) setError('');
    };

    // GSAP entrance animation
    useEffect(() => {
        const tl = gsap.timeline({
            defaults: { ease: 'power3.out' },
        });

        // Background subtle zoom-out
        tl.fromTo(
            bgRef.current,
            { scale: 1.15 },
            { scale: 1.1, duration: 1.5, ease: 'power2.out' }
        );

        // Logo with bounce
        tl.fromTo(
            logoRef.current,
            { opacity: 0, scale: 0.6, rotate: -15 },
            { opacity: 1, scale: 1, rotate: 0, duration: 0.8, ease: 'elastic.out(1, 0.4)' },
            '-=0.8'
        );

        // Title & subtitle
        tl.fromTo(
            titleRef.current,
            { opacity: 0, y: 25 },
            { opacity: 1, y: 0, duration: 0.6 },
            '-=0.3'
        );
        tl.fromTo(
            subtitleRef.current,
            { opacity: 0, y: 15 },
            { opacity: 1, y: 0, duration: 0.5 },
            '-=0.3'
        );

        // Card entrance
        tl.fromTo(
            cardRef.current,
            { opacity: 0, y: 30, scale: 0.97 },
            { opacity: 1, y: 0, scale: 1, duration: 0.7 },
            '-=0.2'
        );

        // Footer
        tl.fromTo(
            footerRef.current,
            { opacity: 0, y: 10 },
            { opacity: 1, y: 0, duration: 0.5 },
            '-=0.2'
        );

        return () => {
            tl.kill();
        };
    }, []);

    const handleEmailLogin = async (e) => {
        e.preventDefault();
        if (!email || !password) return;
        setLoading(true);
        setError('');

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            if (error) throw error;
        } catch (err) {
            const msg = err.message || 'Error de autenticación';
            if (msg.includes('Invalid login credentials')) {
                setError('Email o contraseña incorrectos');
            } else {
                setError(msg);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden bg-black">
            {/* Background Layer (Cinematic) */}
            <div
                ref={bgRef}
                className="absolute inset-0 z-0 bg-cover bg-center"
                style={{ backgroundImage: "url('/login-bg.jpg')" }}
            >
                {/* Dark OLED Overlay */}
                <div className="absolute inset-0 bg-black/70 backdrop-blur-[6px]" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/80" />
                
                {/* Animated gradient orbs */}
                <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/5 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
                <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-secondary/5 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '10s', animationDelay: '2s' }} />
            </div>

            <div className="relative z-10 w-full max-w-md">
                {/* Logo Section */}
                <div className="text-center mb-10">
                    <div
                        ref={logoRef}
                        className="inline-flex items-center justify-center w-20 h-20 bg-primary/20 backdrop-blur-md rounded-[2rem] border border-primary/30 shadow-[0_0_30px_rgba(var(--primary),0.2)] mb-6 group"
                    >
                        <Hotel className="w-10 h-10 text-primary group-hover:scale-110 transition-transform duration-300" />
                    </div>
                    <h1
                        ref={titleRef}
                        className="text-3xl font-bold text-white uppercase tracking-wider"
                    >
                        PMS JCAR LABS
                    </h1>
                    <p
                        ref={subtitleRef}
                        className="text-slate-400 mt-1 uppercase text-xs tracking-widest font-bold"
                    >
                        <Sparkles className="w-3 h-3 inline-block mr-1 -mt-0.5" />
                        SISTEMA DE GESTION HOTELERA BY JCAR LABS
                    </p>
                </div>

                {/* Login Card */}
                <div
                    ref={cardRef}
                    className="bg-white/[0.03] backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
                >
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-2 h-8 bg-primary rounded-full" />
                        <h2 className="text-2xl font-bold text-white">Iniciar Sesión</h2>
                    </div>

                    <form onSubmit={handleEmailLogin} className="space-y-6" ref={formRef} noValidate>
                        <div className="space-y-2">
                            <label htmlFor="login_email" className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">
                                Email de Acceso
                            </label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors duration-300" />
                                <input
                                    id="login_email"
                                    name="email"
                                    type="email"
                                    value={email}
                                    onChange={e => handleFieldChange('email', e.target.value, setEmail)}
                                    onBlur={handleBlur}
                                    placeholder="ejemplo@hotel.com"
                                    required
                                    aria-invalid={touched.email && fieldErrors.email ? 'true' : 'false'}
                                    aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                                    className={`w-full pl-12 pr-4 py-4 bg-white/[0.05] border rounded-2xl text-white placeholder-muted-foreground/50 focus:outline-none focus:ring-4 transition-all duration-300 font-medium ${
                                        touched.email && fieldErrors.email
                                            ? 'border-red-500/50 focus:border-red-500/70 focus:ring-red-500/10'
                                            : 'border-white/10 focus:border-primary/50 focus:ring-primary/10'
                                    }`}
                                />
                            </div>
                            {touched.email && fieldErrors.email && (
                                <p id="email-error" role="alert" className="text-[11px] font-semibold text-red-400 ml-3 mt-1.5">
                                    {fieldErrors.email}
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="login_password" className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">
                                Contraseña
                            </label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors duration-300" />
                                <input
                                    id="login_password"
                                    name="password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => handleFieldChange('password', e.target.value, setPassword)}
                                    onBlur={handleBlur}
                                    placeholder="••••••••"
                                    required
                                    minLength={6}
                                    aria-invalid={touched.password && fieldErrors.password ? 'true' : 'false'}
                                    aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                                    className={`w-full pl-12 pr-14 py-4 bg-white/[0.05] border rounded-2xl text-white placeholder-muted-foreground/50 focus:outline-none focus:ring-4 transition-all duration-300 font-medium ${
                                        touched.password && fieldErrors.password
                                            ? 'border-red-500/50 focus:border-red-500/70 focus:ring-red-500/10'
                                            : 'border-white/10 focus:border-primary/50 focus:ring-primary/10'
                                    }`}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors duration-200"
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                            {touched.password && fieldErrors.password && (
                                <p id="password-error" role="alert" className="text-[11px] font-semibold text-red-400 ml-3 mt-1.5">
                                    {fieldErrors.password}
                                </p>
                            )}
                        </div>

                        {error && (
                            <div role="alert" className="bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-3 text-xs font-bold text-red-400 flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse flex-shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        <Button
                            type="submit"
                            disabled={loading || !email || !password || Object.values(fieldErrors).some(e => e)}
                            className="w-full h-14 bg-primary hover:bg-primary/90 text-white font-bold rounded-2xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-primary/20 text-base relative overflow-hidden group"
                        >
                            {loading ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                    <span>Autenticando...</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <ShieldCheck className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
                                    <span>Entrar al Sistema</span>
                                </div>
                            )}
                        </Button>
                    </form>
                </div>

                {/* Footer Section */}
                <div ref={footerRef} className="mt-12 text-center space-y-4">
                    <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.4em]">
                        Propiedad de Hospedaje Angelica Frey
                    </p>
                    <div className="flex items-center justify-center gap-6">
                        <span className="text-[9px] font-black text-primary/40 uppercase tracking-widest">v4.0 Premium</span>
                        <div className="w-1 h-1 bg-white/10 rounded-full" />
                        <span className="text-[9px] font-black text-primary/40 uppercase tracking-widest">OLED Optimized</span>
                    </div>
                </div>
            </div>
        </div>
    );
});
Login.displayName = 'Login';
export default Login;
