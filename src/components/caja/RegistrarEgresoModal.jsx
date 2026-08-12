import React, { memo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { TrendingDown, DollarSign, FileText } from 'lucide-react';
import { egresoSchema } from '@/schemas/caja.schema';

const RegistrarEgresoModal = memo(function RegistrarEgresoModal({
    open,
    setOpen,
    insumos,
    addEgreso,
    user,
    qc,
    hotelDb
}) {
    const form = useForm({
        resolver: zodResolver(egresoSchema),
        defaultValues: {
            monto: undefined,
            concepto: '',
            categoria: 'operativo',
            insumo_id: '',
            cantidad_insumo: undefined
        }
    });

    const { register, handleSubmit, watch, formState: { errors }, reset } = form;
    const watchCategoria = watch('categoria');

    const onSubmit = (data) => {
        addEgreso.mutate({
            monto: Number(data.monto),
            concepto: data.concepto,
            categoria: data.categoria,
            fecha: new Date().toISOString(),
            usuario_id: user?.id,
            usuario_nombre: user?.full_name || user?.email
        }, {
            onSuccess: () => {
                if (data.categoria === 'insumos' && data.insumo_id) {
                    const cantidad = Number(data.cantidad_insumo);
                    hotelDb.MovimientoInsumo.create({
                        insumo_id: data.insumo_id,
                        tipo_movimiento: 'entrada',
                        cantidad: cantidad,
                        costo_total: Number(data.monto),
                        motivo: data.concepto,
                        usuario_nombre: user?.full_name || user?.email
                    }).then(() => {
                        const insumo = insumos.find(i => i.id === data.insumo_id);
                        if (insumo) {
                            hotelDb.Insumo.update(data.insumo_id, { stock: insumo.stock + cantidad }).then(() => {
                                qc.invalidateQueries({ queryKey: ['insumos'] });
                            });
                        }
                    });
                }
                reset();
                setOpen(false);
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={(val) => {
            if (!val) reset();
            setOpen(val);
        }}>
            <DialogContent className="max-w-md p-0 overflow-hidden rounded-[2.5rem] border-none shadow-2xl">
                <div className="bg-primary p-8 text-foreground relative overflow-hidden">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black font-display flex items-center gap-2">
                            <TrendingDown className="w-6 h-6" />
                            Nuevo Egreso
                        </DialogTitle>
                    </DialogHeader>
                    <p className="text-foreground/60 text-xs mt-1">Registra gastos operativos o compras para el hotel.</p>
                    <div className="absolute top-0 right-0 w-40 h-40 bg-foreground/5 blur-3xl rounded-full -mr-20 -mt-20" />
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="p-8 space-y-5 bg-card">
                    <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Monto del Gasto (S/)</Label>
                        <div className="relative">
                            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/40" />
                            <Input 
                                {...register('monto', { valueAsNumber: true })}
                                type="number" 
                                step="0.01" 
                                className="pl-12 h-14 bg-muted/30 border-none rounded-2xl text-lg font-bold focus:ring-primary/20"
                                placeholder="0.00"
                            />
                        </div>
                        {errors.monto && <p className="text-red-500 text-xs mt-1">{errors.monto.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Concepto / Detalle</Label>
                        <div className="relative">
                            <FileText className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/40" />
                            <Input 
                                {...register('concepto')}
                                className="pl-12 h-14 bg-muted/30 border-none rounded-2xl focus:ring-primary/20 text-base sm:text-sm"
                                placeholder="Ej. Compra de insumos de limpieza"
                            />
                        </div>
                        {errors.concepto && <p className="text-red-500 text-xs mt-1">{errors.concepto.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Categoría</Label>
                        <select 
                            {...register('categoria')}
                            className="w-full h-14 px-5 bg-muted/30 border-none rounded-2xl text-sm font-medium focus:ring-primary/20 appearance-none"
                        >
                            <option value="operativo">Gasto Operativo</option>
                            <option value="servicios">Servicios (Luz, Agua, Internet)</option>
                            <option value="insumos">Insumos y Limpieza</option>
                            <option value="mantenimiento">Mantenimiento</option>
                            <option value="personal">Adelanto Personal</option>
                            <option value="otros">Otros</option>
                        </select>
                        {errors.categoria && <p className="text-red-500 text-xs mt-1">{errors.categoria.message}</p>}
                    </div>

                    {watchCategoria === 'insumos' && (
                        <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Insumo / Producto</Label>
                                <select {...register('insumo_id')} className="w-full h-14 px-5 bg-muted/30 border-none rounded-2xl text-sm font-medium focus:ring-primary/20">
                                    <option value="">Seleccione insumo...</option>
                                    {insumos.map(i => (
                                        <option key={i.id} value={i.id}>{i.nombre} (Stock: {i.stock})</option>
                                    ))}
                                </select>
                                {errors.insumo_id && <p className="text-red-500 text-xs mt-1">{errors.insumo_id.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Cantidad Ingresada</Label>
                                <Input 
                                    {...register('cantidad_insumo', { valueAsNumber: true })} 
                                    type="number" 
                                    min="1"
                                    placeholder="Ej. 10"
                                    className="h-14 bg-muted/30 border-none rounded-2xl font-bold text-base sm:text-sm"
                                />
                                {errors.cantidad_insumo && <p className="text-red-500 text-xs mt-1">{errors.cantidad_insumo.message}</p>}
                            </div>
                        </div>
                    )}

                    <div className="flex gap-3 pt-4">
                        <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="flex-1 h-12 rounded-2xl">Cancelar</Button>
                        <Button type="submit" disabled={addEgreso.isPending} className="flex-1 h-12 rounded-2xl bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
                            {addEgreso.isPending ? 'Guardando...' : 'Registrar Gasto'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
});
RegistrarEgresoModal.displayName = 'RegistrarEgresoModal';
export default RegistrarEgresoModal;
