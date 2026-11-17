import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../components/auth/AuthProvider';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { AlertCircle, Eye, EyeOff, Lock, LogIn, Mail } from 'lucide-react';

const inputClassName =
  'input pl-10 focus:border-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))]/30';

const Login: React.FC = () => {
  const { login } = useAuth();
const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);

  const extractError = (err: unknown): string => {
    if (err && typeof err === 'object') {
      const e = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      return e.response?.data?.message ?? e.message ?? 'Invalid email or password.';
    }
    return 'Invalid email or password.';
  };

  // Admin credentials for testing
  const ADMIN_EMAIL = 'admin@roofpro.com';
  const ADMIN_PASSWORD = 'admin@123';

  useEffect(() => {
    // Auto-populate with admin credentials for testing
    setEmail(ADMIN_EMAIL);
    setPassword(ADMIN_PASSWORD);
    setIsAdminMode(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError('');
    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(extractError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--background))] p-4">
      <Card className="w-full max-w-md border-[hsl(var(--border))] shadow-xl">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--primary))]/10 ring-1 ring-[hsl(var(--primary))]/20">
            <LogIn size={26} className="text-[hsl(var(--primary))]" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-[hsl(var(--text-primary))]">
            Welcome to RoofPro CRM
          </h1>
          <p className="mt-1 text-sm text-[hsl(var(--text-secondary))]">
            Sign in to your account to continue.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-[hsl(var(--red))]/10 px-3 py-2 text-sm text-[hsl(var(--red))]">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          
          {isAdminMode && (
            <div className="flex items-center gap-2 rounded-lg bg-[hsl(var(--green))]/10 px-3 py-2 text-sm text-[hsl(var(--green))]">
              <EyeOff size={16} className="mr-1" />
              <span>Admin mode: credentials auto-populated (admin@roofpro.com / admin@123)</span>
            </div>
          )}

          <div className="space-y-1">
            <label
              htmlFor="login-email"
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

          <div className="space-y-1">
            <label
              htmlFor="login-password"
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
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                className="input pl-10 pr-10 focus:border-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))]/30"
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
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[hsl(var(--text-tertiary))] hover:bg-[hsl(var(--background-elevated))] hover:text-[hsl(var(--text-primary))]"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isSubmitting}
            leftIcon={<LogIn size={18} />}
            className="w-full bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary-hover))] focus:ring-[hsl(var(--primary))] focus:ring-offset-[hsl(var(--background))]"
          >
            Sign In
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-[hsl(var(--text-secondary))]">
          Don't have an account?{' '}
          <Link
            to="/register"
            className="font-medium text-[hsl(var(--primary))] hover:underline"
          >
            Create an account
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default Login;
