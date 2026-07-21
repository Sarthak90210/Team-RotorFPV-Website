import React, { useState } from 'react';
import { useInventory } from './InventoryContext';
import { collection, addDoc, deleteDoc, updateDoc, doc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { logInventoryAction } from '../../lib/inventoryApi';
import { Plus, Trash2, MoreVertical, Archive, ArchiveRestore, ChevronDown, ChevronRight } from 'lucide-react';

const InventorySidebar = () => {
  const { 
    lists, 
    selectedListId, 
    setSelectedListId, 
    setSelectedInventoryId, 
    user,
    setIsSpotlightOpen
  } = useInventory();
  
  const [newListName, setNewListName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [isArchivedExpanded, setIsArchivedExpanded] = useState(false);

  const activeLists = lists.filter(l => !l.isArchived);
  const archivedLists = lists.filter(l => l.isArchived);

  const handleSelect = (id) => {
    setSelectedListId(id);
    setSelectedInventoryId(null);
    setOpenDropdownId(null);
  };

  const handleAddList = async (e) => {
    e.preventDefault();
    if (!newListName.trim()) return;

    try {
      await addDoc(collection(db, 'inventory_lists'), { 
        name: newListName.trim(),
        createdAt: new Date().toISOString(),
        createdBy: user.email,
        isArchived: false,
        archivedAt: null,
        archivedBy: null
      });
      await logInventoryAction(`Created Inventory List: ${newListName.trim()}`);
      setNewListName('');
      setIsAdding(false);
    } catch (error) {
      console.error("Error adding list:", error);
      alert("Failed to add list");
    }
  };

  const handleArchiveList = async (e, list) => {
    e.stopPropagation();
    try {
      await updateDoc(doc(db, 'inventory_lists', list.id), {
        isArchived: true,
        archivedAt: new Date().toISOString(),
        archivedBy: user.email
      });
      await logInventoryAction(`Archived Inventory List: ${list.name}`);
      setOpenDropdownId(null);
    } catch (error) {
      console.error(error);
      alert("Failed to archive list");
    }
  };

  const handleRestoreList = async (e, list) => {
    e.stopPropagation();
    try {
      await updateDoc(doc(db, 'inventory_lists', list.id), {
        isArchived: false,
        archivedAt: null,
        archivedBy: null
      });
      await logInventoryAction(`Restored Inventory List: ${list.name}`);
      setOpenDropdownId(null);
    } catch (error) {
      console.error(error);
      alert("Failed to restore list");
    }
  };

  const handleDeleteList = async (e, listId, listName) => {
    e.stopPropagation();
    if (!window.confirm(`Delete inventory list "${listName}"? All inventories and items inside it will be permanently deleted.`)) return;
    try {
      // Find all inventories in this list
      const invQuery = query(collection(db, 'inventories'), where('listId', '==', listId));
      const invSnap = await getDocs(invQuery);
      
      const inventoriesToDelete = [];
      invSnap.forEach(d => inventoriesToDelete.push(d.id));

      // For each inventory, delete its items and history
      for (const invId of inventoriesToDelete) {
        const itemQuery = query(collection(db, 'items'), where('inventoryId', '==', invId));
        const itemSnap = await getDocs(itemQuery);
        await Promise.all(itemSnap.docs.map(itemDoc => deleteDoc(doc(db, 'items', itemDoc.id))));
        
        const itemHistQuery = query(collection(db, 'item_history'), where('inventoryId', '==', invId));
        const itemHistSnap = await getDocs(itemHistQuery);
        await Promise.all(itemHistSnap.docs.map(d => deleteDoc(doc(db, 'item_history', d.id))));

        const holdHistQuery = query(collection(db, 'inventory_hold_history'), where('inventoryId', '==', invId));
        const holdHistSnap = await getDocs(holdHistQuery);
        await Promise.all(holdHistSnap.docs.map(d => deleteDoc(doc(db, 'inventory_hold_history', d.id))));
        
        await deleteDoc(doc(db, 'inventories', invId));
      }

      await deleteDoc(doc(db, 'inventory_lists', listId));
      await logInventoryAction(`Deleted Inventory List: ${listName} (and all contents)`);
      if (selectedListId === listId) {
        handleSelect('dashboard');
      }
    } catch (error) {
      console.error("Error deleting list:", error);
      alert("Failed to delete list");
    }
  };

  return (
    <div className="inventory-sidebar" style={{ paddingRight: '10px' }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '0 10px', fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', letterSpacing: '0.5px', fontWeight: 600 }}>
          <span>Lists</span>
          <button onClick={() => setIsAdding(!isAdding)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', display: 'flex' }}>
            <Plus size={14} />
          </button>
        </div>

        {isAdding && (
          <form onSubmit={handleAddList} style={{ display: 'flex', gap: '5px', marginBottom: '10px', padding: '0 5px' }}>
            <input 
              type="text" 
              className="inv-input"
              style={{ flex: 1, minWidth: 0 }}
              placeholder="List name..."
              value={newListName}
              onChange={e => setNewListName(e.target.value)}
              autoFocus
            />
            <button type="submit" className="inv-btn secondary small">Add</button>
          </form>
        )}

        {activeLists.map(list => (
          <div 
            key={list.id}
            onClick={() => handleSelect(list.id)}
            className={`sidebar-item ${selectedListId === list.id ? 'selected' : ''}`}
          >
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{list.name}</span>
            <div className="quick-actions-wrapper" onClick={e => e.stopPropagation()}>
              <button 
                className="del-btn"
                onClick={() => setOpenDropdownId(openDropdownId === list.id ? null : list.id)}
              >
                <MoreVertical size={14} />
              </button>
              {openDropdownId === list.id && (
                <div className="quick-actions-menu" style={{ right: 0, top: '100%', minWidth: '120px' }}>
                  <button onClick={(e) => handleArchiveList(e, list)}>
                    <Archive size={14} style={{ marginRight: '6px' }} /> Archive
                  </button>
                  <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '4px 0' }}></div>
                  <button onClick={(e) => handleDeleteList(e, list.id, list.name)} className="danger">
                    <Trash2 size={14} style={{ marginRight: '6px' }} /> Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {archivedLists.length > 0 && (
          <div style={{ marginTop: '20px' }}>
            <div 
              style={{ padding: '0 10px', fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', letterSpacing: '0.5px', fontWeight: 600, cursor: 'pointer' }}
              onClick={() => setIsArchivedExpanded(!isArchivedExpanded)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {isArchivedExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <span>Archived ({archivedLists.length})</span>
              </div>
            </div>

            {isArchivedExpanded && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {archivedLists.map(list => (
                  <div 
                    key={list.id}
                    onClick={() => handleSelect(list.id)}
                    className={`sidebar-item ${selectedListId === list.id ? 'selected' : ''}`}
                    style={{ opacity: 0.7 }}
                  >
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{list.name}</span>
                    <div className="quick-actions-wrapper" onClick={e => e.stopPropagation()}>
                      <button 
                        className="del-btn"
                        onClick={() => setOpenDropdownId(openDropdownId === list.id ? null : list.id)}
                      >
                        <MoreVertical size={14} />
                      </button>
                      {openDropdownId === list.id && (
                        <div className="quick-actions-menu" style={{ right: 0, top: '100%', minWidth: '120px' }}>
                          <button onClick={(e) => handleRestoreList(e, list)}>
                            <ArchiveRestore size={14} style={{ marginRight: '6px' }} /> Restore
                          </button>
                          <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '4px 0' }}></div>
                          <button onClick={(e) => handleDeleteList(e, list.id, list.name)} className="danger">
                            <Trash2 size={14} style={{ marginRight: '6px' }} /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default InventorySidebar;
