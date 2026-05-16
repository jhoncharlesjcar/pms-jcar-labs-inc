import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Hotel, Mail, Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

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
                className="absolute inset-0 z-0 bg-cover bg-center scale-110"
                style={{ backgroundImage: "url('https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=2070&auto=format&fit=crop')" }}
            >
                {/* Dark OLED Overlay */}
                <div className="absolute inset-0 bg-black/70 backdrop-blur-[6px]" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/80" />
            </div>

            <motion.div 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="relative z-10 w-full max-w-md"
            >
                {/* Logo Section */}
                <div className="text-center mb-10">
                    <motion.div 
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.2, duration: 0.5 }}
                        className="inline-flex items-center justify-center w-20 h-20 bg-primary/20 backdrop-blur-md rounded-[2rem] border border-primary/30 shadow-[0_0_30px_rgba(var(--primary),0.2)] mb-6 group"
                    >
                        <Hotel className="w-10 h-10 text-primary group-hover:scale-110 transition-transform" />
                    </motion.div>
                    <h1 className="text-3xl font-bold text-white uppercase tracking-wider">HOSPEDAJE ANGELICA FREY</h1>
                    <p className="text-slate-400 mt-1">Sistema de Gestión de Hospedaje by Jcar Labs</p>
                </div>

                {/* Login Card */}
                <div className="bg-white/[0.03] backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-2 h-8 bg-primary rounded-full" />
                        <h2 className="text-2xl font-bold text-white">Iniciar Sesión</h2>
                    </div>

                    <form onSubmit={handleEmailLogin} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">
                                Email de Acceso
                            </label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="ejemplo@hotel.com"
                                    required
                                    className="w-full pl-12 pr-4 py-4 bg-white/[0.05] border border-white/10 rounded-2xl text-white placeholder-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-medium"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">
                                Contraseña
                            </label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    minLength={6}
                                    className="w-full pl-12 pr-14 py-4 bg-white/[0.05] border border-white/10 rounded-2xl text-white placeholder-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-medium"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        <AnimatePresence>
                            {error && (
                                <motion.div 
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0 }}
                                    className="bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-3 text-xs font-bold text-red-400 flex items-center gap-2"
                                >
                                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                                    {error}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <Button
                            type="submit"
                            disabled={loading || !email || !password}
                            className="w-full h-14 bg-primary hover:bg-primary/90 text-white font-bold rounded-2xl transition-all disabled:opacity-50 shadow-xl shadow-primary/20 text-base"
                        >
                            {loading ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                    Autenticando...
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <ShieldCheck className="w-5 h-5" />
                                    Entrar al Sistema
                                </div>
                            )}
                        </Button>
                    </form>
                </div>

                {/* Footer Section */}
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1 }}
                    className="mt-12 text-center space-y-4"
                >
                    <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.4em]">
                        Propiedad de Hospedaje Angelica Frey
                    </p>
                    <div className="flex items-center justify-center gap-6">
                        <span className="text-[9px] font-black text-primary/40 uppercase tracking-widest">v4.0 Premium</span>
                        <div className="w-1 h-1 bg-white/10 rounded-full" />
                        <span className="text-[9px] font-black text-primary/40 uppercase tracking-widest">OLED Optimized</span>
                    </div>
                </motion.div>
            </motion.div>
        </div>
    );
}
