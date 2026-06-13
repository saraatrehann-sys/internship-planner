# Career OS

A personal, dark-mode career operating system for managing internship applications, recruiting timelines, sponsorship fit, skill growth, networking, projects, and weekly execution.

## Information Architecture

- Command: high-signal daily dashboard with active applications, interviews, near-term deadlines, and open actions.
- Applications: drag-and-drop board organized by Watchlist, Applied, Interview, Offer, and Archived.
- Calendar: deadline timeline with Google Calendar event links.
- Skills: progress roadmap by career role.
- Plan: daily routine and weekly priorities.
- Network: lightweight relationship and follow-up log.
- Projects: portfolio proof tracker.

## Core Flows

- Filter by role focus to narrow every view to Product, Consulting, Software, Finance, or all tracks.
- Update an application in seconds by changing its status or dragging it to another lane.
- Add a new opportunity from the quick-entry bar.
- Send deadline events to Google Calendar from application cards or timeline rows.
- Mark daily and weekly tasks complete from the command or planning views.
- Export/import JSON backups for portable personal data.

## Storage

Data can sync privately through Supabase Auth and a `planner_data` table. If Supabase environment variables are not set, the app still works locally in the browser with JSON import/export backups.

## Supabase Setup

Create a Supabase project, then run this SQL in the Supabase SQL editor:

```sql
create table if not exists public.planner_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.planner_data enable row level security;

create policy "Users can read own planner data"
on public.planner_data
for select
using (auth.uid() = user_id);

create policy "Users can insert own planner data"
on public.planner_data
for insert
with check (auth.uid() = user_id);

create policy "Users can update own planner data"
on public.planner_data
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

Copy `.env.example` to `.env` and fill in your Supabase project URL and anon key:

```bash
cp .env.example .env
```

## Run

```bash
npm install --cache .npm-cache
npm run dev
```
