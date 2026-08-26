CREATE OR REPLACE VIEW public.v_ai_hotel_metrics AS
SELECT
  c.hotel_id,
  COUNT(DISTINCT c.id) AS total_conversations,
  COUNT(DISTINCT c.id) FILTER (WHERE c.status NOT IN ('closed', 'abandoned')) AS opportunities,
  COUNT(DISTINCT q.id) AS total_quotes,
  COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'booked') AS reservations,
  COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'paid' AND p.reservation_id IS NOT NULL), 0) AS revenue,
  CASE WHEN COUNT(DISTINCT c.id) > 0
    THEN ROUND((COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'booked')::numeric / COUNT(DISTINCT c.id)) * 100, 1)
    ELSE 0
  END AS conversion_rate
FROM public.ai_conversations c
LEFT JOIN public.ai_quotes q ON q.hotel_id = c.hotel_id
LEFT JOIN public.ai_payment_intents p ON p.hotel_id = c.hotel_id
GROUP BY c.hotel_id;

ALTER VIEW public.v_ai_hotel_metrics OWNER TO postgres;
GRANT SELECT ON public.v_ai_hotel_metrics TO authenticated;
