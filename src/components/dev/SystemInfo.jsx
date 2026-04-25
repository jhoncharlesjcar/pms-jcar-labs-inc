import { Server, Database, CheckCircle, Building2, Zap, Users, Settings, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SystemInfo({ version, hotelesCount }) {
    return (
        <div className="space-y-4 max-w-2xl">
            <p className="text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-700">
                ⚠️ <strong>Zona de Desarrollador:</strong> Los cambios aquí afectan a todo el sistema globalmente.
            </p>

            <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                <h3 className="font-semibold text-foreground flex items-center gap-2"><Server className="w-4 h-4 text-amber-500" /> Estado del Sistema</h3>
                <div className="grid grid-cols-2 gap-3">
                    {[
                        { label: 'Versión', value: `ANGELICA FREY v${version}`, icon: Zap },
                        { label: 'Base de datos', value: 'Supabase · Conectada', icon: Database },
                        { label: 'Auth', value: 'Activa · Requerida', icon: CheckCircle },
                        { label: 'Multi-tenant', value: `${hotelesCount} hotel(es)`, icon: Building2 },
                    ].map(item => (
                        <div key={item.label} className="bg-secondary/50 rounded-xl p-3">
                            <div className="flex items-center gap-2 mb-1">
                                <item.icon className="w-3.5 h-3.5 text-muted-foreground" />
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{item.label}</p>
                            </div>
                            <p className="text-sm font-semibold text-foreground">{item.value}</p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                <h3 className="font-semibold text-foreground flex items-center gap-2"><Users className="w-4 h-4 text-amber-500" /> Estructura de Roles</h3>
                <div className="space-y-2">
                    {[
                        { rol: '🔧 Developer', permisos: 'Panel Dev completo, configuración global, auditoría, gestión de hoteles', badge: 'bg-amber-100 text-amber-700 border-amber-300' },
                        { rol: '👑 Admin', permisos: 'Gestión completa del hotel asignado: habitaciones, reservas, ventas, staff', badge: 'bg-primary/10 text-primary border-primary/20' },
                        { rol: '🛎️ Recepcionista', permisos: 'Recepción, check-in/out, POS, ventas del hotel asignado', badge: 'bg-green-100 text-green-700 border-green-300' },
                    ].map(r => (
                        <div key={r.rol} className="flex items-start gap-3 p-3 rounded-xl bg-secondary/40 border border-border">
                            <span className={cn("text-xs font-bold px-2 py-1 rounded-full border whitespace-nowrap flex-shrink-0", r.badge)}>{r.rol}</span>
                            <p className="text-xs text-muted-foreground">{r.permisos}</p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                <h3 className="font-semibold text-foreground flex items-center gap-2"><Settings className="w-4 h-4 text-amber-500" /> Herramientas Externas</h3>
                <button onClick={() => window.open('https://e-menu.sunat.gob.pe', '_blank')}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-border hover:bg-secondary transition-all text-left">
                    <div className="flex items-center gap-3">
                        <ExternalLink className="w-4 h-4 text-blue-500" />
                        <div>
                            <p className="text-sm font-medium text-foreground">Portal SUNAT</p>
                            <p className="text-xs text-muted-foreground">Emitir comprobantes electrónicos</p>
                        </div>
                    </div>
                    <span className="text-xs text-muted-foreground">→</span>
                </button>
            </div>
        </div>
    );
}
