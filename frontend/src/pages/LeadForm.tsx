import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../services/api';
import { Lead, User } from '../types';
import Button from '../components/ui/Button';
import Card, { Badge } from '../components/ui/Card';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import L from 'leaflet';
import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
} from 'react-leaflet';
import {
  MapPin,
  X,
  Loader2,
  Save,
  Trash2,
  ChevronDown,
  AlertCircle,
} from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';

// Fix Leaflet default marker icons (required for marker rendering)
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerIconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

// --- Map click handler (renders nothing, just listens for map clicks) ---
function MapClickHandler({
  onMapClick,
}: {
  onMapClick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// --- Constants ---
const LEAD_SOURCES = [
  { value: 'WEBSITE', label: 'Website' },
  { value: 'PHONE', label: 'Phone Call' },
  { value: 'REFERRAL', label: 'Referral' },
  { value: 'STORM_EVENT', label: 'Storm Event' },
  { value: 'MANUAL', label: 'Manual Entry' },
  { value: 'IMPORT', label: 'Import' },
] as const;

// Default map center (contiguous US)
const DEFAULT_MAP_CENTER: [number, number] = [39.8283, -98.5795];

// --- Types ---
interface LeadFormValues {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  propertyAddress: string;
  propertyLatLng: { lat: number; lng: number } | null;
  source: string;
  notes: string;
  assignedToUserId: string;
}

interface LeadFormProps {
  lead?: Lead;
  mode?: 'create' | 'edit';
  onClose?: () => void;
  onSuccess?: () => void;
}

// --- Helpers ---
const inputClassName = (hasError: boolean = false) =>
  clsx(
    'w-full rounded-lg border bg-[hsl(var(--background))] px-3 py-2 text-sm text-text-primary placeholder-[hsl(var(--text-tertiary))] transition-colors focus:outline-none focus:ring-1',
    hasError
      ? 'border-red focus:border-red focus:ring-red/20'
      : 'border-border focus:border-primary focus:ring-primary/20'
  );

const textareaClassName = (hasError: boolean = false) =>
  clsx(
    'w-full rounded-lg border bg-[hsl(var(--background))] px-3 py-2 text-sm text-text-primary placeholder-[hsl(var(--text-tertiary))] transition-colors focus:outline-none focus:ring-1 resize-y min-h-[100px]',
    hasError
      ? 'border-red focus:border-red focus:ring-red/20'
      : 'border-border focus:border-primary focus:ring-primary/20'
  );

const selectWrapperClassName = (hasError: boolean = false) =>
  clsx(
    'relative w-full rounded-lg border bg-[hsl(var(--background))] px-3 py-2 text-sm focus-within:outline-none focus-within:ring-1',
    hasError
      ? 'border-red focus-within:border-red focus-within:ring-destructive/20'
      : 'border-border focus-within:border-primary focus-within:ring-primary/20'
  );

// --- Map Picker Dialog ---
function MapPickerDialog({
  open,
  onOpenChange,
  initialPosition,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPosition: { lat: number; lng: number } | null;
  onSelect: (lat: number, lng: number) => void;
}) {
  const [clickPosition, setClickPosition] = useState<
    { lat: number; lng: number } | null
  >(initialPosition);

  const center: [number, number] = clickPosition
    ? [clickPosition.lat, clickPosition.lng]
    : DEFAULT_MAP_CENTER;
  const zoom = clickPosition ? 14 : 4;

  const handleConfirm = () => {
    if (clickPosition) {
      onSelect(clickPosition.lat, clickPosition.lng);
    }
    onOpenChange(false);
  };

  const handleClear = () => {
    setClickPosition(null);
    onSelect(0, 0);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[100] grid w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 gap-4 border bg-[hsl(var(--background-card))] p-6 shadow-xl rounded-xl border-border"
          aria-describedby={undefined}
        >
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold text-text-primary">
              Pick Property Location
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="rounded-lg p-1 text-text-secondary hover:bg-[hsl(var(--background-accent))] hover:text-text-primary"
                aria-label="Close map picker"
              >
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>

          <Dialog.Description className="text-sm text-text-secondary">
            Click anywhere on the map to set the property location.
          </Dialog.Description>

          <div className="h-[400px] w-full overflow-hidden rounded-lg border border-border">
            {open && (
              <MapContainer
                key={open ? 'map-open' : 'map-closed'}
                center={center}
                zoom={zoom}
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
                scrollWheelZoom={true}
              >
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                />
                <MapClickHandler
                  onMapClick={(lat, lng) => setClickPosition({ lat, lng })}
                />
                {clickPosition && (
                  <Marker position={[clickPosition.lat, clickPosition.lng]} />
                )}
              </MapContainer>
            )}
          </div>

          {clickPosition && (
            <div className="text-sm text-text-secondary">
              Selected: {clickPosition.lat.toFixed(6)}, {clickPosition.lng.toFixed(6)}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              leftIcon={<Trash2 size={14} />}
            >
              Clear
            </Button>
            <Button
              size="sm"
              onClick={handleConfirm}
              disabled={!clickPosition}
              leftIcon={<MapPin size={14} />}
            >
              Confirm Location
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// --- Lead Form ---
const LeadForm: React.FC<LeadFormProps> = ({
  lead,
  mode,
  onClose,
  onSuccess,
}) => {
  const navigate = useNavigate();
  const { id: urlLeadId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  // Determine effective mode — explicit prop takes precedence, then URL inference
  const effectiveMode: 'create' | 'edit' = mode || (urlLeadId ? 'edit' : 'create');

  // Form state
  const [formValues, setFormValues] = useState<LeadFormValues>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    propertyAddress: '',
    propertyLatLng: null,
    source: '',
    notes: '',
    assignedToUserId: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);

  // Fetch users for assignee dropdown
  const {
    data: usersData,
    isLoading: isLoadingUsers,
    isError: isUsersError,
  } = useQuery<User[]>({
    queryKey: ['auth-users'],
    queryFn: () => api.get('/auth/users').then((res) => res.data.users),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch lead by ID when in edit mode and lead prop is not provided (route usage)
  const { data: fetchedLead, isLoading: isLoadingLead } = useQuery({
    queryKey: ['lead', urlLeadId],
    queryFn: () => api.get(`/leads/${urlLeadId}`).then((res) => res.data),
    enabled: effectiveMode === 'edit' && !!urlLeadId && !lead,
  });

  // Handle both wrapped ({ lead: ... }) and unwrapped API responses
  const fetchedLeadData: Lead | undefined =
    (fetchedLead as { lead?: Lead } | undefined)?.lead ||
    (fetchedLead as Lead | undefined);

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: LeadFormValues) =>
      api.post('/leads', transformData(data)).then((res) => res.data),
    onSuccess: handleSuccess,
    onError: handleError,
  });

  const updateMutation = useMutation({
    mutationFn: (data: LeadFormValues) =>
      api
        .patch(`/leads/${currentLead?.id || urlLeadId}`, transformData(data))
        .then((res) => res.data),
    onSuccess: handleSuccess,
    onError: handleError,
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // The active lead: prop takes precedence, then fetched
  const currentLead = lead || fetchedLeadData;

  // Populate form when lead data is available (edit mode)
  useEffect(() => {
    if (currentLead) {
      setFormValues({
        firstName: currentLead.firstName || '',
        lastName: currentLead.lastName || '',
        email: currentLead.email || '',
        phone: currentLead.phone || '',
        propertyAddress: currentLead.propertyAddress || '',
        propertyLatLng: currentLead.propertyLatLng
          ? { lat: currentLead.propertyLatLng.lat, lng: currentLead.propertyLatLng.lng }
          : null,
        source: currentLead.source || '',
        notes: currentLead.notes || '',
        assignedToUserId: currentLead.assignedToUserId || '',
      });
    }
  }, [currentLead]);

  // --- Handlers ---

  function transformData(values: LeadFormValues) {
    return {
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email || undefined,
      phone: values.phone || undefined,
      propertyAddress: values.propertyAddress,
      propertyLatLng: values.propertyLatLng || undefined,
      source: values.source,
      notes: values.notes || undefined,
      assignedToUserId: values.assignedToUserId || undefined,
    };
  }

  function validate(): Record<string, string> {
    const newErrors: Record<string, string> = {};
    if (!formValues.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formValues.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (
      formValues.email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formValues.email)
    ) {
      newErrors.email = 'Please enter a valid email address';
    }
    if (!formValues.propertyAddress.trim()) {
      newErrors.propertyAddress = 'Property address is required';
    }
    if (!formValues.source) newErrors.source = 'Please select a lead source';
    return newErrors;
  }

  function handleChange(field: keyof LeadFormValues, value: string) {
    setFormValues((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function handleSuccess() {
    queryClient.invalidateQueries({ queryKey: ['leads'] });
    const message =
      effectiveMode === 'edit'
        ? 'Lead updated successfully'
        : 'Lead created successfully';
    toast.success(message);
    onSuccess?.();
    if (!onSuccess) {
      handleClose();
    }
  }

  function handleError(error: any) {
    if (error.response?.data?.errors) {
      const fieldErrors: Record<string, string> = {};
      error.response.data.errors.forEach((err: any) => {
        fieldErrors[err.param] = err.msg;
      });
      setErrors(fieldErrors);
    }
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      'Something went wrong. Please try again.';
    toast.error(message);
  }

  function handleClose() {
    if (onClose) {
      onClose();
    } else {
      navigate('/leads');
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
    if (effectiveMode === 'edit' && currentLead?.id) {
      updateMutation.mutate(formValues);
    } else {
      createMutation.mutate(formValues);
    }
  }

  function handleMapSelect(lat: number, lng: number) {
    if (lat === 0 && lng === 0) {
      setFormValues((prev) => ({ ...prev, propertyLatLng: null }));
    } else {
      setFormValues((prev) => ({
        ...prev,
        propertyLatLng: { lat, lng },
      }));
    }
  }

  function handleMapClear() {
    setFormValues((prev) => ({ ...prev, propertyLatLng: null }));
  }

  // Show loading while fetching lead in edit mode
  if (effectiveMode === 'edit' && !lead && isLoadingLead) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 size={32} className="animate-spin text-primary" />
        <span className="ml-2 text-text-secondary">Loading lead…</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* ---- Page Header ---- */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">
            {effectiveMode === 'edit' ? 'Edit Lead' : 'Add New Lead'}
          </h1>
          <p className="text-sm text-text-secondary">
            {effectiveMode === 'edit'
              ? 'Update lead information and contact details'
              : 'Enter lead details to add them to your pipeline'}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClose}
          icon={<X size={16} />}
          aria-label="Close form"
        />
      </div>

      {/* ---- Form Card ---- */}
      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Contact Information */}
          <div>
            <h3 className="text-sm font-medium text-text-secondary mb-3">
              Contact Information
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="firstName"
                  className="block text-sm font-medium text-text-primary mb-1"
                >
                  First Name <span className="text-red">*</span>
                </label>
                <input
                  id="firstName"
                  type="text"
                  placeholder="John"
                  value={formValues.firstName}
                  onChange={(e) => handleChange('firstName', e.target.value)}
                  className={inputClassName(!!errors.firstName)}
                  disabled={isSubmitting}
                  aria-invalid={!!errors.firstName}
                />
                {errors.firstName && (
                  <p className="mt-1 text-xs text-red">{errors.firstName}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="lastName"
                  className="block text-sm font-medium text-text-primary mb-1"
                >
                  Last Name <span className="text-red">*</span>
                </label>
                <input
                  id="lastName"
                  type="text"
                  placeholder="Smith"
                  value={formValues.lastName}
                  onChange={(e) => handleChange('lastName', e.target.value)}
                  className={inputClassName(!!errors.lastName)}
                  disabled={isSubmitting}
                  aria-invalid={!!errors.lastName}
                />
                {errors.lastName && (
                  <p className="mt-1 text-xs text-red">{errors.lastName}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-text-primary mb-1"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  value={formValues.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className={inputClassName(!!errors.email)}
                  disabled={isSubmitting}
                  aria-invalid={!!errors.email}
                />
                {errors.email && (
                  <p className="mt-1 text-xs text-red">{errors.email}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="phone"
                  className="block text-sm font-medium text-text-primary mb-1"
                >
                  Phone
                </label>
                <input
                  id="phone"
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={formValues.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  className={inputClassName()}
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          {/* Property Information */}
          <div>
            <h3 className="text-sm font-medium text-text-secondary mb-3">
              Property Information
            </h3>
            <div className="space-y-3">
              <div>
                <label
                  htmlFor="propertyAddress"
                  className="block text-sm font-medium text-text-primary mb-1"
                >
                  Property Address{' '}
                  <span className="text-red">*</span>
                </label>
                <input
                  id="propertyAddress"
                  type="text"
                  placeholder="123 Main St, City, State ZIP"
                  value={formValues.propertyAddress}
                  onChange={(e) =>
                    handleChange('propertyAddress', e.target.value)
                  }
                  className={inputClassName(!!errors.propertyAddress)}
                  disabled={isSubmitting}
                  aria-invalid={!!errors.propertyAddress}
                />
                {errors.propertyAddress && (
                  <p className="mt-1 text-xs text-red">
                    {errors.propertyAddress}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Property Location
                </label>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsMapPickerOpen(true)}
                    leftIcon={<MapPin size={16} />}
                    disabled={isSubmitting}
                  >
                    Pick on Map
                  </Button>

                  {formValues.propertyLatLng ? (
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="info" size="sm">
                        Set
                      </Badge>
                      <span className="text-text-secondary">
                        Lat: {formValues.propertyLatLng.lat.toFixed(4)},
                        Lng: {formValues.propertyLatLng.lng.toFixed(4)}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleMapClear}
                        leftIcon={<Trash2 size={14} />}
                      >
                        Clear
                      </Button>
                    </div>
                  ) : (
                    <span className="text-sm text-text-tertiary">
                      No location selected
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Lead Details */}
          <div>
            <h3 className="text-sm font-medium text-text-secondary mb-3">
              Lead Details
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="source"
                  className="block text-sm font-medium text-text-primary mb-1"
                >
                  Source <span className="text-red">*</span>
                </label>
                <div className={selectWrapperClassName(!!errors.source)}>
                  <select
                    id="source"
                    value={formValues.source}
                    onChange={(e) => handleChange('source', e.target.value)}
                    disabled={isSubmitting}
                    className="w-full appearance-none bg-transparent text-sm text-text-primary focus:outline-none"
                    aria-invalid={!!errors.source}
                  >
                    <option value="">Select a source</option>
                    {LEAD_SOURCES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={16}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary"
                  />
                </div>
                {errors.source && (
                  <p className="mt-1 text-xs text-red">{errors.source}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="assignedToUserId"
                  className="block text-sm font-medium text-text-primary mb-1"
                >
                  Assigned To
                </label>
                <div className="relative w-full rounded-lg border bg-[hsl(var(--background))] px-3 py-2 text-sm focus-within:outline-none focus-within:ring-1 focus-within:border-primary focus-within:ring-primary/20 border-border">
                  {isLoadingUsers ? (
                    <span className="flex items-center gap-2 text-text-tertiary">
                      <Loader2 size={14} className="animate-spin" />
                      Loading users…
                    </span>
                  ) : isUsersError ? (
                    <span className="flex items-center gap-2 text-text-tertiary">
                      <AlertCircle size={14} />
                      Unable to load users
                    </span>
                  ) : (
                    <>
                      <select
                        id="assignedToUserId"
                        value={formValues.assignedToUserId}
                        onChange={(e) =>
                          handleChange('assignedToUserId', e.target.value)
                        }
                        disabled={isSubmitting}
                        className="w-full appearance-none bg-transparent text-sm text-text-primary focus:outline-none"
                      >
                        <option value="">Unassigned</option>
                        {usersData?.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.firstName} {user.lastName} ({user.role})
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={16}
                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary"
                      />
                    </>
                  )}
                </div>
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="notes"
                  className="block text-sm font-medium text-text-primary mb-1"
                >
                  Notes
                </label>
                <textarea
                  id="notes"
                  placeholder="Add any relevant notes about this lead…"
                  value={formValues.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  className={textareaClassName(!!errors.notes)}
                  disabled={isSubmitting}
                  rows={4}
                />
                {errors.notes && (
                  <p className="mt-1 text-xs text-red">{errors.notes}</p>
                )}
              </div>
            </div>
          </div>

          {/* Required field note */}
          <div className="flex items-center gap-2 text-xs text-text-tertiary">
            <AlertCircle size={14} />
            <span>Fields marked with * are required</span>
          </div>

          {/* Form Actions */}
          <div className="border-t border-border pt-4 flex justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              leftIcon={
                isSubmitting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Save size={16} />
                )
              }
            >
              {effectiveMode === 'edit' ? 'Update Lead' : 'Create Lead'}
            </Button>
          </div>
        </form>
      </Card>

      {/* Map Picker Dialog */}
      <MapPickerDialog
        open={isMapPickerOpen}
        onOpenChange={setIsMapPickerOpen}
        initialPosition={formValues.propertyLatLng}
        onSelect={handleMapSelect}
      />
    </div>
  );
};

export default LeadForm;
