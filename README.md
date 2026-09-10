# Internship Planner

A personalized career-management web app for keeping internship recruiting in one place.

I built this because applications, coffee chats, deadlines, tasks, and recruiting notes often end up scattered across spreadsheets, calendars, and notes apps. I wanted one workspace that brings the entire recruiting process together.

## Live Demo

https://build-eight-flax.vercel.app

Create an account to try the planner with your own private workspace.

## What It Does

- Track internship and job applications by role, company, deadline, and status
- Create custom role categories based on each user's recruiting goals
- Organize coffee chats and networking follow-ups
- Manage daily and weekly recruiting tasks
- Store recruiting notes in one place
- Open Google Calendar alongside recruiting activity
- Recover recently deleted planner items
- Undo and redo changes
- Import and export planner data as JSON backups
- Sync planner data privately across sessions
- Keep each authenticated user's planner data separate

## Tech Stack

- **React** — frontend UI and application state
- **Vite** — development and build tooling
- **Supabase Auth** — email/password authentication
- **Supabase Postgres** — cloud persistence
- **Row Level Security (RLS)** — user-level data isolation
- **Vercel** — production deployment
- **Lucide React** — interface icons

## Why I Built It

Recruiting becomes difficult to manage when information lives in several places: applications in a spreadsheet, networking conversations in notes, deadlines in a calendar, and tasks somewhere else.

I wanted to build a product around that workflow rather than another generic to-do list. The planner brings those pieces together while allowing each user to customize the types of roles they are recruiting for.

## Key Technical Decisions

### User-specific data

Each authenticated user has their own planner data in Supabase. Database Row Level Security policies restrict access so users can only access their own planner.

### Customizable recruiting workflows

Role categories are stored as part of each user's planner state rather than being permanently hard-coded, allowing users to tailor the product to areas such as consulting, product, software, finance, venture capital, or other career paths.

### Cloud synchronization

Planner changes are persisted to Supabase so users can access their workspace across sessions while maintaining separate authenticated accounts.

## Running Locally

Clone the repository:

```bash
git clone https://github.com/saraatrehann-sys/build.git
cd build