import { z } from 'zod';

/**
 * Schema de validación para crear / editar una habitación.
 * Usado en el modal de Habitaciones.jsx.
 */
export const habitacionSchema = z.object({
    numero: z
        .string()
        .trim()
        .min(1, 'El número de habitación es obligatorio')
        .max(10, 'El número es demasiado largo'),
    tipo: z.enum(
        ['simple', 'doble simple', 'matrimonial', 'doble matrimonial', 'mixta', 'queen'],
        { required_error: 'Selecciona el tipo de habitación' }
    ),
    piso: z
        .string()
        .optional()
        .refine(val => !val || !isNaN(Number(val)), { message: 'El piso debe ser un número' }),
    precio: z
        .number({ invalid_type_error: 'El precio debe ser un número' })
        .min(1, 'El precio por noche debe ser mayor a 0'),
    estado: z
        .enum(['disponible', 'ocupada', 'reservada', 'mantenimiento', 'limpieza'])
        .default('disponible'),
    descripcion: z.string().optional(),
});

export type HabitacionFormData = z.infer<typeof habitacionSchema>;
