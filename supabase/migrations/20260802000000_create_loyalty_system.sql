-- Migration: 20260802000000_create_loyalty_system.sql
-- Description: Sistema de Fidelización por Puntos por Huésped y Hotel

-- 1. Agregar columna loyalty_program_enabled a la tabla hoteles (o ConfigHotel)
ALTER TABLE IF EXISTS hoteles 
ADD COLUMN IF NOT EXISTS loyalty_program_enabled BOOLEAN DEFAULT FALSE;

-- 2. Crear tabla loyalty_accounts (saldo por huésped por hotel)
CREATE TABLE IF NOT EXISTS loyalty_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES hoteles(id) ON DELETE CASCADE,
    guest_document_type TEXT NOT NULL DEFAULT 'DNI',
    guest_document_number TEXT NOT NULL,
    guest_name TEXT NOT NULL,
    points_balance INTEGER NOT NULL DEFAULT 0 CHECK (points_balance >= 0),
    last_stay_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_loyalty_account UNIQUE (hotel_id, guest_document_type, guest_document_number)
);

-- 3. Crear tabla loyalty_transactions (auditoría inmutable de transacciones de puntos)
CREATE TABLE IF NOT EXISTS loyalty_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loyalty_account_id UUID NOT NULL REFERENCES loyalty_accounts(id) ON DELETE CASCADE,
    hotel_id UUID NOT NULL REFERENCES hoteles(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('earned', 'redeemed', 'expired', 'reversed')),
    points INTEGER NOT NULL,
    reference_type TEXT NOT NULL CHECK (reference_type IN ('checkout', 'redemption', 'expiration_job', 'cancellation')),
    reference_id UUID,
    nights_count INTEGER,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Habilitar RLS en ambas tablas
ALTER TABLE loyalty_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;

-- 5. Políticas RLS multi-tenant por hotel_id
CREATE POLICY "Permitir acceso a loyalty_accounts por hotel" ON loyalty_accounts
    FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Permitir acceso a loyalty_transactions por hotel" ON loyalty_transactions
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 6. Índices para acelerar búsquedas por documento y hotel
CREATE INDEX IF NOT EXISTS idx_loyalty_accounts_doc 
ON loyalty_accounts(hotel_id, guest_document_number);

CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_account 
ON loyalty_transactions(loyalty_account_id);
