import { Router } from 'express';
import { requireDatabase } from '../middleware/dbGuard.js';
import { requireAuth } from '../middleware/auth.js';
import { auditService } from '../services/audit.js';
import { ownerRepository } from '../repositories/owner.js';
import { communicationsCrmRepository } from '../repositories/communications-crm.js';
import { notificationEngine } from '../services/notification-engine.js';
import { templateEngine } from '../services/template-engine.js';

const router = Router();

const sendDbNotConfigured = (res: any) => {
  return res.status(503).json({
    error: 'DATABASE_NOT_CONFIGURED',
    code: 'SERVICE_UNAVAILABLE',
    message: 'The authoritative relational storage service is unconfigured. Fail-closed enforced.',
  });
};

// ==========================================
// COMMUNICATIONS & INBOX
// ==========================================

router.get('/conversations', requireAuth, requireDatabase, async (req, res) => {

  try {
    const convs = await ownerRepository.getScopedConversations(req.user!);
    res.json(convs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/messages', requireAuth, requireDatabase, async (req, res) => {

  try {
    const { conversationId, content, messageType } = req.body;
    if (!conversationId || !content) {
      return res.status(400).json({ error: 'conversationId and content are required' });
    }

    const msg = await ownerRepository.sendMessage(req.user!, conversationId, content, messageType);

    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] as string,
      action: 'SEND_MESSAGE',
      resourceType: 'Message',
      resourceId: msg.id,
      changes: { conversationId, messageType },
      ipAddress: (req.ip || '') as string,
    });

    res.status(201).json(msg);
  } catch (err: any) {
    if (err.message?.includes('AUTHORITY_REQUIRED')) {
      return res.status(403).json({ error: 'Forbidden: ' + err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// NOTIFICATIONS
// ==========================================

router.get('/notifications', requireAuth, requireDatabase, async (req, res) => {

  try {
    const { category, status, unreadOnly } = req.query;
    const notifs = await communicationsCrmRepository.listNotificationsForUser(req.user!.id, {
      category: category as string,
      status: status as string,
      unreadOnly: unreadOnly === 'true',
    });
    res.json(notifs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/notifications/send', requireAuth, requireDatabase, async (req, res) => {

  try {
    const {
      recipientUserId,
      organizationId,
      propertyId,
      category,
      priority,
      sensitivity,
      title,
      message,
      templateCode,
      templateVariables,
      channels,
      sourceDomain,
      sourceEntityId,
      idempotencyKey,
      recipientEmail,
      recipientPhone,
      isAiGenerated,
      aiRequiresHumanApproval
    } = req.body;

    if (!recipientUserId || !category || !channels || !sourceDomain) {
      return res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'recipientUserId, category, channels, and sourceDomain are required'
      });
    }

    // Role verification: Non-admin users cannot send notifications to arbitrary users without property/lease context
    const hasAdmin = req.user!.roles.some((r: any) => ['SUPER_ADMIN', 'ADMIN', 'COMPANY_ADMIN'].includes(r));
    if (!hasAdmin && req.user!.id !== recipientUserId) {
      // Must have property scope or company relationship
      if (propertyId) {
        const scope = await communicationsCrmRepository.resolveUserPropertyScope(
          req.user!.id,
          req.user!.roles,
          organizationId
        );
        if (!scope.accessiblePropertyIds.includes(propertyId)) {
          return res.status(403).json({
            error: 'FORBIDDEN_PROPERTY_SCOPE',
            message: 'Actor does not have verified management or ownership authority over this property'
          });
        }
      }
    }

    const result = await notificationEngine.sendNotification({
      recipientUserId,
      organizationId,
      propertyId,
      category,
      priority,
      sensitivity,
      title,
      message,
      templateCode,
      templateVariables,
      channels,
      sourceDomain,
      sourceEntityId,
      idempotencyKey,
      recipientEmail,
      recipientPhone,
      isAiGenerated,
      aiRequiresHumanApproval
    }, {
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] || 'USER'
    });

    res.status(201).json(result);
  } catch (err: any) {
    if (err.message?.includes('AI_HIGH_RISK_COMMUNICATION_BLOCKED') || err.message?.includes('PROMPT_INJECTION_DETECTED')) {
      return res.status(400).json({ error: err.message });
    }
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return sendDbNotConfigured(res);
    }
    res.status(500).json({ error: err.message });
  }
});

router.post('/notifications/:id/read', requireAuth, requireDatabase, async (req, res) => {

  try {
    const notifId = req.params.id as string;
    const notif = await communicationsCrmRepository.getNotificationById(notifId);
    if (!notif) {
      return res.status(404).json({ error: 'NOTIFICATION_NOT_FOUND' });
    }

    if (notif.userId !== req.user!.id) {
      return res.status(403).json({ error: 'FORBIDDEN: Cannot mutate another user\'s notification' });
    }

    const updated = await communicationsCrmRepository.markAsRead(notifId, req.user!.id);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// PREFERENCES & CONSENT
// ==========================================

router.get('/preferences', requireAuth, requireDatabase, async (req, res) => {

  try {
    const prefs = await communicationsCrmRepository.getUserPreferences(req.user!.id);
    res.json(prefs || {
      userId: req.user!.id,
      channelPreferences: { IN_APP: true, EMAIL: true, SMS: true, PUSH: true },
      categoryPreferences: {},
      quietHoursEnabled: false,
      preferredLanguage: 'ku'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/preferences', requireAuth, requireDatabase, async (req, res) => {

  try {
    const {
      channelPreferences,
      categoryPreferences,
      quietHoursEnabled,
      quietHoursStart,
      quietHoursEnd,
      preferredLanguage
    } = req.body;

    const updated = await communicationsCrmRepository.upsertUserPreferences(req.user!.id, {
      channelPreferences,
      categoryPreferences,
      quietHoursEnabled,
      quietHoursStart,
      quietHoursEnd,
      preferredLanguage
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/consent', requireAuth, requireDatabase, async (req, res) => {

  try {
    const { consentType, channel, purpose } = req.body;
    if (!consentType || !channel || !purpose) {
      return res.status(400).json({ error: 'consentType, channel, and purpose are required' });
    }

    const consent = await communicationsCrmRepository.recordConsent(req.user!.id, {
      consentType,
      channel,
      purpose,
      source: 'USER_SETTINGS'
    });

    res.status(201).json(consent);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/consent', requireAuth, requireDatabase, async (req, res) => {

  try {
    const { consentType, channel } = req.body;
    if (!consentType || !channel) {
      return res.status(400).json({ error: 'consentType and channel are required' });
    }

    const revoked = await communicationsCrmRepository.revokeConsent(req.user!.id, consentType, channel);
    res.json({ status: 'REVOKED', revoked });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// DEVICE REGISTRATIONS (PUSH)
// ==========================================

router.post('/devices', requireAuth, requireDatabase, async (req, res) => {

  try {
    const { deviceToken, platform } = req.body;
    if (!deviceToken || !platform) {
      return res.status(400).json({ error: 'deviceToken and platform (IOS, ANDROID, WEB) are required' });
    }

    const reg = await communicationsCrmRepository.registerDevice(req.user!.id, deviceToken, platform);
    res.status(201).json(reg);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/devices/:token', requireAuth, requireDatabase, async (req, res) => {

  try {
    const token = req.params.token as string;
    const revoked = await communicationsCrmRepository.revokeDevice(req.user!.id, token);
    res.json({ status: 'REVOKED', revoked });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// DELIVERIES & RETRY
// ==========================================

router.post('/deliveries/:id/retry', requireAuth, requireDatabase, async (req, res) => {

  try {
    const deliveryId = req.params.id as string;
    const updated = await notificationEngine.retryDelivery(deliveryId, {
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] || 'USER'
    });
    res.json(updated);
  } catch (err: any) {
    if (err.message?.includes('CANNOT_RETRY_DELIVERY') || err.message?.includes('PERMANENT_FAILURE_NOT_RETRYABLE')) {
      return res.status(400).json({ error: err.message });
    }
    if (err.message?.includes('MAX_RETRY_ATTEMPTS_EXCEEDED')) {
      return res.status(429).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// TEMPLATES & GOVERNANCE
// ==========================================

router.get('/templates/:code', requireAuth, requireDatabase, async (req, res) => {

  try {
    const code = req.params.code as string;
    const lang = (req.query.lang as 'ku' | 'ar' | 'en') || 'ku';
    const tmpl = templateEngine.getStandardTemplate(code, lang);
    if (!tmpl) {
      return res.status(404).json({ error: 'TEMPLATE_NOT_FOUND' });
    }
    res.json(tmpl);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/templates', requireAuth, requireDatabase, async (req, res) => {

  const hasAdmin = req.user!.roles.some((r: any) => ['SUPER_ADMIN', 'PLATFORM_ADMIN', 'ADMIN'].includes(r));
  if (!hasAdmin) {
    return res.status(403).json({ error: 'FORBIDDEN: Administrative authority required to create templates' });
  }

  try {
    const created = await communicationsCrmRepository.createTemplate(req.body);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/templates/:id/versions', requireAuth, requireDatabase, async (req, res) => {

  const hasAdmin = req.user!.roles.some((r: any) => ['SUPER_ADMIN', 'PLATFORM_ADMIN', 'ADMIN'].includes(r));
  if (!hasAdmin) {
    return res.status(403).json({ error: 'FORBIDDEN: Administrative authority required to create template versions' });
  }

  try {
    const templateId = req.params.id as string;
    // Clients cannot forge approval state: approvedBy and approvedAt are stripped from client body
    const { version, language, titleTemplate, bodyTemplate, allowedVariables } = req.body;
    const created = await communicationsCrmRepository.createTemplateVersion({
      templateId,
      version,
      language,
      titleTemplate,
      bodyTemplate,
      allowedVariables,
      approvedBy: undefined // Must undergo explicit server-side approval
    });
    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/templates/:id/versions/:versionId/approve', requireAuth, requireDatabase, async (req, res) => {

  // Approval requires COMPLIANCE_ADMIN or SUPER_ADMIN
  const hasApprovalAuthority = req.user!.roles.some((r: any) => ['SUPER_ADMIN', 'COMPLIANCE_ADMIN'].includes(r));
  if (!hasApprovalAuthority) {
    return res.status(403).json({ error: 'FORBIDDEN: Compliance or Super Admin authority required to approve templates' });
  }

  try {
    const versionId = req.params.versionId as string;
    const approved = await communicationsCrmRepository.approveTemplateVersion(versionId, req.user!.id);
    res.json(approved);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
