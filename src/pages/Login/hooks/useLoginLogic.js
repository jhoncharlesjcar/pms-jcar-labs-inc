import { useState } from 'react';
import { supabase } from '@/config/supabase';

export function useLoginLogic() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState({ email: '', password: '' });
    const [touched, setTouched] = useState({ email: false, password: false });

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

    return {
        email, setEmail,
        password, setPassword,
        showPassword, setShowPassword,
        loading, error,
        fieldErrors,
        handleBlur, handleFieldChange,
        handleEmailLogin
    };
}
