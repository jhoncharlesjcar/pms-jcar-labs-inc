import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateCronJob, errorResponse } from "../_shared/auth-middleware.ts";

declare const Deno: any;

Deno.serve(async (req: Request) => {
  const cron = authenticateCronJob(req);
  if (!cron.valid) return errorResponse(cron.error || "Unauthorized", 403);
  try {
    const db = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");
    const cutoff = new Date();
    cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1);
    const cutoffDate = cutoff.toISOString().slice(0, 10);
    const { data: accounts, error } = await db.from("loyalty_accounts")
      .select("id").lt("last_stay_date", cutoffDate).gt("points_balance", 0);
    if (error) throw error;
    let expiredCount = 0;
    for (const account of accounts || []) {
      const { data: expired, error: expireError } = await db.rpc("expire_loyalty_account", {
        p_account_id: account.id,
        p_cutoff_date: cutoffDate,
        p_operation_id: crypto.randomUUID(),
      });
      if (expireError) {
        console.error("[LOYALTY] Expiration failed:", account.id, expireError.code);
        continue;
      }
      if (expired) expiredCount++;
    }
    return Response.json({ success: true, expiredCount, totalProcessed: accounts?.length || 0 });
  } catch (error) {
    console.error("[LOYALTY] Expiration job failed:", error);
    return errorResponse("Expiration job failed", 500);
  }
});
