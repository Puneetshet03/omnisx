# Supabase PostgreSQL Setup Guide — OMNIS-X

## 1. Create Supabase Project & Retrieve Keys

1. Create a free Supabase project at https://supabase.com.
2. Open **Project Settings → API** and copy:
   - `Project URL` (`SUPABASE_URL` / `VITE_SUPABASE_URL`)
   - `anon` / `publishable` key (`SUPABASE_ANON_KEY` / `VITE_SUPABASE_ANON_KEY`)
   - `service_role` / `secret` key (`SUPABASE_SERVICE_ROLE_KEY` — **backend only, never expose in frontend**)

## 2. Configure Environment Files

Copy templates and fill in your credentials:

- `backend/.env` (from `backend/.env.example`):
  ```env
  SUPABASE_URL=https://YOUR_PROJECT.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
  SUPABASE_ANON_KEY=your_anon_key
  APP_ENV=development
  FRONTEND_URL=http://localhost:5173
  ```
- `frontend/.env` (from `frontend/.env.example`):
  ```env
  VITE_API_URL=http://localhost:8000
  VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
  VITE_SUPABASE_ANON_KEY=your_anon_key
  ```

## 3. Execute SQL Migrations

In Supabase **SQL Editor**, execute the migration scripts in exact order:

1. `supabase/migrations/001_create_tables.sql`
2. `supabase/migrations/002_constraints_indexes.sql`
3. `supabase/migrations/003_rls_policies.sql`
4. `supabase/migrations/004_realtime.sql`
5. `supabase/migrations/005_recovery_functions.sql`
6. `supabase/seed.sql`

## 4. Seed Supporting Resources & Import 200 Students

Run in `backend/`:

```bat
.\.venv\Scripts\python.exe seed_resources.py
.\.venv\Scripts\python.exe import_students.py
```

`seed_resources.py` populates derived and labeled `synthetic_supporting` tables, and `import_students.py` batch-upserts all 200 students from `data/omnis_x_200_students(1).csv` while preserving `cgpa` (50), `hostel_room` (135), and `bus_route` (65) missing values as PostgreSQL `NULL`.
