-- Sync-Cursor robuster: Echtzeit statt Transaktionsbeginn, Keyset-Index (synced_at, id)
create or replace function public.records_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.synced_at := clock_timestamp();
  return new;
end $$;

drop index if exists public.records_pull_idx;
create index if not exists records_pull_idx on public.records (user_id, synced_at, id);
