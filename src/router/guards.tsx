/**
 * Guards de Ruta — AuthGuard y RoleGuard
 *
 * Capa de compatibilidad que expone AuthGuard y RoleGuard como componentes
 * independientes, usados por los tests de contrato (AUTH-011 a AUTH-017).
 *
 * Funcionalmente equivalen a src/router/ProtectedRoute.jsx pero separados
 * en dos responsabilidades: autenticación y autorización por rol.
 *
 * @see specs/domain-auth.md (RN-AUTH-006)
 * @see tests/auth/auth-001.test.tsx
 */

import { memo } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';

// Mapeo de rutas a roles permitidos (mismo que ProtectedRoute)
const ROUTE_ROLE_MAP: Record<string, string[]> = {
    '/': ['admin', 'developer'],
    '/dev': ['developer'],
    '/configuracion': ['admin', 'developer'],
    '/caja': ['admin', 'developer', 'recepcionista'],
    '/reportes': ['admin', 'developer', 'recepcionista'],
    '/ventas': ['admin', 'developer', 'recepcionista'],
    '/recepcion': ['admin', 'developer', 'recepcionista'],
    '/huespedes': ['admin', 'developer', 'recepcionista'],
    '/pos': ['admin', 'developer', 'recepcionista'],
    '/habitaciones': ['admin', 'developer', 'recepcionista', 'limpieza'],
    '/limpieza': ['admin', 'developer', 'recepcionista', 'limpieza'],
};

/**
 * AuthGuard — Verifica que el usuario tenga sesión activa.
 * Si no está autenticado, redirige a /login.
 */
export const AuthGuard = memo(function AuthGuard({ children }: { children: React.ReactNode }) {
    const { isAuthenticated } = useAuthStore();
    const location = useLocation();

    if (!isAuthenticated) {
        return <Navigate to="/login" replace state={{ from: location }} />;
    }

    return <>{children}</>;
});

/**
 * RoleGuard — Verifica que el rol del usuario tenga acceso a la ruta actual.
 * Si no tiene permiso, redirige a la página por defecto de su rol.
 */
export const RoleGuard = memo(function RoleGuard({ children }: { children: React.ReactNode }) {
    const { user, isAuthenticated } = useAuthStore();
    const location = useLocation();

    if (!isAuthenticated || !user) {
        return <Navigate to="/login" replace state={{ from: location }} />;
    }

    const userRole = user.role || 'recepcionista';
    const currentPath = location.pathname;

    // Redirección inteligente según rol al visitar '/'
    if (currentPath === '/') {
        if (userRole === 'limpieza') return <Navigate to="/limpieza" replace />;
        if (userRole === 'recepcionista') return <Navigate to="/recepcion" replace />;
        // admin y developer pasan al dashboard
        return <>{children}</>;
    }

    const allowedRoles = ROUTE_ROLE_MAP[currentPath];

    if (allowedRoles && !allowedRoles.includes(userRole)) {
        const redirectPath = userRole === 'limpieza' ? '/limpieza' : '/recepcion';
        return <Navigate to={redirectPath} replace />;
    }

    // Ruta sin restricción o rol permitido
    return <>{children}</>;
});
