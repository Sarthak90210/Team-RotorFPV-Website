import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { FileSpreadsheet, RefreshCw, ExternalLink, CheckCircle2, XCircle, Clock, Save } from 'lucide-react';
import { triggerGoogleSheetsSync } from '../../lib/googleSheetsSync';
import './GoogleSheetsTab.css';

const GoogleSheetsTab = () => {
  const [syncStatus, setSyncStatus] = useState(null);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Form state
  const [webhookUrl, setWebhookUrl] = useState('');
  const [syncKey, setSyncKey] = useState('');
  const [sheetUrl, setSheetUrl] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [triggering, setTriggering] = useState(false);

  useEffect(() => {
    // Listen to status
    const unsubStatus = onSnapshot(doc(db, 'settings', 'google_sheets_status'), (docSnap) => {
      if (docSnap.exists()) {
        setSyncStatus(docSnap.data());
      } else {
        setSyncStatus({ status: 'not_configured' });
      }
    });

    // Listen to config
    const unsubConfig = onSnapshot(doc(db, 'settings', 'google_sheets'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setConfig(data);
        setWebhookUrl(data.webhookUrl || '');
        setSyncKey(data.syncKey || '');
        setSheetUrl(data.sheetUrl || '');
        setEnabled(data.enabled || false);
      } else {
        setConfig({});
      }
      setLoading(false);
    });

    return () => {
      unsubStatus();
      unsubConfig();
    };
  }, []);

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'google_sheets'), {
        webhookUrl,
        syncKey,
        sheetUrl,
        enabled
      }, { merge: true });
      
      // If just enabled and we have credentials, trigger a sync
      if (enabled && webhookUrl && syncKey) {
        handleManualSync();
      }
    } catch (error) {
      alert("Failed to save config: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleManualSync = async () => {
    setTriggering(true);
    try {
      await triggerGoogleSheetsSync();
    } catch (error) {
      alert("Failed to trigger sync: " + error.message);
    } finally {
      setTriggering(false);
    }
  };

  if (loading) {
    return <div className="sheets-tab-container flex-center">Loading...</div>;
  }

  const { status, lastSync, error } = syncStatus || {};
  const isEnabled = config?.enabled;

  const getStatusDisplay = () => {
    if (!isEnabled) return { icon: <FileSpreadsheet color="#6b7280" />, text: 'Disabled', color: '#6b7280' };
    if (status === 'syncing') return { icon: <RefreshCw className="spin" color="#3b82f6" />, text: 'Syncing', color: '#3b82f6' };
    if (status === 'failed') return { icon: <XCircle color="#ef4444" />, text: 'Sync Failed', color: '#ef4444' };
    if (status === 'connected') return { icon: <CheckCircle2 color="#22c55e" />, text: 'Connected', color: '#22c55e' };
    return { icon: <FileSpreadsheet color="#6b7280" />, text: 'Not Configured', color: '#6b7280' };
  };

  const display = getStatusDisplay();
  const formattedDate = lastSync && lastSync.toDate ? lastSync.toDate().toLocaleString() : 'Never';

  return (
    <div className="sheets-tab-container">


      <div className="status-card">
        <div className="status-indicator" style={{ color: display.color }}>
          {display.icon}
          <h3>{display.text}</h3>
        </div>

        <div className="status-details">
          <div className="detail-row">
            <span>Last Sync:</span>
            <span>{formattedDate}</span>
          </div>
          {error && (
            <div className="detail-row error-row">
              <span>Error:</span>
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="status-actions">
          <button 
            className="admin-btn primary" 
            onClick={handleManualSync}
            disabled={triggering || status === 'syncing' || !isEnabled}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <RefreshCw size={16} className={triggering ? 'spin' : ''} />
            {triggering ? 'Syncing...' : 'Sync Now'}
          </button>
          
        </div>
      </div>
      
      <div className="settings-card">
        <h3>Configuration</h3>
        <form onSubmit={handleSaveConfig} className="settings-form">
          <div className="form-group flex-row">
            <input 
              type="checkbox" 
              id="enabledToggle"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <label htmlFor="enabledToggle" style={{ margin: 0, fontWeight: 'bold' }}>Enable Google Sheets Sync</label>
          </div>

          <div className="form-group">
            <label>Apps Script Web App URL</label>
            <input 
              type="text" 
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/..."
              disabled={!enabled}
            />
          </div>

          <div className="form-group">
            <label>Secret Sync Key (X-Sync-Key)</label>
            <input 
              type="password" 
              value={syncKey}
              onChange={(e) => setSyncKey(e.target.value)}
              placeholder="Enter a secure random string..."
              disabled={!enabled}
            />
          </div>

          <div className="form-group">
            <label>Google Sheet URL (for the Open Sheet button)</label>
            <input 
              type="text" 
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              disabled={!enabled}
            />
          </div>

          <button type="submit" className="admin-btn primary save-btn" disabled={saving}>
            <Save size={16} />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default GoogleSheetsTab;
