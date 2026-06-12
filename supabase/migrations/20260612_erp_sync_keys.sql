-- ERP sync keys: run in Supabase SQL editor (or via supabase db push).
-- Links dashboard rows to legacy Manilal ERP records.

alter table airops_vessels
  add column if not exists erp_rtno text;

create unique index if not exists airops_vessels_erp_rtno_key
  on airops_vessels (erp_rtno)
  where erp_rtno is not null;

alter table airops_containers
  add column if not exists erp_key text;

create unique index if not exists airops_containers_erp_key_key
  on airops_containers (erp_key)
  where erp_key is not null;

-- jobs are keyed inside the JSONB payload
create unique index if not exists airops_jobs_erp_exptno_key
  on airops_jobs ((data->>'erp_exp_number'))
  where data->>'erp_exp_number' is not null;
