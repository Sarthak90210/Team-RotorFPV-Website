import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { logInventoryAction } from '../../lib/inventoryApi';

import InventoryView from './InventoryView';
import InventoryDetailsView from './InventoryDetailsView';

const InventoryListsTab = ({ user, setPageTitle }) => {
  const [lists, setLists] = useState([]);
  const [newListName, setNewListName] = useState('');
  
  const [selectedList, setSelectedList] = useState(null);
  const [selectedInventory, setSelectedInventory] = useState(null);
  const [usersMap, setUsersMap] = useState({});

  useEffect(() => {
    // Fetch users for mapping emails to names
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const uMap = {};
      snap.docs.forEach(d => {
        uMap[d.id] = d.data().name || d.id;
      });
      setUsersMap(uMap);
    });

    const q = query(collection(db, 'inventory_lists'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLists(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => {
      unsubscribe();
      unsubUsers();
    };
  }, []);

  const handleAddList = async (e) => {
    e.preventDefault();
    if (!newListName.trim()) return;

    try {
      await addDoc(collection(db, 'inventory_lists'), { 
        name: newListName.trim(),
        createdAt: new Date().toISOString(),
        createdBy: user.email
      });
      await logInventoryAction(`Created Inventory List: ${newListName.trim()}`);
      setNewListName('');
    } catch (error) {
      console.error("Error adding list:", error);
      alert("Failed to add list");
    }
  };

  const handleDeleteList = async (listId, listName) => {
    if (!window.confirm(`Delete inventory list "${listName}"? This will NOT delete the inventories inside it automatically, but they will be orphaned.`)) return;
    
    try {
      await deleteDoc(doc(db, 'inventory_lists', listId));
      await logInventoryAction(`Deleted Inventory List: ${listName}`);
    } catch (error) {
      console.error("Error deleting list:", error);
      alert("Failed to delete list");
    }
  };

  // Drill down routing
  useEffect(() => {
    if (setPageTitle) {
      if (selectedInventory) setPageTitle(selectedInventory.name);
      else if (selectedList) setPageTitle(selectedList.name);
      else setPageTitle('Inventory Lists');
    }
  }, [selectedInventory, selectedList, setPageTitle]);

  if (selectedInventory) {
    return (
      <InventoryDetailsView 
        inventory={selectedInventory} 
        user={user}
        goBack={() => setSelectedInventory(null)} 
      />
    );
  }

  if (selectedList) {
    return (
      <InventoryView 
        list={selectedList} 
        user={user}
        goBack={() => setSelectedList(null)} 
        onSelectInventory={setSelectedInventory}
      />
    );
  }

  return (
    <div className="admin-grid">
      <div className="admin-left-column">
        <div className="admin-glass-panel form-panel">
          <h2>Add Inventory List</h2>
          <form onSubmit={handleAddList} className="admin-form">
            <div className="form-group">
              <label>List Name</label>
              <input
                type="text"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="e.g., Drone Electronics"
                required
              />
            </div>
            <div className="form-actions">
              <button type="submit" className="admin-btn primary">Create List</button>
            </div>
          </form>
        </div>
      </div>

      <div className="admin-right-column">
        <div className="admin-glass-panel list-panel">
          <h2>Inventory Lists</h2>
          <div className="achievements-list">
            {lists.map(list => (
              <div key={list.id} className="admin-achievement-card admin-user-card" style={{ cursor: 'pointer' }} onClick={() => setSelectedList(list)}>
                <div className="card-info" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                  <h3>{list.name}</h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Created: {new Date(list.createdAt).toLocaleDateString()}
                    <br />
                    By: {usersMap[list.createdBy] || list.createdBy}
                  </div>
                </div>
                <div className="card-actions" onClick={e => e.stopPropagation()}>
                  <button onClick={() => handleDeleteList(list.id, list.name)} className="admin-btn delete small">Delete</button>
                </div>
              </div>
            ))}
            {lists.length === 0 && <p className="empty-state">No inventory lists found.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InventoryListsTab;
