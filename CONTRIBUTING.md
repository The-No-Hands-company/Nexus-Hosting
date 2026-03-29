# Contributing to Nexus Hosting

Nexus Hosting is a solo-developer project and contributions are genuinely welcome — from bug reports to running a federation node to code changes. There's no bureaucracy here.

---

## The most valuable thing you can do right now

**Run a node.** The federation protocol is built and working, but the network only has one node. If you spin up a node (even a cheap VPS or a Raspberry Pi), connect it to the federation, and deploy a test site — you will immediately surface more real bugs than any amount of code review. Open an issue with what you find, or DM to get peered.

---

## Code of Conduct

Be respectful and constructive. That's it.

---

## Getting Started

### 1. Fork and clone

```bash
git clone https://github.com/your-username/Nexus-Hosting.git
cd Nexus-Hosting
```

### 2. Install dependencies

```bash
# Requires pnpm 10+ and Node.js 24+
pnpm install
```

### 3. Set up environment

```bash
cp .env.example .env
# Minimum required for development:
# DATABASE_URL, ISSUER_URL, OIDC_CLIENT_ID, COOKIE_SECRET, PUBLIC_DOMAIN
# S3 creds: OBJECT_STORAGE_ENDPOINT + ACCESS_KEY + SECRET_KEY + BUCKET
```

### 4. Run migrations

```bash
pnpm --filter @workspace/db run migrate
```

### 5. Start dev servers

```bash
pnpm run dev  # API on :8080, frontend on :25231
```

Docker Compose is the fastest path if you have Docker:

```bash
docker compose up  # brings up Postgres, Redis, MinIO, and the app
```

---

## Repository Layout

```
artifacts/api-server/     Express 5 API + federation node
artifacts/nexus-hosting/  React + Vite frontend
artifacts/cli/            nh CLI (published as @nexushosting/cli)
lib/db/                   Drizzle ORM schema + migrations
lib/api-spec/             OpenAPI 3.1 spec (source of truth for all routes)
crates/nexus-proxy/       Rust static site proxy (Brotli, LRU, Redis)
docs/                     SELF_HOSTING, UPGRADE, INCIDENT_RESPONSE, etc.
monitoring/               Prometheus config + Grafana dashboards
load-tests/               autocannon load test suite
```

---

## Development Workflow

### Branches

- `main` — deployable at all times
- `feat/<name>` — new features
- `fix/<name>` — bug fixes
- `chore/<name>` — tooling, deps, docs

### Before opening a PR

```bash
# Type-check (required)
pnpm run typecheck

# Unit tests
cd artifacts/api-server && npx vitest run tests/unit/

# Check your route is in the OpenAPI spec
grep "your-new-route" lib/api-spec/openapi.yaml
```

### Commit messages

[Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`

---

## Code Style

### TypeScript

- All route handlers wrapped in `asyncHandler()` — no bare `async` handlers
- Throw `AppError` from routes: `AppError.notFound()`, `AppError.unauthorized()`, `AppError.badRequest("msg", "CODE")`
- Use the `logger` from `lib/logger.ts` — no `console.log` in production code
- Drizzle query builder for all DB queries — no raw SQL strings unless unavoidable
- Wrap multi-step DB operations in `db.transaction()`

### New routes

1. Add the route handler in `artifacts/api-server/src/routes/`
2. Register it in `artifacts/api-server/src/routes/index.ts`
3. Add the path to `lib/api-spec/openapi.yaml`
4. Add a unit test in `artifacts/api-server/tests/unit/` if the logic is non-trivial

### Schema changes

Edit `lib/db/src/schema/`, add an idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` to `lib/db/migrations/0000_initial_schema.sql`, then run migrations.

---

## Testing Federation Locally

To test two nodes federating with each other on one machine:

```bash
# Terminal 1 — Node A on port 8080
PORT=8080 DATABASE_URL=postgresql://localhost/nexus_a pnpm run dev

# Terminal 2 — Node B on port 8082
PORT=8082 DATABASE_URL=postgresql://localhost/nexus_b pnpm run dev

# Initiate handshake from Node A → Node B
curl -X POST http://localhost:8080/api/federation/handshake \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"targetNodeUrl": "http://localhost:8082"}'
```

---

## Reporting Bugs

Open a [GitHub issue](https://github.com/The-No-Hands-company/Nexus-Hosting/issues) with:

- Steps to reproduce
- Expected vs. actual behaviour
- Node.js version, OS, any relevant env details

For security issues, see [SECURITY.md](./SECURITY.md) — do not open a public issue.

---

## PR Checklist

- [ ] `pnpm run typecheck` passes
- [ ] New endpoints are in `lib/api-spec/openapi.yaml`
- [ ] New route handlers use `asyncHandler`
- [ ] Schema changes have a migration entry
- [ ] Unit tests added for non-trivial logic
- [ ] `docs/CHANGELOG.md` updated

---

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
