import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import BottomNav from './BottomNav';
import { useApp } from '../context/AppContext';

export default function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useApp();
  const { lifeStage } = state.user;

  const tabs = [
    { path: '/home', label: 'Home', icon: HomeIcon },
    { path: '/consult', label: 'Consult', icon: ConsultIcon },
    { path: '/track', label: 'Track', icon: TrackIcon },
    { path: '/help', label: 'Help', icon: HelpIcon },
    { path: '/settings', label: 'Profile', icon: ProfileIcon },
  ];

  const activeTab = tabs.find(t => location.pathname.startsWith(t.path))?.path ?? '/home';

  return (
    <div className="app-shell">
      <div className="app-shell__content">
        <Outlet />
      </div>
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
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      {/* ~300° clockwise arc — reads as "cycle" */}
      <path d="M20 12A8 8 0 1 1 16 5" />
      {/* Arrowhead continuing clockwise at arc end */}
      <polyline points="14 8 16 5 19.5 6.5" />
      {/* Centre dot — fills when active */}
      <circle cx="12" cy="12" r="2.5" fill={active ? 'currentColor' : 'none'} />
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

function ProfileIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" fill={active ? 'currentColor' : 'none'} fillOpacity={0.15} />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}
