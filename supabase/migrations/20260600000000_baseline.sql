-- ============================================================
-- MIGRACIÓN BASELINE — PMS JCAR LABS
-- Crea todas las tablas core que las migraciones posteriores asumen existentes.
-- Usa IF NOT EXISTS para ser segura contra despliegues existentes.
-- Path: supabase/migrations/20260600000000_baseline.sql
-- ============================================================

-- ────────────────────────────────────────────────────────────────
-- 1. HOTELES (raíz multi-tenant)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hoteles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    ruc TEXT,
    razon_social TEXT,
    direccion TEXT,
    ciudad TEXT,
    telefono TEXT,
    email TEXT,
    logo_url TEXT,
    mensaje_ticket TEXT DEFAULT '¡Gracias por su preferencia!',
    activo BOOLEAN NOT NULL DEFAULT true,

    -- Configuración fiscal
    aplica_igv BOOLEAN NOT NULL DEFAULT true,
    modo_sunat TEXT NOT NULL DEFAULT 'desactivado'
        CHECK (modo_sunat IN ('manual', 'automatico', 'desactivado')),
    sunat_usuario_sol TEXT,
    sunat_clave_sol TEXT,
    sunat_certificado_pem TEXT,
    sunat_modo_prueba BOOLEAN NOT NULL DEFAULT true,

    -- Configuración operativa
    hora_checkin TEXT NOT NULL DEFAULT '14:00',
    hora_checkout TEXT NOT NULL DEFAULT '12:00',
    check_in_hora TEXT DEFAULT '14:00',
    check_out_hora TEXT DEFAULT '12:00',
    tolerancia_minutos INTEGER DEFAULT 15,
    numero_yape TEXT,
    tipo_cambio NUMERIC(8,4) NOT NULL DEFAULT 3.80,

    -- Pasarela de pagos
    modo_automatico BOOLEAN DEFAULT false,
    pasarela_activa TEXT DEFAULT 'culqi',
    pasarela_public_key TEXT,
    pasarela_private_key TEXT,
    qr_yape_url TEXT,
    qr_plin_url TEXT,

    -- Fidelidad
    loyalty_program_enabled BOOLEAN NOT NULL DEFAULT false,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hoteles ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────────
-- 2. USUARIOS
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.usuarios (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'recepcionista'
        CHECK (role IN ('developer', 'admin', 'recepcionista', 'limpieza')),
    hotel_id UUID REFERENCES public.hoteles(id) ON DELETE SET NULL,
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────────
-- 3. HABITACIONES
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.habitaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES public.hoteles(id) ON DELETE CASCADE,
    numero TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'simple',
    precio_noche NUMERIC(12,2) NOT NULL DEFAULT 0,
    precio NUMERIC(12,2),
    capacidad INTEGER NOT NULL DEFAULT 1,
    estado TEXT NOT NULL DEFAULT 'disponible'
        CHECK (estado IN ('disponible', 'ocupada', 'reservada', 'mantenimiento', 'limpieza')),
    piso TEXT,
    descripcion TEXT,
    amenidades JSONB DEFAULT '[]'::jsonb,
    created_date TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_habitacion_numero_hotel UNIQUE (hotel_id, numero)
);

ALTER TABLE public.habitaciones ENABLE ROW LEVEL SECURITY;

-- Constraint compuesta para FK relacional (P1 — aislamiento cross-tenant)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.habitaciones'::regclass AND conname = 'uq_habitacion_hotel'
    ) THEN
        ALTER TABLE public.habitaciones ADD CONSTRAINT uq_habitacion_hotel UNIQUE (id, hotel_id);
    END IF;
END $$;

-- ────────────────────────────────────────────────────────────────
-- 4. RESERVAS
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reservas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES public.hoteles(id) ON DELETE CASCADE,
    habitacion_id UUID REFERENCES public.habitaciones(id) ON DELETE SET NULL,
    habitacion_numero TEXT,
    habitacion_tipo TEXT,
    numero_reserva TEXT,
    estado TEXT NOT NULL DEFAULT 'pendiente'
        CHECK (estado IN ('pendiente', 'confirmada', 'activa', 'finalizada', 'cancelada')),
    
    -- Huésped
    huesped_nombre TEXT NOT NULL,
    huesped_dni TEXT,
    huesped_telefono TEXT,
    huesped_email TEXT,
    huesped_sexo TEXT,
    huesped_fecha_nacimiento TEXT,
    huesped_procedencia TEXT,
    huesped_destino TEXT,
    huesped_profesion TEXT,
    huesped_estado_civil TEXT,
    nacionalidad TEXT,
    motivo_viaje TEXT,
    tipo_documento TEXT DEFAULT 'DNI',
    tiene_menores BOOLEAN DEFAULT false,

    -- Estadía
    fecha_entrada DATE NOT NULL,
    fecha_salida DATE NOT NULL,
    noches INTEGER NOT NULL DEFAULT 1,
    precio_noche NUMERIC(12,2),
    total NUMERIC(12,2),

    -- Extras
    observaciones TEXT,
    origen TEXT DEFAULT 'recepcion',
    servicios_extra_ids JSONB DEFAULT '[]'::jsonb,
    estado_pago TEXT,
    
    created_date TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reservas ENABLE ROW LEVEL SECURITY;

-- FK compuesta: habitacion_id + hotel_id deben coincidir
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.reservas'::regclass AND conname = 'fk_reserva_habitacion_hotel'
    ) THEN
        ALTER TABLE public.reservas ADD CONSTRAINT fk_reserva_habitacion_hotel
            FOREIGN KEY (habitacion_id, hotel_id)
            REFERENCES public.habitaciones(id, hotel_id);
    END IF;
END $$;

-- ────────────────────────────────────────────────────────────────
-- 5. VENTAS (Hotel / Checkout)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ventas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES public.hoteles(id) ON DELETE CASCADE,
    numero_ticket TEXT,
    reserva_id UUID REFERENCES public.reservas(id) ON DELETE SET NULL,
    numero_reserva TEXT,
    habitacion_numero TEXT,
    habitacion_tipo TEXT,
    huesped_nombre TEXT,
    huesped_dni TEXT,
    fecha_entrada TEXT,
    fecha_salida TEXT,
    noches INTEGER,
    precio_noche NUMERIC(12,2),
    subtotal NUMERIC(12,2),
    descuento NUMERIC(12,2) DEFAULT 0,
    total NUMERIC(12,2) NOT NULL,
    metodo_pago TEXT NOT NULL DEFAULT 'efectivo',
    estado_comprobante TEXT DEFAULT 'ticket_interno',
    tipo_comprobante TEXT DEFAULT 'ninguno',
    ruc_cliente TEXT,
    razon_social TEXT,
    notas TEXT,
    fecha_pago TEXT,
    created_date TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ventas ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────────
-- 6. VENTAS POS (Minimarket)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ventas_pos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES public.hoteles(id) ON DELETE CASCADE,
    numero_ticket TEXT,
    tipo TEXT DEFAULT 'solo_extras',
    habitacion_numero TEXT,
    huesped_nombre TEXT,
    huesped_dni TEXT,
    reserva_id UUID REFERENCES public.reservas(id) ON DELETE SET NULL,
    items JSONB DEFAULT '[]'::jsonb,
    subtotal_estadia NUMERIC(12,2) DEFAULT 0,
    subtotal_extras NUMERIC(12,2) DEFAULT 0,
    descuento NUMERIC(12,2) DEFAULT 0,
    total NUMERIC(12,2) NOT NULL DEFAULT 0,
    metodo_pago TEXT NOT NULL DEFAULT 'efectivo',
    estado_comprobante TEXT DEFAULT 'ticket_interno',
    tipo_comprobante TEXT DEFAULT 'ninguno',
    ruc_cliente TEXT,
    razon_social TEXT,
    notas TEXT,
    fecha_venta TIMESTAMPTZ,
    created_date TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ventas_pos ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────────
-- 7. SERVICIOS EXTRA (consumibles de habitación)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.servicios_extra (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES public.hoteles(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    categoria TEXT,
    precio NUMERIC(12,2) NOT NULL DEFAULT 0,
    disponible BOOLEAN DEFAULT true,
    emoji TEXT,
    stock INTEGER DEFAULT 0,
    created_date TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.servicios_extra ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────────
-- 8. PRODUCTOS (Minimarket / POS)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.categorias_productos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES public.hoteles(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    emoji TEXT,
    created_date TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.categorias_productos ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.productos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES public.hoteles(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    precio_venta NUMERIC(12,2) NOT NULL DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 0,
    categoria_id UUID REFERENCES public.categorias_productos(id) ON DELETE SET NULL,
    activo BOOLEAN DEFAULT true,
    emoji TEXT,
    created_date TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────────
-- 9. EGRESOS Y CIERRES DE CAJA
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.egresos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES public.hoteles(id) ON DELETE CASCADE,
    monto NUMERIC(12,2) NOT NULL,
    concepto TEXT NOT NULL,
    categoria TEXT DEFAULT 'otros',
    fecha TEXT,
    usuario_id UUID REFERENCES auth.users(id),
    usuario_nombre TEXT,
    insumo_id UUID,
    insumo_cantidad INTEGER,
    created_date TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.egresos ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.cierres_caja (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES public.hoteles(id) ON DELETE CASCADE,
    fecha TEXT NOT NULL,
    total_ingresos NUMERIC(12,2) DEFAULT 0,
    total_egresos NUMERIC(12,2) DEFAULT 0,
    balance NUMERIC(12,2) DEFAULT 0,
    desglose JSONB DEFAULT '{}'::jsonb,
    usuario_id UUID REFERENCES auth.users(id),
    usuario_nombre TEXT,
    notas TEXT,
    created_date TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cierres_caja ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────────
-- 10. TARIFAS DINÁMICAS
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tarifas_dinamicas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES public.hoteles(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('temporada', 'dia_semana')),
    factor_ajuste NUMERIC(6,4) NOT NULL DEFAULT 1.0,
    fecha_inicio DATE,
    fecha_fin DATE,
    dia_semana INTEGER,
    umbral_ocupacion_min INTEGER,
    activo BOOLEAN DEFAULT true,
    created_date TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tarifas_dinamicas ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────────
-- 11. INSUMOS Y MOVIMIENTOS
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.categorias_insumos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES public.hoteles(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    emoji TEXT,
    created_date TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.categorias_insumos ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.insumos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES public.hoteles(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    unidad TEXT DEFAULT 'unidad',
    stock INTEGER NOT NULL DEFAULT 0,
    categoria_id UUID REFERENCES public.categorias_insumos(id) ON DELETE SET NULL,
    activo BOOLEAN DEFAULT true,
    created_date TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.insumos ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.movimientos_insumos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES public.hoteles(id) ON DELETE CASCADE,
    insumo_id UUID NOT NULL REFERENCES public.insumos(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'salida')),
    cantidad INTEGER NOT NULL,
    costo_total NUMERIC(12,2) DEFAULT 0,
    motivo TEXT,
    usuario_id UUID REFERENCES auth.users(id),
    usuario_nombre TEXT,
    created_date TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.movimientos_insumos ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────────
-- 12. PERSONAL (datos extendidos, opcional)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.personal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES public.hoteles(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    cargo TEXT,
    turno TEXT,
    telefono TEXT,
    activo BOOLEAN DEFAULT true,
    created_date TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.personal ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────────
-- 13. AUDIT LOGS
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES public.hoteles(id) ON DELETE CASCADE,
    usuario_id UUID,
    usuario_nombre TEXT,
    accion TEXT NOT NULL,
    descripcion TEXT,
    modulo TEXT,
    created_date TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────────
-- 14. CÓDIGOS DE DESBLOQUEO (admin)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.codigos_desbloqueo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo TEXT NOT NULL UNIQUE,
    usado BOOLEAN NOT NULL DEFAULT false,
    usado_por TEXT,
    fecha_uso TEXT,
    created_date TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.codigos_desbloqueo ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────────
-- 15. ÍNDICES ÚTILES
-- ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_habitaciones_hotel ON public.habitaciones(hotel_id);
CREATE INDEX IF NOT EXISTS idx_reservas_hotel ON public.reservas(hotel_id);
CREATE INDEX IF NOT EXISTS idx_reservas_estado ON public.reservas(hotel_id, estado);
CREATE INDEX IF NOT EXISTS idx_reservas_fechas ON public.reservas(hotel_id, fecha_entrada, fecha_salida);
CREATE INDEX IF NOT EXISTS idx_ventas_hotel ON public.ventas(hotel_id);
CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON public.ventas(hotel_id, fecha_pago);
CREATE INDEX IF NOT EXISTS idx_ventas_pos_hotel ON public.ventas_pos(hotel_id);
CREATE INDEX IF NOT EXISTS idx_egresos_hotel ON public.egresos(hotel_id);
CREATE INDEX IF NOT EXISTS idx_productos_hotel ON public.productos(hotel_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_hotel ON public.audit_logs(hotel_id);

-- ────────────────────────────────────────────────────────────────
-- 16. NOTIFICACIÓN DE RECARGA DE ESQUEMA
-- ────────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
