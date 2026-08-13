-- Migration: add facturacion tables
-- Path: supabase/migrations/20260701000000_add_facturacion_tables.sql

-- Table: comprobantes
CREATE TABLE IF NOT EXISTS public.comprobantes (
    id BIGSERIAL PRIMARY KEY,
    hotel_id UUID NOT NULL REFERENCES public.hoteles(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL,
    serie TEXT NOT NULL,
    numero TEXT NOT NULL,
    cliente_tipo TEXT,
    cliente_documento TEXT,
    cliente_nombre TEXT,
    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
    igv NUMERIC(12,2) NOT NULL DEFAULT 0,
    total NUMERIC(12,2) NOT NULL DEFAULT 0,
    estado TEXT NOT NULL DEFAULT 'pendiente',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table: comprobante_detalle
CREATE TABLE IF NOT EXISTS public.comprobante_detalle (
    id BIGSERIAL PRIMARY KEY,
    comprobante_id BIGINT REFERENCES public.comprobantes(id) ON DELETE CASCADE,
    descripcion TEXT NOT NULL,
    cantidad INTEGER NOT NULL,
    precio_unitario NUMERIC(12,2) NOT NULL,
    subtotal NUMERIC(12,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED
);

-- Table: comprobante_xml
CREATE TABLE IF NOT EXISTS public.comprobante_xml (
    id BIGSERIAL PRIMARY KEY,
    comprobante_id BIGINT REFERENCES public.comprobantes(id) ON DELETE CASCADE,
    xml TEXT,
    hash TEXT,
    xml_firmado TEXT,
    zip BYTEA
);

-- Table: sunat_envios
CREATE TABLE IF NOT EXISTS public.sunat_envios (
    id BIGSERIAL PRIMARY KEY,
    comprobante_id BIGINT REFERENCES public.comprobantes(id) ON DELETE CASCADE,
    ticket TEXT,
    estado TEXT,
    fecha_envio TIMESTAMP WITH TIME ZONE DEFAULT now(),
    respuesta TEXT
);

-- Table: cdr
CREATE TABLE IF NOT EXISTS public.cdr (
    id BIGSERIAL PRIMARY KEY,
    comprobante_id BIGINT REFERENCES public.comprobantes(id) ON DELETE CASCADE,
    codigo TEXT,
    descripcion TEXT,
    archivo_xml TEXT
);

-- Trigger to notify Edge Function when a new pending comprobante is inserted
CREATE OR REPLACE FUNCTION notify_facturacion_pending() RETURNS trigger AS $$
BEGIN
    IF NEW.estado = 'pendiente' THEN
        PERFORM pg_notify('facturacion_pending', NEW.id::text);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_facturacion_pending ON public.comprobantes;
CREATE TRIGGER trg_notify_facturacion_pending
AFTER INSERT OR UPDATE ON public.comprobantes
FOR EACH ROW EXECUTE FUNCTION notify_facturacion_pending();

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_comprobantes_estado ON public.comprobantes (estado);
CREATE INDEX IF NOT EXISTS idx_sunat_envios_ticket ON public.sunat_envios (ticket);
