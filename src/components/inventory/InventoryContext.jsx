import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';

const InventoryContext = createContext();

export const useInventory = () => {
  return useContext(InventoryContext);
};

export const InventoryProvider = ({ children, user }) => {
  const [lists, setLists] = useState([]);
  const [inventories, setInventories] = useState([]);
  const [usersMap, setUsersMap] = useState({});
  const [rawUsersList, setRawUsersList] = useState([]);
  const [tagsList, setTagsList] = useState([]);
  const [allItems, setAllItems] = useState([]); // For spotlight search
  const [hasFetchedAllItems, setHasFetchedAllItems] = useState(false);

  // State
  const [selectedListId, setSelectedListId] = useState('dashboard');
  const [selectedInventoryId, setSelectedInventoryId] = useState(null);
  const [isSpotlightOpen, setIsSpotlightOpen] = useState(false);
  const [fullscreenPane, setFullscreenPane] = useState(null); // 'list' | 'inventory' | null

  useEffect(() => {
    // 1. Fetch Users
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const uMap = {};
      const uList = [];
      snap.docs.forEach(d => {
        const data = d.data();
        uMap[d.id] = data.name || d.id;
        uList.push({ id: d.id, ...data });
      });
      setUsersMap(uMap);
      setRawUsersList(uList);
    });

    // 1.5 Fetch Tags
    const unsubTags = onSnapshot(query(collection(db, 'tags')), (snap) => {
      setTagsList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 2. Fetch Lists
    const qLists = query(collection(db, 'inventory_lists'), orderBy('createdAt', 'desc'));
    const unsubLists = onSnapshot(qLists, (snapshot) => {
      setLists(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // 3. Fetch all Inventories (needed for the middle pane and spotlight)
    const qInvs = query(collection(db, 'inventories'), orderBy('createdAt', 'desc'));
    const unsubInvs = onSnapshot(qInvs, (snapshot) => {
      setInventories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubUsers();
      unsubTags();
      unsubLists();
      unsubInvs();
    };
  }, []);

  const usersList = useMemo(() => {
    const exMemberTagIds = tagsList.filter(t => t.isExMember).map(t => t.id);
    return rawUsersList.filter(u => !(u.tags || []).some(tId => exMemberTagIds.includes(tId)));
  }, [rawUsersList, tagsList]);

  // Fetch all items ONLY when Spotlight is opened for the first time, to save Firebase reads
  useEffect(() => {
    if (isSpotlightOpen && !hasFetchedAllItems) {
      const fetchItems = async () => {
        const snap = await getDocs(collection(db, 'items'));
        setAllItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setHasFetchedAllItems(true);
      };
      fetchItems();
    }
  }, [isSpotlightOpen, hasFetchedAllItems]);

  // Global Ctrl+K listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSpotlightOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Helpers
  const selectedList = useMemo(() => lists.find(l => l.id === selectedListId) || null, [lists, selectedListId]);
  const selectedInventory = useMemo(() => inventories.find(i => i.id === selectedInventoryId) || null, [inventories, selectedInventoryId]);
  const listInventories = useMemo(() => inventories.filter(i => i.listId === selectedListId && !i.parentInventoryId), [inventories, selectedListId]);

  const getInventoryPath = (invId) => {
    const path = [];
    let current = inventories.find(i => i.id === invId);
    // Limit depth to avoid infinite loop on bad data
    let depth = 0;
    while (current && depth < 20) {
      path.unshift(current);
      if (current.parentInventoryId) {
        current = inventories.find(i => i.id === current.parentInventoryId);
      } else {
        current = null;
      }
      depth++;
    }
    return path;
  };

  const toggleFullscreenList = () => setFullscreenPane(prev => prev === 'list' ? null : 'list');
  const toggleFullscreenInventory = () => setFullscreenPane(prev => prev === 'inventory' ? null : 'inventory');

  const value = {
    user,
    lists,
    inventories,
    usersMap,
    usersList,
    allItems, // Only populated after first Ctrl+K
    
    selectedListId,
    setSelectedListId,
    selectedList,
    
    selectedInventoryId,
    setSelectedInventoryId,
    selectedInventory,
    listInventories,
    
    isSpotlightOpen,
    setIsSpotlightOpen,
    
    fullscreenPane,
    setFullscreenPane,
    toggleFullscreenList,
    toggleFullscreenInventory,

    getInventoryPath,
  };

  return (
    <InventoryContext.Provider value={value}>
      {children}
    </InventoryContext.Provider>
  );
};
