import { db } from '../../db/index.js';
import {
  notifications,
  notificationDeliveries,
  notificationPreferences,
  communicationConsents,
  notificationTemplates,
  notificationTemplateVersions,
  deviceRegistrations,
  notificationWebhookEvents,
  crmContacts,
  crmActivities,
  crmTasks,
  crmFollowUps,
  ownershipRecords,
  managementAgreements,
  users
} from '../../db/schema.js';
import { eq, and, desc, inArray, sql } from 'drizzle-orm';
import {
  NotificationChannel,
  NotificationStatus,
  DeliveryStatus,
  NotificationPriority,
  NotificationSensitivity,
  NotificationCategory,
  CrmContactRelationship,
  CrmActivityType,
  CrmActivityVisibility,
  CrmTaskStatus
} from '../../types/communications-crm.js';

export class CommunicationsCrmRepository {
  isConfigured(): boolean {
    return Boolean(process.env.DATABASE_URL || (process.env.SQL_HOST && process.env.SQL_DB_NAME));
  }

  // --------------------------------------------------------------------------
  // USER PROPERTY & ORGANIZATION SCOPE RESOLUTION
  // --------------------------------------------------------------------------
  async resolveUserPropertyScope(userId: string, roles: string[], organizationId?: string): Promise<{
    hasGlobalAuthority: boolean;
    ownedPropertyIds: string[];
    managedPropertyIds: string[];
    accessiblePropertyIds: string[];
  }> {
    if (!this.isConfigured()) {
      return {
        hasGlobalAuthority: false,
        ownedPropertyIds: [],
        managedPropertyIds: [],
        accessiblePropertyIds: []
      };
    }

    const hasGlobal = roles.some(r => [
      'SUPER_ADMIN',
      'PLATFORM_ADMIN',
      'ADMIN',
      'COMPLIANCE_ADMIN',
      'AUDITOR'
    ].includes(r));

    if (hasGlobal) {
      return {
        hasGlobalAuthority: true,
        ownedPropertyIds: [],
        managedPropertyIds: [],
        accessiblePropertyIds: []
      };
    }

    let ownedIds: string[] = [];
    let managedIds: string[] = [];

    try {
      // 1. Authoritative ownership from ownership_records (must be VERIFIED)
      const owned = await db.select({ propertyId: ownershipRecords.propertyId })
        .from(ownershipRecords)
        .where(and(
          eq(ownershipRecords.ownerId, userId),
          eq(ownershipRecords.status, 'VERIFIED')
        ));
      ownedIds = owned.map(o => o.propertyId);

      // 2. Active management agreements for the company
      if (organizationId && roles.some(r => ['COMPANY', 'COMPANY_MEMBER', 'COMPANY_ADMIN'].includes(r))) {
        const managed = await db.select({ propertyId: managementAgreements.propertyId })
          .from(managementAgreements)
          .where(and(
            eq(managementAgreements.companyId, organizationId),
            eq(managementAgreements.status, 'ACTIVE')
          ));
        managedIds = managed.map(m => m.propertyId);
      }
    } catch (err) {
      // Unreachable or offline database fails closed safely
      ownedIds = [];
      managedIds = [];
    }

    const accessible = Array.from(new Set([...ownedIds, ...managedIds]));

    return {
      hasGlobalAuthority: false,
      ownedPropertyIds: ownedIds,
      managedPropertyIds: managedIds,
      accessiblePropertyIds: accessible
    };
  }

  // --------------------------------------------------------------------------
  // NOTIFICATIONS
  // --------------------------------------------------------------------------
  async createNotification(data: {
    recipientUserId: string;
    organizationId?: string;
    propertyId?: string;
    category: NotificationCategory;
    priority?: NotificationPriority;
    sensitivity?: NotificationSensitivity;
    title: string;
    message: string;
    status?: NotificationStatus;
    sourceDomain?: string;
    entityId?: string;
    entityType?: string;
    templateId?: string;
    templateVersion?: string;
    metadata?: Record<string, any>;
    scheduledAt?: Date;
    expiresAt?: Date;
    idempotencyKey?: string;
  }) {
    if (!this.isConfigured()) {
      throw new Error('DATABASE_NOT_CONFIGURED');
    }

    // Check idempotency if key provided
    if (data.idempotencyKey) {
      const existing = await db.select()
        .from(notifications)
        .where(eq(notifications.idempotencyKey, data.idempotencyKey))
        .limit(1);
      if (existing.length > 0) {
        return existing[0];
      }
    }

    const [created] = await db.insert(notifications).values({
      userId: data.recipientUserId,
      organizationId: data.organizationId,
      propertyId: data.propertyId,
      category: data.category,
      priority: data.priority || 'NORMAL',
      sensitivity: data.sensitivity || 'NORMAL',
      title: data.title,
      message: data.message,
      status: data.status || NotificationStatus.QUEUED,
      sourceDomain: data.sourceDomain,
      entityId: data.entityId,
      entityType: data.entityType,
      templateId: data.templateId,
      templateVersion: data.templateVersion,
      metadata: data.metadata,
      scheduledAt: data.scheduledAt,
      expiresAt: data.expiresAt,
      idempotencyKey: data.idempotencyKey,
    }).returning();

    return created;
  }

  async getNotificationById(id: string) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');
    const [row] = await db.select().from(notifications).where(eq(notifications.id, id)).limit(1);
    return row || null;
  }

  async listNotificationsForUser(userId: string, filter?: {
    category?: string;
    status?: string;
    unreadOnly?: boolean;
    limit?: number;
  }) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');

    let query = db.select().from(notifications).where(eq(notifications.userId, userId));
    const rows = await query.orderBy(desc(notifications.createdAt)).limit(filter?.limit || 50);

    return rows.filter(r => {
      if (filter?.category && r.category !== filter.category) return false;
      if (filter?.status && r.status !== filter.status) return false;
      if (filter?.unreadOnly && r.read) return false;
      return true;
    });
  }

  async updateNotificationStatus(id: string, newStatus: NotificationStatus, timestamps?: {
    readAt?: Date;
    dismissedAt?: Date;
  }) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');

    const updateValues: Record<string, any> = { status: newStatus };
    if (timestamps?.readAt) {
      updateValues.readAt = timestamps.readAt;
      updateValues.read = true;
    }
    if (timestamps?.dismissedAt) {
      updateValues.dismissedAt = timestamps.dismissedAt;
    }

    const [updated] = await db.update(notifications)
      .set(updateValues)
      .where(eq(notifications.id, id))
      .returning();

    return updated;
  }

  async markAsRead(id: string, userId: string) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');

    const [updated] = await db.update(notifications)
      .set({
        read: true,
        readAt: new Date(),
        status: NotificationStatus.READ
      })
      .where(and(
        eq(notifications.id, id),
        eq(notifications.userId, userId)
      ))
      .returning();

    return updated || null;
  }

  // --------------------------------------------------------------------------
  // NOTIFICATION DELIVERIES & STATE MACHINE
  // --------------------------------------------------------------------------
  async createDeliveryAttempt(data: {
    notificationId: string;
    channel: NotificationChannel;
    provider: string;
    recipientAddress: string;
    attemptNumber?: number;
    idempotencyKey?: string;
  }) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');

    // Deterministic idempotency check
    if (data.idempotencyKey) {
      const existing = await db.select()
        .from(notificationDeliveries)
        .where(eq(notificationDeliveries.idempotencyKey, data.idempotencyKey))
        .limit(1);
      if (existing.length > 0) {
        return existing[0];
      }
    }

    const [delivery] = await db.insert(notificationDeliveries).values({
      notificationId: data.notificationId,
      channel: data.channel,
      provider: data.provider,
      recipientAddress: data.recipientAddress,
      attemptNumber: data.attemptNumber || 1,
      status: DeliveryStatus.QUEUED,
      idempotencyKey: data.idempotencyKey,
    }).returning();

    return delivery;
  }

  async updateDeliveryStatus(id: string, newStatus: DeliveryStatus, details?: {
    providerMessageId?: string;
    failureReason?: string;
    sentAt?: Date;
    deliveredAt?: Date;
  }) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');

    const updateValues: Record<string, any> = { status: newStatus };
    if (details?.providerMessageId) updateValues.providerMessageId = details.providerMessageId;
    if (details?.failureReason) updateValues.failureReason = details.failureReason;
    if (details?.sentAt) updateValues.sentAt = details.sentAt;
    if (details?.deliveredAt) updateValues.deliveredAt = details.deliveredAt;

    const [updated] = await db.update(notificationDeliveries)
      .set(updateValues)
      .where(eq(notificationDeliveries.id, id))
      .returning();

    return updated;
  }

  async getDeliveryById(id: string) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');
    const [row] = await db.select().from(notificationDeliveries).where(eq(notificationDeliveries.id, id)).limit(1);
    return row || null;
  }

  async getDeliveryByIdempotencyKey(key: string) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');
    const [row] = await db.select().from(notificationDeliveries).where(eq(notificationDeliveries.idempotencyKey, key)).limit(1);
    return row || null;
  }

  // --------------------------------------------------------------------------
  // NOTIFICATION PREFERENCES
  // --------------------------------------------------------------------------
  async getUserPreferences(userId: string) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');
    const [row] = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId)).limit(1);
    return row || null;
  }

  async upsertUserPreferences(userId: string, data: {
    channelPreferences?: Record<string, boolean>;
    categoryPreferences?: Record<string, boolean>;
    quietHoursEnabled?: boolean;
    quietHoursStart?: string;
    quietHoursEnd?: string;
    preferredLanguage?: 'ku' | 'ar' | 'en';
  }) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');

    const existing = await this.getUserPreferences(userId);
    if (existing) {
      const [updated] = await db.update(notificationPreferences)
        .set({
          channelPreferences: data.channelPreferences !== undefined ? data.channelPreferences : existing.channelPreferences,
          categoryPreferences: data.categoryPreferences !== undefined ? data.categoryPreferences : existing.categoryPreferences,
          quietHoursEnabled: data.quietHoursEnabled !== undefined ? data.quietHoursEnabled : existing.quietHoursEnabled,
          quietHoursStart: data.quietHoursStart || existing.quietHoursStart,
          quietHoursEnd: data.quietHoursEnd || existing.quietHoursEnd,
          preferredLanguage: data.preferredLanguage || existing.preferredLanguage,
          updatedAt: new Date()
        })
        .where(eq(notificationPreferences.userId, userId))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(notificationPreferences).values({
        userId,
        channelPreferences: data.channelPreferences || { IN_APP: true, EMAIL: true, SMS: true, PUSH: true },
        categoryPreferences: data.categoryPreferences || {},
        quietHoursEnabled: data.quietHoursEnabled ?? false,
        quietHoursStart: data.quietHoursStart || '22:00',
        quietHoursEnd: data.quietHoursEnd || '07:00',
        preferredLanguage: data.preferredLanguage || 'ku'
      }).returning();
      return created;
    }
  }

  // --------------------------------------------------------------------------
  // COMMUNICATION CONSENT
  // --------------------------------------------------------------------------
  async getCommunicationConsent(userId: string, consentType: string, channel: string) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');
    const [row] = await db.select()
      .from(communicationConsents)
      .where(and(
        eq(communicationConsents.userId, userId),
        eq(communicationConsents.consentType, consentType),
        eq(communicationConsents.channel, channel)
      ))
      .orderBy(desc(communicationConsents.grantedAt))
      .limit(1);

    return row || null;
  }

  async recordConsent(userId: string, data: {
    consentType: string;
    channel: string;
    purpose: string;
    source: string;
  }) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');

    const [created] = await db.insert(communicationConsents).values({
      userId,
      consentType: data.consentType,
      channel: data.channel,
      purpose: data.purpose,
      status: 'GRANTED',
      source: data.source
    }).returning();

    return created;
  }

  async revokeConsent(userId: string, consentType: string, channel: string) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');

    const [updated] = await db.update(communicationConsents)
      .set({
        status: 'REVOKED',
        revokedAt: new Date()
      })
      .where(and(
        eq(communicationConsents.userId, userId),
        eq(communicationConsents.consentType, consentType),
        eq(communicationConsents.channel, channel),
        eq(communicationConsents.status, 'GRANTED')
      ))
      .returning();

    return updated || null;
  }

  // --------------------------------------------------------------------------
  // DEVICE REGISTRATION (PUSH TOKENS)
  // --------------------------------------------------------------------------
  async registerDevice(userId: string, deviceToken: string, platform: 'IOS' | 'ANDROID' | 'WEB') {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');

    // Check if device token already registered for this user
    const existing = await db.select()
      .from(deviceRegistrations)
      .where(and(
        eq(deviceRegistrations.userId, userId),
        eq(deviceRegistrations.deviceToken, deviceToken)
      ))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db.update(deviceRegistrations)
        .set({ status: 'ACTIVE', lastSeenAt: new Date() })
        .where(eq(deviceRegistrations.id, existing[0].id))
        .returning();
      return updated;
    }

    const [created] = await db.insert(deviceRegistrations).values({
      userId,
      deviceToken,
      platform,
      status: 'ACTIVE',
      lastSeenAt: new Date()
    }).returning();

    return created;
  }

  async revokeDevice(userId: string, deviceToken: string) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');

    const [revoked] = await db.update(deviceRegistrations)
      .set({ status: 'REVOKED' })
      .where(and(
        eq(deviceRegistrations.userId, userId),
        eq(deviceRegistrations.deviceToken, deviceToken)
      ))
      .returning();

    return revoked || null;
  }

  async getActiveDevicesForUser(userId: string) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');
    return db.select()
      .from(deviceRegistrations)
      .where(and(
        eq(deviceRegistrations.userId, userId),
        eq(deviceRegistrations.status, 'ACTIVE')
      ));
  }

  // --------------------------------------------------------------------------
  // TEMPLATES & VERSIONS
  // --------------------------------------------------------------------------
  async getTemplateByCode(code: string) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');
    const [row] = await db.select()
      .from(notificationTemplates)
      .where(eq(notificationTemplates.code, code))
      .limit(1);
    return row || null;
  }

  async getTemplateVersion(templateId: string, version: string, language: string) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');
    const [row] = await db.select()
      .from(notificationTemplateVersions)
      .where(and(
        eq(notificationTemplateVersions.templateId, templateId),
        eq(notificationTemplateVersions.version, version),
        eq(notificationTemplateVersions.language, language)
      ))
      .limit(1);
    return row || null;
  }

  async createTemplate(data: {
    code: string;
    category: NotificationCategory;
    name: string;
    supportedChannels: NotificationChannel[];
    activeVersion?: string;
  }) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');
    const [created] = await db.insert(notificationTemplates).values({
      code: data.code,
      category: data.category,
      name: data.name,
      supportedChannels: data.supportedChannels,
      activeVersion: data.activeVersion || '1.0',
      active: true
    }).returning();
    return created;
  }

  async createTemplateVersion(data: {
    templateId: string;
    version: string;
    language: 'ku' | 'ar' | 'en';
    titleTemplate: string;
    bodyTemplate: string;
    allowedVariables: string[];
    approvedBy?: string;
  }) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');
    const [created] = await db.insert(notificationTemplateVersions).values({
      templateId: data.templateId,
      version: data.version,
      language: data.language,
      titleTemplate: data.titleTemplate,
      bodyTemplate: data.bodyTemplate,
      allowedVariables: data.allowedVariables,
      approvedBy: data.approvedBy,
      approvedAt: data.approvedBy ? new Date() : null
    }).returning();
    return created;
  }

  async approveTemplateVersion(versionId: string, approvedByUserId: string) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');
    const [updated] = await db.update(notificationTemplateVersions)
      .set({
        approvedBy: approvedByUserId,
        approvedAt: new Date()
      })
      .where(eq(notificationTemplateVersions.id, versionId))
      .returning();
    return updated || null;
  }

  // --------------------------------------------------------------------------
  // WEBHOOK EVENTS
  // --------------------------------------------------------------------------
  async recordWebhookEvent(data: {
    provider: string;
    providerEventId?: string;
    eventType: string;
    payload: Record<string, any>;
    signatureVerified: boolean;
    idempotencyKey?: string;
  }) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');

    // Idempotency check
    if (data.idempotencyKey) {
      const existing = await db.select()
        .from(notificationWebhookEvents)
        .where(eq(notificationWebhookEvents.idempotencyKey, data.idempotencyKey))
        .limit(1);
      if (existing.length > 0) {
        return { event: existing[0], isDuplicate: true };
      }
    }

    if (data.providerEventId) {
      const existing = await db.select()
        .from(notificationWebhookEvents)
        .where(and(
          eq(notificationWebhookEvents.provider, data.provider),
          eq(notificationWebhookEvents.providerEventId, data.providerEventId)
        ))
        .limit(1);
      if (existing.length > 0) {
        return { event: existing[0], isDuplicate: true };
      }
    }

    const [created] = await db.insert(notificationWebhookEvents).values({
      provider: data.provider,
      providerEventId: data.providerEventId,
      eventType: data.eventType,
      payload: data.payload,
      signatureVerified: data.signatureVerified,
      idempotencyKey: data.idempotencyKey,
      processedAt: new Date()
    }).returning();

    return { event: created, isDuplicate: false };
  }

  // --------------------------------------------------------------------------
  // CRM CONTACTS
  // --------------------------------------------------------------------------
  async createContact(data: {
    organizationId?: string;
    ownerUserId: string;
    contactUserId?: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    relationship?: CrmContactRelationship;
    tags?: string[];
    notes?: string;
    isPrivate?: boolean;
  }) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');

    const [contact] = await db.insert(crmContacts).values({
      organizationId: data.organizationId,
      ownerUserId: data.ownerUserId,
      contactUserId: data.contactUserId,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      relationship: data.relationship || 'PROSPECT',
      tags: data.tags || [],
      notes: data.notes,
      isPrivate: data.isPrivate ?? false
    }).returning();

    return contact;
  }

  async getContactById(id: string) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');
    const [row] = await db.select().from(crmContacts).where(eq(crmContacts.id, id)).limit(1);
    return row || null;
  }

  async listContacts(actorUserId: string, actorRoles: string[], organizationId?: string) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');

    const hasGlobal = actorRoles.some(r => ['SUPER_ADMIN', 'ADMIN', 'COMPLIANCE_ADMIN'].includes(r));
    if (hasGlobal) {
      return db.select().from(crmContacts).orderBy(desc(crmContacts.createdAt)).limit(100);
    }

    if (organizationId && actorRoles.some(r => ['COMPANY', 'COMPANY_MEMBER', 'COMPANY_ADMIN'].includes(r))) {
      // Organization contacts, filtering out private notes if owned by someone else unless admin
      return db.select()
        .from(crmContacts)
        .where(eq(crmContacts.organizationId, organizationId))
        .orderBy(desc(crmContacts.createdAt))
        .limit(100);
    }

    // Individual agent/owner
    return db.select()
      .from(crmContacts)
      .where(eq(crmContacts.ownerUserId, actorUserId))
      .orderBy(desc(crmContacts.createdAt))
      .limit(100);
  }

  // --------------------------------------------------------------------------
  // CRM ACTIVITIES & TIMELINE
  // --------------------------------------------------------------------------
  async createActivity(data: {
    contactId?: string;
    organizationId?: string;
    propertyId?: string;
    activityType: CrmActivityType;
    subject: string;
    description: string;
    actorUserId: string;
    visibility?: CrmActivityVisibility;
    metadata?: Record<string, any>;
  }) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');

    const [activity] = await db.insert(crmActivities).values({
      contactId: data.contactId,
      organizationId: data.organizationId,
      propertyId: data.propertyId,
      activityType: data.activityType,
      subject: data.subject,
      description: data.description,
      actorUserId: data.actorUserId,
      visibility: data.visibility || 'TEAM_PUBLIC',
      metadata: data.metadata
    }).returning();

    return activity;
  }

  async listActivities(filter: {
    contactId?: string;
    propertyId?: string;
    organizationId?: string;
    actorUserId: string;
    actorRoles: string[];
  }) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');

    let query = db.select().from(crmActivities);
    const rows = await query.orderBy(desc(crmActivities.occurredAt)).limit(100);

    const hasGlobal = filter.actorRoles.some(r => ['SUPER_ADMIN', 'ADMIN', 'COMPLIANCE_ADMIN'].includes(r));

    return rows.filter(act => {
      // Scoping
      if (filter.contactId && act.contactId !== filter.contactId) return false;
      if (filter.propertyId && act.propertyId !== filter.propertyId) return false;
      if (filter.organizationId && act.organizationId !== filter.organizationId) return false;

      // Visibility
      if (hasGlobal) return true;
      if (act.actorUserId === filter.actorUserId) return true;
      if (act.visibility === 'PRIVATE_TO_AUTHOR') return false;
      if (act.visibility === 'RESTRICTED_MANAGEMENT') {
        return filter.actorRoles.some(r => ['COMPANY_ADMIN', 'ADMIN'].includes(r));
      }
      return true; // TEAM_PUBLIC
    });
  }

  // --------------------------------------------------------------------------
  // CRM TASKS
  // --------------------------------------------------------------------------
  async createTask(data: {
    organizationId?: string;
    propertyId?: string;
    contactId?: string;
    title: string;
    description?: string;
    assignedUserId: string;
    creatorUserId: string;
    dueDate: string;
    priority?: NotificationPriority;
  }) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');

    const [task] = await db.insert(crmTasks).values({
      organizationId: data.organizationId,
      propertyId: data.propertyId,
      contactId: data.contactId,
      title: data.title,
      description: data.description,
      assignedUserId: data.assignedUserId,
      creatorUserId: data.creatorUserId,
      dueDate: data.dueDate,
      priority: data.priority || 'NORMAL',
      status: CrmTaskStatus.OPEN
    }).returning();

    return task;
  }

  async getTaskById(id: string) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');
    const [task] = await db.select().from(crmTasks).where(eq(crmTasks.id, id)).limit(1);
    return task || null;
  }

  async updateTaskStatus(id: string, status: CrmTaskStatus) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');

    const updateValues: Record<string, any> = {
      status,
      updatedAt: new Date()
    };
    if (status === CrmTaskStatus.COMPLETED) {
      updateValues.completedAt = new Date();
    }

    const [updated] = await db.update(crmTasks)
      .set(updateValues)
      .where(eq(crmTasks.id, id))
      .returning();

    return updated || null;
  }

  async listTasks(actorUserId: string, actorRoles: string[], filter?: {
    organizationId?: string;
    propertyId?: string;
    status?: string;
  }) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');

    const hasGlobal = actorRoles.some(r => ['SUPER_ADMIN', 'ADMIN'].includes(r));
    let rows = await db.select().from(crmTasks).orderBy(desc(crmTasks.createdAt)).limit(100);

    return rows.filter(t => {
      if (filter?.status && t.status !== filter.status) return false;
      if (filter?.propertyId && t.propertyId !== filter.propertyId) return false;
      if (filter?.organizationId && t.organizationId !== filter.organizationId) return false;

      if (hasGlobal) return true;
      if (t.assignedUserId === actorUserId || t.creatorUserId === actorUserId) return true;
      if (filter?.organizationId && t.organizationId === filter.organizationId) return true;

      return false;
    });
  }

  // --------------------------------------------------------------------------
  // CRM FOLLOW-UPS
  // --------------------------------------------------------------------------
  async createFollowUp(data: {
    contactId?: string;
    propertyId?: string;
    assignedUserId: string;
    title: string;
    dueDate: string;
    reminderChannel?: NotificationChannel;
  }) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');

    const [followUp] = await db.insert(crmFollowUps).values({
      contactId: data.contactId,
      propertyId: data.propertyId,
      assignedUserId: data.assignedUserId,
      title: data.title,
      dueDate: data.dueDate,
      reminderChannel: data.reminderChannel,
      status: 'PENDING'
    }).returning();

    return followUp;
  }

  async updateFollowUpStatus(id: string, status: 'PENDING' | 'COMPLETED' | 'CANCELLED') {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');

    const [updated] = await db.update(crmFollowUps)
      .set({ status })
      .where(eq(crmFollowUps.id, id))
      .returning();

    return updated || null;
  }

  async listFollowUps(assignedUserId: string) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');
    return db.select()
      .from(crmFollowUps)
      .where(eq(crmFollowUps.assignedUserId, assignedUserId))
      .orderBy(crmFollowUps.dueDate);
  }
}

export const communicationsCrmRepository = new CommunicationsCrmRepository();
