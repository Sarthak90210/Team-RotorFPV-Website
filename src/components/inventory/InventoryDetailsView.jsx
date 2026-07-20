import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { logInventoryAction } from '../../lib/inventoryApi';

const InventoryDetailsView = ({ inventory: initialInventory, user, goBack }) => {
  const [inventory, setInventory] = useState(initialInventory);
  const [items, setItems] = useState([]);
  const [holdHistory, setHoldHistory] = useState([]);
  const [itemHistory, setItemHistory] = useState([]);
  const [users, setUsers] = useState([]);
  
  const [newItemName, setNewItemName] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState(1);
  
  const [newHolderEmail, setNewHolderEmail] = useState('');

  // Item Edit State
  const [editingItemId, setEditingItemId] = useState(null);
  const [editingQuantity, setEditingQuantity] = useState(1);

  const [movingItemId, setMovingItemId] = useState(null);
  const [targetInventoryId, setTargetInventoryId] = useState('');
  const [allInventories, setAllInventories] = useState([]);
  const [allLists, setAllLists] = useState([]);

  // Conflict State for Move
  const [moveConflictState, setMoveConflictState] = useState(null);

  useEffect(() => {
    // 1. Subscribe to the live inventory document
    const unsubInv = onSnapshot(doc(db, 'inventories', initialInventory.id), (docSnap) => {
      if (docSnap.exists()) {
        setInventory({ id: docSnap.id, ...docSnap.data() });
      }
    });

    // 2. Subscribe to items and sort locally
    const qItems = query(collection(db, 'items'), where('inventoryId', '==', initialInventory.id));
    const unsubItems = onSnapshot(qItems, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setItems(data);
    });

    // 3. Subscribe to hold history and sort locally
    const qHoldHistory = query(collection(db, 'inventory_hold_history'), where('inventoryId', '==', initialInventory.id));
    const unsubHold = onSnapshot(qHoldHistory, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => new Date(b.assignedDate) - new Date(a.assignedDate));
      setHoldHistory(data);
    });

    // 4. Subscribe to item history and sort locally
    const qItemHistory = query(collection(db, 'item_history'), where('inventoryId', '==', initialInventory.id));
    const unsubItemHistory = onSnapshot(qItemHistory, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setItemHistory(data);
    });

    return () => { unsubInv(); unsubItems(); unsubHold(); unsubItemHistory(); };
  }, [initialInventory.id]);

  useEffect(() => {
    const fetchUsers = async () => {
      const snap = await getDocs(collection(db, 'users'));
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    const fetchDataForMove = async () => {
      if (movingItemId) {
        const [invSnap, listSnap] = await Promise.all([
          getDocs(collection(db, 'inventories')),
          getDocs(collection(db, 'inventory_lists'))
        ]);
        
        const lists = listSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const invs = invSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Sort by list name, then inventory name
        invs.sort((a, b) => {
          const listA = lists.find(l => l.id === a.listId)?.name || '';
          const listB = lists.find(l => l.id === b.listId)?.name || '';
          if (listA < listB) return -1;
          if (listA > listB) return 1;
          return (a.name || '').localeCompare(b.name || '');
        });

        setAllLists(lists);
        setAllInventories(invs);
      }
    };
    fetchDataForMove();
  }, [movingItemId]);

  const handleAssignHolder = async (e) => {
    e.preventDefault();
    if (!newHolderEmail) return;

    const targetUser = users.find(u => u.email === newHolderEmail);
    const roomNumber = targetUser?.roomNumber || 'Unknown';
    const now = new Date().toISOString();

    try {
      // 1. If there's a current holder, add a removedDate to their history
      if (inventory.currentHolder) {
        const currentHistQuery = query(collection(db, 'inventory_hold_history'), 
          where('inventoryId', '==', inventory.id),
          where('userId', '==', inventory.currentHolder),
          where('removedDate', '==', null)
        );
        const histSnap = await getDocs(currentHistQuery);
        histSnap.forEach(async (docSnap) => {
          await updateDoc(doc(db, 'inventory_hold_history', docSnap.id), { removedDate: now });
        });
      }

      // 2. Add new hold history record
      await addDoc(collection(db, 'inventory_hold_history'), {
        inventoryId: inventory.id,
        userId: newHolderEmail,
        roomId: roomNumber,
        assignedDate: now,
        removedDate: null
      });

      // 3. Update inventory document
      await updateDoc(doc(db, 'inventories', inventory.id), {
        previousHolder: inventory.currentHolder || null,
        previousRoom: inventory.currentRoom || null,
        previousAssignedDate: inventory.currentAssignedDate || null,
        currentHolder: newHolderEmail,
        currentRoom: roomNumber,
        currentAssignedDate: now
      });

      await logInventoryAction(`Assigned holder "${newHolderEmail}" to inventory "${inventory.name}"`);
      setNewHolderEmail('');
    } catch (error) {
      console.error("Error assigning holder:", error);
      alert("Failed to assign holder");
    }
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!newItemName.trim() || newItemQuantity < 1) return;

    try {
      const docRef = await addDoc(collection(db, 'items'), {
        inventoryId: inventory.id,
        name: newItemName.trim(),
        quantity: parseInt(newItemQuantity, 10),
        createdAt: new Date().toISOString(),
        createdBy: user.email
      });

      await logInventoryAction(`Added item "${newItemName.trim()}" (Qty: ${newItemQuantity}) to "${inventory.name}"`);
      setNewItemName('');
      setNewItemQuantity(1);
    } catch (error) {
      console.error("Error adding item:", error);
      alert("Failed to add item");
    }
  };

  const handleDeleteItem = async (itemId, itemName) => {
    if (!window.confirm(`Delete item "${itemName}"?`)) return;
    try {
      await deleteDoc(doc(db, 'items', itemId));
      await logInventoryAction(`Deleted item "${itemName}" from "${inventory.name}"`);
    } catch (error) {
      console.error("Error deleting item:", error);
      alert("Failed to delete item");
    }
  };

  const handleSaveQuantity = async (itemId, itemName, oldQty) => {
    const newQty = parseInt(editingQuantity, 10);
    if (newQty === oldQty) {
      setEditingItemId(null);
      return;
    }

    try {
      await updateDoc(doc(db, 'items', itemId), { quantity: newQty });
      
      await addDoc(collection(db, 'item_history'), {
        itemId,
        inventoryId: inventory.id,
        itemName,
        action: 'quantity_changed',
        previousQuantity: oldQty,
        newQuantity: newQty,
        userId: user.email,
        timestamp: new Date().toISOString()
      });

      await logInventoryAction(`Updated quantity of "${itemName}" from ${oldQty} to ${newQty}`);
      setEditingItemId(null);
    } catch (error) {
      console.error("Error updating quantity:", error);
      alert("Failed to update quantity");
    }
  };

  const handleMoveItemClick = async (itemId, itemName) => {
    if (!targetInventoryId || targetInventoryId === inventory.id) {
      setMovingItemId(null);
      return;
    }

    try {
      const targetInv = allInventories.find(i => i.id === targetInventoryId);
      
      // Check for conflict
      const qConflict = query(collection(db, 'items'), where('inventoryId', '==', targetInventoryId));
      const snap = await getDocs(qConflict);
      const existingItem = snap.docs.find(d => d.data().name.trim().toLowerCase() === itemName.trim().toLowerCase());

      if (existingItem) {
        setMoveConflictState({
          itemId,
          itemName,
          targetInventoryId,
          targetInvName: targetInv?.name,
          existingItemId: existingItem.id,
          existingItemQty: existingItem.data().quantity,
          targetInv
        });
      } else {
        await executeMove(itemId, itemName, targetInventoryId, targetInv);
      }
    } catch (error) {
      console.error("Error checking conflict:", error);
      alert("Failed to move item.");
    }
  };

  const executeMove = async (itemId, itemName, destInvId, destInv) => {
    try {
      await updateDoc(doc(db, 'items', itemId), { inventoryId: destInvId });
      
      await addDoc(collection(db, 'item_history'), {
        itemId,
        inventoryId: destInvId,
        previousInventoryId: inventory.id,
        itemName,
        action: 'moved',
        userId: user.email,
        timestamp: new Date().toISOString()
      });

      await logInventoryAction(`Moved item "${itemName}" to inventory "${destInv?.name}"`);
      setMovingItemId(null);
      setTargetInventoryId('');
      setMoveConflictState(null);
    } catch (error) {
      console.error("Error executing move:", error);
      alert("Failed to move item.");
    }
  };

  const handleReplaceMove = async () => {
    try {
      // Delete existing item in destination
      await deleteDoc(doc(db, 'items', moveConflictState.existingItemId));
      // Then move the current item over
      await executeMove(moveConflictState.itemId, moveConflictState.itemName, moveConflictState.targetInventoryId, moveConflictState.targetInv);
    } catch (error) {
      console.error("Error replacing item:", error);
      alert("Failed to replace item.");
    }
  };

  const handleKeepBothMove = async () => {
    await executeMove(moveConflictState.itemId, moveConflictState.itemName, moveConflictState.targetInventoryId, moveConflictState.targetInv);
  };

  return (
    <div className="admin-grid" style={{ gridTemplateColumns: '1fr' }}>
      <div className="admin-span-full" style={{ marginBottom: '-10px' }}>
        <button onClick={goBack} className="admin-btn secondary small" style={{ marginBottom: '15px' }}>
          &larr; Back to Inventories
        </button>
        <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.6rem', margin: 0 }}>
          {inventory.name}
        </h2>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
          Created: {new Date(inventory.createdAt).toLocaleDateString()} | By: {users.find(u => u.email === inventory.createdBy)?.name || inventory.createdBy}
        </div>
      </div>

      {/* Holder Section */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div className="admin-glass-panel">
          <h2>Current & Previous Holder</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '10px' }}>
              <h4 style={{ margin: '0 0 5px', color: 'var(--accent)' }}>Current Holder</h4>
              {inventory.currentHolder ? (
                <>
                  <div><strong>User:</strong> {users.find(u => u.email === inventory.currentHolder)?.name || inventory.currentHolder}</div>
                  <div><strong>Room:</strong> {inventory.currentRoom}</div>
                  <div><strong>Assigned:</strong> {new Date(inventory.currentAssignedDate).toLocaleString()}</div>
                </>
              ) : <div>None</div>}
            </div>

            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '10px' }}>
              <h4 style={{ margin: '0 0 5px', color: 'var(--text-secondary)' }}>Previous Holder</h4>
              {inventory.previousHolder ? (
                <>
                  <div><strong>User:</strong> {users.find(u => u.email === inventory.previousHolder)?.name || inventory.previousHolder}</div>
                  <div><strong>Room:</strong> {inventory.previousRoom}</div>
                  <div><strong>Assigned:</strong> {new Date(inventory.previousAssignedDate).toLocaleString()}</div>
                </>
              ) : <div>None</div>}
            </div>
            
            <form onSubmit={handleAssignHolder} style={{ marginTop: '10px', display: 'flex', gap: '10px' }}>
              <select
                className="admin-form"
                style={{ flex: 1, padding: '10px', borderRadius: '10px', background: 'rgba(10,25,47,0.6)', border: '1px solid var(--glass-border)', color: '#fff' }}
                value={newHolderEmail}
                onChange={e => setNewHolderEmail(e.target.value)}
                required
              >
                <option value="">Select User...</option>
                {users.map(u => (
                  <option key={u.email} value={u.email}>{u.name || u.email}</option>
                ))}
              </select>
              <button type="submit" className="admin-btn primary">Assign</button>
            </form>
          </div>
        </div>

        <div className="admin-glass-panel list-panel">
          <h2>Holder History</h2>
          <div className="achievements-list" style={{ maxHeight: '250px' }}>
            {holdHistory.map(hist => (
              <div key={hist.id} style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px', marginBottom: '8px', fontSize: '0.85rem' }}>
                <div><strong>User:</strong> {users.find(u => u.email === hist.userId)?.name || hist.userId} (Room {hist.roomId})</div>
                <div><strong>From:</strong> {new Date(hist.assignedDate).toLocaleString()}</div>
                {hist.removedDate && <div><strong>To:</strong> {new Date(hist.removedDate).toLocaleString()}</div>}
              </div>
            ))}
            {holdHistory.length === 0 && <p className="empty-state">No holder history.</p>}
          </div>
        </div>
      </div>

      {/* Items Section */}
      <div className="admin-glass-panel list-panel" style={{ marginTop: '20px' }}>
        <h2>Items in {inventory.name}</h2>
        
        <form onSubmit={handleAddItem} className="admin-form" style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <input
            type="text"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder="New Item Name"
            required
            style={{ flex: 2 }}
          />
          <input
            type="number"
            value={newItemQuantity}
            onChange={(e) => setNewItemQuantity(e.target.value)}
            min="1"
            required
            style={{ flex: 1 }}
          />
          <button type="submit" className="admin-btn primary">Add Item</button>
        </form>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--glass-border)', textAlign: 'left' }}>
              <th style={{ padding: '10px' }}>Item Name</th>
              <th style={{ padding: '10px', width: '100px' }}>Qty</th>
              <th style={{ padding: '10px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '10px' }}>{item.name}</td>
                <td style={{ padding: '10px' }}>
                  {editingItemId === item.id ? (
                    <input
                      type="number"
                      value={editingQuantity}
                      onChange={e => setEditingQuantity(e.target.value)}
                      style={{ width: '60px', padding: '4px', background: '#fff', color: '#000', borderRadius: '4px' }}
                      min="0"
                    />
                  ) : item.quantity}
                </td>
                <td style={{ padding: '10px', textAlign: 'right' }}>
                  {movingItemId === item.id ? (
                    <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
                      <select 
                        style={{ padding: '4px', background: '#fff', color: '#000', borderRadius: '4px' }}
                        value={targetInventoryId}
                        onChange={e => setTargetInventoryId(e.target.value)}
                      >
                        <option value="">Dest. Inventory...</option>
                        {allInventories.filter(i => i.id !== inventory.id).map(i => {
                          const parentList = allLists.find(l => l.id === i.listId);
                          const listName = parentList ? parentList.name : 'Unknown List';
                          return (
                            <option key={i.id} value={i.id}>{listName} › {i.name}</option>
                          );
                        })}
                      </select>
                      <button onClick={() => handleMoveItemClick(item.id, item.name)} className="admin-btn primary small">OK</button>
                      <button onClick={() => setMovingItemId(null)} className="admin-btn secondary small">Cancel</button>
                    </div>
                  ) : editingItemId === item.id ? (
                    <div style={{ display: 'inline-flex', gap: '8px' }}>
                      <button onClick={() => handleSaveQuantity(item.id, item.name, item.quantity)} className="admin-btn primary small">Save</button>
                      <button onClick={() => setEditingItemId(null)} className="admin-btn secondary small">Cancel</button>
                    </div>
                  ) : (
                    <div style={{ display: 'inline-flex', gap: '8px' }}>
                      <button onClick={() => { setEditingItemId(item.id); setEditingQuantity(item.quantity); }} className="admin-btn edit small">Edit Qty</button>
                      <button onClick={() => setMovingItemId(item.id)} className="admin-btn secondary small">Move</button>
                      <button onClick={() => handleDeleteItem(item.id, item.name)} className="admin-btn delete small">Del</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan="3" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>No items.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="admin-glass-panel list-panel" style={{ marginTop: '20px' }}>
        <h2>Item & Edit History</h2>
        <div className="achievements-list" style={{ maxHeight: '250px' }}>
          {itemHistory.map(hist => (
            <div key={hist.id} style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px', marginBottom: '8px', fontSize: '0.85rem' }}>
              <strong>{new Date(hist.timestamp).toLocaleString()}</strong> - {users.find(u => u.email === hist.userId)?.name || hist.userId}
              <br/>
              {hist.action === 'quantity_changed' && (
                <span>Changed quantity of <strong>{hist.itemName}</strong> from {hist.previousQuantity} to {hist.newQuantity}</span>
              )}
              {hist.action === 'moved' && (
                <span>Moved <strong>{hist.itemName}</strong> to this inventory (from {hist.previousInventoryId})</span>
              )}
            </div>
          ))}
          {itemHistory.length === 0 && <p className="empty-state">No item history recorded.</p>}
        </div>
      </div>

      {moveConflictState && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="admin-glass-panel" style={{ width: '400px', textAlign: 'center', padding: '30px' }}>
            <h2 style={{ color: 'var(--error)' }}>Item Already Exists</h2>
            <p style={{ marginBottom: '20px' }}>
              An item named <strong>"{moveConflictState.itemName}"</strong> already exists in <strong>{moveConflictState.targetInvName}</strong> (Current Qty: {moveConflictState.existingItemQty}).
              <br/><br/>
              How would you like to handle this move?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button onClick={handleReplaceMove} className="admin-btn delete">
                Replace (Overwrite Existing)
              </button>
              <button onClick={handleKeepBothMove} className="admin-btn primary">
                Keep Both (Separate Rows)
              </button>
              <button onClick={() => setMoveConflictState(null)} className="admin-btn secondary">
                Cancel Move
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default InventoryDetailsView;
