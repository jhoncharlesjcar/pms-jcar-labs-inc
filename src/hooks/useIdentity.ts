import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/hooks/auth/useAuth';
import { toast } from 'sonner';

export interface IdentityResponse {
  success: boolean;
  source: 'CACHE' | 'API';
  data: {
    // Para DNI
    nombreCompleto?: string;
    nombres?: string;
    apellidoPaterno?: string;
    apellidoMaterno?: string;
    // Para RUC
    razonSocial?: string;
    estado?: string;
    condicion?: string;
    direccion?: string;
    numero: string;
  };
}

export function useIdentity() {
  const [loading, setLoading] = useState(false);
  const { user, hotelId: authHotelId } = useAuth();
  
  // Extraemos hotel_id del contexto global o usamos un fallback para evitar error 400
  const hotel_id = authHotelId || user?.hotel_id || '00000000-0000-0000-0000-000000000000';
  const usuario_id = user?.id || '00000000-0000-0000-0000-000000000000';

  const fetchIdentity = async (type: 'DNI' | 'RUC', documentNumber: string): Promise<IdentityResponse | null> => {
    if (!documentNumber) return null;
    if (type === 'DNI' && documentNumber.length !== 8) return null;
    if (type === 'RUC' && documentNumber.length !== 11) return null;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('identity', {
        body: {
          hotel_id,
          usuario_id,
          document_type: type,
          document_number: documentNumber
        }
      });

      if (error) {
        throw new Error(error.message || 'Error en Edge Function de Identidad');
      }

      if (data && data.success) {
        return data as IdentityResponse;
      } else {
        throw new Error(data?.error || 'Documento no encontrado o inválido');
      }
      
    } catch (err: any) {
      toast.error(`Error consultando ${type}: ${err.message}`);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { fetchIdentity, loadingIdentity: loading };
}
