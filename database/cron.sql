-- Run this in the Supabase SQL Editor after deploying Edge Functions.
-- Replace YOUR_PROJECT_REF with your actual Supabase project reference.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'embedding-worker',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://jkqkalodktcomicypjeb.supabase.co/functions/v1/embedding-worker',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true))
  );
  $$
);

SELECT cron.schedule(
  'match-worker',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://jkqkalodktcomicypjeb.supabase.co/functions/v1/match-worker',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true))
  );
  $$
);
