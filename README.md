# Arth

`Arth` is a personal finance app built with React + Vite and now prepared for:

- 🌐 **Web deployment**
- 🖥️ **Desktop app packaging** with Electron
- ☁️ **Shared login + data sync** between web and desktop with Supabase

## Run locally

```bash
npm install
npm run dev
```

## Run as a desktop app

```bash
npm run desktop
```

## Build the desktop Windows bundle

```bash
npm run desktop:build
```

The packaged desktop app is created in `release/Arth-win32-x64/`.

## Enable shared login + sync

1. Copy `.env.example` to `.env`
2. Fill in your Supabase project values:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

3. In Supabase, enable Email/Password auth.
4. Run this SQL in the Supabase SQL editor:

```sql
create table if not exists public.user_snapshots (
  user_id uuid primary key references auth.users (id) on delete cascade,
  snapshot jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_snapshots enable row level security;

create policy "Users can read their own snapshot"
on public.user_snapshots
for select
using (auth.uid() = user_id);

create policy "Users can insert their own snapshot"
on public.user_snapshots
for insert
with check (auth.uid() = user_id);

create policy "Users can update their own snapshot"
on public.user_snapshots
for update
using (auth.uid() = user_id);
```

## In-app usage

Open `Settings` → **Cloud & Desktop** and sign in with the **same email/password** on both the web app and the desktop app.

> Your **PIN stays device-local** for safety, while your finance data syncs through the signed-in cloud account.
