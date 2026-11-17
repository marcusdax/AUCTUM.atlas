import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { startOnboarding } from '../components/onboarding';

const navItems = [
  { to: '/settings/company', label: 'Company' },
  { to: '/settings/users', label: 'Users' },
  { to: '/settings/integrations', label: 'Integrations' },
  { to: '/settings/ai', label: 'AI Gateway' },
];

const navClass = ({ isActive }: { isActive: boolean }) =>
  [
    'block rounded-sm px-3 py-2 text-[0.8125rem] font-medium transition-colors',
    isActive
      ? 'bg-primary text-[hsl(var(--primary-foreground))]'
      : 'text-text-secondary hover:bg-[hsl(var(--background-accent))] hover:text-text-primary',
  ].join(' ');

const Settings: React.FC = () => {
  return (
    <div>
      <div className="mb-6 border-b border-[hsl(var(--border))] pb-5">
        <p className="eyebrow">Workspace configuration</p>
        <h1 className="mt-1 text-[2rem] font-medium leading-tight text-text-primary">Settings</h1>
        <p className="mt-1 text-[0.875rem] text-text-secondary">
          Company preferences, people, integrations and the ATLAS AI gateway.
        </p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <nav aria-label="Settings sections" className="w-full lg:w-60">
          <div className="space-y-1 border border-[hsl(var(--border))] bg-[hsl(var(--background-card))] p-2">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={navClass}>
                {item.label}
              </NavLink>
            ))}
          </div>

          <p className="mt-3 px-1 font-mono text-[0.5625rem] uppercase tracking-[0.16em] text-text-tertiary">
            Authenticated workspace · tenant isolated
          </p>
        </nav>

        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>

      {/* Onboarding is replayable from Settings for every role */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border border-[hsl(var(--border))] bg-[hsl(var(--background-card))] px-4 py-3.5">
        <div>
          <p className="font-mono text-[0.5625rem] uppercase tracking-[0.16em] text-text-tertiary">
            Product tour
          </p>
          <p className="mt-1 text-[0.8125rem] text-text-secondary">
            Replay the guided walkthrough for your role at any time.
          </p>
        </div>
        <button
          type="button"
          onClick={() => startOnboarding()}
          className="inline-flex min-h-11 items-center gap-2 rounded-sm border border-[hsl(var(--border-hover))] bg-transparent px-4 py-2 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-text-secondary transition-colors hover:border-[hsl(var(--primary))] hover:bg-[hsl(var(--background-accent))] hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:ring-offset-2 focus:ring-offset-[hsl(var(--background))]"
        >
          <Compass size={14} aria-hidden="true" />
          Replay onboarding
        </button>
      </div>
    </div>
  );
};

export default Settings;
