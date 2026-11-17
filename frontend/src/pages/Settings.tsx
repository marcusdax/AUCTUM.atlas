import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';

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
        </nav>
        <div className="flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default Settings;
