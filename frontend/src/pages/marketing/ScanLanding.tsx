/**
 * Public scan landing (/m/:code) — where a printed QR code leads. No sign-in.
 *
 * Shows the company's own branding and the piece's headline, and lets the
 * homeowner ask to be contacted. The request becomes a lead credited to the
 * printed piece. Talks to /api/v1/public/m/:code with plain fetch so no staff
 * session or auth redirect ever applies here.
 */
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { resolveFileUrl } from '../../services/api';
import { textOn } from './templates';

interface PublicPiece {
  code: string;
  headline: string;
  cta: string;
  companyName: string;
  phone: string | null;
  logoUrl: string | null;
  colors: { primary: string; accent: string };
}

type Status = 'loading' | 'missing' | 'ready' | 'sending' | 'sent' | 'error';

export default function ScanLanding() {
  const { code = '' } = useParams<{ code: string }>();
  const [piece, setPiece] = useState<PublicPiece | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [errors, setErrors] = useState<string[]>([]);
  const [form, setForm] = useState({ name: '', phone: '', email: '', propertyAddress: '', message: '', consent: false, website: '' });

  useEffect(() => {
    let alive = true;
    fetch(`/api/v1/public/m/${encodeURIComponent(code)}`)
      .then(async (r) => {
        if (!alive) return;
        if (!r.ok) return setStatus('missing');
        setPiece((await r.json()).data);
        setStatus('ready');
      })
      .catch(() => alive && setStatus('missing'));
    return () => {
      alive = false;
    };
  }, [code]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    setErrors([]);
    try {
      const r = await fetch(`/api/v1/public/m/${encodeURIComponent(code)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const body = await r.json().catch(() => ({}));
      if (r.ok) return setStatus('sent');
      setErrors(body.details ?? [body.error ?? 'Something went wrong. Please call us instead.']);
      setStatus('ready');
    } catch {
      setErrors(['Could not send. Check your connection, or call us instead.']);
      setStatus('ready');
    }
  };

  if (status === 'loading') return <main className="flex min-h-screen items-center justify-center bg-parchment text-ink">Loading…</main>;
  if (status === 'missing' || !piece) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-parchment p-6 text-center text-ink">
        <div>
          <h1 className="text-xl font-semibold">This code is not active</h1>
          <p className="mt-2 opacity-80">Check the code on the sign, or contact the company directly.</p>
        </div>
      </main>
    );
  }

  const fg = textOn(piece.colors.primary);
  const accentFg = textOn(piece.colors.accent);
  const field = 'w-full rounded border border-ink/30 bg-white px-3 py-2.5 text-base text-ink';

  return (
    <main className="min-h-screen bg-parchment text-ink">
      <header style={{ background: piece.colors.primary, color: fg }} className="px-5 pb-8 pt-6">
        <div className="mx-auto max-w-md">
          <div className="flex items-center gap-3">
            {piece.logoUrl && <img src={resolveFileUrl(piece.logoUrl)} alt="" className="h-12 w-12 rounded bg-white object-contain p-1" />}
            <p style={{ color: fg }} className="text-lg font-semibold">
              {piece.companyName}
            </p>
          </div>
          {/* Explicit color: the global h1 rule would otherwise paint ink on the brand background. */}
          <h1 style={{ color: fg }} className="mt-6 text-3xl font-extrabold leading-tight">
            {piece.headline}
          </h1>
          {piece.cta && <p className="mt-2 text-lg opacity-90">{piece.cta}</p>}
          {piece.phone && (
            <a
              href={`tel:${piece.phone.replace(/[^\d+]/g, '')}`}
              style={{ background: piece.colors.accent, color: accentFg }}
              className="mt-5 inline-block rounded px-4 py-3 text-lg font-bold"
            >
              Call {piece.phone}
            </a>
          )}
        </div>
      </header>

      <section className="mx-auto max-w-md px-5 py-6">
        {status === 'sent' ? (
          <div role="status" className="rounded border border-ink/20 bg-white p-5">
            <h2 className="text-xl font-semibold">Thanks, we have your request</h2>
            <p className="mt-2">
              {piece.companyName} will contact you soon{piece.phone ? `. If it is urgent, call ${piece.phone}` : ''}.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4" noValidate>
            <h2 className="text-xl font-semibold">Request a free inspection</h2>
            <label className="block">
              <span className="mb-1 block font-medium">Your name</span>
              <input className={field} autoComplete="name" required maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1 block font-medium">Property address</span>
              <input
                className={field}
                autoComplete="street-address"
                required
                maxLength={200}
                value={form.propertyAddress}
                onChange={(e) => setForm({ ...form, propertyAddress: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="mb-1 block font-medium">Phone</span>
              <input className={field} type="tel" autoComplete="tel" maxLength={30} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1 block font-medium">Email</span>
              <input className={field} type="email" autoComplete="email" maxLength={254} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <span className="mt-1 block text-sm opacity-70">A phone number or an email is enough.</span>
            </label>
            <label className="block">
              <span className="mb-1 block font-medium">Anything we should know? (optional)</span>
              <textarea className={field} rows={3} maxLength={1000} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
            </label>
            {/* Honeypot: hidden from people, filled in by bots. */}
            <div aria-hidden="true" className="absolute left-[-10000px] top-auto h-px w-px overflow-hidden">
              <label>
                Website
                <input tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
              </label>
            </div>
            <label className="flex items-start gap-3">
              <input type="checkbox" className="mt-1 h-5 w-5" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} />
              <span>
                {piece.companyName} may contact me about this request by phone, text or email. I can ask them to stop at any time.
              </span>
            </label>
            {errors.length > 0 && (
              <ul role="alert" className="list-disc rounded border border-oxblood/40 bg-oxblood/10 p-3 pl-7 text-sm text-oxblood">
                {errors.map((er) => (
                  <li key={er}>{er}</li>
                ))}
              </ul>
            )}
            <button
              type="submit"
              disabled={status === 'sending'}
              style={{ background: piece.colors.primary, color: fg }}
              className="w-full rounded px-4 py-3 text-lg font-bold disabled:opacity-60"
            >
              {status === 'sending' ? 'Sending…' : 'Send request'}
            </button>
          </form>
        )}
        <p className="mt-6 text-center text-xs opacity-60">Code {piece.code}</p>
      </section>
    </main>
  );
}
