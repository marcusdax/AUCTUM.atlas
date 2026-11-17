import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';

// Import route modules
import authRoutes from './auth.routes';
import companyRoutes from './companies.routes';
import leadRoutes from './leads.routes';
import jobRoutes from './jobs.routes';
import estimateRoutes from './estimates.routes';
import calendarRoutes from './calendar.routes';
import feedRoutes from './feed.routes';
import documentRoutes from './documents.routes';
import notificationRoutes from './notifications.routes';
import integrationRoutes from './integrations.routes';
import stormRoutes from './storms.routes';
import weatherRoutes from './weather.routes';
import mapRoutes from './map.routes';
import materialRoutes from './materials.routes';
import subcontractorRoutes from './subcontractors.routes';
import reportRoutes from './reports.routes';

// Health check route (no auth required)
const healthRouter = Router();
healthRouter.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'RoofPro CRM API',
    version: '1.0.0',
    integrations: {
      noaa_weather: {
        connected: true,
        endpoint: process.env.NOAA_API_URL || 'https://api.weather.gov',
      },
      database: {
        connected: true,
        provider: 'PostgreSQL',
      },
    },
  });
});

// API v1 router
const v1Router = Router();

// Public routes (no auth required)
v1Router.use('/health', healthRouter);
v1Router.use('/auth', authRoutes);

// Protected routes (require auth)
v1Router.use(authMiddleware);

// API routes
v1Router.use('/companies', companyRoutes);
v1Router.use('/leads', leadRoutes);
v1Router.use('/jobs', jobRoutes);
v1Router.use('/estimates', estimateRoutes);
v1Router.use('/calendar', calendarRoutes);
v1Router.use('/feed', feedRoutes);
v1Router.use('/documents', documentRoutes);
v1Router.use('/notifications', notificationRoutes);
v1Router.use('/integrations', integrationRoutes);
v1Router.use('/storms', stormRoutes);
v1Router.use('/weather', weatherRoutes);
v1Router.use('/maps', mapRoutes);
v1Router.use('/materials', materialRoutes);
v1Router.use('/subcontractors', subcontractorRoutes);
v1Router.use('/reports', reportRoutes);

// Root endpoint
v1Router.get('/', (req, res) => {
  res.json({
    name: 'RoofPro CRM API',
    version: '1.0.0',
    description: 'Roofing contractor CRM with storm tracking',
    endpoints: {
      health: '/api/v1/health',
      auth: '/api/v1/auth',
      companies: '/api/v1/companies',
      leads: '/api/v1/leads',
      jobs: '/api/v1/jobs',
      estimates: '/api/v1/estimates',
      calendar: '/api/v1/calendar',
      feed: '/api/v1/feed',
      documents: '/api/v1/documents',
      notifications: '/api/v1/notifications',
      integrations: '/api/v1/integrations',
      storms: '/api/v1/storms',
      weather: '/api/v1/weather',
      maps: '/api/v1/maps',
      materials: '/api/v1/materials',
      subcontractors: '/api/v1/subcontractors',
      reports: '/api/v1/reports',
    },
  });
});

export default v1Router;
