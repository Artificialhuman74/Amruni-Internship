import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';

import DoctorLogin from '../screens/doctor/DoctorLogin';
import DoctorShell from '../screens/doctor/DoctorShell';
import DoctorToday from '../screens/doctor/DoctorToday';
import DoctorSchedule from '../screens/doctor/DoctorSchedule';
import DoctorPatients from '../screens/doctor/DoctorPatients';
import DoctorPatientChart from '../screens/doctor/DoctorPatientChart';
import DoctorRecordEditor from '../screens/doctor/DoctorRecordEditor';
import DoctorAccount from '../screens/doctor/DoctorAccount';

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
