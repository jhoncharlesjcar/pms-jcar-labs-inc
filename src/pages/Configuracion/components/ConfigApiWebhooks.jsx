import { AlertTriangle, BookOpen, Key, Webhook } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * La administracion de API keys y webhooks permanece cerrada hasta disponer
 * de almacenamiento server-side, hashes de claves, rotacion y entrega de
 * eventos firmada. No se generan secretos de apariencia productiva en el
 * navegador.
 */
export function ConfigApiWebhooks() {
    return (
        <section className="space-y-6" aria-labelledby="api-integrations-title">
            <div className="border-b border-border/50 pb-5">
                <h2 id="api-integrations-title" className="text-xl font-extrabold flex items-center gap-2">
                    <Webhook className="w-5 h-5 text-primary" aria-hidden="true" />
                    Ecosistema de Integracion (APIs)
                </h2>
                <p className="text-muted-foreground text-sm mt-1">
                    Las integraciones externas se habilitaran cuando el servicio seguro de claves y webhooks este configurado.
                </p>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/30 p-5 rounded-2xl flex gap-3 text-amber-800 dark:text-amber-300">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
                <div className="space-y-1">
                    <p className="font-bold">Integracion deshabilitada de forma segura</p>
                    <p className="text-sm">
                        El sistema no genera claves en el navegador ni simula webhooks. Para activarlo se requiere un endpoint
                        autenticado que almacene solo hashes, permita rotacion y firme cada entrega.
                    </p>
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <div className="bg-card border border-border/50 p-5 rounded-2xl space-y-3">
                    <Key className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
                    <h3 className="font-bold">Claves API</h3>
                    <p className="text-sm text-muted-foreground">No hay claves activas generadas por esta interfaz.</p>
                    <Button disabled className="w-full">Generacion no disponible</Button>
                </div>
                <div className="bg-card border border-border/50 p-5 rounded-2xl space-y-3">
                    <Webhook className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
                    <h3 className="font-bold">Webhooks</h3>
                    <p className="text-sm text-muted-foreground">No hay destinos simulados ni entregas sin firma.</p>
                    <Button disabled variant="outline" className="w-full">Registro no disponible</Button>
                </div>
            </div>

            <div className="bg-primary/5 border border-primary/20 p-5 rounded-2xl flex items-start gap-3">
                <BookOpen className="w-5 h-5 text-primary shrink-0" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">
                    La documentacion se publicara junto con el contrato OpenAPI y el procedimiento de rotacion y revocacion.
                </p>
            </div>
        </section>
    );
}
