import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { Badge, StatusDot } from '../../components/ui/Card';
import { Lead } from '../../types';
import {
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Edit,
  FileText,
  ArrowLeft,
} from 'lucide-react';

const LeadDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ['lead', id],
    queryFn: () => api.get(`/leads/${id}`).then((res) => res.data),
    enabled: Boolean(id),
  });

  const lead: Lead | undefined = data?.lead || data;

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p>Loading lead…</p>
        </div>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="text-center py-12">
        <p className="text-text-tertiary">Lead not found.</p>
        <Button variant="secondary" onClick={() => navigate('/leads')} className="mt-4">
          <ArrowLeft size={16} />
          Back to Leads
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/leads')}>
            <ArrowLeft size={16} />
            Back to Leads
          </Button>
          <h1 className="text-3xl font-bold text-text-primary">
            {lead.firstName} {lead.lastName}
          </h1>
        </div>
        <Button leftIcon={<Edit size={16} />} onClick={() => navigate(`/leads/${lead.id}/edit`)}>
          Edit Lead
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card title="Contact Information">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex items-center gap-3">
                <User size={20} className="text-text-tertiary" />
                <div>
                  <p className="text-sm text-text-tertiary">Full Name</p>
                  <p className="font-medium text-text-primary">{lead.firstName} {lead.lastName}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Mail size={20} className="text-text-tertiary" />
                <div>
                  <p className="text-sm text-text-tertiary">Email</p>
                  <p className="font-medium text-text-primary">{lead.email || '—'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Phone size={20} className="text-text-tertiary" />
                <div>
                  <p className="text-sm text-text-tertiary">Phone</p>
                  <p className="font-medium text-text-primary">{lead.phone || '—'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <MapPin size={20} className="text-text-tertiary" />
                <div>
                  <p className="text-sm text-text-tertiary">Property Address</p>
                  <p className="font-medium text-text-primary">{lead.propertyAddress}</p>
                </div>
              </div>
            </div>
          </Card>

          {lead.notes && (
            <Card title="Notes">
              <p className="text-text-secondary whitespace-pre-wrap">{lead.notes}</p>
            </Card>
          )}

          {lead.job && (
            <Card title="Associated Job">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-text-primary">{lead.job.name}</p>
                  <p className="text-sm text-text-tertiary">{lead.job.propertyAddress}</p>
                </div>
                <Link to={`/jobs/${lead.job.id}`}>
                  <Button variant="ghost" size="sm">
                    View Job
                  </Button>
                </Link>
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card title="Lead Details">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-tertiary">Status</span>
                <div className="flex items-center gap-2">
                  <StatusDot status={lead.status} />
                  <Badge variant="info" size="sm">{lead.status.replace(/_/g, ' ')}</Badge>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-text-tertiary">Source</span>
                <Badge variant="default" size="sm">{lead.source.replace(/_/g, ' ')}</Badge>
              </div>

              {lead.score !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-tertiary">Priority Score</span>
                  <Badge variant={lead.score >= 80 ? 'danger' : lead.score >= 50 ? 'warning' : 'default'} size="sm">
                    {lead.score}
                  </Badge>
                </div>
              )}

              {lead.assignedTo && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-tertiary">Assigned To</span>
                  <span className="text-sm font-medium text-text-primary">
                    {lead.assignedTo.firstName} {lead.assignedTo.lastName}
                  </span>
                </div>
              )}
            </div>
          </Card>

          <Card title="Quick Actions">
            <div className="space-y-2">
              <Button variant="secondary" size="sm" className="w-full" leftIcon={<FileText size={14} />}>
                Create Estimate
              </Button>
              <Button variant="secondary" size="sm" className="w-full" leftIcon={<Calendar size={14} />}>
                Schedule Inspection
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default LeadDetail;
