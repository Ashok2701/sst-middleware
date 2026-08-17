# TEMA Middleware — PRD

## Original problem statement
Build Phase 1 (project foundation only) of a production-grade enterprise middleware
platform "TEMA Middleware" using Node.js, TypeScript, NestJS, REST/JSON, Swagger,
Jest, ESLint, Prettier, Docker. Foundation only — no external integrations.

## Architecture / decisions
- Standalone NestJS 10 (Express) project at `/app/tema-middleware/` (separate from the
  pod's React/FastAPI/MongoDB stack, per user choice).
- Clean modular structure: `common/{errors,logging,correlation,validation}`, `config`,
  `health`, `version`. Future integration modules drop in without restructuring.
- Structured logging via nestjs-pino; env config validated at startup; global
  validation pipe + global exception filter; correlation id middleware.
- No DB code (DATABASE_URL is placeholder only). No secrets in source.

## Implemented (2026-06)
- Env config + startup validation (`config/`)
- Structured JSON logging with sensitive-field redaction (`common/logging`)
- Correlation/request id generation + propagation (`common/correlation`)
- Global validation pipe (`common/validation`) + consistent error filter (`common/errors`)
- Endpoints: `GET /health`, `GET /ready`, `GET /version`
- Swagger/OpenAPI at `/docs`
- Dockerfile (multi-stage, non-root)
- Tests: 14 unit + 10 e2e (Jest + Supertest), all passing
- README with all required sections

## Verification
- `yarn build`, `yarn test`, `yarn test:e2e`, `yarn lint` all pass.
- Live smoke test in production mode confirmed all endpoints, correlation propagation,
  404/500 error format, Swagger JSON, structured logs.

## Not in scope (later phases)
Sage X3, SQL Server, FSM Scheduler, FSM Mobile business APIs, WorkSuite,
Lead Perfection, OAuth/OIDC, RBAC, RabbitMQ, Azure Service Bus, Redis, Kubernetes,
business workflows.

## Next
Phase 2 — add first integration module (e.g. FSM Service) as a new NestJS module.
