import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import BottomNav from './BottomNav';
import SOSButton from './SOSButton';
import SOSBanner from './SOSBanner';
import { useApp } from '../context/AppContext';

export default function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useApp();
  const { lifeStage } = state.user;

  // SOS lives on the floating red button (single tap opens /sos); Profile is
  // reached from the avatar in the top-right of Home — so neither needs a tab.
  const tabs = [
    { path: '/home', label: 'Home', icon: HomeIcon },
    { path: '/consult', label: 'Consult', icon: ConsultIcon },
    { path: '/track', label: 'Track', icon: TrackIcon },
    { path: '/help', label: 'Help', icon: HelpIcon },
  ];

  const activeTab = tabs.find(t => location.pathname.startsWith(t.path))?.path ?? '/home';

  return (
    <div className="app-shell">
      <SOSBanner />
      <div className="app-shell__content">
        <Outlet />
      </div>
      <SOSButton />
      <BottomNav tabs={tabs} active={activeTab} onTab={navigate} lifeStage={lifeStage} />
    </div>
  );
}

function HomeIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" fill={active ? 'currentColor' : 'none'} />
      <path d="M9 21V12h6v9" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} />
    </svg>
  );
}

function ConsultIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="14" rx="2" fill={active ? 'currentColor' : 'none'} fillOpacity={0.15} />
      <circle cx="9" cy="10" r="2.5" fill={active ? 'currentColor' : 'none'} />
      <path d="M15 8h2M15 11h2M6 15.5c0-1.1 1.3-2 3-2s3 .9 3 2" />
    </svg>
  );
}


function TrackIcon({ active }) {
  const w = active ? 2.2 : 1.8;
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
      {/* Clean clockwise cycle arrow with a crisp corner arrowhead — the
          clearest read of a recurring cycle at nav scale. */}
      <path d="M20 11a8 8 0 1 1-2.3-5" />
      <path d="M20 3.5V8h-4.5" />
      {/* Centre dot — fills when active, echoing the phase-banner motif */}
      <circle cx="12" cy="12" r="2.4" fill={active ? 'currentColor' : 'none'} />
    </svg>
  );
}

function HelpIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z" fill={active ? 'currentColor' : 'none'} fillOpacity={0.15} />
    </svg>
  );
}

