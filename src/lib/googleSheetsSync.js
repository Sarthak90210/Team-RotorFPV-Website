import { collection, getDocs, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export const triggerGoogleSheetsSync = async () => {
  // Fetch config
  const configDoc = await getDoc(doc(db, 'settings', 'google_sheets'));
  if (!configDoc.exists()) {
    console.warn("Google Sheets config missing.");
    return { success: false, error: "Not configured" };
  }
  
  const config = configDoc.data();
  if (!config.enabled || !config.webhookUrl || !config.syncKey) {
    console.warn("Google Sheets sync is disabled or missing credentials.");
    return { success: false, error: "Not configured fully" };
  }

  console.log('Google Sheets Sync triggered. Fetching full inventory...');
  
  try {
    // Update status to syncing
    await setDoc(doc(db, 'settings', 'google_sheets_status'), { status: 'syncing', lastAttempt: serverTimestamp() }, { merge: true });

    // 1. Fetch all data
    const [listsSnap, invsSnap, itemsSnap, usersSnap] = await Promise.all([
      getDocs(collection(db, 'inventory_lists')),
      getDocs(collection(db, 'inventories')),
      getDocs(collection(db, 'items')),
      getDocs(collection(db, 'users'))
    ]);

    const lists = listsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(l => !l.isArchived);
    const inventories = invsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const items = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const usersMap = {};
    usersSnap.docs.forEach(d => {
      usersMap[d.id] = d.data().name || d.id;
    });

    const listMap = {};
    lists.forEach(l => listMap[l.id] = l);

    const listsData = {};
    lists.forEach(l => listsData[l.name] = []);

    const getInventoryPathStr = (invId) => {
      const path = [];
      let current = inventories.find(i => i.id === invId);
      let depth = 0;
      while (current && depth < 20) {
        path.unshift(current.name);
        if (current.parentInventoryId) {
          current = inventories.find(i => i.id === current.parentInventoryId);
        } else {
          current = null;
        }
        depth++;
      }
      return path.join(' > ');
    };

    items.forEach(item => {
      const parentInv = inventories.find(i => i.id === item.inventoryId);
      if (!parentInv) return;
      const parentList = listMap[parentInv.listId];
      if (!parentList) return;

      listsData[parentList.name].push({
        name: item.name,
        category: item.category || '',
        subInventory: getInventoryPathStr(parentInv.id),
        quantity: item.quantity,
        holder: usersMap[parentInv.currentHolder] || parentInv.currentHolder || '',
        previousHolder: usersMap[parentInv.previousHolder] || parentInv.previousHolder || '',
        lastModified: item.updatedAt ? new Date(item.updatedAt.toMillis()).toLocaleString() : '',
        modifiedBy: item.updatedBy || ''
      });
    });

    // 2. Post to Webhook
    const payload = {
      syncKey: config.syncKey,
      lists: listsData
    };

    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });

    // With no-cors, response is opaque. We assume success if fetch didn't throw a network error.
    await setDoc(doc(db, 'settings', 'google_sheets_status'), { 
      status: 'connected', 
      lastSync: serverTimestamp(),
      error: null 
    }, { merge: true });
    return { success: true };

  } catch (error) {
    console.error('Google Sheets Sync Failed:', error);
    await setDoc(doc(db, 'settings', 'google_sheets_status'), { 
      status: 'failed', 
      error: error.message 
    }, { merge: true });
    return { success: false, error: error.message };
  }
};
