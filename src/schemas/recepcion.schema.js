import { z } from 'zod';

export const recepcionSchema = z.object({
    habitacion_id: z.string().min(1, "Debes seleccionar una habitación"),
    habitacion_numero: z.string().optional(),
    habitacion_tipo: z.string().optional(),
    
    huesped_nombre: z.string().trim().min(3, "El nombre debe tener al menos 3 caracteres"),
    tipo_documento: z.string().default('DNI'),
    huesped_dni: z.string().trim().min(1, "El número de documento es obligatorio"),
    
    huesped_fecha_nacimiento: z.string().optional(),
    huesped_sexo: z.string().default('no_especificado'),
    huesped_telefono: z.string().optional(),
    huesped_email: z.string().email("Correo inválido").or(z.literal('')).optional(),
    
    huesped_procedencia: z.string().optional(),
    huesped_pais_residencia: z.string().default('Perú'),
    huesped_ciudad_residencia: z.string().optional(),
    
    nacionalidad: z.string().default('Peruana'),
    motivo_viaje: z.string().default('turismo'),
    huesped_estado_civil: z.string().optional(),
    huesped_profesion: z.string().optional(),
    huesped_destino: z.string().optional(),
    
    fecha_entrada: z.string(),
    fecha_salida: z.string(),
    noches: z.number().min(1),
    precio_noche: z.number().min(0),
    total: z.number().min(0),
    
    incluye_igv: z.boolean().default(true),
    moneda_pago: z.string().default('PEN'),
    tipo_cambio_dia: z.number().default(0),
    tarifa_sin_igv: z.number().optional(),
    igv_monto: z.number().optional(),
    observaciones_tarifas: z.string().optional(),
    
    num_adultos: z.number().min(1, "Debe haber al menos 1 adulto"),
    num_ninos: z.number().default(0),
    tiene_menores: z.boolean().default(false),
    tipo_relacion_menor: z.string().default('padre'),
    
    observaciones: z.string().optional(),
    estado: z.string().default('activa'),
    pre_checkin_id: z.string().optional(),
}).refine(data => {
    const entrada = new Date(data.fecha_entrada + 'T12:00:00');
    const salida = new Date(data.fecha_salida + 'T12:00:00');
    return salida > entrada;
}, {
    message: "La fecha de salida debe ser posterior a la fecha de entrada",
    path: ["fecha_salida"]
}).refine(data => {
    const val = data.huesped_dni;
    if (!val) return false;
    if (data.tipo_documento === 'DNI') {
        return /^\d{8}$/.test(val);
    }
    if (data.tipo_documento === 'RUC') {
        return /^\d{11}$/.test(val);
    }
    if (data.tipo_documento === 'pasaporte') {
        return val.length >= 6 && val.length <= 15;
    }
    return val.length >= 4;
}, {
    message: "El número de documento ingresado tiene un formato inválido",
    path: ["huesped_dni"]
}).refine(data => {
    if (data.tiene_menores) {
        return data.observaciones && data.observaciones.trim().length > 5;
    }
    return true;
}, {
    message: "Detalle los Nombres y DNI de los menores de edad en las observaciones (Ley N° 30802)",
    path: ["observaciones"]
});
