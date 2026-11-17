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

/**
 * AUCTUM seal — circular hairline mark with a compass star, as used across the
 * AUCTUM estate. Drawn inline so it inherits the current theme colour.
 */
const AuctumSeal: React.FC<{ size?: number; className?: string }> = ({ size = 40, className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 120 120"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.2}
    className={className}
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

const BrandLockup: React.FC<{ collapsed: boolean }> = ({ collapsed }) => (
  <div className="flex items-center gap-3">
    <span className="brand-seal h-11 w-11 shrink-0 text-[hsl(var(--text-primary))]">
      <AuctumSeal size={38} />
    </span>
    {!collapsed && (
      <span className="flex flex-col leading-none">
        <span className="wordmark text-[1.35rem] text-text-primary">AUCTUM</span>
        <span className="mt-1 font-mono text-[0.5625rem] uppercase tracking-[0.22em] text-text-tertiary">
          Atlas · CRM
        </span>
      </span>
    )}
  </div>
);

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
    { name: 'Command Center', icon: <Radio size={18} />, path: '/command', adminOnly: false, section: 'Command' },

    // Atlas Intelligence Section
    { name: 'Atlas Intelligence', icon: <Satellite size={18} />, path: '/intelligence/atlas', adminOnly: false, section: 'Atlas' },
    { name: 'Helios Intelligence', icon: <Zap size={18} />, path: '/intelligence/helios', adminOnly: false, section: 'Helios' },
    { name: 'Intelligence', icon: <Brain size={18} />, path: '/intelligence', adminOnly: false, section: 'Intelligence' },
    { name: 'System', icon: <Cpu size={18} />, path: '/intelligence/system', adminOnly: false, section: 'System' },

    // Core CRM Section
    { name: 'Dashboard', icon: <LayoutDashboard size={18} />, path: '/dashboard', adminOnly: false, section: 'Ledger' },
    { name: 'Leads', icon: <Users size={18} />, path: '/leads', adminOnly: false, section: 'Ledger' },
    { name: 'Jobs', icon: <Briefcase size={18} />, path: '/jobs', adminOnly: false, section: 'Ledger' },
    { name: 'Estimates', icon: <Calculator size={18} />, path: '/estimates', adminOnly: false, section: 'Ledger' },
    { name: 'Calendar', icon: <Calendar size={18} />, path: '/calendar', adminOnly: false, section: 'Ledger' },
    { name: 'Storm Tracking', icon: <Map size={18} />, path: '/storm-tracking', adminOnly: false, section: 'Ledger' },
    { name: 'Documents', icon: <FileText size={18} />, path: '/documents', adminOnly: false, section: 'Ledger' },
    { name: 'Reports', icon: <BarChart3 size={18} />, path: '/reports', adminOnly: false, section: 'Ledger' },
    { name: 'Settings', icon: <Settings size={18} />, path: '/settings', adminOnly: false, section: 'Ledger' },
  ];

  const isActivePath = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-[hsl(var(--border))] transition-all duration-200 ${
        collapsed ? 'w-16' : 'w-64'
      } bg-[hsl(var(--background-elevated))]`}
    >
      <div className={`flex h-16 items-center border-b border-[hsl(var(--border))] px-4 ${collapsed ? 'justify-center' : 'justify-between'}`}>
        <BrandLockup collapsed={collapsed} />
        {!collapsed && (
          <button
            onClick={onToggle}
            className="rounded-sm p-1 text-text-secondary transition-colors hover:bg-[hsl(var(--background-accent))] hover:text-text-primary"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <Menu size={18} />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        <ul className="space-y-4 px-2">
          {(() => {
            const sections = [...new Set(navItems.map((item) => item.section).filter(Boolean))];
            return sections.map((section) => (
              <React.Fragment key={section}>
                {!collapsed && (
                  <li className="px-3 pb-1">
                    <span className="font-mono text-[0.5625rem] font-medium uppercase tracking-[0.2em] text-text-tertiary">
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
                          className={`flex items-center gap-3 rounded-sm px-3 py-2 text-[0.8125rem] font-medium transition-colors ${
                            collapsed ? 'justify-center' : ''
                          } ${
                            active
                              ? 'bg-primary text-[hsl(var(--primary-foreground))]'
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

      <div className="border-t border-[hsl(var(--border))] p-2">
        {!collapsed && user && (
          <div className="mb-2 rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[hsl(var(--border-hover))] bg-[hsl(var(--background-accent))] font-mono text-xs font-semibold text-text-primary">
                {user.firstName?.[0]}
                {user.lastName?.[0]}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-sm font-medium text-text-primary">
                  {user.firstName} {user.lastName}
                </p>
                <p className="truncate font-mono text-[0.625rem] uppercase tracking-[0.08em] text-text-tertiary">
                  {user.role?.replace('_', ' ')}
                </p>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-1.5 border-t border-[hsl(var(--border))] pt-2">
              <Shield size={11} className="text-[hsl(var(--emerald))]" aria-hidden="true" />
              <span className="font-mono text-[0.5625rem] uppercase tracking-[0.14em] text-text-tertiary">
                Verified session
              </span>
            </div>
          </div>
        )}
        <button
          onClick={logout}
          className={`flex w-full items-center gap-3 rounded-sm px-3 py-2 text-[0.8125rem] font-medium text-text-secondary transition-colors hover:bg-[hsl(var(--red))]/10 hover:text-[hsl(var(--red))] ${
            collapsed ? 'justify-center' : ''
          }`}
          title="Sign out"
        >
          <LogOut size={18} />
          {!collapsed && <span>Sign out</span>}
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
  // AUCTUM is a parchment-light system by default; the ink theme is opt-in.
  const [theme, setTheme] = useState<'dark' | 'light'>(
    (localStorage.getItem('theme') as 'dark' | 'light') || 'light'
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
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onSidebarToggle}
          className="rounded-sm p-2 text-text-secondary transition-colors hover:bg-[hsl(var(--background-accent))] hover:text-text-primary md:hidden"
          aria-label="Toggle menu"
        >
          <Menu size={18} />
        </button>
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={15} />
          <input
            type="search"
            placeholder="Search leads, jobs, estimates…"
            aria-label="Search leads, jobs and estimates"
            className="w-80 rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--background-elevated))] py-2 pl-9 pr-4 text-[0.8125rem] text-text-primary placeholder:text-text-tertiary focus:border-[hsl(var(--primary))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
          />
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="mr-2 hidden items-center gap-2 lg:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--emerald))]" aria-hidden="true" />
          <span className="font-mono text-[0.5625rem] uppercase tracking-[0.18em] text-text-tertiary">
            Atlas · verified origin
          </span>
        </span>

        <button
          onClick={toggleTheme}
          className="rounded-sm p-2 text-text-secondary transition-colors hover:bg-[hsl(var(--background-accent))] hover:text-text-primary"
          aria-label="Toggle colour theme"
          title={theme === 'dark' ? 'Switch to parchment' : 'Switch to ink'}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <button
          className="relative rounded-sm p-2 text-text-secondary transition-colors hover:bg-[hsl(var(--background-accent))] hover:text-text-primary"
          aria-label="Notifications"
          title="Notifications"
        >
          <Bell size={18} />
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[hsl(var(--red))] font-mono text-[0.5625rem] text-[hsl(var(--primary-foreground))]">
            3
          </span>
        </button>

        {!sidebarCollapsed && user && (
          <div className="ml-2 flex items-center gap-2 border-l border-[hsl(var(--border))] pl-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[hsl(var(--border-hover))] bg-[hsl(var(--background-accent))] font-mono text-[0.625rem] font-semibold text-text-primary">
              {user.firstName?.[0]}
              {user.lastName?.[0]}
            </div>
            <div className="hidden sm:block">
              <p className="text-[0.8125rem] font-medium leading-tight text-text-primary">
                {user.firstName} {user.lastName}
              </p>
              <p className="font-mono text-[0.5625rem] uppercase tracking-[0.1em] text-text-tertiary">
                {user.company?.name}
              </p>
            </div>
            <ChevronDown size={14} className="text-text-tertiary" aria-hidden="true" />
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
        className={`flex flex-1 flex-col overflow-hidden transition-all duration-200 ${
          sidebarCollapsed ? 'md:ml-16' : 'md:ml-64'
        }`}
      >
        <Header
          onSidebarToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          sidebarCollapsed={sidebarCollapsed}
        />

        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="mx-auto w-full max-w-[1600px] p-5 lg:p-7">
            <Outlet />
          </div>
        </main>

        <footer className="border-t border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-2.5">
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Shield size={12} className="text-[hsl(var(--emerald))]" aria-hidden="true" />
              <span className="font-mono text-[0.5625rem] uppercase tracking-[0.16em] text-text-tertiary">
                AUCTUM · ATLAS · NOAA National Weather Service
              </span>
            </div>
            <span className="font-mono text-[0.5625rem] uppercase tracking-[0.16em] text-text-tertiary">
              Verified, from origin
            </span>
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
