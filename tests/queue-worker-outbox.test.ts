import { injectPgliteMock } from './setup-pglite.js';
import { queueService, QueueService } from '../src/server/services/queue-service.js';

async function testQueueAndWorker() {
  console.log('================================================================');
  console.log('  HOMEHUB — QUEUE & WORKER TRANSACTIONAL OUTBOX TEST');
  console.log('================================================================');

  // 1. Health check
  console.log('\n--- 1. Queue Engine Health Check ---');
  const health = await queueService.checkQueueHealth();
  console.log('Queue Health Status:', JSON.stringify(health, null, 2));
  if (health.engine !== 'DATABASE_OUTBOX') {
    throw new Error(`Unexpected default engine: ${health.engine}`);
  }
  console.log('✅ PASS: Queue service reports authoritative default engine DATABASE_OUTBOX');

  // 2. Enqueue Job with Idempotency
  console.log('\n--- 2. Enqueue Job with Idempotency ---');
  const idempotencyKey = `idemp-outbox-${Date.now()}`;
  const job1 = await queueService.enqueueJob({
    topic: 'FINANCE_COMMISSION_CALCULATED',
    payload: { transactionId: 'tx-123', amount: 5000, commission: 250 },
    idempotencyKey,
    maxRetries: 3,
  });
  console.log(`✅ Job 1 enqueued: ${job1.id} (status: ${job1.status})`);

  // Enqueue same idempotencyKey -> must return existing job
  const jobDuplicate = await queueService.enqueueJob({
    topic: 'FINANCE_COMMISSION_CALCULATED',
    payload: { transactionId: 'tx-123', amount: 5000, commission: 250 },
    idempotencyKey,
  });
  if (jobDuplicate.id !== job1.id) {
    throw new Error('Idempotency failure: Duplicate job was created for existing idempotencyKey');
  }
  console.log(`✅ PASS: Deduplication verified. Second call returned identical job ${jobDuplicate.id}`);

  // 3. Process Job Successfully
  console.log('\n--- 3. Process Job Successfully ---');
  let processedPayload: any = null;
  const completedJob = await queueService.processJob(job1.id, async (payload) => {
    processedPayload = payload;
  });
  if (completedJob.status !== 'COMPLETED' || processedPayload.commission !== 250) {
    throw new Error(`Job processing failed. Status: ${completedJob.status}`);
  }
  console.log(`✅ PASS: Job ${completedJob.id} processed successfully. Status: ${completedJob.status}`);

  // 4. Bounded Retry & DLQ Routing
  console.log('\n--- 4. Bounded Retry & Dead Letter Queue (DLQ) Routing ---');
  const failingJob = await queueService.enqueueJob({
    topic: 'EXTERNAL_WEBHOOK_DELIVERY',
    payload: { webhookUrl: 'https://invalid.example.com/hook' },
    maxRetries: 2,
  });

  // Attempt 1 -> Fail
  const attempt1Job = await queueService.processJob(failingJob.id, async () => {
    throw new Error('Connection timeout 504');
  });
  if (attempt1Job.status !== 'QUEUED' || attempt1Job.attempts !== 1) {
    throw new Error(`Attempt 1 failed incorrectly. Status: ${attempt1Job.status}, attempts: ${attempt1Job.attempts}`);
  }
  console.log(`✅ Attempt 1 failed gracefully. Status: ${attempt1Job.status}, attempts: ${attempt1Job.attempts}`);

  // Attempt 2 -> Exceeds maxRetries -> Moves to DEAD_LETTER
  const dlqJob = await queueService.processJob(failingJob.id, async () => {
    throw new Error('Connection timeout 504 (permanent)');
  });
  if (dlqJob.status !== 'DEAD_LETTER' || dlqJob.attempts !== 2) {
    throw new Error(`DLQ routing failed. Status: ${dlqJob.status}, attempts: ${dlqJob.attempts}`);
  }
  console.log(`✅ PASS: Job exceeded max retries and moved to DEAD_LETTER. Status: ${dlqJob.status}, Error: ${dlqJob.lastError}`);

  // 5. Graceful Worker Shutdown
  console.log('\n--- 5. Graceful Worker Shutdown ---');
  const testWorker = new QueueService();
  await testWorker.shutdown();
  if (!testWorker.isShutdown) {
    throw new Error('Worker shutdown flag not set');
  }
  let rejectedAfterShutdown = false;
  try {
    await testWorker.enqueueJob({ topic: 'TEST', payload: {} });
  } catch (err: any) {
    rejectedAfterShutdown = err.message.includes('QUEUE_SHUTTING_DOWN');
  }
  if (!rejectedAfterShutdown) {
    throw new Error('Worker accepted jobs after shutdown');
  }
  console.log('✅ PASS: Worker shutdown correctly rejects new jobs with QUEUE_SHUTTING_DOWN');

  console.log('\n🎉 ALL QUEUE, OUTBOX, RETRY, DLQ & SHUTDOWN INVARIANTS VERIFIED.');
}

testQueueAndWorker()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Queue test failed:', err);
    process.exit(1);
  });
