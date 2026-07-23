import { Routes, Route, Navigate } from 'react-router-dom';
import AdminDashboard from '../screens/AdminDashboard';

/** The admin portal, deployed on its own domain. Password login is verified
 *  server-side (POST /api/admin/login) — see server/app/auth.py. */
export default function AdminApp() {
  return (
    <Routes>
      <Route path="/" element={<AdminDashboard />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
