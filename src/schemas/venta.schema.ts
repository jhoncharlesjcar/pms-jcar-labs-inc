import { z } from 'zod';

/**
 * Schema de validación para el registro de una venta / cobro hotelero.
 * Usado en RegistrarVentaModal.jsx.
 */
export const ventaSchema = z.object({
    metodo_pago: z.enum(
        ['efectivo', 'yape', 'plin', 'transferencia', 'tarjeta'],
        { required_error: 'Selecciona un método de pago' }
    ),
    descuento: z
        .number({ invalid_type_error: 'El descuento debe ser un número' })
        .min(0, 'El descuento no puede ser negativo')
        .default(0),
    requiere_comprobante: z.boolean().default(false),
    tipo_comprobante: z
        .enum(['boleta', 'factura', 'ninguno'])
        .default('ninguno'),
    ruc_cliente: z.string().optional(),
    razon_social: z.string().optional(),
}).superRefine((data, ctx) => {
    // Validación condicional: si emite factura, RUC y razón social son obligatorios
    if (data.requiere_comprobante && data.tipo_comprobante === 'factura') {
        if (!data.ruc_cliente || !data.ruc_cliente.trim()) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'El RUC de la empresa es obligatorio para facturas',
                path: ['ruc_cliente'],
            });
        } else if (!/^\d{11}$/.test(data.ruc_cliente.trim())) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'El RUC debe tener exactamente 11 dígitos numéricos',
                path: ['ruc_cliente'],
            });
        }
        if (!data.razon_social || !data.razon_social.trim()) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'La razón social es obligatoria para facturas',
                path: ['razon_social'],
            });
        }
    }
});

export type VentaFormData = z.infer<typeof ventaSchema>;
