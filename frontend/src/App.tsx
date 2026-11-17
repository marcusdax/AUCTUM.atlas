/**
 * RoofPro CRM — Main Application
 * Transforms Atlas Helios storm intelligence UI into a modern roofing CRM
 * Preserves storm tracking map functionality from Atlas Helios
 */
import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import Layout from './components/Layout';

// Public pages — auth
const LoginPage = lazy(() => import('./pages/Login'));
const RegisterPage = lazy(() => import('./pages/Register'));

// Protected pages — dashboard
const Dashboard = lazy(() => import('./pages/Dashboard'));

// Protected pages — leads
const LeadsPage = lazy(() => import('./pages/Leads'));
const LeadForm = lazy(() => import('./pages/LeadForm'));
const LeadDetail = lazy(() => import('./pages/leads/LeadDetail'));

// Protected pages — jobs
const JobsPage = lazy(() => import('./pages/Jobs'));
const JobForm = lazy(() => import('./pages/jobs/JobForm'));
const JobDetail = lazy(() => import('./pages/JobDetail'));
const JobFeedComponent = lazy(() => import('./pages/JobFeed'));
const JobDocumentsPage = lazy(() => import('./pages/jobs/JobDocuments'));

// Protected pages — estimates
const EstimateBuilder = lazy(() => import('./pages/estimates/EstimateBuilder'));

// Protected pages — storm tracking
const StormTrackingPage = lazy(() => import('./pages/StormTracking'));

// Protected pages — intelligence (Atlas Helios)
const CommandCenterPage = lazy(() => import('./pages/intelligence/CommandCenter'));
const AtlasIntelligencePage = lazy(() => import('./pages/intelligence/AtlasIntelligence'));
const HeliosIntelligencePage = lazy(() => import('./pages/intelligence/HeliosIntelligence'));
const IntelligencePage = lazy(() => import('./pages/intelligence/Intelligence'));
const SystemIntelligencePage = lazy(() => import('./pages/intelligence/SystemIntelligence'));

// Protected pages — calendar, documents, reporting
const CalendarPage = lazy(() => import('./pages/Calendar'));
const DocumentsPage = lazy(() => import('./pages/Documents'));
const ReportingPage = lazy(() => import('./pages/Reporting'));

// Protected pages — settings
const SettingsPage = lazy(() => import('./pages/Settings'));
const IntegrationsSettings = lazy(() => import('./pages/settings/IntegrationsSettings'));
const CompanySettings = lazy(() => import('./pages/settings/CompanySettings'));
const UsersManagement = lazy(() => import('./pages/settings/UsersManagement'));

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore();
  if (isLoading) return <div className="flex h-screen items-center justify-center">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function App() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <div className="text-center">
            <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            <p>Loading RoofPro CRM…</p>
          </div>
        </div>
      }
    >
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected routes */}
        <Route
          path="/*"
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="dashboard" element={<Dashboard />} />

          {/* Lead Management */}
          <Route path="leads">
            <Route index element={<LeadsPage />} />
            <Route path="new" element={<LeadForm />} />
            <Route path=":id" element={<LeadDetail />} />
            <Route path=":id/edit" element={<LeadForm />} />
          </Route>

          {/* Job Management */}
          <Route path="jobs">
            <Route index element={<JobsPage />} />
            <Route path="new" element={<JobForm />} />
            <Route path=":id" element={<JobDetail />} />
            <Route path=":id/edit" element={<JobForm />} />
            <Route path=":id/feed/*" element={<JobFeedRoute />} />
          </Route>

          {/* Estimating */}
          <Route path="estimates">
            <Route index element={<EstimateBuilder />} />
            <Route path=":jobId/new" element={<EstimateBuilder />} />
            <Route path=":id" element={<EstimateBuilder />} />
          </Route>

          {/* Calendar */}
          <Route path="calendar" element={<CalendarPage />} />

          {/* Intelligence Command Center (Atlas Helios) */}
          <Route path="command" element={<CommandCenterPage />} />
          <Route path="intelligence/atlas" element={<AtlasIntelligencePage />} />
          <Route path="intelligence/helios" element={<HeliosIntelligencePage />} />
          <Route path="intelligence" element={<IntelligencePage />} />
          <Route path="intelligence/system" element={<SystemIntelligencePage />} />

          {/* Storm Tracking (preserved from Atlas Helios) */}
          <Route path="storm-tracking" element={<StormTrackingPage />} />

          {/* Documents */}
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="documents/jobs/:jobId" element={<JobDocumentsPage />} />

          {/* Reporting */}
          <Route path="reports" element={<ReportingPage />} />

          {/* Settings */}
          <Route path="settings/*" element={<SettingsPage />}>
            <Route index element={<Navigate to="/settings/company" replace />} />
            <Route path="company" element={<CompanySettings />} />
            <Route path="users" element={<UsersManagement />} />
            <Route path="integrations" element={<IntegrationsSettings />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

function JobFeedRoute() {
  const { id: jobId } = useParams<{ id: string }>();
  return <JobFeedComponent jobId={jobId || ''} />;
}

export default App;
