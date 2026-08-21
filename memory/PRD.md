# TEMA Middleware — PRD

## Original problem statement
Build a production-grade enterprise integration middleware ("TEMA Middleware")
in Node.js/TypeScript/NestJS, incrementally by phase. Standalone project at
`/app/tema-middleware/` (separate from the pod's React/FastAPI/Mongo stack).

## Architecture / decisions
- Single modular NestJS 10 (Express) app; NOT multiple microservices/containers.
- Integrations isolated behind adapters under `src/integrations/`.
- All config env-driven; no secrets in source/logs; integrations optional (enable flags).

## Implemented
### Phase 1 (2026-06) — Foundation
Config + startup validation, structured pino logging + redaction, correlation id,
global validation + error filter, /health /ready /version, Swagger, Dockerfile, tests.

### Phase 1.5 (2026-06) — Engineering foundation
SWAGGER_ENABLED (dev/test on, prod off), openapi.json export, GitHub Actions CI,
AsyncLocalStorage correlation context (OTel-ready), durationMs + expanded masking,
integrations adapter strategy doc.

### Phase 2 (2026-08) — Core integration platform + SQL Server + Sage X3 foundations
- Integration core: IntegrationAdapter contract + registry, 12-code IntegrationError
  model (safe public mapping), timeout + operation-aware retry (writes NO_RETRY),
  idempotency (atomic begin, pluggable store), transaction tracking (pluggable store),
  business audit foundation, security authn/authz abstractions (no-op defaults, not
  enforced), configurable rate limiting (@nestjs/throttler).
- SQL Server adapter (mssql): pooling, timeouts, parameterized query + stored proc,
  connectivity check (SELECT 1), graceful shutdown, no arbitrary-SQL endpoint, no
  secret/SQL leakage.
- Sage X3 adapter (axios): pluggable auth (none/basic/apikey), error mapping, response
  validation, retry hooks, correlation propagation, connectivity check.
- Internal GET /health/integrations (does not affect /health or /ready).
- Tests: 71 unit + 18 e2e, all passing. Verified by testing agent (iteration_2.json, 100%).

### Phase 3.1 (2026-08) — Authentication foundation
- Provider-agnostic `IdentityProvider` abstraction + global `AuthGuard` (Bearer/JWT),
  no-op when `AUTH_ENABLED=false`; `@Public()` keeps health/ready/version/integrations public.
- Dev HS256 provider (config-gated, refused in production) + OIDC/JWKS RS256 provider
  (pluggable via `AUTH_PROVIDER`, ready for the client's real IdP incl. future WorkSuite OIDC).
- Canonical `AuthenticatedUser` (no invented claims); `GET /me`; safe error codes
  AUTHENTICATION_REQUIRED / AUTHENTICATION_FAILED / TOKEN_EXPIRED with requestId; no token/secret leakage.
- OpenAPI Bearer scheme. Tests: 82 unit + 31 e2e all pass. Verified by testing agent (iteration_3.json, 100%).

### Phase 3.2 (2026-08) — Authorization / RBAC foundation
- Global `AuthorizationGuard` (runs after `AuthGuard`) + `AuthorizationService` + `@Roles`/`@Permissions`
  decorators, reading roles[]/permissions[] from the canonical AuthenticatedUser (no token re-parse, no invented claims).
- Deterministic rule: no metadata ⇒ authN suffices; within-type OR, across-type AND; fails closed
  (empty/unknown ⇒ deny; missing user ⇒ 401). `@Public()` bypass preserved.
- Errors AUTHORIZATION_REQUIRED (401) / FORBIDDEN (403) via existing filter; denials logged + audited
  (AUTHORIZATION_DENIED) with no token/claim leakage. OpenAPI unchanged (no business paths).
- Final client/WorkSuite role→permission mapping pending IdP confirmation (framework is claim-driven).
- Tests: 89 unit + 42 e2e all pass. Verified by testing agent (iteration_4.json, 100%).

### Phase 3.3 (2026-08) — Business API foundation + first business API
- `src/modules/technicians/` (controller, service, mapper, models, dto). `GET /api/technicians`
  requires auth + `technician.read` permission; flows App→Controller→Service→IntegrationCore
  (transaction tracking)→SqlServerAdapter (parameterized stored proc)→mapper→canonical Technician.
- SQL source is config-driven (`SQL_TECHNICIANS_PROCEDURE`, aliased to canonical columns) because the
  real schema was NOT provided — no table/column/proc names invented; returns 503 until configured.
- Safe SQL-failure mapping (502/504) with zero secret/SQL leakage; correlation preserved; OpenAPI documents
  the endpoint (bearer, 200/401/403/503). Confirmed auth architecture documented (contractors=WorkSuite local
  hashed password; employees=Entra/AAD; WorkSuite is NOT an IdP).
- Tests: 96 unit + 50 e2e all pass. Verified by testing agent (iteration_5.json, 100%).

## Not implemented (by design / stop conditions)
No business workflows/endpoints; no invented Sage/SQL operations (contracts not provided);
FSM, FSM Scheduler, WorkSuite, Lead Perfection integrations; OAuth/OIDC provider; RBAC roles;
RabbitMQ/Kafka/Redis/Service Bus; Kubernetes; OpenTelemetry backend; DB connectivity for
TEMA's own datastore (undecided). DATABASE_URL remains a placeholder.

## Pending / unknown (do not invent)
Exact Sage X3 operations & schemas; exact SQL tables/stored procedures; auth provider;
BAASS Bridge responsibility boundary; full offline requirement; final Lead Perfection API.

## Next (Phase 3 candidates)
Define business-oriented TEMA APIs + canonical models once app contracts are finalized;
implement documented Sage/SQL operations when contracts arrive; wire the confirmed identity
provider into the security abstraction; add a durable store for transactions/idempotency.
