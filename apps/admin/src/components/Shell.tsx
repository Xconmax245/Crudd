import { NavLink, Outlet, useNavigate } from 'react-router';
import { useState } from 'react';
import {
  LayoutDashboard,
  Library,
  ListChecks,
  Swords,
  Users,
  BarChart3,
  Settings as SettingsIcon,
  ScrollText,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../stores/auth';
import { cn } from '../lib/utils';

const NAV = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/banks', label: 'Question Banks', icon: Library },
  { to: '/questions', label: 'Questions', icon: ListChecks },
  { to: '/challenges', label: 'Challenges', icon: Swords },
  { to: '/participants', label: 'Participants', icon: Users },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/audit', label: 'Audit Log', icon: ScrollText },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

export default function Shell() {
  const { me, signOut } = useAuth();
  const navigate = useNavigate();

  // EGG 3: Admin Logo Easter Egg
  const [clicks, setClicks] = useState(0);
  const [lastClick, setLastClick] = useState(0);
  const [wobble, setWobble] = useState(false);
  const [showCredit, setShowCredit] = useState(false);

  const handleLogoClick = () => {
    const now = Date.now();
    if (now - lastClick > 1000) {
      setClicks(1);
    } else {
      const newClicks = clicks + 1;
      setClicks(newClicks);
      if (newClicks >= 5 && !showCredit) {
        setWobble(true);
        setShowCredit(true);
        setTimeout(() => setWobble(false), 500);
        setTimeout(() => setShowCredit(false), 2000);
        setClicks(0);
      }
    }
    setLastClick(now);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="flex w-64 shrink-0 flex-col border-r border-line bg-paper">
        <div 
          className="flex h-16 items-center gap-2 border-b border-line px-6 cursor-pointer relative"
          onClick={handleLogoClick}
        >
          <span className={`font-display text-xl font-bold text-brand transition-transform ${wobble ? 'animate-bounce' : ''}`}>CRUDD</span>
          <span className="rounded bg-brand/10 px-1.5 py-0.5 text-xs font-semibold text-brand">ADMIN</span>
          
          {showCredit && (
            <div className="absolute top-full left-6 mt-1 bg-ink text-cream text-xs font-bold py-1.5 px-3 rounded shadow-lg whitespace-nowrap z-50 animate-in fade-in slide-in-from-top-2">
              Made with too much coffee by Ademola ☕
            </div>
          )}
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive ? 'bg-brand text-brand-fg' : 'text-ink hover:bg-gray-100',
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-line p-4">
          <div className="mb-2 truncate text-sm font-medium">{me?.displayName ?? me?.email}</div>
          <div className="mb-3 text-xs text-muted">{me?.role}</div>
          <button className="btn-secondary w-full" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
