import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuthStore, hasRole } from '../stores/authStore';
import { OfflineBanner, InstallPrompt } from '../pwa';
import { OnboardingTour } from './onboarding';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Calculator,
  Calendar,
  FileText,
  Shield,
  Settings,
  BarChart3,
  Map,
  Menu,
  Bell,
  Search,
  LogOut,
  Sun,
  Moon,
  AlertTriangle,
  ChevronDown,
  Radio,
  Brain,
  Satellite,
  Cpu,
  Zap,
  Activity,
  Layers,
  Command,
} from 'lucide-react';

const Sidebar: React.FC<{ collapsed: boolean; onToggle: () => void }> = ({ collapsed, onToggle }) => {
  const { user, logout } = useAuthStore();
  const location = useLocation();

  const navItems: Array<{
    name: string;
    icon: React.ReactNode;
    path: string;
    adminOnly?: boolean;
    section?: string;
  }> = [
    // Command Center Section
    { name: 'Command Center', icon: <Radio size={20} />, path: '/command', adminOnly: false, section: 'COMMAND' },
    
    // Atlas Intelligence Section
    { name: 'Atlas Intelligence', icon: <Satellite size={20} />, path: '/intelligence/atlas', adminOnly: false, section: 'ATLAS' },
    { name: 'Helios Intelligence', icon: <Zap size={20} />, path: '/intelligence/helios', adminOnly: false, section: 'HELIOS' },
    { name: 'Intelligence', icon: <Brain size={20} />, path: '/intelligence', adminOnly: false, section: 'INTELLIGENCE' },
    { name: 'System', icon: <Cpu size={20} />, path: '/intelligence/system', adminOnly: false, section: 'SYSTEM' },
    
    // Core CRM Section
    { name: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '/dashboard', adminOnly: false, section: 'CRM' },
    { name: 'Leads', icon: <Users size={20} />, path: '/leads', adminOnly: false, section: 'CRM' },
    { name: 'Jobs', icon: <Briefcase size={20} />, path: '/jobs', adminOnly: false, section: 'CRM' },
    { name: 'Estimates', icon: <Calculator size={20} />, path: '/estimates', adminOnly: false, section: 'CRM' },
    { name: 'Calendar', icon: <Calendar size={20} />, path: '/calendar', adminOnly: false, section: 'CRM' },
    { name: 'Storm Tracking', icon: <Map size={20} />, path: '/storm-tracking', adminOnly: false, section: 'CRM' },
    { name: 'Documents', icon: <FileText size={20} />, path: '/documents', adminOnly: false, section: 'CRM' },
    { name: 'Reports', icon: <BarChart3 size={20} />, path: '/reports', adminOnly: false, section: 'CRM' },
    { name: 'Settings', icon: <Settings size={20} />, path: '/settings', adminOnly: false, section: 'CRM' },
  ];

  const isActivePath = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-border transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-64'
      } bg-[hsl(var(--background-elevated))]`}
    >
      <div className="flex h-16 items-center justify-between px-4 border-b border-border">
        {!collapsed && <span className="text-xl font-bold text-primary">RoofPro</span>}
        <button
          onClick={onToggle}
          className="rounded-lg p-1 text-text-secondary hover:bg-[hsl(var(--background-accent))] hover:text-text-primary"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Menu size={20} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        <ul className="space-y-1 px-2">
          {(() => {
            const sections = [...new Set(navItems.map(item => item.section).filter(Boolean))];
            return sections.map((section) => (
              <React.Fragment key={section}>
                {!collapsed && (
                  <li className="px-3 py-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-text-tertiary opacity-60">
                      {section}
                    </span>
                  </li>
                )}
                {navItems
                  .filter((item) => item.section === section)
                  .map((item) => {
                    if (item.adminOnly && !hasRole(['OWNER', 'MANAGER'])) return null;
                    const active = isActivePath(item.path);
                    return (
                      <li key={item.path}>
                        <NavLink
                          to={item.path}
                          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                            collapsed ? 'justify-center' : ''
                          } ${
                            active
                              ? 'bg-primary text-white shadow-md'
                              : 'text-text-secondary hover:bg-[hsl(var(--background-accent))] hover:text-text-primary'
                          }`}
                          title={item.name}
                        >
                          {item.icon}
                          {!collapsed && <span>{item.name}</span>}
                        </NavLink>
                      </li>
                    );
                  })}
              </React.Fragment>
            ));
          })()}
        </ul>
      </nav>

      <div className="border-t border-border p-2">
        {!collapsed && user && (
          <div className="mb-2 flex items-center gap-3 rounded-lg bg-[hsl(var(--background-card))] p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white font-bold">
              {user.firstName?.[0]}
              {user.lastName?.[0]}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium text-text-primary">
                {user.firstName} {user.lastName}
              </p>
              <p className="truncate text-xs text-text-tertiary">{user.email}</p>
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                  user.role === 'OWNER' || user.role === 'MANAGER'
                    ? 'bg-purple/20 text-purple'
                    : 'bg-primary/20 text-primary'
                }`}
              >
                {user.role?.replace('_', ' ')}
              </span>
            </div>
          </div>
        )}
        <button
          onClick={logout}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-text-secondary transition-all hover:bg-red/10 hover:text-red ${
            collapsed ? 'justify-center' : ''
          }`}
          title="Logout"
        >
          <LogOut size={20} />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
};

const Header: React.FC<{ onSidebarToggle: () => void; sidebarCollapsed: boolean }> = ({
  onSidebarToggle,
  sidebarCollapsed,
}) => {
  const { user } = useAuthStore();
  const [theme, setTheme] = useState<'dark' | 'light'>(
    (localStorage.getItem('theme') as 'dark' | 'light') || 'dark'
  );

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-[hsl(var(--background-card))] px-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onSidebarToggle}
          className="rounded-lg p-2 text-text-secondary hover:bg-[hsl(var(--background-accent))] hover:text-text-primary md:hidden"
          aria-label="Toggle menu"
        >
          <Menu size={20} />
        </button>
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={18} />
          <input
            type="search"
            placeholder="Search leads, jobs, estimates..."
            className="w-80 rounded-lg border border-border bg-[hsl(var(--background))] pl-10 pr-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          className="rounded-lg p-2 text-text-secondary hover:bg-[hsl(var(--background-accent))] hover:text-text-primary"
          aria-label="Toggle theme"
          title="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <button
          className="relative rounded-lg p-2 text-text-secondary hover:bg-[hsl(var(--background-accent))] hover:text-text-primary"
          aria-label="Notifications"
          title="Notifications"
        >
          <Bell size={20} />
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red text-xs text-white">
            3
          </span>
        </button>

        {!sidebarCollapsed && user && (
          <div className="flex items-center gap-2 rounded-lg bg-[hsl(var(--background-accent))] px-3 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white font-bold text-sm">
              {user.firstName?.[0]}
              {user.lastName?.[0]}
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-text-primary">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-xs text-text-tertiary">{user.company?.name}</p>
            </div>
            <ChevronDown size={16} className="text-text-tertiary" />
          </div>
        )}
      </div>
    </header>
  );
};

const Layout: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-[hsl(var(--background))]">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <div
        className={`flex flex-1 flex-col overflow-hidden transition-all duration-300 ${
          sidebarCollapsed ? 'md:ml-16' : 'md:ml-64'
        }`}
      >
        <Header
          onSidebarToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          sidebarCollapsed={sidebarCollapsed}
        />

        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="p-6">
            <Outlet />
          </div>
        </main>

        <footer className="border-t border-border bg-[hsl(var(--background-card))] px-4 py-2 text-center text-sm text-text-tertiary">
          <div className="flex items-center justify-center gap-2">
            <Shield size={14} />
            <span>RoofPro CRM • Storm Intelligence Platform • NOAA Data Integration</span>
          </div>
        </footer>
      </div>

      {/* PWA + adoption surfaces (self-contained, no props) */}
      <OfflineBanner />
      <InstallPrompt />
      <OnboardingTour />
    </div>
  );
};

export default Layout;
