import { useState, memo } from 'react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

/**
 * Diálogo de confirmación reutilizable basado en AlertDialog de Radix.
 * Reemplaza todos los confirm() nativos del navegador.
 *
 * @param {Object} props
 * @param {boolean} props.open - Controla la visibilidad del diálogo
 * @param {(open: boolean) => void} props.onOpenChange - Callback de cambio de estado
 * @param {string} props.title - Título del diálogo
 * @param {string} [props.description] - Descripción opcional
 * @param {() => void} props.onConfirm - Callback ejecutado al confirmar
 * @param {'default' | 'destructive'} [props.variant='default'] - Estilo del botón de confirmación
 * @param {string} [props.confirmText='Confirmar'] - Texto del botón de confirmación
 * @param {string} [props.cancelText='Cancelar'] - Texto del botón de cancelar
 * @param {boolean} [props.isPending=false] - Si el proceso está en curso
 */
const ConfirmDialog = memo(function ConfirmDialog({
    open,
    onOpenChange,
    title,
    description,
    onConfirm,
    variant = 'default',
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    isPending = false,
}) {
    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent className="w-[calc(100%-2rem)] bg-card/95 backdrop-blur-xl border border-border/50 rounded-xl shadow-2xl max-w-md">
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-lg font-bold text-foreground">
                        {title}
                    </AlertDialogTitle>
                    {description && (
                        <AlertDialogDescription className="text-sm text-muted-foreground">
                            {description}
                        </AlertDialogDescription>
                    )}
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-2">
                    <AlertDialogCancel
                        className="h-10 rounded-lg font-semibold border-border/50 text-sm"
                        disabled={isPending}
                    >
                        {cancelText}
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={(e) => {
                            e.preventDefault();
                            onConfirm();
                        }}
                        disabled={isPending}
                        className={cn(
                            "h-10 rounded-lg font-semibold text-sm shadow-sm",
                            variant === 'destructive'
                                ? "bg-red-600 hover:bg-red-700 text-white focus:ring-red-600"
                                : "bg-primary hover:bg-primary/90 text-primary-foreground"
                        )}
                    >
                        {isPending ? 'Procesando...' : confirmText}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
});
ConfirmDialog.displayName = 'ConfirmDialog';
export default ConfirmDialog;

/**
 * Hook para manejar el estado del ConfirmDialog de forma imperativa.
 * Uso:
 *   const { confirmProps, requestConfirm } = useConfirmDialog();
 *   requestConfirm({ title: '¿Eliminar?', onConfirm: () => del(id) });
 *   <ConfirmDialog {...confirmProps} />
 */
export function useConfirmDialog() {
    const [state, setState] = useState({
        open: false,
        title: '',
        description: '',
        variant: 'default',
        confirmText: 'Confirmar',
        cancelText: 'Cancelar',
        onConfirm: () => {},
    });

    const requestConfirm = ({ title, description = '', variant = 'default', confirmText = 'Confirmar', cancelText = 'Cancelar', onConfirm }) => {
        setState({ open: true, title, description, variant, confirmText, cancelText, onConfirm });
    };

    const confirmProps = {
        ...state,
        onConfirm: () => {
            state.onConfirm();
            setState((s) => ({ ...s, open: false }));
        },
        onOpenChange: (open) => setState((s) => ({ ...s, open })),
    };

    return { confirmProps, requestConfirm };
}
