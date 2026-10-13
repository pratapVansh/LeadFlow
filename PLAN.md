# LeadFlow Implementation Plan

Build a small, single-page lead management application in approximately eight focused hours. Complete and verify each phase before starting the next. Update the checklist below as work progresses.

## Progress

- ✓ Inspect the three reference images and agree on follow-up behavior.
- ✓ Write this implementation plan.
- ✓ Phase 1: Finish the project scaffold, dependencies, and Docker configuration.
- ✓ Phase 2: Finish and test the database, API, and seed data.
- ✓ Phase 3: Build and verify the dashboard.
- ✓ Phase 4: Build and verify both dialogs.
- ✓ Phase 5: Run integration checks and finish the README.

### Current checkpoint: All five phases complete and verified

- Resolved dependency and Docker access issues using permitted standalone Docker commands. Dependencies and verification run inside Linux containers with Node.js 22 and Python 3.12.
- Installed frontend dependencies and generated a matching `package-lock.json`. The frontend Dockerfile now uses `npm ci` exclusively.
- Pinned backend runtime dependencies and verified imports/OpenAPI with the intended Psycopg 3 driver. `pip check` reports no broken requirements.
- Updated Vitest to the patched 5.x release after inspecting dependency audit findings. The updated frontend audit reports zero vulnerabilities.
- Passed frontend `npm run typecheck` and the production `npm run build` inside the Docker image.
- Passed Compose configuration validation, built both application images, and started all three services with `docker compose up -d --wait`.
- Verified production frontend HTTP 200, the Next.js `/api` rewrite, database health, and six persisted seeded leads through actual HTTP requests from the frontend container.
- Phase 1 is fully verified. No permission prompt was needed for the working Docker commands.
- Phase 2 is fully verified: all 53 pytest cases passed against a separate PostgreSQL 16 test database. Tests cover lead creation and limits, optional fields, all statuses, invalid payloads, missing leads, latest summaries, history ordering/ties, schedule preservation/replacement, timestamp validation, error handling, failed-write rollback, database constraints, and non-destructive repeated seeding.
- Tightened timestamp validation to reject numeric strings and numeric values instead of allowing implicit Unix timestamp conversion. Failed writes explicitly roll back in the request database dependency.
- Verified exact lead summaries remained identical across PostgreSQL and backend restarts. All six seed leads retain three discussions each; startup reports that existing leads were preserved and seeding was skipped.
- Verified the test database contains zero leads and zero discussions after the suite, proving transaction cleanup.
- The test suite emits one upstream `StarletteDeprecationWarning` for HTTPX-based TestClient usage; all assertions pass. The test runner uses the pinned HTTPX version and does not start a public test server.
- Phase 3 is fully verified. The production frontend now displays the reference-based dashboard with all seven filters, case-insensitive name search, today's follow-ups, red overdue indicators, last discussion notes, and relative discussion ages.
- Search and status filters apply to both sections. Today's schedules sort by due time, appear once, and move into the main list after local midnight. Relative ages and overdue indicators refresh every minute.
- All 28 frontend tests passed: 13 date/time tests, 12 filtering/partitioning tests, and three API tests. Tests cover local midnight, year boundaries, daylight-saving changes, overdue equality, age formatting, every status, combined search/filter behavior, duplicate prevention, and API failures.
- Frontend type-check and the updated production Docker build passed. Inspected Chromium screenshots at 1920px and 375px against the dashboard reference.
- Browser checks passed against the six real API leads and controlled response fixtures: all filters, search in both sections, keyboard filtering, loading, empty database/results, failed requests with Retry recovery, and automatic minute refresh. There were no browser JavaScript errors.
- Verified no horizontal overflow at 375px or at 320px with maximum-length lead/company names. Corrected an inherited font rule so controls retain Tailwind's intended 14px sizing.
- Browser test tooling and screenshots are isolated in ignored `.test-artifacts`; no application dependencies were added for browser checks. Screenshots are `phase3-desktop.png` and `phase3-mobile.png`.
- Phase 4 is fully verified. Add New Lead now opens the form, and clicking a lead opens its timeline without navigation. Both dialogs match the supplied references and adapt to narrow screens.
- Native dialogs provide an inert backdrop, body scroll locking, Escape/Cancel controls, explicit Tab/Shift+Tab wrapping, and restoration of focus to the opener or the Add New Lead button when a filtered card disappears. Dismissal and other writes are disabled while a save is pending.
- Required names/notes are trimmed and checked; optional company/phone values become null. Saves use the existing API and update dashboard summaries from returned lead details. Successful creation clears search/status filters so the new lead is visible.
- Status and note writes are serialized. Failed writes preserve the status or draft inputs; successful notes clear only the composer. Saving without a new schedule preserves the active follow-up, and replacing it leaves historical schedules intact.
- Added browser-local scheduling validation, UTC conversion, and rejection of nonexistent daylight-saving times. Ambiguous fall-back times use the browser's first occurrence.
- All 46 frontend tests passed: 22 date/time tests, 15 lead-state tests, and nine API tests. Production builds and TypeScript checks passed.
- Chromium end-to-end checks passed through a separate Next.js/FastAPI stack backed by `leadflow_phase4_test`: real lead creation, all statuses, notes, schedule replacement/preservation, reload persistence, duplicate prevention, retained failed forms, loading/retry states, empty timelines, keyboard behavior, and 375px/320px layouts. An independent PostgreSQL connection confirmed persisted records.
- Deployed the updated local Compose frontend. Rechecked the dashboard and opened both dialogs on desktop/mobile against the production API without sending writes. Production data remains six leads and 18 discussions. Screenshots are `phase4-add-desktop.png`, `phase4-timeline-desktop.png`, `phase4-add-mobile.png`, and `phase4-timeline-mobile.png` in ignored `.test-artifacts`.
- Phase 5 is complete. Added README instructions for Docker, local development, environment variables, seed behavior, guarded test database setup, checks, API documentation, persistence, scope, and an explicitly destructive reset command.
- Final verification passed: 53 PostgreSQL-backed backend tests, 46 frontend tests, independent TypeScript checking, dependency consistency, Compose configuration validation, and the previously verified production build. The fresh acceptance build reused the unchanged production build layers.
- Started a separate, freshly initialized `leadflow-acceptance` Compose project with its own network, volume, and host ports. All three services started; six leads and 18 discussions were seeded. Verified database health, API documentation, and Next.js proxy requests.
- Real Chromium interactions created an additional lead, changed its status, saved a discussion and future schedule, and verified a page reload. Recreated all three containers and compared every summary and full detail against the saved snapshot: all seven leads and 19 discussions, statuses, schedules, and timestamps remained identical. Existing data was not reseeded or overwritten.
- Confirmed the application database still contains six leads and 18 discussions. The isolated acceptance containers were removed after verification; their database volume was retained. The regular local application remains running.
- Reference comparison and desktop/mobile dialog checks were completed in Phases 3–4. No application changes were needed for Phase 5.
- Verification used Linux containers because host dependency networking is restricted. Native Windows local-development commands were documented but not run end-to-end. Additional dotenv subprocess checks were denied Docker access; dotenv CLI availability was verified earlier. Firefox and Safari were not checked. The one upstream HTTPX TestClient warning remains.

### Verified commands

```powershell
# Run from the LeadFlow root.
docker compose config --quiet
docker compose build
docker compose up -d --wait
docker compose exec -T backend python -m pip check

# Create the separate test database once; do not drop or recreate application data.
docker compose exec -T db createdb -U leadflow leadflow_test

# Compose injects shared PostgreSQL settings; the backend derives the test URL.
docker compose exec -T backend python -m pytest -q
```

The image build runs `npm ci` and `npm run build`. Frontend `npm run typecheck` was also run independently with Node.js 22 in a container mounted to the frontend directory. If PostgreSQL credentials or database names are changed, update root configuration and use the configured user/test database in the creation command.

### Environment configuration follow-up (superseded by the root refactor below)

- ✓ Reviewed all repository environment references, application entrypoints, fixtures, Docker build contexts, and setup instructions.
- ✓ Created root `.env` using the verified existing PostgreSQL credentials. Updated root `.env.example` for Docker service addresses, and required explicit Compose settings instead of credential/port fallbacks.
- ✓ Created backend `.env.example` and local `.env` for host database/test URLs. The backend loads its own file without overriding process variables and rejects a missing or empty `DATABASE_URL`.
- ✓ Created frontend `.env.example` and local `.env.local` containing only the local API address. Docker build/runtime API settings come from root `.env`; no database credentials are passed to the frontend.
- ✓ Updated Git ignore rules, README, frontend Dockerfile, and Next.js configuration. Existing Docker ignore files already exclude environment files; runtime checks confirmed none are present in either image.
- ✓ Added four backend environment tests and four frontend rewrite-configuration tests. All 57 backend tests and 50 frontend tests passed; independent TypeScript checking and the production build passed.
- ✓ Validated normal Compose settings and intentional failure with an empty environment file. Started the rebuilt services successfully, authenticated through the published PostgreSQL port using local backend settings, and verified Next.js local environment loading and the Docker API proxy.
- ✓ Compared complete summaries and lead details before and after the update. All six leads and 18 discussions, timestamps, schedules, statuses, and credentials remained identical. The separate test database contains zero leads and zero discussions.
- Verification used Linux containers, including a host-gateway connection for the local PostgreSQL port. Native Windows development servers were not started. The existing upstream HTTPX TestClient warning remains; no database reset or credential rotation was performed.

### Root environment refactor

- ✓ Reduced application configuration to root `.env` and root `.env.example`: shared PostgreSQL user/password, application/test database names, and published database/backend/frontend ports. Removed duplicated database/API URLs while retaining all current credentials, database names, and ports.
- ✓ Compose passes shared PostgreSQL values only to the database/backend and explicitly maps backend connections to `db:5432`. The frontend receives only `http://backend:8000`; Docker service ports stay fixed while published ports come from root configuration.
- ✓ The local backend loads root configuration by absolute path without overriding process values. SQLAlchemy builds URLs from raw credentials, preserving URL-special characters and literal dollar references. The test fixture uses the derived test URL and retains its separate, empty `_test` database guard.
- ✓ Added `python -m app.local` to bind Uvicorn to root `BACKEND_PORT`. Frontend npm scripts derive localhost API/HTTP ports from root configuration and remove inherited database settings before launching Next.js. No new dependencies were added.
- ✓ Verified old application files contained only settings identical to the root-derived mappings before removing `backend/.env`, `backend/.env.example`, `frontend/.env.local`, and `frontend/.env.example`. Updated Git ignore rules, README, Compose, Docker frontend packaging, and configuration tests.
- ✓ All 66 backend tests and 59 frontend tests passed. Independent TypeScript checks, the Docker production build, dependency consistency, normal Compose configuration, and intentional rejection of missing settings passed. The initial production build caught a TypeScript inference issue in the launcher tests; corrected its parameter type and verified the rebuilt application.
- ✓ Started the documented local backend and frontend development commands in Linux containers. The backend used root credentials and the published database port, with `POSTGRES_HOST=host.docker.internal` solely to reach the host from the check container. A shared network namespace allowed the frontend to call `localhost:8000`. Real Chromium checks passed for database health, the localhost API proxy, six leads, and both dialogs without writes or browser errors.
- ✓ Inspected the running local Next.js server environment and confirmed it contains the API address and no PostgreSQL settings/database URLs. One read-only Docker process inspection required sandbox escalation and then passed.
- ✓ Built the frontend locally using root settings without a Docker API override, started it with `npm start`, and repeated the browser/API checks successfully. Rechecked the deployed Compose dialogs on desktop/mobile. Temporary local-check containers were removed; the normal Docker application remains running.
- ✓ Compared full application summaries and details with the pre-refactor snapshot, including credentials, schedules, timestamps, histories, and statuses. All six leads and 18 discussions remained identical; the separate test database is empty. The PostgreSQL volume and database role were preserved.
- Rollback requires restoring the previous application/configuration files and rebuilding the HTTP services; preserve the existing PostgreSQL role and named volume throughout. No schema migration, database reset, or credential rotation was needed.
- Local startup and production checks ran in Linux containers, not native Windows processes. Firefox/Safari were not checked. The existing upstream HTTPX TestClient warning remains.

Implementation started before this file was written. Existing frontend configuration and backend modules were retained, completed, and verified through the phases above.

## Requirements and decisions

- Frontend: Next.js App Router, TypeScript, and Tailwind CSS.
- Backend: FastAPI with synchronous SQLAlchemy 2 sessions and Psycopg 3.
- Database: PostgreSQL; use PostgreSQL 16 in Docker.
- Use React state, browser `fetch`, native controls, and native `<dialog>`. Do not add a component framework or state-management library.
- Each lead has one active follow-up. A note without a follow-up preserves the current schedule; a note with a follow-up replaces it.
- Store timestamps in UTC. Scheduling, display, and the definition of today use the browser's local time zone.
- New leads always start with the New status.
- Status changes preserve follow-up schedules, including transitions to Won or Lost.
- Apply name search and status filters to both dashboard sections. Display each lead once.
- Do not add authentication, pagination, deletion, contact editing, notifications, follow-up completion controls, deployment, or multi-user synchronization.
- This is an unauthenticated local assessment application. Bind Docker ports to localhost.
- Publish PostgreSQL on host port 5433 by default because an existing PostgreSQL service occupies 5432. Container-to-container connections still use 5432.

## Visual references

- `LandingPage-PravarAI.png`: white header, blue branding and button, light gray background, centered column approximately 1,000 pixels wide, pill filters, compact cards, and highlighted follow-ups.
- `AddLead-PravarAI.png`: centered dialog approximately 450 pixels wide with name, optional company, optional phone, and Cancel/Save actions.
- `EditLead-PravarAI.png`: timeline dialog approximately 670 pixels wide with contact details, status selector, reverse chronological discussions, and a note composer with optional follow-up date and time.

Preserve the references' layout and restrained colors. Add the required search field and Won/Lost filters. Keep dialogs and cards usable on narrow screens.

## Project structure

```text
LeadFlow/
├── PLAN.md
├── README.md
├── .env.example
├── .gitignore
├── compose.yaml
├── [existing reference images]
├── frontend/
│   ├── app/{layout.tsx,page.tsx,globals.css}
│   ├── components/
│   │   ├── LeadDashboard.tsx
│   │   ├── LeadCard.tsx
│   │   ├── StatusBadge.tsx
│   │   ├── Modal.tsx
│   │   ├── AddLeadDialog.tsx
│   │   └── LeadTimelineDialog.tsx
│   ├── lib/{api.ts,api.test.ts,types.ts,dates.ts,dates.test.ts,leads.ts,leads.test.ts,config.test.ts}
│   ├── scripts/next-local.mjs
│   ├── package.json
│   ├── package-lock.json
│   ├── next.config.ts
│   ├── tsconfig.json
│   ├── postcss.config.mjs
│   ├── Dockerfile
│   └── .dockerignore
└── backend/
    ├── app/{__init__.py,main.py,database.py,models.py,schemas.py,leads.py,seed.py,local.py}
    ├── tests/{conftest.py,test_leads.py,test_configuration.py}
    ├── requirements.txt
    ├── requirements-dev.txt
    ├── Dockerfile
    └── .dockerignore
```

## Database design

| Table | Fields |
| --- | --- |
| `leads` | Integer primary key; required name (200 characters); nullable company (200) and phone (50); status; nullable current `follow_up_at`; `created_at` and `updated_at` |
| `discussions` | Integer primary key; required lead foreign key; required note (5,000 characters at the API boundary); nullable historical `follow_up_at`; `created_at` |

- Use timezone-aware PostgreSQL timestamps.
- Constrain status to `new`, `contacted`, `qualified`, `proposal_sent`, `won`, or `lost`.
- Index discussions by lead ID and creation time.
- Derive the latest note and discussion timestamp from the discussion history.
- Order discussions by creation time descending, then ID descending for ties.
- Store the active schedule on the lead and the schedule originally set by a discussion on that discussion. Replacing the active schedule does not rewrite history.
- Use SQLAlchemy `create_all` for this fixed initial schema. Migration tooling is outside the assessment scope.

## API design

| Method and endpoint | Contract |
| --- | --- |
| `GET /api/leads` | Return dashboard summaries ordered by latest discussion time, falling back to lead creation time, with ID as a tie-breaker |
| `POST /api/leads` | Accept name and optional company/phone; create a New lead; return full detail with HTTP 201 |
| `GET /api/leads/{id}` | Return lead details and complete reverse chronological discussion history |
| `PATCH /api/leads/{id}` | Accept status only; persist and return refreshed full detail |
| `POST /api/leads/{id}/discussions` | Accept note and optional follow-up; save both atomically; return refreshed full detail with HTTP 201 |
| `GET /api/health` | Check database connectivity; return HTTP 503 when unavailable |

Response types:

- `LeadSummary`: lead fields, current follow-up, latest note, and latest discussion timestamp.
- `LeadDetail`: lead fields plus the discussion array.
- `Discussion`: ID, note, historical follow-up, and creation timestamp.

Validation and failure behavior:

- Trim input, reject blank names and notes, and enforce field limits.
- Normalize empty company/phone to null. Keep phone as text.
- Reject unknown request fields and invalid statuses.
- Require follow-up timestamps to include a time-zone offset and represent a future instant.
- Treat omitted or null follow-ups on new notes as preserving the active schedule.
- Return HTTP 404 for missing leads and HTTP 422 for invalid input.
- Roll back failed writes. Log unexpected failures and return generic errors without database details.

## Frontend behavior

- `LeadDashboard` owns lead summaries, selected lead, search, and active status filter.
- `LeadCard` shows name, optional company, badge, latest note, discussion age, and follow-up when scheduled. Cards open the timeline without changing routes.
- Show today's matching follow-ups at the top, ordered by due time. Show other matching leads below without duplicates.
- Highlight every past-due follow-up in red, including those earlier today. Older overdue leads remain visible in the main list.
- Display "No discussions yet" for leads without history. Keep Won/Lost leads readable and clickable.
- `StatusBadge` uses a single status-to-label/color mapping: green New, amber Contacted, blue Qualified, purple Proposal Sent, neutral Won, and red Lost.
- `Modal` uses native dialog behavior, an accessible title, Escape dismissal, focus restoration, and a visible close button.
- `AddLeadDialog` validates required name, disables duplicate submission, and closes only after a successful save.
- `LeadTimelineDialog` shows contact details, current status, scrollable discussion history, note input, and optional date/time controls. Both date and time are required when scheduling is enabled.
- Save status immediately. Keep the timeline open after saving a note. Update UI state from successful API responses without requiring a page reload.
- Preserve entered values on failure and show inline errors. Include dashboard loading, empty, and retry states.
- Refresh relative ages and overdue indicators every minute.
- Use `Intl` for date display and browser-local date/time conversion. Reject nonexistent local times caused by daylight-saving changes rather than silently adjusting them.
- Send browser requests to `/api`; Next.js rewrites them to FastAPI. Compose injects `API_INTERNAL_URL=http://backend:8000`; local npm scripts derive `http://localhost:BACKEND_PORT` from root `.env` and pass only needed settings to Next.js.

## Sequential implementation phases

### Phase 1 — Scaffold and Docker (1 hour)

1. Inspect and retain the configuration already created.
2. Install compatible stable dependencies, pin backend runtime requirements, and commit the frontend lockfile.
3. Add minimal frontend application entrypoints so the scaffold can build before feature work.
4. Add frontend/backend Dockerfiles and Docker ignore files.
5. Configure Compose with frontend, backend, and PostgreSQL, persistent database storage, and database/backend health checks.
6. Finish `.env.example` and ignore generated files and real environment files.

Verification: dependencies install, the frontend scaffold type-checks/builds, backend modules import, and Compose configuration validates. Report this result before Phase 2.

### Phase 2 — Database, API, and seed data (2 hours)

1. Review the existing models, schemas, routes, database dependency, and error handlers.
2. Verify request validation, UTC timestamps, history ordering, status persistence, and atomic discussion/follow-up writes.
3. Seed six leads covering every status, with at least two historical discussions each. Include today's, overdue, future, and unscheduled follow-ups.
4. Create schema and seed before backend startup. Seed only an empty leads table; preserve existing records on subsequent starts.
5. Add pytest tests against a separate PostgreSQL test database, with transaction rollback per test.

Verification: test creation, optional fields, all statuses, invalid/missing input, missing leads, latest summaries, history ordering and ties, follow-up preservation/replacement, timestamp validation, write rollback, and repeated seeding. Report results before Phase 3.

### Phase 3 — Dashboard (1.5 hours)

1. Build typed API calls, frontend types, and local-time helpers.
2. Implement reference-based header, filters, name search, cards, and status badges.
3. Partition matching leads into today's follow-ups and remaining leads.
4. Add overdue styling, relative ages, and loading/empty/error states.
5. Add focused date-helper tests using Vitest.

Verification: type-check, build, test local-day boundaries and overdue logic, inspect responsive layout, and confirm filters/search apply to both sections. Report results before Phase 4.

### Phase 4 — Add Lead and Timeline dialogs (1.5 hours)

1. Build the accessible shared native dialog shell.
2. Add the required-name form with optional company/phone.
3. Add detail loading, status selector, complete history, and note composer.
4. Add optional follow-up date/time validation and local-to-UTC conversion.
5. Apply successful mutations to dashboard/detail state immediately; retain forms on failure.

Verification: create a lead, change status, save notes with/without a schedule, replace a schedule, and confirm history and dashboard update. Check keyboard controls, focus restoration, and narrow-screen layout. Report results before Phase 5.

### Phase 5 — Integration and documentation (2 hours)

1. Run the full backend and frontend checks.
2. Launch all three services from a fresh Docker configuration and verify health checks and proxy requests.
3. Confirm persistence across page reloads and service restarts without reseeding or overwriting data.
4. Compare dashboard and dialogs against the supplied references.
5. Write README instructions for Docker, local development, configuration, seeding, test database creation, tests, API docs, and database reset.
6. Record any verification that the environment prevents; do not claim unchecked behavior passed.

Acceptance: every requested feature works; tests and production build pass; Docker starts all three services; seed data persists; setup instructions are reproducible.

## Final deliverables and limits

- Source for frontend and backend, PostgreSQL schema, seed data, tests, dependency manifests/lockfile, Dockerfiles, Compose configuration, `.env.example`, this plan, and README.
- Preserve the three original reference images.
- No public deployment or authentication. The app is intended for a local assessment.
- No pagination: dashboard queries are sized for a small assessment dataset. Replace full-history eager loading when larger datasets require pagination.
- No migration framework: future schema changes will require an explicit migration approach.

## Documentation consulted

- [Next.js external rewrites](https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites)
- [Tailwind CSS with Next.js](https://tailwindcss.com/docs/installation/framework-guides/nextjs)
- [FastAPI testing](https://fastapi.tiangolo.com/tutorial/testing/)
- [Docker Compose health-based startup ordering](https://docs.docker.com/compose/how-tos/startup-order)
- [Vitest setup and runtime requirements](https://vitest.dev/guide/)
- [SQLAlchemy transaction isolation for tests](https://docs.sqlalchemy.org/en/20/orm/session_transaction.html#joining-a-session-into-an-external-transaction-such-as-for-test-suites)
