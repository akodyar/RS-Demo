import { Router } from 'express';
import { requireDatabase } from '../middleware/dbGuard.js';
import { auditService } from '../services/audit.js';
import { communicationsCrmRepository } from '../repositories/communications-crm.js';
import { webhookVerifier } from '../services/provider-adapters.js';

const router = Router();

const sendDbNotConfigured = (res: any) => {
  return res.status(503).json({
    error: 'DATABASE_NOT_CONFIGURED',
    code: 'SERVICE_UNAVAILABLE',
    message: 'The authoritative relational storage service is unconfigured. Fail-closed enforced.',
  });
};

// Whitelist of valid webhook providers
export const ALLOWED_WEBHOOK_PROVIDERS = ['SES', 'SENDGRID', 'TWILIO', 'FASTSMS', 'ASIACELL', 'ZAIN', 'FCM', 'INTERNAL'];

// Sanitize webhook payloads to protect against credential or secret leakage
export function sanitizeWebhookPayload(body: any): any {
  if (!body || typeof body !== 'object') return body;
  const sensitiveKeys = ['secret', 'api_key', 'apikey', 'token', 'access_token', 'authorization', 'password', 'auth', 'webhook_secret'];
  
  if (Array.isArray(body)) {
    return body.map(item => sanitizeWebhookPayload(item));
  }

  const sanitized: Record<string, any> = {};
  for (const [key, val] of Object.entries(body)) {
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof val === 'object' && val !== null) {
      sanitized[key] = sanitizeWebhookPayload(val);
    } else {
      sanitized[key] = val;
    }
  }
  return sanitized;
}

// ==========================================
// PROVIDER WEBHOOK RECEIVER
// ==========================================

router.post('/:provider/callback', async (req, res) => {

  const { provider } = req.params;
  const providerKey = (provider || '').toUpperCase();

  // Strict provider identity validation
  if (!ALLOWED_WEBHOOK_PROVIDERS.includes(providerKey)) {
    return res.status(400).json({ error: 'UNRECOGNIZED_WEBHOOK_PROVIDER', message: `Provider ${provider} is not recognized` });
  }

  const signatureHeader = (req.headers['x-provider-signature'] || req.headers['stripe-signature']) as string;
  const timestampHeader = req.headers['x-provider-timestamp'] as string;
  const idempotencyHeader = req.headers['x-idempotency-key'] as string;

  // Strict provider-specific secret isolation: Provider A's secret cannot authenticate Provider B
  const webhookSecret = process.env[`WEBHOOK_SECRET_${providerKey}`] || 
    (process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEV_WEBHOOK_FALLBACK === 'true'
      ? `dev_secret_${providerKey.toLowerCase()}` 
      : undefined);

  if (!webhookSecret) {
    return res.status(503).json({
      error: 'PROVIDER_SECRET_NOT_CONFIGURED',
      message: `Webhook signing secret for provider ${providerKey} is not configured. Fail-closed enforced.`
    });
  }

  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  const isSignatureValid = signatureHeader ? webhookVerifier.verifyHmacSignature(rawBody, signatureHeader, webhookSecret) : false;

  // Timestamp replay check if timestamp header is provided
  if (timestampHeader) {
    const timestampSec = parseInt(timestampHeader, 10);
    if (!isNaN(timestampSec) && !webhookVerifier.verifyTimestampReplay(timestampSec)) {
      return res.status(400).json({ error: 'WEBHOOK_REPLAY_DETECTED', message: 'Webhook timestamp exceeds maximum allowed drift' });
    }
  }

  const eventId = req.body?.id || `evt_${Date.now()}`;

  await auditService.logAction({
    actorUserId: 'SYSTEM',
    actorRole: 'SYSTEM',
    action: 'WEBHOOK_RECEIVED',
    resourceType: 'IntegrationWebhookEvent',
    resourceId: eventId as string,
    changes: {
      provider: providerKey,
      signatureValid: isSignatureValid,
      status: isSignatureValid ? 'RECEIVED' : 'INVALID_SIGNATURE'
    },
    ipAddress: (req.ip || '') as string
  });

  if (!isSignatureValid) {
    // Fail safely: Do not process unverified webhooks
    return res.status(400).json({ error: 'INVALID_WEBHOOK_SIGNATURE', message: 'Cryptographic signature verification failed' });
  }

  try {
    const eventType = req.body?.event_type || req.body?.type || 'DELIVERY_STATUS_UPDATE';
    const idempotencyKey = idempotencyHeader || (req.body?.id ? `${providerKey}:${req.body.id}` : undefined);

    // Sanitize payload before database persistence to prevent storing sensitive provider tokens
    const sanitizedPayload = sanitizeWebhookPayload(req.body);

    const result = await communicationsCrmRepository.recordWebhookEvent({
      provider: providerKey,
      providerEventId: req.body?.id || String(eventId),
      eventType,
      payload: sanitizedPayload,
      signatureVerified: true,
      idempotencyKey
    });

    if (result.isDuplicate) {
      return res.status(200).json({ status: 'ACKNOWLEDGED_DUPLICATE', eventId: result.event.id });
    }

    res.status(200).json({ status: 'PROCESSED', eventId: result.event.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
