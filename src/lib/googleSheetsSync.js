import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { getInventorySnapshot } from './inventorySnapshotService';
import { EXPORT_COLUMNS } from './exportColumns';

export const triggerGoogleSheetsSync = async () => {
  // 1. Fetch config
  const configDoc = await getDoc(doc(db, 'settings', 'google_sheets'));
  if (!configDoc.exists()) {
    console.warn("Google Sheets config missing in Firestore.");
    return { success: false, error: "Google Sheets configuration document does not exist in Firestore settings." };
  }
  
  const config = configDoc.data();
  if (!config.enabled) {
    console.warn("Google Sheets sync is disabled.");
    return { success: false, error: "Google Sheets Sync is disabled in Admin configuration. Please check 'Enable Google Sheets Sync' and click Save." };
  }
  if (!config.webhookUrl || !config.webhookUrl.trim()) {
    console.warn("Google Sheets webhookUrl missing.");
    return { success: false, error: "Apps Script Web App URL is missing in Admin configuration." };
  }
  if (!config.syncKey || !config.syncKey.trim()) {
    console.warn("Google Sheets syncKey missing.");
    return { success: false, error: "Secret Sync Key is missing in Admin configuration." };
  }

  const cleanUrl = config.webhookUrl.trim();
  const cleanKey = config.syncKey.trim();

  console.log('Google Sheets Sync triggered. Fetching canonical snapshot...');
  
  try {
    // Update status to syncing
    await setDoc(doc(db, 'settings', 'google_sheets_status'), { 
      status: 'syncing', 
      lastAttempt: serverTimestamp() 
    }, { merge: true });

    // 2. Obtain canonical snapshot from single source of truth
    const snapshot = await getInventorySnapshot();

    console.log(`Snapshot generated. Total items: ${snapshot.summary.totalItems}, Lists: ${snapshot.summary.totalLists}`);

    // 3. Construct Version 2 Payload
    const payload = {
      version: 2,
      syncKey: cleanKey,
      generatedAt: snapshot.generatedAt,
      summary: snapshot.summary,
      columns: EXPORT_COLUMNS.map(c => ({ key: c.key, header: c.header })),
      lists: snapshot.lists
    };

    // 4. Dispatch to Apps Script Webhook
    await fetch(cleanUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });

    console.log('Google Sheets Sync fetch request dispatched successfully.');

    await setDoc(doc(db, 'settings', 'google_sheets_status'), { 
      status: 'connected', 
      lastSync: serverTimestamp(),
      error: null 
    }, { merge: true });

    return { success: true, snapshot };

  } catch (error) {
    console.error('Google Sheets Sync Failed:', error);
    await setDoc(doc(db, 'settings', 'google_sheets_status'), { 
      status: 'failed', 
      error: error.message 
    }, { merge: true });
    return { success: false, error: error.message };
  }
};
