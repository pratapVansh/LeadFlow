# LeadFlow

A small lead management app built with Next.js, TypeScript, Tailwind CSS, FastAPI, and PostgreSQL. The dashboard and dialogs follow the three reference images retained in this folder.

## Run with Docker

Install Docker Desktop with Linux containers and Docker Compose. From the project root, run:

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
docker compose up --build -d --wait
docker compose ps
```

Copy the example only on first setup; preserve an existing `.env`.

- App: http://localhost:3000
- Interactive API documentation: http://localhost:8000/docs
- Database health: http://localhost:8000/api/health
- PostgreSQL: localhost:5433, database/user/password `leadflow` by default.

The frontend forwards `/api` requests to FastAPI, so browser requests use the same origin. Published Docker ports bind to localhost. Backend startup creates the schema and seeds an empty database. Database and backend health checks control startup order.

```powershell
docker compose logs --tail 100 backend frontend
docker compose stop
docker compose up -d --wait
```

Stopping or recreating containers preserves the named PostgreSQL volume. To remove containers while preserving data, use `docker compose down`.

## Use the app

- Search by lead name and select a status filter. Both apply to today's follow-ups and the main list.
- Click **Add New Lead**, enter a name, and save. Company and phone are optional; new leads start as New.
- Click a lead to open its timeline without leaving the dashboard. Change status directly, or add a discussion note.
- Enable scheduling to choose a future date and time. Both fields are required when enabled.
- Click **Clear follow-up** beside the active schedule in a lead's timeline after completing the follow-up. No discussion note is required; discussion history stays intact.

Dates and today's follow-ups use the browser's local time zone; the database stores UTC instants. Past-due follow-ups appear in red. Each lead has one active schedule. A note without a new schedule preserves it; a new schedule replaces it while preserving historical discussion schedules. Status changes also preserve schedules, including Won and Lost. Successful saves update the UI immediately; failed saves retain your inputs.

## Configuration

Root `.env` is the single source of shared credentials, database names, and published ports for Docker and local development. Root `.env.example` is the only application template; copy it once without overwriting an existing `.env`. Local environment files are ignored by Git and excluded from Docker images. Backend/frontend environment files are no longer needed.

| Variable | Purpose |
| --- | --- |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Shared PostgreSQL credentials and application database |
| `POSTGRES_TEST_DB` | Separate, empty test database; its name must end in `_test` |
| `POSTGRES_PORT` | Host database port; default 5433 avoids a common conflict on 5432 |
| `FRONTEND_PORT`, `BACKEND_PORT` | Host HTTP ports; default 3000 and 8000 |

Addresses are mapped explicitly rather than copied into multiple files:

| Connection | Docker | Local development |
| --- | --- | --- |
| Backend to PostgreSQL | `db:5432` | `localhost:POSTGRES_PORT` |
| Next.js to FastAPI | `http://backend:8000` | `http://localhost:BACKEND_PORT` |
| Frontend HTTP server | Internal 3000, published as `FRONTEND_PORT` | `127.0.0.1:FRONTEND_PORT` |
| Backend HTTP server | Internal 8000, published as `BACKEND_PORT` | `127.0.0.1:BACKEND_PORT` |

The backend loads the root file by absolute path for local processes. Compose injects the same PostgreSQL settings plus the Docker host/port mapping. SQLAlchemy constructs the application and test database URLs safely from raw credentials, including passwords with URL-special characters; do not store or manually encode complete URLs. Quote passwords containing `#` or `$` with single quotes. Root values are literal, not references to other environment variables.

The frontend npm launcher reads root configuration, selects the ports it needs, computes the local API address, and passes no PostgreSQL settings or database URLs to the Next.js child process. It also removes inherited database settings from the child's environment. Docker supplies the API address directly, so its frontend never needs the root file. Browser requests remain `/api` in both modes. Do not copy root `.env` into the frontend or use `NEXT_PUBLIC_*` for credentials.

Shell/process variables override shared file values. Missing/empty required settings and invalid local ports fail clearly. `DATABASE_URL` and `TEST_DATABASE_URL` are no longer configuration inputs; the backend derives URL objects. `API_INTERNAL_URL` is injected by the frontend launcher or Docker. Do not retain legacy application `.env` files as a second configuration source.

The root `.env` in this workspace retains the verified credentials of the existing database. Changing PostgreSQL initialization settings does not update an already initialized volume. Preserve current credentials for existing data; credential rotation requires updating the database role explicitly and then updating root credentials. This configuration change does not rotate passwords, delete the volume, or reset data.

Change shared ports only in root `.env`, then restart local processes or rerun `docker compose up -d --wait`. Docker service-to-service ports remain fixed. Next.js production rewrites are built with the selected API address; rebuild the frontend if that address changes.

## Local development

Use Python 3.12 and Node.js 22.12 or newer; the Docker images use Python 3.12 and Node.js 22. The commands below use PowerShell and a virtual environment without requiring activation.

From the root, copy `.env.example` to `.env` once, then start PostgreSQL:

```powershell
docker compose up -d --wait db
```

If the full Docker app is already running, stop its HTTP services to free ports for local processes:

```powershell
docker compose stop frontend backend
```

In a backend terminal:

```powershell
Set-Location backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m app.seed
.\.venv\Scripts\python.exe -m app.local
```

The local launcher uses root `BACKEND_PORT` and enables Uvicorn reload. Seed and test commands use the same root settings automatically; no backend `.env` is required.

In a separate terminal from the root:

```powershell
Set-Location frontend
npm ci
npm run dev
```

The npm launcher derives the API address from root `BACKEND_PORT` and serves Next.js on root `FRONTEND_PORT`. `npm run build` and `npm start` use the same mapping locally. No frontend `.env.local` is required, and no database credentials are passed to Next.js.

Run `npm ci` on the operating system where you will run Node. Native dependency binaries differ between Windows and Linux containers.

## Seed data

The seed contains six leads, one for each status, with three discussions each. It includes today's, overdue, future, and unscheduled follow-ups, relative to the first seed run. Seed data is added only when the leads table is empty. Restarting the backend preserves existing leads and skips seeding; it does not refresh dates each day. Consequently, today's seeded follow-ups can become overdue on later days.

To run the seed manually with Docker:

```powershell
docker compose exec -T backend python -m app.seed
```

## Tests and checks

Backend tests use real PostgreSQL with per-test transaction rollback. Create the separate test database **once**, after starting Compose:

```powershell
docker compose exec -T db createdb -U leadflow leadflow_test
```

An existing test database does not need to be recreated. Both runtimes derive the test connection from `POSTGRES_TEST_DB` and shared credentials; run:

```powershell
docker compose exec -T backend python -m pytest -q
docker compose exec -T backend python -m pip check
docker compose config --quiet
```

The `createdb` example uses the sample PostgreSQL user and test database name. If your configuration differs, use `POSTGRES_USER` and `POSTGRES_TEST_DB`. The test runner refuses the application database, a name without the `_test` suffix, or a database containing leads. Never point tests at application data.

For local backend tests, from `backend` after installing dependencies:

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

From `frontend`, after installing dependencies on your host:

```powershell
npm test
npm run typecheck
npm run build
```

The frontend runtime image contains the production build, rather than test source files. Run frontend tests from the source directory. `docker compose build` also runs the frontend production build and its TypeScript checks.

Tests cover validation, status/history writes, rollback, seeding, local environment loading, process-variable precedence, missing configuration, local-day and daylight-saving boundaries, filtering, immediate state updates, and API errors. Chromium checks cover actual database-backed dialog saves, failed requests, keyboard focus, responsive layouts, reloads, and restart persistence. Browser tools and screenshots are kept in ignored `.test-artifacts`; they are not app dependencies.

Verified after the root configuration refactor: 66 backend tests, 59 frontend tests, independent TypeScript checking, Docker and local production builds, Docker startup, and Chromium checks through both Docker and local API mappings. Full application data and credentials remained unchanged; the test database is empty. Details are recorded in `PLAN.md`.

Local development and production startup checks ran in Linux containers using the documented Python/npm commands. The check backend used `POSTGRES_HOST=host.docker.internal` to access the published host database port, while backend/frontend shared a network namespace for localhost API requests. Native Windows servers were not run; install dependencies on Windows before using its virtual environment or Node binaries.

The pinned Starlette/HTTPX TestClient combination emits an upstream deprecation warning; the backend tests still pass.

## API

Full request/response schemas are available at `/docs` and `/openapi.json` on the backend.

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/api/health` | Check database connectivity |
| GET | `/api/leads` | Dashboard summaries, ordered by latest discussion or creation time |
| POST | `/api/leads` | Create a New lead; required `name`, optional `company`/`phone` |
| GET | `/api/leads/{id}` | Details and reverse chronological discussions |
| PATCH | `/api/leads/{id}` | Update `status` and return details |
| DELETE | `/api/leads/{id}/follow-up` | Clear the active follow-up and return details; preserve discussion history |
| POST | `/api/leads/{id}/discussions` | Save `note` and optional `follow_up_at` atomically; return details |

Status values: `new`, `contacted`, `qualified`, `proposal_sent`, `won`, `lost`. Names and company values allow 200 characters, phone 50, and notes 5,000. Blank names/notes, unknown fields, invalid statuses, and non-future or offset-free follow-up timestamps return 422. Missing leads return 404. Database failures return a generic 503 and roll back writes.

## Project layout and scope

- `frontend/app`: page, layout, and shared styling.
- `frontend/components`: dashboard, cards, status badges, shared native modal, and both dialogs.
- `frontend/lib`: API calls, types, date handling, lead state helpers, and unit tests.
- `backend/app`: database models, validation, routes, error handlers, and seed data.
- `backend/tests`: PostgreSQL-backed API and data tests.
- `compose.yaml`, Dockerfiles, `.env.example`: local runtime and configuration.
- `PLAN.md`: implementation phases and verification record.

This is a local assessment app without authentication, pagination, deletion, notifications, or multi-user synchronization. SQLAlchemy creates the initial schema; later schema changes need explicit migrations. Dashboard queries load discussion histories for a small dataset; larger datasets need pagination and narrower queries. Browser verification used Chromium; Firefox and Safari have not been checked.

## Reset data

The following commands permanently delete this Compose project's database volume, including every lead and discussion. Use them only when you intend to discard all data and start again:

```powershell
docker compose down -v
docker compose up --build -d --wait
```

The new empty database receives the six seed leads. This destructive reset was not run against the application database during verification.
