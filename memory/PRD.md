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
