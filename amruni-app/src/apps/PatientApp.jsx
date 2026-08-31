import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { VideoProvider } from '../context/VideoContext';
import { MoodProvider } from '../context/MoodContext';

import AppShell from '../components/AppShell';
import Splash from '../screens/Splash';
import PhoneEntry from '../screens/PhoneEntry';
import OTPVerify from '../screens/OTPVerify';
import PrivacyFirst from '../screens/onboarding/PrivacyFirst';
import NameStep from '../screens/onboarding/NameStep';
import DobStep from '../screens/onboarding/DobStep';
import GoalsStep from '../screens/onboarding/GoalsStep';
import HealthStep from '../screens/onboarding/HealthStep';
import Home from '../screens/Home';
import Telemedicine from '../screens/Telemedicine';
import MentalHealth from '../screens/MentalHealth';
import Track from '../screens/Track';
import Settings from '../screens/Settings';
import SOSCenter from '../screens/SOSCenter';
import PcosCheck from '../screens/PcosCheck';
import ComingSoon from '../screens/ComingSoon';
import Journal from '../screens/Journal';
import Medicines from '../screens/Medicines';
import CareView from '../screens/CareView';
import CareActivity from '../screens/CareActivity';
import JournalComposer from '../screens/JournalComposer';
import JournalEntry from '../screens/JournalEntry';
import Community from '../screens/Community';
import CommunityThread from '../screens/CommunityThread';
import Therapies from '../screens/Therapies';
import TherapyDetail from '../screens/TherapyDetail';
import IntakeForm from '../screens/IntakeForm';
import Insurance from '../screens/Insurance';
import ClaimReceipt from '../screens/ClaimReceipt';

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
              {/* Her side of the care thread. Distinct from /care/:token, which
                  is the recipient's unauthenticated view of the same events. */}
              <Route path="/care-activity" element={<CareActivity />} />
              <Route path="/medicines" element={<Medicines />} />
            <Route path="/journal" element={<Journal />} />
              <Route path="/community" element={<Community />} />
              <Route path="/community/:id" element={<CommunityThread />} />

              {/* Traditional care: ayurveda, yoga, reiki */}
              <Route path="/therapies" element={<Therapies />} />
              <Route path="/therapies/:id" element={<TherapyDetail />} />

              {/* Who pays, and what a reimbursement claim needs */}
              <Route path="/insurance" element={<Insurance />} />
              <Route path="/receipt/:appointmentId" element={<ClaimReceipt />} />

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

          {/* Intake forms sit outside the shell for the same reason the journal
              composer does. This one runs to forty questions and ends with a
              section about being hurt as a child; a tab bar and a floating
              emergency button over that page are chrome interrupting something
              that deserves the whole screen. Its own footer owns the bottom. */}
          <Route
            path="/intake/:formId"
            element={isAuthenticated && isOnboarded
              ? <IntakeForm />
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
