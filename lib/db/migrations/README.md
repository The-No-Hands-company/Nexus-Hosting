# Database Migrations

Migrations use Drizzle Kit. Every schema change goes through a migration file — never `db push` in production.

## Workflow

```bash
# 1. Edit lib/db/src/schema/*.ts
# 2. Generate a new migration file
pnpm --filter @workspace/db run generate

# 3. Review the generated SQL
cat lib/db/migrations/<timestamp>_<name>.sql

# 4. Apply to database
pnpm --filter @workspace/db run migrate

# 5. Commit BOTH the schema change AND the migration file
git add lib/db/src/schema/ lib/db/migrations/
git commit -m "db: add X column to Y table"
```

## Files

| File | Description |
|------|-------------|
| `0000_initial_schema.sql` | Full schema from scratch — run on a fresh database |

## Production

In Docker Compose, the `migrate` service runs `pnpm --filter @workspace/db run migrate` before the app starts. This ensures migrations are always applied before the API server accepts traffic.

## Never use `db push` in production

`drizzle-kit push` directly mutates the live schema without creating a migration record. It can drop columns with data. Use it only in local development when you need to prototype schema changes quickly, then generate a proper migration before committing.
