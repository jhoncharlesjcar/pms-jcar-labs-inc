/**
 * loyalty.service.ts — Servicio de Dominio para el Sistema de Fidelización por Puntos
 *
 * Contiene todas las funciones de cálculo, acumulación, redención manual,
 * reversión y expiración de puntos para huéspedes recurrentes por hotel.
 *
 * P0-5 FIX: Utiliza los RPCs atómicos de PostgreSQL (apply_loyalty_transaction,
 * create_loyalty_account) garantizando atomicidad y consistencia ACID.
 */

import { supabase } from '@/config/supabase';
import logger from '@/lib/logger';
import { generateUUID } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Constantes de Dominio
// ---------------------------------------------------------------------------

export const POINTS_PER_NIGHT = 10;
export const REDEMPTION_COST_POINTS = 100;
export const REDEMPTION_DISCOUNT_PERCENT = 0.50; // 50% de descuento en noche simple
export const EXPIRATION_MONTHS = 12;

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface LoyaltyAccount {
  id: string;
  hotel_id: string;
  guest_document_type: string;
  guest_document_number: string;
  guest_name: string;
  points_balance: number;
  last_stay_date: string;
  created_at: string;
  updated_at: string;
}

export type TransactionType = 'earned' | 'redeemed' | 'expired' | 'reversed';
export type ReferenceType = 'checkout' | 'redemption' | 'expiration_job' | 'cancellation';

export interface LoyaltyTransaction {
  id: string;
  operation_id: string;
  loyalty_account_id: string;
  hotel_id: string;
  type: TransactionType;
  points: number;
  reference_type: ReferenceType;
  reference_id?: string;
  nights_count?: number;
  created_by?: string;
  created_at: string;
}

export interface AccumulatePointsParams {
  hotelId: string;
  guestDocumentType?: string;
  guestDocumentNumber: string;
  guestName: string;
  nights: number;
  reservaId?: string;
  userId?: string;
}

export interface RedeemPointsParams {
  hotelId: string;
  guestDocumentType?: string;
  guestDocumentNumber: string;
  reservaId?: string;
  userId?: string;
  blocksToRedeem?: number; // 1 block = 100 pts
}

export interface ReversePointsParams {
  hotelId: string;
  guestDocumentNumber: string;
  reservaId?: string;
  userId?: string;
}

// ---------------------------------------------------------------------------
// Funciones Puras de Dominio
// ---------------------------------------------------------------------------

/**
 * Calcula los puntos ganados por cantidad de noches
 */
export function calculateEarnedPoints(nights: number): number {
  const n = Math.max(0, Math.floor(nights || 0));
  return n * POINTS_PER_NIGHT;
}

/**
 * Verifica si una habitación califica como "simple"
 */
export function isSimpleRoomType(roomType?: string): boolean {
  if (!roomType) return false;
  const normalized = roomType.toLowerCase().trim();
  return normalized.includes('simple') || normalized.includes('sencilla') || normalized.includes('individual');
}

/**
 * Evalúa si un huésped tiene derecho a redimir el descuento en habitación simple
 */
export function canRedeemSimpleDiscount(pointsBalance: number, roomType?: string): boolean {
  return (pointsBalance || 0) >= REDEMPTION_COST_POINTS && isSimpleRoomType(roomType);
}

/**
 * Calcula el monto del descuento sobre la tarifa de habitación simple
 */
export function calculateSimpleRoomDiscount(roomPricePerNight: number, nights: number, blocksToRedeem: number = 1): number {
  const price = Math.max(0, roomPricePerNight || 0);
  const n = Math.max(1, nights || 1);
  const singleNightCost = price * n;
  // 50% de descuento en el costo equivalente
  return Number((singleNightCost * REDEMPTION_DISCOUNT_PERCENT * blocksToRedeem).toFixed(2));
}

// ---------------------------------------------------------------------------
// Servicios de Persistencia (Supabase DB via RPC atómico)
// ---------------------------------------------------------------------------

/**
 * Obtiene o busca la cuenta de fidelidad de un huésped en un hotel específico
 */
export async function getLoyaltyAccount(
  hotelId: string,
  guestDocumentNumber: string,
  guestDocumentType: string = 'DNI'
): Promise<LoyaltyAccount | null> {
  if (!hotelId || !guestDocumentNumber) return null;

  try {
    const { data, error } = await supabase
      .from('loyalty_accounts')
      .select('*')
      .eq('hotel_id', hotelId)
      .eq('guest_document_type', guestDocumentType)
      .eq('guest_document_number', guestDocumentNumber.trim())
      .maybeSingle();

    if (error) {
      logger.error('Error fetching loyalty account:', error);
      return null;
    }
    return data;
  } catch (err) {
    logger.error('Exception fetching loyalty account:', err);
    return null;
  }
}

/**
 * Acumula puntos para un huésped al realizar Check-out de forma atómica vía RPC
 */
export async function accumulatePointsOnCheckout(params: AccumulatePointsParams): Promise<LoyaltyAccount | null> {
  const { hotelId, guestDocumentType = 'DNI', guestDocumentNumber, guestName, nights, reservaId } = params;
  if (!hotelId || !guestDocumentNumber || nights <= 0) return null;

  const pointsToEarn = calculateEarnedPoints(nights);
  const docNum = guestDocumentNumber.trim();
  const docType = guestDocumentType.trim() || 'DNI';
  const name = guestName?.trim() || 'Huésped';

  try {
    // 1. Obtener o crear cuenta de fidelidad con el RPC seguro
    let account = await getLoyaltyAccount(hotelId, docNum, docType);
    if (!account) {
      const { data: createdAccount, error: createError } = await supabase.rpc('create_loyalty_account', {
        p_document_type: docType,
        p_document_number: docNum,
        p_guest_name: name,
      });
      if (createError) throw createError;
      account = createdAccount;
    }

    if (!account?.id) {
      throw new Error('No se pudo resolver la cuenta de fidelidad para acumulación');
    }

    // 2. Aplicar transacción 'earned' atómica vía RPC
    const operationId = generateUUID();
    const { data: updatedAccount, error: txError } = await supabase.rpc('apply_loyalty_transaction', {
      p_operation_id: operationId,
      p_account_id: account.id,
      p_type: 'earned',
      p_points: pointsToEarn,
      p_reference_type: 'checkout',
      p_reference_id: reservaId || null,
      p_nights_count: nights,
    });

    if (txError) throw txError;
    return updatedAccount;
  } catch (err) {
    logger.error('Error in accumulatePointsOnCheckout (atomic RPC):', err);
    throw err;
  }
}

/**
 * Redime puntos para aplicar descuento de forma atómica vía RPC
 */
export async function redeemPointsOnCheckout(params: RedeemPointsParams): Promise<LoyaltyAccount | null> {
  const { hotelId, guestDocumentType = 'DNI', guestDocumentNumber, reservaId, blocksToRedeem = 1 } = params;
  if (!hotelId || !guestDocumentNumber) return null;

  const pointsToDeduct = REDEMPTION_COST_POINTS * blocksToRedeem;
  const docNum = guestDocumentNumber.trim();
  const docType = guestDocumentType.trim() || 'DNI';

  try {
    const account = await getLoyaltyAccount(hotelId, docNum, docType);
    if (!account || (account.points_balance || 0) < pointsToDeduct) {
      throw new Error(`Saldo insuficiente de puntos. Requeridos: ${pointsToDeduct}, Actual: ${account?.points_balance || 0}`);
    }

    // Aplicar transacción 'redeemed' atómica vía RPC
    const operationId = generateUUID();
    const { data: updatedAccount, error: txError } = await supabase.rpc('apply_loyalty_transaction', {
      p_operation_id: operationId,
      p_account_id: account.id,
      p_type: 'redeemed',
      p_points: -pointsToDeduct,
      p_reference_type: 'redemption',
      p_reference_id: reservaId || null,
      p_nights_count: null,
    });

    if (txError) throw txError;
    return updatedAccount;
  } catch (err) {
    logger.error('Error in redeemPointsOnCheckout (atomic RPC):', err);
    throw err;
  }
}

/**
 * Revierte puntos en caso de anulación de Check-out vía RPC
 */
export async function reversePointsOnCancellation(params: ReversePointsParams): Promise<boolean> {
  const { hotelId, guestDocumentNumber, reservaId } = params;
  if (!hotelId || !guestDocumentNumber || !reservaId) return false;

  try {
    const account = await getLoyaltyAccount(hotelId, guestDocumentNumber);
    if (!account) return false;

    // Buscar la transacción 'earned' original asociada a este reservaId
    const { data: txs, error: fetchErr } = await supabase
      .from('loyalty_transactions')
      .select('*')
      .eq('loyalty_account_id', account.id)
      .eq('reference_id', reservaId)
      .eq('type', 'earned');

    if (fetchErr || !txs || txs.length === 0) return false;

    const pointsToReverse = txs.reduce((sum, t) => sum + (t.points || 0), 0);
    if (pointsToReverse <= 0) return false;

    const operationId = generateUUID();
    const { error: rpcError } = await supabase.rpc('apply_loyalty_transaction', {
      p_operation_id: operationId,
      p_account_id: account.id,
      p_type: 'reversed',
      p_points: -pointsToReverse,
      p_reference_type: 'cancellation',
      p_reference_id: reservaId,
      p_nights_count: null,
    });

    if (rpcError) throw rpcError;
    return true;
  } catch (err) {
    logger.error('Error in reversePointsOnCancellation (atomic RPC):', err);
    return false;
  }
}
