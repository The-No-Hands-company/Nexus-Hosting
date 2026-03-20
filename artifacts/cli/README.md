# @fedhost/cli

The official CLI for [Federated Hosting](https://github.com/The-No-Hands-company/Federated-Hosting) — deploy static sites to any FedHost node from your terminal or CI pipeline.

## Install

```bash
npm install -g @fedhost/cli
# or
pnpm add -g @fedhost/cli
```

## Quick Start

```bash
# 1. Authenticate to your node
fh login --node https://your-node.example.com

# 2. Create a site
fh sites create --name "My Site" --domain mysite.example.com

# 3. Deploy your built files
fh deploy ./dist --site 42

# 4. Check it's live
fh status
```

## Commands

| Command | Description |
|---------|-------------|
| `fh login` | Authenticate to a FedHost node |
| `fh logout` | Remove stored credentials |
| `fh status` | Show node health and federation network status |
| `fh deploy <dir>` | Upload and deploy a directory |
| `fh rollback` | Roll back to a previous deployment |
| `fh analytics` | View site traffic analytics |
| `fh sites list` | List your sites |
| `fh sites create` | Register a new site |
| `fh sites info <id>` | Show site details |
| `fh tokens list` | List API tokens |
| `fh tokens revoke <id>` | Revoke an API token |

## Deploy Options

```bash
fh deploy ./dist --site 42
  --site, -s <id>           Site ID to deploy to (required)
  --dry-run                 List files that would be uploaded
  --concurrency, -c <n>     Parallel uploads (default: 4, max: 10)
```

## GitHub Actions

Add to your workflow to auto-deploy on push:

```yaml
- name: Deploy to FedHost
  run: |
    npm install -g @fedhost/cli
    fh login --node ${{ secrets.FH_NODE_URL }} --token ${{ secrets.FH_TOKEN }}
    fh deploy ./dist --site ${{ secrets.FH_SITE_ID }}
```

A ready-made workflow is available at `.github/workflows/deploy.yml` in the [main repo](https://github.com/The-No-Hands-company/Federated-Hosting/blob/main/.github/workflows/deploy.yml).

## Authentication

The CLI uses long-lived API tokens. Create one from the FedHost UI under **My Sites → API Tokens → New Token**, or via another token:

```bash
fh login --node https://node.example.com --token fh_your_token_here
```

Tokens are stored locally using [`conf`](https://github.com/sindresorhus/conf) in your OS config directory.

## License

MIT — [The No Hands Company](https://github.com/The-No-Hands-company)
