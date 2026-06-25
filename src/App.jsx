import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useIsMobile } from './hooks/useIsMobile';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Achievements from './pages/Achievements';
import Events from './pages/Events';
import Admin from './pages/Admin';
import Gallery from './pages/Gallery';
import Board from './pages/Board';
import SponsorUs from './pages/SponsorUs';
import FormalAchievements from './pages/FormalAchievements';
import ViewDropdown from './components/ViewDropdown';
import Silk from './components/Silk';
import MobileOverlay from './components/MobileOverlay';

// The contact form moved to the home page. Keep old /contact links working by
// redirecting to home and scrolling to the contact section.
function ContactRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/', { replace: true });
    const t = setTimeout(() => {
      document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
    }, 350);
    return () => clearTimeout(t);
  }, [navigate]);
  return null;
}

// The interactive FPV experience is desktop-only — on phones it's heavy and the
// scroll-driven flight doesn't translate to touch, so we fall back to the formal
// achievements page (the default achievements view on mobile).
function InteractiveAchievementsRoute() {
  const isMobile = useIsMobile();
  if (isMobile) return <Navigate to="/achievements" replace />;
  return <Achievements />;
}

function AppContent() {
  const location = useLocation();
  const isInteractiveAchievementsPage = location.pathname === '/interactive-achievements';

  // Record a page view on every route change. Fire-and-forget: failures never
  // affect the page. The admin dashboard is excluded so staff visits aren't
  // counted as traffic. The backend resolves the real IP + geolocation.
  useEffect(() => {
    if (location.pathname.startsWith('/admin')) return;
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    fetch(`${apiUrl}/api/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: location.pathname }),
      keepalive: true,
    }).catch(() => {});
  }, [location.pathname]);

  return (
    <>
      {false && <MobileOverlay />}
      <div className="app-background">
        <Silk
          speed={3.7}
          scale={1}
          color="#022e5223"
          noiseIntensity={1.3}
          rotation={0}
        />
      </div>
      <Navbar />
      <ViewDropdown />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/achievements" element={<FormalAchievements />} />
          <Route path="/interactive-achievements" element={<InteractiveAchievementsRoute />} />
          <Route path="/board" element={<Board />} />
          <Route path="/sponsor-us" element={<SponsorUs />} />
          <Route path="/events" element={<Events />} />
          <Route path="/contact" element={<ContactRedirect />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </main>
      {!isInteractiveAchievementsPage && <Footer />}
    </>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
