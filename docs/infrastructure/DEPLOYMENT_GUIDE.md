# HomeHub Google Cloud Production Deployment Guide

## 1. Authoritative Cloud Architecture (Google Cloud)

HomeHub deploys on Google Cloud as a unified containerized architecture. PostgreSQL + Drizzle ORM remains the sole authoritative datastore. Firebase/Firestore is strictly prohibited as an application datastore.

```text
Internet / DNS / HTTPS (homehub.iq, app.homehub.iq)
        │
        ▼ (TLS 1.3 / Cloud Armor / Google-managed SSL Certificate)
Global External Application Load Balancer
        │
        ▼ (Serverless NEG)
Cloud Run Services (Region: europe-west3)
        ├── homehub-api (Port 3000 | non-root UID 10001 | tini init | ingress: internal-and-cloud-load-balancing)
        │       ├── Probes: /api/liveness, /api/health, /api/readiness
        │       └── Direct VPC Egress (--network=homehub-prod-vpc --subnet=homehub-prod-subnet --vpc-egress=private-ranges-only)
        │
        ├── homehub-worker (Background queue & outbox processor | concurrency: 1 | execution: node dist/server.cjs --worker-mode)
        │       └── Direct VPC Egress (--network=homehub-prod-vpc --subnet=homehub-prod-subnet --vpc-egress=private-ranges-only)
        │
        ├──▶ Cloud SQL for PostgreSQL 16 (Authoritative Backend — Private IP Only)
        │       ├── Direct VPC Egress to Cloud SQL Private IP (Private Services Access 10.0.64.0/20)
        │       ├── Automated daily backups + Point-In-Time Recovery (PITR) WAL archiving
        │       ├── Zero public IP / Zero fallback
        │       └── Advisory locked Drizzle migrations (Lock ID: 849204829)
        │
        ├──▶ Memorystore for Redis 7 (Transactional Outbox & BullMQ Queues — Private IP Only)
        │       ├── Direct VPC Egress (Private IP on port 6378 | In-transit TLS | Redis AUTH)
        │       └── Zero plaintext fallback / Zero public exposure
        │
        ├──▶ Cloud Storage (Private Document & KYC Vault)
        │       ├── Public Access Prevention enforced
        │       ├── Uniform bucket-level access enabled
        │       └── HMAC-SHA256 presigned download/upload URLs (15-min TTL)
        │
        ├──▶ Secret Manager (11 Required + 1 Optional = 12 Total Secrets)
        │       ├── SQL_PASSWORD, REDIS_PASSWORD, REDIS_CA_CERT, SESSION_SECRET, STORAGE_SIGNING_SECRET
        │       ├── GEMINI_API_KEY (API-only; denied to worker)
        │       └── Provider Webhook Secrets (FastSMS, Asiacell, Zain, SendGrid)
        │
        └──▶ Cloud Logging & Cloud Monitoring
                ├── Structured JSON audit trails & request correlation IDs
                └── Automated Alert Policies (5xx spike, DB down, DLQ growth)
```

### 1.1 Authoritative Outbound Egress & Networking Model

HomeHub mandates **Direct VPC Egress** configured with `--vpc-egress=private-ranges-only` for all Cloud Run services (`homehub-api`, `homehub-worker`) and jobs (`homehub-migrate`, `homehub-backup`).

#### Outbound Destination Routing Matrix:

| Destination Service | Destination IP Type | Outbound Route | Protocol / Security |
| :--- | :--- | :--- | :--- |
| **Cloud SQL (PostgreSQL 16)** | Private RFC 1918 (`10.0.64.0/20`) | Direct VPC Egress (`homehub-prod-subnet`) | Private Services Access (PSA) peering, TLS |
| **Memorystore Redis 7** | Private RFC 1918 (`10.0.1.x` on `10.0.1.0/24`) | Direct VPC Egress (`homehub-prod-subnet`) | In-transit TLS on port 6378, Redis AUTH |
| **Google Cloud Storage** | Google API (`storage.googleapis.com`) | Google Internal Network / Private Google Access | TLS 1.3, IAM OAuth2, Presigned URLs |
| **Google Secret Manager** | Google API (`secretmanager.googleapis.com`) | Google Internal Network / Private Google Access | TLS 1.3, IAM OAuth2 |
| **Google Gemini API** | Google GenAI API (`generativelanguage.googleapis.com`) | Direct Public Egress from Cloud Run | TLS 1.3, Header API Key |
| **FastSMS Iraq Gateway** | Public HTTPS Endpoint | Direct Public Egress from Cloud Run | TLS 1.3, Header API Key |
| **Asiacell SMS Gateway** | Public HTTPS Endpoint | Direct Public Egress from Cloud Run | TLS 1.3, Header API Key / HMAC |
| **Zain SMS Gateway** | Public HTTPS Endpoint | Direct Public Egress from Cloud Run | TLS 1.3, Header API Key / HMAC |
| **SendGrid Email API** | Public HTTPS Endpoint (`api.sendgrid.com`) | Direct Public Egress from Cloud Run | TLS 1.3, Bearer API Key |

#### Architectural Egress Invariant:
- `--vpc-egress=private-ranges-only` ensures only traffic destined for internal private subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) traverses the VPC.
- Outbound traffic to public internet APIs (SMS gateways, SendGrid, Gemini) exits directly via Google Cloud Run's native public egress infrastructure.
- **Cloud NAT is NOT utilized or required** for Cloud Run in this architecture. External services authenticate cryptographically via TLS 1.3 and API keys/signatures without requiring fixed IP whitelisting. This avoids NAT single-point-of-failure risks, bandwidth bottlenecks, and unnecessary data-processing costs.

---

## 2. Environment Separation Invariants

| Environment | Purpose | Database Isolation | Secrets Policy |
| :--- | :--- | :--- | :--- |
| **Development** | Local feature authoring | Ephemeral local DB / Docker Compose | `.env.development` (Never used in Prod) |
| **Staging** | Pre-production integration & smoke testing | Dedicated Cloud SQL Staging Instance | Staging Secret Manager (`projects/homehub-staging`) |
| **Production** | Live tenant & property operations | Isolated Cloud SQL Production Instance | Production Secret Manager (`projects/homehub-production`) |

### Strict Rules:
1. **No Mixed Databases**: Staging database access from production application is strictly prohibited.
2. **Zero Secrets in Version Control**: Production secrets must never be committed to git or baked into Docker layers.
3. **Provider Isolation**: Non-production providers must never receive production traffic or real Iraqi phone numbers.
4. **Clean Production Data**: Test data must never enter production tables.

---

## 3. Secret Manager Authoritative Inventory (11 Required + 1 Optional = 12 Total)

All production credentials and provider secrets are managed in Google Secret Manager and mounted as environment variables at container launch:

| # | Secret Name (Secret Manager ID) | Environment Variable | Consuming Identity | Status | Least-Privilege Isolation |
| :-: | :--- | :--- | :--- | :--- | :--- |
| 1 | `homehub-db-password` | `DB_PASSWORD` | `sa-homehub-api`, `sa-homehub-worker` | **REQUIRED** | Scoped to `homehub_app` role |
| 2 | `homehub-db-migration-password` | `DB_MIGRATION_PASSWORD` | `sa-homehub-migrate` | **REQUIRED** | Scoped to `homehub_migration` role |
| 3 | `homehub-db-backup-password` | `DB_BACKUP_PASSWORD` | `sa-homehub-backup` | **REQUIRED** | Scoped to `homehub_backup` role |
| 4 | `homehub-redis-auth` | `REDIS_PASSWORD` | `sa-homehub-api`, `sa-homehub-worker` | **REQUIRED** | Memorystore AUTH token |
| 5 | `homehub-redis-ca-cert` | `REDIS_CA_CERT` | `sa-homehub-api`, `sa-homehub-worker` | **REQUIRED** | Memorystore TLS server CA |
| 6 | `homehub-session-secret` | `SESSION_SECRET` | `sa-homehub-api` | **REQUIRED** | Session signing / JWT verification |
| 7 | `homehub-storage-signing-secret` | `STORAGE_SIGNING_SECRET` | `sa-homehub-api` | **REQUIRED** | **API-only. HMAC-SHA256 signed document URLs. Worker strictly denied access** |
| 8 | `homehub-gemini-api-key` | `GEMINI_API_KEY` | `sa-homehub-api` | **REQUIRED** | **API-only. Worker strictly denied access** |
| 9 | `homehub-webhook-fastsms` | `WEBHOOK_SECRET_FASTSMS` | `sa-homehub-api` | **REQUIRED** | FastSMS Iraq HMAC webhook |
| 10 | `homehub-webhook-asiacell` | `WEBHOOK_SECRET_ASIACELL` | `homehub-api` | **REQUIRED** | Asiacell Iraq HMAC webhook |
| 11 | `homehub-webhook-zain` | `WEBHOOK_SECRET_ZAIN` | `sa-homehub-api` | **REQUIRED** | Zain Iraq HMAC webhook |
| 12 | `homehub-webhook-sendgrid` | `WEBHOOK_SECRET_SENDGRID` | `sa-homehub-api` | **OPTIONAL** | SendGrid webhook HMAC verification |

**Worker Least-Privilege Invariant**:
`sa-homehub-worker` is strictly denied access to `homehub-gemini-api-key`, `homehub-storage-signing-secret`, and all `homehub-webhook-*` secrets. Gemini AI assistance and document URL signing are strictly synchronous and API-bound.

All logs emitted by `src/server/config/env.ts` redact secret values with `[REDACTED]`. Frontend bundles (`dist/assets/`) are audited in CI/CD to ensure zero server secrets are exposed to clients.

---

## 4. Google Cloud IAM Least-Privilege Design

HomeHub utilizes distinct service accounts with minimal required roles:

| Service Account | Role Bindings | Purpose |
| :--- | :--- | :--- |
| `sa-homehub-api@...` | `roles/cloudsql.client`<br>`roles/secretmanager.secretAccessor`<br>`roles/storage.objectAdmin`<br>`roles/logging.logWriter`<br>`roles/monitoring.metricWriter` | Cloud Run API runtime identity |
| `sa-homehub-worker@...` | `roles/cloudsql.client`<br>`roles/secretmanager.secretAccessor` (DB/Redis only)<br>`roles/logging.logWriter`<br>`roles/monitoring.metricWriter` | Cloud Run Worker background processor identity |
| `sa-homehub-migrate@...` | `roles/cloudsql.client`<br>`roles/secretmanager.secretAccessor` (Migration DB only)<br>`roles/logging.logWriter` | Dedicated Drizzle migration runner (Cloud Run Job) |
| `sa-homehub-backup@...` | `roles/cloudsql.client`<br>`roles/secretmanager.secretAccessor` (Backup DB only)<br>`roles/storage.objectAdmin`<br>`roles/logging.logWriter` | Dedicated PostgreSQL backup runner (Cloud Run Job) |
| `sa-homehub-scheduler@...` | `roles/run.invoker` | Cloud Scheduler identity (invokes `homehub-backup` job only) |
| `sa-homehub-deploy@...` | `roles/run.admin`<br>`roles/artifactregistry.writer`<br>`roles/iam.serviceAccountUser` | CI/CD deployment identity |

---

## 5. Google Cloud Deployment Procedure

### Step 1: Pre-flight Migration Check & Dry-Run
```bash
# Verify journal ordering (0000 -> 0010) without executing queries
npm run db:migrate:dry
```

### Step 2: Build & Push Production Container via Cloud Build
```bash
# Submit manual build to Google Cloud Build (Region: europe-west3)
# Uses built-in $BUILD_ID; does not depend on local git or $COMMIT_SHA
gcloud builds submit \
  --config=cloudbuild.yaml \
  .

# Obtain the immutable production image digest (authority for deployment)
IMAGE_DIGEST=$(gcloud artifacts docker images describe \
  europe-west3-docker.pkg.dev/${PROJECT_ID}/homehub-registry/homehub-platform:latest \
  --format='value(image_summary.digest)')

export PRODUCTION_IMAGE="europe-west3-docker.pkg.dev/${PROJECT_ID}/homehub-registry/homehub-platform@${IMAGE_DIGEST}"
```

### Step 3: Run Database Migrations via Cloud Run Job
```bash
# Execute migrations on Cloud SQL with advisory lock 849204829
gcloud run jobs create homehub-migrate \
  --image="${PRODUCTION_IMAGE}" \
  --region=europe-west3 \
  --service-account=sa-homehub-migrate@${PROJECT_ID}.iam.gserviceaccount.com \
  --network=homehub-prod-vpc \
  --subnet=homehub-prod-subnet \
  --vpc-egress=private-ranges-only \
  --set-env-vars=NODE_ENV=production,SQL_DB_NAME=homehub_production \
  --set-secrets=SQL_PASSWORD=homehub-db-migration-password:latest \
  --command=node \
  --args=dist/server.cjs,--migrate

gcloud run jobs execute homehub-migrate --region=europe-west3 --wait
```

### Step 4: Deploy API Service to Cloud Run
```bash
gcloud run deploy homehub-api \
  --image="${PRODUCTION_IMAGE}" \
  --region=europe-west3 \
  --platform=managed \
  --service-account=sa-homehub-api@${PROJECT_ID}.iam.gserviceaccount.com \
  --network=homehub-prod-vpc \
  --subnet=homehub-prod-subnet \
  --vpc-egress=private-ranges-only \
  --ingress=internal-and-cloud-load-balancing \
  --port=3000 \
  --min-instances=1 \
  --max-instances=10 \
  --cpu=2 \
  --memory=2Gi \
  --timeout=30s \
  --concurrency=80 \
  --set-env-vars=NODE_ENV=production,SQL_DB_NAME=homehub_production,STORAGE_PROVIDER=gcs,STORAGE_BUCKET=homehub-production-vault \
  --set-secrets=SQL_PASSWORD=homehub-db-password:latest,REDIS_PASSWORD=homehub-redis-auth:latest,REDIS_CA_CERT=homehub-redis-ca-cert:latest,SESSION_SECRET=homehub-session-secret:latest,STORAGE_SIGNING_SECRET=homehub-storage-signing-secret:latest,GEMINI_API_KEY=homehub-gemini-api-key:latest,WEBHOOK_SECRET_FASTSMS=homehub-webhook-fastsms:latest,WEBHOOK_SECRET_ASIACELL=homehub-webhook-asiacell:latest,WEBHOOK_SECRET_ZAIN=homehub-webhook-zain:latest,WEBHOOK_SECRET_SENDGRID=homehub-webhook-sendgrid:latest
```

### Step 5: Deploy Worker Service to Cloud Run
```bash
gcloud run deploy homehub-worker \
  --image="${PRODUCTION_IMAGE}" \
  --region=europe-west3 \
  --platform=managed \
  --service-account=sa-homehub-worker@${PROJECT_ID}.iam.gserviceaccount.com \
  --network=homehub-prod-vpc \
  --subnet=homehub-prod-subnet \
  --vpc-egress=private-ranges-only \
  --ingress=internal \
  --min-instances=1 \
  --max-instances=3 \
  --concurrency=1 \
  --cpu=1 \
  --memory=1Gi \
  --no-cpu-throttling \
  --set-env-vars=NODE_ENV=production,SQL_DB_NAME=homehub_production \
  --set-secrets=SQL_PASSWORD=homehub-db-password:latest,REDIS_PASSWORD=homehub-redis-auth:latest,REDIS_CA_CERT=homehub-redis-ca-cert:latest \
  --command=node \
  --args=dist/server.cjs,--worker-mode
```

### Step 6: Deploy Backup Job & Cloud Scheduler
```bash
# Create Backup Job
gcloud run jobs create homehub-backup \
  --image="${PRODUCTION_IMAGE}" \
  --region=europe-west3 \
  --service-account=sa-homehub-backup@${PROJECT_ID}.iam.gserviceaccount.com \
  --network=homehub-prod-vpc \
  --subnet=homehub-prod-subnet \
  --vpc-egress=private-ranges-only \
  --set-env-vars=NODE_ENV=production,SQL_DB_NAME=homehub_production,STORAGE_BUCKET=homehub-production-vault \
  --set-secrets=SQL_PASSWORD=homehub-db-backup-password:latest \
  --command=npx \
  --args=tsx,scripts/backup.ts

# Configure Cloud Scheduler daily trigger at 03:00 UTC
gcloud scheduler jobs create http homehub-daily-backup \
  --location=europe-west3 \
  --schedule="0 3 * * *" \
  --time-zone="UTC" \
  --uri="https://europe-west3-run.googleapis.com/v2/projects/${PROJECT_ID}/locations/europe-west3/jobs/homehub-backup:run" \
  --http-method=POST \
  --oauth-service-account-email="sa-homehub-scheduler@${PROJECT_ID}.iam.gserviceaccount.com"
```

### Step 7: Validate Probes & Traffic
1. Validate `/api/readiness` returns HTTP 200 on revision URL:
   ```bash
   curl -fsS https://<REVISION_URL>/api/readiness
   ```
2. Shift 100% production traffic to new revision:
   ```bash
   gcloud run services update-traffic homehub-api --to-latest --region=europe-west3
   ```

---

## 6. PostgreSQL Schema Authority & Disaster Recovery Scope

- **Authoritative Table Count**: The PostgreSQL schema defines exactly **93 public base tables** (verified across `src/db/schema.ts` and migrations `0000_icy_daimon_hellstrom.sql` through `0010_communications_notifications_crm.sql`).
- **Production Dynamic Backup Runner**: `scripts/backup.ts` dynamically enumerates all public base tables via `information_schema.tables`, capturing 100% of the 93 tables, compressing with gzip, and generating a SHA-256 manifest.
- **Local Restore Drill Scope**: `scripts/restore.ts` and `tests/stage12-infrastructure-smoke.test.ts` execute a controlled 14-table integration validation drill (relational FK integrity, decompression, rollback safety) designed for testing without requiring a live 93-table instance.
- **Production Infrastructure Disaster Recovery**: Managed at the infrastructure level via Cloud SQL automated daily backups (30-day retention) and continuous point-in-time recovery (PITR via WAL archiving with 7-day retention). Target RPO: < 5 minutes. Target RTO: < 30 minutes.

---

## 7. Rollback Procedure

If unexpected regressions occur:
```bash
# Instantly roll back traffic to previous stable revision
gcloud run services update-traffic homehub-api \
  --to-revisions=homehub-api-<PREVIOUS_STABLE_REVISION>=100 \
  --region=europe-west3
```
Because database migrations follow strict additive backwards-compatibility invariants, the previous container revision remains fully compatible with the database schema.
