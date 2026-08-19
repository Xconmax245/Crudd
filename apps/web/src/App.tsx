import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { lazy, Suspense } from 'react';
import { Toaster } from 'sonner';

import LoadingBlob from './components/LoadingBlob';

// Route-level code splitting (readiness P2): each page becomes its own chunk so
// the initial bundle stays under the 500 kB warning threshold. The heavy match
// experience (motion/react animations) only loads when a player enters a room.
const Browse = lazy(() => import('./pages/Browse'));
const Configure = lazy(() => import('./pages/Configure'));
const Challenge = lazy(() => import('./pages/Challenge'));
const MatchRoom = lazy(() => import('./pages/MatchRoom'));

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <LoadingBlob />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-cream text-ink font-body">
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Browse />} />
            <Route path="/banks/:id/configure" element={<Configure />} />
            <Route path="/challenge/:slug" element={<Challenge />} />
            <Route path="/challenge/:slug/play" element={<MatchRoom />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </div>
      <Toaster position="bottom-center" />
    </BrowserRouter>
  );
}

export default App;
