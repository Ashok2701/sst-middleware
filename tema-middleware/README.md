# TEMA Middleware

Enterprise integration middleware platform.

> **Current phase: Phase 1.5 — Engineering Foundation.**
> Phase 1 (project foundation) is complete and verified. Phase 1.5 adds
> environment-configurable Swagger, reproducible OpenAPI export, a CI pipeline,
> an OpenTelemetry-ready correlation/trace foundation, logging & error-handling
> hardening, and a documented future-integration strategy.
>
> External integrations (Sage X3, SQL Server, FSM Scheduler, FSM Mobile business
> APIs, WorkSuite, Lead Perfection, OAuth/OIDC, RBAC, message buses, Redis,
> Kubernetes) are **NOT implemented yet**.
>
> **WorkSuite and Lead Perfection are future _optional_ integrations and
> currently have no implementation because the client's technical specifications
> have not yet been provided.**

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
├── .github/workflows/ci.yml    # CI pipeline (lint, tests, build, docker)
├── src/
│   ├── common/
│   │   ├── errors/         # Global exception filter + error codes + error DTO
│   │   ├── logging/        # Structured (pino) logging module
│   │   ├── correlation/    # Correlation id middleware + AsyncLocalStorage context
│   │   ├── validation/     # Global validation pipe factory
│   │   └── constants.ts    # Non-secret app constants (service name, version)
│   ├── config/             # Env loading + startup env validation
│   ├── health/             # /health (liveness) + /ready (readiness)
│   ├── version/            # /version
│   ├── integrations/       # Documented future-integration strategy (no code yet)
│   ├── app.module.ts       # Root module (wires everything together)
│   ├── setup.ts            # Shared app setup (pipe + filter) reused by e2e tests
│   ├── swagger.ts          # Swagger/OpenAPI configuration + document builder
│   ├── openapi.ts          # Reproducible openapi.json generator
│   └── main.ts             # Application bootstrap
├── test/                   # e2e specs (app / validation / swagger)
├── Dockerfile
├── .env.example
├── openapi.json            # Generated OpenAPI spec (via npm run openapi:generate)
└── package.json / tsconfig / eslint / prettier ...
```

### Architecture note

- The app is a **single, modular NestJS application** — not multiple
  microservices/containers. Whether any module later becomes independently
  deployable is deferred until integration boundaries are understood.
- Future integrations use the **adapter pattern** under `src/integrations/`
  (see `src/integrations/README.md`). No integration code or invented endpoints
  exist yet.

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
| `SWAGGER_ENABLED`        | no       | env-based     | `true`\|`false`. Default: on in dev/test, off in production |

`SWAGGER_ENABLED` default behaviour:

- **development** → enabled
- **test** → enabled
- **production** → disabled (set `SWAGGER_ENABLED=true` to opt in)

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

Swagger is **environment-configurable** via `SWAGGER_ENABLED` (see §6).
When enabled:

```text
http://localhost:8081/docs        # interactive UI
http://localhost:8081/docs-json   # raw OpenAPI JSON
```

When disabled (production default), both endpoints return `404`.

### Regenerating the OpenAPI specification

A committed `openapi.json` is generated from the live app metadata and reflects
**only the endpoints that currently exist** (`/health`, `/ready`, `/version`):

```bash
npm run openapi:generate    # builds, then writes ./openapi.json
```

No future/integration endpoints (FSM, Sage, SQL, WorkSuite, Lead Perfection) are
invented in the spec.

### CI pipeline

`.github/workflows/ci.yml` runs on every push and pull request:

1. Install dependencies (`yarn install --frozen-lockfile`)
2. Lint (`yarn lint`)
3. Unit tests (`yarn test`)
4. E2E tests (`yarn test:e2e`)
5. Production build (`yarn build`)
6. Validate Docker image build (`docker build`)

It performs verification only — no automatic deployment, no Kubernetes, no cloud
infrastructure.

### Correlation ID / trace foundation

Every request is tagged with a correlation id:

- accepts an incoming `X-Correlation-ID` header (propagated if present);
- generates a UUID when absent;
- stored in an `AsyncLocalStorage` context so it is available throughout the
  request lifecycle (retrievable via `getCorrelationId()`), plus on `req`;
- included in every structured log line (`correlationId`);
- returned on the response (`x-correlation-id` header);
- included in every error response (`requestId`).

This mirrors OpenTelemetry's context-propagation model, so a future OTel
integration can wrap/replace the context store cleanly. **Full OpenTelemetry and
any observability backend (Jaeger/Grafana/App Insights) are intentionally NOT
implemented yet.**

```text
FSM Mobile --X-Correlation-ID: ABC-123--> TEMA --ABC-123--> FSM Service --> Sage Service
```

### Structured logging

`nestjs-pino` emits JSON logs containing (where applicable): `time`, `level`,
`service`, `correlationId`, request `method`, request path, `statusCode`,
`durationMs` and error information. Sensitive data (auth headers, cookies,
passwords, tokens, API keys, client secrets, db passwords, SSN) is masked/removed
and never logged.

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

**Phase 1 — Project Foundation: COMPLETE & verified.**

- Environment-based configuration with startup validation
- Structured JSON logging with sensitive-field redaction
- Correlation/request id per request (generated or propagated)
- Global request validation (foundation for future DTOs)
- Consistent global error responses (`{ code, message, requestId }`, no stack traces)
- `/health`, `/ready`, `/version` endpoints
- Swagger/OpenAPI docs
- Unit + e2e tests (Jest + Supertest)
- Production-ready Dockerfile

**Phase 1.5 — Engineering Foundation: COMPLETE.**

- `SWAGGER_ENABLED` — environment-configurable Swagger (on in dev/test, off in prod)
- Reproducible OpenAPI export (`npm run openapi:generate` → `openapi.json`)
- GitHub Actions CI (lint, unit, e2e, build, docker)
- OpenTelemetry-ready correlation/trace foundation (AsyncLocalStorage context)
- Logging hardening (`durationMs`, expanded sensitive-data masking)
- Reviewed & confirmed consistent global error handling (no internal leakage)
- `/health` (alive) & `/ready` (initialized) kept as-is — **no** dependency probes yet
- Documented future-integration adapter strategy (`src/integrations/README.md`)

Explicitly **not** implemented: Sage X3, SQL Server, FSM Scheduler, FSM Mobile
business APIs, WorkSuite, Lead Perfection, OAuth/OIDC, RBAC, RabbitMQ, Azure
Service Bus, Redis, Kubernetes, database connectivity, full OpenTelemetry,
business workflows.

`DATABASE_URL` remains a **placeholder only** — no DB connectivity in this phase
(TEMA's own datastore, PostgreSQL vs SQL Server, is not yet finalized).

---

## 14. Future planned phases & integration strategy

Future integrations are added as self-contained modules/adapters under
`src/integrations/` (see that folder's README) **without** restructuring the core:

- FSM Service
- FSM Scheduler Integration
- Sage X3 Service
- SQL Integration Service
- WorkSuite Service — **future optional; no spec provided yet, so not implemented**
- Lead Perfection Service — **future optional; no spec provided yet, so not implemented**

Their absence does not prevent TEMA from starting, testing or operating. A single
correlation id will then trace a request across:

```text
FSM Mobile → TEMA → FSM Service → Sage Service → Sage X3
```
