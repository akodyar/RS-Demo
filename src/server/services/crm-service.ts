import { communicationsCrmRepository } from '../repositories/communications-crm.js';
import { auditService } from './audit.js';
import {
  CrmContactRelationship,
  CrmActivityType,
  CrmActivityVisibility,
  CrmTaskStatus,
  NotificationPriority
} from '../../types/communications-crm.js';

export class CrmService {
  // --------------------------------------------------------------------------
  // CONTACTS
  // --------------------------------------------------------------------------
  async createContact(actorUserId: string, actorRoles: string[], data: {
    organizationId?: string;
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
    if (!communicationsCrmRepository.isConfigured()) {
      throw new Error('DATABASE_NOT_CONFIGURED');
    }

    if (!data.firstName || !data.lastName) {
      throw new Error('INVALID_CONTACT_DATA: firstName and lastName are required');
    }

    // Role check: Only authorized roles can create CRM contacts
    const allowedRoles = ['AGENT', 'COMPANY', 'COMPANY_MEMBER', 'COMPANY_ADMIN', 'ADMIN', 'SUPER_ADMIN', 'OWNER'];
    const hasRole = actorRoles.some(r => allowedRoles.includes(r));
    if (!hasRole) {
      throw new Error('UNAUTHORIZED_CRM_ROLE: Insufficient permissions to manage CRM contacts');
    }

    const contact = await communicationsCrmRepository.createContact({
      organizationId: data.organizationId,
      ownerUserId: actorUserId,
      contactUserId: data.contactUserId,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      relationship: data.relationship || 'PROSPECT',
      tags: data.tags,
      notes: data.notes,
      isPrivate: data.isPrivate
    });

    await auditService.logAction({
      actorUserId,
      actorRole: actorRoles[0] || 'USER',
      action: 'CRM_CONTACT_CREATED',
      resourceType: 'CrmContact',
      resourceId: contact.id,
      changes: { relationship: contact.relationship, organizationId: contact.organizationId },
      ipAddress: '127.0.0.1'
    });

    return contact;
  }

  async getContact(actorUserId: string, actorRoles: string[], contactId: string, actorOrganizationId?: string) {
    if (!communicationsCrmRepository.isConfigured()) {
      throw new Error('DATABASE_NOT_CONFIGURED');
    }

    const contact = await communicationsCrmRepository.getContactById(contactId);
    if (!contact) {
      throw new Error('CONTACT_NOT_FOUND');
    }

    const hasGlobal = actorRoles.some(r => ['SUPER_ADMIN', 'ADMIN', 'COMPLIANCE_ADMIN'].includes(r));
    if (hasGlobal) return contact;

    // Cross-tenant & Privacy isolation:
    // If contact belongs to an organization, actor MUST be in the same organization
    if (contact.organizationId && contact.organizationId !== actorOrganizationId) {
      throw new Error('FORBIDDEN_CRM_ACCESS: Contact belongs to another organization');
    }

    // If contact is personal/private, only the creator/owner can view it
    if (contact.ownerUserId !== actorUserId) {
      if (contact.isPrivate || !contact.organizationId) {
        throw new Error('FORBIDDEN_CRM_ACCESS: Contact is private to owner');
      }
    }

    return contact;
  }

  // --------------------------------------------------------------------------
  // ACTIVITIES & TIMELINE
  // --------------------------------------------------------------------------
  async logActivity(actorUserId: string, actorRoles: string[], data: {
    contactId?: string;
    organizationId?: string;
    propertyId?: string;
    activityType: CrmActivityType;
    subject: string;
    description: string;
    visibility?: CrmActivityVisibility;
    metadata?: Record<string, any>;
  }) {
    if (!communicationsCrmRepository.isConfigured()) {
      throw new Error('DATABASE_NOT_CONFIGURED');
    }

    if (!data.subject || !data.description) {
      throw new Error('INVALID_ACTIVITY_DATA: subject and description are required');
    }

    const activity = await communicationsCrmRepository.createActivity({
      contactId: data.contactId,
      organizationId: data.organizationId,
      propertyId: data.propertyId,
      activityType: data.activityType,
      subject: data.subject,
      description: data.description,
      actorUserId,
      visibility: data.visibility || 'TEAM_PUBLIC',
      metadata: data.metadata
    });

    await auditService.logAction({
      actorUserId,
      actorRole: actorRoles[0] || 'USER',
      action: 'CRM_ACTIVITY_LOGGED',
      resourceType: 'CrmActivity',
      resourceId: activity.id,
      changes: { activityType: activity.activityType, visibility: activity.visibility },
      ipAddress: '127.0.0.1'
    });

    return activity;
  }

  async getTimeline(actorUserId: string, actorRoles: string[], filter: {
    contactId?: string;
    propertyId?: string;
    organizationId?: string;
  }) {
    if (!communicationsCrmRepository.isConfigured()) {
      throw new Error('DATABASE_NOT_CONFIGURED');
    }

    return communicationsCrmRepository.listActivities({
      contactId: filter.contactId,
      propertyId: filter.propertyId,
      organizationId: filter.organizationId,
      actorUserId,
      actorRoles
    });
  }

  // --------------------------------------------------------------------------
  // TASKS
  // --------------------------------------------------------------------------
  async createTask(actorUserId: string, actorRoles: string[], data: {
    organizationId?: string;
    propertyId?: string;
    contactId?: string;
    title: string;
    description?: string;
    assignedUserId: string;
    dueDate: string;
    priority?: NotificationPriority;
  }) {
    if (!communicationsCrmRepository.isConfigured()) {
      throw new Error('DATABASE_NOT_CONFIGURED');
    }

    if (!data.title || !data.dueDate) {
      throw new Error('INVALID_TASK_DATA: title and dueDate are required');
    }

    const task = await communicationsCrmRepository.createTask({
      organizationId: data.organizationId,
      propertyId: data.propertyId,
      contactId: data.contactId,
      title: data.title,
      description: data.description,
      assignedUserId: data.assignedUserId,
      creatorUserId: actorUserId,
      dueDate: data.dueDate,
      priority: data.priority || 'NORMAL'
    });

    await auditService.logAction({
      actorUserId,
      actorRole: actorRoles[0] || 'USER',
      action: 'CRM_TASK_CREATED',
      resourceType: 'CrmTask',
      resourceId: task.id,
      changes: { title: task.title, assignedUserId: task.assignedUserId, dueDate: task.dueDate },
      ipAddress: '127.0.0.1'
    });

    return task;
  }

  async updateTaskStatus(actorUserId: string, actorRoles: string[], taskId: string, newStatus: CrmTaskStatus) {
    if (!communicationsCrmRepository.isConfigured()) {
      throw new Error('DATABASE_NOT_CONFIGURED');
    }

    const task = await communicationsCrmRepository.getTaskById(taskId);
    if (!task) throw new Error('TASK_NOT_FOUND');

    const hasGlobal = actorRoles.some(r => ['SUPER_ADMIN', 'ADMIN'].includes(r));
    if (!hasGlobal && task.assignedUserId !== actorUserId && task.creatorUserId !== actorUserId) {
      throw new Error('FORBIDDEN_TASK_MUTATION: Only task assignee or creator can update task status');
    }

    // State machine check
    if (task.status === CrmTaskStatus.COMPLETED && newStatus === CrmTaskStatus.COMPLETED) {
      return task; // Idempotent
    }

    const updated = await communicationsCrmRepository.updateTaskStatus(taskId, newStatus);

    await auditService.logAction({
      actorUserId,
      actorRole: actorRoles[0] || 'USER',
      action: 'CRM_TASK_STATUS_UPDATED',
      resourceType: 'CrmTask',
      resourceId: taskId,
      changes: { previousStatus: task.status, newStatus },
      ipAddress: '127.0.0.1'
    });

    return updated;
  }

  // --------------------------------------------------------------------------
  // FOLLOW-UPS
  // --------------------------------------------------------------------------
  async scheduleFollowUp(actorUserId: string, data: {
    contactId?: string;
    propertyId?: string;
    title: string;
    dueDate: string;
    reminderChannel?: any;
  }) {
    if (!communicationsCrmRepository.isConfigured()) {
      throw new Error('DATABASE_NOT_CONFIGURED');
    }

    return communicationsCrmRepository.createFollowUp({
      contactId: data.contactId,
      propertyId: data.propertyId,
      assignedUserId: actorUserId,
      title: data.title,
      dueDate: data.dueDate,
      reminderChannel: data.reminderChannel
    });
  }
}

export const crmService = new CrmService();
