import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

const PageNotFound = memo(function PageNotFound() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background px-4">
            <div className="text-center space-y-4 max-w-md">
                <p className="text-6xl font-bold text-primary">404</p>
                <h1 className="text-2xl font-bold text-foreground">Página no encontrada</h1>
                <p className="text-muted-foreground">
                    La página que buscas no existe o ha sido movida.
                </p>
                <Link
                    to="/"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-[transform,opacity]"
                >
                    <Home className="w-4 h-4" />
                    Volver al inicio
                </Link>
            </div>
        </div>
    );
});
PageNotFound.displayName = 'PageNotFound';
export default PageNotFound;
