import React, { useState, useEffect } from 'react';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import HomeSettingsTab from '../components/admin/HomeSettingsTab';
import EventsTab from '../components/admin/EventsTab';
import DronesTab from '../components/admin/DronesTab';
import AchievementsTab from '../components/admin/AchievementsTab';
import GalleryTab from '../components/admin/GalleryTab';
import TeamTab from '../components/admin/TeamTab';
import SponsorsTab from '../components/admin/SponsorsTab';
import TeamMembersTab from '../components/admin/TeamMembersTab';
import TrafficTab from '../components/admin/TrafficTab';
import ContactMessagesAdmin from '../components/ContactMessagesAdmin';
import LogsTab from '../components/admin/LogsTab';
import GoogleSheetsTab from '../components/admin/GoogleSheetsTab';
import PillNav from '../components/PillNav';
import './Admin.css';

const TABS = [
  { key: 'gallery', label: 'Gallery' },
  { key: 'sponsors', label: 'Sponsor Us' },
  { key: 'drones', label: 'Drones' },
  { key: 'home', label: 'Home Page' },
  { key: 'achievements', label: 'Achievements' },
  { key: 'team', label: 'Board' },
  { key: 'events', label: 'Events' },
  { key: 'google_sheets', label: 'Google Sheets', superAdminOnly: true },
  { key: 'contact_messages', label: 'Messages' },
  { key: 'traffic', label: 'Traffic' },
  { key: 'team_members', label: 'Team', superAdminOnly: true },
  { key: 'logs', label: 'Logs', superAdminOnly: true },
];

const Admin = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('achievements');

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        // Fetch custom claims to check if the user is an admin
        const token = await currentUser.getIdTokenResult();
        setUser({
          ...currentUser,
          isAdmin: token.claims.admin === true,
          isSuperAdmin: token.claims.superAdmin === true
        });
      } catch (error) {
        console.error("Error checking claims:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login Error:", error);
      alert("Failed to login: " + error.message);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  if (loading) {
    return (
      <div className="admin-container flex-center">
        <div className="loading-spinner">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="admin-container flex-center">
        <div className="admin-glass-panel login-panel">
          <h2>Admin Access</h2>
          <p>Please sign in to manage achievements, gallery, and admins.</p>
          <button onClick={handleLogin} className="google-login-btn">
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  // Security UX check based on custom claims (real enforcement is server-side)
  if (!user.isAdmin) {
    return (
      <div className="admin-container flex-center">
        <div className="admin-glass-panel login-panel">
          <h2>Access Denied</h2>
          <p>Your account (<strong>{user.email}</strong>) doesn't have admin privileges.</p>
          <button onClick={handleLogout} className="admin-btn secondary">Sign Out</button>
        </div>
      </div>
    );
  }

  const visibleTabs = TABS.filter(tab => !tab.superAdminOnly || user.isSuperAdmin);

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'home': return <HomeSettingsTab user={user} />;
      case 'achievements': return <AchievementsTab />;
      case 'gallery': return <GalleryTab />;
      case 'team': return <TeamTab />;
      case 'events': return <EventsTab user={user} />;
      case 'drones': return <DronesTab user={user} />;
      case 'sponsors': return <SponsorsTab user={user} />;
      case 'google_sheets': return user.isSuperAdmin ? <GoogleSheetsTab /> : null;
      case 'contact_messages': return <ContactMessagesAdmin />;
      case 'traffic': return <TrafficTab />;
      case 'team_members': return user.isSuperAdmin ? <TeamMembersTab user={user} /> : null;
      case 'logs': return user.isSuperAdmin ? <LogsTab /> : null;
      default: return null;
    }
  };

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1>Dashboard</h1>
        <div className="user-info">
          <span className="user-email">{user.email}</span>
          <button onClick={handleLogout} className="admin-btn secondary">Sign Out</button>
        </div>
      </div>

      <div className="admin-tabs">
        <PillNav
          items={visibleTabs.map(tab => ({ key: tab.key, label: tab.label }))}
          activeKey={activeTab}
          onItemClick={setActiveTab}
        />
      </div>

      <div className="admin-content">
        {renderActiveTab()}
      </div>
    </div>
  );
};

export default Admin;
