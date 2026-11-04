import { BaseEntity, UserRole } from './index.js';

// ============================================================================
// STAGE 11: COMMUNICATIONS / NOTIFICATIONS / CRM TYPES
// ============================================================================

export type NotificationChannel = 'IN_APP' | 'EMAIL' | 'SMS' | 'PUSH';

export enum NotificationStatus {
  PERSISTED = 'PERSISTED',
  QUEUED = 'QUEUED',
  SCHEDULED = 'SCHEDULED',
  PROCESSING = 'PROCESSING',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED'
}

export enum DeliveryStatus {
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  BOUNCED = 'BOUNCED',
  REJECTED = 'REJECTED',
  DELIVERY_UNKNOWN = 'DELIVERY_UNKNOWN',
  DELIVERY_CONFIRMED = 'DELIVERY_CONFIRMED'
}

export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';

export type NotificationSensitivity = 
  | 'PUBLIC' 
  | 'NORMAL' 
  | 'PRIVATE' 
  | 'SENSITIVE' 
  | 'SECURITY_PRIVATE' 
  | 'COMPLIANCE_PRIVATE';

export type NotificationCategory =
  | 'ACCOUNT'
  | 'SECURITY'
  | 'PROPERTY'
  | 'LEASE'
  | 'RENT'
  | 'PAYMENT'
  | 'MAINTENANCE'
  | 'LISTING'
  | 'MARKETPLACE'
  | 'DISPUTE'
  | 'COMPLIANCE'
  | 'SYSTEM'
  | 'MARKETING';

export interface NotificationItem {
  id: string;
  recipientUserId: string;
  organizationId?: string;
  propertyId?: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  sensitivity: NotificationSensitivity;
  title: string;
  body: string;
  channels: NotificationChannel[];
  status: NotificationStatus;
  sourceDomain: string;
  sourceEntityId?: string;
  templateId?: string;
  templateVersion?: string;
  metadata?: Record<string, any>;
  scheduledAt?: string;
  readAt?: string;
  dismissedAt?: string;
  expiresAt?: string;
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationDeliveryItem {
  id: string;
  notificationId: string;
  channel: NotificationChannel;
  provider: string; // 'INTERNAL_IN_APP', 'MOCK_EMAIL', 'MOCK_SMS', 'MOCK_PUSH', 'SES', 'TWILIO', 'FCM'
  providerMessageId?: string;
  attemptNumber: number;
  status: DeliveryStatus;
  recipientAddress: string; // email, phone number, device token, or userId
  failureReason?: string;
  sentAt?: string;
  deliveredAt?: string;
  createdAt: string;
}

export interface NotificationPreferenceItem {
  id: string;
  userId: string;
  channelPreferences: {
    IN_APP: boolean;
    EMAIL: boolean;
    SMS: boolean;
    PUSH: boolean;
  };
  categoryPreferences: Record<NotificationCategory, boolean>;
  quietHoursEnabled: boolean;
  quietHoursStart?: string; // e.g. "22:00"
  quietHoursEnd?: string;   // e.g. "07:00"
  preferredLanguage: 'ku' | 'ar' | 'en';
  updatedAt: string;
}

export interface CommunicationConsentItem {
  id: string;
  userId: string;
  consentType: 'MARKETING' | 'SMS_NOTIFICATIONS' | 'THIRD_PARTY_SHARING' | 'ANALYTICS';
  channel: NotificationChannel;
  purpose: string;
  status: 'GRANTED' | 'REVOKED';
  grantedAt: string;
  revokedAt?: string;
  source: string;
}

export interface NotificationTemplateItem {
  id: string;
  code: string;
  category: NotificationCategory;
  name: string;
  supportedChannels: NotificationChannel[];
  activeVersion: string;
  active: boolean;
  createdAt: string;
}

export interface NotificationTemplateVersionItem {
  id: string;
  templateId: string;
  version: string;
  language: 'ku' | 'ar' | 'en';
  titleTemplate: string;
  bodyTemplate: string;
  allowedVariables: string[];
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
}

export interface DeviceRegistrationItem {
  id: string;
  userId: string;
  deviceToken: string;
  platform: 'IOS' | 'ANDROID' | 'WEB';
  status: 'ACTIVE' | 'REVOKED';
  lastSeenAt: string;
  createdAt: string;
}

// ----------------------------------------------------------------------------
// CRM DOMAIN TYPES
// ----------------------------------------------------------------------------

export type CrmContactRelationship = 
  | 'OWNER' 
  | 'TENANT' 
  | 'BUYER' 
  | 'SELLER' 
  | 'AGENT' 
  | 'VENDOR' 
  | 'PROSPECT' 
  | 'COMPANY' 
  | 'OTHER_AUTHORIZED_PARTY';

export interface CrmContactItem {
  id: string;
  organizationId?: string;
  ownerUserId: string; // The agent, owner, or staff who manages this contact
  contactUserId?: string; // If mapped to an active platform user
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  relationship: CrmContactRelationship;
  tags: string[];
  notes?: string;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CrmActivityType =
  | 'CALL'
  | 'EMAIL'
  | 'SMS'
  | 'NOTIFICATION'
  | 'MEETING'
  | 'VIEWING'
  | 'MAINTENANCE_LOG'
  | 'LEASE_EVENT'
  | 'OFFER_EVENT'
  | 'DISPUTE_EVENT'
  | 'COMPLIANCE_EVENT'
  | 'NOTE';

export type CrmActivityVisibility = 
  | 'TEAM_PUBLIC' 
  | 'PRIVATE_TO_AUTHOR' 
  | 'RESTRICTED_MANAGEMENT';

export interface CrmActivityItem {
  id: string;
  contactId?: string;
  organizationId?: string;
  propertyId?: string;
  activityType: CrmActivityType;
  subject: string;
  description: string;
  actorUserId: string;
  visibility: CrmActivityVisibility;
  occurredAt: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export enum CrmTaskStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  WAITING = 'WAITING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  OVERDUE = 'OVERDUE'
}

export interface CrmTaskItem {
  id: string;
  organizationId?: string;
  propertyId?: string;
  contactId?: string;
  title: string;
  description?: string;
  assignedUserId: string;
  creatorUserId: string;
  dueDate: string;
  priority: NotificationPriority;
  status: CrmTaskStatus;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CrmFollowUpItem {
  id: string;
  contactId?: string;
  propertyId?: string;
  assignedUserId: string;
  title: string;
  dueDate: string;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  reminderChannel?: NotificationChannel;
  createdAt: string;
}
