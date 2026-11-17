import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../components/auth/AuthProvider';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { RegisterData } from '../types';
import {
  AlertCircle,
  Building,
  CheckCircle2,
  Circle,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Phone,
  User,
  UserPlus,
} from 'lucide-react';

const inputClassName =
  'input pl-10 focus:border-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))]/30';

const STRENGTH_CRITERIA: Array<{
  label: string;
  test: (password: string) => boolean;
}> = [
  { label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { label: 'Includes an uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { label: 'Includes a lowercase letter', test: (p) => /[a-z]/.test(p) },
  { label: 'Includes a number', test: (p) => /\d/.test(p) },
  { label: 'Includes a special character', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

const getStrengthScore = (password: string): number =>
  STRENGTH_CRITERIA.filter((c) => c.test(password)).length;

const strengthLabel = (score: number, hasPassword: boolean): string => {
  if (!hasPassword) return '';
  if (score === 5) return 'Strong';
  if (score >= 4) return 'Good';
  if (score >= 3) return 'Moderate';
  if (score >= 2) return 'Fair';
  return 'Weak';
};

const strengthColor = (score: number): string => {
  if (score >= 4) return 'hsl(var(--emerald))';
  if (score >= 2) return 'hsl(var(--amber))';
  if (score >= 1) return 'hsl(var(--red))';
  return 'hsl(var(--border))';
};

const Register: React.FC = () => {
  const { register } = useAuth();
  const [formData, setFormData] = useState<RegisterData>({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    companyName: '',
    phone: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const extractError = (err: unknown): string => {
    if (err && typeof err === 'object') {
      const e = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      return (
        e.response?.data?.message ?? e.message ?? 'Unable to create your account.'
      );
    }
    return 'Unable to create your account.';
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError('');
    setIsSubmitting(true);
    try {
      const payload: RegisterData = {
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        companyName: formData.companyName,
        ...(formData.phone ? { phone: formData.phone } : {}),
      };
      await register(payload);
      // register() navigates to "/" on success
    } catch (err) {
      setError(extractError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const strengthScore = getStrengthScore(formData.password);
  const strengthPct = Math.round((strengthScore / 5) * 100);
  const hasPassword = formData.password.length > 0;

  const isFormValid = () =>
    formData.email &&
    formData.firstName &&
    formData.lastName &&
    formData.companyName &&
    getStrengthScore(formData.password) === 5;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--background))] p-4 py-10">
      <Card className="w-full max-w-lg rounded-sm border-[hsl(var(--border))] shadow-none">
        <div className="flex flex-col items-center text-center">
          <span className="brand-seal h-16 w-16 text-[hsl(var(--text-primary))]">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 120 120"
              width="58"
              height="58"
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
          </span>
          <p className="eyebrow mt-4">Open a workspace</p>
          <h1 className="wordmark mt-1.5 text-[1.9rem] text-[hsl(var(--text-primary))]">
            AUCTUM
          </h1>
          <p className="mt-2 font-mono text-[0.625rem] uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">
            Atlas · Storm Intelligence CRM
          </p>
          <p className="mt-4 border-t border-[hsl(var(--border))] pt-4 text-[0.8125rem] text-[hsl(var(--text-secondary))]">
            Create your company profile and start the ledger in under a minute.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="auctum-form mt-6 space-y-5">
          {error && (
            <div className="flex items-start gap-2 border-l-2 border-[hsl(var(--red))] bg-[hsl(var(--red))]/[0.06] px-3 py-2 text-sm text-[hsl(var(--red))]">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="space-y-1">
              <label
                htmlFor="register-firstName"
                className="block text-sm font-medium text-[hsl(var(--text-secondary))]"
              >
                First Name
              </label>
              <div className="relative">
                <User
                  size={18}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--text-tertiary))]"
                />
                <input
                  id="register-firstName"
                  name="firstName"
                  type="text"
                  autoComplete="given-name"
                  placeholder="Jane"
                  className="input pl-10 focus:border-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))]/30"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="register-lastName"
                className="block text-sm font-medium text-[hsl(var(--text-secondary))]"
              >
                Last Name
              </label>
              <div className="relative">
                <User
                  size={18}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--text-tertiary))]"
                />
                <input
                  id="register-lastName"
                  name="lastName"
                  type="text"
                  autoComplete="family-name"
                  placeholder="Doe"
                  className="input pl-10 focus:border-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))]/30"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                  required
                />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="register-email"
              className="block text-sm font-medium text-[hsl(var(--text-secondary))]"
            >
              Email
            </label>
            <div className="relative">
              <Mail
                size={18}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--text-tertiary))]"
              />
              <input
                id="register-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                className={inputClassName}
                value={formData.email}
                onChange={handleInputChange}
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="register-companyName"
              className="block text-sm font-medium text-[hsl(var(--text-secondary))]"
            >
              Company Name
            </label>
            <div className="relative">
              <Building
                size={18}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--text-tertiary))]"
              />
              <input
                id="register-companyName"
                name="companyName"
                type="text"
                autoComplete="organization"
                placeholder="Acme Roofing LLC"
                className={inputClassName}
                value={formData.companyName}
                onChange={handleInputChange}
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="register-phone"
              className="flex items-baseline justify-between"
            >
              <span className="block text-sm font-medium text-[hsl(var(--text-secondary))]">
                Phone
              </span>
              <span className="text-xs text-[hsl(var(--text-tertiary))]">(optional)</span>
            </label>
            <div className="relative">
              <Phone
                size={18}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--text-tertiary))]"
              />
              <input
                id="register-phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                placeholder="(555) 123-4567"
                className={inputClassName}
                value={formData.phone}
                onChange={handleInputChange}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="register-password"
              className="block text-sm font-medium text-[hsl(var(--text-secondary))]"
            >
              Password
            </label>
            <div className="relative">
              <Lock
                size={18}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--text-tertiary))]"
              />
              <input
                id="register-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="••••••••"
                className="input pl-10 pr-10 focus:border-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))]/30"
                value={formData.password}
                onChange={handleInputChange}
                disabled={isSubmitting}
                required
                minLength={8}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((v) => !v)}
                disabled={isSubmitting}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[hsl(var(--text-tertiary))] hover:bg-[hsl(var(--background-elevated))] hover:text-[hsl(var(--text-primary))]"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Password strength indicator */}
            <div className="pt-2">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-[hsl(var(--text-tertiary))]">
                  Password strength
                </span>
                {hasPassword && (
                  <span
                    className="font-medium"
                    style={{ color: strengthColor(strengthScore) }}
                  >
                    {strengthLabel(strengthScore, hasPassword)}
                  </span>
                )}
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[hsl(var(--background-elevated))]">
                <div
                  className="h-full transition-all duration-300"
                  style={{
                    width: `${strengthPct}%`,
                    backgroundColor: strengthColor(strengthScore),
                  }}
                />
              </div>
              {hasPassword && (
                <ul className="mt-2 space-y-1 text-xs">
                  {STRENGTH_CRITERIA.map((criterion) => {
                    const met = criterion.test(formData.password);
                    return (
                      <li key={criterion.label} className="flex items-center gap-1.5">
                        {met ? (
                          <CheckCircle2
                            size={14}
                            className="text-[hsl(var(--emerald))]"
                          />
                        ) : (
                          <Circle
                            size={14}
                            className="text-[hsl(var(--text-tertiary))]"
                          />
                        )}
                        <span
                          className={
                            met ? 'text-[hsl(var(--emerald))]' : 'text-[hsl(var(--text-tertiary))]'
                          }
                        >
                          {criterion.label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isSubmitting}
            leftIcon={<UserPlus size={18} />}
            disabled={!isFormValid() && !isSubmitting}
            className="w-full rounded-sm bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary-hover))] focus:ring-[hsl(var(--primary))] focus:ring-offset-[hsl(var(--background))]"
          >
            Create workspace
          </Button>
        </form>

        <div className="mt-6 border-t border-[hsl(var(--border))] pt-5 text-center text-[0.8125rem] text-[hsl(var(--text-secondary))]">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-medium text-[hsl(var(--red))] underline decoration-[hsl(var(--red))]/40 underline-offset-4 hover:decoration-[hsl(var(--red))]"
          >
            Sign in
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default Register;
