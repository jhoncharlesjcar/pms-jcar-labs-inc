import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Hotel, Mail, Lock, Eye, EyeOff, Chrome } from 'lucide-react';

export default function Login() {
    const [modo, setModo] = useState('login'); // 'login' | 'registro'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [mensaje, setMensaje] = useState('');

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError('');
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin,
                },
            });
            if (error) throw error;
        } catch (err) {
            setError(err.message || 'Error al iniciar con Google');
            setLoading(false);
        }
    };

    const handleEmailLogin = async (e) => {
        e.preventDefault();
        if (!email || !password) return;
        setLoading(true);
        setError('');
        setMensaje('');

        try {
            if (modo === 'registro') {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: { full_name: fullName },
                        emailRedirectTo: window.location.origin,
                    },
                });
                if (error) throw error;
                setMensaje('¡Cuenta creada! Revisa tu email para confirmar.');
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
                // El AuthContext detectará el cambio de sesión automáticamente
            }
        } catch (err) {
            const msg = err.message || 'Error de autenticación';
            if (msg.includes('Invalid login credentials')) {
                setError('Email o contraseña incorrectos');
            } else if (msg.includes('already registered')) {
                setError('Este email ya está registrado. Inicia sesión.');
            } else {
                setError(msg);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4">
            {/* Fondo decorativo */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl" />
            </div>

            <div className="relative w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-2xl shadow-lg shadow-primary/30 mb-4">
                        <Hotel className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-white">ANGELICA FREY</h1>
                    <p className="text-slate-400 mt-1">Sistema de Gestión de Hospedajes</p>
                </div>

                {/* Card */}
                <div className="bg-white/[0.06] backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
                    <h2 className="text-xl font-semibold text-white mb-6 text-center">
                        {modo === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}
                    </h2>

                    {/* Google OAuth */}
                    <button
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-3 px-4 py-3.5 bg-white hover:bg-slate-100 text-slate-800 font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    >
                        <Chrome className="w-5 h-5" />
                        <span>Continuar con Google</span>
                    </button>

                    {/* Separador */}
                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-white/10" />
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-4 bg-transparent text-slate-500">o con email</span>
                        </div>
                    </div>

                    {/* Formulario Email */}
                    <form onSubmit={handleEmailLogin} className="space-y-4">
                        {modo === 'registro' && (
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                                    Nombre completo
                                </label>
                                <input
                                    type="text"
                                    value={fullName}
                                    onChange={e => setFullName(e.target.value)}
                                    placeholder="Juan Pérez"
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all"
                                />
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">
                                Email
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="tu@email.com"
                                    required
                                    className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">
                                Contraseña
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    minLength={6}
                                    className="w-full pl-11 pr-12 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
                                {error}
                            </div>
                        )}

                        {/* Mensaje de éxito */}
                        {mensaje && (
                            <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 text-sm text-green-400">
                                {mensaje}
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={loading || !email || !password}
                            className="w-full py-3.5 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
                        >
                            {loading
                                ? 'Procesando...'
                                : modo === 'login'
                                    ? 'Iniciar Sesión'
                                    : 'Crear Cuenta'
                            }
                        </button>
                    </form>

                    {/* Toggle login/registro */}
                    <div className="mt-6 text-center">
                        <button
                            onClick={() => { setModo(modo === 'login' ? 'registro' : 'login'); setError(''); setMensaje(''); }}
                            className="text-sm text-slate-400 hover:text-primary transition-colors"
                        >
                            {modo === 'login'
                                ? '¿No tienes cuenta? Crear una cuenta'
                                : '¿Ya tienes cuenta? Iniciar sesión'
                            }
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <p className="text-center text-xs text-slate-600 mt-6">
                    Sistema de gestión de hospedajes · Perú
                </p>
            </div>
        </div>
    );
}
