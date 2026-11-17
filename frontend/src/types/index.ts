export interface User {
  id: string;
  companyId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'OWNER' | 'MANAGER' | 'SALES_REP' | 'PROJECT_MANAGER' | 'FIELD_CREW' | 'OFFICE_ADMIN';
  phone?: string;
  avatarUrl?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  company?: Company;
}

export interface Company {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  logoUrl?: string;
  subscriptionTier: 'Starter' | 'Professional' | 'Enterprise';
  settings?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Lead {
  id: string;
  companyId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  propertyAddress: string;
  propertyLatLng?: { lat: number; lng: number };
  source: 'WEBSITE' | 'PHONE' | 'REFERRAL' | 'STORM_EVENT' | 'MANUAL' | 'IMPORT' | 'MARKETING_QR';
  status: 'NEW' | 'CONTACTED' | 'INSPECTION_SCHEDULED' | 'ESTIMATE_SENT' | 'WON' | 'LOST';
  assignedToUserId?: string;
  stormEventId?: string;
  score?: number;
  notes?: string;
  jobId?: string;
  createdAt: string;
  updatedAt: string;
  assignedTo?: User;
  stormEvent?: StormEvent;
  job?: Job;
}

export interface Job {
  id: string;
  companyId: string;
  leadId?: string;
  name: string;
  description?: string;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'ON_HOLD';
  phase: 'INSPECTION' | 'ESTIMATE' | 'PRODUCTION' | 'INVOICING' | 'COMPLETED';
  propertyAddress: string;
  propertyLatLng?: { lat: number; lng: number };
  startDate?: string;
  endDate?: string;
  grossProfit?: number;
  budget?: number;
  actualCost?: number;
  estimatedCost?: number;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  lead?: Lead;
  createdBy?: User;
  company?: Company;
  assignedUsers?: JobAssignee[];
  estimates?: Estimate[];
  calendarEvents?: CalendarEvent[];
  feedPosts?: FeedPost[];
  documents?: Document[];
  materialOrders?: MaterialOrder[];
  changeOrders?: ChangeOrder[];
}

export interface JobAssignee {
  id: string;
  jobId: string;
  userId: string;
  role: string;
  user?: User;
}

export interface Estimate {
  id: string;
  companyId: string;
  jobId: string;
  name: string;
  totalCost: number;
  totalPrice: number;
  status: 'DRAFT' | 'SENT' | 'APPROVED' | 'REJECTED';
  pdfUrl?: string;
  sentAt?: string;
  approvedAt?: string;
  notes?: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  items?: EstimateItem[];
  changeOrders?: ChangeOrder[];
  job?: Job;
  createdBy?: User;
}

export interface EstimateItem {
  id: string;
  estimateId: string;
  description: string;
  quantity: number;
  unit: string;
  unitCost: number;
  unitPrice: number;
  category?: string;
  sortOrder: number;
  createdAt: string;
}

export interface EstimateSummary {
  id: string;
  companyId: string;
  jobId: string;
  name: string;
  totalCost: number;
  totalPrice: number;
  status: 'DRAFT' | 'SENT' | 'APPROVED' | 'REJECTED';
  pdfUrl?: string;
  createdAt: string;
  updatedAt: string;
  job?: Pick<Job, 'id' | 'name' | 'propertyAddress' | 'phase' | 'status'>;
}

export interface EstimateWithItems {
  id: string;
  companyId: string;
  jobId: string;
  name: string;
  totalCost: number;
  totalPrice: number;
  status: 'DRAFT' | 'SENT' | 'APPROVED' | 'REJECTED';
  pdfUrl?: string;
  notes?: string;
  sentAt?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
  items: EstimateItem[];
  job?: Job;
  createdBy?: User;
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
}

export interface ListResponse<T> {
  data: T[];
  count: number;
}

export interface ChangeOrder {
  id: string;
  companyId: string;
  jobId: string;
  estimateId?: string;
  description: string;
  amount: number;
  status: string;
  approvedById?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEvent {
  id: string;
  companyId: string;
  jobId?: string;
  title: string;
  description?: string;
  eventType: 'INSPECTION' | 'PRODUCTION' | 'ESTIMATE' | 'MEETING' | 'OTHER';
  startTime: string;
  endTime: string;
  allDay: boolean;
  location?: string;
  propertyLatLng?: { lat: number; lng: number };
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  assignees?: CalendarEventAssignee[];
  job?: Job;
  createdBy?: User;
}

export interface CalendarEventAssignee {
  id: string;
  eventId: string;
  userId: string;
  user?: User;
}

export interface FeedPost {
  id: string;
  jobId: string;
  userId?: string | null;
  companyId: string;
  content?: string;
  parentPostId?: string | null;
  isSystem?: boolean;
  data?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  user?: User;
  parent?: FeedPost;
  replies?: FeedPost[];
  attachments?: FeedAttachment[];
  mentions?: FeedMention[];
}

export interface FeedAttachment {
  id: string;
  postId?: string | null;
  userId: string;
  companyId: string;
  fileUrl: string;
  fileType: 'IMAGE' | 'DOCUMENT' | 'VIDEO';
  fileName: string;
  size: number;
  createdAt: string;
  user?: User;
}

export interface FeedMention {
  id: string;
  postId: string;
  userId: string;
  createdAt: string;
  user?: User;
}

export interface Document {
  id: string;
  companyId: string;
  jobId?: string;
  name: string;
  fileUrl: string;
  fileType: 'CONTRACT' | 'PERMIT' | 'INVOICE' | 'PHOTO' | 'ESTIMATE_PDF' | 'OTHER';
  size?: number;
  metadata?: Record<string, unknown>;
  uploadedByUserId: string;
  createdAt: string;
  uploadedBy?: User;
  job?: Job;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'JOB_UPDATE' | 'ESTIMATE_APPROVED' | 'ESTIMATE_REJECTED' | 'FEED_MENTION' | 'FEED_REPLY' | 'SCHEDULE_CHANGE' | 'STORM_ALERT' | 'MATERIAL_ORDER' | 'CHANGE_ORDER' | 'GENERAL';
  title: string;
  body?: string;
  isRead: boolean;
  data?: Record<string, unknown>;
  createdAt: string;
}

export interface StormEvent {
  id: string;
  companyId: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  severity: 'MINOR' | 'MODERATE' | 'SEVERE' | 'EXTREME';
  eventType: 'TORNADO' | 'HURRICANE' | 'SEVERE_THUNDERSTORM' | 'FLASH_FLOOD' | 'WINTER_STORM' | 'WILDFIRE';
  affectedArea?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Subcontractor {
  id: string;
  companyId: string;
  name: string;
  phone?: string;
  email?: string;
  companyName?: string;
  licenseNumber?: string;
  insuranceInfo?: Record<string, unknown>;
  specialties: string[];
  rating?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MaterialOrder {
  id: string;
  companyId: string;
  jobId: string;
  supplierName: string;
  status: 'PENDING' | 'ORDERED' | 'DELIVERED' | 'BACKORDERED' | 'CANCELLED';
  totalCost?: number;
  orderedAt?: string;
  deliveredAt?: string;
  trackingNumber?: string;
  notes?: string;
  orderedByUserId?: string;
  createdAt: string;
  updatedAt: string;
  items?: MaterialOrderItem[];
}

export interface MaterialOrderItem {
  id: string;
  materialOrderId: string;
  name: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
}

export interface PriceDatabaseEntry {
  id: string;
  companyId: string;
  category: string;
  name: string;
  unit: string;
  defaultCost?: number;
  defaultPrice?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WeatherAlert {
  id: string;
  type: string;
  severity: string;
  urgency: string;
  certainty: string;
  effective: string;
  expires: string;
  headline: string;
  description: string;
  instruction: string;
  area: string;
  geometry: unknown;
  sender: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  companyName: string;
  phone?: string;
}

export interface LoginData {
  email: string;
  password: string;
}

// ─── Report Types ───────────────────────────────────────────

export type LeadStatus = 'NEW' | 'CONTACTED' | 'INSPECTION_SCHEDULED' | 'ESTIMATE_SENT' | 'WON' | 'LOST';

export interface LeadsByStatus {
  NEW: number;
  CONTACTED: number;
  INSPECTION_SCHEDULED: number;
  ESTIMATE_SENT: number;
  WON: number;
  LOST: number;
}

export interface PipelineReport {
  startDate: string;
  endDate: string;
  totalLeads: number;
  leadsByStatus: LeadsByStatus;
  conversionRate: number;
  won: number;
  lost: number;
  totalDealValue: number;
  approvedEstimateCount: number;
}

export interface JobProfitabilityItem {
  id: string;
  name: string;
  leadName: string;
  status: string;
  phase: string;
  startDate: string | null;
  endDate: string | null;
  budget: number;
  cost: number;
  revenue: number;
  margin: number;
  leadStatus: LeadStatus | null;
}

export interface ProfitabilitySummary {
  totalJobs: number;
  totalBudget: number;
  totalCost: number;
  totalRevenue: number;
  totalMargin: number;
}

export interface ProfitabilityReport {
  startDate: string;
  endDate: string;
  summary: ProfitabilitySummary;
  jobs: JobProfitabilityItem[];
}

export interface PhaseTiming {
  phase: string;
  avgHours: number;
  scheduledEvents: number;
}

export interface CrewProductivityItem {
  id: string;
  name: string;
  role: string;
  jobsAssigned: number;
}

export interface ProductionEfficiencyReport {
  startDate: string;
  endDate: string;
  completedJobsCount: number;
  totalJobs: number;
  avgCycleTimeDays: number;
  phaseDistribution: Record<string, number>;
  avgTimePerPhase: PhaseTiming[];
  crewProductivity: CrewProductivityItem[];
}

export type IntegrationType =
  | 'QUICKBOOKS'
  | 'GOOGLE_CALENDAR'
  | 'OUTLOOK_CALENDAR'
  | 'HOVER'
  | 'EAGLEVIEW'
  | 'ABC_SUPPLY'
  | 'WEBHOOK';

export type IntegrationStatus = 'ACTIVE' | 'PENDING' | 'ERROR' | 'DISCONNECTED';

export interface Integration {
  id: string;
  companyId: string;
  type: IntegrationType;
  credentials?: Record<string, unknown>;
  status: IntegrationStatus;
  lastSyncedAt?: string;
  settings?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
