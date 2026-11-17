/**
 * Command Center Page - Intelligence Command Center
 * Main operational screen for Atlas Helios storm intelligence platform
 */

import React from 'react';
import DashboardCommandCenter from '../../components/intelligence/DashboardCommandCenter';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import type { Job, Lead, StormEvent, WeatherAlert, ListResponse } from '../../types';

const CommandCenterPage: React.FC = () => {
  const jobsQuery = useQuery({
    queryKey: ['command', 'jobs'],
    queryFn: () => api.get('/jobs').then((res) => res.data as ListResponse<Job>),
    placeholderData: { data: [], count: 0 },
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  });

  const leadsQuery = useQuery({
    queryKey: ['command', 'leads'],
    queryFn: () => api.get('/leads').then((res) => res.data as ListResponse<Lead>),
    placeholderData: { data: [], count: 0 },
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  });

  const stormEventsQuery = useQuery({
    queryKey: ['command', 'storm-events'],
    queryFn: () => api.get('/storm-events').then((res) => res.data as ListResponse<StormEvent>),
    placeholderData: { data: [], count: 0 },
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: 1,
  });

  const alertsQuery = useQuery({
    queryKey: ['command', 'weather-alerts'],
    queryFn: () => api.get('/weather/alerts?limit=50').then((res) => res.data as { alerts: WeatherAlert[]; total: number }),
    placeholderData: { alerts: [], total: 0 },
    staleTime: 30_000,
    refetchInterval: 120_000,
    retry: 1,
  });

  const jobs = jobsQuery.data?.data ?? [];
  const leads = leadsQuery.data?.data ?? [];
  const stormEvents = stormEventsQuery.data?.data ?? [];
  const weatherAlerts = alertsQuery.data?.alerts ?? [];

  return (
    <div className="h-full">
      <DashboardCommandCenter
        jobs={jobs}
        leads={leads}
        stormEvents={stormEvents}
        weatherAlerts={weatherAlerts}
      />
    </div>
  );
};

export default CommandCenterPage;