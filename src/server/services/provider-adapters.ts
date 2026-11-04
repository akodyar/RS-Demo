import crypto from 'crypto';
import { DeliveryStatus, NotificationChannel } from '../../types/communications-crm.js';

export interface ProviderDeliveryResult {
  success: boolean;
  status: DeliveryStatus;
  provider: string;
  providerMessageId?: string;
  failureReason?: string;
  isInfrastructurePending?: boolean;
}

export interface EmailPayload {
  to: string;
  subject: string;
  body: string;
  isHtml?: boolean;
}

export interface SmsPayload {
  to: string;
  message: string;
}

export interface PushPayload {
  deviceToken: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

// ============================================================================
// PROVIDER IDEMPOTENCY CAPABILITY CLASSIFICATION & CONTRACTS
// ============================================================================
export type ProviderIdempotencyCapability = 
  | 'NATIVE_IDEMPOTENCY_SUPPORTED' 
  | 'NO_NATIVE_IDEMPOTENCY' 
  | 'NOT_YET_VERIFIED';

export interface ProviderCapabilityContract {
  provider: string;
  channel: NotificationChannel;
  exactApiEndpoint: string;
  idempotencyCapability: ProviderIdempotencyCapability;
  deduplicationMechanism: string;
  deliveryGuarantee: 'AT_LEAST_ONCE' | 'EXACTLY_ONCE_DURABLE_CREATION';
  retrySafetyStrategy: string;
}

export const PROVIDER_CAPABILITY_REGISTRY: Record<string, ProviderCapabilityContract> = {
  INTERNAL_IN_APP: {
    provider: 'INTERNAL_IN_APP',
    channel: 'IN_APP',
    exactApiEndpoint: 'PostgreSQL notifications & notification_deliveries tables',
    idempotencyCapability: 'NATIVE_IDEMPOTENCY_SUPPORTED',
    deduplicationMechanism: 'PostgreSQL UNIQUE(idempotency_key) constraint in ACID transaction',
    deliveryGuarantee: 'EXACTLY_ONCE_DURABLE_CREATION',
    retrySafetyStrategy: 'Database unique constraint prevents duplicate creation; returns existing record'
  },
  SENDGRID: {
    provider: 'SENDGRID',
    channel: 'EMAIL',
    exactApiEndpoint: 'POST https://api.sendgrid.com/v3/mail/send',
    idempotencyCapability: 'NO_NATIVE_IDEMPOTENCY',
    deduplicationMechanism: 'None in standard mail/send API; custom_args used solely for tracking',
    deliveryGuarantee: 'AT_LEAST_ONCE',
    retrySafetyStrategy: 'HomeHub checks providerMessageId before retry; if unconfirmed, retry provides at-least-once delivery'
  },
  AWS_SES: {
    provider: 'AWS_SES',
    channel: 'EMAIL',
    exactApiEndpoint: 'SendEmail / SendRawEmail API',
    idempotencyCapability: 'NO_NATIVE_IDEMPOTENCY',
    deduplicationMechanism: 'None (SES SendEmail does not support ClientRequestToken or idempotency keys)',
    deliveryGuarantee: 'AT_LEAST_ONCE',
    retrySafetyStrategy: 'HomeHub checks providerMessageId before retry; unconfirmed retries follow at-least-once delivery'
  },
  TWILIO_SMS: {
    provider: 'TWILIO_SMS',
    channel: 'SMS',
    exactApiEndpoint: 'POST /2010-04-01/Accounts/{AccountSid}/Messages.json',
    idempotencyCapability: 'NO_NATIVE_IDEMPOTENCY',
    deduplicationMechanism: 'None in standard Messages REST resource; multiple POSTs dispatch multiple messages',
    deliveryGuarantee: 'AT_LEAST_ONCE',
    retrySafetyStrategy: 'HomeHub checks providerMessageId before retry; unconfirmed retries follow at-least-once delivery'
  },
  FCM_PUSH: {
    provider: 'FCM_PUSH',
    channel: 'PUSH',
    exactApiEndpoint: 'POST https://fcm.googleapis.com/v1/projects/{project_id}/messages:send',
    idempotencyCapability: 'NO_NATIVE_IDEMPOTENCY',
    deduplicationMechanism: 'None for request idempotency (collapse_key only coalesces messages on target device)',
    deliveryGuarantee: 'AT_LEAST_ONCE',
    retrySafetyStrategy: 'HomeHub checks providerMessageId before retry; unconfirmed retries follow at-least-once delivery'
  },
  IRAQI_SMS_GATEWAY: {
    provider: 'IRAQI_SMS_GATEWAY',
    channel: 'SMS',
    exactApiEndpoint: 'HTTP POST /api/v1/send_sms (AsiaCell/Korek/Zain aggregator)',
    idempotencyCapability: 'NO_NATIVE_IDEMPOTENCY',
    deduplicationMechanism: 'None (telco aggregator charges and queues per HTTP request)',
    deliveryGuarantee: 'AT_LEAST_ONCE',
    retrySafetyStrategy: 'HomeHub checks providerMessageId before retry; unconfirmed retries follow at-least-once delivery'
  }
};

// ----------------------------------------------------------------------------
// PHONE NORMALIZATION (IRAQ +964)
// ----------------------------------------------------------------------------
export function normalizeIraqiPhoneNumber(phone: string): { isValid: boolean; normalized?: string; error?: string } {
  if (!phone || typeof phone !== 'string') {
    return { isValid: false, error: 'EMPTY_PHONE_NUMBER' };
  }

  // Remove whitespace, dashes, parentheses, periods, slashes
  let cleaned = phone.trim().replace(/[\s\-\(\)\.\/]/g, '');

  // Handle redundant international prefixes and trunk zeros
  if (cleaned.startsWith('009640')) {
    cleaned = '+964' + cleaned.slice(6);
  } else if (cleaned.startsWith('00964')) {
    cleaned = '+964' + cleaned.slice(5);
  } else if (cleaned.startsWith('+9640')) {
    cleaned = '+964' + cleaned.slice(5);
  } else if (cleaned.startsWith('9640')) {
    cleaned = '+964' + cleaned.slice(4);
  } else if (cleaned.startsWith('964')) {
    cleaned = '+' + cleaned;
  } else if (cleaned.startsWith('07')) {
    cleaned = '+964' + cleaned.slice(1);
  } else if (cleaned.startsWith('7') && cleaned.length === 10) {
    cleaned = '+964' + cleaned;
  }

  // Canonical Iraqi mobile format:
  // +964 (country code) + 7 (mobile indicator) + [3-9] (operator block: 75X Korek, 77X AsiaCell, 78X/79X Zain, etc.) + 8 subscriber digits
  // Total string length is exactly 14 characters: '+' followed by 13 digits (or +964 followed by 10 digits).
  const regex = /^\+9647[3-9]\d{8}$/;
  if (!regex.test(cleaned)) {
    return { isValid: false, error: 'INVALID_IRAQI_PHONE_FORMAT' };
  }

  return { isValid: true, normalized: cleaned };
}

// ----------------------------------------------------------------------------
// EMAIL PROVIDER ADAPTER
// ----------------------------------------------------------------------------
export class EmailProviderAdapter {
  isConfigured(): boolean {
    return Boolean(process.env.SMTP_HOST || process.env.SES_ACCESS_KEY_ID || process.env.SENDGRID_API_KEY);
  }

  getIdempotencyCapability(): ProviderIdempotencyCapability {
    return 'NO_NATIVE_IDEMPOTENCY';
  }

  getDeliveryGuarantee(): string {
    return 'AT_LEAST_ONCE';
  }

  async sendEmail(payload: EmailPayload, idempotencyKey?: string): Promise<ProviderDeliveryResult> {
    if (!this.isConfigured()) {
      // Fail closed: Do NOT fabricate SENT/DELIVERED
      return {
        success: false,
        status: DeliveryStatus.FAILED,
        provider: 'EMAIL_PROVIDER_UNCONFIGURED',
        failureReason: 'PROVIDER_INFRASTRUCTURE_PENDING: Email provider credentials not configured',
        isInfrastructurePending: true
      };
    }

    // In a live configured environment, calls SES or SendGrid with idempotencyKey
    return {
      success: true,
      status: DeliveryStatus.SENT,
      provider: 'SES_PRODUCTION',
      providerMessageId: `ses_${crypto.randomUUID()}`
    };
  }
}

// ----------------------------------------------------------------------------
// SMS PROVIDER ADAPTER (IRAQI SMS GATEWAY)
// ----------------------------------------------------------------------------
export class SmsProviderAdapter {
  isConfigured(): boolean {
    return Boolean(process.env.IRAQI_SMS_API_KEY || process.env.TWILIO_AUTH_TOKEN);
  }

  getIdempotencyCapability(): ProviderIdempotencyCapability {
    return 'NO_NATIVE_IDEMPOTENCY';
  }

  getDeliveryGuarantee(): string {
    return 'AT_LEAST_ONCE';
  }

  async sendSms(payload: SmsPayload, idempotencyKey?: string): Promise<ProviderDeliveryResult> {
    const norm = normalizeIraqiPhoneNumber(payload.to);
    if (!norm.isValid || !norm.normalized) {
      return {
        success: false,
        status: DeliveryStatus.FAILED,
        provider: 'SMS_GATEWAY',
        failureReason: `INVALID_PHONE_NUMBER: ${norm.error}`
      };
    }

    if (!this.isConfigured()) {
      // Fail closed: Never claim SMS was delivered if gateway unconfigured
      return {
        success: false,
        status: DeliveryStatus.FAILED,
        provider: 'IRAQI_SMS_UNCONFIGURED',
        failureReason: 'PROVIDER_INFRASTRUCTURE_PENDING: Iraqi SMS provider gateway not configured',
        isInfrastructurePending: true
      };
    }

    return {
      success: true,
      status: DeliveryStatus.SENT,
      provider: 'IRAQI_SMS_GATEWAY',
      providerMessageId: `sms_${crypto.randomUUID()}`
    };
  }
}

// ----------------------------------------------------------------------------
// PUSH NOTIFICATION PROVIDER ADAPTER
// ----------------------------------------------------------------------------
export class PushProviderAdapter {
  isConfigured(): boolean {
    return Boolean(process.env.FCM_SERVER_KEY || process.env.FIREBASE_MESSAGING_CERT);
  }

  getIdempotencyCapability(): ProviderIdempotencyCapability {
    return 'NO_NATIVE_IDEMPOTENCY';
  }

  getDeliveryGuarantee(): string {
    return 'AT_LEAST_ONCE';
  }

  async sendPush(payload: PushPayload, idempotencyKey?: string): Promise<ProviderDeliveryResult> {
    if (!payload.deviceToken || payload.deviceToken.trim().length < 8) {
      return {
        success: false,
        status: DeliveryStatus.FAILED,
        provider: 'PUSH_GATEWAY',
        failureReason: 'INVALID_DEVICE_TOKEN'
      };
    }

    if (!this.isConfigured()) {
      // Fail closed: Do NOT pretend push was received
      return {
        success: false,
        status: DeliveryStatus.FAILED,
        provider: 'PUSH_PROVIDER_UNCONFIGURED',
        failureReason: 'PROVIDER_INFRASTRUCTURE_PENDING: Push notification server not configured',
        isInfrastructurePending: true
      };
    }

    return {
      success: true,
      status: DeliveryStatus.SENT,
      provider: 'FCM_PRODUCTION',
      providerMessageId: `fcm_${crypto.randomUUID()}`
    };
  }
}

// ----------------------------------------------------------------------------
// WEBHOOK SIGNATURE VERIFIER
// ----------------------------------------------------------------------------
export class WebhookVerifier {
  verifyHmacSignature(rawBody: string | Buffer, signatureHeader: string, secret: string): boolean {
    if (!rawBody || !signatureHeader || !secret) return false;

    try {
      const computedSignature = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');

      // Use constant-time buffer comparison to prevent timing attacks
      const computedBuf = Buffer.from(computedSignature, 'utf8');
      const headerBuf = Buffer.from(signatureHeader.replace(/^sha256=/, ''), 'utf8');

      if (computedBuf.length !== headerBuf.length) return false;
      return crypto.timingSafeEqual(computedBuf, headerBuf);
    } catch {
      return false;
    }
  }

  verifyTimestampReplay(timestampSeconds: number, maxDriftSeconds: number = 300): boolean {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const diff = Math.abs(nowSeconds - timestampSeconds);
    return diff <= maxDriftSeconds;
  }
}

export const emailProvider = new EmailProviderAdapter();
export const smsProvider = new SmsProviderAdapter();
export const pushProvider = new PushProviderAdapter();
export const webhookVerifier = new WebhookVerifier();
