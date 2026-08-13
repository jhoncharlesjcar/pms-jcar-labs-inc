import { useState, memo } from 'react';
import { Server, Database, CheckCircle, Building2, Zap, Users, Settings, ExternalLink, Printer, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { printEscPos } from '@/modules/printer';
import { buildTicketPrueba58mm } from '@/modules/printer/templates/comprobanteTermico';
import { toast } from 'sonner';
import logger from '@/lib/logger';

const SystemInfo = memo(function SystemInfo({ version, hoteles = [], hotelesCount }) {
    const [selectedHotelId, setSelectedHotelId] = useState(hoteles[0]?.id || '');
    const [isPrinting, setIsPrinting] = useState(false);

    const selectedHotel = hoteles.find(h => h.id === selectedHotelId) || hoteles[0] || {
        nombre: 'PMS JCAR LABS (DEMO)',
        ruc: '11111111111',
        direccion: 'Av. Floral 123',
        ciudad: 'Chachapoyas',
        telefono: '987654321',
        aplica_igv: false,
        mensaje_ticket: 'Ticket de prueba de hardware'
    };

    return (
        <div className="space-y-3 max-w-2xl">
            <p className="text-[10px] font-bold text-muted-foreground bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-amber-700 shadow-sm">
                ⚠️ <strong className="font-extrabold">Zona de Desarrollador:</strong> Los cambios aquí afectan a todo el sistema globalmente.
            </p>

            <div className="bg-card/40 backdrop-blur-xl border border-border/40 rounded-xl p-4 space-y-3 shadow-sm">
                <h3 className="font-extrabold text-sm tracking-tight text-foreground flex items-center gap-2"><Server className="w-3.5 h-3.5 text-amber-500" /> Estado del Sistema</h3>
                <div className="grid grid-cols-2 gap-2">
                    {[
                        { label: 'Versión', value: `PMS JCAR LABS v${version}`, icon: Zap },
                        { label: 'Base de datos', value: 'Supabase · Conectada', icon: Database },
                        { label: 'Auth', value: 'Activa · Requerida', icon: CheckCircle },
                        { label: 'Multi-tenant', value: `${hotelesCount} hotel(es)`, icon: Building2 },
                    ].map(item => (
                        <div key={item.label} className="bg-card/60 border border-border/40 rounded-lg p-2.5 shadow-xs">
                            <div className="flex items-center gap-1.5 mb-0.5">
                                <item.icon className="w-3 h-3 text-muted-foreground" />
                                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">{item.label}</p>
                            </div>
                            <p className="text-xs font-extrabold tracking-tight text-foreground">{item.value}</p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-card/40 backdrop-blur-xl border border-border/40 rounded-xl p-4 space-y-3 shadow-sm">
                <h3 className="font-extrabold text-sm tracking-tight text-foreground flex items-center gap-2"><Users className="w-3.5 h-3.5 text-amber-500" /> Estructura de Roles</h3>
                <div className="space-y-2">
                    {[
                        { rol: '🔧 Developer', permisos: 'Panel Dev completo, configuración global, auditoría, gestión de hoteles', badge: 'bg-amber-100 text-amber-700 border-amber-300' },
                        { rol: '👑 Admin', permisos: 'Gestión completa del hotel asignado: habitaciones, reservas, ventas, staff', badge: 'bg-primary/10 text-primary border-primary/20' },
                        { rol: '🛎️ Recepcionista', permisos: 'Recepción, check-in/out, POS, ventas del hotel asignado', badge: 'bg-green-100 text-green-700 border-green-300' },
                    ].map(r => (
                        <div key={r.rol} className="flex items-start gap-2.5 p-2 rounded-lg bg-secondary/40 border border-border/40">
                            <span className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-sm border whitespace-nowrap flex-shrink-0", r.badge)}>{r.rol}</span>
                            <p className="text-[10px] font-bold text-muted-foreground pt-0.5 leading-tight">{r.permisos}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Ticketera Test Section */}
            <div className="bg-card/40 backdrop-blur-xl border border-border/40 rounded-xl p-4 space-y-3 shadow-sm">
                <h3 className="font-extrabold text-sm tracking-tight text-foreground flex items-center gap-2">
                    <Printer className="w-3.5 h-3.5 text-amber-500" /> Pruebas de Ticketera 58mm
                </h3>
                <p className="text-[10px] font-bold text-muted-foreground leading-relaxed">
                    Genera e imprime un ticket térmico de prueba (ESC/POS 32 cols) usando la configuración del hotel seleccionado para validar la conexión local de RawBT.
                </p>

                {hoteles.length > 0 ? (
                    <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">Seleccionar Hotel para el Ticket</label>
                        <select
                            value={selectedHotelId}
                            onChange={(e) => setSelectedHotelId(e.target.value)}
                            className="w-full h-9 px-3 rounded-md bg-background/50 border border-border/40 text-xs font-bold text-foreground focus:outline-none shadow-inner animate-none"
                        >
                            {hoteles.map(h => (
                                <option key={h.id} value={h.id} className="bg-card text-xs">
                                    {h.nombre} ({h.ruc || 'Sin RUC'})
                                </option>
                            ))}
                        </select>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>No hay hoteles registrados. Se usará una configuración mock para la prueba.</span>
                    </div>
                )}

                <button
                    onClick={async () => {
                        setIsPrinting(true);
                        try {
                            const ticket = buildTicketPrueba58mm(selectedHotel);
                            await printEscPos(ticket);
                            toast.success('Ticket de prueba enviado a la impresora');
                        } catch (err) {
                            logger.error(err);
                            toast.error(`Error de impresión: ${err.message}`);
                        } finally {
                            setIsPrinting(false);
                        }
                    }}
                    disabled={isPrinting}
                    className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-extrabold text-[10px] uppercase tracking-widest h-9 px-4 rounded-md shadow-sm transition-[transform,opacity]"
                >
                    <Printer className="w-3.5 h-3.5" />
                    {isPrinting ? 'Imprimiendo...' : 'Imprimir Ticket de Prueba 58mm'}
                </button>
            </div>

            <div className="bg-card/40 backdrop-blur-xl border border-border/40 rounded-xl p-4 space-y-3 shadow-sm">
                <h3 className="font-extrabold text-sm tracking-tight text-foreground flex items-center gap-2"><Settings className="w-3.5 h-3.5 text-amber-500" /> Herramientas Externas</h3>
                <button onClick={() => window.open('https://e-menu.sunat.gob.pe', '_blank')}
                    className="w-full flex items-center justify-between p-2.5 rounded-lg border border-border/40 bg-card/60 hover:bg-secondary transition-[transform,opacity] text-left shadow-xs">
                    <div className="flex items-center gap-2.5">
                        <ExternalLink className="w-3.5 h-3.5 text-blue-500" />
                        <div>
                            <p className="text-xs font-extrabold tracking-tight text-foreground">Portal SUNAT</p>
                            <p className="text-[10px] font-bold text-muted-foreground mt-0.5">Emitir comprobantes electrónicos</p>
                        </div>
                    </div>
                    <span className="text-xs text-muted-foreground">→</span>
                </button>
            </div>
        </div>
    );
});
SystemInfo.displayName = 'SystemInfo';
export default SystemInfo;
