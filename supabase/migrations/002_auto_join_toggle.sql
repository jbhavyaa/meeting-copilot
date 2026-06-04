-- Add auto-join toggle to profiles
alter table public.profiles
  add column if not exists auto_join_meetings boolean default false;
