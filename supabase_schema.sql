-- ============================================================
-- SCHEMA: Sistema de Gestión de Hospedajes - Supabase Migration
-- Migrado desde Base44
-- ============================================================

-- Habilitar UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLA: hoteles
-- ============================================================
CREATE TABLE IF NOT EXISTS hoteles (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    nombre TEXT NOT NULL,
    ruc TEXT,
    direccion TEXT,
    ciudad TEXT,
    telefono TEXT,
    email TEXT,
    activo BOOLEAN DEFAULT true,
    logo_url TEXT,
    hora_checkin TEXT DEFAULT '14:00',
    hora_checkout TEXT DEFAULT '12:00',
    notas TEXT,
    created_date TIMESTAMPTZ DEFAULT NOW(),
    updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: habitaciones
-- ============================================================
CREATE TABLE IF NOT EXISTS habitaciones (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    hotel_id UUID REFERENCES hoteles(id) ON DELETE CASCADE,
    numero TEXT NOT NULL,
    tipo TEXT DEFAULT 'simple' CHECK (tipo IN ('simple', 'doble', 'triple', 'matrimonial', 'suite')),
    precio_noche NUMERIC NOT NULL,
    estado TEXT DEFAULT 'disponible' CHECK (estado IN ('disponible', 'ocupada', 'mantenimiento', 'reservada')),
    descripcion TEXT,
    capacidad INTEGER DEFAULT 1,
    piso TEXT,
    created_date TIMESTAMPTZ DEFAULT NOW(),
    updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: reservas
-- ============================================================
CREATE TABLE IF NOT EXISTS reservas (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    hotel_id UUID REFERENCES hoteles(id) ON DELETE CASCADE,
    numero_reserva TEXT,
    habitacion_id UUID REFERENCES habitaciones(id),
    habitacion_numero TEXT,
    habitacion_tipo TEXT,
    huesped_nombre TEXT NOT NULL,
    huesped_dni TEXT,
    huesped_telefono TEXT,
    huesped_procedencia TEXT,
    fecha_entrada DATE,
    fecha_salida DATE,
    noches NUMERIC,
    precio_noche NUMERIC,
    total NUMERIC,
    estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'activa', 'finalizada', 'cancelada')),
    observaciones TEXT,
    num_adultos INTEGER DEFAULT 1,
    num_ninos INTEGER DEFAULT 0,
    created_date TIMESTAMPTZ DEFAULT NOW(),
    updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: ventas
-- ============================================================
CREATE TABLE IF NOT EXISTS ventas (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    hotel_id UUID REFERENCES hoteles(id) ON DELETE CASCADE,
    numero_ticket TEXT,
    reserva_id UUID REFERENCES reservas(id),
    numero_reserva TEXT,
    habitacion_numero TEXT,
    habitacion_tipo TEXT,
    huesped_nombre TEXT NOT NULL,
    huesped_dni TEXT,
    fecha_entrada DATE,
    fecha_salida DATE,
    noches NUMERIC,
    precio_noche NUMERIC,
    subtotal NUMERIC,
    descuento NUMERIC DEFAULT 0,
    total NUMERIC NOT NULL,
    metodo_pago TEXT DEFAULT 'efectivo' CHECK (metodo_pago IN ('efectivo', 'yape', 'plin', 'transferencia', 'tarjeta')),
    estado_comprobante TEXT DEFAULT 'ticket_interno' CHECK (estado_comprobante IN ('ticket_interno', 'sunat_pendiente', 'sunat_emitido')),
    tipo_comprobante TEXT DEFAULT 'ninguno' CHECK (tipo_comprobante IN ('ninguno', 'boleta', 'factura')),
    ruc_cliente TEXT,
    razon_social TEXT,
    notas TEXT,
    fecha_pago DATE,
    created_date TIMESTAMPTZ DEFAULT NOW(),
    updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: config_hotel
-- ============================================================
CREATE TABLE IF NOT EXISTS config_hotel (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    hotel_id UUID REFERENCES hoteles(id) ON DELETE CASCADE,
    nombre_hotel TEXT NOT NULL,
    ruc TEXT,
    direccion TEXT,
    telefono TEXT,
    email TEXT,
    ciudad TEXT,
    modo_sunat TEXT DEFAULT 'manual' CHECK (modo_sunat IN ('manual', 'automatico', 'desactivado')),
    logo_url TEXT,
    mensaje_ticket TEXT DEFAULT '¡Gracias por su preferencia!',
    hora_checkin TEXT DEFAULT '14:00',
    hora_checkout TEXT DEFAULT '12:00',
    created_date TIMESTAMPTZ DEFAULT NOW(),
    updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: servicios_extra
-- ============================================================
CREATE TABLE IF NOT EXISTS servicios_extra (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    hotel_id UUID REFERENCES hoteles(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    categoria TEXT DEFAULT 'otros' CHECK (categoria IN ('bebidas', 'snacks', 'lacteos', 'higiene', 'licores', 'cigarros', 'otros', 'restaurante', 'bar', 'lavanderia', 'room_service', 'minibar')),
    precio NUMERIC NOT NULL,
    descripcion TEXT,
    disponible BOOLEAN DEFAULT true,
    emoji TEXT,
    stock INTEGER DEFAULT 99,
    created_date TIMESTAMPTZ DEFAULT NOW(),
    updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: ventas_pos
-- ============================================================
CREATE TABLE IF NOT EXISTS ventas_pos (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    hotel_id UUID REFERENCES hoteles(id) ON DELETE CASCADE,
    numero_ticket TEXT,
    tipo TEXT DEFAULT 'solo_extras' CHECK (tipo IN ('solo_extras', 'estadía_extras', 'solo_estadía')),
    habitacion_numero TEXT,
    huesped_nombre TEXT,
    huesped_dni TEXT,
    reserva_id UUID REFERENCES reservas(id),
    items JSONB DEFAULT '[]',
    subtotal_estadia NUMERIC DEFAULT 0,
    subtotal_extras NUMERIC DEFAULT 0,
    descuento NUMERIC DEFAULT 0,
    total NUMERIC NOT NULL,
    metodo_pago TEXT DEFAULT 'efectivo' CHECK (metodo_pago IN ('efectivo', 'yape', 'plin', 'transferencia', 'tarjeta')),
    estado_comprobante TEXT DEFAULT 'ticket_interno' CHECK (estado_comprobante IN ('ticket_interno', 'sunat_pendiente', 'sunat_emitido')),
    tipo_comprobante TEXT DEFAULT 'ninguno' CHECK (tipo_comprobante IN ('ninguno', 'boleta', 'factura')),
    ruc_cliente TEXT,
    razon_social TEXT,
    notas TEXT,
    fecha_venta DATE,
    created_date TIMESTAMPTZ DEFAULT NOW(),
    updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: codigos_desbloqueo
-- ============================================================
CREATE TABLE IF NOT EXISTS codigos_desbloqueo (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    codigo TEXT NOT NULL,
    usado BOOLEAN DEFAULT false,
    usado_por TEXT,
    descripcion TEXT,
    fecha_uso DATE,
    created_date TIMESTAMPTZ DEFAULT NOW(),
    updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: usuarios (perfil extendido de auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    role TEXT DEFAULT 'recepcionista',
    hotel_id UUID REFERENCES hoteles(id),
    created_date TIMESTAMPTZ DEFAULT NOW(),
    updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TRIGGER: Auto-create user profile on auth signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.usuarios (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- RLS Policies (básicas - sin restricciones por ahora)
-- El sistema maneja el multi-tenant a nivel de aplicación
-- ============================================================
ALTER TABLE hoteles ENABLE ROW LEVEL SECURITY;
ALTER TABLE habitaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_hotel ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicios_extra ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_pos ENABLE ROW LEVEL SECURITY;
ALTER TABLE codigos_desbloqueo ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas para usuarios autenticados
CREATE POLICY "allow_all_hoteles" ON hoteles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_habitaciones" ON habitaciones FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_reservas" ON reservas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_ventas" ON ventas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_config_hotel" ON config_hotel FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_servicios_extra" ON servicios_extra FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_ventas_pos" ON ventas_pos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_codigos_desbloqueo" ON codigos_desbloqueo FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_usuarios" ON usuarios FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Indices para performance
CREATE INDEX IF NOT EXISTS idx_habitaciones_hotel ON habitaciones(hotel_id);
CREATE INDEX IF NOT EXISTS idx_reservas_hotel ON reservas(hotel_id);
CREATE INDEX IF NOT EXISTS idx_reservas_estado ON reservas(estado);
CREATE INDEX IF NOT EXISTS idx_ventas_hotel ON ventas(hotel_id);
CREATE INDEX IF NOT EXISTS idx_ventas_created ON ventas(created_date DESC);
CREATE INDEX IF NOT EXISTS idx_servicios_hotel ON servicios_extra(hotel_id);
CREATE INDEX IF NOT EXISTS idx_ventas_pos_hotel ON ventas_pos(hotel_id);
CREATE INDEX IF NOT EXISTS idx_codigos_codigo ON codigos_desbloqueo(codigo);
CREATE INDEX IF NOT EXISTS idx_usuarios_hotel ON usuarios(hotel_id);
