import { useState, useRef, useEffect, memo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Mail, Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { gsap } from 'gsap';
import { useGsapStaggerList } from '@/hooks/useGsapStaggerList';

const Login = memo(function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState({ email: '', password: '' });
    const [touched, setTouched] = useState({ email: false, password: false });

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
        <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-black px-4 py-6 sm:py-10">
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
                <div className="text-center mb-6">
                    <div
                        ref={logoRef}
                        className="group relative mx-auto mb-4 flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-white p-2 shadow-[0_15px_40px_rgba(0,0,0,0.5)] sm:h-28 sm:w-28"
                    >
                        <img
                            src="/logo.jpg"
                            alt="PMS JCAR LABS Logo"
                            className="w-full h-full object-contain rounded-2xl group-hover:scale-105 transition-transform duration-300 origin-center"
                        />
                    </div>
                    <h1
                        ref={titleRef}
                        className="text-2xl font-black text-white uppercase tracking-wider"
                    >
                        PMS JCAR LABS
                    </h1>
                    <p
                        ref={subtitleRef}
                        className="text-slate-400 mt-1 text-xs tracking-wide font-medium"
                    >
                        Sistema de Gestión Hotelera
                    </p>
                </div>

                {/* Login Card */}
                <div
                    ref={cardRef}
                    className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-3xl sm:p-8"
                >
                    <h2 className="text-xl font-bold text-white mb-6 text-center">Iniciar Sesión</h2>

                    <form onSubmit={handleEmailLogin} className="space-y-5" ref={formRef} noValidate>
                        <div className="space-y-1.5">
                            <label htmlFor="login_email" className="text-xs font-semibold text-slate-300 ml-1">
                                Email
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
                                    className={`h-12 w-full rounded-xl border bg-white/[0.05] pl-12 pr-4 text-white placeholder-muted-foreground/50 focus:outline-none focus:ring-4 transition-all duration-300 font-medium ${touched.email && fieldErrors.email
                                        ? 'border-red-500/50 focus:border-red-500/70 focus:ring-red-500/10'
                                        : 'border-white/10 focus:border-primary/50 focus:ring-primary/10'
                                        }`}
                                />
                            </div>
                            {touched.email && fieldErrors.email && (
                                <p id="email-error" role="alert" className="text-[11px] font-semibold text-red-400 ml-3 mt-1">
                                    {fieldErrors.email}
                                </p>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <label htmlFor="login_password" className="text-xs font-semibold text-slate-300 ml-1">
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
                                    className={`h-12 w-full rounded-xl border bg-white/[0.05] pl-12 pr-14 text-white placeholder-muted-foreground/50 focus:outline-none focus:ring-4 transition-all duration-300 font-medium ${touched.password && fieldErrors.password
                                        ? 'border-red-500/50 focus:border-red-500/70 focus:ring-red-500/10'
                                        : 'border-white/10 focus:border-primary/50 focus:ring-primary/10'
                                        }`}
                                />
                                <button
                                    type="button"
                                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-200 hover:bg-white/5 hover:text-white"
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                            {touched.password && fieldErrors.password && (
                                <p id="password-error" role="alert" className="text-[11px] font-semibold text-red-400 ml-3 mt-1">
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
                            size="lg"
                            disabled={loading || !email || !password || Object.values(fieldErrors).some(e => e)}
                            className="group relative w-full overflow-hidden rounded-xl bg-primary text-base text-white shadow-xl shadow-primary/20 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {loading ? (
                                <div className="flex items-center justify-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                    <span>Autenticando...</span>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center gap-2">
                                    <ShieldCheck className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
                                    <span>Ingresar</span>
                                </div>
                            )}
                        </Button>
                    </form>
                </div>

                {/* Footer Section */}
                <div ref={footerRef} className="mt-8 text-center">
                    <p className="text-xs text-slate-500 font-medium">
                        © PMS JCAR LABS. Todos los derechos reservados.
                    </p>
                </div>
            </div>
        </div>
    );
});
Login.displayName = 'Login';
export default Login;
