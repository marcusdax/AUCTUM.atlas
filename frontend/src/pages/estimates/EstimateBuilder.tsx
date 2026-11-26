/**
 * RoofPro CRM — Comprehensive Estimate Page
 *
 * A single page that supports three modes, selected by URL:
 *   /estimates             → List   (table of estimates, status badges, totals, margin)
 *   /estimates/:jobId/new  → Builder (line-item editor, price DB lookup, send/PDF)
 *   /estimates/:id          → Detail (read-only items, approval actions, PDF preview)
 *
 * Data fetching uses @tanstack/react-query via the axios `api` client (auto JWT).
 * Line-item edits in builder mode persist through the estimate item sub-routes.
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../services/api';
import { useSocket } from '../../components/providers/SocketProvider';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { Badge, StatusDot } from '../../components/ui/Card';
import { Estimate, EstimateItem, PriceDatabaseEntry, Job, ChangeOrder } from '../../types';
import {
  Plus,
  Edit,
  Send,
  Download,
  FileText,
  Eye,
  Trash2,
  Search,
  X,
  Save,
  MapPin,
  AlertCircle,
  Loader2,
  Check,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

type EstimateStatus = 'DRAFT' | 'SENT' | 'APPROVED' | 'REJECTED';

interface EstimateListResponse {
  estimates: Estimate[];
  count: number;
}

interface EstimateDetailResponse {
  estimate: Estimate & {
    items: EstimateItem[];
    changeOrders?: ChangeOrder[];
    job?: Job;
  };
}

interface PdfResponse {
  pdfUrl: string;
  estimate: Estimate;
}

interface JobResponse {
  job: Job;
}

interface JobsResponse {
  data: Job[];
  count: number;
}

interface PriceDbResponse {
  data: PriceDatabaseEntry[];
  count: number;
  categories?: string[];
}

interface BuilderItem {
  id?: string;
  description: string;
  quantity: string;
  unit: string;
  unitCost: string;
  unitPrice: string;
  category: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toNum = (s: string | number | undefined | null): number => {
  const n = typeof s === 'number' ? s : parseFloat(s ?? '');
  return Number.isNaN(n) ? 0 : n;
};

const fmtMoney = (n: number): string =>
  `$${Math.round(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtQty = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(2));

const statusVariant = (status: string): 'warning' | 'info' | 'success' | 'danger' | 'default' => {
  switch (status) {
    case 'APPROVED':
      return 'success';
    case 'REJECTED':
      return 'danger';
    case 'SENT':
      return 'info';
    case 'DRAFT':
      return 'warning';
    default:
      return 'default';
  }
};

// ─── Real-time socket hook ────────────────────────────────────────────────────
// Invalidates estimate queries when the backend emits live estimate events.

const useEstimateRealtime = (estimateId?: string) => {
  const queryClient = useQueryClient();
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;

    const handler = () => {
      queryClient.invalidateQueries({ queryKey: ['estimates'] });
      if (estimateId) {
        queryClient.invalidateQueries({ queryKey: ['estimate', estimateId] });
      }
    };

    const events = [
      'estimate:created',
      'estimate:updated',
      'estimate:deleted',
      'estimate:sent',
      'estimate:approved',
      'estimate:rejected',
      'estimate:pdf',
      'estimate:itemAdded',
      'estimate:itemUpdated',
      'estimate:itemDeleted',
    ];

    events.forEach((ev) => socket.on(ev, handler));
    return () => {
      events.forEach((ev) => socket.off(ev, handler));
    };
  }, [socket, queryClient, estimateId]);
};

// ─── Modal primitive ─────────────────────────────────────────────────────────

const Modal: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}> = ({ open, onClose, title, children, size = 'lg' }) => {
  if (!open) return null;
  const sizeClass = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`w-full ${sizeClass} rounded-xl bg-[hsl(var(--background-card))] border border-border shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-text-tertiary hover:bg-[hsl(var(--background-accent))] hover:text-text-primary"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

// ─── List view ───────────────────────────────────────────────────────────────

const ListView: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [jobSelectorOpen, setJobSelectorOpen] = useState(false);
  useEstimateRealtime();

  const { data, isLoading } = useQuery({
    queryKey: ['estimates'],
    queryFn: () =>
      api.get('/estimates').then((res) => res.data) as Promise<EstimateListResponse>,
    placeholderData: { estimates: [], count: 0 },
  });

  const estimates = data?.estimates ?? [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Estimates</h1>
          <p className="text-text-tertiary">Create and manage estimates for your roofing jobs.</p>
        </div>
        <Button leftIcon={<Plus size={16} />} onClick={() => setJobSelectorOpen(true)}>
          New Estimate
        </Button>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="text-center">
            <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            <p className="text-text-secondary">Loading estimates…</p>
          </div>
        </div>
      ) : estimates.length === 0 ? (
        <Card className="text-center py-12">
          <FileText size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-text-tertiary mb-4">No estimates yet. Create your first estimate.</p>
          <Button leftIcon={<Plus size={16} />} onClick={() => setJobSelectorOpen(true)}>
            Get Started
          </Button>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-sm border border-border bg-[hsl(var(--background-card))]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-[hsl(var(--background-accent))]">
                <th className="px-4 py-3 text-left font-medium text-text-secondary">Estimate</th>
                <th className="px-4 py-3 text-left font-medium text-text-secondary">Job</th>
                <th className="px-4 py-3 text-center font-medium text-text-secondary">Status</th>
                <th className="px-4 py-3 text-right font-medium text-text-secondary">Cost</th>
                <th className="px-4 py-3 text-right font-medium text-text-secondary">Price</th>
                <th className="px-4 py-3 text-right font-medium text-text-secondary">Margin</th>
                <th className="px-4 py-3 text-right font-medium text-text-secondary">Items</th>
                <th className="px-4 py-3 text-left font-medium text-text-secondary">Created</th>
                <th className="px-4 py-3 text-center font-medium text-text-secondary">Actions</th>
              </tr>
            </thead>
            <tbody>
              {estimates.map((estimate) => {
                const totalCost = estimate.totalCost ?? 0;
                const totalPrice = estimate.totalPrice ?? 0;
                const margin = totalPrice - totalCost;
                const marginPct = totalPrice > 0 ? (margin / totalPrice) * 100 : 0;
                const marginColor = margin >= 0 ? 'text-emerald' : 'text-red';
                return (
                  <tr
                    key={estimate.id}
                    className="border-b border-border transition-colors hover:bg-[hsl(var(--background-accent))]/40"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-text-primary">{estimate.name}</p>
                      {estimate.notes && (
                        <p className="max-w-xs truncate text-xs text-text-tertiary">
                          {estimate.notes}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {estimate.job?.name ?? '—'}
                      {estimate.job?.propertyAddress && (
                        <p className="text-xs text-text-tertiary">{estimate.job.propertyAddress}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <StatusDot status={estimate.status} />
                        <Badge variant={statusVariant(estimate.status)} size="sm">
                          {estimate.status}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-text-secondary">{fmtMoney(totalCost)}</td>
                    <td className="px-4 py-3 text-right font-medium text-text-primary">
                      {fmtMoney(totalPrice)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-medium ${marginColor}`}>{marginPct.toFixed(1)}%</span>
                    </td>
                    <td className="px-4 py-3 text-right text-text-secondary">
                      {estimate.items?.length ?? 0}
                    </td>
                    <td className="px-4 py-3 text-text-tertiary">
                      {new Date(estimate.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => navigate(`/estimates/${estimate.id}`)}
                          className="rounded-lg p-1.5 text-text-tertiary hover:bg-[hsl(var(--background-accent))] hover:text-text-primary"
                          title="View"
                        >
                          <Eye size={14} />
                        </button>
                        {estimate.status === 'DRAFT' && (
                          <button
                            onClick={() =>
                              api
                                .post(`/estimates/${estimate.id}/send`)
                                .then(() => queryClient.invalidateQueries({ queryKey: ['estimates'] }))
                                .then(() => toast.success('Estimate sent'))
                                .catch(() => toast.error('Failed to send'))
                            }
                            className="rounded-lg p-1.5 text-text-tertiary hover:bg-[hsl(var(--background-accent))] hover:text-text-primary"
                            title="Send for approval"
                          >
                            <Send size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <JobSelector
        open={jobSelectorOpen}
        onClose={() => setJobSelectorOpen(false)}
        onSelect={(job) => navigate(`/estimates/${job.id}/new`)}
      />
    </div>
  );
};

// ─── Job selector modal (list → New Estimate) ───────────────────────────────

const JobSelector: React.FC<{
  open: boolean;
  onClose: () => void;
  onSelect: (job: Job) => void;
}> = ({ open, onClose, onSelect }) => {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => api.get('/jobs').then((res) => res.data) as Promise<JobsResponse>,
    placeholderData: { data: [], count: 0 },
  });

  const jobs = useMemo(() => {
    const list = data?.data ?? [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (j) =>
        j.name?.toLowerCase().includes(q) ||
        j.propertyAddress?.toLowerCase().includes(q)
    );
  }, [data, search]);

  return (
    <Modal open={open} onClose={onClose} title="Select a job" size="md">
      <div className="mb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={16} />
          <input
            type="text"
            placeholder="Search jobs by name or address..."
            className="input pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      {isLoading ? (
        <div className="py-8 text-center text-text-tertiary">Loading jobs…</div>
      ) : jobs.length === 0 ? (
        <p className="py-8 text-center text-text-tertiary">No jobs found.</p>
      ) : (
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="cursor-pointer rounded-lg border border-border p-3 transition-colors hover:bg-[hsl(var(--background-accent))]"
              onClick={() => onSelect(job)}
            >
              <p className="font-medium text-text-primary">{job.name}</p>
              <p className="text-sm text-text-tertiary">{job.propertyAddress}</p>
              <div className="mt-1 flex gap-2">
                <Badge variant="default" size="sm">
                  {job.status}
                </Badge>
                <Badge variant="default" size="sm">
                  {job.phase}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
};

// ─── Price database lookup modal ─────────────────────────────────────────────

const PriceDbModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onSelect: (entry: PriceDatabaseEntry) => void;
}> = ({ open, onClose, onSelect }) => {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['price-database'],
    queryFn: () =>
      api.get('/materials/price-database').then((res) => res.data) as Promise<PriceDbResponse>,
    placeholderData: { data: [], count: 0, categories: [] },
  });

  const entries = useMemo(() => {
    const list = data?.data ?? [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (e) =>
        e.name?.toLowerCase().includes(q) || e.category?.toLowerCase().includes(q)
    );
  }, [data, search]);

  return (
    <Modal open={open} onClose={onClose} title="Price database lookup" size="xl">
      <div className="mb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={16} />
          <input
            type="text"
            placeholder="Search materials (name, category)..."
            className="input pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      {isLoading ? (
        <div className="py-8 text-center text-text-tertiary">Loading price database…</div>
      ) : entries.length === 0 ? (
        <p className="py-8 text-center text-text-tertiary">No matching materials found.</p>
      ) : (
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-[hsl(var(--background-accent))]">
                <th className="px-3 py-2 text-left font-medium text-text-secondary">Category</th>
                <th className="px-3 py-2 text-left font-medium text-text-secondary">Name</th>
                <th className="px-3 py-2 text-right font-medium text-text-secondary">Unit</th>
                <th className="px-3 py-2 text-right font-medium text-text-secondary">Cost</th>
                <th className="px-3 py-2 text-right font-medium text-text-secondary">Price</th>
                <th className="px-3 py-2 text-center font-medium text-text-secondary">Apply</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-border">
                  <td className="px-3 py-2 text-text-tertiary">{e.category}</td>
                  <td className="px-3 py-2 text-text-primary">{e.name}</td>
                  <td className="px-3 py-2 text-right text-text-secondary">{e.unit}</td>
                  <td className="px-3 py-2 text-right text-text-secondary">
                    {e.defaultCost != null ? fmtMoney(e.defaultCost) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-text-secondary">
                    {e.defaultPrice != null ? fmtMoney(e.defaultPrice) : '—'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={<Check size={14} />}
                      onClick={() => onSelect(e)}
                    >
                      Use
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
};

// ─── PDF preview modal ───────────────────────────────────────────────────────
// Renders the generated estimate PDF from its public /uploads URL.

const PdfPreviewModal: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  pdfUrl: string;
}> = ({ open, onClose, title, pdfUrl }) => {
  return (
    <Modal open={open} onClose={onClose} title={`Preview: ${title}`} size="xl">
      <iframe
        src={pdfUrl}
        title={`Estimate PDF preview`}
        className="h-[70vh] w-full rounded-lg border border-border"
      />
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
        <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
          <Button size="sm" leftIcon={<Download size={14} />}>
            Download PDF
          </Button>
        </a>
      </div>
    </Modal>
  );
};

// ─── Builder view ────────────────────────────────────────────────────────────

const initialItem = (): BuilderItem => ({
  description: '',
  quantity: '1',
  unit: 'ea',
  unitCost: '0',
  unitPrice: '0',
  category: '',
});

const fromApiItem = (it: EstimateItem): BuilderItem => ({
  id: it.id,
  description: it.description,
  quantity: String(it.quantity),
  unit: it.unit,
  unitCost: String(it.unitCost),
  unitPrice: String(it.unitPrice),
  category: it.category ?? '',
});

const BuilderView: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  useEstimateRealtime();

  // Job context
  const {
    data: jobData,
    isLoading: jobLoading,
    isError: jobError,
  } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () =>
      api.get(`/jobs/${jobId}`).then((res) => res.data) as Promise<JobResponse>,
    enabled: Boolean(jobId),
  });

  // ── Mutations ────────────────────────────────────────────────────────────
  const createEstimate = useMutation({
    mutationFn: (payload: { jobId: string; name: string; notes?: string; items: BuilderItem[] }) =>
      api.post('/estimates', payload).then((res) => res.data.estimate as Estimate),
    onSuccess: (estimate) => {
      const persisted = estimate.items?.map(fromApiItem) ?? [];
      setItems(persisted);
      baselineRef.current = Object.fromEntries(persisted.map((it) => [it.id, it]));
      setEstimateId(estimate.id);
      setStatus(estimate.status as EstimateStatus);
      queryClient.setQueryData(['estimate', estimate.id], estimate);
      queryClient.invalidateQueries({ queryKey: ['estimates'] });
      toast.success('Draft saved');
    },
    onError: () => toast.error('Failed to save draft'),
  });

  const updateEstimate = useMutation({
    mutationFn: () =>
      api
        .patch(`/estimates/${estimateId!}`, {
          name: estimateName,
          notes,
        })
        .then((res) => res.data.estimate as Estimate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimates'] });
      toast.success('Changes saved');
    },
    onError: () => toast.error('Failed to save changes'),
  });

  const addItemMutation = useMutation({
    mutationFn: (item: Omit<BuilderItem, 'id'>) =>
      api
        .post(`/estimates/${estimateId!}/items`, {
          description: item.description,
          quantity: toNum(item.quantity),
          unit: item.unit,
          unitCost: toNum(item.unitCost),
          unitPrice: toNum(item.unitPrice),
          category: item.category || undefined,
        })
        .then((res) => res.data.item as EstimateItem),
    onSuccess: (item) => {
      const persisted = fromApiItem(item);
      setItems((prev) => [...prev, persisted]);
      baselineRef.current[item.id] = persisted;
      queryClient.invalidateQueries({ queryKey: ['estimates'] });
      toast.success('Item added');
    },
    onError: () => toast.error('Failed to add item'),
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ itemId, patch }: { itemId: string; patch: BuilderItem }) =>
      api
        .patch(`/estimates/${estimateId!}/items/${itemId}`, {
          description: patch.description,
          quantity: patch.quantity,
          unit: patch.unit,
          unitCost: patch.unitCost,
          unitPrice: patch.unitPrice,
          category: patch.category,
        })
        .then((res) => res.data.item as EstimateItem),
    onSuccess: (item) => {
      const persisted = fromApiItem(item);
      setItems((prev) =>
        prev.map((it) => (it.id === item.id ? persisted : it))
      );
      baselineRef.current[item.id] = persisted;
    },
    onError: () => toast.error('Failed to update item'),
  });

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) => api.delete(`/estimates/${estimateId!}/items/${itemId}`),
    onSuccess: (_data, itemId) => {
      setItems((prev) => prev.filter((it) => it.id !== itemId));
      delete baselineRef.current[itemId];
      queryClient.invalidateQueries({ queryKey: ['estimates'] });
      toast.success('Item removed');
    },
    onError: () => toast.error('Failed to remove item'),
  });

  const sendMutation = useMutation({
    mutationFn: () => api.post(`/estimates/${estimateId!}/send`).then((res) => res.data.estimate as Estimate),
    onSuccess: (estimate) => {
      setStatus(estimate.status as EstimateStatus);
      queryClient.invalidateQueries({ queryKey: ['estimates'] });
      toast.success('Estimate sent for approval');
    },
    onError: () => toast.error('Failed to send estimate'),
  });

  const generatePdfMutation = useMutation({
    mutationFn: () => api.post(`/estimates/${estimateId!}/pdf`).then((res) => res.data as PdfResponse),
    onSuccess: (data) => {
      setPdfUrl(data.pdfUrl);
      queryClient.invalidateQueries({ queryKey: ['estimates'] });
      toast.success('PDF generated');
    },
    onError: () => toast.error('Failed to generate PDF'),
  });

  // ── Local state ─────────────────────────────────────────────────────────
  const [estimateId, setEstimateId] = useState<string | null>(null);
  const [status, setStatus] = useState<EstimateStatus>('DRAFT');
  const [estimateName, setEstimateName] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<BuilderItem[]>([initialItem()]);
  const [priceDbOpen, setPriceDbOpen] = useState(false);
  const [activeItemIdx, setActiveItemIdx] = useState<number | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  // baselineRef holds the last-persisted values (keyed by item id) for dirty checks
  const baselineRef = useRef<Record<string, BuilderItem>>({});

  const job = jobData?.job;

  useEffect(() => {
    if (job && !estimateName) {
      setEstimateName(job.name || `Estimate for ${job.propertyAddress || 'Job'}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job]);

  // Computed totals (live, from local items)
  const totals = useMemo(() => {
    let totalCost = 0;
    let totalPrice = 0;
    for (const it of items) {
      const qty = toNum(it.quantity);
      totalCost += toNum(it.unitCost) * qty;
      totalPrice += toNum(it.unitPrice) * qty;
    }
    return { totalCost, totalPrice };
  }, [items]);

  const margin = totals.totalPrice - totals.totalCost;
  const marginPct = totals.totalPrice > 0 ? (margin / totals.totalPrice) * 100 : 0;

  if (jobLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <Loader2 size={24} className="animate-spin text-primary" />
          <p className="mt-2 text-text-secondary">Loading job…</p>
        </div>
      </div>
    );
  }

  if (jobError || !job) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="mx-auto mb-3 h-8 w-8 text-red" />
        <p className="text-text-tertiary">{jobError ? 'Failed to load job.' : 'Job not found.'}</p>
        <Button variant="ghost" className="mt-4" onClick={() => navigate('/estimates')}>
          Back to Estimates
        </Button>
      </div>
    );
  }

  // ── Handlers ────────────────────────────────────────────────────────────
  const updateItemField = (idx: number, field: keyof BuilderItem, value: string) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  };

  const handleRowBlur = (idx: number) => {
    const item = items[idx];
    if (!item || !item.id || !estimateId) return;
    const prev = baselineRef.current[item.id];
    if (!prev) return;
    const changed =
      item.description !== prev.description ||
      item.quantity !== prev.quantity ||
      item.unit !== prev.unit ||
      item.unitCost !== prev.unitCost ||
      item.unitPrice !== prev.unitPrice ||
      item.category !== prev.category;
    if (changed) {
      updateItemMutation.mutate({ itemId: item.id, patch: { ...item } });
    }
  };

  const handleAddItem = () => {
    if (estimateId) {
      // Persist immediately via the items sub-route
      addItemMutation.mutate({
        description: '',
        quantity: '1',
        unit: 'ea',
        unitCost: '0',
        unitPrice: '0',
        category: '',
      });
    } else {
      // Unsaved draft: keep locally (will be sent with the next Save Draft)
      const newItem = initialItem();
      setItems((prev) => [...prev, newItem]);
    }
  };

  const handleDeleteItem = (idx: number) => {
    const item = items[idx];
    if (!item) return;
    if (item.id && estimateId) {
      deleteItemMutation.mutate(item.id);
    } else {
      setItems((prev) => prev.filter((_, i) => i !== idx));
      // no baseline entry for transient items
    }
  };

  const handlePriceLookup = (idx: number) => {
    setActiveItemIdx(idx);
    setPriceDbOpen(true);
  };

  const applyPriceEntry = (entry: PriceDatabaseEntry) => {
    if (activeItemIdx === null) return;
    const current = items[activeItemIdx];
    const updates: Partial<BuilderItem> = {
      unit: entry.unit || current.unit,
      category: entry.category || current.category,
    };
    if (entry.name && !current.description) updates.description = entry.name;
    if (entry.defaultCost != null) updates.unitCost = String(entry.defaultCost);
    if (entry.defaultPrice != null) updates.unitPrice = String(entry.defaultPrice);

    const merged = { ...current, ...updates };
    if (current?.id && estimateId) {
      updateItemMutation.mutate({ itemId: current.id, patch: merged });
    }
    setItems((prev) => prev.map((it, i) => (i === activeItemIdx ? merged : it)));
    setPriceDbOpen(false);
    setActiveItemIdx(null);
  };

  const handleSaveDraft = () => {
    if (!jobId) return;
    createEstimate.mutate({
      jobId,
      name: estimateName || job.name,
      notes,
      items: items.map((it) => ({
        description: it.description,
        quantity: it.quantity,
        unit: it.unit,
        unitCost: it.unitCost,
        unitPrice: it.unitPrice,
        category: it.category || '',
      })),
    });
  };

  const handleSend = () => {
    if (!estimateId) {
      toast('Save the draft before sending');
      return;
    }
    sendMutation.mutate();
  };

  const handlePdf = () => {
    if (!estimateId) {
      toast('Save the draft before generating a PDF');
      return;
    }
    generatePdfMutation.mutate();
  };

  const canSend = Boolean(estimateId) && status === 'DRAFT';

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/estimates')}>
            ← Back to Estimates
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-text-primary">Estimate Builder</h1>
              <StatusDot status={status} />
              <Badge variant={statusVariant(status)}>
                {estimateId ? status : 'Draft (unsaved)'}
              </Badge>
            </div>
            <p className="flex items-center gap-1 text-sm text-text-tertiary">
              <MapPin size={14} /> {job.propertyAddress}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {estimateId ? (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Save size={14} />}
              onClick={() => updateEstimate.mutate()}
              isLoading={updateEstimate.isPending}
            >
              Save Changes
            </Button>
          ) : (
            <Button
              size="sm"
              leftIcon={<Save size={14} />}
              onClick={handleSaveDraft}
              isLoading={createEstimate.isPending}
            >
              Save Draft
            </Button>
          )}
          {canSend && (
            <Button size="sm" leftIcon={<Send size={14} />} onClick={handleSend} isLoading={sendMutation.isPending}>
              Send for Approval
            </Button>
          )}
          {estimateId && (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<FileText size={14} />}
              onClick={handlePdf}
              isLoading={generatePdfMutation.isPending}
            >
              Generate PDF
            </Button>
          )}
          {estimateId && (
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Eye size={14} />}
              onClick={() => navigate(`/estimates/${estimateId}`)}
            >
              Detail
            </Button>
          )}
        </div>
      </div>

      {/* Estimate details */}
      <Card className="mb-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-text-tertiary">Estimate Name</label>
            <input
              type="text"
              className="input mt-1"
              value={estimateName}
              onChange={(e) => setEstimateName(e.target.value)}
              placeholder="e.g. Architectural Shingles Replacement"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-text-tertiary">Notes</label>
            <textarea
              className="input mt-1 min-h-[80px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Scope notes, exclusions, warranty info..."
              rows={4}
            />
          </div>
        </div>
      </Card>

      {/* Line items editor */}
      <Card title="Line Items" className="mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-[hsl(var(--background-accent))]/60">
                <th className="px-3 py-2 text-left font-medium text-text-secondary">Description</th>
                <th className="px-3 py-2 text-right font-medium text-text-secondary">Qty</th>
                <th className="px-3 py-2 text-left font-medium text-text-secondary">Unit</th>
                <th className="px-3 py-2 text-right font-medium text-text-secondary">Cost</th>
                <th className="px-3 py-2 text-right font-medium text-text-secondary">Price</th>
                <th className="px-3 py-2 text-right font-medium text-text-secondary">Line Total</th>
                <th className="px-3 py-2 text-center font-medium text-text-secondary">DB</th>
                <th className="px-3 py-2 text-center font-medium text-text-secondary">×</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const lineTotal = toNum(item.unitPrice) * toNum(item.quantity);
                const itemCost = toNum(item.unitCost) * toNum(item.quantity);
                return (
                  <tr key={idx} className="border-b border-border">
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        className="input"
                        value={item.description}
                        onChange={(e) => updateItemField(idx, 'description', e.target.value)}
                        onBlur={() => handleRowBlur(idx)}
                        placeholder="e.g. Architectural shingles"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        className="input text-right"
                        value={item.quantity}
                        onChange={(e) => updateItemField(idx, 'quantity', e.target.value)}
                        onBlur={() => handleRowBlur(idx)}
                        min={0}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        className="input"
                        value={item.unit}
                        onChange={(e) => updateItemField(idx, 'unit', e.target.value)}
                        onBlur={() => handleRowBlur(idx)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        className="input text-right"
                        value={item.unitCost}
                        onChange={(e) => updateItemField(idx, 'unitCost', e.target.value)}
                        onBlur={() => handleRowBlur(idx)}
                        min={0}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        className="input text-right"
                        value={item.unitPrice}
                        onChange={(e) => updateItemField(idx, 'unitPrice', e.target.value)}
                        onBlur={() => handleRowBlur(idx)}
                        min={0}
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className="font-medium text-text-primary">{fmtMoney(lineTotal)}</span>
                      <span className="block text-xs text-text-tertiary">cost: {fmtMoney(itemCost)}</span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        className="rounded-lg p-1.5 text-text-tertiary hover:bg-[hsl(var(--background-accent))] hover:text-text-primary"
                        onClick={() => handlePriceLookup(idx)}
                        title="Price database lookup"
                      >
                        <Search size={14} />
                      </button>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        className="rounded-lg p-1.5 text-text-tertiary hover:bg-red/10 hover:text-red"
                        onClick={() => handleDeleteItem(idx)}
                        title="Remove line item"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
          <Button variant="ghost" size="sm" leftIcon={<Plus size={14} />} onClick={handleAddItem}>
            Add Line Item
          </Button>
          <div className="flex items-center gap-8">
            <div className="text-right">
              <span className="text-text-tertiary">Total Cost</span>
              <p className="text-xl font-bold text-text-primary">{fmtMoney(totals.totalCost)}</p>
            </div>
            <div className="text-right">
              <span className="text-text-tertiary">Total Price</span>
              <p className="text-xl font-bold text-primary">{fmtMoney(totals.totalPrice)}</p>
            </div>
            <div className="text-right">
              <span className="text-text-tertiary">Margin</span>
              <p className={`text-xl font-bold ${margin >= 0 ? 'text-emerald' : 'text-red'}`}>
                {fmtMoney(margin)} ({marginPct.toFixed(1)}%)
              </p>
            </div>
          </div>
        </div>
      </Card>

      <PriceDbModal
        open={priceDbOpen}
        onClose={() => {
          setPriceDbOpen(false);
          setActiveItemIdx(null);
        }}
        onSelect={applyPriceEntry}
      />

      {pdfUrl && (
        <PdfPreviewModal
          open={!!pdfUrl}
          onClose={() => setPdfUrl(null)}
          title={estimateName}
          pdfUrl={pdfUrl}
        />
      )}
    </div>
  );
};

// ─── Detail view ─────────────────────────────────────────────────────────────

const DetailView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  useEstimateRealtime(id);

  const {
    data,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['estimate', id],
    queryFn: () =>
      api.get(`/estimates/${id}`).then((res) => res.data) as Promise<EstimateDetailResponse>,
    enabled: Boolean(id),
  });

  const estimate = data?.estimate;

  // ── Mutations ─────────────────────────────────────────────────────────
  const sendMutation = useMutation({
    mutationFn: () => api.post(`/estimates/${id}/send`).then((res) => res.data.estimate as Estimate),
    onSuccess: (updated) => {
      queryClient.setQueryData(['estimate', id], { estimate: updated });
      queryClient.invalidateQueries({ queryKey: ['estimates'] });
      toast.success('Estimate sent for approval');
    },
    onError: () => toast.error('Failed to send estimate'),
  });

  const approveMutation = useMutation({
    mutationFn: () => api.post(`/estimates/${id}/approve`).then((res) => res.data.estimate as Estimate),
    onSuccess: (updated) => {
      queryClient.setQueryData(['estimate', id], { estimate: updated });
      queryClient.invalidateQueries({ queryKey: ['estimates'] });
      toast.success('Estimate approved');
    },
    onError: () => toast.error('Failed to approve estimate'),
  });

  const rejectMutation = useMutation({
    mutationFn: () => api.post(`/estimates/${id}/reject`).then((res) => res.data.estimate as Estimate),
    onSuccess: (updated) => {
      queryClient.setQueryData(['estimate', id], { estimate: updated });
      queryClient.invalidateQueries({ queryKey: ['estimates'] });
      toast.success('Estimate rejected');
    },
    onError: () => toast.error('Failed to reject estimate'),
  });

  const generatePdfMutation = useMutation({
    mutationFn: () => api.post(`/estimates/${id}/pdf`).then((res) => res.data as PdfResponse),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['estimate', id] });
      setPdfUrl(data.pdfUrl);
      toast.success('PDF generated');
    },
    onError: () => toast.error('Failed to generate PDF'),
  });

  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <Loader2 size={24} className="animate-spin text-primary" />
          <p className="mt-2 text-text-secondary">Loading estimate…</p>
        </div>
      </div>
    );
  }

  if (isError || !estimate) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="mx-auto mb-3 h-8 w-8 text-red" />
        <p className="text-text-tertiary">Estimate not found.</p>
        <Button variant="ghost" className="mt-4" onClick={() => navigate('/estimates')}>
          Back to Estimates
        </Button>
      </div>
    );
  }

  const items = estimate.items ?? [];
  const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const changeOrderTotal = estimate.changeOrders?.reduce((sum, co) => sum + co.amount, 0) ?? 0;
  const finalTotal = subtotal; // base estimate total (excludes change orders)
  const totalCost = estimate.totalCost ?? 0;
  const totalPrice = estimate.totalPrice ?? 0;
  const margin = totalPrice - totalCost;
  const marginPct = totalPrice > 0 ? (margin / totalPrice) * 100 : 0;

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/estimates')}>
            ← Back to Estimates
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-text-primary">{estimate.name}</h1>
              <StatusDot status={estimate.status} />
              <Badge variant={statusVariant(estimate.status)}>{estimate.status}</Badge>
            </div>
            <p className="text-sm text-text-tertiary">
              Job: {estimate.job?.name || '—'} • Property: {estimate.job?.propertyAddress || '—'} •
              Created {new Date(estimate.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {estimate.status === 'DRAFT' && (
            <Button size="sm" leftIcon={<Send size={14} />} onClick={() => sendMutation.mutate()} isLoading={sendMutation.isPending}>
              Send
            </Button>
          )}
          {estimate.status === 'SENT' && (
            <>
              <Button size="sm" leftIcon={<Check size={14} />} onClick={() => approveMutation.mutate()} isLoading={approveMutation.isPending}>
                Approve
              </Button>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<X size={14} />}
                onClick={() => rejectMutation.mutate()}
                isLoading={rejectMutation.isPending}
              >
                Reject
              </Button>
            </>
          )}
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<FileText size={14} />}
            onClick={() => generatePdfMutation.mutate()}
            isLoading={generatePdfMutation.isPending}
          >
            Generate PDF
          </Button>
          {(estimate.pdfUrl || pdfUrl) && (
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Eye size={14} />}
              onClick={() => setPdfUrl(estimate.pdfUrl || pdfUrl!)}
              title="Preview PDF"
            >
              Preview PDF
            </Button>
          )}
        </div>
      </div>

      {/* Status & details */}
      <Card title="Status & Details" className="mb-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <span className="text-sm text-text-tertiary">Status</span>
            <Badge variant={statusVariant(estimate.status)} className="mt-1">
              {estimate.status}
            </Badge>
          </div>
          <div>
            <span className="text-sm text-text-tertiary">Total Cost</span>
            <p className="font-medium text-text-primary">{fmtMoney(totalCost)}</p>
          </div>
          <div>
            <span className="text-sm text-text-tertiary">Total Price</span>
            <p className="font-medium text-primary">{fmtMoney(totalPrice)}</p>
          </div>
          <div>
            <span className="text-sm text-text-tertiary">Margin</span>
            <p className={`font-medium ${margin >= 0 ? 'text-emerald' : 'text-red'}`}>
              {fmtMoney(margin)} ({marginPct.toFixed(1)}%)
            </p>
          </div>
        </div>

        {estimate.sentAt && (
          <div className="mt-4">
            <span className="text-sm text-text-tertiary">Sent at</span>
            <p className="font-medium text-text-primary">{new Date(estimate.sentAt).toLocaleString()}</p>
          </div>
        )}
        {estimate.approvedAt && (
          <div className="mt-2">
            <span className="text-sm text-text-tertiary">Approved at</span>
            <p className="font-medium text-text-primary">{new Date(estimate.approvedAt).toLocaleString()}</p>
          </div>
        )}

        {estimate.notes && (
          <div className="mt-4">
            <span className="text-sm text-text-tertiary">Notes</span>
            <p className="mt-1 text-text-secondary whitespace-pre-wrap">{estimate.notes}</p>
          </div>
        )}
      </Card>

      {/* Line items */}
      <Card title="Estimate Items" className="mb-6">
        {items.length === 0 ? (
          <p className="text-text-tertiary">No items in this estimate.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-[hsl(var(--background-accent))]/60">
                  <th className="px-3 py-2 text-left font-medium text-text-secondary">Description</th>
                  <th className="px-3 py-2 text-right font-medium text-text-secondary">Qty</th>
                  <th className="px-3 py-2 text-left font-medium text-text-secondary">Unit</th>
                  <th className="px-3 py-2 text-right font-medium text-text-secondary">Unit Cost</th>
                  <th className="px-3 py-2 text-right font-medium text-text-secondary">Unit Price</th>
                  <th className="px-3 py-2 text-right font-medium text-text-secondary">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-border">
                    <td className="px-3 py-2 text-text-primary">
                      {item.description}
                      {item.category && <span className="block text-xs text-text-tertiary">{item.category}</span>}
                    </td>
                    <td className="px-3 py-2 text-right text-text-secondary">{fmtQty(Number(item.quantity))}</td>
                    <td className="px-3 py-2 text-text-secondary">{item.unit}</td>
                    <td className="px-3 py-2 text-right text-text-secondary">{fmtMoney(item.unitCost)}</td>
                    <td className="px-3 py-2 text-right text-text-secondary">{fmtMoney(item.unitPrice)}</td>
                    <td className="px-3 py-2 text-right font-medium text-text-primary">
                      {fmtMoney(item.unitPrice * item.quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {estimate.changeOrders && estimate.changeOrders.length > 0 && (
        <Card title="Change Orders" className="mb-6">
          <div className="space-y-3">
            {estimate.changeOrders.map((co) => (
              <div key={co.id} className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-text-primary">{co.description}</p>
                  <p className="text-sm text-text-tertiary">
                    {new Date(co.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={co.status === 'APPROVED' ? 'success' : co.status === 'REJECTED' ? 'danger' : 'warning'}
                  >
                    {co.status}
                  </Badge>
                  <span className="font-medium text-text-primary">{fmtMoney(co.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {pdfUrl && (
        <PdfPreviewModal
          open={!!pdfUrl}
          onClose={() => setPdfUrl(null)}
          title={estimate.name}
          pdfUrl={pdfUrl}
        />
      )}
    </div>
  );
};

// ─── Main page: mode-switch on URL params ─────────────────────────────────────

const EstimateBuilder: React.FC = () => {
  const { id, jobId } = useParams();
  const mode = jobId ? 'builder' : id ? 'detail' : 'list';

  return (
    <>
      {mode === 'list' && <ListView />}
      {mode === 'builder' && <BuilderView />}
      {mode === 'detail' && <DetailView />}
    </>
  );
};

export default EstimateBuilder;

