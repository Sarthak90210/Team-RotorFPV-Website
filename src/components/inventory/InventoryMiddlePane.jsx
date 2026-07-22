import React, { useState, useEffect } from 'react';
import { useInventory } from './InventoryContext';
import DashboardSummary from './DashboardSummary';
import { collection, addDoc, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { logInventoryAction } from '../../lib/inventoryApi';
import { User, Package, Maximize2, Plus, CheckSquare, Archive } from 'lucide-react';
import BulkActionBar from './BulkActionBar';
import DestinationPickerModal from './DestinationPickerModal';

const InventoryMiddlePane = () => {
  const { 
    selectedListId, 
    selectedList, 
    listInventories,
    selectedInventoryId, 
    setSelectedInventoryId,
    user, 
    usersMap,
    toggleFullscreenList,
    fullscreenPane,
    setFullscreenPane,
    inventories
  } = useInventory();
  
  const [newInventoryName, setNewInventoryName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [itemCounts, setItemCounts] = useState({});

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedInventories, setSelectedInventories] = useState(new Set());
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  // Clear selection when list changes
  useEffect(() => {
    setIsSelectionMode(false);
    setSelectedInventories(new Set());
  }, [selectedListId]);

  useEffect(() => {
    let isMounted = true;
    const fetchCounts = async () => {
      if (selectedListId === 'dashboard' || listInventories.length === 0) return;
      
      const counts = {};
      const getDescendants = (parentId) => {
        let ids = [parentId];
        const children = inventories.filter(i => i.parentInventoryId === parentId);
        for (const child of children) {
          ids = ids.concat(getDescendants(child.id));
        }
        return ids;
      };

      const promises = listInventories.map(async (inv) => {
        const descendantIds = getDescendants(inv.id);
        let total = 0;
        for (let i = 0; i < descendantIds.length; i += 10) {
          const chunk = descendantIds.slice(i, i + 10);
          const qItems = query(collection(db, 'items'), where('inventoryId', 'in', chunk));
          const snap = await getDocs(qItems);
          snap.forEach(d => { total += (d.data().quantity || 1) });
        }
        counts[inv.id] = total;
      });
      
      await Promise.all(promises);
      if (isMounted) setItemCounts(counts);
    };
    
    fetchCounts();
    return () => { isMounted = false; };
  }, [listInventories, selectedListId, inventories]);

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

  const toggleSelection = (e, id) => {
    e.stopPropagation();
    const next = new Set(selectedInventories);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedInventories(next);
  };

  const handleSelectAll = () => {
    if (selectedInventories.size === listInventories.length) {
      setSelectedInventories(new Set());
    } else {
      setSelectedInventories(new Set(listInventories.map(i => i.id)));
    }
  };

  const handleBulkMove = async (target) => {
    if (!target || selectedInventories.size === 0) return;
    
    const isMovingToList = target.type === 'list';
    const targetListId = isMovingToList ? target.id : inventories.find(i => i.id === target.id)?.listId;
    const targetParentId = isMovingToList ? null : target.id;
    
    if (window.confirm(`Move ${selectedInventories.size} inventories to ${target.name}?`)) {
      try {
        const batch = writeBatch(db);
        selectedInventories.forEach(invId => {
          batch.update(doc(db, 'inventories', invId), {
            listId: targetListId,
            parentInventoryId: targetParentId
          });
        });
        await batch.commit();
        await logInventoryAction(`Bulk moved ${selectedInventories.size} root inventories to ${target.name}`);
        
        setIsSelectionMode(false);
        setSelectedInventories(new Set());
        setIsPickerOpen(false);
      } catch (err) {
        console.error("Bulk move error:", err);
        alert("Failed to bulk move inventories");
      }
    }
  };

  if (!selectedList) {
    return <div className="inv-panel empty-details-pane" style={{ color: '#6b7280' }}>Select a list</div>;
  }

  return (
    <div className="inventory-middle inv-panel">
      <div className="flex-between" style={{ marginBottom: '16px' }}>
        <h2 className="section-title" style={{ margin: 0, border: 'none', padding: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          {selectedList.name}
          {selectedList.isArchived && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#9ca3af', backgroundColor: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', fontWeight: 'normal' }}>
              <Archive size={12} /> Archived
            </span>
          )}
          <button onClick={toggleFullscreenList} className="inv-btn ghost small" title="Toggle Fullscreen">
            <Maximize2 size={14} />
          </button>
        </h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => {
              if (!isSelectionMode) {
                setIsSelectionMode(true);
              } else {
                handleSelectAll();
              }
            }} 
            className={`inv-btn small ${isSelectionMode ? 'secondary' : 'ghost'}`}
          >
            <CheckSquare size={14} /> {isSelectionMode ? (selectedInventories.size === listInventories.length && listInventories.length > 0 ? 'Deselect All' : 'Select All') : 'Select'}
          </button>
          {!selectedList.isArchived && (
            <button onClick={() => setIsAdding(!isAdding)} className="inv-btn ghost small">
              <Plus size={14} /> New
            </button>
          )}
        </div>
      </div>

      {isAdding && !selectedList.isArchived && (
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
                if (isSelectionMode) {
                  const next = new Set(selectedInventories);
                  if (next.has(inv.id)) next.delete(inv.id);
                  else next.add(inv.id);
                  setSelectedInventories(next);
                } else {
                  setSelectedInventoryId(inv.id);
                  if (fullscreenPane === 'list') {
                    setFullscreenPane('inventory');
                  }
                }
              }}
              className={`inventory-card ${isSelected ? 'selected' : ''}`}
            >
              <div className="card-title">
                {isSelectionMode && (
                  <input 
                    type="checkbox" 
                    checked={selectedInventories.has(inv.id)}
                    onChange={(e) => toggleSelection(e, inv.id)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ marginRight: '8px', cursor: 'pointer' }}
                  />
                )}
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

      {isSelectionMode && (
        <BulkActionBar 
          selectedCount={selectedInventories.size}
          itemName="inventories"
          onMove={() => setIsPickerOpen(true)}
          onCancel={() => { setIsSelectionMode(false); setSelectedInventories(new Set()); }}
        />
      )}

      <DestinationPickerModal 
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onConfirm={handleBulkMove}
        invalidTargets={[
          ...Array.from(selectedInventories).map(id => `inventory:${id}`),
          `list:${selectedListId}`
        ]}
        title="Move Inventories To..."
      />
    </div>
  );
};

export default InventoryMiddlePane;
