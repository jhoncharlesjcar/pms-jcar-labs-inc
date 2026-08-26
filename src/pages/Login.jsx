import { useRef, useEffect, memo } from 'react';
import { Mail, Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { gsap } from 'gsap';
import { useGsapStaggerList } from '@/hooks/useGsapStaggerList';
import { useLoginLogic } from './Login/hooks/useLoginLogic';

const Login = memo(function Login() {
    const {
        email, setEmail,
        password, setPassword,
        showPassword, setShowPassword,
        loading, error,
        fieldErrors,
        handleBlur, handleFieldChange,
        handleEmailLogin
    } = useLoginLogic();

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
                
                {/* Accent Glows */}
                <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-primary/20 blur-[120px] rounded-full mix-blend-screen opacity-50" />
                <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-blue-600/20 blur-[120px] rounded-full mix-blend-screen opacity-50" />
            </div>

            {/* Content Layer */}
            <div className="relative z-10 w-full max-w-[420px] flex flex-col items-center">
                
                {/* Header */}
                <div className="flex flex-col items-center mb-8 sm:mb-10 text-center">
                    <div 
                        ref={logoRef}
                        className="relative mb-5"
                    >
                        {/* Logo Glow */}
                        <div className="absolute inset-0 bg-primary/30 blur-2xl rounded-full scale-150" />
                        
                        <div className="relative flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-[1.5rem] bg-gradient-to-b from-white/10 to-white/5 shadow-2xl border border-white/10 backdrop-blur-xl">
                            <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent rounded-[1.5rem]" />
                            <ShieldCheck className="h-8 w-8 sm:h-10 sm:w-10 text-primary drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]" />
                        </div>
                    </div>
                    <h1 
                        ref={titleRef}
                        className="text-3xl sm:text-4xl font-black tracking-tighter text-white drop-shadow-lg"
                    >
                        PMS JCAR LABS
                    </h1>
                    <p 
                        ref={subtitleRef}
                        className="mt-2 text-xs sm:text-sm font-bold uppercase tracking-[0.2em] text-white/50"
                    >
                        Property Management System
                    </p>
                </div>

                {/* Card */}
                <div 
                    ref={cardRef}
                    className="w-full rounded-[2rem] bg-white/5 p-6 sm:p-8 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl border border-white/10 relative overflow-hidden"
                >
                    {/* Inner subtle glow */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
                    
                    <div className="mb-6 sm:mb-8 text-center">
                        <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">Acceso Seguro</h2>
                        <p className="text-xs sm:text-sm text-white/50 mt-1.5 font-medium">Ingresa tus credenciales para continuar</p>
                    </div>

                    <form ref={formRef} onSubmit={handleEmailLogin} className="space-y-4 sm:space-y-5" noValidate>
                        <div className="space-y-1.5 sm:space-y-2">
                            <label className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-white/70 ml-1">
                                Correo Electrónico
                            </label>
                            <div className="relative group">
                                <Mail className={`absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors ${fieldErrors.email ? 'text-red-400' : 'text-white/40 group-focus-within:text-primary'}`} />
                                <input
                                    name="email"
                                    type="email"
                                    placeholder="admin@hotel.com"
                                    value={email}
                                    onChange={(e) => handleFieldChange('email', e.target.value, setEmail)}
                                    onBlur={handleBlur}
                                    disabled={loading}
                                    className={`w-full h-11 sm:h-12 rounded-xl bg-black/40 pl-10 pr-4 text-sm sm:text-base text-white placeholder:text-white/20 border transition-all focus:outline-none focus:ring-2 ${
                                        fieldErrors.email 
                                            ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20' 
                                            : 'border-white/10 focus:border-primary/50 focus:ring-primary/20 hover:border-white/20'
                                    }`}
                                    required
                                />
                            </div>
                            {fieldErrors.email && (
                                <p className="text-[10px] sm:text-xs font-bold text-red-400 ml-1 mt-1 animate-in slide-in-from-top-1">
                                    {fieldErrors.email}
                                </p>
                            )}
                        </div>

                        <div className="space-y-1.5 sm:space-y-2">
                            <div className="flex items-center justify-between ml-1">
                                <label className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-white/70">
                                    Contraseña
                                </label>
                            </div>
                            <div className="relative group">
                                <Lock className={`absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors ${fieldErrors.password ? 'text-red-400' : 'text-white/40 group-focus-within:text-primary'}`} />
                                <input
                                    name="password"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => handleFieldChange('password', e.target.value, setPassword)}
                                    onBlur={handleBlur}
                                    disabled={loading}
                                    className={`w-full h-11 sm:h-12 rounded-xl bg-black/40 pl-10 pr-12 text-sm sm:text-base text-white placeholder:text-white/20 border transition-all focus:outline-none focus:ring-2 ${
                                        fieldErrors.password 
                                            ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20' 
                                            : 'border-white/10 focus:border-primary/50 focus:ring-primary/20 hover:border-white/20'
                                    }`}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    disabled={loading}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-white/40 hover:text-white/80 transition-colors focus:outline-none rounded-md focus-visible:ring-2 focus-visible:ring-primary/50"
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                            {fieldErrors.password && (
                                <p className="text-[10px] sm:text-xs font-bold text-red-400 ml-1 mt-1 animate-in slide-in-from-top-1">
                                    {fieldErrors.password}
                                </p>
                            )}
                        </div>

                        {error && (
                            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 sm:p-4 text-center animate-in shake">
                                <p className="text-[11px] sm:text-xs font-bold text-red-400">{error}</p>
                            </div>
                        )}

                        <Button
                            type="submit"
                            disabled={loading || !!fieldErrors.email || !!fieldErrors.password || !email || !password}
                            className="relative w-full h-11 sm:h-12 rounded-xl bg-primary text-primary-foreground font-extrabold text-sm sm:text-base tracking-wide shadow-lg hover:shadow-primary/25 hover:-translate-y-0.5 transition-all active:scale-[0.98] active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0 overflow-hidden group"
                        >
                            {/* Shine effect */}
                            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:animate-[shimmer_1.5s_infinite]" />
                            
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Autenticando...
                                </span>
                            ) : (
                                'Ingresar al Sistema'
                            )}
                        </Button>
                    </form>
                </div>

                {/* Footer */}
                <div 
                    ref={footerRef}
                    className="mt-8 sm:mt-12 text-center"
                >
                    <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-white/30">
                        Solo personal autorizado
                    </p>
                    <p className="text-[9px] sm:text-[10px] text-white/20 mt-1">
                        &copy; {new Date().getFullYear()} PMS JCAR LABS. Todos los derechos reservados.
                    </p>
                </div>
            </div>
        </div>
    );
});
Login.displayName = 'Login';
export default Login;
