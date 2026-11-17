import React, { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import StormMap from '../components/StormMap';
import Button from '../components/ui/Button';
import Card, { Badge, type BadgeVariant } from '../components/ui/Card';
import { RefreshCw } from 'lucide-react';

/** Severity → Badge variant (uses the design-system severity colors). */
const SEVERITY_VARIANT: Record<string, BadgeVariant> = {
  Extreme: 'extreme',
  Severe: 'severe',
  Moderate: 'moderate',
  Minor: 'minor',
  Unknown: 'info',
};

/** Severity → Tailwind border-l color for storm list items */
const SEVERITY_BORDER: Record<string, string> = {
  Extreme: 'border-l-4 border-severity-extreme',
  Severe: 'border-l-4 border-severity-severe',
  Moderate: 'border-l-4 border-severity-moderate',
  Minor: 'border-l-4 border-severity-minor',
  Unknown: 'border-l-4 border-text-tertiary',
};

/** Severity → Tailwind dot color class. */
const SEVERITY_DOT: Record<string, string> = {
  Extreme: 'bg-severity-extreme',
  Severe: 'bg-severity-severe',
  Moderate: 'bg-severity-moderate',
  Minor: 'bg-severity-minor',
  Unknown: 'bg-text-tertiary',
};

/** Compact legend used in the header for at-a-glance severity reading. */
const SEVERITY_LEGEND = [
  { severity: 'Extreme', dot: 'bg-severity-extreme', label: 'Extreme' },
  { severity: 'Severe', dot: 'bg-severity-severe', label: 'Severe' },
  { severity: 'Moderate', dot: 'bg-severity-moderate', label: 'Moderate' },
  { severity: 'Minor', dot: 'bg-severity-minor', label: 'Minor' },
];

const StormTracking: React.FC = () => {
  const [selectedLocation, setSelectedLocation] = useState<{
    lat: number;
    lon: number;
    forecast?: Record<string, unknown>;
  } | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['storm-events'],
    queryFn: () => api.get('/storms/active').then((res) => res.data),
    refetchInterval: 60000,
  });

  const storms = data?.storms || [];

  // Fetch weather details when a location is selected on the map
  const { data: weatherData } = useQuery({
    queryKey: ['weather', selectedLocation?.lat, selectedLocation?.lon],
    queryFn: () =>
      api
        .get(`/weather/severe?lat=${selectedLocation!.lat}&lon=${selectedLocation!.lon}`)
        .then((res) => res.data),
    enabled: Boolean(selectedLocation),
  });

  // Update selectedLocation with forecast data when weatherData changes
  const updatedLocation = weatherData
    ? { ...selectedLocation!, forecast: weatherData }
    : selectedLocation;

  const handleMapClick = useCallback((lat: number, lon: number) => {
    setSelectedLocation({ lat, lon });
  }, []);

  const handleStormClick = useCallback(
    (storm: any) => {
      const coords = storm.geometry?.coordinates;
      const lat = coords?.[0]?.lat || coords?.[0]?.[1];
      const lon = coords?.[0]?.lon || coords?.[0]?.[0];
      if (lat != null && lon != null) {
        handleMapClick(lat, lon);
      }
    },
    [handleMapClick]
  );

  return (
    <div className="h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Storm Tracking</h1>
          <p className="text-text-tertiary">Live storm monitoring and impact analysis.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Severity legend (desktop) */}
          <div
            className="flex flex-wrap items-center gap-2 text-xs text-text-secondary"
            aria-label="Severity legend"
          >
            {SEVERITY_LEGEND.map((item) => (
              <div key={item.severity} className="flex items-center gap-1.5">
                <span
                  className={`block h-2.5 w-2.5 shrink-0 rounded-full ${item.dot}`}
                  aria-hidden="true"
                />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
          <Button
            variant="secondary"
            size="md"
            leftIcon={<RefreshCw size={16} />}
            onClick={() => refetch()}
            className="min-h-11 min-w-11"
          >
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid h-[calc(100vh-8rem)] grid-cols-1 gap-4 lg:grid-cols-4">
        {/* Storm List Sidebar */}
        <div className="lg:col-span-1 overflow-y-auto">
          <Card
            title="Active Storms"
            subtitle={`${storms.length} active alert${storms.length !== 1 ? 's' : ''}`}
          >
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 animate-pulse rounded-lg bg-border" />
                ))}
              </div>
            ) : storms.length === 0 ? (
              <p className="text-sm text-text-tertiary">No active storm alerts at this time.</p>
            ) : (
              <div className="space-y-3">
                {storms.map((storm: any) => {
                  const severity = storm.severity || 'Unknown';
                  const variant = SEVERITY_VARIANT[severity] ?? SEVERITY_VARIANT.Unknown;
                  const dotClass = SEVERITY_DOT[severity] ?? SEVERITY_DOT.Unknown;
                  const borderClass =
                    SEVERITY_BORDER[severity] ?? 'border-l-4 border-text-tertiary';
                  return (
                    <button
                      key={storm.id}
                      type="button"
                      className={`
                        relative flex min-h-11 cursor-pointer flex-col rounded-lg border-l-4
                        border-border bg-[hsl(var(--background-card))] p-3 text-left
                        transition-colors hover:bg-[hsl(var(--background-accent))]
                        focus:outline-none focus:ring-2 focus:ring-primary
                        focus:ring-offset-2 focus:ring-offset-background
                        ${borderClass}
                        ${
                          storm.isActive
                            ? 'bg-[hsl(var(--background-card))]/50'
                            : 'opacity-60'
                        }
                      `}
                      onClick={() => handleStormClick(storm)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClass}`}
                            aria-hidden="true"
                          />
                          <Badge variant={variant} size="sm">
                            {severity}
                          </Badge>
                        </div>
                        <span
                          className={`text-xs font-medium ${
                            storm.isActive ? 'text-emerald' : 'text-text-tertiary'
                          }`}
                        >
                          {storm.isActive ? 'Active' : 'Expired'}
                        </span>
                      </div>
                      <h4 className="mt-1 font-medium text-text-primary">
                        {storm.headline || storm.type}
                      </h4>
                      {storm.area && (
                        <p className="mt-1 text-xs text-text-tertiary">{storm.area}</p>
                      )}
                      {storm.description && (
                        <p className="mt-1 text-xs text-text-secondary line-clamp-2">
                          {storm.description}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Map */}
        <div className="lg:col-span-3 h-full">
          <StormMap
            storms={storms}
            onMapClick={handleMapClick}
            selectedLocation={updatedLocation}
          />
        </div>
      </div>

      {/* Weather Details Panel */}
      {selectedLocation && weatherData && (
        <div className="fixed bottom-4 right-4 z-50 w-full max-w-xs sm:max-w-sm">
          <Card
            title="Weather Details"
            subtitle={
              weatherData.location?.city ||
              `${selectedLocation.lat.toFixed(4)}, ${selectedLocation.lon.toFixed(4)}`
            }
          >
            <div className="space-y-2 text-sm">
              {weatherData.hasAlerts && (
                <div className="flex items-center gap-2 text-destructive">
                  <Badge variant="danger" size="sm">
                    {weatherData.alertCount} Active Alert{weatherData.alertCount !== 1 ? 's' : ''}
                  </Badge>
                </div>
              )}
              {weatherData.forecast?.periods && (
                <div className="text-xs text-text-secondary">
                  {weatherData.forecast.periods[0]?.shortForecast ||
                    'No forecast available'}
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default StormTracking;
