import { useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BottomNav } from './';
import { SOSButton } from '../features/sos';
import { SOSBanner } from '../features/sos';
import { useApp } from '../../context/AppContext';
import { useSosDock } from '../../lib/useSosDock';

export default function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useApp();
  const { lifeStage } = state.user;

  const { dockState, place } = useSosDock();
  // Both lifted, because the bar has to react while the button is still in
  // the air: mid-drag the well follows the button's proximity, so the tabs
  // close the gap as she carries it clear and part again as she brings it
  // back. At rest it simply follows where the button lives.
  const [nearDock, setNearDock] = useState(false);
  const [dragging, setDragging] = useState(false);
  const wellOpen = dragging ? nearDock : dockState.docked;
  const columnRef = useRef(null);
  const navRef = useRef(null);
  const wellRef = useRef(null);

  // SOS has its own seat in the middle of the bar, so it needs no tab; Profile
  // is reached from the avatar in the top-right of Home.
  const tabs = [
    { path: '/home', label: 'Home', icon: HomeIcon },
    { path: '/consult', label: 'Consult', icon: ConsultIcon },
    { path: '/track', label: 'Track', icon: TrackIcon },
    { path: '/help', label: 'Help', icon: HelpIcon },
  ];

  // No fallback to Home. Community, Journal, Settings and the SOS centre are
  // all reached from inside other screens, and defaulting to Home lit the Home
  // tab while she was demonstrably not on Home — a selected tab that isn't
  // where you are is worse than none being selected.
  const activeTab = tabs.find(t => location.pathname.startsWith(t.path))?.path ?? null;

  return (
    <div className="app-shell" ref={columnRef}>
      <SOSBanner />
      <div className="app-shell__content">
        <Outlet />
      </div>

      <BottomNav
        ref={navRef}
        tabs={tabs}
        active={activeTab}
        onTab={navigate}
        lifeStage={lifeStage}
        showWell={wellOpen}
        wellRef={wellRef}
        wellArmed={dragging && nearDock}
      />

      {/* After the bar, deliberately: layout effects run in tree order, so a
          button mounted first would measure a nav ref that isn't attached yet
          and start life at the screen edge instead of in its well. */}
      <SOSButton
        dockState={dockState}
        place={place}
        columnRef={columnRef}
        navRef={navRef}
        onNearDock={setNearDock}
        onDragging={setDragging}
      />
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
