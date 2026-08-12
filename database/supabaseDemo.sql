-- ==========================================
-- PMS JCAR LABS — ESQUEMA COMPLETO DE BASE DE DATOS
-- Copia todo este código y ejecútalo en el SQL Editor de Supabase
-- ==========================================

-- 1. Habilitar la extensión gen_random_uuid si no está activa
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Limpieza de tablas existentes para alineación total
DROP TABLE IF EXISTS productos CASCADE;
DROP TABLE IF EXISTS categorias_productos CASCADE;
DROP TABLE IF EXISTS ventas_pos CASCADE;
DROP TABLE IF EXISTS egresos CASCADE;
DROP TABLE IF EXISTS cierres_caja CASCADE;
DROP TABLE IF EXISTS reservas CASCADE;
DROP TABLE IF EXISTS ventas CASCADE;
DROP TABLE IF EXISTS habitaciones CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;
DROP TABLE IF EXISTS hoteles CASCADE;

-- 3. Tabla Hoteles
CREATE TABLE hoteles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre       text NOT NULL,
  created_at   timestamp with time zone DEFAULT now(),
  created_date timestamp with time zone DEFAULT now()
);

-- 4. Tabla Usuarios
CREATE TABLE usuarios (
  id         uuid PRIMARY KEY, -- Enlazado con auth.users(id)
  email      text UNIQUE NOT NULL,
  full_name  text,
  role       text DEFAULT 'recepcionista',
  hotel_id   uuid REFERENCES hoteles(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- 5. Tabla Habitaciones
CREATE TABLE habitaciones (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id     uuid REFERENCES hoteles(id) ON DELETE CASCADE,
  numero       text NOT NULL,
  piso         text,
  tipo         text DEFAULT 'simple',
  estado       text DEFAULT 'disponible',
  precio       numeric DEFAULT 80,
  descripcion  text,
  created_date timestamp with time zone DEFAULT now(),
  UNIQUE(hotel_id, numero)
);

-- 6. Tabla Reservas (Alineada 100% con los campos del formulario React)
CREATE TABLE reservas (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id            uuid REFERENCES hoteles(id) ON DELETE CASCADE,
  habitacion_id       uuid REFERENCES habitaciones(id) ON DELETE SET NULL,
  habitacion_numero   text,
  habitacion_tipo     text,
  huesped_nombre      text,
  huesped_dni         text,
  huesped_telefono    text,
  huesped_procedencia text,
  nacionalidad        text DEFAULT 'Peruana',
  motivo_viaje        text DEFAULT 'turismo',
  fecha_entrada       date,
  fecha_salida        date,
  noches              integer DEFAULT 1,
  precio_noche        numeric DEFAULT 0,
  total               numeric DEFAULT 0,
  num_adultos         integer DEFAULT 1,
  num_ninos           integer DEFAULT 0,
  observaciones       text,
  estado              text DEFAULT 'activa', -- 'pendiente', 'activa', 'finalizada', 'cancelada'
  numero_reserva      text,
  created_date        timestamp with time zone DEFAULT now()
);

-- 7. Tabla Ventas (Ingresos por hospedaje directos)
CREATE TABLE ventas (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id          uuid REFERENCES hoteles(id) ON DELETE CASCADE,
  habitacion_numero text,
  huesped_nombre    text,
  numero_ticket     text,
  metodo_pago       text DEFAULT 'efectivo',
  fecha_pago        timestamp with time zone DEFAULT now(),
  total             numeric NOT NULL,
  created_date      timestamp with time zone DEFAULT now()
);

-- 8. Tabla Categorías de Productos
CREATE TABLE categorias_productos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id     uuid REFERENCES hoteles(id) ON DELETE CASCADE,
  nombre       text NOT NULL,
  created_date timestamp with time zone DEFAULT now(),
  UNIQUE(hotel_id, nombre)
);

-- 9. Tabla Productos (Minimarket)
CREATE TABLE productos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id      uuid REFERENCES hoteles(id) ON DELETE CASCADE,
  categoria_id  uuid REFERENCES categorias_productos(id) ON DELETE SET NULL,
  nombre        text NOT NULL,
  precio_venta  numeric NOT NULL DEFAULT 0,
  stock         integer NOT NULL DEFAULT 0,
  activo        boolean DEFAULT true,
  created_date  timestamp with time zone DEFAULT now()
);

-- 10. Tabla Ventas POS (Punto de Venta Minimarket / Consumos)
CREATE TABLE ventas_pos (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id           uuid REFERENCES hoteles(id) ON DELETE CASCADE,
  numero_ticket      text,
  tipo               text, -- 'solo_extras', 'solo_estadia', 'estadia_extras'
  habitacion_numero  text,
  huesped_nombre     text,
  huesped_dni        text,
  reserva_id         uuid REFERENCES reservas(id) ON DELETE SET NULL,
  items              jsonb DEFAULT '[]'::jsonb,
  subtotal_estadia   numeric DEFAULT 0,
  subtotal_extras    numeric DEFAULT 0,
  descuento          numeric DEFAULT 0,
  total              numeric DEFAULT 0,
  metodo_pago        text,
  estado_comprobante text,
  tipo_comprobante   text,
  ruc_cliente        text,
  razon_social       text,
  notas              text,
  fecha_venta        timestamp with time zone DEFAULT now(),
  created_date       timestamp with time zone DEFAULT now()
);

-- 11. Tabla Egresos (Caja chica / Gastos operativos)
CREATE TABLE egresos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id       uuid REFERENCES hoteles(id) ON DELETE CASCADE,
  monto          numeric NOT NULL,
  concepto       text NOT NULL,
  categoria      text NOT NULL,
  fecha          timestamp with time zone DEFAULT now(),
  usuario_id     uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  usuario_nombre text,
  created_date   timestamp with time zone DEFAULT now()
);

-- 12. Tabla Cierres de Caja
CREATE TABLE cierres_caja (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id       uuid REFERENCES hoteles(id) ON DELETE CASCADE,
  fecha          timestamp with time zone DEFAULT now(),
  total_ventas   numeric DEFAULT 0,
  total_egresos  numeric DEFAULT 0,
  saldo_final    numeric DEFAULT 0,
  usuario_id     uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  usuario_nombre text,
  created_date   timestamp with time zone DEFAULT now()
);

-- 13. Insertar Hotel Demo por defecto
INSERT INTO hoteles (id, nombre) VALUES
('11111111-1111-1111-1111-111111111111', 'JCAR LABS Hotel Demo')
ON CONFLICT (id) DO NOTHING;
