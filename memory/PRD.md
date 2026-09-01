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

### Phase 3.4 (2026-06) — WorkSuite contractor integration foundation
- WorkSuite Partner API adapter `src/integrations/worksuite/` (auth/client/adapter/module) mirroring the
  Sage X3 pattern: config-driven base URL/timeout/auth (none|bearer|apikey, PENDING), correlation propagation,
  bounded retry, safe error mapping, connectivity check, config-driven `getContractor(id)` (contractor path
  template PENDING → fails safe). Registered in IntegrationRegistry + /health/integrations.
- Webhook `POST /api/webhooks/worksuite` (public, HMAC-authenticated). `main.ts` now uses `rawBody: true` so
  HMAC-SHA256 is verified over the RAW body (constant-time), with timestamp freshness + Event-Id idempotency
  (reusing Phase 2 IdempotencyService). Notification-and-pull: created/updated/reactivated → pull+map+upsert,
  archived → deactivate. Audit events (CREATED/UPDATED/ARCHIVED/REACTIVATED/SYNC_FAILED/WEBHOOK_REJECTED) with
  safe metadata only. No secret/hash/signature/body leakage.
- Contractor domain `src/modules/contractors/`: canonical Contractor (confirmed fields only, NO Branch/Region;
  4 roles, one per contractor), isolated ContractorMapper, pluggable in-memory ContractorStore, ContractorsService,
  ContractorInitialLoadService (Option A batch / Option B CSV boundary, PENDING), WorksuitePasswordVerifier
  (PBKDF2-SHA256, fully config-driven, documented NOT yet WorkSuite-compatible until real params/test vectors).
- All WorkSuite config env-driven + validated; `.env.example` updated with PENDING markers. Phases 1–3.3 untouched.
- Tests: 149 unit + 60 e2e all pass (self-tested: build/lint/openapi/live signed-webhook smoke; secret non-leak verified).

### Connectivity wiring (2026-06) — real Sage X3 + SQL Server details received
- Client provided REAL SQL Server + Sage X3 SOAP credentials. Stored ONLY in git-ignored `/app/tema-middleware/.env`
  (never `.env.example`, never committed). No source/business logic changed. Goal was config + connectivity verification only.
- SQL Server VERIFIED (live from this env): `SQL_SERVER_*` wired (host `tmsx3em.tema-systems.com:49360`, db `tbs`, user `sa`,
  encrypt+trustServerCertificate). `/health/integrations` reports sql-server **UP** via the real adapter; `SELECT 1` OK and
  read-only `FSM.XTECHNCN` reachable (6 rows). Helper: `scripts/check-sql.js` (credential-free, reads env).
- Sage X3 endpoint VERIFIED reachable: WSDL `CAdxWebServiceXmlCC` returns HTTP 200 over TLS with basic auth
  (Adonix/Sage `http://www.adonix.com/WSS`); cert is self-signed (ssl_verify=20) → trust-server-certificate required.
  IMPORTANT: the endpoint is **SOAP**; the existing Phase-2 Sage adapter is **REST/JSON and cannot call it** — so
  `SAGE_X3_ENABLED=false` and a dedicated SOAP adapter is a PENDING future step (SOAP creds/pool alias `FSM` stored in .env).
- PENDING: SOAP Sage X3 adapter; real business operations (e.g. technicians from `FSM.XTECHNCN` — currently endpoint expects a
  stored procedure, not a table, so a query-based mapping or a wrapping proc is needed).

### Phase 3.5 (2026-06) — Technician / Lead Technician login foundation (Sage X3 SQL Server)
- `src/modules/technician-auth/`: `POST /api/auth/technician/login` (public) → Controller → TechnicianAuthService →
  transaction tracking → SqlServerAdapter (parameterized) → TechnicianIdentityMapper → canonical identity → HS256 token.
- Verified REAL `FSM.XTECHNCN` columns: `XTECH_0`(id/nvarchar), `XTECHNAM_0`(name), `XLEADTECH_0`(tinyint), `XPASSWRD_0`, `ROWID`.
  ⚠️ There is NO `XTECHNCN_0` column — so login username column is CONFIG-DRIVEN (`SQL_TECHNICIAN_USERNAME_COLUMN`,
  default spec value `XTECHNCN_0`; local `.env` set to `XTECH_0`). Live login query validated against the real table (0 rows for bogus user, no passwords fetched).
- Rule CONFIRMED: `XLEADTECH_0=2` ⇒ Lead Technician else Technician. Both roles get `technician.read` only.
- Password verification behind `PasswordVerifier` abstraction; TEMPORARY plaintext (constant-time) impl; PENDING WorkSuite PBKDF2-SHA256 (params not guessed).
- Token minting is a TEMPORARY dev bridge (HS256 via AUTH_DEV_SECRET, dev provider/non-prod only; OIDC/prod → safe INTEGRATION_NOT_CONFIGURED).
- Safe generic AUTHENTICATION_FAILED (no oracle); password never logged/returned; Sales Rep excluded; no active/inactive column assumed.
- Config added: `SQL_TECHNICIAN_SCHEMA/TABLE/USERNAME_COLUMN/LOGIN_PROCEDURE`, `AUTH_TOKEN_TTL`. `ConfigModule` now ignores `.env` under NODE_ENV=test (hermetic tests).
- Tests: 170 unit + 68 e2e all pass (self-tested: build/lint/openapi + real login-query validation). Phases 1–3.4 preserved.
- PENDING: confirm real login username column (XTECH_0 vs a distinct username); WorkSuite PBKDF2 params; Sales Rep table/login; active/inactive field.

### Phase 3.6 (2026-06) — FSM master-data & integration foundation
- Sales Rep login `src/modules/sales-rep-auth/`: `POST /api/auth/sales-rep/login` (public). Verified real cols
  XX10CUSERS(XAUS_0/XPWSD_0/XAUSNA_0/XEMAILID_0/XACT_0/XUSROLE_0) + XX10CUSERD(XFCY_0/XDEFFCY_0/XLINNO_0). Gate XUSROLE_0=1 && XACT_0=1.
  Reuses shared LocalTokenIssuer + PasswordVerifier (extracted from 3.5 into common/auth); separate domain model. Permission salesrep.read.
- Service Requests `src/modules/service-requests/` (read-only, no CRUD, permission serviceRequest.read): middleware JOIN/child
  queries (no DDL) — SERREQUEST(SRENUM_0) + XFSMBASE(XSERNUM_0) + HDKTASK(SRENUM_0) + X1CJOBCARD(XSRENUM_0), minimal safe fields.
- Routes `src/modules/routes/` (read-only, permission route.read): XX1ROUTPOH header + XX1ROUTPOD detail list. Pure tested XDRN
  generator RT-{SITE}-{0001}; NOT persisted. New route status XROUTSTATUS_0=1. 1524 kept as configurable constant, written nowhere.
- Lead Perfection adapter foundation `src/integrations/lead-perfection/` (config base URL/api-key/timeout/auth/connectivity/safe errors;
  operations PENDING). Registered in IntegrationRegistry → /health/integrations now lists sql-server, sage-x3, worksuite, lead-perfection.
- WorkSuite: added confirmed Country (USA/Canada) to canonical contractor + mapper. 3.4 webhook/HMAC/idempotency/PBKDF2 abstraction intact.
- Consolidated dev token issuer: TechnicianTokenIssuer → shared common/auth/LocalTokenIssuer (exported by global AuthModule). ConfigModule already ignores .env under NODE_ENV=test.
- All new SQL validated against LIVE FSM schema (bogus keys / TOP 1; no passwords fetched). Ops helper scripts under scripts/.
- Tests: 194 unit + 79 e2e all pass; build + lint + openapi pass. Phases 1–3.5 preserved.
- PENDING: 1524 status meaning/field; Lead Perfection API contract + credentials; WorkSuite PBKDF2 params; route persistence via Sage document engine; Sales Rep XDEFFCY_0 default-flag value confirmation.

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
