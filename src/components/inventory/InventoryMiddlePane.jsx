import React, { useState, useEffect } from 'react';
import { useInventory } from './InventoryContext';
import DashboardSummary from './DashboardSummary';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { logInventoryAction } from '../../lib/inventoryApi';
import { User, Package, Maximize2, Plus } from 'lucide-react';

const InventoryMiddlePane = () => {
  const { 
    selectedListId, 
    selectedList, 
    listInventories,
    selectedInventoryId, 
    setSelectedInventoryId,
    user, 
    usersMap,
    setIsDetailsCollapsed,
    toggleFullscreenList,
    fullscreenPane,
    setFullscreenPane
  } = useInventory();
  
  const [newInventoryName, setNewInventoryName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [itemCounts, setItemCounts] = useState({});

  useEffect(() => {
    let isMounted = true;
    const fetchCounts = async () => {
      if (selectedListId === 'dashboard' || listInventories.length === 0) return;
      
      const counts = {};
      const promises = listInventories.map(async (inv) => {
        const qItems = query(collection(db, 'items'), where('inventoryId', '==', inv.id));
        const snap = await getDocs(qItems);
        let total = 0;
        snap.forEach(d => { total += (d.data().quantity || 1) });
        counts[inv.id] = total;
      });
      
      await Promise.all(promises);
      if (isMounted) setItemCounts(counts);
    };
    
    fetchCounts();
    return () => { isMounted = false; };
  }, [listInventories, selectedListId]);

  const handleAddInventory = async (e) => {
    e.preventDefault();
    if (!newInventoryName.trim() || !selectedListId) return;

    try {
      await addDoc(collection(db, 'inventories'), { 
        name: newInventoryName.trim(),
        listId: selectedListId,
        parentInventoryId: null,
        createdAt: new Date().toISOString(),
        createdBy: user.email,
        currentHolder: null,
        currentRoom: null,
        currentAssignedDate: null,
        previousHolder: null,
        previousRoom: null,
        previousAssignedDate: null,
        status: 'Available'
      });
      await logInventoryAction(`Created Inventory: ${newInventoryName.trim()} in ${selectedList?.name}`);
      setNewInventoryName('');
      setIsAdding(false);
    } catch (error) {
      console.error("Error adding inventory:", error);
      alert("Failed to add inventory");
    }
  };

  const getStatusBadge = (inv) => {
    const status = inv.status || (inv.currentHolder ? 'CheckedOut' : 'Available');
    return <span className={`inv-badge badge-${status.replace(/\s+/g, '')}`}>{status}</span>;
  };

  if (!selectedList) {
    return <div className="inv-panel empty-details-pane" style={{ color: '#6b7280' }}>Select a list</div>;
  }

  return (
    <div className="inventory-middle inv-panel">
      <div className="flex-between" style={{ marginBottom: '16px' }}>
        <h2 className="section-title" style={{ margin: 0, border: 'none', padding: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          {selectedList.name}
          <button onClick={toggleFullscreenList} className="inv-btn ghost small" title="Toggle Fullscreen">
            <Maximize2 size={14} />
          </button>
        </h2>
        <button onClick={() => setIsAdding(!isAdding)} className="inv-btn ghost small">
          <Plus size={14} /> New
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleAddInventory} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <input 
            type="text" 
            className="inv-input"
            style={{ flex: 1 }}
            placeholder="Inventory name..."
            value={newInventoryName}
            onChange={e => setNewInventoryName(e.target.value)}
            autoFocus
          />
          <button type="submit" className="inv-btn secondary small">Save</button>
          <button type="button" onClick={() => setIsAdding(false)} className="inv-btn ghost small">Cancel</button>
        </form>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {listInventories.map(inv => {
          const isSelected = selectedInventoryId === inv.id;
          const holderName = inv.currentHolder ? (usersMap[inv.currentHolder] || inv.currentHolder) : 'None';
          const count = itemCounts[inv.id] !== undefined ? itemCounts[inv.id] : '...';
          const timeAgo = (new Date() - new Date(inv.createdAt)) / (1000 * 3600);
          let timeStr = 'Recently';
          if (timeAgo > 24) timeStr = `${Math.floor(timeAgo/24)}d`;
          else if (timeAgo > 1) timeStr = `${Math.floor(timeAgo)}h`;

          return (
            <div 
              key={inv.id}
              onClick={() => {
                setSelectedInventoryId(inv.id);
                setIsDetailsCollapsed(false);
                if (fullscreenPane === 'list') {
                  setFullscreenPane('inventory');
                }
              }}
              className={`inventory-card ${isSelected ? 'selected' : ''}`}
            >
              <div className="card-title">
                <span>{inv.name}</span>
                {getStatusBadge(inv)}
              </div>
              
              <div className="card-meta">
                <div className="card-meta-item"><User size={12} /> {holderName}</div>
                <div className="card-meta-item"><Package size={12} /> {count}</div>
                <div className="card-meta-item" style={{ marginLeft: 'auto' }}>{timeStr}</div>
              </div>
            </div>
          );
        })}
        {listInventories.length === 0 && !isAdding && (
          <div className="empty-state">No inventories found.</div>
        )}
      </div>
    </div>
  );
};

export default InventoryMiddlePane;
