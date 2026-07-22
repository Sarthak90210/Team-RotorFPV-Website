import { useEffect, useRef } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { triggerGoogleSheetsSync } from '../lib/googleSheetsSync';

export const useGoogleSheetsSync = () => {
  const debounceTimerRef = useRef(null);
  const isInitialMount = useRef(true);

  // Sync every 20 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      triggerGoogleSheetsSync();
    }, 20 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Monitor for any changes in items or inventories
  useEffect(() => {
    let itemsLoaded = false;
    let invsLoaded = false;

    const handleDataChange = () => {
      // Don't sync on the initial fetch when the page loads
      if (!itemsLoaded || !invsLoaded) return;
      
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      // Wait 5 seconds after the last change before syncing
      debounceTimerRef.current = setTimeout(() => {
        triggerGoogleSheetsSync();
      }, 5000);
    };

    const unsubInvs = onSnapshot(collection(db, 'inventories'), () => {
      if (!invsLoaded) {
        invsLoaded = true;
      } else {
        handleDataChange();
      }
    });

    const unsubItems = onSnapshot(collection(db, 'items'), () => {
      if (!itemsLoaded) {
        itemsLoaded = true;
      } else {
        handleDataChange();
      }
    });

    return () => {
      unsubInvs();
      unsubItems();
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);
};
