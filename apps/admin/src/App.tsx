import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { useAuth } from './stores/auth';
import { Spinner } from './components/ui';
import Shell from './components/Shell';
import Login from './pages/Login';
import Overview from './pages/Overview';
import Banks from './pages/Banks';
import BankDetail from './pages/BankDetail';
import Questions from './pages/Questions';
import ImportQuestions from './pages/ImportQuestions';
import Challenges from './pages/Challenges';
import ChallengeDetail from './pages/ChallengeDetail';
import Participants from './pages/Participants';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import AuditLog from './pages/AuditLog';

function Protected({ children }: { children: React.ReactNode }) {
  const { me, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }
  if (!me) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const refresh = useAuth((s) => s.refresh);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <Protected>
              <Shell />
            </Protected>
          }
        >
          <Route index element={<Overview />} />
          <Route path="banks" element={<Banks />} />
          <Route path="banks/:id" element={<BankDetail />} />
          <Route path="banks/:id/import" element={<ImportQuestions />} />
          <Route path="questions" element={<Questions />} />
          <Route path="challenges" element={<Challenges />} />
          <Route path="challenges/:id" element={<ChallengeDetail />} />
          <Route path="participants" element={<Participants />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="settings" element={<Settings />} />
          <Route path="audit" element={<AuditLog />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
