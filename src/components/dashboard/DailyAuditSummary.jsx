import { memo } from 'react';
import { AlertTriangle, ArrowRight, Banknote, Building2, CreditCard, ShieldCheck, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';

const money = (value) => `S/ ${Number(value || 0).toFixed(2)}`;

const METHODS = [
    { key: 'efectivo', label: 'Efectivo', icon: Banknote },
    { key: 'yape', label: 'Yape', icon: Smartphone },
    { key: 'plin', label: 'Plin', icon: Smartphone },
    { key: 'transferencia', label: 'Transferencia', icon: Building2 },
    { key: 'tarjeta', label: 'Tarjeta', icon: CreditCard },
];

export const DailyAuditSummary = memo(function DailyAuditSummary({ total, transactions, methods = {}, sunat = {}, onOpenCaja }) {
    const incidents = Number(sunat.sunatPendientesCount || 0) + Number(sunat.sunatRechazadasCount || 0);

    return (
        <section className="col-span-2 overflow-hidden rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-sm lg:col-span-4 sm:p-5" aria-labelledby="auditoria-dia">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
                <div className="flex min-w-0 items-start gap-3 xl:w-64 xl:shrink-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                        <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                        <h2 id="auditoria-dia" className="text-sm font-bold text-foreground">Control gerencial del día</h2>
                        <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{Number(transactions || 0)} transacciones · {money(total)} registrados</p>
                    </div>
                </div>

                <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-5">
                    {METHODS.map((method) => {
                        const Icon = method.icon;
                        return (
                            <div key={method.key} className="rounded-lg border border-border/50 bg-background/70 p-2.5">
                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                                    <span className="text-[9px] font-semibold uppercase tracking-wider">{method.label}</span>
                                </div>
                                <p className="mt-1 text-xs font-bold tabular-nums text-foreground">{money(methods[method.key])}</p>
                            </div>
                        );
                    })}
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-primary/15 pt-3 xl:w-64 xl:shrink-0 xl:border-l xl:border-t-0 xl:pl-4 xl:pt-0">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className={`h-4 w-4 ${incidents > 0 ? 'text-amber-500' : 'text-emerald-500'}`} aria-hidden="true" />
                        <div>
                            <p className="text-xs font-semibold text-foreground">{incidents > 0 ? `${incidents} alerta(s) SUNAT` : 'SUNAT sin alertas'}</p>
                            <p className="text-[9px] text-muted-foreground">Pendientes o rechazados</p>
                        </div>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={onOpenCaja} className="h-9 shrink-0 gap-1.5 text-xs">
                        Revisar <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>
        </section>
    );
});

DailyAuditSummary.displayName = 'DailyAuditSummary';
