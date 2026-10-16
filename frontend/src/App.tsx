import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/lib/auth';
import { Toaster } from '@/components/ui/sonner';
import '@/styles.css';

import ContextSelection from '@/pages/ContextSelection';
import HODShell from '@/pages/hod/HODShell';
import FacultyShell from '@/pages/faculty/FacultyShell';
import AdminShell from '@/pages/admin/AdminShell';
import NotFound from '@/pages/NotFound';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Landing / Context Selection */}
          <Route path="/" element={<ContextSelection />} />
          <Route path="/login" element={<Navigate to="/" replace />} />

          {/* Super Admin Routes */}
          <Route path="/admin/*" element={<AdminShell />} />

          {/* HOD Routes */}
          <Route path="/hod/*" element={<HODShell />} />

          {/* Faculty Routes */}
          <Route path="/faculty/*" element={<FacultyShell />} />

          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
