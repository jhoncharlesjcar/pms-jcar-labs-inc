/**
 * useLoyalty.ts — Hook para consultar y ejecutar operaciones de Fidelidad por Huésped y Hotel
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getLoyaltyAccount,
  accumulatePointsOnCheckout,
  redeemPointsOnCheckout,
  canRedeemSimpleDiscount,
  isSimpleRoomType,
  calculateSimpleRoomDiscount,
} from '@/services/loyalty.service';
import type { AccumulatePointsParams, RedeemPointsParams } from '@/services/loyalty.service';
import { toast } from 'sonner';

export function useLoyaltyAccount(hotelId?: string, documentNumber?: string) {
  return useQuery({
    queryKey: ['loyalty-account', hotelId, documentNumber],
    queryFn: () => getLoyaltyAccount(hotelId!, documentNumber!),
    enabled: !!hotelId && !!documentNumber && documentNumber.trim().length > 3,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
}

export function useLoyaltyMutations() {
  const qc = useQueryClient();

  const accumulate = useMutation({
    mutationFn: (params: AccumulatePointsParams) => accumulatePointsOnCheckout(params),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['loyalty-account', variables.hotelId, variables.guestDocumentNumber] });
      toast.success('Puntos acumulados', {
        description: `El huésped ha ganado puntos por su estadía.`,
      });
    },
  });

  const redeem = useMutation({
    mutationFn: (params: RedeemPointsParams) => redeemPointsOnCheckout(params),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['loyalty-account', variables.hotelId, variables.guestDocumentNumber] });
      toast.success('Puntos redimidos exitosamente', {
        description: `Se han descontado 100 puntos y aplicado el 50% de descuento.`,
      });
    },
    onError: (err: any) => {
      toast.error('Error al redimir puntos', {
        description: err?.message || 'No se pudo redimir los puntos.',
      });
    },
  });

  return {
    accumulate,
    redeem,
    canRedeemSimpleDiscount,
    isSimpleRoomType,
    calculateSimpleRoomDiscount,
  };
}
