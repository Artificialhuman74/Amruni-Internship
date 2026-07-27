import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useApp } from '../providers/AppContext'
import { VideoProvider } from '../providers/VideoContext'
import { MoodProvider } from '../providers/MoodContext'

import AppShell from '../layouts/AppShell';
import Splash from '../../features/auth/screens/Splash'
import PhoneEntry from '../../features/auth/screens/PhoneEntry'
import OTPVerify from '../../features/auth/screens/OTPVerify'
import PrivacyFirst from '../../features/auth/screens/PrivacyFirst'
import NameStep from '../../features/auth/screens/NameStep'
import DobStep from '../../features/auth/screens/DobStep'
import GoalsStep from '../../features/auth/screens/GoalsStep'
import HealthStep from '../../features/auth/screens/HealthStep'
import Home from '../../features/dashboard/Home'
import Telemedicine from '../../features/telemedicine/Telemedicine'
import MentalHealth from '../../features/cycle-tracker/MentalHealth'
import Track from '../../features/cycle-tracker/Track'
import Settings from '../../features/settings/Settings'
import SOSCenter from '../../features/sos/SOSCenter'
import PcosCheck from '../../features/pcos/PcosCheck'
import ComingSoon from '../../components/common/ComingSoon';
import Journal from '../../features/journal/Journal'
import Medicines from '../../features/medicines/Medicines'
import CareView from '../../features/care/CareView'
import JournalComposer from '../../features/journal/JournalComposer'
import JournalEntry from '../../features/journal/JournalEntry'
import Community from '../../features/community/Community'
import CommunityThread from '../../features/community/CommunityThread'

import DoctorProfile from '../../features/telemedicine/DoctorProfile'
import BookAppointment from '../../features/telemedicine/BookAppointment'
import WaitingRoom from '../../features/telemedicine/WaitingRoom'
import VideoCall from '../../features/telemedicine/VideoCall'
import ConsultationSummary from '../../features/telemedicine/ConsultationSummary'

/** The patient-facing app. Deployed standalone; the practitioner console and
 *  the admin portal are separate builds (see src/apps/). */
export default function PatientApp() {
  const location = useLocation();
  const { state } = useApp();
  const { isAuthenticated } = state.auth;
  const { isOnboarded } = state.user;

  return (
    <VideoProvider>
      <MoodProvider>
        <AnimatePresence mode="wait" initial={false}>
          <Routes location={location} key={location.pathname}>
            {/* A care link is opened by a family member with no account — so it
              sits outside the auth guard and the tab shell entirely. */}
          <Route path="/care/:token" element={<CareView />} />

          <Route path="/" element={<Splash />} />
            <Route path="/phone" element={<PhoneEntry />} />
            <Route path="/otp" element={<OTPVerify />} />
            {['privacy', 'name', 'dob', 'health', 'goals'].map((step, i) => (
              <Route
                key={step}
                path={`/onboarding/${step}`}
                element={isAuthenticated
                  ? [<PrivacyFirst />, <NameStep />, <DobStep />, <HealthStep />, <GoalsStep />][i]
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
              <Route path="/track" element={<Track />} />
              <Route path="/sos" element={<SOSCenter />} />
              <Route path="/pcos-check" element={<PcosCheck />} />
              <Route path="/coming-soon" element={<ComingSoon />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/medicines" element={<Medicines />} />
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

            {/* Writing and reading an entry own the whole screen. Outside the
              shell means no tab bar and no emergency button over the page —
              the only two things in the app that never step aside otherwise.
              A journal that is interrupted by its own chrome isn't private. */}
          {['/journal/new', '/journal/:id/edit'].map((path) => (
            <Route
              key={path}
              path={path}
              element={isAuthenticated && isOnboarded
                ? <JournalComposer />
                : <Navigate to="/phone" replace />}
            />
          ))}
          <Route
            path="/journal/:id"
            element={isAuthenticated && isOnboarded
              ? <JournalEntry />
              : <Navigate to="/phone" replace />}
          />

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
      </MoodProvider>
    </VideoProvider>
  );
}
