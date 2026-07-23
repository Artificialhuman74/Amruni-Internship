import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { VideoProvider } from '../context/VideoContext';

import AppShell from '../components/AppShell';
import Splash from '../screens/Splash';
import PhoneEntry from '../screens/PhoneEntry';
import OTPVerify from '../screens/OTPVerify';
import LifeStage from '../screens/LifeStage';
import ProfileSetup from '../screens/ProfileSetup';
import Home from '../screens/Home';
import Telemedicine from '../screens/Telemedicine';
import MentalHealth from '../screens/MentalHealth';
import CycleTracker from '../screens/CycleTracker';
import Pregnancy from '../screens/Pregnancy';
import Settings from '../screens/Settings';
import SOSCenter from '../screens/SOSCenter';
import PcosCheck from '../screens/PcosCheck';

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
  const { isOnboarded, lifeStage } = state.user;

  const TrackScreen = (lifeStage === 'postpartum' || lifeStage === 'elderly')
    ? Pregnancy
    : CycleTracker;

  return (
    <VideoProvider>
      <AnimatePresence mode="wait" initial={false}>
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Splash />} />
          <Route path="/phone" element={<PhoneEntry />} />
          <Route path="/otp" element={<OTPVerify />} />
          <Route
            path="/onboarding/stage"
            element={isAuthenticated ? <LifeStage /> : <Navigate to="/phone" replace />}
          />
          <Route
            path="/onboarding/profile"
            element={isAuthenticated ? <ProfileSetup /> : <Navigate to="/phone" replace />}
          />
          <Route
            element={
              !isAuthenticated
                ? <Navigate to="/phone" replace />
                : !isOnboarded
                ? <Navigate to="/onboarding/stage" replace />
                : <AppShell />
            }
          >
            <Route path="/home" element={<Home />} />
            <Route path="/consult" element={<Telemedicine />} />
            <Route path="/help" element={<MentalHealth />} />
            <Route path="/track" element={<TrackScreen />} />
            <Route path="/sos" element={<SOSCenter />} />
            <Route path="/pcos-check" element={<PcosCheck />} />
            <Route path="/settings" element={<Settings />} />

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

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </VideoProvider>
  );
}
