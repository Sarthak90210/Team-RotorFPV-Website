import React, { useState } from 'react';
import { useInventory } from './InventoryContext';
import { ChevronRight, ChevronDown, List as ListIcon, Folder } from 'lucide-react';

const DestinationPickerModal = ({ isOpen, onClose, onConfirm, title = "Select Destination", invalidTargets = [], allowedTypes = ['list', 'inventory'] }) => {
  const { lists, inventories, getInventoryPath } = useInventory();
  const [selectedTarget, setSelectedTarget] = useState(null); // format: { type: 'list' | 'inventory', id: string, name: string }
  const [expandedNodes, setExpandedNodes] = useState(new Set()); // set of string IDs

  if (!isOpen) return null;

  const toggleExpand = (e, id) => {
    e.stopPropagation();
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isInvalid = (type, id) => {
    if (invalidTargets.includes(`${type}:${id}`)) return true;
    
    // Check if any ancestor is in invalidTargets
    if (type === 'inventory') {
      const path = getInventoryPath(id);
      for (const p of path) {
        if (invalidTargets.includes(`inventory:${p.id}`)) return true;
      }
    }
    return false;
  };

  // Helper to get nested inventories
  const getChildren = (parentId) => inventories.filter(i => i.parentInventoryId === parentId);
  const getRootInventories = (listId) => inventories.filter(i => i.listId === listId && !i.parentInventoryId);

  const renderInventoryNode = (inv, level) => {
    const children = getChildren(inv.id);
    const hasChildren = children.length > 0;
    const isExpanded = expandedNodes.has(inv.id);
    const invalid = isInvalid('inventory', inv.id);
    const isSelected = selectedTarget?.type === 'inventory' && selectedTarget?.id === inv.id;
    const canSelect = allowedTypes.includes('inventory');

    return (
      <div key={inv.id}>
        <div 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            padding: '6px 8px', 
            paddingLeft: `${level * 20 + 8}px`,
            cursor: invalid ? 'not-allowed' : 'pointer',
            opacity: invalid ? 0.5 : 1,
            backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
            borderRadius: '4px',
            gap: '8px'
          }}
          onClick={() => {
            if (!invalid && canSelect) {
              setSelectedTarget({ type: 'inventory', id: inv.id, name: inv.name });
            }
          }}
          className={!invalid && canSelect ? "hover-bg" : ""}
        >
          {hasChildren ? (
            <div onClick={(e) => toggleExpand(e, inv.id)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </div>
          ) : (
            <div style={{ width: '14px' }}></div>
          )}
          <Folder size={14} color="#9ca3af" />
          <span style={{ fontSize: '13px' }}>{inv.name}</span>
        </div>
        
        {isExpanded && hasChildren && (
          <div>
            {children.map(child => renderInventoryNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
      backgroundColor: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1100
    }}>
      <div style={{
        backgroundColor: '#1f2937',
        border: '1px solid #374151',
        borderRadius: '8px',
        width: '400px',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #374151' }}>
          <h3 style={{ margin: 0, fontSize: '16px', color: '#f3f4f6' }}>{title}</h3>
        </div>
        
        <div style={{ padding: '12px', overflowY: 'auto', flex: 1 }}>
          <style>{`
            .hover-bg:hover { background-color: rgba(255,255,255,0.05); }
          `}</style>
          {lists.filter(l => !l.isArchived).map(list => {
            const rootInvs = getRootInventories(list.id);
            const isExpanded = expandedNodes.has(`list_${list.id}`);
            const invalid = isInvalid('list', list.id);
            const isSelected = selectedTarget?.type === 'list' && selectedTarget?.id === list.id;
            const canSelect = allowedTypes.includes('list');

            return (
              <div key={list.id}>
                <div 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    padding: '8px', 
                    cursor: invalid ? 'not-allowed' : 'pointer',
                    opacity: invalid ? 0.5 : 1,
                    backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                    borderRadius: '4px',
                    gap: '8px',
                    fontWeight: 500
                  }}
                  onClick={() => {
                    if (!invalid && canSelect) {
                      setSelectedTarget({ type: 'list', id: list.id, name: list.name });
                    }
                  }}
                  className={!invalid && canSelect ? "hover-bg" : ""}
                >
                  <div onClick={(e) => toggleExpand(e, `list_${list.id}`)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </div>
                  <ListIcon size={14} color="#60a5fa" />
                  <span style={{ fontSize: '14px' }}>{list.name}</span>
                </div>
                
                {isExpanded && (
                  <div>
                    {rootInvs.map(inv => renderInventoryNode(inv, 1))}
                  </div>
                )}
              </div>
            );
          })}
          
          {lists.filter(l => l.isArchived).length > 0 && (
            <div style={{ padding: '8px', marginTop: '16px', borderTop: '1px solid #374151', color: '#9ca3af', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Archived
            </div>
          )}
          
          {lists.filter(l => l.isArchived).map(list => {
            const rootInvs = getRootInventories(list.id);
            const isExpanded = expandedNodes.has(`list_${list.id}`);
            const invalid = isInvalid('list', list.id);
            const isSelected = selectedTarget?.type === 'list' && selectedTarget?.id === list.id;
            const canSelect = allowedTypes.includes('list');

            return (
              <div key={list.id}>
                <div 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    padding: '8px', 
                    cursor: invalid ? 'not-allowed' : 'pointer',
                    opacity: 0.6,
                    backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                    borderRadius: '4px',
                    gap: '8px',
                    fontWeight: 500
                  }}
                  onClick={() => {
                    if (!invalid && canSelect) {
                      setSelectedTarget({ type: 'list', id: list.id, name: list.name });
                    }
                  }}
                  className={!invalid && canSelect ? "hover-bg" : ""}
                >
                  <div onClick={(e) => toggleExpand(e, `list_${list.id}`)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </div>
                  <ListIcon size={14} color="#9ca3af" />
                  <span style={{ fontSize: '14px', color: '#9ca3af' }}>{list.name}</span>
                </div>
                
                {isExpanded && (
                  <div style={{ opacity: 0.7 }}>
                    {rootInvs.map(inv => renderInventoryNode(inv, 1))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ padding: '16px', borderTop: '1px solid #374151', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button className="inv-btn ghost" onClick={onClose}>Cancel</button>
          <button 
            className="inv-btn secondary" 
            disabled={!selectedTarget}
            onClick={() => onConfirm(selectedTarget)}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

export default DestinationPickerModal;
