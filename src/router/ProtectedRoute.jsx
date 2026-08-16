import { memo } from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ShieldAlert, LogOut, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { canAccessPath, getRoleHome } from '@/constants/permissions';

const ProtectedRoute = memo(function ProtectedRoute({ children }) {
    const { user, auth } = useAuth();
    const location = useLocation();

    if (!user) {
        return <Navigate to="/login" replace state={{ from: location }} />;
    }

    const userRole = user.role;
    const currentPath = location.pathname;

    // Redirección inteligente: si el rol es limpieza y entra a '/', redirigir a '/limpieza'
    if (userRole === 'limpieza' && currentPath === '/') {
        return <Navigate to="/limpieza" replace />;
    }
    if (userRole === 'recepcionista' && currentPath === '/') {
        return <Navigate to="/recepcion" replace />;
    }

    // Buscar si el path actual requiere roles específicos
    // Si el rol del usuario no está permitido:
    if (!canAccessPath(userRole, currentPath)) {
        return (
            <div className="min-h-[80vh] flex items-center justify-center p-6 select-none">
                <div className="max-w-md w-full bg-card/40 backdrop-blur-3xl border border-red-500/20 rounded-[2.5rem] p-8 text-center shadow-2xl relative overflow-hidden"
                >
                    {/* Background Accent */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full -mr-16 -mt-16 blur-3xl" />
                    
                    {/* Pulsing Lock Icon Container */}
                    <div className="w-20 h-20 bg-red-500/10 border border-red-500/20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-red-500/5 group relative overflow-hidden animate-pulse">
                        <ShieldAlert className="w-10 h-10 text-red-500" />
                    </div>

                    <h2 className="font-display text-2xl font-black text-foreground tracking-tight mb-2">Acceso Restringido</h2>
                    <p className="text-muted-foreground text-sm font-medium mb-6 leading-relaxed">
                        Tu rol actual (<span className="text-red-500 font-bold uppercase tracking-wider text-xs px-2 py-0.5 rounded-md bg-red-500/10 border border-red-500/20">{userRole}</span>) no cuenta con privilegios de seguridad suficientes para ingresar a <span className="text-foreground font-mono text-xs bg-secondary/50 px-1.5 py-0.5 rounded border border-border/50">{currentPath}</span>.
                    </p>

                    <div className="flex flex-col gap-3">
                        <Link to={getRoleHome(userRole)}>
                            <Button className="w-full gap-2 h-12 rounded-xl text-sm font-bold shadow-lg shadow-primary/10">
                                <ArrowLeft className="w-4 h-4" /> Volver al Inicio
                            </Button>
                        </Link>
                        
                        <Button
                            variant="ghost"
                            className="w-full gap-2 h-12 rounded-xl text-sm font-bold text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                            onClick={() => auth.logout()}
                        >
                            <LogOut className="w-4 h-4" /> Cerrar Sesión
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return children;
});
ProtectedRoute.displayName = 'ProtectedRoute';
export default ProtectedRoute;
