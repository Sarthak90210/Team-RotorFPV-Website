import React, { useState, useEffect } from 'react';
import { useInventory } from './InventoryContext';
import { collection, addDoc, updateDoc, deleteDoc, doc, query, where, getDocs, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { logInventoryAction } from '../../lib/inventoryApi';
import { Maximize2, ChevronsRight, MoreVertical, Edit2, Trash2 } from 'lucide-react';

const InventoryDetailsPane = () => {
  const { 
    selectedList, 
    selectedInventoryId, 
    selectedInventory, 
    isDetailsCollapsed, 
    setIsDetailsCollapsed,
    user,
    usersList,
    usersMap,
    inventories,
    lists,
    toggleFullscreenInventory,
    getInventoryPath,
    setSelectedInventoryId
  } = useInventory();

  const [activeTab, setActiveTab] = useState('Overview');
  const [items, setItems] = useState([]);
  const [itemHistory, setItemHistory] = useState([]);
  const [holdHistory, setHoldHistory] = useState([]);
  const [showQuickActions, setShowQuickActions] = useState(false);
  
  // Forms state
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState(1);
  const [editingItemId, setEditingItemId] = useState(null);
  const [editingQty, setEditingQty] = useState(1);
  const [editingName, setEditingName] = useState('');
  const [newHolderEmail, setNewHolderEmail] = useState('');

  // Moving and Sub-inventories state
  const [movingItemId, setMovingItemId] = useState(null);
  const [targetInventoryId, setTargetInventoryId] = useState('');
  const [newSubInvName, setNewSubInvName] = useState('');
  const [isMovingInv, setIsMovingInv] = useState(false);
  const [invTargetId, setInvTargetId] = useState('');

  // 1. Fetch Items & History live
  useEffect(() => {
    if (!selectedInventoryId) return;

    const qItems = query(collection(db, 'items'), where('inventoryId', '==', selectedInventoryId));
    const unsubItems = onSnapshot(qItems, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setItems(data);
    });

    const qItemHistory = query(collection(db, 'item_history'), where('inventoryId', '==', selectedInventoryId));
    const unsubItemHistory = onSnapshot(qItemHistory, snap => {
      const data = snap.docs.map(d => ({ id: d.id, _type: 'item', ...d.data() }));
      setItemHistory(data);
    });

    const qHoldHistory = query(collection(db, 'inventory_hold_history'), where('inventoryId', '==', selectedInventoryId));
    const unsubHoldHistory = onSnapshot(qHoldHistory, snap => {
      const data = [];
      snap.docs.forEach(d => {
        const docData = d.data();
        data.push({ id: d.id + '_assign', _type: 'hold_assign', ...docData, timestamp: docData.assignedDate });
        if (docData.removedDate) {
          data.push({ id: d.id + '_remove', _type: 'hold_remove', ...docData, timestamp: docData.removedDate });
        }
      });
      setHoldHistory(data);
    });

    return () => { unsubItems(); unsubItemHistory(); unsubHoldHistory(); };
  }, [selectedInventoryId]);

  if (!selectedInventory || isDetailsCollapsed || selectedInventoryId === null) {
    return null;
  }

  const combinedHistory = [...itemHistory, ...holdHistory].sort((a, b) => {
    const tA = new Date(a.timestamp);
    const tB = new Date(b.timestamp);
    return tB - tA; // desc
  });

  const getStatusBadge = () => {
    const status = selectedInventory.status || (selectedInventory.currentHolder ? 'CheckedOut' : 'Available');
    return <span className={`inv-badge badge-${status.replace(/\s+/g, '')}`}>{status}</span>;
  };

  const handleAssignHolder = async (e) => {
    e.preventDefault();
    if (!newHolderEmail) return;

    const targetUser = usersList.find(u => u.email === newHolderEmail);
    const roomNumber = targetUser?.roomNumber || 'Unknown';
    const now = new Date().toISOString();

    try {
      if (selectedInventory.currentHolder) {
        const currentHistQuery = query(collection(db, 'inventory_hold_history'), 
          where('inventoryId', '==', selectedInventory.id),
          where('userId', '==', selectedInventory.currentHolder),
          where('removedDate', '==', null)
        );
        const histSnap = await getDocs(currentHistQuery);
        histSnap.forEach(async (docSnap) => {
          await updateDoc(doc(db, 'inventory_hold_history', docSnap.id), { removedDate: now });
        });
      }

      await addDoc(collection(db, 'inventory_hold_history'), {
        inventoryId: selectedInventory.id,
        userId: newHolderEmail,
        roomId: roomNumber,
        assignedDate: now,
        removedDate: null
      });

      await updateDoc(doc(db, 'inventories', selectedInventory.id), {
        previousHolder: selectedInventory.currentHolder || null,
        previousRoom: selectedInventory.currentRoom || null,
        previousAssignedDate: selectedInventory.currentAssignedDate || null,
        currentHolder: newHolderEmail,
        currentRoom: roomNumber,
        currentAssignedDate: now,
        status: 'CheckedOut'
      });

      await logInventoryAction(`Assigned holder "${newHolderEmail}" to "${selectedInventory.name}"`);
      setNewHolderEmail('');
    } catch (error) {
      console.error("Error:", error);
      alert("Failed to assign holder");
    }
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!newItemName.trim() || newItemQty < 1) return;
    try {
      const newDoc = await addDoc(collection(db, 'items'), {
        inventoryId: selectedInventory.id,
        name: newItemName.trim(),
        quantity: parseInt(newItemQty, 10),
        createdAt: new Date().toISOString(),
        createdBy: user.email
      });
      await addDoc(collection(db, 'item_history'), {
        itemId: newDoc.id,
        inventoryId: selectedInventory.id,
        itemName: newItemName.trim(),
        action: 'created',
        newQuantity: parseInt(newItemQty, 10),
        userId: user.email,
        timestamp: new Date().toISOString()
      });
      await logInventoryAction(`Added item "${newItemName.trim()}" (Qty: ${newItemQty}) to "${selectedInventory.name}"`);
      setNewItemName('');
      setNewItemQty(1);
    } catch (error) {
      console.error(error);
      alert("Failed to add item");
    }
  };

  const handleSaveItem = async (item) => {
    const newQty = parseInt(editingQty, 10);
    const newName = editingName.trim();
    if (!newName) return;
    if (newQty === item.quantity && newName === item.name) { setEditingItemId(null); return; }
    try {
      await updateDoc(doc(db, 'items', item.id), { quantity: newQty, name: newName });
      if (newQty !== item.quantity) {
        await addDoc(collection(db, 'item_history'), {
          itemId: item.id,
          inventoryId: selectedInventory.id,
          itemName: newName,
          action: 'quantity_changed',
          previousQuantity: item.quantity,
          newQuantity: newQty,
          userId: user.email,
          timestamp: new Date().toISOString()
        });
      }
      if (newName !== item.name) {
        await addDoc(collection(db, 'item_history'), {
          itemId: item.id,
          inventoryId: selectedInventory.id,
          itemName: newName,
          action: 'name_changed',
          previousName: item.name,
          newName: newName,
          userId: user.email,
          timestamp: new Date().toISOString()
        });
      }
      await logInventoryAction(`Updated item: "${item.name}" (Now "${newName}", Qty: ${newQty})`);
      setEditingItemId(null);
    } catch (error) {
      console.error(error);
      alert("Failed to update");
    }
  };

  const handleDeleteItem = async (itemId, itemName) => {
    if (!window.confirm(`Delete item "${itemName}"?`)) return;
    try {
      await deleteDoc(doc(db, 'items', itemId));
      await logInventoryAction(`Deleted item "${itemName}" from "${selectedInventory.name}"`);
    } catch (error) {
      console.error(error);
    }
  };

  const handleMoveItem = async (itemId, itemName) => {
    if (!targetInventoryId || targetInventoryId === selectedInventory.id) {
      setMovingItemId(null);
      return;
    }
    try {
      await updateDoc(doc(db, 'items', itemId), { inventoryId: targetInventoryId });
      await addDoc(collection(db, 'item_history'), {
        itemId,
        inventoryId: targetInventoryId,
        previousInventoryId: selectedInventory.id,
        itemName,
        action: 'moved',
        userId: user.email,
        timestamp: new Date().toISOString()
      });
      await logInventoryAction(`Moved item "${itemName}" to a different inventory.`);
      setMovingItemId(null);
      setTargetInventoryId('');
    } catch (e) {
      console.error(e);
      alert("Move failed.");
    }
  };

  const handleAddSubInventory = async (e) => {
    e.preventDefault();
    if (!newSubInvName.trim()) return;
    try {
      await addDoc(collection(db, 'inventories'), {
        name: newSubInvName.trim(),
        listId: selectedList.id,
        parentInventoryId: selectedInventory.id,
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
      await logInventoryAction(`Created sub-inventory: ${newSubInvName.trim()} inside ${selectedInventory.name}`);
      setNewSubInvName('');
    } catch (error) {
      console.error(error);
      alert("Failed to add sub-inventory");
    }
  };

  const handleMoveInventory = async () => {
    try {
      await updateDoc(doc(db, 'inventories', selectedInventory.id), { 
        parentInventoryId: invTargetId || null 
      });
      await logInventoryAction(`Moved inventory: ${selectedInventory.name}`);
      setIsMovingInv(false);
      setInvTargetId('');
    } catch(e) {
      console.error(e);
      alert("Failed to move inventory");
    }
  };

  const handleQuickAction = async (action) => {
    setShowQuickActions(false);
    if (action === 'delete') {
      if (!window.confirm(`Delete inventory "${selectedInventory.name}" entirely? All items and history will be permanently deleted.`)) return;
      
      const invId = selectedInventory.id;
      
      // Delete items
      const itemQuery = query(collection(db, 'items'), where('inventoryId', '==', invId));
      const itemSnap = await getDocs(itemQuery);
      await Promise.all(itemSnap.docs.map(itemDoc => deleteDoc(doc(db, 'items', itemDoc.id))));
      
      // Delete item history
      const itemHistQuery = query(collection(db, 'item_history'), where('inventoryId', '==', invId));
      const itemHistSnap = await getDocs(itemHistQuery);
      await Promise.all(itemHistSnap.docs.map(d => deleteDoc(doc(db, 'item_history', d.id))));

      // Delete hold history
      const holdHistQuery = query(collection(db, 'inventory_hold_history'), where('inventoryId', '==', invId));
      const holdHistSnap = await getDocs(holdHistQuery);
      await Promise.all(holdHistSnap.docs.map(d => deleteDoc(doc(db, 'inventory_hold_history', d.id))));

      // Delete the inventory itself
      await deleteDoc(doc(db, 'inventories', invId));
      await logInventoryAction(`Deleted Inventory: ${selectedInventory.name} (and all contents)`);
    } else if (action === 'markAvailable') {
      const now = new Date().toISOString();
      if (selectedInventory.currentHolder) {
        const currentHistQuery = query(collection(db, 'inventory_hold_history'), 
          where('inventoryId', '==', selectedInventory.id),
          where('userId', '==', selectedInventory.currentHolder),
          where('removedDate', '==', null)
        );
        const histSnap = await getDocs(currentHistQuery);
        histSnap.forEach(async (docSnap) => {
          await updateDoc(doc(db, 'inventory_hold_history', docSnap.id), { removedDate: now });
        });
      }
      await updateDoc(doc(db, 'inventories', selectedInventory.id), { 
        status: 'Available', 
        currentHolder: null,
        previousHolder: selectedInventory.currentHolder || null,
        previousRoom: selectedInventory.currentRoom || null,
        previousAssignedDate: selectedInventory.currentAssignedDate || null
      });
      await logInventoryAction(`Marked "${selectedInventory.name}" as Available.`);
    } else if (action === 'markMissing') {
      await updateDoc(doc(db, 'inventories', selectedInventory.id), { status: 'Missing' });
    }
  };

  return (
    <div className="inventory-details inv-panel" style={{ position: 'relative' }}>
      
      {/* Header Area */}
      <div className="flex-between" style={{ marginBottom: '8px' }}>
        <div style={{ color: '#9ca3af', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
          <span>{selectedList?.name}</span>
          {getInventoryPath(selectedInventory.id).map((p, idx, arr) => (
            <React.Fragment key={p.id}>
              <span style={{ opacity: 0.5 }}>/</span>
              <span 
                style={{ cursor: 'pointer', color: idx === arr.length - 1 ? '#e5e7eb' : '#9ca3af', textDecoration: 'none' }}
                onClick={() => setSelectedInventoryId(p.id)}
                onMouseEnter={e => e.target.style.textDecoration = 'underline'}
                onMouseLeave={e => e.target.style.textDecoration = 'none'}
              >
                {p.name}
              </span>
            </React.Fragment>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={toggleFullscreenInventory} className="inv-btn ghost small" title="Toggle Fullscreen"><Maximize2 size={14} /></button>
          <button onClick={() => setIsDetailsCollapsed(true)} className="inv-btn ghost small"><ChevronsRight size={14} /></button>
        </div>
      </div>

      <div className="flex-between" style={{ alignItems: 'flex-start', marginBottom: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h2 className="details-title">{selectedInventory.name}</h2>
          <div>{getStatusBadge()}</div>
        </div>
        <div className="quick-actions-wrapper">
          <button onClick={() => setShowQuickActions(!showQuickActions)} className="inv-btn ghost">
            <MoreVertical size={16} />
          </button>
          {showQuickActions && (
            <div className="quick-actions-menu">
              <button onClick={() => { setActiveTab('Overview'); setShowQuickActions(false); }}>Assign Holder</button>
              <button onClick={() => { setIsMovingInv(!isMovingInv); setShowQuickActions(false); }}>Move Inventory</button>
              <button onClick={() => handleQuickAction('markAvailable')}>Mark Available</button>
              <button onClick={() => handleQuickAction('markMissing')}>Mark Missing</button>
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '4px 0' }}></div>
              <button onClick={() => handleQuickAction('delete')} className="danger">Delete Inventory</button>
            </div>
          )}
        </div>
      </div>

      {isMovingInv && (
        <div style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', marginBottom: '16px' }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#e5e7eb' }}>Move Inventory</h4>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select className="inv-input" value={invTargetId} onChange={e => setInvTargetId(e.target.value)}>
              <option value="">(Root level of list)</option>
              {inventories.filter(i => i.id !== selectedInventory.id && i.listId === selectedList?.id).map(i => {
                const pathStr = getInventoryPath(i.id).map(p => p.name).join(' > ');
                return <option key={i.id} value={i.id}>{pathStr}</option>;
              })}
            </select>
            <button className="inv-btn secondary" onClick={handleMoveInventory}>Move</button>
            <button className="inv-btn ghost" onClick={() => setIsMovingInv(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="inv-tabs">
        {['Overview', 'Sub-Inventories', 'Items', 'History'].map(tab => {
          const childCount = tab === 'Sub-Inventories' ? `(${inventories.filter(i => i.parentInventoryId === selectedInventory.id).length})` : '';
          const itemCount = tab === 'Items' ? `(${items.length})` : '';
          return (
            <button 
              key={tab} 
              className={`inv-tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab} {itemCount} {childCount}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        
        {activeTab === 'Overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            
            <div className="details-section">
              <h3 className="section-title">Current Holder</h3>
              {selectedInventory.currentHolder ? (
                <div className="meta-grid">
                  <div className="meta-label">User</div> 
                  <div className="meta-value">{usersMap[selectedInventory.currentHolder] || selectedInventory.currentHolder}</div>
                  <div className="meta-label">Room</div> 
                  <div className="meta-value">{selectedInventory.currentRoom || 'N/A'}</div>
                  <div className="meta-label">Since</div> 
                  <div className="meta-value">{new Date(selectedInventory.currentAssignedDate).toLocaleDateString()}</div>
                </div>
              ) : <div className="details-body" style={{ color: '#9ca3af' }}>No current holder.</div>}
            </div>

            <div className="details-section">
              <h3 className="section-title">Assign New Holder</h3>
              <form onSubmit={handleAssignHolder} style={{ display: 'flex', gap: '8px' }}>
                <select
                  className="inv-input"
                  value={newHolderEmail}
                  onChange={e => setNewHolderEmail(e.target.value)}
                  required
                >
                  <option value="">Select User...</option>
                  {usersList.map(u => (
                    <option key={u.email} value={u.email}>{u.name || u.email}</option>
                  ))}
                </select>
                <button type="submit" className="inv-btn secondary">Assign</button>
              </form>
            </div>

            <div className="details-section">
              <h3 className="section-title">Metadata</h3>
              <div className="meta-grid">
                <div className="meta-label">Created</div> 
                <div className="meta-value">{new Date(selectedInventory.createdAt).toLocaleString()}</div>
                <div className="meta-label">Creator</div> 
                <div className="meta-value">{usersMap[selectedInventory.createdBy] || selectedInventory.createdBy}</div>
                <div className="meta-label">Total Items</div> 
                <div className="meta-value">{items.reduce((acc, it) => acc + (it.quantity||1), 0)}</div>
              </div>
            </div>

          </div>
        )}

        {activeTab === 'Sub-Inventories' && (
          <div>
            <form onSubmit={handleAddSubInventory} style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
              <input 
                type="text" 
                className="inv-input"
                value={newSubInvName}
                onChange={e => setNewSubInvName(e.target.value)}
                placeholder="Add sub-inventory..."
                required
                style={{ flex: 1 }}
              />
              <button type="submit" className="inv-btn secondary">Create</button>
            </form>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {inventories.filter(i => i.parentInventoryId === selectedInventory.id).map(inv => (
                <div 
                  key={inv.id}
                  onClick={() => setSelectedInventoryId(inv.id)}
                  className="inventory-card"
                >
                  <div className="card-title">
                    <span>{inv.name}</span>
                  </div>
                </div>
              ))}
              {inventories.filter(i => i.parentInventoryId === selectedInventory.id).length === 0 && (
                <div className="empty-state">No sub-inventories.</div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'Items' && (
          <div>
            <form onSubmit={handleAddItem} style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
              <input 
                type="text" 
                className="inv-input"
                value={newItemName}
                onChange={e => setNewItemName(e.target.value)}
                placeholder="Add new item..."
                required
                style={{ flex: 2 }}
              />
              <input 
                type="number" 
                className="inv-input"
                value={newItemQty}
                onChange={e => setNewItemQty(e.target.value)}
                min="1"
                required
                style={{ flex: 1 }}
              />
              <button type="submit" className="inv-btn secondary">Add</button>
            </form>

            <table className="inv-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th style={{ width: '80px' }}>Qty</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id}>
                    <td>
                      {editingItemId === item.id ? (
                        <input
                          type="text"
                          className="inv-input"
                          value={editingName}
                          onChange={e => setEditingName(e.target.value)}
                          style={{ padding: '4px 8px' }}
                        />
                      ) : item.name}
                    </td>
                    <td>
                      {editingItemId === item.id ? (
                        <input
                          type="number"
                          className="inv-input"
                          value={editingQty}
                          onChange={e => setEditingQty(e.target.value)}
                          style={{ width: '60px', padding: '4px 8px' }}
                          min="0"
                        />
                      ) : (
                        <span style={{ fontWeight: 500 }}>{item.quantity}</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {movingItemId === item.id ? (
                        <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
                          <select 
                            className="inv-input"
                            style={{ width: '120px', padding: '4px 8px' }}
                            value={targetInventoryId}
                            onChange={e => setTargetInventoryId(e.target.value)}
                          >
                            <option value="">Dest...</option>
                            {inventories.filter(i => i.id !== selectedInventory.id).map(i => {
                              const pList = lists.find(l => l.id === i.listId)?.name;
                              const pathStr = getInventoryPath(i.id).map(p => p.name).join(' > ');
                              return <option key={i.id} value={i.id}>{pList} &gt; {pathStr}</option>;
                            })}
                          </select>
                          <button onClick={() => handleMoveItem(item.id, item.name)} className="inv-btn secondary small">OK</button>
                          <button onClick={() => setMovingItemId(null)} className="inv-btn ghost small">✕</button>
                        </div>
                      ) : editingItemId === item.id ? (
                        <div style={{ display: 'inline-flex', gap: '4px' }}>
                          <button onClick={() => handleSaveItem(item)} className="inv-btn secondary small">Save</button>
                          <button onClick={() => setEditingItemId(null)} className="inv-btn ghost small">✕</button>
                        </div>
                      ) : (
                        <div style={{ display: 'inline-flex', gap: '4px' }}>
                          <button onClick={() => { setEditingItemId(item.id); setEditingQty(item.quantity); setEditingName(item.name); }} className="inv-btn ghost small"><Edit2 size={14} /></button>
                          <button onClick={() => setMovingItemId(item.id)} className="inv-btn ghost small" style={{ fontSize: '11px' }}>MOVE</button>
                          <button onClick={() => handleDeleteItem(item.id, item.name)} className="inv-btn ghost small" style={{ color: '#ef4444' }}><Trash2 size={14} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length === 0 && <div className="empty-state">No items.</div>}
          </div>
        )}

        {activeTab === 'History' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            <div className="details-section">
              <h3 className="section-title">Holder History</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#64ffda', fontWeight: 500 }}>Current Holder</h4>
                  {selectedInventory.currentHolder ? (
                    <div className="meta-grid" style={{ gap: '4px 16px' }}>
                      <div className="meta-label">User</div> 
                      <div className="meta-value">{usersMap[selectedInventory.currentHolder] || selectedInventory.currentHolder}</div>
                      <div className="meta-label">Room</div> 
                      <div className="meta-value">{selectedInventory.currentRoom || 'Unknown'}</div>
                      <div className="meta-label">Assigned</div> 
                      <div className="meta-value">{new Date(selectedInventory.currentAssignedDate).toLocaleString()}</div>
                    </div>
                  ) : (
                    <div className="details-body" style={{ color: '#9ca3af' }}>No current holder.</div>
                  )}
                </div>

                {selectedInventory.previousHolder && (
                  <div>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#9ca3af', fontWeight: 500 }}>Previous Holder</h4>
                    <div className="meta-grid" style={{ gap: '4px 16px' }}>
                      <div className="meta-label">User</div> 
                      <div className="meta-value">{usersMap[selectedInventory.previousHolder] || selectedInventory.previousHolder}</div>
                      <div className="meta-label">Room</div> 
                      <div className="meta-value">{selectedInventory.previousRoom || 'Unknown'}</div>
                      <div className="meta-label">Assigned</div> 
                      <div className="meta-value">{new Date(selectedInventory.previousAssignedDate).toLocaleString()}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="details-section">
              <h3 className="section-title">Timeline</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {combinedHistory.map(hist => {
                  const dateStr = new Date(hist.timestamp).toLocaleString();
                  const userName = usersMap[hist.userId] || hist.userId;
                  
                  if (hist._type === 'hold_assign') {
                    return (
                      <div key={hist.id} className="history-item">
                        <div className="history-header">
                          <span className="history-title" style={{ color: '#64ffda' }}>Assigned Holder</span>
                          <span className="history-date">{dateStr}</span>
                        </div>
                        <div className="details-body">{userName} was assigned this inventory.</div>
                      </div>
                    );
                  }

                  if (hist._type === 'hold_remove') {
                    return (
                      <div key={hist.id} className="history-item">
                        <div className="history-header">
                          <span className="history-title" style={{ color: '#ef4444' }}>Returned / Removed</span>
                          <span className="history-date">{dateStr}</span>
                        </div>
                        <div className="details-body">{userName} returned or was removed from this inventory.</div>
                      </div>
                    );
                  }
                  
                  let title = 'Item Modified';
                  if (hist.action === 'quantity_changed') title = 'Quantity Edited';
                  else if (hist.action === 'moved') title = 'Item Moved';
                  else if (hist.action === 'created') title = 'Item Added';

                  return (
                    <div key={hist.id} className="history-item">
                      <div className="history-header">
                        <span className="history-title">{title}</span>
                        <span className="history-date">{dateStr}</span>
                      </div>
                      <div className="details-body">
                        By {userName}
                        {hist.action === 'quantity_changed' && (
                          <div style={{ marginTop: '4px', color: '#9ca3af' }}>{hist.itemName}: {hist.previousQuantity} ➔ {hist.newQuantity}</div>
                        )}
                        {hist.action === 'moved' && (
                          <div style={{ marginTop: '4px', color: '#9ca3af' }}>{hist.itemName} moved from {hist.previousInventoryId}</div>
                        )}
                        {hist.action === 'created' && (
                          <div style={{ marginTop: '4px', color: '#9ca3af' }}>{hist.itemName} added (Qty: {hist.newQuantity})</div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {combinedHistory.length === 0 && <div className="empty-state">No history recorded.</div>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InventoryDetailsPane;
