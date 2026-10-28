-- Campus Complaint and Grievance Management System
-- Run this complete script in Supabase Dashboard > SQL Editor.
-- Accounts are managed by Supabase Auth. Every new account receives the student role.
-- Promote a trusted account to admin manually using the SQL shown in README.md.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'student' check (role in ('student', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  complaint_code text not null unique default (
    'CMP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
  ),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title varchar(120) not null check (char_length(trim(title)) >= 3),
  category varchar(60) not null check (category in (
    'Classroom / Infrastructure', 'Hostel', 'Transport', 'Cleanliness',
    'Internet / IT', 'Fees / Administration', 'Academic', 'Safety / Security', 'Other'
  )),
  location varchar(120),
  description varchar(2000) not null check (char_length(trim(description)) >= 10),
  status text not null default 'Submitted' check (status in ('Submitted', 'In Progress', 'Resolved', 'Rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists complaints_user_id_idx on public.complaints(user_id);
create index if not exists complaints_status_idx on public.complaints(status);
create index if not exists complaints_created_at_idx on public.complaints(created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists complaints_set_updated_at on public.complaints;
create trigger complaints_set_updated_at
before update on public.complaints
for each row execute function public.set_updated_at();

-- Automatically create a student profile when Supabase Auth creates a user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1)),
    'student'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Enable RLS as defence in depth. The app uses a server-side service-role client,
-- so its API middleware is responsible for all application-level authorization.
alter table public.profiles enable row level security;
alter table public.complaints enable row level security;

-- No direct public/anon table policies are created. Do not expose the service-role key.
-- If direct browser-to-database access is added later, design and test policies first.
