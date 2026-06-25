import React, { useState, useEffect } from 'react';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import HomeSettingsTab from '../components/admin/HomeSettingsTab';
import EventsTab from '../components/admin/EventsTab';
import AchievementsTab from '../components/admin/AchievementsTab';
import GalleryTab from '../components/admin/GalleryTab';
import TeamTab from '../components/admin/TeamTab';
import SponsorsTab from '../components/admin/SponsorsTab';
import AdminsTab from '../components/admin/AdminsTab';
import TrafficTab from '../components/admin/TrafficTab';
import ContactMessagesAdmin from '../components/ContactMessagesAdmin';
import PillNav from '../components/PillNav';
import './Admin.css';

const TABS = [
  { key: 'home', label: 'Home Page Settings' },
  { key: 'achievements', label: 'Achievements' },
  { key: 'gallery', label: 'Gallery' },
  { key: 'team', label: 'Board' },
  { key: 'events', label: 'Events' },
  { key: 'sponsors', label: 'Sponsors' },
  { key: 'contact_messages', label: 'Contact Messages' },
  { key: 'traffic', label: 'Traffic' },
  { key: 'admins', label: 'Manage Admins', superAdminOnly: true },
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
      case 'sponsors': return <SponsorsTab user={user} />;
      case 'contact_messages': return <ContactMessagesAdmin />;
      case 'traffic': return <TrafficTab />;
      case 'admins': return user.isSuperAdmin ? <AdminsTab user={user} /> : null;
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
