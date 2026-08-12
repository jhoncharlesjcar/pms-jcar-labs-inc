import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import logger from '@/lib/logger';

class ErrorBoundary extends React.Component { // Componente de clase — memo no aplica
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        logger.error("ErrorBoundary caught an error", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center bg-card border border-destructive/20 rounded-3xl shadow-sm">
                    <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-6">
                        <AlertCircle className="w-8 h-8 text-destructive" />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground mb-2">Algo salió mal</h2>
                    <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                        Se produjo un error al cargar este componente. Por favor, intenta recargar la página.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-[transform,opacity] shadow-lg shadow-primary/20"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Recargar Aplicación
                    </button>
                    {import.meta.env.DEV && (
                        <div className="mt-8 p-4 bg-secondary/50 rounded-xl text-left overflow-auto max-w-full">
                            <p className="text-xs font-mono text-destructive">{this.state.error?.toString()}</p>
                        </div>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}
ErrorBoundary.displayName = 'ErrorBoundary'; // Clase — displayName fuera del cuerpo

export default ErrorBoundary;
