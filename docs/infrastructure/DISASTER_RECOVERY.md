# HomeHub Disaster Recovery & Emergency Runbook

## 1. Scope & Critical Invariants

HomeHub disaster recovery protocols guarantee business continuity, data integrity, and compliance across 9 core failure modes. At all times:
- **PostgreSQL is the Sole Authoritative Store**: No shadow or in-memory stores supersede PostgreSQL.
- **Fail-Closed Security**: When dependent systems fail, APIs return structured HTTP 503 errors rather than fabricating mock data or bypassing authorization.
- **AI is Strictly Advisory**: AI failures never impact operational transaction processing.

---

## 2. Failure Mode Recovery Matrix

### Scenario 1: Application Server Crash / Container Loss
- **Detection**: Load balancer health checks fail; `/health` returns timeout or connection refused.
- **Automated Mitigation**: Orchestrator (Kubernetes / ECS / Cloud Run) restarts container automatically using `tini` init wrapper.
- **Manual Escalation**:
  ```bash
  docker compose restart app
  ```
- **Verification**: `curl -fsS http://localhost:3000/liveness` returns 200 `status: alive`.

### Scenario 2: Background Worker Crash / Queue Stoppage
- **Detection**: `/readiness` checks report `queue: DEGRADED`; notification outbox depth increases.
- **Mitigation**: Workers run with bounded concurrency and heartbeat locks. If a worker dies, locks expire after 5 minutes and jobs are automatically re-queued.
- **Action**: Restart worker process. Stale jobs are automatically picked up by surviving workers.

### Scenario 3: Authoritative Database Loss
- **Detection**: `/readiness` probe returns HTTP 503 (`checks.database.status = FAILED`).
- **Mitigation**:
  1. Trigger standby replica promotion if multi-zone failover is enabled.
  2. If primary storage is corrupted, execute restore drill from latest verified backup:
     ```bash
     npx tsx scripts/restore.ts backups/latest-verified-backup.json.gz --restore
     ```
- **RTO Target**: 30 minutes.

### Scenario 4: Redis Outage
- **Detection**: `QueueService.checkQueueHealth()` logs Redis connection timeout.
- **Mitigation**: System automatically engages PostgreSQL transactional outbox fallback. No queued notifications are dropped in memory.
- **Action**: Restart Redis container (`docker compose restart redis`).

### Scenario 5: Object Storage Provider Outage
- **Detection**: `/api/storage/presigned-upload` returns HTTP 503 `STORAGE_NOT_CONFIGURED`.
- **Mitigation**: Fail-closed enforced. New uploads are rejected cleanly. Existing documents remain protected.
- **Action**: Verify storage endpoint connectivity and IAM bucket policies.

### Scenario 6: Deployment Failure / Regression
- **Detection**: Smoke tests or domain adversary suites fail post-deployment.
- **Rollback Procedure**:
  1. Re-route load balancer traffic to the previous immutable container image tag:
     ```bash
     docker tag ghcr.io/homehub/platform:sha-<PREVIOUS_SHA> current
     ```
  2. If database migration occurred, verify forward-compatibility. Never blindly roll back migrations that would truncate tables or drop columns containing live data.

### Scenario 7: Invalid Configuration / Missing Secret
- **Detection**: Application fails to start; `loadServerConfig()` logs missing required variables.
- **Mitigation**: Verify environment variables in Secret Manager against `src/server/config/env.ts`.

### Scenario 8: Secret Compromise & Rotation
- **Procedure**:
  1. Generate new credentials in Secret Manager.
  2. Update database/storage users with dual-credential overlap window.
  3. Deploy updated configuration and perform rolling container restart.
  4. Revoke compromised credentials once all instances are updated.

### Scenario 9: External Provider Outages (SendGrid / Twilio / FCM / Iraqi SMS)
- **Mitigation**: System classifies external providers as non-critical dependencies. `/readiness` remains HTTP 200, allowing core platform operations (rent, leasing, maintenance, disputes) to proceed. Failed notification deliveries enter bounded retry with exponential backoff and eventual dead-letter routing.
