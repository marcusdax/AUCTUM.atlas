import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore, hasRole } from '../stores/authStore';
import { api } from '../services/api';
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
  Megaphone,
  Activity,
  Layers,
  Command,
  PanelLeftClose,
  PanelLeftOpen,
  X,
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
    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#d9b464]/65 bg-[#0a2117] text-[#d9b464]">
      <AuctumSeal size={36} />
    </span>
    {!collapsed && (
      <span className="flex flex-col leading-none">
        <span className="wordmark text-[1.35rem] text-[#f1f2ea]">AUCTUM</span>
        <span className="mt-1 font-mono text-[0.5625rem] uppercase tracking-[0.22em] text-[#d9b464]">
          Atlas · CRM
        </span>
      </span>
    )}
  </div>
);

const Sidebar: React.FC<{
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}> = ({ collapsed, mobileOpen, onCloseMobile }) => {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const showLabels = mobileOpen || !collapsed;

  const navItems: Array<{
    name: string;
    icon: React.ReactNode;
    path: string;
    adminOnly?: boolean;
    section?: string;
  }> = [
    // Operations & Spatial Intelligence
    { name: 'Command & Storm Map', icon: <Radio size={18} />, path: '/storm-tracking', adminOnly: false, section: 'Operations' },
    { name: 'Field Hub', icon: <Map size={18} />, path: '/field', adminOnly: false, section: 'Operations' },
    { name: 'Spaces & Feed', icon: <Satellite size={18} />, path: '/spaces', adminOnly: false, section: 'Operations' },
    { name: 'Leads', icon: <Users size={18} />, path: '/leads', adminOnly: false, section: 'Operations' },
    { name: 'Jobs', icon: <Briefcase size={18} />, path: '/jobs', adminOnly: false, section: 'Operations' },
    { name: 'Marketing Studio', icon: <Megaphone size={18} />, path: '/marketing', adminOnly: false, section: 'Operations' },

    // Office, Audit & Settings
    { name: 'Dashboard', icon: <LayoutDashboard size={18} />, path: '/dashboard', adminOnly: false, section: 'Office & Ledger' },
    { name: 'Estimates', icon: <Calculator size={18} />, path: '/estimates', adminOnly: false, section: 'Office & Ledger' },
    { name: 'Calendar', icon: <Calendar size={18} />, path: '/calendar', adminOnly: false, section: 'Office & Ledger' },
    { name: 'Documents', icon: <FileText size={18} />, path: '/documents', adminOnly: false, section: 'Office & Ledger' },
    { name: 'Reports & Audit', icon: <BarChart3 size={18} />, path: '/reports', adminOnly: false, section: 'Office & Ledger' },
    { name: 'Partner Portal', icon: <Zap size={18} />, path: '/portal', adminOnly: false, section: 'Office & Ledger' },
    { name: 'Settings', icon: <Settings size={18} />, path: '/settings', adminOnly: false, section: 'Office & Ledger' },
  ];

  const isActivePath = (path: string) => {
    if (path === '/') return location.pathname === '/';
    if (path === '/intelligence') return location.pathname === '/intelligence';
    return location.pathname.startsWith(path);
  };

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-[1050] bg-black/50 backdrop-blur-[1px] md:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}
      <aside
        className={`auctum-cloth-board fixed inset-y-0 left-0 z-[1100] flex flex-col border-r-2 border-[#a88d4e]/60 transition-all duration-200 ${
          mobileOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0'
        } ${collapsed ? 'md:w-16' : 'md:w-64'}`}
        aria-label="Primary navigation"
      >
        <div
          className={`flex h-16 items-center border-b border-[#f1f2ea]/15 bg-[#0a2117]/55 px-4 ${
            !showLabels ? 'justify-center' : 'justify-between'
          }`}
        >
          <BrandLockup collapsed={!showLabels} />
          <button
            type="button"
            onClick={onCloseMobile}
            className="rounded-sm p-1.5 text-[#f1f2ea]/75 transition-colors hover:bg-[#f1f2ea]/10 hover:text-[#f1f2ea] md:hidden"
            aria-label="Close navigation menu"
          >
            <X size={18} />
          </button>
        </div>

      <nav className="flex-1 overflow-y-auto py-3">
        <ul className="space-y-4 px-2">
          {(() => {
            const sections = [...new Set(navItems.map((item) => item.section).filter(Boolean))];
            return sections.map((section) => (
              <React.Fragment key={section}>
                {showLabels && (
                  <li className="px-3 pb-1">
                    <span className="font-mono text-[0.5625rem] font-medium uppercase tracking-[0.2em] text-[#d9b464]/80">
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
                          onClick={onCloseMobile}
                          className={`flex items-center gap-3 rounded-sm px-3 py-2 text-[0.8125rem] font-medium transition-colors ${
                            !showLabels ? 'justify-center' : ''
                          } ${
                            active
                              ? 'bg-[#d9b464] text-[#0e2c20] font-semibold'
                              : 'text-[#f1f2ea]/80 hover:bg-[#f1f2ea]/10 hover:text-[#f1f2ea]'
                          }`}
                          title={item.name}
                        >
                          {item.icon}
                          {showLabels && <span>{item.name}</span>}
                        </NavLink>
                      </li>
                    );
                  })}
              </React.Fragment>
            ));
          })()}
        </ul>
      </nav>

      <div className="border-t border-[#f1f2ea]/15 bg-[#0a2117]/60 p-2">
        {showLabels && user && (
          <div className="mb-2 rounded-sm border border-[#d9b464]/35 bg-[#0e2c20]/90 p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#d9b464]/60 bg-[#0a2117] font-mono text-xs font-semibold text-[#d9b464]">
                {user.firstName?.[0]}
                {user.lastName?.[0]}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-sm font-medium text-[#f1f2ea]">
                  {user.firstName} {user.lastName}
                </p>
                <p className="truncate font-mono text-[0.625rem] uppercase tracking-[0.08em] text-[#f1f2ea]/65">
                  {user.role?.replace('_', ' ')}
                </p>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-1.5 border-t border-[#f1f2ea]/15 pt-2">
              <Shield size={11} className="text-[#48a868]" aria-hidden="true" />
              <span className="font-mono text-[0.5625rem] uppercase tracking-[0.14em] text-[#f1f2ea]/70">
                Verified session
              </span>
            </div>
          </div>
        )}
        <button
          onClick={logout}
          className={`flex w-full items-center gap-3 rounded-sm px-3 py-2 text-[0.8125rem] font-medium text-[#f1f2ea]/80 transition-colors hover:bg-[#8c2f22]/30 hover:text-[#f1f2ea] ${
            !showLabels ? 'justify-center' : ''
          }`}
          title="Sign out"
        >
          <LogOut size={18} />
          {showLabels && <span>Sign out</span>}
        </button>
      </div>
      </aside>
    </>
  );
};

const Header: React.FC<{
  onMobileMenuOpen: () => void;
  onDesktopSidebarToggle: () => void;
  sidebarCollapsed: boolean;
}> = ({ onMobileMenuOpen, onDesktopSidebarToggle, sidebarCollapsed }) => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  // AUCTUM is a parchment-light system by default; the ink theme is opt-in.
  const [theme, setTheme] = useState<'dark' | 'light'>(
    (localStorage.getItem('theme') as 'dark' | 'light') || 'light'
  );

  const { data: activeStormsData } = useQuery<{ storms?: unknown[] }>({
    queryKey: ['storm-events'],
    queryFn: () => api.get('/storms/active').then((res) => res.data),
    staleTime: 60_000,
    retry: 0,
  });
  const activeStormCount = activeStormsData?.storms?.length ?? 0;

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 sm:px-4 lg:px-6">
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onMobileMenuOpen}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-sm text-text-secondary transition-colors hover:bg-[hsl(var(--background-accent))] hover:text-text-primary md:hidden"
          aria-label="Open navigation menu"
        >
          <Menu size={18} />
        </button>
        <Link
          to="/dashboard"
          className="flex items-baseline gap-2 md:hidden"
          aria-label="AUCTUM Atlas Home"
        >
          <span className="wordmark text-lg text-text-primary">AUCTUM</span>
          <span className="font-mono text-[0.5625rem] uppercase tracking-[0.18em] text-text-tertiary">
            Atlas
          </span>
        </Link>
        <button
          type="button"
          onClick={onDesktopSidebarToggle}
          className="hidden min-h-[40px] min-w-[40px] items-center justify-center rounded-sm text-text-secondary transition-colors hover:bg-[hsl(var(--background-accent))] hover:text-text-primary md:inline-flex"
          aria-label={sidebarCollapsed ? 'Expand navigation rail' : 'Collapse navigation rail'}
          title={sidebarCollapsed ? 'Expand navigation rail' : 'Collapse navigation rail'}
        >
          {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const q = searchQuery.trim();
            navigate(q ? `/jobs?q=${encodeURIComponent(q)}` : '/jobs');
          }}
          className="relative hidden md:block"
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={15} />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search leads, jobs, estimates…"
            aria-label="Search leads, jobs and estimates"
            className="w-80 rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--background-elevated))] py-2 pl-9 pr-4 text-[0.8125rem] text-text-primary placeholder:text-text-tertiary focus:border-[hsl(var(--primary))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
          />
        </form>
      </div>

      <div className="flex items-center gap-1">
        <span className="mr-2 hidden items-center gap-2 lg:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--emerald))]" aria-hidden="true" />
          <span className="font-mono text-[0.5625rem] uppercase tracking-[0.18em] text-text-tertiary">
            Atlas · verified origin
          </span>
        </span>

        <button
          type="button"
          onClick={toggleTheme}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-sm text-text-secondary transition-colors hover:bg-[hsl(var(--background-accent))] hover:text-text-primary md:min-h-[40px] md:min-w-[40px]"
          aria-label="Toggle colour theme"
          title={theme === 'dark' ? 'Switch to parchment' : 'Switch to ink'}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <button
          type="button"
          onClick={() => navigate('/storm-tracking')}
          className="relative inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-sm text-text-secondary transition-colors hover:bg-[hsl(var(--background-accent))] hover:text-text-primary md:min-h-[40px] md:min-w-[40px]"
          aria-label={
            activeStormCount > 0
              ? `${activeStormCount} active storm alerts — open Storm Tracking`
              : 'Open Storm Tracking'
          }
          title={
            activeStormCount > 0
              ? `${activeStormCount} active storm alerts`
              : 'View storm tracking'
          }
        >
          <Bell size={18} />
          {activeStormCount > 0 && (
            <span className="stat-mono absolute right-1 top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[hsl(var(--red))] px-1 text-[0.5625rem] font-semibold text-[hsl(var(--primary-foreground))]">
              {activeStormCount > 99 ? '99+' : activeStormCount}
            </span>
          )}
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex h-screen overflow-hidden bg-[hsl(var(--background))]">
      <Sidebar
        collapsed={sidebarCollapsed}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      <div
        className={`flex flex-1 flex-col overflow-hidden transition-all duration-200 ${
          sidebarCollapsed ? 'md:ml-16' : 'md:ml-64'
        }`}
      >
        <Header
          onMobileMenuOpen={() => setMobileNavOpen(true)}
          onDesktopSidebarToggle={() => setSidebarCollapsed((v) => !v)}
          sidebarCollapsed={sidebarCollapsed}
        />

        <main className="relative z-0 flex-1 overflow-y-auto overflow-x-hidden">
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
            <div className="flex items-center gap-4">
              <a
                href="/downloads/fieldwright-debug.apk"
                download="fieldwright-debug.apk"
                className="font-mono text-[0.5625rem] uppercase tracking-[0.16em] text-text-secondary underline hover:text-text-primary"
              >
                Download Field App (.apk)
              </a>
              <Link
                to="/portal"
                className="font-mono text-[0.5625rem] uppercase tracking-[0.16em] text-text-secondary underline hover:text-text-primary"
              >
                Partner Portal
              </Link>
              <span className="font-mono text-[0.5625rem] uppercase tracking-[0.16em] text-text-tertiary">
                Verified, from origin
              </span>
            </div>
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
