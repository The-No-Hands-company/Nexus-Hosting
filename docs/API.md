# API Reference

**Base URL:** `https://your-node/api`  
**Protocol:** HTTP/1.1 and HTTP/2  
**Format:** JSON (`Content-Type: application/json`)  
**Auth:** Session cookie (`sid`) set by `/api/login` flow

All list endpoints support pagination via `?page=<n>&limit=<n>`.  
Paginated responses return: `{ data: [...], meta: { total, page, limit, totalPages, hasNextPage, hasPrevPage } }`

---

## Health

### `GET /api/health`

Full health check. Returns service status and database latency.

**Response `200`**
```json
{
  "status": "healthy",
  "uptime": 3600,
  "timestamp": "2025-01-01T00:00:00.000Z",
  "version": "0.0.0",
  "environment": "production",
  "services": {
    "database": { "status": "ok", "latencyMs": 2 }
  }
}
```

**Response `503`** — database unreachable; `status` is `"degraded"`.

---

### `GET /api/health/live`

Liveness probe. Returns 200 as long as the process is running.

```json
{ "status": "alive", "uptime": 3600 }
```

---

### `GET /api/health/ready`

Readiness probe. Returns 200 only if the database is reachable.

```json
{ "status": "ready" }
```

---

## Auth

### `GET /api/auth/user`

Returns the currently authenticated user.

**Response `200`**
```json
{
  "id": "user_abc123",
  "name": "Alice",
  "email": "alice@example.com",
  "profileImage": "https://..."
}
```

**Response `401`** — not authenticated.

---

### `GET /api/login`

Redirects the browser to the Replit Auth OIDC login page.

**Query params:**
- `returnTo` — path to redirect to after login (must start with `/`)

---

### `GET /api/callback`

OIDC callback — do not call directly. The auth provider redirects here after login.

---

### `GET /api/logout`

Clears the session and redirects to `/`.

---

## Nodes

### `GET /api/nodes`

List all nodes (paginated).

**Query params:** `page`, `limit`

**Response `200`**
```json
{
  "data": [
    {
      "id": 1,
      "name": "Primary Node",
      "domain": "node1.example.com",
      "status": "active",
      "region": "us-east",
      "maxStorageGb": 500,
      "usedStorageGb": 42.3,
      "siteCount": 17,
      "joinedAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "meta": { "total": 5, "page": 1, "limit": 20, "totalPages": 1, "hasNextPage": false, "hasPrevPage": false }
}
```

---

### `POST /api/nodes`

Register a new node.

**Body**
```json
{
  "name": "My Node",
  "domain": "node.example.com",
  "region": "eu-west",
  "maxStorageGb": 200
}
```

**Response `201`** — created node object.

---

### `GET /api/nodes/:id`

Get a single node by ID.

---

### `PUT /api/nodes/:id`

Update a node's name, region, or capacity.

---

### `GET /api/nodes/:id/capacity`

Per-node storage and bandwidth statistics.

**Response `200`**
```json
{
  "nodeId": 1,
  "usedStorageGb": 42.3,
  "maxStorageGb": 500,
  "usedPercent": 8.46,
  "siteCount": 17
}
```

---

### `POST /api/nodes/:id/generate-keys`

Generate (or rotate) the Ed25519 key pair for a node. The private key is stored in the DB and used for signing; the public key is returned and published at `/.well-known/federation`.

**Response `200`**
```json
{
  "nodeId": 1,
  "publicKey": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----",
  "message": "Ed25519 key pair generated. Private key stored securely."
}
```

---

## Sites

### `GET /api/sites`

List all sites (paginated).

**Query params:** `page`, `limit`

---

### `POST /api/sites`

Create a new site.

**Body**
```json
{
  "name": "My Blog",
  "domain": "my-blog.example.com",
  "description": "A personal blog",
  "type": "blog"
}
```

**Response `201`** — created site object.

**Response `409`** — domain already in use.

---

### `GET /api/sites/:id`

Get a single site by ID.

---

### `PUT /api/sites/:id`

Update site metadata.

---

### `DELETE /api/sites/:id`

Delete a site and all its files.

---

## Deploy

### `POST /api/sites/:id/files/upload-url`

Get a presigned upload URL for a single file. The client uploads directly to object storage using this URL — file bytes never pass through the API server.

**Auth:** Required  
**Rate limit:** 20 req/min

**Body**
```json
{
  "filePath": "index.html",
  "contentType": "text/html",
  "size": 4096
}
```

**Response `200`**
```json
{
  "uploadUrl": "https://storage.example.com/upload?token=...",
  "objectPath": "private/abc123.html",
  "filePath": "index.html"
}
```

---

### `POST /api/sites/:id/files`

Register a file that has already been uploaded to object storage.

**Auth:** Required

**Body**
```json
{
  "filePath": "index.html",
  "objectPath": "private/abc123.html",
  "contentType": "text/html",
  "sizeBytes": 4096
}
```

**Response `201`** — created file record.

---

### `GET /api/sites/:id/files`

List all files registered for a site.

---

### `POST /api/sites/:id/deploy`

Deploy the site — atomically assigns all pending files to a new deployment version, updates site stats, and notifies federation peers.

**Auth:** Required

**Response `200`**
```json
{
  "id": 7,
  "siteId": 3,
  "version": 2,
  "deployedBy": "user_abc123",
  "status": "active",
  "fileCount": 12,
  "totalSizeMb": 1.4,
  "replication": {
    "peers": 3,
    "synced": 3,
    "results": [
      { "node": "node2.example.com", "success": true },
      { "node": "node3.example.com", "success": true }
    ]
  }
}
```

**Response `400 NO_FILES`** — no pending files to deploy.  
**Response `400 DEPLOYMENT_TOO_LARGE`** — total size exceeds 500 MB.

---

### `GET /api/sites/:id/deployments`

List all deployments for a site, ordered by creation time.

---

### `GET /api/sites/serve/:domain/*filePath`

Serve a file from a deployed site. This is called automatically by the host-header router — you do not typically need to call it directly.

---

## Federation

### `GET /.well-known/federation`

Node discovery endpoint. Returns node identity and capabilities. Public — no auth required.

```json
{
  "protocol": "fedhost/1.0",
  "name": "My Node",
  "domain": "node1.example.com",
  "region": "us-east",
  "publicKey": "base64-encoded-ed25519-public-key",
  "nodeCount": 5,
  "activeSites": 42,
  "joinedAt": "2025-01-01T00:00:00.000Z",
  "capabilities": ["site-hosting", "node-federation", "key-verification", "site-replication"]
}
```

---

### `GET /api/federation/meta`

Same data as `/.well-known/federation` but under the `/api/` prefix.

---

### `POST /api/federation/ping`

Verify another node's identity via Ed25519 signature. Called by remote nodes during handshake.

**Rate limit:** 50 req/min

**Body**
```json
{
  "nodeDomain": "node2.example.com",
  "challenge": "random-hex-string",
  "signature": "base64-signature",
  "timestamp": "1700000000000"
}
```

The server verifies: `Ed25519.verify(publicKey, "${nodeDomain}:${challenge}:${timestamp}", signature)`

**Response `200`**
```json
{
  "verified": true,
  "protocol": "fedhost/1.0",
  "challenge": "new-challenge-for-mutual-verification"
}
```

**Response `401 INVALID_SIGNATURE`** — signature did not verify.  
**Response `404`** — node not registered or has no public key.

---

### `POST /api/federation/handshake`

Initiate a handshake with a remote node — fetches its discovery doc, signs a challenge, and sends a ping.

**Body**
```json
{ "targetNodeUrl": "https://node2.example.com" }
```

**Response `200`**
```json
{
  "success": true,
  "targetUrl": "https://node2.example.com",
  "discoveryData": { "protocol": "fedhost/1.0", "publicKey": "..." },
  "pingResult": { "verified": true },
  "error": null
}
```

---

### `GET /api/federation/peers`

List federation peers (remote nodes, not the local node). Paginated.

---

### `GET /api/federation/events`

Federation event log, newest first. Paginated.

```json
{
  "data": [
    {
      "id": 42,
      "eventType": "site_sync",
      "fromNodeDomain": "node1.example.com",
      "toNodeDomain": "node2.example.com",
      "payload": "{\"siteDomain\":\"my-blog.example.com\",\"deploymentId\":7}",
      "verified": 1,
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "meta": { "total": 128, "page": 1, "limit": 20, "totalPages": 7 }
}
```

---

### `POST /api/federation/notify-sync`

Manually trigger a sync notification to all active peers for a given deployment.

**Body**
```json
{ "siteId": 3, "deploymentId": 7 }
```

---

## Capacity

### `GET /api/capacity/summary`

Network-wide capacity overview across all nodes.

**Response `200`**
```json
{
  "totalNodes": 5,
  "activeNodes": 4,
  "totalStorageGb": 2000,
  "usedStorageGb": 312.4,
  "availableStorageGb": 1687.6,
  "usedPercent": 15.62,
  "totalSites": 89
}
```

---

## Error Responses

All errors follow this shape:

```json
{
  "status": "error",
  "code": "MACHINE_READABLE_CODE",
  "message": "Human-readable description.",
  "requestId": "uuid-of-the-request"
}
```

| HTTP Status | Meaning |
|-------------|---------|
| `400` | Bad request — invalid input |
| `401` | Unauthenticated — login required |
| `403` | Forbidden — authenticated but not allowed |
| `404` | Resource not found |
| `409` | Conflict — e.g. domain already in use |
| `413` | Payload too large |
| `429` | Rate limited |
| `500` | Internal server error |
| `503` | Service unavailable — database unreachable |
