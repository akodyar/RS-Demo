import { communicationsCrmRepository } from '../repositories/communications-crm.js';
import { templateEngine } from './template-engine.js';
import { emailProvider, smsProvider, pushProvider } from './provider-adapters.js';
import { auditService } from './audit.js';
import {
  NotificationChannel,
  NotificationStatus,
  DeliveryStatus,
  NotificationPriority,
  NotificationSensitivity,
  NotificationCategory
} from '../../types/communications-crm.js';

export interface SendNotificationRequest {
  recipientUserId: string;
  organizationId?: string;
  propertyId?: string;
  category: NotificationCategory;
  priority?: NotificationPriority;
  sensitivity?: NotificationSensitivity;
  title?: string;
  message?: string;
  templateCode?: string;
  templateVariables?: Record<string, any>;
  channels: NotificationChannel[];
  sourceDomain: string;
  sourceEntityId?: string;
  idempotencyKey?: string;
  recipientEmail?: string;
  recipientPhone?: string;
  deviceTokens?: string[];
  isAiGenerated?: boolean;
  aiRequiresHumanApproval?: boolean;
}

export class NotificationEngine {
  // Check if category is mandatory / transactional (cannot be opted out of)
  isMandatoryCategory(category: NotificationCategory): boolean {
    const mandatory: NotificationCategory[] = [
      'ACCOUNT',
      'SECURITY',
      'LEASE',
      'RENT',
      'PAYMENT',
      'DISPUTE',
      'COMPLIANCE',
      'SYSTEM'
    ];
    return mandatory.includes(category);
  }

  // Validate state transitions
  isValidStateTransition(current: NotificationStatus, target: NotificationStatus): boolean {
    const transitions: Record<NotificationStatus, NotificationStatus[]> = {
      [NotificationStatus.PERSISTED]: [NotificationStatus.QUEUED, NotificationStatus.PROCESSING, NotificationStatus.CANCELLED],
      [NotificationStatus.QUEUED]: [NotificationStatus.PROCESSING, NotificationStatus.CANCELLED, NotificationStatus.EXPIRED],
      [NotificationStatus.SCHEDULED]: [NotificationStatus.QUEUED, NotificationStatus.CANCELLED, NotificationStatus.EXPIRED],
      [NotificationStatus.PROCESSING]: [NotificationStatus.SENT, NotificationStatus.FAILED],
      [NotificationStatus.SENT]: [NotificationStatus.DELIVERED, NotificationStatus.FAILED, NotificationStatus.READ],
      [NotificationStatus.DELIVERED]: [NotificationStatus.READ],
      [NotificationStatus.READ]: [],
      [NotificationStatus.FAILED]: [NotificationStatus.QUEUED], // Retry
      [NotificationStatus.CANCELLED]: [],
      [NotificationStatus.EXPIRED]: []
    };

    return transitions[current]?.includes(target) ?? false;
  }

  // Validate delivery attempt state transitions
  isValidDeliveryTransition(current: DeliveryStatus, target: DeliveryStatus): boolean {
    const transitions: Record<DeliveryStatus, DeliveryStatus[]> = {
      [DeliveryStatus.QUEUED]: [DeliveryStatus.PROCESSING, DeliveryStatus.FAILED, DeliveryStatus.DELIVERED],
      [DeliveryStatus.PROCESSING]: [DeliveryStatus.SENT, DeliveryStatus.FAILED, DeliveryStatus.DELIVERY_UNKNOWN],
      [DeliveryStatus.SENT]: [DeliveryStatus.DELIVERED, DeliveryStatus.DELIVERY_CONFIRMED, DeliveryStatus.FAILED, DeliveryStatus.BOUNCED, DeliveryStatus.REJECTED],
      [DeliveryStatus.DELIVERY_UNKNOWN]: [DeliveryStatus.DELIVERED, DeliveryStatus.DELIVERY_CONFIRMED, DeliveryStatus.FAILED, DeliveryStatus.PROCESSING],
      [DeliveryStatus.DELIVERY_CONFIRMED]: [],
      [DeliveryStatus.DELIVERED]: [],
      [DeliveryStatus.FAILED]: [DeliveryStatus.QUEUED], // Controlled retry
      [DeliveryStatus.BOUNCED]: [],
      [DeliveryStatus.REJECTED]: []
    };
    return transitions[current]?.includes(target) ?? false;
  }

  // Check quiet hours
  isInQuietHours(quietStart?: string, quietEnd?: string, checkDate: Date = new Date()): boolean {
    if (!quietStart || !quietEnd) return false;

    const [startH, startM] = quietStart.split(':').map(Number);
    const [endH, endM] = quietEnd.split(':').map(Number);

    const curH = checkDate.getHours();
    const curM = checkDate.getMinutes();
    const currentMins = curH * 60 + curM;
    const startMins = startH * 60 + startM;
    const endMins = endH * 60 + endM;

    if (startMins <= endMins) {
      return currentMins >= startMins && currentMins < endMins;
    } else {
      // Crosses midnight (e.g. 22:00 to 07:00)
      return currentMins >= startMins || currentMins < endMins;
    }
  }

  // AI Safety boundary
  validateAiCommunication(req: SendNotificationRequest): { isPermitted: boolean; rejectionReason?: string } {
    if (!req.isAiGenerated) return { isPermitted: true };

    // AI cannot autonomously send high-impact / high-risk categories without human approval
    const highRiskCategories: NotificationCategory[] = [
      'SECURITY',
      'LEASE',
      'PAYMENT',
      'DISPUTE',
      'COMPLIANCE'
    ];

    if (highRiskCategories.includes(req.category)) {
      if (!req.aiRequiresHumanApproval) {
        return {
          isPermitted: false,
          rejectionReason: `AI_HIGH_RISK_COMMUNICATION_BLOCKED: AI cannot autonomously issue ${req.category} communications without explicit human approval.`
        };
      }
    }

    // Inspect content for prompt injection patterns
    const content = `${req.title || ''} ${req.message || ''} ${JSON.stringify(req.templateVariables || {})}`;
    const suspiciousPatterns = [
      /ignore previous instructions/i,
      /you are now an admin/i,
      /bypass security/i,
      /system override/i,
      /grant full permissions/i
    ];

    for (const pat of suspiciousPatterns) {
      if (pat.test(content)) {
        return {
          isPermitted: false,
          rejectionReason: 'PROMPT_INJECTION_DETECTED: Suspicious prompt override detected in communication payload.'
        };
      }
    }

    return { isPermitted: true };
  }

  // Channel eligibility by sensitivity
  isChannelEligibleForSensitivity(channel: NotificationChannel, sensitivity: NotificationSensitivity): boolean {
    if (sensitivity === 'SECURITY_PRIVATE' || sensitivity === 'COMPLIANCE_PRIVATE') {
      // In-app only for confidential security/compliance information to prevent third-party leakage
      return channel === 'IN_APP';
    }
    if (sensitivity === 'SENSITIVE') {
      // No unencrypted SMS for sensitive financial/personal data
      return channel !== 'SMS';
    }
    return true;
  }

  // Orchestrate full dispatch
  async sendNotification(req: SendNotificationRequest, actorContext?: { actorUserId: string; actorRole: string }): Promise<{
    notification: any;
    deliveries: any[];
    suppressedChannels: { channel: NotificationChannel; reason: string }[];
  }> {
    if (!communicationsCrmRepository.isConfigured()) {
      throw new Error('DATABASE_NOT_CONFIGURED');
    }

    // 1. AI Safety Validation
    const aiCheck = this.validateAiCommunication(req);
    if (!aiCheck.isPermitted) {
      throw new Error(aiCheck.rejectionReason || 'AI_COMMUNICATION_REJECTED');
    }

    // 2. Resolve User Preferences & Language
    const prefs = await communicationsCrmRepository.getUserPreferences(req.recipientUserId);
    const userLang: 'ku' | 'ar' | 'en' = (prefs?.preferredLanguage as any) || 'ku';

    // 3. Render content if template provided
    let finalTitle = req.title || '';
    let finalMessage = req.message || '';
    let usedTemplateId: string | undefined = undefined;
    let usedTemplateVersion: string | undefined = undefined;

    if (req.templateCode) {
      const tmpl = templateEngine.getStandardTemplate(req.templateCode, userLang);
      if (tmpl) {
        const rendered = templateEngine.render(
          tmpl.titleTemplate,
          tmpl.bodyTemplate,
          req.templateVariables || {},
          tmpl.allowedVariables,
          userLang
        );
        finalTitle = rendered.title;
        finalMessage = rendered.body;
        usedTemplateId = req.templateCode;
        usedTemplateVersion = '1.0';
      }
    }

    if (!finalTitle || !finalMessage) {
      throw new Error('NOTIFICATION_PAYLOAD_INVALID: Title and message or valid templateCode required');
    }

    // 4. Create authoritative Notification record in DB
    const notif = await communicationsCrmRepository.createNotification({
      recipientUserId: req.recipientUserId,
      organizationId: req.organizationId,
      propertyId: req.propertyId,
      category: req.category,
      priority: req.priority || 'NORMAL',
      sensitivity: req.sensitivity || 'NORMAL',
      title: finalTitle,
      message: finalMessage,
      status: NotificationStatus.QUEUED,
      sourceDomain: req.sourceDomain,
      entityId: req.sourceEntityId,
      entityType: req.sourceDomain,
      templateId: usedTemplateId,
      templateVersion: usedTemplateVersion,
      metadata: req.templateVariables,
      idempotencyKey: req.idempotencyKey || undefined
    });

    // 5. Evaluate Quiet Hours
    const isQuiet = prefs?.quietHoursEnabled && 
      req.priority !== 'CRITICAL' && 
      req.category !== 'SECURITY' &&
      this.isInQuietHours(prefs.quietHoursStart || undefined, prefs.quietHoursEnd || undefined);

    // 6. Deliver to each requested channel (with mandatory fallback guarantee)
    const effectiveChannels: NotificationChannel[] = [...req.channels];
    if (this.isMandatoryCategory(req.category) && !effectiveChannels.includes('IN_APP')) {
      effectiveChannels.unshift('IN_APP'); // Mandatory categories guaranteed IN_APP delivery fallback
    }

    const deliveries: any[] = [];
    const suppressedChannels: { channel: NotificationChannel; reason: string }[] = [];

    for (const channel of effectiveChannels) {
      // Check channel eligibility based on sensitivity
      if (!this.isChannelEligibleForSensitivity(channel, req.sensitivity || 'NORMAL')) {
        suppressedChannels.push({
          channel,
          reason: `CHANNEL_INELIGIBLE_FOR_SENSITIVITY: ${req.sensitivity} notifications cannot be dispatched over ${channel}`
        });
        continue;
      }

      // Check quiet hours (except for in-app or critical)
      if (isQuiet && channel !== 'IN_APP') {
        suppressedChannels.push({
          channel,
          reason: 'QUIET_HOURS_ACTIVE: Delivery postponed due to recipient quiet hours'
        });
        continue;
      }

      // Check user preferences if category is optional / non-mandatory
      const isMandatory = this.isMandatoryCategory(req.category);
      if (!isMandatory && prefs) {
        if (prefs.channelPreferences[channel] === false) {
          suppressedChannels.push({
            channel,
            reason: `USER_PREFERENCE_DISABLED: Recipient disabled ${channel} notifications`
          });
          continue;
        }
        if (prefs.categoryPreferences[req.category] === false) {
          suppressedChannels.push({
            channel,
            reason: `USER_CATEGORY_DISABLED: Recipient opted out of ${req.category} notifications`
          });
          continue;
        }
      }

      // Marketing Consent Check
      if (req.category === 'MARKETING') {
        const consent = await communicationsCrmRepository.getCommunicationConsent(
          req.recipientUserId,
          'MARKETING',
          channel
        );
        if (!consent || consent.status !== 'GRANTED') {
          suppressedChannels.push({
            channel,
            reason: `MARKETING_CONSENT_REQUIRED: No active consent recorded for ${channel} marketing`
          });
          continue;
        }
      }

      // Dispatch by channel
      const channelIdempotencyKey = req.idempotencyKey ? `${req.idempotencyKey}:${channel}` : undefined;

      if (channel === 'IN_APP') {
        // Internal in-app delivery
        const delivery = await communicationsCrmRepository.createDeliveryAttempt({
          notificationId: notif.id,
          channel: 'IN_APP',
          provider: 'INTERNAL_IN_APP',
          recipientAddress: req.recipientUserId,
          idempotencyKey: channelIdempotencyKey
        });

        // In-app is immediately delivered into the user's relational notification feed
        const updated = await communicationsCrmRepository.updateDeliveryStatus(
          delivery.id,
          DeliveryStatus.DELIVERED,
          { deliveredAt: new Date() }
        );
        deliveries.push(updated);
      } else if (channel === 'EMAIL') {
        const recipientEmail = req.recipientEmail || 'recipient@homehub.iq';
        const delivery = await communicationsCrmRepository.createDeliveryAttempt({
          notificationId: notif.id,
          channel: 'EMAIL',
          provider: 'EMAIL_PROVIDER',
          recipientAddress: recipientEmail,
          idempotencyKey: channelIdempotencyKey
        });

        const res = await emailProvider.sendEmail(
          { to: recipientEmail, subject: finalTitle, body: finalMessage },
          channelIdempotencyKey
        );

        const updated = await communicationsCrmRepository.updateDeliveryStatus(
          delivery.id,
          res.status,
          {
            providerMessageId: res.providerMessageId,
            failureReason: res.failureReason,
            sentAt: res.success ? new Date() : undefined
          }
        );
        deliveries.push(updated);
      } else if (channel === 'SMS') {
        const recipientPhone = req.recipientPhone || '+9647501234567';
        const delivery = await communicationsCrmRepository.createDeliveryAttempt({
          notificationId: notif.id,
          channel: 'SMS',
          provider: 'IRAQI_SMS_GATEWAY',
          recipientAddress: recipientPhone,
          idempotencyKey: channelIdempotencyKey
        });

        const res = await smsProvider.sendSms(
          { to: recipientPhone, message: finalMessage },
          channelIdempotencyKey
        );

        const updated = await communicationsCrmRepository.updateDeliveryStatus(
          delivery.id,
          res.status,
          {
            providerMessageId: res.providerMessageId,
            failureReason: res.failureReason,
            sentAt: res.success ? new Date() : undefined
          }
        );
        deliveries.push(updated);
      } else if (channel === 'PUSH') {
        const devices = await communicationsCrmRepository.getActiveDevicesForUser(req.recipientUserId);
        if (devices.length === 0) {
          suppressedChannels.push({
            channel: 'PUSH',
            reason: 'NO_ACTIVE_DEVICE_REGISTERED'
          });
          continue;
        }

        for (const dev of devices) {
          const pushKey = channelIdempotencyKey ? `${channelIdempotencyKey}:${dev.id}` : undefined;
          const delivery = await communicationsCrmRepository.createDeliveryAttempt({
            notificationId: notif.id,
            channel: 'PUSH',
            provider: 'FCM_GATEWAY',
            recipientAddress: dev.deviceToken,
            idempotencyKey: pushKey
          });

          const res = await pushProvider.sendPush(
            { deviceToken: dev.deviceToken, title: finalTitle, body: finalMessage },
            pushKey
          );

          const updated = await communicationsCrmRepository.updateDeliveryStatus(
            delivery.id,
            res.status,
            {
              providerMessageId: res.providerMessageId,
              failureReason: res.failureReason,
              sentAt: res.success ? new Date() : undefined
            }
          );
          deliveries.push(updated);
        }
      }
    }

    // Determine aggregate notification status
    const hasDelivered = deliveries.some(d => d.status === DeliveryStatus.DELIVERED);
    const hasSent = deliveries.some(d => d.status === DeliveryStatus.SENT);
    const nextStatus = hasDelivered ? NotificationStatus.DELIVERED : hasSent ? NotificationStatus.SENT : NotificationStatus.FAILED;

    const finalNotif = await communicationsCrmRepository.updateNotificationStatus(notif.id, nextStatus);

    // Audit log
    await auditService.logAction({
      actorUserId: actorContext?.actorUserId || 'SYSTEM',
      actorRole: actorContext?.actorRole || 'SYSTEM',
      action: 'NOTIFICATION_DISPATCHED',
      resourceType: 'Notification',
      resourceId: notif.id,
      changes: {
        category: req.category,
        channels: req.channels,
        deliveredCount: deliveries.filter(d => d.status === DeliveryStatus.DELIVERED).length,
        status: nextStatus
      },
      ipAddress: '127.0.0.1'
    });

    return {
      notification: finalNotif,
      deliveries,
      suppressedChannels
    };
  }

  // --------------------------------------------------------------------------
  // CONTROLLED RETRY SEMANTICS
  // --------------------------------------------------------------------------
  async retryDelivery(deliveryId: string, actorContext?: { actorUserId: string; actorRole: string }): Promise<any> {
    if (!communicationsCrmRepository.isConfigured()) {
      throw new Error('DATABASE_NOT_CONFIGURED');
    }

    const delivery = await communicationsCrmRepository.getDeliveryById(deliveryId);
    if (!delivery) {
      throw new Error('DELIVERY_NOT_FOUND');
    }

    if (delivery.status !== DeliveryStatus.FAILED) {
      throw new Error(`CANNOT_RETRY_DELIVERY: Current status is ${delivery.status}, only FAILED deliveries can be retried.`);
    }

    // Bounded retries: max 5 attempts
    if (delivery.attemptNumber >= 5) {
      throw new Error('MAX_RETRY_ATTEMPTS_EXCEEDED: Maximum of 5 delivery attempts reached. Failure is permanent.');
    }

    // Discriminate permanent failure reasons
    const permanentFailures = [
      'INVALID_PHONE_NUMBER',
      'INVALID_DEVICE_TOKEN',
      'CHANNEL_INELIGIBLE_FOR_SENSITIVITY',
      'MARKETING_CONSENT_REQUIRED'
    ];
    if (delivery.failureReason && permanentFailures.some(pf => delivery.failureReason?.includes(pf))) {
      throw new Error(`PERMANENT_FAILURE_NOT_RETRYABLE: ${delivery.failureReason}`);
    }

    // If provider already returned a providerMessageId on a previous attempt, it was already accepted!
    if (delivery.providerMessageId) {
      const confirmed = await communicationsCrmRepository.updateDeliveryStatus(
        delivery.id,
        DeliveryStatus.SENT,
        { sentAt: new Date() }
      );
      return confirmed;
    }

    const notif = await communicationsCrmRepository.getNotificationById(delivery.notificationId);
    if (!notif) throw new Error('NOTIFICATION_NOT_FOUND');

    // Valid State Machine transition: FAILED -> QUEUED -> PROCESSING
    await communicationsCrmRepository.updateDeliveryStatus(delivery.id, DeliveryStatus.QUEUED);
    await communicationsCrmRepository.updateDeliveryStatus(delivery.id, DeliveryStatus.PROCESSING);

    let res: any;
    const nextAttempt = delivery.attemptNumber + 1;
    // PROVIDER CAPABILITY & RETRY STRATEGY:
    // External gateways (SendGrid, AWS SES, Twilio, FCM, Iraqi SMS Aggregator) have NO_NATIVE_IDEMPOTENCY
    // on their standard dispatch endpoints. Each HTTP dispatch creates a new network attempt.
    // Consequently, all external network channels operate on AT_LEAST_ONCE delivery semantics.
    //
    // To protect against duplicate external transmission:
    // 1. If providerMessageId was already issued, retryDelivery short-circuits to SENT without calling gateway.
    // 2. We preserve the canonical delivery.idempotencyKey for tracking across provider adapters.
    // 3. For INTERNAL_IN_APP, EXACTLY_ONCE_DURABLE_CREATION is guaranteed via PostgreSQL unique constraint.
    const canonicalIdempotencyKey = delivery.idempotencyKey || undefined;

    if (delivery.channel === 'IN_APP') {
      res = { success: true, status: DeliveryStatus.DELIVERED, deliveredAt: new Date() };
    } else if (delivery.channel === 'EMAIL') {
      res = await emailProvider.sendEmail(
        { to: delivery.recipientAddress, subject: notif.title, body: notif.message },
        canonicalIdempotencyKey
      );
    } else if (delivery.channel === 'SMS') {
      res = await smsProvider.sendSms(
        { to: delivery.recipientAddress, message: notif.message },
        canonicalIdempotencyKey
      );
    } else if (delivery.channel === 'PUSH') {
      res = await pushProvider.sendPush(
        { deviceToken: delivery.recipientAddress, title: notif.title, body: notif.message },
        canonicalIdempotencyKey
      );
    }

    const updated = await communicationsCrmRepository.updateDeliveryStatus(
      delivery.id,
      res.status,
      {
        providerMessageId: res.providerMessageId,
        failureReason: res.failureReason,
        sentAt: res.success ? new Date() : undefined,
        deliveredAt: res.status === DeliveryStatus.DELIVERED ? new Date() : undefined
      }
    );

    await auditService.logAction({
      actorUserId: actorContext?.actorUserId || 'SYSTEM',
      actorRole: actorContext?.actorRole || 'SYSTEM',
      action: 'DELIVERY_RETRY_ATTEMPTED',
      resourceType: 'NotificationDelivery',
      resourceId: delivery.id,
      changes: {
        attemptNumber: nextAttempt,
        previousStatus: DeliveryStatus.FAILED,
        newStatus: res.status
      },
      ipAddress: '127.0.0.1'
    });

    return updated;
  }
}

export const notificationEngine = new NotificationEngine();
