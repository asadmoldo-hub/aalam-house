-- Триггерные функции журнала не должны вызываться через REST API.
-- Сами триггеры продолжают работать: права EXECUTE для них не нужны.
revoke execute on function public.log_lead_activity() from anon, authenticated, public;
revoke execute on function public.log_booking_activity() from anon, authenticated, public;
revoke execute on function public.set_updated_at() from anon, authenticated, public;
