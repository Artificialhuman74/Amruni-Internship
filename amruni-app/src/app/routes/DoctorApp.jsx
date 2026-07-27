import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';

import DoctorLogin from '../../features/auth/screens/DoctorLogin'
import DoctorShell from '../../features/telemedicine/DoctorShell'
import DoctorToday from '../../features/telemedicine/DoctorToday'
import DoctorSchedule from '../../features/telemedicine/DoctorSchedule'
import DoctorPatients from '../../features/telemedicine/DoctorPatients'
import DoctorPatientChart from '../../features/telemedicine/DoctorPatientChart'
import DoctorRecordEditor from '../../features/telemedicine/DoctorRecordEditor'
import DoctorAccount from '../../features/telemedicine/DoctorAccount'

/** The practitioner console, deployed on its own domain. Routes sit at the
 *  root here — no /doctor prefix, since the whole site is the console. */
export default function DoctorApp() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<DoctorLogin />} />
        <Route element={<DoctorShell />}>
          <Route path="/today" element={<DoctorToday />} />
          <Route path="/schedule" element={<DoctorSchedule />} />
          <Route path="/patients" element={<DoctorPatients />} />
          <Route path="/patients/:userId" element={<DoctorPatientChart />} />
          <Route path="/record/:appointmentId" element={<DoctorRecordEditor />} />
          <Route path="/account" element={<DoctorAccount />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}
