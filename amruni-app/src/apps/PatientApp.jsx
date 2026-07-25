import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { VideoProvider } from '../context/VideoContext';

import AppShell from '../components/AppShell';
import Splash from '../screens/Splash';
import PhoneEntry from '../screens/PhoneEntry';
import OTPVerify from '../screens/OTPVerify';
import PrivacyFirst from '../screens/onboarding/PrivacyFirst';
import NameStep from '../screens/onboarding/NameStep';
import DobStep from '../screens/onboarding/DobStep';
import GoalsStep from '../screens/onboarding/GoalsStep';
import Home from '../screens/Home';
import Telemedicine from '../screens/Telemedicine';
import MentalHealth from '../screens/MentalHealth';
import CycleTracker from '../screens/CycleTracker';
import Pregnancy from '../screens/Pregnancy';
import Settings from '../screens/Settings';
import SOSCenter from '../screens/SOSCenter';
import PcosCheck from '../screens/PcosCheck';
import ComingSoon from '../screens/ComingSoon';
import Journal from '../screens/Journal';
import Community from '../screens/Community';
import CommunityThread from '../screens/CommunityThread';

import DoctorProfile from '../screens/DoctorProfile';
import BookAppointment from '../screens/BookAppointment';
import WaitingRoom from '../screens/WaitingRoom';
import VideoCall from '../screens/VideoCall';
import ConsultationSummary from '../screens/ConsultationSummary';

/** The patient-facing app. Deployed standalone; the practitioner console and
 *  the admin portal are separate builds (see src/apps/). */
export default function PatientApp() {
  const location = useLocation();
  const { state } = useApp();
  const { isAuthenticated } = state.auth;
  const { isOnboarded } = state.user;

  // Track shows the pregnancy journey only when pregnancy mode is on
  // (set by the onboarding goal or the Profile toggle) — never inferred
  // from life stage, which is what caused it to default to pregnancy.
  const TrackScreen = state.settings.pregnancyMode ? Pregnancy : CycleTracker;

  return (
    <VideoProvider>
      <AnimatePresence mode="wait" initial={false}>
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Splash />} />
          <Route path="/phone" element={<PhoneEntry />} />
          <Route path="/otp" element={<OTPVerify />} />
          {['privacy', 'name', 'dob', 'goals'].map((step, i) => (
            <Route
              key={step}
              path={`/onboarding/${step}`}
              element={isAuthenticated
                ? [<PrivacyFirst />, <NameStep />, <DobStep />, <GoalsStep />][i]
                : <Navigate to="/phone" replace />}
            />
          ))}
          <Route
            element={
              !isAuthenticated
                ? <Navigate to="/phone" replace />
                : !isOnboarded
                ? <Navigate to="/onboarding/privacy" replace />
                : <AppShell />
            }
          >
            <Route path="/home" element={<Home />} />
            <Route path="/consult" element={<Telemedicine />} />
            <Route path="/help" element={<MentalHealth />} />
            <Route path="/track" element={<TrackScreen />} />
            <Route path="/sos" element={<SOSCenter />} />
            <Route path="/pcos-check" element={<PcosCheck />} />
            <Route path="/coming-soon" element={<ComingSoon />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/journal" element={<Journal />} />
            <Route path="/community" element={<Community />} />
            <Route path="/community/:id" element={<CommunityThread />} />

            {/* Booking journey */}
            <Route path="/doctor/:id" element={<DoctorProfile />} />
            <Route path="/appointment/:id" element={<BookAppointment />} />
            <Route path="/waiting/:appointmentId" element={<WaitingRoom />} />
            <Route path="/consultation/:id" element={<ConsultationSummary />} />
            <Route path="/doctors" element={<Navigate to="/consult" replace />} />
          </Route>

          {/* Immersive full-screen consultation, outside the tab shell */}
          <Route
            path="/video/:appointmentId"
            element={isAuthenticated ? <VideoCall /> : <Navigate to="/phone" replace />}
          />

          {/* Unknown path: a signed-in, onboarded user goes to Home (never
              replay the marketing splash — that reads as "bounced to the
              landing page"); everyone else starts at the splash. */}
          <Route
            path="*"
            element={<Navigate to={isAuthenticated && isOnboarded ? '/home' : '/'} replace />}
          />
        </Routes>
      </AnimatePresence>
    </VideoProvider>
  );
}
