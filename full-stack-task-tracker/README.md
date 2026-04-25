# Full Stack Task Tracker

A small runnable scaffold that matches the playground tutorial: Express backend, JWT auth, protected task routes, and a browser dashboard.

## What it includes

- Register and login endpoints with JWT auth.
- Protected task CRUD endpoints.
- An in-memory demo account so you can log in immediately.
- A vanilla browser UI that stores the token in `localStorage`, filters tasks, and syncs the URL.

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Demo Account

- Email: `demo@tasktracker.dev`
- Password: `demo123`

## API Routes

- `GET /api/health`
- `POST /api/register`
- `POST /api/login`
- `GET /api/me`
- `GET /api/projects`
- `GET /api/tasks`
- `POST /api/tasks`
- `PATCH /api/tasks/:id`
- `DELETE /api/tasks/:id`

## Notes

- Change `JWT_SECRET` before using the scaffold outside local development.
- The store is in memory for simplicity; swapping in a database is the natural next step.