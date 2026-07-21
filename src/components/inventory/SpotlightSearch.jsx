import React, { useState, useEffect, useRef } from 'react';
import { useInventory } from './InventoryContext';
import { Search, List, Box, Package, User } from 'lucide-react';

const SpotlightSearch = () => {
  const { 
    isSpotlightOpen, 
    setIsSpotlightOpen, 
    lists, 
    inventories, 
    allItems, 
    usersList,
    selectedListId,
    setSelectedListId, 
    setSelectedInventoryId,
    getInventoryPath
  } = useInventory();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isSpotlightOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isSpotlightOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const q = query.toLowerCase();
    const newResults = [];
    
    // O(1) lookup map for archiving status
    const listArchivedMap = lists.reduce((acc, l) => {
      acc[l.id] = l.isArchived;
      return acc;
    }, {});

    // Search Lists
    lists.forEach(l => {
      if (listArchivedMap[l.id] && selectedListId !== l.id) return;
      if (l.name.toLowerCase().includes(q)) {
        newResults.push({ type: 'list', id: l.id, name: l.name, subtext: 'Inventory List', targetListId: l.id, targetInvId: null });
      }
    });

    // Search Inventories
    inventories.forEach(inv => {
      if (listArchivedMap[inv.listId] && selectedListId !== inv.listId) return;
      const parentListObj = lists.find(l => l.id === inv.listId);
      if (!parentListObj) return; // Ignore orphaned inventories

      if (inv.name.toLowerCase().includes(q) || (inv.currentHolder && inv.currentHolder.toLowerCase().includes(q))) {
        const pathStr = getInventoryPath(inv.id).map(p => p.name).join(' > ');
        newResults.push({ 
          type: 'inventory', 
          id: inv.id, 
          name: inv.name, 
          subtext: `Inventory in ${parentListObj.name} > ${pathStr}`, 
          targetListId: inv.listId, 
          targetInvId: inv.id 
        });
      }
    });

    // Search Items (if loaded)
    allItems.forEach(item => {
      const parentInv = inventories.find(i => i.id === item.inventoryId);
      if (parentInv) {
        if (listArchivedMap[parentInv.listId] && selectedListId !== parentInv.listId) return;
        if (item.name.toLowerCase().includes(q)) {
          const parentListObj = lists.find(l => l.id === parentInv.listId);
          if (!parentListObj) return; // Ignore items in orphaned inventories

          const pathStr = getInventoryPath(parentInv.id).map(p => p.name).join(' > ');
          newResults.push({
            type: 'item',
            id: item.id,
            name: item.name,
            subtext: `Item in ${parentListObj.name} > ${pathStr}`,
            targetListId: parentInv.listId,
            targetInvId: parentInv.id
          });
        }
      }
    });

    // Search Users (Holders)
    usersList.forEach(u => {
      if ((u.name && u.name.toLowerCase().includes(q)) || (u.email && u.email.toLowerCase().includes(q))) {
        // Find inventories held by this user
        const heldInvs = inventories.filter(i => i.currentHolder === u.email);
        heldInvs.forEach(inv => {
          if (listArchivedMap[inv.listId] && selectedListId !== inv.listId) return;
          const parentListObj = lists.find(l => l.id === inv.listId);
          if (!parentListObj) return;

          const pathStr = getInventoryPath(inv.id).map(p => p.name).join(' > ');
          newResults.push({
            type: 'user',
            id: `${u.id}-${inv.id}`,
            name: u.name || u.email,
            subtext: `Holds: ${parentListObj.name} > ${pathStr}`,
            targetListId: inv.listId,
            targetInvId: inv.id
          });
        });
      }
    });

    // Take top 20 to avoid lag
    setResults(newResults.slice(0, 20));
    setSelectedIndex(0);
  }, [query, lists, inventories, allItems, usersList, selectedListId]);

  const handleSelect = (result) => {
    if (result.targetListId) setSelectedListId(result.targetListId);
    if (result.targetInvId) {
      setSelectedInventoryId(result.targetInvId);
    } else {
      setSelectedInventoryId(null);
    }
    setIsSpotlightOpen(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsSpotlightOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    }
  };

  if (!isSpotlightOpen) return null;

  const getIconForType = (type) => {
    switch(type) {
      case 'list': return <List size={16} />;
      case 'inventory': return <Box size={16} />;
      case 'item': return <Package size={16} />;
      case 'user': return <User size={16} />;
      default: return <Search size={16} />;
    }
  };

  return (
    <div className="spotlight-overlay" onClick={() => setIsSpotlightOpen(false)}>
      <div className="spotlight-modal" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <Search size={20} color="#6b7280" />
          <input 
            ref={inputRef}
            type="text" 
            className="spotlight-input"
            style={{ borderBottom: 'none', paddingLeft: '12px' }}
            placeholder="Search items, inventories, lists... (Ctrl+K)"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        {results.length > 0 && (
          <div className="spotlight-results">
            {results.map((res, idx) => (
              <div 
                key={res.id} 
                className={`spotlight-item ${idx === selectedIndex ? 'selected' : ''}`}
                onClick={() => handleSelect(res)}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <div className="spotlight-icon">{getIconForType(res.type)}</div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <span className="spotlight-name">{res.name}</span>
                  <span className="spotlight-meta">{res.subtext}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        {query.trim() && results.length === 0 && (
          <div className="empty-state">
            No results found.
          </div>
        )}
      </div>
    </div>
  );
};

export default SpotlightSearch;
