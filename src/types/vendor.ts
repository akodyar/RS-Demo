import { BaseEntity } from './index.js';

export enum VendorStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
}

export enum VendorVerificationStatus {
  PENDING = 'PENDING',
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum ServiceCategoryType {
  HVAC = 'HVAC',
  PLUMBING = 'PLUMBING',
  ELECTRICAL = 'ELECTRICAL',
  PAINTING = 'PAINTING',
  CLEANING = 'CLEANING',
  CARPENTRY = 'CARPENTRY',
  APPLIANCE_REPAIR = 'APPLIANCE_REPAIR',
  GENERAL_MAINTENANCE = 'GENERAL_MAINTENANCE',
  ROOFING = 'ROOFING',
  LANDSCAPING = 'LANDSCAPING',
  SECURITY_SYSTEMS = 'SECURITY_SYSTEMS',
  ELEVATORS = 'ELEVATORS',
  GENERATORS = 'GENERATORS',
  PEST_CONTROL = 'PEST_CONTROL',
  INSPECTION = 'INSPECTION',
  OTHER = 'OTHER',
}

export enum WorkOrderStatus {
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum VendorQuoteStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  REVISED = 'REVISED',
}

export enum VendorInvoiceStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED',
  PAYABLE = 'PAYABLE',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

export enum VendorTaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum VendorTaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum VendorEventType {
  JOB_APPOINTMENT = 'JOB_APPOINTMENT',
  INSPECTION = 'INSPECTION',
  CLIENT_MEETING = 'CLIENT_MEETING',
  ESTIMATE_VISIT = 'ESTIMATE_VISIT',
  BLOCKED_TIME = 'BLOCKED_TIME',
}

export interface VendorProfile {
  id: string;
  userId: string;
  organizationId?: string;
  businessName: string;
  legalName?: string;
  bio?: string;
  categories: string[];
  specialties?: string[];
  serviceAreas: string[];
  phone?: string;
  email?: string;
  workingHours?: {
    start: string;
    end: string;
    days: string[];
  };
  emergencyAvailable: boolean;
  status: VendorStatus;
  verificationStatus: VendorVerificationStatus;
  rating: number;
  reviewCount: number;
  hourlyRate?: number;
  currency: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface VendorLicense {
  id: string;
  vendorId: string;
  userId: string;
  licenseType: string;
  licenseNumber: string;
  issuingAuthority: string;
  issueDate?: string;
  expiryDate?: string;
  documentUrl?: string;
  status: 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  verifiedBy?: string;
  verifiedAt?: string;
  notes?: string;
  createdAt?: string;
}

export interface VendorQuoteLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface VendorQuote {
  id: string;
  maintenanceRequestId: string;
  vendorId?: string;
  vendorUserId?: string;
  propertyId: string;
  propertyName?: string;
  laborAmount?: number;
  materialsAmount?: number;
  feesAmount?: number;
  totalAmount: number;
  currency: string;
  estimatedDuration?: string;
  warrantyTerms?: string;
  lineItems?: VendorQuoteLineItem[];
  validUntil?: string;
  status: VendorQuoteStatus;
  revisionNumber: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface VendorWorkOrder {
  id: string;
  maintenanceRequestId: string;
  quoteId?: string;
  vendorId?: string;
  vendorUserId?: string;
  assignedTechnicianId?: string;
  propertyId: string;
  propertyName?: string;
  propertyAddress?: string;
  category?: string;
  status: WorkOrderStatus;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  scheduledStartDate?: string;
  scheduledEndDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  scopeOfWork?: string;
  materialsUsed?: { item: string; quantity: number; cost: number }[];
  completionNotes?: string;
  completionPhotos?: string[];
  rating?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface VendorInvoice {
  id: string;
  workOrderId: string;
  quoteId?: string;
  propertyId: string;
  propertyName?: string;
  vendorId?: string;
  vendorUserId?: string;
  invoiceNumber?: string;
  amount: number;
  currency: string;
  status: VendorInvoiceStatus;
  paymentReference?: string;
  dueDate?: string;
  paidAt?: string;
  lineItems?: { description: string; amount: number }[];
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface VendorTask {
  id: string;
  vendorId?: string;
  userId: string;
  title: string;
  description?: string;
  priority: VendorTaskPriority;
  status: VendorTaskStatus;
  dueDate?: string;
  linkedWorkOrderId?: string;
  linkedRequestId?: string;
  completedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface VendorEvent {
  id: string;
  vendorId?: string;
  userId: string;
  title: string;
  eventType: VendorEventType;
  startTime: string;
  endTime: string;
  location?: string;
  linkedWorkOrderId?: string;
  linkedPropertyId?: string;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED';
  notes?: string;
  createdAt?: string;
}

export interface VendorReview {
  id: string;
  vendorId: string;
  workOrderId: string;
  reviewerUserId: string;
  reviewerName: string;
  reviewerRole: string;
  rating: number;
  comment: string;
  vendorResponse?: string;
  respondedAt?: string;
  createdAt?: string;
}

export interface VendorDashboardData {
  kpi: {
    activeWorkOrders: number;
    workOrdersDelta: number;
    scheduledToday: number;
    scheduledDelta: number;
    pendingQuotes: number;
    pendingQuotesDelta: number;
    completedThisMonth: number;
    completedDelta: number;
    totalEarningsThisMonth: number;
    earningsDelta: number;
    averageRating: number;
    ratingDelta: number;
    currency: string;
  };
  jobActivity: {
    period: string;
    days: {
      day: string;
      newRequests: number;
      inProgress: number;
      completed: number;
    }[];
  };
  requestOverview: {
    totalRequests: number;
    new: number;
    assigned: number;
    inProgress: number;
    onHold: number;
    completed: number;
  };
  todaySchedule: {
    id: string;
    time: string;
    endTime?: string;
    title: string;
    propertyLocation: string;
    status: 'IN_PROGRESS' | 'SCHEDULED' | 'MEETING';
    workOrderId?: string;
  }[];
  recentRequests: {
    id: string;
    srCode: string;
    title: string;
    location: string;
    status: 'NEW' | 'ASSIGNED' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED';
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    timeAgo: string;
  }[];
  messages: {
    id: string;
    senderName: string;
    senderRole: string;
    avatarUrl?: string;
    messageSnippet: string;
    time: string;
    unread: boolean;
  }[];
  earningsOverview: {
    year: number;
    months: {
      month: string;
      amount: number;
    }[];
  };
  topCategories: {
    category: string;
    percentage: number;
    jobCount: number;
  }[];
  clientReviews: {
    averageRating: number;
    reviewCount: number;
    recentReviews: {
      id: string;
      reviewerName: string;
      rating: number;
      comment: string;
      date: string;
    }[];
  };
  workOrders: any[];
  quotes: any[];
  invoices: any[];
  tasks: any[];
}
