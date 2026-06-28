import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useApp } from './context/AppContext';
import { VideoProvider } from './context/VideoContext';

import AppShell from './components/AppShell';
import Splash from './screens/Splash';
import PhoneEntry from './screens/PhoneEntry';
import OTPVerify from './screens/OTPVerify';
import LifeStage from './screens/LifeStage';
import ProfileSetup from './screens/ProfileSetup';
import Home from './screens/Home';
import Telemedicine from './screens/Telemedicine';
import MentalHealth from './screens/MentalHealth';
import CycleTracker from './screens/CycleTracker';
import Pregnancy from './screens/Pregnancy';
import Settings from './screens/Settings';

// New Screens
import DoctorProfile from './screens/DoctorProfile';
import BookAppointment from './screens/BookAppointment';
import WaitingRoom from './screens/WaitingRoom';
import VideoCall from './screens/VideoCall';
import ConsultationSummary from './screens/ConsultationSummary';
import AdminDashboard from './screens/AdminDashboard';

export default function App() {
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
            <Route path="/settings" element={<Settings />} />
            
            {/* Video Consultation nested routes inside AppShell */}
            <Route path="/doctor/:id" element={<DoctorProfile />} />
            <Route path="/appointment/:id" element={<BookAppointment />} />
            <Route path="/waiting/:appointmentId" element={<WaitingRoom />} />
            <Route path="/consultation/:id" element={<ConsultationSummary />} />
            <Route path="/doctors" element={<Navigate to="/consult" replace />} />
          </Route>
          
          {/* Admin Dashboard */}
          <Route path="/admin" element={<AdminDashboard />} />
          
          {/* Immersive Full Screen Video Consultation outside AppShell */}
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
