# Integrations (placeholder — no implementations yet)

This directory documents the **future** integration strategy. It intentionally
contains **no code and no API endpoints** yet, because doing so would require
inventing contracts we do not have.

## Adapter pattern

When a system's technical/API specification becomes available, it will be added
here as a self-contained NestJS module exposing a narrow adapter interface, e.g.:

```text
src/integrations/
├── fsm/                 # FSM Mobile business APIs
├── fsm-scheduler/       # FSM Scheduler integration
├── sage-x3/             # Sage X3 integration
├── sql-integration/     # Sage SQL Server / FSM SQL requirements
├── worksuite/           # FUTURE / OPTIONAL - no spec provided yet
└── lead-perfection/     # FUTURE / OPTIONAL - no spec provided yet
```

Each module will:

- expose a small, typed adapter interface (port) that the TEMA core depends on;
- keep vendor-specific details (URLs, auth, request/response models) fully
  contained inside the adapter;
- read all connection details from environment/configuration (never hard-coded);
- be independently testable and independently removable.

## WorkSuite & Lead Perfection

**WorkSuite** and **Lead Perfection** are treated as **future optional
integrations**. They currently have **no implementation** because the client's
technical specifications have not yet been provided. Their absence must never
prevent TEMA from starting, testing or operating.

## Deployment note

Keeping these as modules (not separate services/containers) is deliberate.
Whether any module later becomes an independently deployable service will be
decided once the business/integration boundaries are understood — not upfront.
