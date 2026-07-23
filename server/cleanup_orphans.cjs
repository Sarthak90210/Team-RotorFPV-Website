const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function cleanupOrphans() {
  console.log("Fetching lists...");
  const listsSnap = await db.collection('inventory_lists').get();
  const validListIds = new Set(listsSnap.docs.map(d => d.id));

  console.log("Fetching inventories...");
  const invSnap = await db.collection('inventories').get();
  const allInvs = invSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  const validInvIds = new Set();
  const orphanedInvIds = new Set();
  
  allInvs.forEach(inv => {
    if (validListIds.has(inv.listId)) {
      validInvIds.add(inv.id);
    } else {
      orphanedInvIds.add(inv.id);
    }
  });

  console.log(`Found ${orphanedInvIds.size} orphaned inventories.`);

  let deletedCount = 0;
  for (const invId of orphanedInvIds) {
    await db.collection('inventories').doc(invId).delete();
    deletedCount++;
  }

  console.log("Fetching items...");
  const itemsSnap = await db.collection('items').get();
  for (const itemDoc of itemsSnap.docs) {
    const data = itemDoc.data();
    if (!validInvIds.has(data.inventoryId)) {
      await db.collection('items').doc(itemDoc.id).delete();
      deletedCount++;
    }
  }

  console.log("Fetching item_history...");
  const itemHistSnap = await db.collection('item_history').get();
  for (const histDoc of itemHistSnap.docs) {
    const data = histDoc.data();
    if (!validInvIds.has(data.inventoryId)) {
      await db.collection('item_history').doc(histDoc.id).delete();
      deletedCount++;
    }
  }

  console.log("Fetching inventory_hold_history...");
  const holdHistSnap = await db.collection('inventory_hold_history').get();
  for (const holdDoc of holdHistSnap.docs) {
    const data = holdDoc.data();
    if (!validInvIds.has(data.inventoryId)) {
      await db.collection('inventory_hold_history').doc(holdDoc.id).delete();
      deletedCount++;
    }
  }

  console.log(`Successfully deleted ${deletedCount} orphaned records.`);
}

cleanupOrphans().then(() => {
  console.log('Done!');
  process.exit(0);
}).catch(console.error);
