import React, { useState, useEffect } from 'react';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import './Admin.css'; // Reusing the exact same UI styles as the Admin panel

import { InventoryProvider } from '../components/inventory/InventoryContext';
import InventoryLayout from '../components/inventory/InventoryLayout';
import OpenSheetButton from '../components/inventory/OpenSheetButton';

const Inventory = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessDeniedEmail, setAccessDeniedEmail] = useState('');

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
        const isAdmin = token.claims.admin === true;
        const isSuperAdmin = token.claims.superAdmin === true;

        if (!isAdmin) {
          setAccessDeniedEmail(currentUser.email);
          await signOut(auth);
          setLoading(false);
          return;
        }

        setUser({
          uid: currentUser.uid,
          email: currentUser.email,
          displayName: currentUser.displayName,
          isAdmin,
          isSuperAdmin
        });
        setAccessDeniedEmail('');
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
    provider.setCustomParameters({
      prompt: 'select_account'
    });
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
      setAccessDeniedEmail('');
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

  if (accessDeniedEmail) {
    return (
      <div className="admin-container flex-center">
        <div className="admin-glass-panel login-panel">
          <h2 style={{ color: '#ff4d4f' }}>Access Denied</h2>
          <p>Your account (<strong>{accessDeniedEmail}</strong>) doesn't have admin privileges.</p>
          <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button onClick={() => setAccessDeniedEmail('')} className="admin-btn secondary">Try Another Account</button>
          </div>
        </div>
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

  return (
    <div className="admin-container">
      <div className="admin-header" style={{ paddingBottom: '0', borderBottom: 'none' }}>
        <OpenSheetButton />
        <div className="user-info">
          <span className="user-email">{user.email}</span>
          <button onClick={handleLogout} className="admin-btn secondary">Sign Out</button>
        </div>
      </div>

      <div className="admin-content" style={{ padding: '0 20px 20px' }}>
        <InventoryProvider user={user}>
          <InventoryLayout />
        </InventoryProvider>
      </div>
    </div>
  );
};

export default Inventory;
