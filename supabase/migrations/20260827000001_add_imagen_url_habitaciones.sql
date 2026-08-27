-- Agregar columna imagen_url a tabla habitaciones
ALTER TABLE public.habitaciones
ADD COLUMN IF NOT EXISTS imagen_url TEXT;

-- Actualizar la vista de habitaciones si es necesario
-- (Si hay vistas que dependen de SELECT *, se actualizan solas si no están tipadas estrictamente, 
-- pero por si acaso, no solemos necesitar recrear vistas simples)
