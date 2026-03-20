# Federated Hosting — Roadmap

A living document tracking what is built, what is in progress, and what must be completed before real production traffic.

**Read `docs/HONEST_ASSESSMENT.md` before using this roadmap.** Many items previously marked ✅ are working in development but have known production gaps.

---

## Legend

- ✅ Functional and tested
- ⚠️ Implemented but has known production gap (see HONEST_ASSESSMENT.md)
- 🔨 In active development
- 📋 Planned
- ❌ Documented/claimed but not actually implemented
- 🔮 Future

---

## Phase 1 — Foundation

| Feature | Status | Notes |
|---|---|---|
| PostgreSQL schema + Drizzle ORM | ✅ | Good schema, correct indexes |
| Replit Auth (OIDC) | ✅ | Browser flows work |
| Ed25519 key pair generation + signing | ✅ | Correct implementation |
| `/.well-known/federation` discovery | ✅ | |
| Federation handshake + ping | ⚠️ | Replay attack window not enforced |
| Node health monitor | ⚠️ | Marks offline after 1 failure — needs N=3 threshold |
| Object storage (file upload/download) | ⚠️ | **Replit sidecar only — S3/MinIO non-functional** |
| Site file serving (host-header routing) | ⚠️ | 2-3 DB queries per request, no caching |
| Capacity tracking | ✅ | |
| Rate limiting | ⚠️ | **In-memory only — broken in multi-instance** |
| Structured logging + error handling | ✅ | Pino, AppError, stack traces redacted in prod |
| Graceful shutdown | ✅ | |
| DB connection pool | ⚠️ | No max/timeout config |
| Database migrations | ❌ | **Zero migration files — only `db push`** |

---

## Phase 2 — User Product

| Feature | Status | Notes |
|---|---|---|
| Dashboard (stats, chart) | ✅ | |
| Federation Nodes + Sites pages | ✅ | |
| My Sites (auth, inline register) | ✅ | |
| Deploy page (upload, preview, rollback) | ✅ | |
| Site preview modal (iframe sandbox) | ✅ | |
| Federation Protocol page | ✅ | |
| Onboarding flow | ✅ | |
| Node Marketplace | ✅ | |
| API Reference page | ✅ | |
| Bahasa Indonesia i18n | ⚠️ | Translations complete but bundled synchronously |
| React lazy loading | ✅ | All 14 routes code-split |

---

## Phase 3 — Access Control + Custom Domains

| Feature | Status | Notes |
|---|---|---|
| API tokens (Bearer auth) | ✅ | SHA-256 hashed |
| Site team members (owner/editor/viewer) | ✅ | |
| Site visibility (public/private) | ✅ | |
| Password-protected sites | ⚠️ | **Cookie not server-verified — security gap** |
| Custom domain CNAME+TXT verification | ✅ | |
| Custom domain routing in host router | ✅ | Subject to caching gap above |

---

## Phase 4 — Federation Replication

| Feature | Status | Notes |
|---|---|---|
| Site sync push (notify peers on deploy) | ✅ | Ed25519 signed |
| Federation manifest endpoint | ✅ | Presigned URLs valid 1 hour |
| Site sync pull (file replication) | ⚠️ | Works but no retry queue — failed syncs are lost |
| Gossip-based peer discovery | ⚠️ | Works but no Redis sharing in multi-instance |
| Same-domain conflict resolution | ✅ | First-write-wins + pubkey tiebreaker |
| Bootstrap node registry | ✅ | |

---

## Phase 5 — Analytics + Admin

| Feature | Status | Notes |
|---|---|---|
| Analytics buffer → hourly rollup | ⚠️ | **Bulk delete uses unsafe SQL — use inArray()** |
| Per-site analytics page | ✅ | |
| Network-wide analytics | ✅ | |
| Node operator admin dashboard | ⚠️ | **No RBAC — any authenticated user can access** |
| Admin node settings | ⚠️ | No RBAC |
| Webhook notifications (Ed25519 signed) | ✅ | |

---

## Phase 6 — CLI + Infrastructure

| Feature | Status | Notes |
|---|---|---|
| `fh` CLI (init, deploy, rollback, status, analytics, sites, tokens) | ✅ | Works against running node |
| `@fedhost/cli` npm package | ⚠️ | Package structured correctly, not published |
| GitHub Actions deploy workflow | ✅ | |
| GitHub Actions CI (typecheck, lint, build) | ✅ | |
| GitHub Actions npm publish workflow | ✅ | Needs `NPM_TOKEN` secret |
| Docker Compose | ⚠️ | **App cannot talk to MinIO — storage abstraction broken** |
| Dockerfile (multi-stage) | ✅ | |

---

## Phase 7 — TLS + Geographic Routing

| Feature | Status | Notes |
|---|---|---|
| ACME/Let's Encrypt automation | ❌ | **Issues challenge token only — never gets cert** |
| TLS via Caddy (documented) | ✅ | Caddy instruction accurate |
| Geographic routing (closest-node redirect) | ✅ | Region inference + 302 redirect |
| Geo routing: latency probing | ❌ | Mentioned in code comment, not implemented |

---

## Must Fix Before Production (Priority Order)

| # | Issue | Severity | Est. Work |
|---|---|---|---|
| 1 | Rewrite objectStorage.ts with real S3 support | CRITICAL | 2–3 weeks |
| 2 | Generate + commit Drizzle migrations | CRITICAL | 1 day |
| 3 | Redis for rate limiting + session sharing | CRITICAL | 3–5 days |
| 4 | Fix unlock cookie verification (HMAC-signed) | HIGH | 1 day |
| 5 | Add admin RBAC (isAdmin flag) | HIGH | 2 days |
| 6 | Host router LRU cache (domain → siteId) | HIGH | 2 days |
| 7 | DB pool configuration (max, timeouts) | MEDIUM | 2 hours |
| 8 | Session expiry cleanup job | MEDIUM | 2 hours |
| 9 | Fix analytics bulk delete → `inArray()` | MEDIUM | 30 min |
| 10 | Health monitor N=3 consecutive failure threshold | MEDIUM | 2 hours |
| 11 | Replay attack: enforce 5-min timestamp window | MEDIUM | 2 hours |
| 12 | Mark ACME as non-functional or implement it | MEDIUM | 2 weeks |
| 13 | Admin audit logging | MEDIUM | 1 day |
| 14 | Lazy-load i18n translations | LOW | 2 hours |
| 15 | Federation sync retry queue | MEDIUM | 1 week |
| 16 | Content deduplication for site files | LOW | 3 days |
| 17 | Prometheus metrics endpoint | LOW | 1 day |

---

## Scaling Checklist (Pre-10K Users)

- [ ] Redis deployed and all stores configured
- [ ] Object storage working with S3/MinIO
- [ ] Migrations committed and tested
- [ ] Host router LRU cache in place
- [ ] Load test: 100 req/s sustained for 1 hour — measure p99 latency
- [ ] Database query analysis: `EXPLAIN ANALYZE` all hot paths
- [ ] CDN in front of reverse proxy
- [ ] Horizontal scaling tested (2+ API server instances)
- [ ] Federation sync reliability test: simulate node downtime + recovery

---

## Future Work

| Feature | Status | Notes |
|---|---|---|
| Paid plans / node sponsorship | 🔮 | Revenue model not designed |
| Prometheus metrics + Grafana dashboards | 🔮 | |
| OpenTelemetry distributed tracing | 🔮 | |
| Virtual scrolling for large lists | 🔮 | |
| CDN integration guide | 🔮 | |
| Multi-region PostgreSQL (read replicas) | 🔮 | |
| Content deduplication (file hash) | 🔮 | |

---

*Last updated: March 2026. This document is intentionally critical — see `docs/HONEST_ASSESSMENT.md`.*
