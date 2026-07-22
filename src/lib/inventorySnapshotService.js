import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Format raw timestamps (ISO strings, Firestore Timestamps, epoch numbers) safely.
 */
export const formatTimestamp = (ts) => {
  if (!ts) return '';
  if (typeof ts === 'string') {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? ts : d.toLocaleString();
  }
  if (typeof ts === 'number') {
    return new Date(ts).toLocaleString();
  }
  if (ts.toDate && typeof ts.toDate === 'function') {
    return ts.toDate().toLocaleString();
  }
  if (ts.toMillis && typeof ts.toMillis === 'function') {
    return new Date(ts.toMillis()).toLocaleString();
  }
  if (ts.seconds) {
    return new Date(ts.seconds * 1000).toLocaleString();
  }
  return '';
};

/**
 * Resolves listId by traversing up parentInventoryId tree if listId is not set directly on sub-inventory.
 */
export const getInventoryListId = (invId, inventories) => {
  let current = inventories.find(i => i.id === invId);
  let depth = 0;
  while (current && depth < 20) {
    if (current.listId) return current.listId;
    current = current.parentInventoryId ? inventories.find(i => i.id === current.parentInventoryId) : null;
    depth++;
  }
  return null;
};

/**
 * Traverses up parentInventoryId tree to find inherited holder & previous holder metadata.
 */
export const resolveInheritedMetadata = (invId, context) => {
  const { inventories, usersMap } = context;
  let current = inventories.find(i => i.id === invId);
  let depth = 0;
  
  let currentHolderEmail = '';
  let previousHolderEmail = '';
  
  while (current && depth < 20) {
    if (!currentHolderEmail && current.currentHolder) {
      currentHolderEmail = current.currentHolder;
    }
    if (!previousHolderEmail && current.previousHolder) {
      previousHolderEmail = current.previousHolder;
    }
    if (currentHolderEmail && previousHolderEmail) break;
    
    current = current.parentInventoryId ? inventories.find(i => i.id === current.parentInventoryId) : null;
    depth++;
  }

  return {
    holder: currentHolderEmail ? (usersMap[currentHolderEmail] || currentHolderEmail) : '',
    holderEmail: currentHolderEmail || '',
    previousHolder: previousHolderEmail ? (usersMap[previousHolderEmail] || previousHolderEmail) : '',
    previousHolderEmail: previousHolderEmail || ''
  };
};

/**
 * Traverses parentInventoryId tree to generate array of breadcrumb names.
 */
export const resolveInventoryPathArray = (invId, context) => {
  const { inventories } = context;
  const path = [];
  let current = inventories.find(i => i.id === invId);
  let depth = 0;

  while (current && depth < 20) {
    path.unshift(current.name);
    current = current.parentInventoryId ? inventories.find(i => i.id === current.parentInventoryId) : null;
    depth++;
  }
  return path;
};

/**
 * Resolves the last modified timestamp & user for an item.
 */
export const resolveLastModified = (item, parentInv, context) => {
  const { historyByItem, usersMap } = context;
  const itemHist = historyByItem[item.id] || [];

  let rawTs = item.updatedAt || item.createdAt;
  let rawUser = item.updatedBy || item.createdBy;

  if ((!rawTs || !rawUser) && itemHist.length > 0) {
    if (!rawTs) rawTs = itemHist[0].timestamp;
    if (!rawUser) rawUser = itemHist[0].userId;
  }
  if (!rawTs) rawTs = parentInv?.updatedAt || parentInv?.createdAt;
  if (!rawUser) rawUser = parentInv?.updatedBy || parentInv?.createdBy;

  return {
    lastModified: formatTimestamp(rawTs),
    modifiedBy: rawUser ? (usersMap[rawUser] || rawUser) : ''
  };
};

/**
 * Resolves previous modified timestamp & user for an item.
 */
export const resolvePreviousModified = (item, context) => {
  const { historyByItem, usersMap } = context;
  const itemHist = historyByItem[item.id] || [];

  let rawTs = item.previousUpdatedAt;
  let rawUser = item.previousUpdatedBy;

  if (!rawTs && itemHist.length > 1) {
    rawTs = itemHist[1].timestamp;
  }
  if (!rawUser && itemHist.length > 1) {
    rawUser = itemHist[1].userId;
  }
  if (!rawTs && itemHist.length === 1 && item.createdAt && item.updatedAt && item.createdAt !== item.updatedAt) {
    rawTs = item.createdAt;
  }
  if (!rawUser && itemHist.length === 1 && item.createdBy && item.updatedBy && item.createdBy !== item.updatedBy) {
    rawUser = item.createdBy;
  }

  return {
    previousModified: formatTimestamp(rawTs),
    previousModifiedBy: rawUser ? (usersMap[rawUser] || rawUser) : ''
  };
};

/**
 * Canonical service function: fetches raw data from Firestore and constructs the canonical snapshot object.
 */
export const getInventorySnapshot = async (filter = {}) => {
  const [listsSnap, invsSnap, itemsSnap, usersSnap, historySnap] = await Promise.all([
    getDocs(collection(db, 'inventory_lists')),
    getDocs(collection(db, 'inventories')),
    getDocs(collection(db, 'items')),
    getDocs(collection(db, 'users')),
    getDocs(collection(db, 'item_history'))
  ]);

  const allLists = listsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const inventories = invsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const items = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const usersMap = {};
  usersSnap.docs.forEach(d => {
    usersMap[d.id] = d.data().name || d.id;
  });

  const historyByItem = {};
  historySnap.docs.forEach(d => {
    const hData = d.data();
    if (hData.itemId) {
      if (!historyByItem[hData.itemId]) historyByItem[hData.itemId] = [];
      historyByItem[hData.itemId].push(hData);
    }
  });

  Object.keys(historyByItem).forEach(itemId => {
    historyByItem[itemId].sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
  });

  const context = { lists: allLists, inventories, items, usersMap, historyByItem };

  const listMap = {};
  allLists.forEach(l => { listMap[l.id] = l; });

  const listsData = {};
  allLists.forEach(l => {
    const listDisplayName = l.isArchived ? `${l.name} (Archived)` : l.name;
    listsData[listDisplayName] = [];
  });

  const allItems = [];
  const uniqueHoldersSet = new Set();
  let assignedItemsCount = 0;
  let unassignedItemsCount = 0;

  items.forEach(item => {
    let parentInv = inventories.find(i => i.id === item.inventoryId);
    let resolvedListId = null;
    let invName = '';

    if (parentInv) {
      resolvedListId = parentInv.listId || getInventoryListId(parentInv.id, inventories);
      invName = parentInv.name || '';
    } else {
      // Fallback: Check if item.inventoryId points directly to a list ID, or item.listId exists
      const directList = listMap[item.inventoryId] || (item.listId ? listMap[item.listId] : null);
      if (directList) {
        resolvedListId = directList.id;
        invName = 'Root Level';
        parentInv = { id: directList.id, name: invName, listId: directList.id };
      } else {
        // Fallback for standalone/unlinked items so NO item is ever lost
        resolvedListId = 'unassigned_standalone';
        invName = 'Unassigned Inventory';
        parentInv = { id: 'unassigned', name: invName, listId: resolvedListId };
      }
    }

    // Apply optional filter
    if (filter.listId && resolvedListId !== filter.listId) return;
    if (filter.inventoryId && parentInv.id !== filter.inventoryId) return;

    const parentList = listMap[resolvedListId] || { id: 'unassigned_standalone', name: 'Unassigned List' };
    const listDisplayName = parentList.isArchived ? `${parentList.name} (Archived)` : parentList.name;

    const pathArray = parentInv.parentInventoryId || (parentInv.id !== parentList.id)
      ? resolveInventoryPathArray(parentInv.id, context)
      : [parentList.name];
    const pathString = pathArray.join(' > ');
    const meta = resolveInheritedMetadata(parentInv.id, context);
    const lastMod = resolveLastModified(item, parentInv, context);
    const prevMod = resolvePreviousModified(item, context);

    const qty = parseInt(item.quantity, 10) || 1;

    if (meta.holder) {
      assignedItemsCount += qty;
      uniqueHoldersSet.add(meta.holderEmail || meta.holder);
    } else {
      unassignedItemsCount += qty;
    }

    const itemObj = {
      id: item.id,
      itemName: item.name || '',
      category: item.category || 'General',
      quantity: qty,
      inventoryId: parentInv.id,
      inventoryName: invName,
      listId: parentList.id,
      listName: parentList.name || 'Unassigned List',
      inventoryPathArray: pathArray,
      inventoryPathString: pathString,
      holder: meta.holder,
      previousHolder: meta.previousHolder,
      lastModified: lastMod.lastModified,
      modifiedBy: lastMod.modifiedBy,
      previousModified: prevMod.previousModified,
      previousModifiedBy: prevMod.previousModifiedBy
    };

    if (!listsData[listDisplayName]) {
      listsData[listDisplayName] = [];
    }
    listsData[listDisplayName].push(itemObj);
    allItems.push(itemObj);
  });

  // Clean up empty archived lists with 0 items
  Object.keys(listsData).forEach(key => {
    if (key.endsWith(' (Archived)') && listsData[key].length === 0) {
      delete listsData[key];
    }
  });

  const subInventoriesCount = inventories.filter(i => !!i.parentInventoryId).length;

  return {
    generatedAt: new Date().toISOString(),
    version: 2,
    summary: {
      totalLists: Object.keys(listsData).length,
      totalInventories: inventories.length,
      totalSubInventories: subInventoriesCount,
      totalItems: allItems.reduce((acc, curr) => acc + (curr.quantity || 1), 0),
      uniqueItemRecords: allItems.length,
      assignedItems: assignedItemsCount,
      unassignedItems: unassignedItemsCount,
      uniqueHolders: uniqueHoldersSet.size
    },
    lists: listsData,
    allItems
  };
};
