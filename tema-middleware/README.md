# TEMA Middleware

Enterprise integration middleware platform.

> **Current phase: Phase 1 — Project Foundation only.**
> External integrations (Sage X3, SQL Server, FSM Scheduler, FSM Mobile business
> APIs, WorkSuite, Lead Perfection, OAuth/OIDC, RBAC, message buses, Redis,
> Kubernetes) are **NOT implemented yet**. This repository currently provides
> only the production-grade foundation on which those later phases will be built.

---

## 1. Project purpose

TEMA Middleware is the integration hub that will eventually connect:

- FSM Mobile application
- FSM Scheduler browser application
- WorkSuite
- Lead Perfection
- Sage X3
- Sage SQL Server / FSM-specific SQL requirements

It is designed to run inside a **DMZ environment** and to scale horizontally to
support the expected load (~350 FSM Mobile users, ~200 FSM Scheduler users,
~550 total).

Phase 1 delivers the foundation: configuration, structured logging, correlation
IDs, global validation, consistent error handling, health/readiness/version
endpoints, Swagger docs, tests and a production Docker image.

---

## 2. Technology stack

| Concern            | Technology                     |
| ------------------ | ------------------------------ |
| Language           | TypeScript                     |
| Runtime            | Node.js 20 (LTS)               |
| Framework          | NestJS 10 (Express platform)   |
| API style          | REST / JSON                    |
| API docs           | Swagger / OpenAPI (`@nestjs/swagger`) |
| Config             | `@nestjs/config` + class-validator env validation |
| Logging            | `nestjs-pino` (structured JSON) |
| Validation         | `class-validator` / `class-transformer` |
| Testing            | Jest (unit) + Supertest (e2e)  |
| Lint / format      | ESLint + Prettier              |
| Container          | Docker (multi-stage, non-root) |

---

## 3. Folder structure

```text
tema-middleware/
├── src/
│   ├── common/
│   │   ├── errors/         # Global exception filter + error codes + error DTO
│   │   ├── logging/        # Structured (pino) logging module
│   │   ├── correlation/    # Correlation/request-id middleware + constants
│   │   ├── validation/     # Global validation pipe factory
│   │   └── constants.ts    # Non-secret app constants (service name, version)
│   ├── config/             # Env loading + startup env validation
│   ├── health/             # /health (liveness) + /ready (readiness)
│   ├── version/            # /version
│   ├── app.module.ts       # Root module (wires everything together)
│   ├── setup.ts            # Shared app setup (pipe + filter) reused by e2e tests
│   ├── swagger.ts          # Swagger/OpenAPI configuration
│   └── main.ts             # Application bootstrap
├── test/
│   ├── app.e2e-spec.ts         # health / ready / version / correlation / errors
│   ├── validation.e2e-spec.ts  # global validation + error handling
│   └── jest-e2e.json
├── Dockerfile
├── .dockerignore
├── .gitignore
├── .env.example
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── nest-cli.json
├── .eslintrc.js
├── .prettierrc
└── README.md
```

### Note on structure

The requested layout is followed closely. Two small, best-practice additions:

- `src/setup.ts` — extracts the global pipe + filter wiring so the exact same
  configuration is reused by the e2e test harness (DRY, avoids test/prod drift).
- `src/swagger.ts` — keeps Swagger configuration out of `main.ts`.

This modular structure means future integration modules
(`fsm/`, `sage-x3/`, `sql-integration/`, `worksuite/`, `lead-perfection/`,
`fsm-scheduler/`) can be added as self-contained NestJS modules under `src/`
without restructuring the foundation.

---

## 4. Prerequisites

- Node.js 20 LTS (or newer)
- npm 10+ (a `yarn.lock` is committed; npm also works)
- Docker (optional, for containerised runs)

---

## 5. Installation

```bash
npm install
```

Then create your local environment file from the template:

```bash
cp .env.example .env
```

> Never commit a real `.env`. It is git-ignored. `.env.example` contains only
> safe, non-sensitive placeholders.

---

## 6. Environment variables

| Variable                 | Required | Default (dev) | Description                                            |
| ------------------------ | -------- | ------------- | ------------------------------------------------------ |
| `NODE_ENV`               | no       | `development` | `development` \| `production` \| `test`                |
| `TEMA_PORT`              | no       | `8081`        | Port the middleware listens on                         |
| `TEMA_BASE_URL`          | no       | —             | Public base URL of this service (placeholder only)     |
| `FSM_SCHEDULER_BASE_URL` | no       | —             | FSM Scheduler base URL (integration not in Phase 1)    |
| `FSM_SCHEDULER_PORT`     | no       | —             | FSM Scheduler port (integration not in Phase 1)        |
| `DATABASE_URL`           | no       | —             | DB connection string (not used in Phase 1)             |
| `LOG_LEVEL`              | no       | `info`        | `fatal`\|`error`\|`warn`\|`info`\|`debug`\|`trace`\|`silent` |

Environment values are validated at startup; invalid config fails fast with a
clear message. No real URLs, credentials, passwords, API keys or secrets are
stored in source.

---

## 7. Running locally

```bash
# watch mode (recommended during development)
npm run start:dev

# one-off run
npm run start

# run the compiled production build
npm run build && npm run start:prod
```

The service starts on `http://localhost:${TEMA_PORT}` (default `8081`).

---

## 8. Running tests

```bash
# unit tests
npm test

# unit tests with coverage
npm run test:cov

# end-to-end tests
npm run test:e2e
```

---

## 9. Building

```bash
npm run build      # compiles TypeScript to ./dist
```

---

## 10. Running with Docker

```bash
# build the image
docker build -t tema-middleware:0.1.0 .

# run it (maps host 8081 -> container 8081, injects env vars)
docker run --rm -p 8081:8081 \
  -e NODE_ENV=production \
  -e TEMA_PORT=8081 \
  -e LOG_LEVEL=info \
  tema-middleware:0.1.0
```

The image is multi-stage, runs as the non-root `node` user, contains no secrets,
and starts via `node dist/main.js`. The listening port is driven by `TEMA_PORT`.

---

## 11. Swagger URL

Interactive API documentation:

```text
http://localhost:8081/docs
```

Raw OpenAPI JSON:

```text
http://localhost:8081/docs-json
```

---

## 12. Health endpoint

```text
GET http://localhost:8081/health   -> { "status": "UP", "service": "tema-middleware" }
GET http://localhost:8081/ready    -> { "status": "READY", "service": "tema-middleware", "checks": [] }
GET http://localhost:8081/version  -> { "service": "tema-middleware", "version": "0.1.0" }
```

Every response carries an `x-correlation-id` header for tracing.

---

## 13. Current phase

**Phase 1 — Project Foundation.**

Implemented:

- Environment-based configuration with startup validation
- Structured JSON logging (timestamp, level, service, correlation id, method,
  path, status, duration) with sensitive-field redaction
- Correlation/request id per request (generated or propagated)
- Global request validation (foundation for future DTOs)
- Consistent global error responses (`{ code, message, requestId }`, no stack traces)
- `/health`, `/ready`, `/version` endpoints
- Swagger/OpenAPI docs
- Unit + e2e tests (Jest + Supertest)
- Production-ready Dockerfile

Explicitly **not** implemented in this phase: Sage X3, SQL Server, FSM Scheduler,
FSM Mobile business APIs, WorkSuite, Lead Perfection, OAuth/OIDC, RBAC, RabbitMQ,
Azure Service Bus, Redis, Kubernetes, business workflows.

---

## 14. Future planned phases

The foundation is intentionally structured so the following can be added as
independent modules without restructuring:

- FSM Service
- Sage X3 Service
- SQL Integration Service
- WorkSuite Service
- Lead Perfection Service
- FSM Scheduler Integration

A single correlation id will then trace a request across:

```text
FSM Mobile → TEMA → FSM Service → Sage Service → Sage X3
```
