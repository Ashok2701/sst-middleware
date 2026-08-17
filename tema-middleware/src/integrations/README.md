# Integrations

TEMA Middleware is the integration hub. Each backend/external system is isolated
behind its own adapter module here. TEMA core code depends only on the
`IntegrationAdapter` contract (and per-adapter typed methods), never on a
system's HTTP/SQL details.

## Implemented in Phase 2 (foundations only)

```text
src/integrations/
├── sql-server/           # SQL Server adapter (connection/pool/parameterized ops)
│   ├── sql-server.adapter.ts
│   └── sql-server.module.ts
├── sage-x3/              # Sage X3 Web Service adapter (HTTP client + auth + adapter)
│   ├── sage-x3.auth.ts
│   ├── sage-x3.client.ts
│   ├── sage-x3.adapter.ts
│   └── sage-x3.module.ts
├── integration-registry.service.ts     # collects adapters for health
├── integration-health.controller.ts    # GET /health/integrations
└── integrations.module.ts
```

### Adapter contract (`src/common/integration`)

- `interfaces/integration-adapter.interface.ts` — minimal base contract
  (`name`, `targetSystem`, `enabled`, `checkConnectivity()`) plus an optional
  `ExecutableIntegrationAdapter` for adapters that fit a uniform request/response
  shape. The base deliberately does **not** assume all backends behave the same.
- `errors/integration-error.ts` — the internal error model (12 codes). Only a
  safe `{ code, message, requestId }` is ever exposed to consumers.
- `policies/` — `withTimeout` and an operation-aware `RetryPolicy`
  (`NO_RETRY` is the default for writes; only transient codes retry).
- `transaction/` — integration transaction tracking (pluggable store).
- `idempotency/` — idempotency abstraction (atomic `begin` / pluggable store).
- `interfaces/mapper.interface.ts` — canonical ↔ external transformation.

### SQL Server adapter

- Connection pooling via `mssql` with configurable pool/timeouts.
- Lazy connect, graceful shutdown (`onModuleDestroy` closes the pool).
- Parameterized `query()` and `executeStoredProcedure()` for **internally
  defined** operations only. **No arbitrary-SQL public endpoint exists.**
- No SQL text, parameter values or credentials are ever logged.
- `checkConnectivity()` runs `SELECT 1` and reports UP/DOWN/DISABLED + latency.
- **No business tables or stored procedures are invented** (none were provided).

### Sage X3 adapter

- Reusable HTTP client (`axios`) with base URL, timeout, correlation-id
  propagation, structured logging, response validation and retry hooks.
- Pluggable authentication (`none` / `basic` / `apikey`) — the real Sage X3
  mechanism is **not yet confirmed**, so it is fully configurable.
- Safe error mapping (401→AUTH, 403→AUTHZ, 429→RATE_LIMIT, 4xx→REMOTE_VALIDATION,
  5xx→REMOTE_SYSTEM, network→CONNECTION, abort→TIMEOUT).
- Retries default to `NO_RETRY` (many Sage transactions are not safe to repeat).
- **No business endpoints are invented** (Purchase Receipt / Delivery / Payment
  / Job Completion) because the Sage Web Service contracts were not provided.

## Adding a future adapter

1. Create `src/integrations/<system>/` with `<system>.adapter.ts` implementing
   `IntegrationAdapter` (+ its own typed operations) and a `<system>.module.ts`.
2. Read all connection details from configuration (respect a `*_ENABLED` flag).
3. Register the module in `integrations.module.ts` and add the adapter to
   `IntegrationRegistry`.
4. Map external ↔ canonical models with a `Mapper`; never leak external field
   names into TEMA business code.

No core changes are required.

## Confirmed vs pending

**Confirmed**
- SQL Server is available.
- Sage X3 Web Service is available.
- TEMA Middleware is the integration hub between TEMA apps and backends.
- WorkSuite is a future/optional integration.
- Lead Perfection technical contract is not yet complete.
- FSM / FSM Scheduler technical contracts are not yet complete.

**Unknown / pending (not invented here)**
- Exact Sage X3 Web Service operations and request/response schemas.
- Exact SQL tables / stored procedures.
- The client's authentication provider (OAuth2/OIDC/JWT) and final roles.
- The BAASS Bridge responsibility boundary between TEMA / BAASS / Sage X3 /
  Lead Perfection (BAASS provides bi-directional Lead Perfection ↔ Sage X3
  integration; TEMA must stay flexible to integrate directly or via BAASS).
- Full offline requirement.
- Final Lead Perfection API.

## WorkSuite & Lead Perfection

Future **optional** integrations. **No implementation** exists because client
technical specifications have not been provided. Their absence never prevents
TEMA from starting, testing or operating (they will be `*_ENABLED=false`).
