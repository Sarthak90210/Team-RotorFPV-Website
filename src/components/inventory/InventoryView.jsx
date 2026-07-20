import React, { useState, useEffect } from 'react';
import { collection, addDoc, deleteDoc, updateDoc, doc, onSnapshot, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { logInventoryAction } from '../../lib/inventoryApi';

const InventoryView = ({ list, user, goBack, onSelectInventory }) => {
  const [inventories, setInventories] = useState([]);
  const [newInventoryName, setNewInventoryName] = useState('');
  const [usersMap, setUsersMap] = useState({});
  
  const [allLists, setAllLists] = useState([]);
  const [movingInventoryId, setMovingInventoryId] = useState(null);
  const [targetListId, setTargetListId] = useState('');

  useEffect(() => {
    const q = query(
      collection(db, 'inventories'),
      where('listId', '==', list.id)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setInventories(data);
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const uMap = {};
      snap.docs.forEach(d => { uMap[d.id] = d.data().name || d.id; });
      setUsersMap(uMap);
    });

    return () => { unsubscribe(); unsubUsers(); };
  }, [list.id]);

  useEffect(() => {
    // Fetch all lists for the move dropdown
    const fetchLists = async () => {
      const snap = await getDocs(collection(db, 'inventory_lists'));
      setAllLists(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    fetchLists();
  }, []);

  const handleAddInventory = async (e) => {
    e.preventDefault();
    if (!newInventoryName.trim()) return;

    try {
      await addDoc(collection(db, 'inventories'), { 
        name: newInventoryName.trim(),
        listId: list.id,
        createdAt: new Date().toISOString(),
        createdBy: user.email,
        currentHolder: null,
        currentRoom: null,
        currentAssignedDate: null,
        previousHolder: null,
        previousRoom: null,
        previousAssignedDate: null
      });
      await logInventoryAction(`Created Inventory: ${newInventoryName.trim()} in list ${list.name}`);
      setNewInventoryName('');
    } catch (error) {
      console.error("Error adding inventory:", error);
      alert("Failed to add inventory");
    }
  };

  const handleDeleteInventory = async (invId, invName) => {
    if (!window.confirm(`Delete inventory "${invName}"?`)) return;
    try {
      await deleteDoc(doc(db, 'inventories', invId));
      await logInventoryAction(`Deleted Inventory: ${invName}`);
    } catch (error) {
      console.error("Error deleting inventory:", error);
      alert("Failed to delete inventory");
    }
  };

  const handleMoveInventory = async (invId, invName) => {
    if (!targetListId || targetListId === list.id) {
      setMovingInventoryId(null);
      return;
    }

    try {
      const targetList = allLists.find(l => l.id === targetListId);
      
      await updateDoc(doc(db, 'inventories', invId), {
        listId: targetListId
      });
      
      // Add movement history
      await addDoc(collection(db, 'inventory_movement_history'), {
        inventoryId: invId,
        previousListId: list.id,
        newListId: targetListId,
        userId: user.email,
        timestamp: new Date().toISOString()
      });

      await logInventoryAction(`Moved Inventory "${invName}" from "${list.name}" to "${targetList?.name}"`);
      setMovingInventoryId(null);
      setTargetListId('');
    } catch (error) {
      console.error("Error moving inventory:", error);
      alert("Failed to move inventory");
    }
  };

  return (
    <div className="admin-grid">
      <div className="admin-span-full" style={{ marginBottom: '-10px' }}>
        <button onClick={goBack} className="admin-btn secondary small" style={{ marginBottom: '15px' }}>
          &larr; Back to Lists
        </button>
        <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.6rem', margin: 0 }}>
          {list.name} Inventories
        </h2>
      </div>

      <div className="admin-left-column">
        <div className="admin-glass-panel form-panel">
          <h2>Add Inventory</h2>
          <form onSubmit={handleAddInventory} className="admin-form">
            <div className="form-group">
              <label>Inventory Name</label>
              <input
                type="text"
                value={newInventoryName}
                onChange={(e) => setNewInventoryName(e.target.value)}
                placeholder="e.g., Battery Charger"
                required
              />
            </div>
            <div className="form-actions">
              <button type="submit" className="admin-btn primary">Create Inventory</button>
            </div>
          </form>
        </div>
      </div>

      <div className="admin-right-column">
        <div className="admin-glass-panel list-panel">
          <h2>Inventories</h2>
          <div className="achievements-list">
            {inventories.map(inv => (
              <div key={inv.id} className="admin-achievement-card admin-user-card" style={{ cursor: 'pointer' }} onClick={() => onSelectInventory(inv)}>
                <div className="card-info" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                  <h3>{inv.name}</h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Created: {new Date(inv.createdAt).toLocaleDateString()}<br/>
                    Holder: {inv.currentHolder ? (usersMap[inv.currentHolder] || inv.currentHolder) : 'None'}
                  </div>
                  
                  {movingInventoryId === inv.id && (
                    <div style={{ marginTop: '10px' }} onClick={e => e.stopPropagation()}>
                      <select 
                        className="admin-form"
                        style={{ padding: '6px', borderRadius: '6px', background: '#fff', color: '#000', marginBottom: '8px' }}
                        value={targetListId}
                        onChange={e => setTargetListId(e.target.value)}
                      >
                        <option value="">Select Destination...</option>
                        {allLists.filter(l => l.id !== list.id).map(l => (
                          <option key={l.id} value={l.id}>{l.name}</option>
                        ))}
                      </select>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => handleMoveInventory(inv.id, inv.name)} className="admin-btn primary small">Confirm</button>
                        <button onClick={() => setMovingInventoryId(null)} className="admin-btn secondary small">Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
                
                {movingInventoryId !== inv.id && (
                  <div className="card-actions" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setMovingInventoryId(inv.id)} className="admin-btn secondary small">Move</button>
                    <button onClick={() => handleDeleteInventory(inv.id, inv.name)} className="admin-btn delete small">Delete</button>
                  </div>
                )}
              </div>
            ))}
            {inventories.length === 0 && <p className="empty-state">No inventories found in this list.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InventoryView;
