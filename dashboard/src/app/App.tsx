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
  Activity, CheckSquare, FileCode, BookOpen, Sun, Moon, HelpCircle
} from 'lucide-react';
import { HowItWorksModal } from '../components/HowItWorksModal';

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
      className="w-[28px] h-[28px] rounded-[6px] border border-ln bg-rs text-t2 hover:text-tx hover:bg-hv flex items-center justify-center transition-colors focus-visible:ring-1 focus-visible:ring-at focus-visible:outline-hidden"
      title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
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
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const gatewayName = 'gateway-us-east';

  const getPageTitle = () => {
    if (location.pathname === '/') return 'Decisions log';
    if (location.pathname.startsWith('/approvals')) return 'Approvals queue';
    if (location.pathname.startsWith('/policy')) return 'Policy rules';
    if (location.pathname.startsWith('/docs')) return 'Documentation';
    if (location.pathname.startsWith('/decisions')) return 'Decision detail';
    return 'Decisions log';
  };

  const engineName = model?.model_name || 'agentgate-stub';
  const policyVersion = policy?.version ? `v${policy.version}` : 'v1';

  return (
    <header className="h-[44px] border-b border-ln bg-pn flex items-center px-[20px] justify-between shrink-0">
      {/* Left: breadcrumb */}
      <div className="flex items-center gap-[6px] text-[13px] font-sans">
        <span className="text-t2 font-normal">{gatewayName}</span>
        <span className="text-t3">/</span>
        <span className="text-tx font-medium">{getPageTitle()}</span>
      </div>

      {/* Right: engine tag, policy tag, how-it-works, theme button */}
      <div className="flex items-center gap-[8px]">
        {/* engine tag */}
        <div className="h-[22px] px-[8px] rounded-[5px] border border-ln bg-bg text-[12px] font-mono text-t2 flex items-center">
          <span>engine {engineName}</span>
        </div>

        {/* policy tag */}
        <div className="h-[22px] px-[8px] rounded-[5px] border border-ln bg-bg text-[12px] font-mono text-t2 flex items-center">
          <span>policy {policyVersion}</span>
        </div>

        {/* How it works explainer button */}
        <button
          onClick={() => setShowHowItWorks(true)}
          className="h-[24px] px-[8px] rounded-[5px] border border-ln bg-sl/30 hover:bg-hv text-[11.5px] font-medium text-tx flex items-center gap-[5px] transition-colors shadow-2xs focus-visible:ring-1 focus-visible:ring-at focus-visible:outline-hidden"
          title="Learn how AgentGate works"
        >
          <HelpCircle size={13} className="text-at" aria-hidden="true" />
          <span className="hidden sm:inline">How it works</span>
        </button>

        <HowItWorksModal open={showHowItWorks} onOpenChange={setShowHowItWorks} />

        {/* Theme button */}
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
    { to: '/policy', label: 'Policy rules', icon: FileCode },
    { to: '/docs', label: 'Documentation', icon: BookOpen },
  ];

  return (
    <aside className="w-[224px] border-r border-ln bg-pn flex flex-col p-[10px_8px] shrink-0 justify-between h-full select-none">
      <div className="flex flex-col gap-[14px]">
        {/* Brand row: 20px rounded square with 1.5px accent outline and 7px accent dot */}
        <div className="flex items-center gap-[10px] px-[6px] py-[6px]">
          <div className="w-[22px] h-[22px] rounded-[4px] border-[1.5px] border-at bg-at/10 flex items-center justify-center shrink-0 shadow-[0_0_8px_var(--chkb)]">
            <div className="w-[6px] h-[6px] rounded-full bg-at animate-pulse motion-reduce:animate-none" />
          </div>
          <div className="flex flex-col">
            <span className="font-display font-bold text-tx text-[14px] leading-tight tracking-tight uppercase">AgentGate</span>
            <span className="text-[10px] font-mono text-t3 uppercase tracking-wider mt-[1px]">Security Gateway</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-[2px]">
          {/* Section label: sentence case, 11.5px, muted */}
          <div className="text-[10.5px] font-mono uppercase tracking-wider text-t3 px-[8px] py-[6px] leading-tight">
            Telemetry & Control
          </div>

          {navItems.map(item => {
            const Icon = item.icon;
            const active = location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to));
            return (
              <Link 
                key={item.to} 
                to={item.to} 
                className={`h-[30px] flex items-center justify-between px-[8px] rounded-[4px] text-[12.5px] font-medium transition-colors focus-visible:ring-1 focus-visible:ring-at focus-visible:outline-hidden ${
                  active 
                    ? 'bg-sl text-tx font-semibold shadow-xs border-l-2 border-at' 
                    : 'text-t2 hover:bg-hv hover:text-tx'
                }`}
              >
                <div className="flex items-center gap-[9px] truncate">
                  <Icon 
                    size={15} 
                    strokeWidth={1.7} 
                    aria-hidden="true"
                    className={active ? 'text-at' : 'text-t3'} 
                  />
                  <span className="truncate">{item.label}</span>
                </div>

                {item.badge !== undefined && item.badge > 0 && (
                  <span className="px-[6px] py-[1px] text-[10.5px] font-mono font-semibold rounded-[3px] bg-wn/15 text-wn border border-wn/35 animate-pulse motion-reduce:animate-none">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Info: version string and active status dot */}
      <div className="px-[8px] py-[8px] border-t border-ln text-[11px] text-t3 flex items-center justify-between font-mono">
        <span className="text-[10.5px] text-t3 tracking-tight">GATEWAY v0.2.0</span>
        <div className="flex items-center gap-[6px]">
          <span className={`w-[6px] h-[6px] rounded-full ${isHealthy ? 'bg-ok shadow-[0_0_6px_var(--ok)] animate-pulse motion-reduce:animate-none' : 'bg-bad'}`} />
          <span className="text-[10.5px] text-t2 uppercase font-medium">{isHealthy ? 'LIVE' : 'OFFLINE'}</span>
        </div>
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

