-- OMNIS-X Migration 004: Authorized Supabase Realtime Publication
-- Sensitive student tables are explicitly excluded from Realtime broadcasts.

DO $$
DECLARE
    rt_table TEXT;
BEGIN
    FOREACH rt_table IN ARRAY ARRAY[
        'incidents',
        'conflicts',
        'infrastructure',
        'institutional_health',
        'notifications',
        'recovery_plans',
        'simulation_events'
    ]
    LOOP
        IF NOT EXISTS (
            SELECT 1
            FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename = rt_table
        ) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', rt_table);
        END IF;
    END LOOP;
END $$;
