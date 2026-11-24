-- Lehrer-Cockpit: Grundschema
-- Die App arbeitet local-first (IndexedDB). Supabase dient als Sync-Ziel und Backup.
-- Jeder Datensatz liegt als JSON in "records", gruppiert nach collection.

-- Alte Prototyp-Objekte entfernen
drop view if exists public.student_last_observed;
drop table if exists public.action_items cascade;
drop table if exists public.transcripts cascade;
drop table if exists public.observations cascade;
drop table if exists public.students cascade;
drop table if exists public.classes cascade;
drop type if exists public.observation_category;
drop function if exists public.set_updated_at() cascade;

create table public.records (
  id uuid not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  collection text not null,
  data jsonb not null,
  deleted boolean not null default false,
  updated_at timestamptz not null,
  synced_at timestamptz not null default now(),
  primary key (user_id, collection, id)
);

create index records_pull_idx on public.records (user_id, synced_at);

alter table public.records enable row level security;

create policy "own records select" on public.records
  for select to authenticated using (user_id = (select auth.uid()));
create policy "own records insert" on public.records
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own records update" on public.records
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own records delete" on public.records
  for delete to authenticated using (user_id = (select auth.uid()));

-- synced_at bei jedem Schreiben neu setzen (Grundlage für den Pull)
create or replace function public.records_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.synced_at := now();
  return new;
end $$;

create trigger records_touch before insert or update on public.records
  for each row execute function public.records_touch();

-- Anhänge (Fotos, Skizzen, Sprachmemos): privater Bucket, Pfad beginnt mit der User-ID
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

create policy "own attachments select" on storage.objects
  for select to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own attachments insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own attachments update" on storage.objects
  for update to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own attachments delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
