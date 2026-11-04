import { Router } from 'express';
import { requireDatabase } from '../middleware/dbGuard.js';
import { requireAuth, requireRole, requireActiveRole } from '../middleware/auth.js';
import { UserRole } from '../../types/index.js';
import { agentRepository } from '../repositories/agent.js';
import { agentService } from '../services/agent.js';
import { auditService } from '../services/audit.js';
import { propertyHealthService } from '../services/propertyHealth.js';
import { FeatureFlags } from '../../utils/featureFlags.js';

export const agentRouter = Router();

export const ALLOWED_AGENT_WORKSPACE_ROLES: (UserRole | string)[] = [
  UserRole.AGENT_BROKER,
  'AGENT',
  'AGENT_BROKER',
  UserRole.PLATFORM_ADMIN,
  'SUPER_ADMIN',
  'ADMIN',
];

// Global Gatekeeper: Require Authentication and Active Agent Workspace Context
agentRouter.use(requireAuth);
agentRouter.use(requireActiveRole(ALLOWED_AGENT_WORKSPACE_ROLES));
agentRouter.use((req, res, next) => {
  const allowedRoles = [UserRole.AGENT_BROKER, UserRole.COMPANY_MEMBER, UserRole.PLATFORM_ADMIN, 'AGENT_BROKER', 'AGENT', 'COMPANY_MEMBER', 'PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN'];
  const userRoles = req.user?.roles || [];
  const hasRole = userRoles.some((role: any) => allowedRoles.includes(role));

  if (!hasRole) {
    return res.status(403).json({
      error: 'Forbidden: Insufficient role permissions for Agent/Broker domain.',
      code: 'ROLE_FORBIDDEN',
    });
  }
  next();
});

const requireActiveAgent = async (req: any, res: any, next: any) => {
  try {
    const profile = await agentRepository.getProfile(req.user!.id);
    if (!profile || profile.status !== 'ACTIVE') {
      return res.status(403).json({
        error: 'AGENT_VERIFICATION_REQUIRED',
        code: 'PROFILE_PENDING_VERIFICATION',
        message: 'Your agent profile is pending verification. Professional operations are restricted until verification is complete.',
      });
    }
    next();
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(500).json({ error: 'Failed to verify agent profile status' });
  }
};


// ==========================================
// 1. DASHBOARD & AGGREGATED VIEWS
// ==========================================

agentRouter.get('/dashboard', async (req, res) => {
  
  try {
    const dashboard = await agentRepository.getAuthoritativeDashboard(req.user!.id);
    res.json(dashboard);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(500).json({ error: err.message });
  }
});

agentRouter.get('/properties/health', async (req, res) => {
  try {
    const properties = await agentRepository.getAssignedProperties(req.user!.id);
    const propertyIds = properties.map(p => p.propertyId);
    const health = await propertyHealthService.getPropertiesHealth(propertyIds, 'AGENT', req.user!.organizationId);
    res.json(health);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 2. PROFILE & VERIFICATION
// ==========================================

agentRouter.get('/profile', async (req, res) => {
  
  try {
    const profile = await agentRepository.getProfile(req.user!.id);
    res.json(profile || { userId: req.user!.id, displayName: req.user!.name || 'Agent', status: 'PENDING_VERIFICATION' });
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(500).json({ error: err.message });
  }
});

agentRouter.put('/profile', async (req, res) => {
  
  try {
    // Prevent client from mutating status or userId
    const safePayload = { ...req.body };
    delete safePayload.id;
    delete safePayload.userId;
    delete safePayload.status;

    const updated = await agentRepository.upsertProfile(req.user!.id, safePayload);
    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] as string,
      action: 'UPDATE_AGENT_PROFILE',
      resourceType: 'AgentProfile',
      resourceId: updated.id,
      changes: safePayload,
      ipAddress: (req.ip || '') as string
    });
    res.json(updated);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(400).json({ error: err.message });
  }
});

agentRouter.get('/verification', async (req, res) => {
  
  try {
    const license = await agentRepository.getLicense(req.user!.id);
    res.json(license || { userId: req.user!.id, verificationStatus: 'NOT_SUBMITTED' });
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(500).json({ error: err.message });
  }
});

agentRouter.post('/verification', async (req, res) => {
  
  const { licenseNumber, issuingAuthority, issuedDate, expiryDate, documentUrl } = req.body;
  if (!licenseNumber || !issuingAuthority) {
    return res.status(400).json({ error: 'licenseNumber and issuingAuthority are required.' });
  }

  try {
    const created = await agentRepository.submitLicense(req.user!.id, {
      licenseNumber,
      issuingAuthority,
      issuedDate,
      expiryDate,
      documentUrl,
    });
    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] as string,
      action: 'SUBMIT_AGENT_LICENSE',
      resourceType: 'AgentLicense',
      resourceId: created.id,
      changes: { licenseNumber, issuingAuthority },
      ipAddress: (req.ip || '') as string
    });
    res.status(201).json(created);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 3. PROPERTY ASSIGNMENTS
// ==========================================

agentRouter.get('/memberships', async (req, res) => {
  
  try {
    const assignments = await agentRepository.getPropertyAssignments(req.user!.id);
    res.json(assignments);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 4. LISTINGS WORKFLOW
// ==========================================

agentRouter.get('/listings', async (req, res) => {
  
  try {
    const items = await agentRepository.getListings(req.user!.id);
    res.json(items);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(500).json({ error: err.message });
  }
});

agentRouter.post('/listings', requireActiveAgent, async (req, res) => {
  
  const { propertyId, type, price, currency, title, description } = req.body;
  if (!propertyId || !type || !price || !title) {
    return res.status(400).json({ error: 'propertyId, type, price, and title are required.' });
  }

  if ((type === 'FOR_SALE' || type === 'SALE') && !FeatureFlags.BUY_SELL_ENABLED) {
    return res.status(403).json({
      error: 'BUY_SELL_DISABLED: Buying and selling features are permanently disabled in this release. HomeHub is strictly rental-only.',
      code: 'BUY_SELL_DISABLED'
    });
  }

  try {
    const created = await agentRepository.createListing(req.user!.id, {
      propertyId,
      type,
      price: Number(price),
      currency,
      title,
      description,
    });
    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] as string,
      action: 'CREATE_AGENT_LISTING',
      resourceType: 'Listing',
      resourceId: created.id,
      changes: { propertyId, price, title },
      ipAddress: (req.ip || '') as string
    });
    res.status(201).json(created);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    if (err.message.startsWith('AUTHORITY_REQUIRED')) {
      return res.status(403).json({ error: err.message });
    }
    res.status(400).json({ error: err.message });
  }
});

agentRouter.put('/listings/:id', requireActiveAgent, async (req, res) => {

  
  try {
    const updated = await agentRepository.updateListing(req.user!.id, req.params.id, req.body);
    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] as string,
      action: 'UPDATE_AGENT_LISTING',
      resourceType: 'Listing',
      resourceId: req.params.id,
      changes: req.body,
      ipAddress: (req.ip || '') as string
    });
    res.json(updated);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    if (err.message.startsWith('AUTHORITY_REQUIRED')) {
      return res.status(403).json({ error: err.message });
    }
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 5. LEADS / CRM PIPELINE
// ==========================================

agentRouter.get('/leads', async (req, res) => {
  
  try {
    const leads = await agentRepository.getLeads(req.user!.id);
    res.json(leads);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(500).json({ error: err.message });
  }
});

agentRouter.post('/leads', async (req, res) => {
  
  const { clientName, clientPhone, clientEmail, leadType, budgetMin, budgetMax, currency, preferredLocations, propertyType, notes, priority } = req.body;
  if (!clientName) {
    return res.status(400).json({ error: 'clientName is required.' });
  }

  try {
    const created = await agentRepository.createLead(req.user!.id, {
      clientName,
      clientPhone,
      clientEmail,
      leadType,
      budgetMin,
      budgetMax,
      currency,
      preferredLocations,
      propertyType,
      notes,
      priority,
    });
    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] as string,
      action: 'CREATE_AGENT_LEAD',
      resourceType: 'AgentLead',
      resourceId: created.id,
      changes: { clientName, leadType },
      ipAddress: (req.ip || '') as string
    });
    res.status(201).json(created);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(400).json({ error: err.message });
  }
});

agentRouter.get('/leads/:id', async (req, res) => {
  
  try {
    const lead = await agentRepository.getLeadById(req.user!.id, req.params.id);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found or access forbidden.' });
    }
    res.json(lead);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(500).json({ error: err.message });
  }
});

agentRouter.patch('/leads/:id', async (req, res) => {
  
  try {
    const updated = await agentRepository.updateLead(req.user!.id, req.params.id, req.body);
    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] as string,
      action: 'UPDATE_AGENT_LEAD',
      resourceType: 'AgentLead',
      resourceId: req.params.id,
      changes: req.body,
      ipAddress: (req.ip || '') as string
    });
    res.json(updated);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    if (err.message === 'LEAD_NOT_FOUND_OR_FORBIDDEN') {
      return res.status(404).json({ error: err.message });
    }
    res.status(400).json({ error: err.message });
  }
});

agentRouter.patch('/leads/:id/stage', async (req, res) => {
  
  const { stage } = req.body;
  if (!stage) {
    return res.status(400).json({ error: 'stage is required.' });
  }

  try {
    const updated = await agentRepository.transitionLeadStage(req.user!.id, req.params.id, stage);
    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] as string,
      action: 'TRANSITION_LEAD_STAGE',
      resourceType: 'AgentLead',
      resourceId: req.params.id,
      changes: { stage },
      ipAddress: (req.ip || '') as string
    });
    res.json(updated);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    if (err.message === 'LEAD_NOT_FOUND_OR_FORBIDDEN') {
      return res.status(404).json({ error: err.message });
    }
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 6. BUYER INQUIRIES & VIEWINGS
// ==========================================

agentRouter.get('/inquiries', async (req, res) => {
  
  try {
    const inquiries = await agentRepository.getInquiries(req.user!.id);
    res.json(inquiries);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(500).json({ error: err.message });
  }
});

agentRouter.post('/inquiries/:id/respond', async (req, res) => {
  
  const { responseMessage } = req.body;
  if (!responseMessage) {
    return res.status(400).json({ error: 'responseMessage is required.' });
  }

  try {
    const updated = await agentRepository.respondToInquiry(req.user!.id, req.params.id, responseMessage);
    res.json(updated);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    if (err.message.startsWith('AUTHORITY_REQUIRED')) {
      return res.status(403).json({ error: err.message });
    }
    res.status(400).json({ error: err.message });
  }
});

agentRouter.get('/viewings', async (req, res) => {
  
  try {
    const viewings = await agentRepository.getViewings(req.user!.id);
    res.json(viewings);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(500).json({ error: err.message });
  }
});

agentRouter.patch('/viewings/:id/status', async (req, res) => {
  
  const { status, notes } = req.body;
  if (!status) {
    return res.status(400).json({ error: 'status is required.' });
  }

  try {
    const updated = await agentRepository.updateViewingStatus(req.user!.id, req.params.id, status, notes);
    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] as string,
      action: 'UPDATE_VIEWING_STATUS',
      resourceType: 'PropertyViewing',
      resourceId: req.params.id,
      changes: { status, notes },
      ipAddress: (req.ip || '') as string
    });
    res.json(updated);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    if (err.message.startsWith('AUTHORITY_REQUIRED')) {
      return res.status(403).json({ error: err.message });
    }
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 7. OFFERS & COUNTER-OFFERS
// ==========================================

agentRouter.get('/offers', async (req, res) => {
  
  try {
    const offers = await agentRepository.getOffers(req.user!.id);
    res.json(offers);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(500).json({ error: err.message });
  }
});

agentRouter.post('/offers/:id/counter', async (req, res) => {
  
  const { counterAmount, counterTerms, note } = req.body;
  if (!counterAmount || Number(counterAmount) <= 0) {
    return res.status(400).json({ error: 'Valid counterAmount is required.' });
  }

  try {
    const updated = await agentRepository.submitCounterOffer(req.user!.id, req.params.id, Number(counterAmount), counterTerms, note);
    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] as string,
      action: 'SUBMIT_COUNTER_OFFER',
      resourceType: 'PropertyOffer',
      resourceId: req.params.id,
      changes: { counterAmount, counterTerms },
      ipAddress: (req.ip || '') as string
    });
    res.json(updated);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    if (err.message.startsWith('AUTHORITY_REQUIRED')) {
      return res.status(403).json({ error: err.message });
    }
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 8. COMMISSIONS & DEALS
// ==========================================

agentRouter.get('/commissions', async (req, res) => {
  
  try {
    const comms = await agentRepository.getCommissions(req.user!.id);
    res.json(comms);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(500).json({ error: err.message });
  }
});

agentRouter.post('/commissions/calculate', async (req, res) => {
  
  const { propertyId, dealAmount, transactionId, contractId, currency, notes } = req.body;
  if (!propertyId || !dealAmount || Number(dealAmount) <= 0) {
    return res.status(400).json({ error: 'propertyId and positive dealAmount are required.' });
  }

  try {
    const comm = await agentRepository.calculateDealCommission(req.user!.id, {
      propertyId,
      dealAmount: Number(dealAmount),
      transactionId,
      contractId,
      currency,
      notes,
    });
    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] as string,
      action: 'CALCULATE_DEAL_COMMISSION',
      resourceType: 'AgentCommission',
      resourceId: comm.id,
      changes: { propertyId, dealAmount, agentShare: comm.agentShareAmount },
      ipAddress: (req.ip || '') as string
    });
    res.status(201).json(comm);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 9. TASKS & CALENDAR
// ==========================================

agentRouter.get('/tasks', async (req, res) => {
  
  try {
    const tasks = await agentRepository.getTasks(req.user!.id);
    res.json(tasks);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(500).json({ error: err.message });
  }
});

agentRouter.post('/tasks', async (req, res) => {
  
  const { title, description, priority, dueDate, category, linkedLeadId, linkedPropertyId } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'title is required.' });
  }

  try {
    const created = await agentRepository.createTask(req.user!.id, {
      title,
      description,
      priority,
      dueDate,
      category,
      linkedLeadId,
      linkedPropertyId,
    });
    res.status(201).json(created);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(400).json({ error: err.message });
  }
});

agentRouter.patch('/tasks/:id', async (req, res) => {
  
  try {
    const updated = await agentRepository.updateTask(req.user!.id, req.params.id, req.body);
    res.json(updated);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(400).json({ error: err.message });
  }
});

agentRouter.get('/calendar', async (req, res) => {
  
  try {
    const events = await agentRepository.getCalendarEvents(req.user!.id);
    res.json(events);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(500).json({ error: err.message });
  }
});

agentRouter.post('/calendar', async (req, res) => {
  
  const { title, eventType, startTime, endTime, location, meetingLink, linkedLeadId, linkedPropertyId, notes } = req.body;
  if (!title || !eventType || !startTime || !endTime) {
    return res.status(400).json({ error: 'title, eventType, startTime, and endTime are required.' });
  }

  try {
    const created = await agentRepository.createCalendarEvent(req.user!.id, {
      title,
      eventType,
      startTime,
      endTime,
      location,
      meetingLink,
      linkedLeadId,
      linkedPropertyId,
      notes,
    });
    res.status(201).json(created);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 10. AI ASSISTANT CO-PILOT
// ==========================================

agentRouter.post('/ai/assist', async (req, res) => {
  const { query, leadId, propertyId } = req.body;
  if (!query) {
    return res.status(400).json({ error: 'query is required.' });
  }

  try {
    const result = await agentService.processAiQuery(req.user!.id, query, { leadId, propertyId });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 11. MARKET INSIGHTS
// ==========================================

agentRouter.get('/market-insights', async (req, res) => {
  
  try {
    const insights = await agentRepository.getMarketInsights((req.query.city as string) || 'Erbil');
    res.json(insights);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 12. ASSIGNED PORTFOLIO & NON-OWNERSHIP
// ==========================================

agentRouter.get('/portfolio', async (req, res) => {
  try {
    const properties = await agentRepository.getAssignedProperties(req.user!.id);
    res.json(properties);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(500).json({ error: err.message });
  }
});

agentRouter.get('/properties', async (req, res) => {
  try {
    const properties = await agentRepository.getAssignedProperties(req.user!.id);
    res.json(properties);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 13. RENTAL OPERATIONS & COORDINATION
// ==========================================

agentRouter.get('/rentals', async (req, res) => {
  try {
    const rentals = await agentRepository.getAssignedRentals(req.user!.id);
    res.json(rentals);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 14. DOCUMENTS & AGREEMENTS ACCESS
// ==========================================

agentRouter.get('/documents', async (req, res) => {
  try {
    const docs = await agentRepository.getAssignedDocuments(req.user!.id);
    res.json(docs);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 15. PERFORMANCE ANALYTICS
// ==========================================

agentRouter.get('/analytics', async (req, res) => {
  try {
    const analytics = await agentRepository.getPerformanceAnalytics(req.user!.id);
    res.json(analytics);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 16. LISTING STATUS MANAGEMENT
// ==========================================

agentRouter.post('/listings/:id/status', async (req, res) => {
  const { status } = req.body;
  if (!status) {
    return res.status(400).json({ error: 'status is required.' });
  }

  try {
    const updated = await agentRepository.updateListingStatus(req.user!.id, req.params.id, status);
    res.json(updated);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    if (err.message.startsWith('AUTHORITY_REQUIRED')) {
      return res.status(403).json({ error: err.message });
    }
    if (err.message === 'LISTING_NOT_FOUND') {
      return res.status(404).json({ error: err.message });
    }
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 17. TRANSACTION DETAILS & FOLLOW-UP
// ==========================================

agentRouter.get('/transactions/:id', async (req, res) => {
  try {
    const tx = await agentRepository.getTransactionById(req.user!.id, req.params.id);
    res.json(tx);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    if (err.message.startsWith('AUTHORITY_REQUIRED')) {
      return res.status(403).json({ error: err.message });
    }
    res.status(404).json({ error: err.message });
  }
});

agentRouter.post('/transactions/:id/follow-up', async (req, res) => {
  const { note } = req.body;
  if (!note) {
    return res.status(400).json({ error: 'note is required.' });
  }

  try {
    const task = await agentRepository.addTransactionFollowUp(req.user!.id, req.params.id, note);
    res.status(201).json(task);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    if (err.message.startsWith('AUTHORITY_REQUIRED')) {
      return res.status(403).json({ error: err.message });
    }
    res.status(400).json({ error: err.message });
  }
});

import { utilityBillRepository } from '../repositories/utility-bills.js';
import { db } from '../../db/index.js';
import { utilityBills } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

// ==========================================
// 18. UTILITY BILLS (CASH COLLECTION)
// ==========================================

agentRouter.post('/utility-bills/:id/collect-cash', async (req, res) => {
  try {
    const { amount, payerId } = req.body;
    if (!amount || amount <= 0 || !payerId) {
      return res.status(400).json({ error: 'Valid amount and payerId are required' });
    }
    
    // 1. Get the bill
    const [bill] = await db.select().from(utilityBills).where(eq(utilityBills.id, req.params.id)).limit(1);
    if (!bill) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    // 2. Verify agent authorization
    const assignedPropertyIds = await agentRepository.getAssignedPropertyIds(req.user!.id);
    if (!assignedPropertyIds.includes(bill.propertyId)) {
      return res.status(403).json({ error: 'AUTHORITY_REQUIRED: Not authorized to collect cash for this property.' });
    }

    const result = await utilityBillRepository.payBill(req.params.id, Number(amount), 'CASH', payerId, req.user!.id);
    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
