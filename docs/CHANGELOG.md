# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Added
- MIT License file
- `README.md` — project overview, quick start, feature summary, API table
- `CONTRIBUTING.md` — development setup, code style, PR checklist
- `SECURITY.md` — vulnerability disclosure policy, security model
- `ARCHITECTURE.md` — system design, data flow, schema reference, technology choices
- `API.md` — full REST API reference with request/response examples
- `FEDERATION_PROTOCOL.md` — complete specification for the `fedhost/1.0` protocol
- `DEPLOYMENT.md` — production setup guide, nginx config, scaling notes, federation joining

---

## [0.3.0] — Phase 4: Production Hardening

### Added
- **Helmet** — CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy headers on every response
- **Rate limiting** — global 200 req/min; 20 req/min on auth and upload endpoints; 50 req/min on federation endpoints
- **Gzip compression** — all responses compressed via `compression`
- **Structured logging** — pino JSON logger with request IDs; pino-http request/response logging; `privateKey` and `password` fields auto-redacted
- **X-Request-ID** — every request gets a UUID; echoed in response header for tracing
- **AppError class** — typed error class with `statusCode`, `code`, `isOperational`; used throughout all route handlers
- **asyncHandler** — wraps async route handlers so thrown errors propagate to the global error handler; eliminates try/catch boilerplate
- **Global error handler** — structured JSON error responses; no stack traces in production
- **404 handler** — clean JSON response for unmatched routes
- **Pagination** — all list endpoints (`GET /nodes`, `GET /sites`, `GET /federation/peers`, `GET /federation/events`) now accept `?page=&limit=` and return `{ data, meta }`
- **DB transaction on deploy** — deployment creation, file assignment, and site update are wrapped in a single atomic transaction
- **DB indexes** — added indexes on `sites.ownerId`, `sites.status`, `sites.primaryNodeId`, `nodes.status`, `nodes.isLocalNode`, `site_deployments.siteId`, `site_deployments.status`, `site_files.siteId`, `site_files.(siteId, filePath)`, `site_files.deploymentId`, `federation_events.eventType`, `federation_events.fromNodeDomain`, `federation_events.createdAt`
- **File path sanitisation** — `path.normalize` + strip leading `..` on all file paths to prevent directory traversal
- **File size limits** — 50 MB per-file, 500 MB per-deployment enforced server-side
- **Allowed content types whitelist** — rejects uploads with non-whitelisted MIME types
- **Graceful shutdown** — `SIGTERM`/`SIGINT` drains in-flight requests and closes DB pool cleanly
- **unhandledRejection / uncaughtException handlers** — logs and exits cleanly on unrecoverable errors
- **ErrorBoundary component** — React error boundary wrapping all routes; shows friendly fallback UI with "Try Again" button
- **QueryCache / MutationCache error handlers** — auto-redirect to `/api/login` on 401; exponential retry backoff; no retries on 4xx errors
- **Health endpoints** — `/api/health` (full), `/api/health/live` (liveness), `/api/health/ready` (readiness)
- **Auth rate limiting** — `/api/login` now protected by auth rate limiter (20 req/min)
- **pino-pretty** dev dependency — pretty-printed logs in development

### Changed
- `siteDeploymentsTable` — added `createdAt` column alongside `deployedAt`
- Deploy route now uses `count()` query inside transaction instead of a separate pre-transaction query
- Federation ping now signs `${nodeDomain}:${challenge}:${timestamp}` (timestamp added to message)
- `GET /api/healthz` renamed to `GET /api/health` with expanded response body

---

## [0.2.0] — Phase 3: Subdomain Routing + Replication

### Added
- **Host-header routing middleware** (`middleware/hostRouter.ts`) — any request whose `Host` matches a registered site domain is served directly, without going through `/api/sites/serve`
- **Replication on deploy** — deploy endpoint iterates all active peer nodes and sends signed `site_sync` notifications via `X-Federation-Signature`
- **Node capacity API** — `GET /api/capacity/summary` (network overview), `GET /api/nodes/:id/capacity` (per-node storage stats), `POST /api/nodes/:id/update-capacity`
- **Auto-init local node** — `ensureLocalNode()` in `index.ts` creates a local node record with Ed25519 keys on every boot if none exists
- **SPA fallback** — host-header site server falls back to `index.html` if the requested path is not found (supports single-page apps)

---

## [0.1.0] — Phase 2: Federation Protocol

### Added
- **Ed25519 key pairs** — `crypto.generateKeyPairSync("ed25519")` for node identity; stored in `nodes` table
- **`/.well-known/federation`** — public discovery endpoint returning node metadata, public key, capabilities
- **`POST /api/federation/handshake`** — initiates a signed handshake with a remote node; records result in `federation_events`
- **`POST /api/federation/ping`** — receives and verifies an Ed25519-signed ping from a peer node
- **`POST /api/nodes/:id/generate-keys`** — generate or rotate Ed25519 key pair
- **`federation_events` table** — persistent log of all handshake, ping, sync, offline, and key rotation events
- **`GET /api/federation/peers`** — list remote peer nodes
- **`GET /api/federation/events`** — federation event log
- **`POST /api/federation/notify-sync`** — manually trigger sync notification to all active peers
- **Federation Protocol page** — UI for node identity, handshake initiation, event log, and API reference

---

## [0.0.1] — Phase 1: Auth + File Serving

### Added
- **Replit Auth** — OpenID Connect + PKCE login flow; users own sites and deployments
- **Object storage** — presigned URL upload flow; file bytes go directly to storage, not through the API server
- **Site serving** — `GET /api/sites/serve/:domain/*` streams files from object storage by domain + path
- **Database schema** — `users`, `sessions`, `sites`, `site_deployments`, `site_files`, `nodes` tables
- **React frontend** — Dashboard, My Sites, Deploy Site (drag-and-drop uploader), Node List, Node Detail, Site List, Site Detail pages
- **Federation Protocol page** — initial version with node list and basic metadata
- **pnpm monorepo** — TypeScript project references; shared `@workspace/db`, `@workspace/api-zod`, `@workspace/api-client-react`
- **OpenAPI 3.1 spec** — source of truth for all API shapes; Orval codegen for Zod validators and React Query hooks
