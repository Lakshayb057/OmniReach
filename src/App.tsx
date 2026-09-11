import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ThemeProvider } from './context/ThemeContext';
import { Sidebar } from './components/Layout/Sidebar';
import { CampaignWizardModal } from './components/Wizard/CampaignWizardModal';

import { LandingPage } from './pages/LandingPage';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { MasterDataCenter } from './pages/MasterDataCenter';
import { BroadcastsManager } from './pages/BroadcastsManager';
import { TemplatesStudio } from './pages/TemplatesStudio';
import { GatewaySettings } from './pages/GatewaySettings';
import { SuperadminSettings } from './pages/SuperadminSettings';
import { UsersManagement } from './pages/UsersManagement';
import { JourneyBuilder } from './pages/JourneyBuilder';
import { WhatsAppInbox } from './pages/WhatsAppInbox';
import { PublicContactCenter } from './pages/PublicContactCenter';
import { PublicUnsubscribe } from './pages/PublicUnsubscribe';

// Route Tracker component to persist active path on reload
const RoutePersistenceTracker: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    if (
      location.pathname !== '/' &&
      location.pathname !== '/login' &&
      location.pathname !== '/contact-center' &&
      location.pathname !== '/unsubscribe'
    ) {
      localStorage.setItem('last_active_route', location.pathname);
    }
  }, [location]);

  return null;
};

const ProtectedLayout: React.FC<{ children: (openWizard: () => void) => React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#070b14] flex items-center justify-center text-slate-400 text-xs font-semibold">
        Connecting to OmniReach Node...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#070b14] text-slate-100 selection:bg-blue-600 selection:text-white">
      <Sidebar />
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        <main className="flex-1 h-full overflow-y-auto overflow-x-hidden min-w-0">
          {children(() => setIsWizardOpen(true))}
        </main>
      </div>

      {/* Global 6-Step Campaign Creation Wizard */}
      <CampaignWizardModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onSuccess={() => setIsWizardOpen(false)}
      />
    </div>
  );
};

export const AppContent: React.FC = () => {
  const { isAuthenticated } = useAuth();

  return (
    <>
      <RoutePersistenceTracker />
      <Routes>
        {/* Public Product Overview & Landing Page at localhost:5000 */}
        <Route path="/" element={<LandingPage />} />

        {/* Public Auth & Preference Portals */}
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate
                to={localStorage.getItem('last_active_route') || '/dashboard'}
                replace
              />
            ) : (
              <Login />
            )
          }
        />
        <Route path="/contact-center" element={<PublicContactCenter />} />
        <Route path="/unsubscribe" element={<PublicUnsubscribe />} />

        {/* Protected App Modules */}
        <Route
          path="/dashboard"
          element={
            <ProtectedLayout>
              {(openWizard) => <Dashboard onOpenWizard={openWizard} />}
            </ProtectedLayout>
          }
        />
        <Route
          path="/inbox"
          element={
            <ProtectedLayout>
              {() => <WhatsAppInbox />}
            </ProtectedLayout>
          }
        />
        <Route
          path="/journeys"
          element={
            <ProtectedLayout>
              {() => <JourneyBuilder />}
            </ProtectedLayout>
          }
        />
        <Route
          path="/leads"
          element={
            <ProtectedLayout>
              {() => <MasterDataCenter />}
            </ProtectedLayout>
          }
        />
        <Route
          path="/broadcasts"
          element={
            <ProtectedLayout>
              {(openWizard) => <BroadcastsManager onOpenWizard={openWizard} />}
            </ProtectedLayout>
          }
        />
        <Route
          path="/templates"
          element={
            <ProtectedLayout>
              {() => <TemplatesStudio />}
            </ProtectedLayout>
          }
        />
        <Route
          path="/gateways"
          element={
            <ProtectedLayout>
              {() => <GatewaySettings />}
            </ProtectedLayout>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedLayout>
              {() => <UsersManagement />}
            </ProtectedLayout>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedLayout>
              {() => <SuperadminSettings />}
            </ProtectedLayout>
          }
        />

        {/* Fallback to Last Active Route or Landing */}
        <Route
          path="*"
          element={
            isAuthenticated ? (
              <Navigate to={localStorage.getItem('last_active_route') || '/dashboard'} replace />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
      </Routes>
    </>
  );
};

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SocketProvider>
          <Router>
            <AppContent />
          </Router>
        </SocketProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
