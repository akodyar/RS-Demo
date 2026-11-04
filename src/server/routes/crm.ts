import { Router } from 'express';
import { requireDatabase } from '../middleware/dbGuard.js';
import { requireAuth } from '../middleware/auth.js';
import { auditService } from '../services/audit.js';
import { communicationsCrmRepository } from '../repositories/communications-crm.js';
import { crmService } from '../services/crm-service.js';
import { CrmTaskStatus } from '../../types/communications-crm.js';

const router = Router();

const sendDbNotConfigured = (res: any) => {
  return res.status(503).json({
    error: 'DATABASE_NOT_CONFIGURED',
    code: 'SERVICE_UNAVAILABLE',
    message: 'The authoritative relational storage service is unconfigured. Fail-closed enforced.',
  });
};

// ==========================================
// CRM CONTACTS
// ==========================================

router.get('/contacts', requireAuth, requireDatabase, async (req, res) => {

  try {
    const contacts = await communicationsCrmRepository.listContacts(
      req.user!.id,
      req.user!.roles,
      req.user!.organizationId
    );
    res.json(contacts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/contacts', requireAuth, requireDatabase, async (req, res) => {

  try {
    const contact = await crmService.createContact(req.user!.id, req.user!.roles, {
      ...req.body,
      organizationId: req.user!.organizationId
    });
    res.status(201).json(contact);
  } catch (err: any) {
    if (err.message?.includes('UNAUTHORIZED_CRM_ROLE')) {
      return res.status(403).json({ error: err.message });
    }
    if (err.message?.includes('INVALID_CONTACT_DATA')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

router.get('/contacts/:id', requireAuth, requireDatabase, async (req, res) => {

  try {
    const contactId = req.params.id as string;
    const contact = await crmService.getContact(req.user!.id, req.user!.roles, contactId, req.user!.organizationId);
    res.json(contact);
  } catch (err: any) {
    if (err.message === 'CONTACT_NOT_FOUND') {
      return res.status(404).json({ error: 'CONTACT_NOT_FOUND' });
    }
    if (err.message?.includes('FORBIDDEN_CRM_ACCESS')) {
      return res.status(403).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// ACTIVITIES & TIMELINE
// ==========================================

router.post('/activities', requireAuth, requireDatabase, async (req, res) => {

  try {
    const activity = await crmService.logActivity(req.user!.id, req.user!.roles, {
      ...req.body,
      organizationId: req.user!.organizationId
    });
    res.status(201).json(activity);
  } catch (err: any) {
    if (err.message?.includes('INVALID_ACTIVITY_DATA')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

router.get('/timeline', requireAuth, requireDatabase, async (req, res) => {

  try {
    const { contactId, propertyId } = req.query;
    const timeline = await crmService.getTimeline(req.user!.id, req.user!.roles, {
      contactId: contactId as string,
      propertyId: propertyId as string,
      organizationId: req.user!.organizationId
    });
    res.json(timeline);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// TASKS
// ==========================================

router.get('/tasks', requireAuth, requireDatabase, async (req, res) => {

  try {
    const { status, propertyId } = req.query;
    const tasks = await communicationsCrmRepository.listTasks(req.user!.id, req.user!.roles, {
      organizationId: req.user!.organizationId,
      propertyId: propertyId as string,
      status: status as string
    });
    res.json(tasks);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/tasks', requireAuth, requireDatabase, async (req, res) => {

  try {
    const task = await crmService.createTask(req.user!.id, req.user!.roles, {
      ...req.body,
      organizationId: req.user!.organizationId
    });
    res.status(201).json(task);
  } catch (err: any) {
    if (err.message?.includes('INVALID_TASK_DATA')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

router.put('/tasks/:id/status', requireAuth, requireDatabase, async (req, res) => {

  try {
    const { status } = req.body;
    if (!status || !Object.values(CrmTaskStatus).includes(status)) {
      return res.status(400).json({ error: 'INVALID_STATUS', message: 'Valid status required' });
    }

    const taskId = req.params.id as string;
    const updated = await crmService.updateTaskStatus(req.user!.id, req.user!.roles, taskId, status);
    res.json(updated);
  } catch (err: any) {
    if (err.message === 'TASK_NOT_FOUND') {
      return res.status(404).json({ error: 'TASK_NOT_FOUND' });
    }
    if (err.message?.includes('FORBIDDEN_TASK_MUTATION')) {
      return res.status(403).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// FOLLOW-UPS
// ==========================================

router.post('/follow-ups', requireAuth, requireDatabase, async (req, res) => {

  try {
    const followUp = await crmService.scheduleFollowUp(req.user!.id, req.body);
    res.status(201).json(followUp);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/follow-ups', requireAuth, requireDatabase, async (req, res) => {

  try {
    const followUps = await communicationsCrmRepository.listFollowUps(req.user!.id);
    res.json(followUps);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// LEADS COMPATIBILITY ENDPOINTS
// ==========================================

router.get('/leads', requireAuth, requireDatabase, async (req, res) => {

  try {
    const contacts = await communicationsCrmRepository.listContacts(
      req.user!.id,
      req.user!.roles,
      req.user!.organizationId
    );
    res.json(contacts.filter(c => c.relationship === 'PROSPECT' || c.relationship === 'BUYER'));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/leads/:id/assign', requireAuth, requireDatabase, async (req, res) => {

  const leadId = req.params.id as string;
  const { assignedToUserId } = req.body;

  try {
    const contact = await communicationsCrmRepository.getContactById(leadId);
    if (!contact) {
      return res.status(404).json({ error: 'LEAD_NOT_FOUND' });
    }

    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] as string,
      action: 'ASSIGN_LEAD',
      resourceType: 'Lead',
      resourceId: leadId as string,
      changes: { assignedToUserId },
      ipAddress: (req.ip || '') as string
    });

    res.json({ success: true, leadId, assignedToUserId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
