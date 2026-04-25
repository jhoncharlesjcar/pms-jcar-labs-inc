import { BookOpen, ExternalLink } from 'lucide-react';

export default function Documentacion() {
    return (
        <div className="space-y-6 max-w-3xl">
            <div>
                <h1 className="font-display text-3xl font-bold text-foreground">Documentación</h1>
                <p className="text-muted-foreground mt-1">Guía de uso del sistema HospedajePRO</p>
            </div>

            <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                        <BookOpen className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h2 className="font-semibold text-foreground">Sistema de Gestión de Hospedajes</h2>
                        <p className="text-sm text-muted-foreground">Versión 2.1.0</p>
                    </div>
                </div>

                <div className="space-y-3 text-sm text-muted-foreground">
                    <div className="bg-secondary/50 rounded-xl p-4 space-y-2">
                        <h3 className="font-semibold text-foreground">Módulos disponibles</h3>
                        <ul className="space-y-1">
                            <li>📊 <strong>Dashboard</strong> — Vista general de ocupación e ingresos</li>
                            <li>🛏️ <strong>Habitaciones</strong> — Gestión de habitaciones y estados</li>
                            <li>📋 <strong>Recepción</strong> — Check-in, check-out y reservas</li>
                            <li>🧾 <strong>Ventas & Tickets</strong> — Historial de cobros y comprobantes</li>
                            <li>🛒 <strong>Punto de Venta</strong> — Minimarket y servicios extras</li>
                            <li>⚙️ <strong>Configuración</strong> — Datos del hospedaje y SUNAT</li>
                        </ul>
                    </div>

                    <div className="bg-secondary/50 rounded-xl p-4 space-y-2">
                        <h3 className="font-semibold text-foreground">Tecnología</h3>
                        <ul className="space-y-1">
                            <li>⚡ Frontend: React + Vite</li>
                            <li>🗄️ Backend: Supabase (PostgreSQL)</li>
                            <li>🔐 Autenticación: Supabase Auth</li>
                            <li>📱 Diseño responsive para móvil y desktop</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
