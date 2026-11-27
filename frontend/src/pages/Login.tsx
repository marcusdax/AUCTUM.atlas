import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../components/auth/AuthProvider';
import Button from '../components/ui/Button';
import { AlertCircle, Eye, EyeOff, Lock, LogIn, Mail, Sparkles, ShieldCheck } from 'lucide-react';

const inputClassName =
  'input rounded-sm bg-[hsl(var(--background-elevated))] pl-10 focus:border-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))]';

/** Demo workspace created by `npm run seed:demo`; safe to show on a demo deployment. */
const DEMO_EMAIL = 'demo@roofprocrm.com';
const DEMO_PASSWORD = 'RoofPro!2026';

const AuctumSeal: React.FC<{ size?: number }> = ({ size = 56 }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 120 120"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.2}
    role="img"
    aria-label="AUCTUM seal"
  >
    <circle cx="60" cy="60" r="56" strokeDasharray="4 5" opacity={0.55} />
    <circle cx="60" cy="60" r="44" strokeDasharray="2 4" opacity={0.8} />
    <g strokeLinecap="round" opacity={0.75}>
      <line x1="60" y1="38" x2="60" y2="82" />
      <line x1="38" y1="60" x2="82" y2="60" />
      <line x1="45" y1="45" x2="75" y2="75" strokeWidth={0.8} />
      <line x1="75" y1="45" x2="45" y2="75" strokeWidth={0.8} />
    </g>
    <path d="M60 30 L64 54 L60 60 L56 54 Z" fill="currentColor" stroke="none" />
    <path d="M60 90 L56 66 L60 60 L64 66 Z" stroke="currentColor" fill="none" />
    <circle cx="60" cy="60" r="4" />
  </svg>
);

const Login: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const extractError = (err: unknown): string => {
    if (err && typeof err === 'object') {
      const e = err as {
        response?: { data?: { message?: string; error?: string } };
        message?: string;
      };
      return (
        e.response?.data?.error ??
        e.response?.data?.message ??
        e.message ??
        'Invalid email or password.'
      );
    }
    return 'Invalid email or password.';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError('');
    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const enterDemoWorkspace = async () => {
    if (isSubmitting) return;
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    setError('');
    setIsSubmitting(true);
    try {
      await login(DEMO_EMAIL, DEMO_PASSWORD);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--background))] px-4 py-10">
      <div className="w-full max-w-[440px]">
        {/* Brand lockup */}
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="brand-seal h-[76px] w-[76px] text-[hsl(var(--text-primary))]">
            <AuctumSeal size={68} />
          </span>
          <p className="eyebrow mt-5">Verified, from origin</p>
          <h1 className="wordmark mt-2 text-[2.4rem] text-text-primary">AUCTUM</h1>
          <p className="mt-2 font-mono text-[0.625rem] uppercase tracking-[0.24em] text-text-tertiary">
            Atlas · Storm Intelligence CRM
          </p>
        </div>

        <div className="border border-[hsl(var(--border))] bg-[hsl(var(--background-card))] p-7 sm:p-8">
          <div className="border-b border-[hsl(var(--border))] pb-4">
            <h2 className="font-display text-[1.5rem] font-medium leading-tight text-text-primary">
              Sign in to the estate
            </h2>
            <p className="mt-1 text-[0.8125rem] text-text-secondary">
              One ledger for storms, jobs and receipts.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            {error && (
              <div className="flex items-start gap-2 border-l-2 border-[hsl(var(--red))] bg-[hsl(var(--red))]/[0.06] px-3 py-2 text-[0.8125rem] text-[hsl(var(--red))]">
                <AlertCircle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span role="alert">{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label
                htmlFor="login-email"
                className="block font-mono text-[0.625rem] font-medium uppercase tracking-[0.14em] text-text-tertiary"
              >
                Email
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
                  aria-hidden="true"
                />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  className={inputClassName}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="login-password"
                className="block font-mono text-[0.625rem] font-medium uppercase tracking-[0.14em] text-text-tertiary"
              >
                Password
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
                  aria-hidden="true"
                />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="input rounded-sm bg-[hsl(var(--background-elevated))] pl-10 pr-10 focus:border-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))]"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                  required
                  minLength={1}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={isSubmitting}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-text-tertiary transition-colors hover:bg-[hsl(var(--background-accent))] hover:text-text-primary"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isSubmitting}
              leftIcon={<LogIn size={16} />}
              className="w-full rounded-sm bg-primary font-medium tracking-[0.02em] text-[hsl(var(--primary-foreground))] hover:bg-primary-hover"
            >
              Sign in
            </Button>
          </form>

          <div className="mt-6 border-t border-[hsl(var(--border))] pt-5">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={enterDemoWorkspace}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-sm border border-[hsl(var(--border-hover))] bg-transparent px-4 py-2 font-mono text-[0.625rem] uppercase tracking-[0.16em] text-text-secondary transition-colors hover:border-[hsl(var(--primary))] hover:bg-[hsl(var(--background-accent))] hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:ring-offset-2 focus:ring-offset-[hsl(var(--background))] disabled:opacity-60"
            >
              <Sparkles size={14} aria-hidden="true" />
              {isSubmitting ? 'Entering demo ledger…' : 'Enter the demo ledger'}
            </button>
            <p className="mt-3 text-center font-mono text-[0.625rem] tracking-[0.04em] text-text-tertiary">
              demo@roofprocrm.com · RoofPro!2026
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col items-center gap-3 text-center">
          <p className="text-[0.8125rem] text-text-secondary">
            Reviewing with a partner?{' '}
            <Link
              to="/portal"
              className="font-medium text-[hsl(var(--primary))] underline underline-offset-4"
            >
              Open Partner Portal (Field Hub &times; AUCTUM.atlas)
            </Link>
          </p>
          <p className="text-[0.8125rem] text-text-secondary">
            No workspace yet?{' '}
            <Link
              to="/register"
              className="font-medium text-[hsl(var(--red))] underline decoration-[hsl(var(--red))]/40 underline-offset-4 transition-colors hover:decoration-[hsl(var(--red))]"
            >
              Create an account
            </Link>
          </p>
          <p className="flex items-center gap-1.5 font-mono text-[0.5625rem] uppercase tracking-[0.18em] text-text-tertiary">
            <ShieldCheck size={11} aria-hidden="true" />
            Encrypted sessions · tenant-isolated ledger
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
