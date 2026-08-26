-- Eliminar columnas de hora duplicadas
ALTER TABLE public.hoteles DROP COLUMN IF EXISTS check_in_hora;
ALTER TABLE public.hoteles DROP COLUMN IF EXISTS check_out_hora;

-- Verificar que credenciales ya están en vault privado y nullear las originales
UPDATE public.hoteles SET 
    sunat_clave_sol = NULL,
    sunat_certificado_pem = NULL,
    pasarela_private_key = NULL
WHERE sunat_clave_sol IS NOT NULL 
   OR sunat_certificado_pem IS NOT NULL 
   OR pasarela_private_key IS NOT NULL;

-- Agregar comentarios de deprecación
COMMENT ON COLUMN public.hoteles.sunat_usuario_sol IS 'DEPRECATED — migrado a hotel_secrets vía configure-hotel-secrets edge function';
COMMENT ON COLUMN public.hoteles.sunat_clave_sol IS 'DEPRECATED — siempre NULL, credenciales en vault privado';
COMMENT ON COLUMN public.hoteles.pasarela_private_key IS 'DEPRECATED — siempre NULL, credenciales en vault privado';
