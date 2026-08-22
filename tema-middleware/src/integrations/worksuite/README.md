# WorkSuite Contractor Integration (Phase 3.4 foundation)

This document describes the WorkSuite contractor integration **foundation**. It
is built on the existing Integration Core, Idempotency, Audit, Auth and
Authorization phases and is designed so the final, still-pending WorkSuite
specifications can be plugged in **without architectural changes**.

> WorkSuite is **NOT** an identity provider. It is the source of truth for
> contractor records and hashed credentials. TEMA is **notified** by webhook and
> then **pulls** the current contractor record via the WorkSuite Partner API.

---

## 1. Architecture

```text
WorkSuite --(webhook: event + contractor id)--> [ TEMA Middleware / DMZ ]
                                                   POST /api/webhooks/worksuite
                                                        |
                       1. verify HMAC over RAW body + timestamp freshness
                       2. require X-Worksuite-Event-Id
                       3. idempotency (Phase 2 IdempotencyService, key = event id)
                                                        |
                                                        v
                        WorksuiteWebhookService (orchestrator)
                                                        |
                    created / updated / reactivated  ---+---  archived
                                |                                  |
                    ContractorsService.syncFromWorksuite   ContractorsService.archive
                                |                                  |
                    WorksuiteAdapter.getContractor(id)      (no Partner API fetch;
                    (Partner API pull, raw payload)          disable TEMA access)
                                |
                    ContractorMapper.toCanonical (isolated field mapping)
                                |
                    ContractorStore.upsert (canonical Contractor)
                                |
                    AuditService.record (safe metadata only)
```

Layering (unchanged mandate):
`Controller → Service → Integration Core → Integration Adapter → Mapper → Canonical Model`.
Controllers never call Axios/HTTP, the store or the adapter directly.

Key files:

```text
src/integrations/worksuite/            # Partner API adapter (integration layer)
  worksuite.auth.ts                    # pluggable API auth (none|bearer|apikey) - PENDING
  worksuite.client.ts                  # HTTP client (retry, correlation, safe errors)
  worksuite.adapter.ts                 # IntegrationAdapter + getContractor(id)
  worksuite.module.ts
src/modules/contractors/               # contractor domain
  models/contractor.model.ts           # canonical Contractor, roles, StoredCredential
  mappers/contractor.mapper.ts         # RAW WorkSuite payload -> canonical (isolated)
  contractor-store.ts                  # pluggable store (in-memory default)
  contractors.service.ts               # create/update/archive/reactivate sync
  password/password-verifier.ts        # PBKDF2-SHA256 verification abstraction
  initial-load.service.ts              # Option A (batch) / Option B (CSV) abstraction
  contractors.module.ts
src/modules/worksuite-webhook/         # inbound webhook
  signature/worksuite-signature.ts     # HMAC-SHA256 verification util
  worksuite-webhook.service.ts         # orchestration
  worksuite-webhook.controller.ts      # POST /api/webhooks/worksuite (public)
  worksuite-webhook.errors.ts          # safe error shapes
  worksuite-webhook.module.ts
```

## 2. Webhook flow (`POST /api/webhooks/worksuite`)

Public route (bypasses the bearer `AuthGuard`) — WorkSuite authenticates via the
HMAC signature, not a TEMA token. Steps:

1. gate on `WORKSUITE_WEBHOOK_ENABLED` and a configured secret;
2. verify the HMAC signature over the **raw** request body;
3. verify timestamp freshness (replay tolerance);
4. require `X-Worksuite-Event-Id`;
5. apply Event-Id idempotency (Phase 2 `IdempotencyService`);
6. parse the body **after** verification and extract event type + contractor id;
7. for created/updated/reactivated → pull the current record via the Partner API;
8. map to the canonical contractor and upsert; archived → disable access;
9. audit the outcome; return a safe `{ accepted, eventId, event, status }`.

Confirmed events (no separate password-reset/role-change events — they arrive as
`contractor.updated`, and TEMA re-pulls the record):

- `contractor.created`
- `contractor.updated`
- `contractor.archived`
- `contractor.reactivated`

## 3. HMAC verification

```text
signature = "sha256=" + hex( HMAC-SHA256( shared_secret, "{timestamp}.{raw_body}" ) )
headers: X-Worksuite-Timestamp, X-Worksuite-Signature, X-Worksuite-Event-Id
```

- Verified over the **raw** request bytes (`rawBody: true` in `main.ts`; JSON
  parsing for other routes is unaffected).
- Constant-time comparison (`crypto.timingSafeEqual`) with a length guard.
- Configurable freshness window (`WORKSUITE_WEBHOOK_TOLERANCE_SECONDS`, default
  300s) protects against replay; combined with Event-Id idempotency.
- The signing secret is never logged. Signature/timestamp are treated as
  non-secret protocol values.

> PENDING: WorkSuite must confirm the timestamp **unit** (this assumes Unix
> **seconds**) and the exact secret provisioning.

## 4. Partner API flow

`WorksuiteAdapter.getContractor(id)` performs a side-effect-free GET (bounded
retry) via `WorksuiteClient`, returning the **raw** payload for the mapper.

- Base URL, timeout, retries and auth are configuration-driven.
- The contractor resource path is a **configurable template**
  (`WORKSUITE_CONTRACTOR_PATH` with an `{id}` placeholder). Until it is set,
  `getContractor` fails safely — **no endpoint path is invented**.
- Auth mechanism (`none`/`bearer`/`apikey`) is a placeholder — **PENDING** the
  real WorkSuite Partner API authentication + credentials.

## 5. Contractor lifecycle

| WorkSuite event         | TEMA action                                             |
| ----------------------- | ------------------------------------------------------- |
| `contractor.created`    | pull record → map → upsert (create)                     |
| `contractor.updated`    | pull record → map → upsert (incl. new password hash)    |
| `contractor.reactivated`| pull record → map → upsert with `active=true`           |
| `contractor.archived`   | disable TEMA FSM access (deactivate); no Partner pull   |

Password reset in WorkSuite → `contractor.updated` → re-pull → new hash synced.
No separate password-reset webhook exists.

## 6. Event-Id idempotency

`X-Worksuite-Event-Id` is the stable idempotency key (reusing the Phase 2
`IdempotencyService`):

- first event → processed;
- duplicate **completed** event → prior result replayed (no reprocessing);
- concurrent duplicate → rejected (`DUPLICATE_OPERATION`);
- failure → key released so a WorkSuite retry can reprocess.

## 7. Password hashing abstraction

`WorksuitePasswordVerifier` performs **local** contractor password verification
against the WorkSuite-supplied hash (WorkSuite remains the source of truth):

- Algorithm: **PBKDF2-SHA256** (as WorkSuite proposed).
- Parameters (iterations, salt length, key length, encoding) are fully
  **configuration-driven** and default to unset (`isConfigured()` → false).
- Uses async `crypto.pbkdf2` with constant-time comparison; NFC normalization.
- Plaintext is never stored or logged.

> **NOT yet WorkSuite-compatible.** The exact iteration count, salt/key length,
> encoding and stored-hash format are **PENDING** and must be validated
> byte-for-byte against real WorkSuite test vectors before interoperability can
> be claimed. This does **not** add a new identity provider and does not change
> Phase 3.1/3.2 authentication.

## 8. Initial load

`ContractorInitialLoadService` establishes the boundary for the first-time sync:

- **Option A** — Partner API batch fetch (`loadFromPartnerApi`).
- **Option B** — CSV import (`importFromCsv`).

Both are intentionally unimplemented (throw `INITIAL_LOAD_NOT_CONFIGURED`) — the
batch contract and CSV column layout are **PENDING**. No columns/fields invented.

## 9. Canonical contractor model

Only **confirmed** fields are present. Branch and Region are **not** included
(Ferguson confirmed they are not required):

```ts
Contractor {
  worksuiteContractorId: string;   // guaranteed
  partnerId?: string;              // partner/company association where provided
  companyId?: string;
  role?: 'Lead Technician' | 'Technician' | 'Sales Rep' | 'N/A';  // one role
  active: boolean;                 // archived => false
  crew?: string;                   // only if confirmed by the final field spec
  credential?: StoredCredential;   // hashed; NEVER exposed via any API
  updatedAt: string;
}
```

- One role per contractor; the role can change (arrives via `contractor.updated`).
- `N/A` (or inactive) ⇒ no TEMA username/password access
  (`isEligibleForTemaAccess`). The final role → TEMA permission mapping is
  **PENDING** client/IdP approval.

## 10. Environment variables

| Variable | Default | Notes |
| --- | --- | --- |
| `WORKSUITE_ENABLED` | `false` | Enable the WorkSuite adapter |
| `WORKSUITE_BASE_URL` | — | Partner API base URL (**PENDING**) |
| `WORKSUITE_API_TIMEOUT` | `30000` | Request timeout (ms) |
| `WORKSUITE_API_AUTH_TYPE` | `none` | `none`\|`bearer`\|`apikey` (**PENDING**) |
| `WORKSUITE_API_TOKEN` / `WORKSUITE_API_KEY` / `WORKSUITE_API_KEY_HEADER` | — | Auth (never committed) |
| `WORKSUITE_CONTRACTOR_PATH` | — | Path template with `{id}` (**PENDING**) |
| `WORKSUITE_HEALTH_PATH` | `/` | Connectivity probe path |
| `WORKSUITE_RETRY_MAX_ATTEMPTS` / `WORKSUITE_RETRY_INITIAL_DELAY` | `3` / `200` | Read retry hints |
| `WORKSUITE_WEBHOOK_ENABLED` | `false` | Enable webhook processing |
| `WORKSUITE_WEBHOOK_SECRET` | — | HMAC shared secret (**PENDING**; never committed) |
| `WORKSUITE_WEBHOOK_TOLERANCE_SECONDS` | `300` | Replay/freshness window |
| `WORKSUITE_PASSWORD_ALGORITHM` | `PBKDF2-SHA256` | Proposed algorithm |
| `WORKSUITE_PBKDF2_ITERATIONS` | — | **PENDING** |
| `WORKSUITE_PBKDF2_SALT_LENGTH` | — | **PENDING** |
| `WORKSUITE_PBKDF2_KEY_LENGTH` | — | **PENDING** |
| `WORKSUITE_PASSWORD_ENCODING` | — | **PENDING** |

## 11. Local testing

Sign and send a webhook (Unix-seconds timestamp assumed):

```bash
export WORKSUITE_WEBHOOK_SECRET='dev-secret'
body='{"event":"contractor.updated","contractorId":"c1"}'
ts=$(date +%s)
sig=$(printf '%s.%s' "$ts" "$body" | openssl dgst -sha256 -hmac "$WORKSUITE_WEBHOOK_SECRET" -hex | sed 's/^.* //')
curl -i -X POST http://localhost:8081/api/webhooks/worksuite \
  -H 'content-type: application/json' \
  -H "X-Worksuite-Timestamp: $ts" \
  -H "X-Worksuite-Signature: sha256=$sig" \
  -H 'X-Worksuite-Event-Id: evt-001' \
  --data-binary "$body"
```

Automated tests: `yarn test` (unit) and `yarn test:e2e` (e2e) — covers HMAC
accept/reject, missing/expired/malformed timestamp, tampered body, replay/
duplicate event id, each lifecycle event, Partner API success/timeout/failure
mapping, retry behaviour, secret/hash non-leakage and PBKDF2 config-driven
verification (with pending parameters explicitly tested).

## 12. Security considerations

- HTTPS assumed for all WorkSuite traffic.
- Never logged: shared/webhook secret, signing secret, passwords, password
  hashes, complete credential payloads, `Authorization` headers, full bodies.
- Raw body used for HMAC; constant-time comparison; freshness + idempotency for
  replay protection.
- Internal WorkSuite errors are mapped to safe `{ code, message, requestId }` —
  no stack traces or downstream detail leak to clients.
- Password hashes are never exposed via any API or OpenAPI schema.

## 13. Confirmed vs pending

**Confirmed**
- WorkSuite is **not** an IdP; Partner API used to retrieve contractor records.
- Notification-and-pull webhook model.
- Events: created / updated / archived / reactivated (no separate reset/role events).
- PBKDF2-SHA256 proposed for credentials; HMAC-SHA256 proposed for webhook signing.
- Four role values; one role per contractor; role can change.
- No Branch / Region.

**Pending (not invented)**
- Exact PBKDF2 parameters + stored-hash format / password normalization.
- Exact contractor field list (and crew structure if required).
- Exact Partner API authentication details/credentials and the contractor path.
- Exact webhook URL/environment, timestamp unit, secret provisioning.
- Final role → TEMA permission mapping.
- Initial-load approach (batch vs CSV) + CSV column layout.
- Dev/UAT/Prod credentials and endpoints; real interoperability test with WorkSuite.
