# Team Task Manager

An average, clean full-stack app for projects, tasks, and role-based access (Admin/Member).

## What It Does
- Email/password auth with JWT cookies
- Role-based access (Admin vs Member)
- Projects and team membership
- Task creation, assignment, and status tracking
- Dashboard with status and overdue counts
- REST API under `/api`

## Tech Stack
- Node.js + Express
- EJS server-rendered views
- SQLite (file-based DB)
- JWT in httpOnly cookies

## Roles
- Admin: create/delete projects, manage members, delete tasks
- Member: view projects they belong to, create tasks in those projects, update own task status

## Local Setup
1. Install dependencies (Node.js 22+ required):
   ```bash
   npm install
   ```
2. Create `.env` from `.env.example` and set `JWT_SECRET`.
3. Seed an admin user:
   ```bash
   npm run seed:admin
   ```
4. Start the app:
   ```bash
   npm run dev
   ```

## Default Admin (from .env.example)
- Email: admin@example.com
- Password: admin123

## Environment Variables
- `PORT` - default 3000
- `JWT_SECRET` - required in production
- `DATABASE_PATH` - default `./data/app.db`
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` - used by the seed script

## UI Routes
- `/login` - login (role selection required)
- `/signup` - create account (role selection required)
- `/dashboard` - summary + upcoming tasks
- `/projects` - list + create projects (Admin only)
- `/projects/:id` - project detail, members, tasks
- `/tasks` - tasks assigned to you

## REST API (Highlights)
- `GET /api/dashboard`
- `GET /api/projects`
- `POST /api/projects` (Admin)
- `GET /api/projects/:id`
- `POST /api/projects/:id/members` (Admin)
- `GET /api/tasks`
- `POST /api/tasks`
- `PATCH /api/tasks/:id`
- `DELETE /api/tasks/:id` (Admin)

## Deployment Notes (Railway)
- Use a persistent volume and set `DATABASE_PATH` to the mounted path (example: `/data/app.db`).
- Set `JWT_SECRET` to a strong value.
- Run `npm run seed:admin` once to create the admin user.

## Scripts
- `npm run dev` - development server
- `npm start` - production server
- `npm run seed:admin` - create or promote the admin user

## Troubleshooting
- If you see an SQLite warning on startup, it is expected for `node:sqlite` in Node 22+.
