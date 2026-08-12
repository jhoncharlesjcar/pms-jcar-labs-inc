import React, { memo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TrendingDown, DollarSign, FileText } from 'lucide-react';

/**
 * @param {Object} props
 * @param {boolean} props.expenseModal
 * @param {function} props.setExpenseModal
 * @param {any} props.addEgreso
 * @param {any} props.user
 */
export const CajaEgresoModal = memo(function CajaEgresoModal(/** @type {any} */ { expenseModal, setExpenseModal, addEgreso, user }) {
    return (
        <Dialog open={expenseModal} onOpenChange={setExpenseModal}>
            <DialogContent className="max-w-md p-0 overflow-hidden rounded-xl border border-border/80 shadow-2xl glass-panel">
                <div className="bg-primary/10 p-6 relative overflow-hidden border-b border-primary/20">
                    <DialogHeader>
                        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center mb-3 shadow-sm text-primary-foreground">
                            <TrendingDown className="w-5 h-5" />
                        </div>
                        <DialogTitle className="text-xl font-extrabold text-foreground tracking-tight">
                            Nuevo Egreso
                        </DialogTitle>
                    </DialogHeader>
                    <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest mt-1.5">Registra gastos operativos o compras para el hotel.</p>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-2xl rounded-full -mr-16 -mt-16" />
                </div>

                <form onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    addEgreso.mutate({
                        monto: Number(formData.get('monto')),
                        concepto: formData.get('concepto'),
                        categoria: formData.get('categoria'),
                        fecha: new Date().toISOString(),
                        usuario_id: user?.id,
                        usuario_nombre: user?.full_name || user?.email
                    });
                }} className="p-6 space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="egreso_monto" className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Monto del Gasto (S/)</Label>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input 
                                id="egreso_monto"
                                name="monto" 
                                type="number" 
                                step="0.01" 
                                required 
                                className="pl-9 h-10 bg-background/50 border-border/40 rounded-md text-base font-extrabold focus-visible:ring-primary/30 focus-visible:border-primary/50 shadow-inner"
                                placeholder="0.00"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="egreso_concepto" className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Concepto / Detalle</Label>
                        <div className="relative">
                            <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                            <Input 
                                id="egreso_concepto"
                                name="concepto" 
                                required 
                                className="pl-9 h-9 bg-background/50 border-border/40 rounded-md focus-visible:ring-primary/30 focus-visible:border-primary/50 text-xs font-bold shadow-sm"
                                placeholder="Ej. Compra de insumos de limpieza"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="egreso_categoria" className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Categoría</Label>
                        <select 
                            id="egreso_categoria"
                            name="categoria"
                            className="w-full h-9 px-3 bg-background/50 border border-border/40 rounded-md text-xs font-bold focus-visible:ring-primary/30 focus-visible:border-primary/50 appearance-none shadow-sm cursor-pointer"
                        >
                            <option value="operativo">Gasto Operativo</option>
                            <option value="servicios">Servicios (Luz, Agua, Internet)</option>
                            <option value="insumos">Insumos y Limpieza</option>
                            <option value="mantenimiento">Mantenimiento</option>
                            <option value="personal">Adelanto Personal</option>
                            <option value="otros">Otros</option>
                        </select>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <Button type="button" variant="ghost" onClick={() => setExpenseModal(false)} className="flex-1 h-9 rounded-md font-bold text-[10px] uppercase tracking-widest hover:bg-muted">Cancelar</Button>
                        <Button disabled={addEgreso.isPending} className="flex-1 h-9 rounded-md bg-primary hover:bg-primary/90 shadow-md font-extrabold text-xs active:scale-95 transition-all">
                            {addEgreso.isPending ? 'Guardando...' : 'Registrar Gasto'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
});
CajaEgresoModal.displayName = 'CajaEgresoModal';
