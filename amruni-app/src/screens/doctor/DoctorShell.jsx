import { Outlet, NavLink, Navigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { getDoctorToken } from '../../services/doctorApi';
import { tap } from '../../lib/haptics';

const TABS = [
  { to: '/doctor/today', label: 'Today', icon: TodayIcon },
  { to: '/doctor/schedule', label: 'Schedule', icon: ScheduleIcon },
  { to: '/doctor/patients', label: 'Patients', icon: PatientsIcon },
  { to: '/doctor/account', label: 'Profile', icon: ProfileIcon },
];

export default function DoctorShell() {
  const location = useLocation();
  const reduced = useReducedMotion();

  if (!getDoctorToken()) {
    return <Navigate to="/doctor" replace />;
  }

  return (
    <div className="app-shell">
      <div className="app-shell__content">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            style={{ minHeight: '100%' }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </div>

      <nav className="bottom-nav" aria-label="Doctor console">
        {TABS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => tap()}
            className={({ isActive }) => `bottom-nav__tab${isActive ? ' bottom-nav__tab--active' : ''}`}
          >
            <span className="bottom-nav__tab-icon"><Icon /></span>
            <span className="bottom-nav__tab-label">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function TodayIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="17" rx="3" />
      <path d="M3 9h18M8 2v4M16 2v4" />
      <circle cx="12" cy="15" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ScheduleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.2 2" />
    </svg>
  );
}

function PatientsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8" r="3.4" />
      <path d="M3.5 20c.6-3.3 2.8-5 5.5-5s4.9 1.7 5.5 5" />
      <path d="M16 4.6a3.4 3.4 0 010 6.8M17.5 15.3c1.7.7 2.7 2.2 3 4.7" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5 20c.8-3.8 3.5-5.8 7-5.8s6.2 2 7 5.8" />
    </svg>
  );
}
