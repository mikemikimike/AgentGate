import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useModelInfo, usePolicy, usePendingApprovalsCount, useHealth } from '../lib/api';
import { FeedPage } from '../features/feed/FeedPage';
import { DecisionDetailPage } from '../features/feed/DecisionDetailPage';
import { ApprovalsPage } from '../features/feed/ApprovalsPage';
import { PolicyEditorPage } from '../features/policy/PolicyEditorPage';
import { DocsPage } from '../features/docs/DocsPage';
import { 
  Activity, CheckSquare, Shield, BookOpen, Sun, Moon
} from 'lucide-react';

const queryClient = new QueryClient();

function ThemeToggle() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'dark';
  });
  
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <button 
      onClick={toggleTheme} 
      className="w-[28px] h-[28px] rounded-[6px] border border-ln bg-none text-t2 hover:text-tx hover:bg-hv flex items-center justify-center transition-colors focus-visible:outline-2 focus-visible:outline-ac"
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? (
        <Sun size={15} strokeWidth={1.6} aria-hidden="true" />
      ) : (
        <Moon size={15} strokeWidth={1.6} aria-hidden="true" />
      )}
    </button>
  );
}

function TopBar() {
  const { data: model } = useModelInfo();
  const { data: policy } = usePolicy();
  const location = useLocation();
  const gatewayName = 'gateway-us-east';

  const getPageTitle = () => {
    if (location.pathname === '/' || location.pathname === '/audit') return 'Audit log';
    if (location.pathname.startsWith('/approvals')) return 'Approvals';
    if (location.pathname.startsWith('/policy')) return 'Policy rules';
    if (location.pathname.startsWith('/docs')) return 'Documentation';
    if (location.pathname.startsWith('/decisions')) return 'Audit log';
    return 'Audit log';
  };

  const engineName = model?.model_name || 'agentgate-v0';
  const policyVersion = policy?.version ? `v${policy.version}` : 'v1';

  return (
    <header className="h-[44px] border-b border-ln bg-pn flex items-center px-[20px] justify-between shrink-0">
      {/* Left: breadcrumb */}
      <div className="flex items-center gap-[6px] text-[13px] text-t3">
        <span>{gatewayName}</span>
        <span>/</span>
        <span className="text-tx font-medium">{getPageTitle()}</span>
        {location.pathname.startsWith('/decisions/') && (
          <>
            <span>/</span>
            <span className="text-tx font-medium font-mono text-[12px]">{location.pathname.split('/').pop()}</span>
          </>
        )}
      </div>

      {/* Right: sample tag, engine tag, policy tag, theme button */}
      <div className="flex items-center gap-[8px]">
        <span className="tg smp">Sample data</span>
        <span className="tg">engine <b className="mo">{engineName}</b></span>
        <span className="tg">policy <b className="mo">{policyVersion}</b></span>
        <ThemeToggle />
      </div>
    </header>
  );
}

function Sidebar() {
  const location = useLocation();
  const { data: pendingCount = 0 } = usePendingApprovalsCount();
  const { data: isHealthy = true } = useHealth();

  const navItems = [
    { to: '/', label: 'Audit log', icon: Activity },
    { to: '/approvals', label: 'Approvals', icon: CheckSquare, badge: pendingCount },
    { to: '/policy', label: 'Policy rules', icon: Shield },
    { to: '/docs', label: 'Documentation', icon: BookOpen },
  ];

  return (
    <aside className="w-[224px] border-r border-ln bg-pn flex flex-col p-[10px_8px] shrink-0 justify-between h-full select-none">
      <div className="flex flex-col">
        {/* Brand mark: 20px rounded square with 1.5px accent outline and 7px accent dot */}
        <div className="flex items-center gap-[9px] p-[6px_8px] font-semibold text-tx">
          <span className="lg">
            <i />
          </span>
          <div>
            <div className="leading-tight">AgentGate</div>
            <small className="block font-normal text-t3 text-[11.5px] leading-[14px]">Security proxy</small>
          </div>
        </div>

        {/* Section label: sentence case, 11.5px, muted */}
        <div className="text-[11.5px] text-t3 px-[8px] pt-[16px] pb-[4px]">
          Security control
        </div>

        {/* Navigation items */}
        <nav className="flex flex-col gap-[1px]">
          {navItems.map(item => {
            const Icon = item.icon;
            const active = location.pathname === item.to || 
              (item.to === '/' && location.pathname === '/audit') ||
              (item.to !== '/' && location.pathname.startsWith(item.to));
            return (
              <Link 
                key={item.to} 
                to={item.to} 
                className={`h-[28px] flex items-center gap-[9px] px-[8px] rounded-[6px] text-[13px] transition-colors ${
                  active 
                    ? 'bg-sl text-tx font-normal' 
                    : 'text-t2 hover:bg-hv hover:text-tx'
                }`}
              >
                <Icon 
                  size={15} 
                  strokeWidth={1.6} 
                  aria-hidden="true"
                  className={`shrink-0 ${active ? 'text-at' : 'text-current'}`} 
                />
                <span className="truncate">{item.label}</span>

                {item.badge !== undefined && item.badge > 0 && (
                  <em className={`ml-auto not-italic text-[11px] rounded-[10px] px-[6px] min-w-[18px] text-center ${
                    active ? 'bg-bg text-t2' : 'bg-sl text-t2'
                  }`}>
                    {item.badge}
                  </em>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Info: v0.2.0 with an Active status dot */}
      <div className="mt-auto border-t border-ln pt-[10px] pb-[2px] px-[8px] flex items-center gap-[8px] text-t3 text-[12px]">
        <span className="mo">v0.2.0</span>
        <span className="ml-auto flex items-center gap-[6px] text-t2">
          <i className={`w-[7px] h-[7px] rounded-full ${isHealthy ? 'bg-ok shadow-[0_0_0_3px_var(--okb)]' : 'bg-bad shadow-[0_0_0_3px_var(--badb)]'}`} />
          <span>{isHealthy ? 'Active' : 'Offline'}</span>
        </span>
      </div>
    </aside>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="h-screen w-full flex overflow-hidden font-sans text-[13px] bg-bg text-tx antialiased">
          <Sidebar />
          <div className="flex flex-1 flex-col overflow-hidden min-w-0">
            <TopBar />
            <main className="flex-1 overflow-y-auto overflow-x-hidden min-w-0">
              <Routes>
                <Route path="/" element={<FeedPage />} />
                <Route path="/audit" element={<FeedPage />} />
                <Route path="/approvals" element={<ApprovalsPage />} />
                <Route path="/decisions/:id" element={<DecisionDetailPage />} />
                <Route path="/policy" element={<PolicyEditorPage />} />
                <Route path="/docs" element={<DocsPage />} />
              </Routes>
            </main>
          </div>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
