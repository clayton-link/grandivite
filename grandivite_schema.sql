-- GRANDIVITE: Complete Database Schema
-- Run this in your Supabase SQL Editor to set up a fresh DB

create extension if not exists "uuid-ossp";

-- ORGANIZATIONS
create table if not exists organizations (
  id              uuid primary key default uuid_generate_v4(),
  slug            text unique,
  name            text not null,
  app_title       text,
  app_emoji       text default '🌿',
  primary_color   text default '#2C5F5A',
  accent_color    text default '#E07A5F',
  digest_greeting text default 'Hello from the family!',
  digest_footer   text default 'We love you and can''t wait to share these moments with you.',
  digest_signoff  text default 'With love, The Family',
  prompt_body     text,
  note_label      text default 'A Note for Our Recipients (Optional)',
  created_at      timestamptz default now()
);

-- ORG SETTINGS
create table if not exists org_settings (
  id                   serial primary key,
  org_id               uuid not null references organizations(id) on delete cascade,
  lookahead_days       integer default 60,
  auto_nudge_enabled   boolean default true,
  nudge_day_of_month   integer default 1,
  nudge_hour_utc       integer default 15,
  max_events_per_child integer default 2,
  min_notice_days      integer default 7,
  ideal_notice_days    integer default 14,
  importance_3_label   text default 'Milestone',
  importance_3_msg     text default 'This is a once-in-a-lifetime moment, we''d love you there.',
  importance_2_label   text default '1:1 Time',
  importance_2_msg     text default 'This is a chance for just you two, it would mean everything to them.',
  importance_1_label   text default 'Group Event',
  importance_1_msg     text default 'Come cheer with the whole family!',
  updated_at           timestamptz default now(),
  unique(org_id)
);

-- ORG MEMBERS
create table if not exists org_members (
  id           serial primary key,
  org_id       uuid not null references organizations(id) on delete cascade,
  email        text not null,
  display_name text,
  role         text not null check (role in ('owner','admin','editor','viewer')) default 'admin',
  is_active    boolean default true,
  created_at   timestamptz default now(),
  unique(org_id, email)
);

-- GROUPS
create table if not exists groups (
  id                 serial primary key,
  org_id             uuid not null references organizations(id) on delete cascade,
  name               text not null,
  color              text default '#2C5F5A',
  phone              text,
  active             boolean default true,
  sort_order         integer default 0,
  submission_cadence text default 'monthly' check (submission_cadence in ('monthly','quarterly','biannual')),
  created_at         timestamptz default now()
);

-- GROUP MEMBERS
create table if not exists group_members (
  id         serial primary key,
  group_id   integer not null references groups(id) on delete cascade,
  email      text not null,
  is_primary boolean default false,
  created_at timestamptz default now(),
  unique(group_id, email)
);

-- GROUP CHILDREN
create table if not exists group_children (
  id         serial primary key,
  group_id   integer not null references groups(id) on delete cascade,
  name       text not null,
  sort_order integer default 0,
  created_at timestamptz default now()
);

-- RECIPIENT GROUPS
create table if not exists recipient_groups (
  id              serial primary key,
  org_id          uuid not null references organizations(id) on delete cascade,
  label           text not null,
  receives_digest boolean default true,
  created_at      timestamptz default now()
);

-- RECIPIENTS
create table if not exists recipients (
  id                 serial primary key,
  recipient_group_id integer not null references recipient_groups(id) on delete cascade,
  name               text,
  email              text,
  phone              text,
  can_rsvp           boolean default true,
  created_at         timestamptz default now()
);

-- CYCLES
create table if not exists cycles (
  id          serial primary key,
  org_id      uuid not null references organizations(id) on delete cascade,
  month_label text not null,
  locked      boolean default false,
  digest_sent boolean default false,
  created_at  timestamptz default now()
);

-- EVENTS
create table if not exists events (
  id          serial primary key,
  cycle_id    integer not null references cycles(id) on delete cascade,
  family_id   integer references groups(id) on delete set null,
  family_name text,
  child_name  text,
  event_name  text,
  date        date,
  time        text,
  location    text,
  lat         double precision,
  lng         double precision,
  importance  integer default 1 check (importance between 1 and 3),
  notes       text,
  created_at  timestamptz default now()
);

-- RSVPS
create table if not exists rsvps (
  id         serial primary key,
  event_id   integer not null references events(id) on delete cascade,
  status     text check (status in ('yes','no','maybe')),
  updated_at timestamptz default now(),
  unique(event_id)
);

-- FAMILY RSVPS
create table if not exists family_rsvps (
  id         serial primary key,
  event_id   integer not null references events(id) on delete cascade,
  family_id  integer not null references groups(id) on delete cascade,
  status     text check (status in ('yes','no','maybe')),
  updated_at timestamptz default now(),
  unique(event_id, family_id)
);

-- AUDIT LOG
create table if not exists audit_log (
  id          serial primary key,
  org_id      uuid not null references organizations(id) on delete cascade,
  actor_email text,
  action      text not null,
  target_type text,
  target_id   text,
  payload     jsonb,
  created_at  timestamptz default now()
);

-- ROW LEVEL SECURITY
alter table organizations    enable row level security;
alter table org_settings     enable row level security;
alter table org_members      enable row level security;
alter table groups           enable row level security;
alter table group_members    enable row level security;
alter table group_children   enable row level security;
alter table recipient_groups enable row level security;
alter table recipients       enable row level security;
alter table cycles           enable row level security;
alter table events           enable row level security;
alter table rsvps            enable row level security;
alter table family_rsvps     enable row level security;
alter table audit_log        enable row level security;

-- POLICIES (drop then create, IF NOT EXISTS is not supported for policies)
do $$
declare t text;
begin
  foreach t in array array[
    'organizations','org_settings','org_members','groups','group_members',
    'group_children','recipient_groups','recipients','cycles','events',
    'rsvps','family_rsvps','audit_log'
  ] loop
    execute format('drop policy if exists "allow_all_%s" on %I;', t, t);
    execute format(
      'create policy "allow_all_%s" on %I for all using (true) with check (true);',
      t, t
    );
  end loop;
end $$;

-- INDEXES
create index if not exists idx_org_members_email      on org_members(email);
create index if not exists idx_org_members_org_id     on org_members(org_id);
create index if not exists idx_groups_org_id          on groups(org_id);
create index if not exists idx_cycles_org_id          on cycles(org_id);
create index if not exists idx_events_cycle_id        on events(cycle_id);
create index if not exists idx_audit_log_org_id       on audit_log(org_id);
create index if not exists idx_group_members_group_id on group_members(group_id);
