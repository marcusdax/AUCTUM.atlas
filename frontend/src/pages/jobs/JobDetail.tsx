import React from 'react';
import { useParams, useNavigate, Link, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { Badge, StatusDot } from '../../components/ui/Card';
import { Job } from '../../types';
import {
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  DollarSign,
  Edit,
  FileText,
  Clipboard,
  BarChart3,
  ArrowLeft,
} from 'lucide-react';

const JobDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ['job', id],
    queryFn: () => api.get(`/jobs/${id}`).then((res) => res.data),
    enabled: Boolean(id),
  });

  const job: Job | undefined = data?.job || data;

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p>Loading job…</p>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="text-center py-12">
        <p className="text-text-tertiary">Job not found.</p>
        <Button variant="ghost" size="sm" onClick={() => navigate('/jobs')} className="mt-4">
          <ArrowLeft size={16} />
          Back to Jobs
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/jobs')}>
            <ArrowLeft size={16} />
            Back to Jobs
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-text-primary">{job.name}</h1>
            <p className="text-text-tertiary">{job.propertyAddress}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" size="sm" leftIcon={<Edit size={14} />}>
            <Link to={`/jobs/${job.id}/edit`}>Edit Job</Link>
          </Button>
          <Button leftIcon={<FileText size={14} />} onClick={() => navigate(`/jobs/${job.id}/feed`)}>
            View Feed
          </Button>
        </div>
      </div>

      <div className="mb-6 flex gap-2 overflow-x-auto">
        <Link to={`/jobs/${job.id}/feed`}>
          <Button variant="ghost" size="sm">Job Feed</Button>
        </Link>
        <Link to={`/jobs/${job.id}/documents`}>
          <Button variant="ghost" size="sm">Documents</Button>
        </Link>
        <Link to={`/estimates/${job.id}/new`}>
          <Button variant="ghost" size="sm">Estimates</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card title="Job Information">
            <p className="text-sm text-text-secondary whitespace-pre-wrap">{job.description || 'No description provided.'}</p>
          </Card>

          <Card title="Financial Summary">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-text-primary">${job.budget?.toLocaleString() || '0'}</p>
                <p className="text-xs text-text-tertiary">Budget</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-emerald">${job.estimatedCost?.toLocaleString() || '0'}</p>
                <p className="text-xs text-text-tertiary">Estimated Cost</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red">${job.actualCost?.toLocaleString() || '0'}</p>
                <p className="text-xs text-text-tertiary">Actual Cost</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">${job.grossProfit?.toLocaleString() || '0'}</p>
                <p className="text-xs text-text-tertiary">Gross Profit</p>
              </div>
            </div>
          </Card>

          <Card title="Assigned Team">
            {job.assignedUsers && job.assignedUsers.length > 0 ? (
              <div className="space-y-2">
                {job.assignedUsers.map((assignee) => (
                  <div key={assignee.id} className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white font-bold text-sm">
                      {assignee.user?.firstName?.[0]}{assignee.user?.lastName?.[0]}
                    </div>
                    <div>
                      <p className="font-medium text-text-primary">
                        {assignee.user?.firstName} {assignee.user?.lastName}
                      </p>
                      <p className="text-sm text-text-tertiary">{assignee.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-text-tertiary">No team members assigned.</p>
            )}
          </Card>

          <Card title="Recent Activity">
            {job.feedPosts && job.feedPosts.length > 0 ? (
              <div className="space-y-3">
                {job.feedPosts.slice(0, 5).map((post) => (
                  <div key={post.id} className="text-sm">
                    <span className="font-medium text-text-primary">{post.user?.firstName} {post.user?.lastName}:</span>
                    <span className="text-text-secondary"> {post.content || 'New activity'}</span>
                    <span className="text-xs text-text-tertiary ml-2">
                      {new Date(post.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-text-tertiary">No recent activity.</p>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Status Overview">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-tertiary">Status</span>
                <div className="flex items-center gap-2">
                  <StatusDot status={job.status} />
                  <Badge variant={job.status === 'COMPLETED' ? 'success' : job.status === 'CANCELLED' ? 'danger' : 'warning'}>
                    {job.status}
                  </Badge>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-text-tertiary">Phase</span>
                <Badge variant="info">{job.phase.replace(/_/g, ' ')}</Badge>
              </div>

              {job.startDate && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-tertiary">Start Date</span>
                  <span className="text-sm font-medium text-text-primary">
                    {new Date(job.startDate).toLocaleDateString()}
                  </span>
                </div>
              )}

              {job.endDate && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-tertiary">End Date</span>
                  <span className="text-sm font-medium text-text-primary">
                    {new Date(job.endDate).toLocaleDateString()}
                  </span>
                </div>
              )}

              {job.lead && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-tertiary">Lead</span>
                  <Link to={`/leads/${job.lead.id}`}>
                    <span className="text-sm font-medium text-primary hover:underline">
                      {job.lead.firstName} {job.lead.lastName}
                    </span>
                  </Link>
                </div>
              )}
            </div>
          </Card>

          <Card title="Estimates">
            {job.estimates && job.estimates.length > 0 ? (
              <div className="space-y-2">
                {job.estimates.map((estimate) => (
                  <Link key={estimate.id} to={`/estimates/${estimate.id}`}>
                    <div className="block">
                      <p className="font-medium text-text-primary hover:text-primary">{estimate.name}</p>
                      <p className="text-sm text-text-tertiary">${estimate.totalPrice.toLocaleString()}</p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-text-tertiary mb-2">No estimates yet</p>
                <Link to={`/estimates/${job.id}/new`}>
                  <Button variant="ghost" size="sm">Create Estimate</Button>
                </Link>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default JobDetail;
