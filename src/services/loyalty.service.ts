/**
 * loyalty.service.ts — Servicio de Dominio para el Sistema de Fidelización por Puntos
 *
 * Contiene todas las funciones de cálculo, acumulación, redención manual,
 * reversión y expiración de puntos para huéspedes recurrentes por hotel.
 */

import { supabase } from '@/lib/supabaseClient';
import logger from '@/lib/logger';

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
// Servicios de Persistencia (Supabase DB)
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
 * Acumula puntos para un huésped al realizar Check-out
 */
export async function accumulatePointsOnCheckout(params: AccumulatePointsParams): Promise<LoyaltyAccount | null> {
  const { hotelId, guestDocumentType = 'DNI', guestDocumentNumber, guestName, nights, reservaId, userId } = params;
  if (!hotelId || !guestDocumentNumber || nights <= 0) return null;

  const pointsToEarn = calculateEarnedPoints(nights);
  const docNum = guestDocumentNumber.trim();
  const today = new Date().toISOString().split('T')[0];

  try {
    // 1. Obtener o crear cuenta de fidelidad
    const existing = await getLoyaltyAccount(hotelId, docNum, guestDocumentType);
    let accountId: string;
    let newBalance: number;

    if (existing) {
      accountId = existing.id;
      newBalance = (existing.points_balance || 0) + pointsToEarn;

      const { error: updateError } = await supabase
        .from('loyalty_accounts')
        .update({
          points_balance: newBalance,
          last_stay_date: today,
          guest_name: guestName || existing.guest_name,
          updated_at: new Date().toISOString(),
        })
        .eq('id', accountId);

      if (updateError) throw updateError;
    } else {
      newBalance = pointsToEarn;
      const { data: created, error: createError } = await supabase
        .from('loyalty_accounts')
        .insert({
          hotel_id: hotelId,
          guest_document_type: guestDocumentType,
          guest_document_number: docNum,
          guest_name: guestName || 'Huésped',
          points_balance: newBalance,
          last_stay_date: today,
        })
        .select()
        .single();

      if (createError) throw createError;
      accountId = created.id;
    }

    // 2. Registrar transacción inmutable 'earned'
    const { error: txError } = await supabase
      .from('loyalty_transactions')
      .insert({
        loyalty_account_id: accountId,
        hotel_id: hotelId,
        type: 'earned',
        points: pointsToEarn,
        reference_type: 'checkout',
        reference_id: reservaId || null,
        nights_count: nights,
        created_by: userId || null,
      });

    if (txError) logger.error('Error inserting earned transaction:', txError);

    return await getLoyaltyAccount(hotelId, docNum, guestDocumentType);
  } catch (err) {
    logger.error('Error in accumulatePointsOnCheckout:', err);
    throw err;
  }
}

/**
 * Redime puntos para aplicar descuento (Acción Manual)
 */
export async function redeemPointsOnCheckout(params: RedeemPointsParams): Promise<LoyaltyAccount | null> {
  const { hotelId, guestDocumentType = 'DNI', guestDocumentNumber, reservaId, userId, blocksToRedeem = 1 } = params;
  if (!hotelId || !guestDocumentNumber) return null;

  const pointsToDeduct = REDEMPTION_COST_POINTS * blocksToRedeem;
  const docNum = guestDocumentNumber.trim();

  try {
    const account = await getLoyaltyAccount(hotelId, docNum, guestDocumentType);
    if (!account || (account.points_balance || 0) < pointsToDeduct) {
      throw new Error(`Saldo insuficiente de puntos. Requeridos: ${pointsToDeduct}, Actual: ${account?.points_balance || 0}`);
    }

    const newBalance = account.points_balance - pointsToDeduct;

    // 1. Descontar saldo
    const { error: updateError } = await supabase
      .from('loyalty_accounts')
      .update({
        points_balance: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq('id', account.id);

    if (updateError) throw updateError;

    // 2. Registrar transacción 'redeemed'
    const { error: txError } = await supabase
      .from('loyalty_transactions')
      .insert({
        loyalty_account_id: account.id,
        hotel_id: hotelId,
        type: 'redeemed',
        points: -pointsToDeduct,
        reference_type: 'redemption',
        reference_id: reservaId || null,
        created_by: userId || null,
      });

    if (txError) logger.error('Error inserting redeemed transaction:', txError);

    return await getLoyaltyAccount(hotelId, docNum, guestDocumentType);
  } catch (err) {
    logger.error('Error in redeemPointsOnCheckout:', err);
    throw err;
  }
}

/**
 * Revierte puntos en caso de anulación de Check-out
 */
export async function reversePointsOnCancellation(params: ReversePointsParams): Promise<boolean> {
  const { hotelId, guestDocumentNumber, reservaId, userId } = params;
  if (!hotelId || !guestDocumentNumber) return false;

  try {
    const account = await getLoyaltyAccount(hotelId, guestDocumentNumber);
    if (!account) return false;

    // Buscar la transacción 'earned' original asociada a este reservaId
    const { data: txs } = await supabase
      .from('loyalty_transactions')
      .select('*')
      .eq('loyalty_account_id', account.id)
      .eq('reference_id', reservaId)
      .eq('type', 'earned');

    if (!txs || txs.length === 0) return false;

    const pointsToReverse = txs.reduce((sum, t) => sum + (t.points || 0), 0);
    const newBalance = Math.max(0, account.points_balance - pointsToReverse);

    await supabase
      .from('loyalty_accounts')
      .update({ points_balance: newBalance, updated_at: new Date().toISOString() })
      .eq('id', account.id);

    await supabase
      .from('loyalty_transactions')
      .insert({
        loyalty_account_id: account.id,
        hotel_id: hotelId,
        type: 'reversed',
        points: -pointsToReverse,
        reference_type: 'cancellation',
        reference_id: reservaId || null,
        created_by: userId || null,
      });

    return true;
  } catch (err) {
    logger.error('Error in reversePointsOnCancellation:', err);
    return false;
  }
}
