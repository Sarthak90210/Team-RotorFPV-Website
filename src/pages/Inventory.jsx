import React, { useState, useEffect } from 'react';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import './Admin.css'; // Reusing the exact same UI styles as the Admin panel

import InventoryListsTab from '../components/inventory/InventoryListsTab';

const Inventory = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageTitle, setPageTitle] = useState('Inventory Lists');

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
          <h2>Inventory Access</h2>
          <p>Please sign in to manage the inventory.</p>
          <button onClick={handleLogin} className="google-login-btn">
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  // Security UX check based on custom claims
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

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1>{pageTitle}</h1>
        <div className="user-info">
          <span className="user-email">{user.email}</span>
          <button onClick={handleLogout} className="admin-btn secondary">Sign Out</button>
        </div>
      </div>

      <div className="admin-content">
        <InventoryListsTab user={user} setPageTitle={setPageTitle} />
      </div>
    </div>
  );
};

export default Inventory;
