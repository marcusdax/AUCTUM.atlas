import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { startOnboarding } from '../components/onboarding';

const Settings: React.FC = () => {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-text-secondary">Configure your company preferences, users, and integrations.</p>
      </div>
      <div className="flex gap-6">
        <nav className="w-64 space-y-1">
          <NavLink to="/settings/company" className="block rounded-lg px-3 py-2 text-sm font-medium text-text-secondary hover:bg-[hsl(var(--background-accent))] hover:text-text-primary">
            Company
          </NavLink>
          <NavLink to="/settings/users" className="block rounded-lg px-3 py-2 text-sm font-medium text-text-secondary hover:bg-[hsl(var(--background-accent))] hover:text-text-primary">
            Users
          </NavLink>
          <NavLink to="/settings/integrations" className="block rounded-lg px-3 py-2 text-sm font-medium text-text-secondary hover:bg-[hsl(var(--background-accent))] hover:text-text-primary">
            Integrations
          </NavLink>
          <NavLink to="/settings/ai" className="block rounded-lg px-3 py-2 text-sm font-medium text-text-secondary hover:bg-[hsl(var(--background-accent))] hover:text-text-primary">
            AI Gateway
          </NavLink>
        </nav>
        <div className="flex-1">
          <Outlet />
        </div>
      </div>

      {/* Onboarding is replayable from Settings for every role */}
      <div className="mt-8 flex items-center justify-between rounded-lg border border-border bg-background-card px-4 py-3">
        <div>
          <p className="text-sm font-medium text-text-primary">Product tour</p>
          <p className="text-xs text-text-tertiary">
            Replay the guided walkthrough for your role at any time.
          </p>
        </div>
        <button
          type="button"
          onClick={() => startOnboarding()}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-[hsl(var(--background-accent))] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
        >
          <Compass size={16} aria-hidden="true" />
          Replay onboarding
        </button>
      </div>
    </div>
  );
};

export default Settings;
