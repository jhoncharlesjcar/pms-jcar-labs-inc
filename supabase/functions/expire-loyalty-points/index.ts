// @ts-nocheck — Supabase Edge Function (Deno runtime)
// Supabase Edge Function: expire-loyalty-points
// Expira los puntos de cuentas inactivas por más de 12 meses (Regla 5)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

Deno.serve(async (req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Obtener fecha de corte (hace 12 meses)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
    const cutoffDate = twelveMonthsAgo.toISOString().split('T')[0];

    // 2. Buscar cuentas inactivas con puntos > 0
    const { data: inactiveAccounts, error: fetchError } = await supabase
      .from('loyalty_accounts')
      .select('id, hotel_id, points_balance, guest_document_number')
      .lt('last_stay_date', cutoffDate)
      .gt('points_balance', 0);

    if (fetchError) throw fetchError;

    if (!inactiveAccounts || inactiveAccounts.length === 0) {
      return new Response(
        JSON.stringify({ success: true, expiredCount: 0, message: 'No hay cuentas inactivas para expirar.' }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    let expiredCount = 0;

    // 3. Procesar expiración por cada cuenta
    for (const account of inactiveAccounts) {
      const pointsToExpire = account.points_balance;

      // Descontar saldo a 0
      const { error: updateError } = await supabase
        .from('loyalty_accounts')
        .update({ points_balance: 0, updated_at: new Date().toISOString() })
        .eq('id', account.id);

      if (updateError) {
        console.error(`Error al expirar cuenta ${account.id}:`, updateError);
        continue;
      }

      // Registrar transacción de expiración inmutable
      await supabase.from('loyalty_transactions').insert({
        loyalty_account_id: account.id,
        hotel_id: account.hotel_id,
        type: 'expired',
        points: -pointsToExpire,
        reference_type: 'expiration_job',
      });

      expiredCount++;
    }

    return new Response(
      JSON.stringify({ success: true, expiredCount, totalProcessed: inactiveAccounts.length }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Error en Edge Function expire-loyalty-points:', err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
