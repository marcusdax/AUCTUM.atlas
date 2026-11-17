/**
 * Marketing Studio — branded print pieces with a scannable link (AUCTUM pattern).
 *
 * Reps build yard signs, door hangers, flyers, postcards and truck magnets from
 * the company's logo and colors. Every piece gets its own QR code; a homeowner
 * who scans it lands on /m/<code>, and the lead they leave is attributed to that
 * exact piece. Rendering and export (SVG, PNG, print-to-PDF) happen on the
 * device; the server stores the text, a brand snapshot and the counts.
 *
 * API (backend/src/routes/marketing.routes.ts):
 *   GET/PUT /marketing/brand · GET/POST /marketing/campaigns · DELETE /marketing/campaigns/:id
 *   POST /marketing/campaigns/:id/pieces · PATCH/DELETE /marketing/pieces/:id · GET /marketing/pieces/:id/leads
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { AlertTriangle, Download, FileImage, Loader2, Megaphone, Plus, Printer, QrCode, Save, Trash2 } from 'lucide-react';
import { api, resolveFileUrl } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import Button from '../../components/ui/Button';
import PieceSvg, { downloadPng, downloadSvg, printPiece, toDataUrl, useQrSvg } from './PieceSvg';
import {
  isLocalBase,
  KIND_ORDER,
  KIND_SPECS,
  layoutPiece,
  scanUrl,
  STARTERS,
  type BrandColors,
  type PieceKind,
} from './templates';

interface Brand {
  companyName: string;
  phone: string | null;
  address: string | null;
  logoUrl: string | null;
  colors: BrandColors;
}

interface Piece {
  id: string;
  campaignId: string;
  kind: PieceKind;
  title: string;
  headline: string;
  body: string;
  cta: string;
  design: { colors?: BrandColors };
  code: string;
  scanCount: number;
  lastScanAt: string | null;
  leadCount: number;
}

interface Campaign {
  id: string;
  name: string;
  createdAt: string;
  pieces: Piece[];
  totals: { pieces: number; scans: number; leads: number };
}

interface Draft {
  id: string | null;
  kind: PieceKind;
  title: string;
  headline: string;
  body: string;
  cta: string;
}

const LIMITS = { title: 80, headline: 90, body: 600, cta: 60 };
const PUBLIC_BASE: string = (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined) || window.location.origin;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const draftFrom = (kind: PieceKind): Draft => ({ id: null, kind, ...STARTERS[kind] });
const errorMessage = (err: unknown) =>
  (err as { response?: { data?: { error?: string; details?: string[] } } })?.response?.data?.details?.join('; ') ||
  (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
  (err as Error)?.message ||
  'Something went wrong';

export default function MarketingStudio() {
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const canEditBrand = role === 'OWNER' || role === 'MANAGER';

  const brandQ = useQuery({ queryKey: ['marketing', 'brand'], queryFn: async () => (await api.get('/marketing/brand')).data.data as Brand });
  const campaignsQ = useQuery({
    queryKey: ['marketing', 'campaigns'],
    queryFn: async () => (await api.get('/marketing/campaigns')).data.data as Campaign[],
  });

  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [newCampaign, setNewCampaign] = useState('');
  const [colors, setColors] = useState<BrandColors | null>(null);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const campaigns = campaignsQ.data ?? [];
  const campaign = campaigns.find((c) => c.id === campaignId) ?? campaigns[0] ?? null;
  const savedPiece = campaign?.pieces.find((p) => p.id === draft?.id) ?? null;

  useEffect(() => {
    if (brandQ.data && !colors) setColors(brandQ.data.colors);
  }, [brandQ.data, colors]);

  useEffect(() => {
    let alive = true;
    const src = brandQ.data?.logoUrl;
    if (!src) return undefined;
    toDataUrl(resolveFileUrl(src)).then((d) => alive && setLogoDataUrl(d));
    return () => {
      alive = false;
    };
  }, [brandQ.data?.logoUrl]);

  const url = savedPiece ? scanUrl(savedPiece.code, PUBLIC_BASE) : null;
  const qr = useQrSvg(url);
  // Saved pieces print with the colors they were saved with; drafts use the live brand.
  const pieceColors: BrandColors | null = savedPiece?.design?.colors ?? colors;

  const invalidate = () => qc.invalidateQueries({ queryKey: ['marketing'] });

  const createCampaign = useMutation({
    mutationFn: async (name: string) => (await api.post('/marketing/campaigns', { name })).data.data as Campaign,
    onSuccess: (c) => {
      setNewCampaign('');
      setCampaignId(c.id);
      setDraft(draftFrom('DOOR_HANGER'));
      invalidate();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const deleteCampaign = useMutation({
    mutationFn: async (id: string) => api.delete(`/marketing/campaigns/${id}`),
    onSuccess: () => {
      setCampaignId(null);
      setDraft(null);
      invalidate();
      toast.success('Campaign deleted');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const savePiece = useMutation({
    mutationFn: async (d: Draft) => {
      const body = { kind: d.kind, title: d.title, headline: d.headline, body: d.body, cta: d.cta };
      const res = d.id
        ? await api.patch(`/marketing/pieces/${d.id}`, body)
        : await api.post(`/marketing/campaigns/${campaign!.id}/pieces`, body);
      return res.data.data as Piece;
    },
    onSuccess: (p) => {
      setDraft({ id: p.id, kind: p.kind, title: p.title, headline: p.headline, body: p.body, cta: p.cta });
      invalidate();
      toast.success(draft?.id ? 'Piece saved' : 'Piece saved: its QR code is ready');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const refreshBrand = useMutation({
    mutationFn: async (id: string) => api.patch(`/marketing/pieces/${id}`, { refreshBrand: true }),
    onSuccess: () => {
      invalidate();
      toast.success('Piece now uses the current brand colors');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const deletePiece = useMutation({
    mutationFn: async (id: string) => api.delete(`/marketing/pieces/${id}`),
    onSuccess: () => {
      setDraft(null);
      invalidate();
      toast.success('Piece deleted');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const saveBrand = useMutation({
    mutationFn: async (c: BrandColors) => (await api.put('/marketing/brand', { colors: c })).data.data.colors as BrandColors,
    onSuccess: (c) => {
      setColors(c);
      invalidate();
      toast.success('Brand colors saved for new pieces');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const leadsQ = useQuery({
    queryKey: ['marketing', 'pieceLeads', savedPiece?.id],
    enabled: Boolean(savedPiece && savedPiece.leadCount > 0),
    queryFn: async () =>
      (await api.get(`/marketing/pieces/${savedPiece!.id}/leads`)).data.data as Array<{
        id: string;
        firstName: string;
        lastName: string;
        propertyAddress: string;
        status: string;
        createdAt: string;
      }>,
  });

  const brand = brandQ.data;
  const layout = useMemo(
    () =>
      draft && brand && pieceColors
        ? layoutPiece(draft.kind, { ...draft, companyName: brand.companyName, phone: brand.phone }, pieceColors, Boolean(logoDataUrl))
        : null,
    [draft, brand, pieceColors, logoDataUrl],
  );
  const dirty =
    !!draft &&
    (!savedPiece ||
      (['kind', 'title', 'headline', 'body', 'cta'] as const).some((k) => savedPiece[k] !== draft[k]));
  const fileName = draft ? `${draft.title || 'piece'}-${savedPiece?.code ?? 'draft'}`.replace(/[^\w.-]+/g, '-') : 'piece';

  const runExport = async (fn: () => void | Promise<void>) => {
    try {
      await fn();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  if (brandQ.isLoading || campaignsQ.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-ink-soft">
        <Loader2 className="mr-2 animate-spin" size={18} /> Loading Marketing Studio…
      </div>
    );
  }
  if (brandQ.isError || campaignsQ.isError) {
    return <div className="p-6 text-oxblood">Could not load Marketing Studio: {errorMessage(brandQ.error || campaignsQ.error)}</div>;
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Megaphone size={22} /> Marketing Studio
          </h1>
          <p className="mt-1 max-w-2xl text-sm opacity-80">
            Yard signs, door hangers and flyers with your logo, your colors and a QR code. Every scan that becomes a lead is
            credited to the exact piece it came from. Pieces are drawn and exported on this device.
          </p>
        </div>
        {colors && (
          <div className="flex flex-wrap items-center gap-3 rounded border border-current/20 p-3 text-sm">
            <span className="font-medium">Brand colors</span>
            {(['primary', 'accent'] as const).map((k) => (
              <label key={k} className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={colors[k]}
                  disabled={!canEditBrand}
                  onChange={(e) => setColors({ ...colors, [k]: e.target.value.toUpperCase() })}
                  aria-label={k === 'primary' ? 'Main color' : 'Accent color'}
                  className="h-8 w-10 cursor-pointer disabled:cursor-not-allowed"
                />
                {k === 'primary' ? 'Main' : 'Accent'}
              </label>
            ))}
            {canEditBrand ? (
              <Button size="sm" variant="outline" onClick={() => saveBrand.mutate(colors)} disabled={saveBrand.isPending}>
                <Save size={14} className="mr-1" /> Save colors
              </Button>
            ) : (
              <span className="opacity-70">Owners and managers can change these.</span>
            )}
          </div>
        )}
      </header>

      {isLocalBase(PUBLIC_BASE) && (
        <div role="alert" className="flex items-start gap-2 rounded border border-oxblood/40 bg-oxblood/10 p-3 text-sm">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-oxblood" />
          <span>
            QR codes currently point at <code>{PUBLIC_BASE}</code>, which phones outside this computer cannot open. Set{' '}
            <code>VITE_PUBLIC_APP_URL</code> to your public address before printing anything.
          </span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Campaigns */}
        <aside className="space-y-3">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (newCampaign.trim()) createCampaign.mutate(newCampaign.trim());
            }}
          >
            <input
              value={newCampaign}
              onChange={(e) => setNewCampaign(e.target.value)}
              maxLength={80}
              placeholder="New campaign, e.g. McKinney hail 11/12"
              aria-label="New campaign name"
              className="min-w-0 flex-1 rounded border border-current/30 bg-transparent px-2 py-1.5 text-sm"
            />
            <Button size="sm" type="submit" disabled={!newCampaign.trim() || createCampaign.isPending} aria-label="Create campaign">
              <Plus size={14} />
            </Button>
          </form>
          {campaigns.length === 0 ? (
            <p className="text-sm opacity-70">No campaigns yet. Name one above, then add a door hanger or yard sign to it.</p>
          ) : (
            <ul className="space-y-1">
              {campaigns.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setCampaignId(c.id);
                      setDraft(null);
                    }}
                    className={`w-full rounded px-3 py-2 text-left text-sm ${c.id === campaign?.id ? 'bg-ink text-parchment' : 'hover:bg-current/10'}`}
                  >
                    <span className="block font-medium">{c.name}</span>
                    <span className="block text-xs opacity-80">
                      {plural(c.totals.pieces, 'piece')} · {plural(c.totals.scans, 'scan')} · {plural(c.totals.leads, 'lead')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* Campaign detail */}
        {campaign && (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">{campaign.name}</h2>
              <div className="flex flex-wrap gap-2">
                {KIND_ORDER.map((k) => (
                  <Button key={k} size="sm" variant="outline" onClick={() => setDraft(draftFrom(k))}>
                    <Plus size={14} className="mr-1" /> {KIND_SPECS[k].label.split(' · ')[0]}
                  </Button>
                ))}
                {campaign.totals.leads === 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (window.confirm(`Delete campaign "${campaign.name}" and its pieces?`)) deleteCampaign.mutate(campaign.id);
                    }}
                    aria-label="Delete campaign"
                  >
                    <Trash2 size={14} />
                  </Button>
                )}
              </div>
            </div>

            {campaign.pieces.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-current/20 text-left text-xs uppercase tracking-wide opacity-70">
                      <th className="py-2 pr-3">Piece</th>
                      <th className="py-2 pr-3">Type</th>
                      <th className="py-2 pr-3">Code</th>
                      <th className="py-2 pr-3 text-right">Scans</th>
                      <th className="py-2 text-right">Leads</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaign.pieces.map((p) => (
                      <tr
                        key={p.id}
                        onClick={() => setDraft({ id: p.id, kind: p.kind, title: p.title, headline: p.headline, body: p.body, cta: p.cta })}
                        className={`cursor-pointer border-b border-current/10 ${p.id === draft?.id ? 'bg-current/10' : 'hover:bg-current/5'}`}
                      >
                        <td className="py-2 pr-3 font-medium">{p.title}</td>
                        <td className="py-2 pr-3">{KIND_SPECS[p.kind].label.split(' · ')[0]}</td>
                        <td className="py-2 pr-3 font-mono text-xs">{p.code}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{p.scanCount}</td>
                        <td className="py-2 text-right tabular-nums">{p.leadCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!draft && campaign.pieces.length === 0 && (
              <p className="text-sm opacity-70">Pick a piece type above to start from ready-made storm-response copy.</p>
            )}

            {draft && brand && pieceColors && layout && (
              <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                {/* Editor */}
                <form
                  className="space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    savePiece.mutate(draft);
                  }}
                >
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium">Type</span>
                    <select
                      value={draft.kind}
                      onChange={(e) => setDraft({ ...draft, kind: e.target.value as PieceKind })}
                      className="w-full rounded border border-current/30 bg-transparent px-2 py-1.5"
                    >
                      {KIND_ORDER.map((k) => (
                        <option key={k} value={k}>
                          {KIND_SPECS[k].label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {(['title', 'headline', 'body', 'cta'] as const).map((field) => {
                    const label = { title: 'Internal name', headline: 'Headline', body: 'Body', cta: 'Call to action' }[field];
                    const value = draft[field];
                    const Tag = field === 'body' ? 'textarea' : 'input';
                    return (
                      <label key={field} className="block text-sm">
                        <span className="mb-1 flex justify-between font-medium">
                          {label}
                          <span className={`text-xs ${value.length > LIMITS[field] ? 'text-oxblood' : 'opacity-60'}`}>
                            {value.length}/{LIMITS[field]}
                          </span>
                        </span>
                        <Tag
                          value={value}
                          onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                            setDraft({ ...draft, [field]: e.target.value })
                          }
                          maxLength={LIMITS[field]}
                          rows={field === 'body' ? 4 : undefined}
                          className="w-full rounded border border-current/30 bg-transparent px-2 py-1.5"
                        />
                        {field === 'title' && <span className="mt-0.5 block text-xs opacity-60">Only your team sees this.</span>}
                      </label>
                    );
                  })}

                  {layout.overflow.length > 0 && (
                    <p className="text-xs text-oxblood">
                      Too long to fit: {layout.overflow.join(', ')}. The preview shows where it gets cut off.
                    </p>
                  )}
                  {layout.warnings.map((w) => (
                    <p key={w} className="text-xs text-oxblood">
                      {w}
                    </p>
                  ))}

                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button type="submit" disabled={!dirty || savePiece.isPending}>
                      <Save size={14} className="mr-1" /> {draft.id ? 'Save changes' : 'Save and create QR'}
                    </Button>
                    {savedPiece && savedPiece.leadCount === 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          if (window.confirm('Delete this piece? Any copies already printed will stop working.')) deletePiece.mutate(savedPiece.id);
                        }}
                      >
                        <Trash2 size={14} className="mr-1" /> Delete
                      </Button>
                    )}
                  </div>

                  {savedPiece && (
                    <div className="space-y-2 rounded border border-current/20 p-3 text-sm">
                      <p className="flex items-center gap-1.5 font-medium">
                        <QrCode size={14} /> Scan link
                      </p>
                      <p className="break-all font-mono text-xs">{url}</p>
                      <p className="text-xs opacity-70">
                        This code never changes, so printed copies keep working after you edit the text. {plural(savedPiece.scanCount, 'scan')}
                        {savedPiece.lastScanAt ? `, last ${new Date(savedPiece.lastScanAt).toLocaleString()}` : ''}.
                      </p>
                      {colors && savedPiece.design?.colors &&
                        (savedPiece.design.colors.primary !== colors.primary || savedPiece.design.colors.accent !== colors.accent) && (
                          <Button type="button" size="sm" variant="outline" onClick={() => refreshBrand.mutate(savedPiece.id)}>
                            Use current brand colors
                          </Button>
                        )}
                    </div>
                  )}

                  {savedPiece && savedPiece.leadCount > 0 && (
                    <div className="space-y-1 text-sm">
                      <p className="font-medium">Leads from this piece</p>
                      <ul className="space-y-1">
                        {(leadsQ.data ?? []).map((l) => (
                          <li key={l.id}>
                            <Link to={`/leads/${l.id}`} className="underline">
                              {l.firstName} {l.lastName}
                            </Link>{' '}
                            <span className="opacity-70">· {l.propertyAddress} · {l.status.replace(/_/g, ' ').toLowerCase()}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </form>

                {/* Preview + export */}
                <div className="space-y-3">
                  <div className="flex max-h-[70vh] items-center justify-center overflow-hidden rounded border border-current/20 bg-current/5 p-4">
                    <PieceSvg
                      ref={svgRef}
                      kind={draft.kind}
                      content={{ ...draft, companyName: brand.companyName, phone: brand.phone }}
                      colors={pieceColors}
                      qr={qr}
                      logoDataUrl={logoDataUrl}
                      className="h-auto max-h-[64vh] w-auto max-w-full shadow"
                    />
                  </div>
                  {!savedPiece ? (
                    <p className="text-sm opacity-70">Save the piece to create its QR code. The grey square is a placeholder.</p>
                  ) : dirty ? (
                    <p className="text-sm opacity-70">Save your changes before exporting, so the printed copy matches the record.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" onClick={() => runExport(() => printPiece(svgRef.current!, draft.title))}>
                        <Printer size={14} className="mr-1" /> Print or save PDF
                      </Button>
                      <Button variant="outline" onClick={() => runExport(() => downloadPng(svgRef.current!, fileName))}>
                        <FileImage size={14} className="mr-1" /> PNG (150 dpi)
                      </Button>
                      <Button variant="outline" onClick={() => runExport(() => downloadSvg(svgRef.current!, fileName))}>
                        <Download size={14} className="mr-1" /> SVG for print shops
                      </Button>
                    </div>
                  )}
                  {!brand.logoUrl && (
                    <p className="text-xs opacity-70">
                      No logo on file. Add one in <Link to="/settings/company" className="underline">Settings → Company</Link>.
                    </p>
                  )}
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
