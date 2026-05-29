-- Users are managed by Supabase Auth; this table extends each user's profile.
create table public.profiles (
  id uuid references auth.users primary key,
  email text not null,
  full_name text,
  avatar_url text,
  jira_domain text,
  jira_email text,
  jira_api_token text,
  google_calendar_token jsonb,
  follow_up_recipients text[],        -- comma-separated list stored as array
  created_at timestamptz default now()
);

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles not null,
  recall_bot_id text,
  platform text check (platform in ('zoom', 'google_meet')),
  title text,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds int,
  status text check (status in (
    'scheduled', 'recording', 'processing',
    'transcribing', 'analysing', 'complete', 'failed'
  )) default 'scheduled',
  error_message text,
  created_at timestamptz default now()
);

create table public.transcripts (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references public.meetings not null,
  full_text text not null,
  speakers jsonb,
  word_count int,
  created_at timestamptz default now()
);

create table public.meeting_summaries (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references public.meetings not null unique,
  summary text not null,
  key_decisions text[],
  follow_up_email text,
  created_at timestamptz default now()
);

create table public.action_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references public.meetings not null,
  title text not null,
  description text,
  assignee text,
  due_date date,
  priority text check (priority in ('low', 'medium', 'high')),
  jira_ticket_id text,
  jira_ticket_url text,
  status text check (status in ('pending', 'ticket_created', 'failed')) default 'pending',
  created_at timestamptz default now()
);

-- Indexes for common query patterns
create index meetings_user_id_idx on public.meetings (user_id);
create index meetings_recall_bot_id_idx on public.meetings (recall_bot_id);
create index action_items_meeting_id_idx on public.action_items (meeting_id);
create index transcripts_meeting_id_idx on public.transcripts (meeting_id);

-- RLS: enable on all tables so users only see their own data
alter table public.profiles enable row level security;
alter table public.meetings enable row level security;
alter table public.transcripts enable row level security;
alter table public.meeting_summaries enable row level security;
alter table public.action_items enable row level security;

-- Profiles: users can only read/write their own profile
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- Meetings: users can only see their own meetings
create policy "meetings_select_own" on public.meetings
  for select using (auth.uid() = user_id);

create policy "meetings_insert_own" on public.meetings
  for insert with check (auth.uid() = user_id);

create policy "meetings_update_own" on public.meetings
  for update using (auth.uid() = user_id);

-- Transcripts: accessible if the parent meeting belongs to the user
create policy "transcripts_select_own" on public.transcripts
  for select using (
    exists (
      select 1 from public.meetings m
      where m.id = transcripts.meeting_id and m.user_id = auth.uid()
    )
  );

create policy "transcripts_insert_own" on public.transcripts
  for insert with check (
    exists (
      select 1 from public.meetings m
      where m.id = meeting_id and m.user_id = auth.uid()
    )
  );

-- Meeting summaries: same pattern as transcripts
create policy "summaries_select_own" on public.meeting_summaries
  for select using (
    exists (
      select 1 from public.meetings m
      where m.id = meeting_summaries.meeting_id and m.user_id = auth.uid()
    )
  );

create policy "summaries_insert_own" on public.meeting_summaries
  for insert with check (
    exists (
      select 1 from public.meetings m
      where m.id = meeting_id and m.user_id = auth.uid()
    )
  );

-- Action items: same pattern
create policy "action_items_select_own" on public.action_items
  for select using (
    exists (
      select 1 from public.meetings m
      where m.id = action_items.meeting_id and m.user_id = auth.uid()
    )
  );

create policy "action_items_insert_own" on public.action_items
  for insert with check (
    exists (
      select 1 from public.meetings m
      where m.id = meeting_id and m.user_id = auth.uid()
    )
  );

create policy "action_items_update_own" on public.action_items
  for update using (
    exists (
      select 1 from public.meetings m
      where m.id = action_items.meeting_id and m.user_id = auth.uid()
    )
  );

-- Enable realtime so the dashboard receives live status updates
alter publication supabase_realtime add table public.meetings;
alter publication supabase_realtime add table public.action_items;

-- Auto-create a profile row whenever a new user signs up via Auth
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
