import React, { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { ExternalLink } from 'lucide-react';

const OpenSheetButton = () => {
  const [sheetUrl, setSheetUrl] = useState('');
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    const unsubConfig = onSnapshot(doc(db, 'settings', 'google_sheets'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSheetUrl(data.sheetUrl || '');
        setIsEnabled(data.enabled || false);
      }
    });
    return () => unsubConfig();
  }, []);

  if (!isEnabled) return null;

  return (
    <button 
      type="button" 
      className="admin-btn secondary" 
      onClick={() => sheetUrl ? window.open(sheetUrl, '_blank') : window.open('https://docs.google.com/spreadsheets', '_blank')}
      style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
      title="Open Google Sheets Mirror"
    >
      <ExternalLink size={16} /> Open Sheet
    </button>
  );
};

export default OpenSheetButton;
