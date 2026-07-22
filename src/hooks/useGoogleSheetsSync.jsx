import { useEffect, useRef } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { triggerGoogleSheetsSync } from '../lib/googleSheetsSync';

export const useGoogleSheetsSync = () => {
  const debounceTimerRef = useRef(null);
  const isLeaderRef = useRef(false);
  const tabIdRef = useRef(Math.random().toString(36).substring(2, 11));

  // Multi-tab BroadcastChannel leader election & timestamped lock
  useEffect(() => {
    let channel;
    const tabId = tabIdRef.current;

    const claimLeadership = () => {
      isLeaderRef.current = true;
      const lockData = { leaderId: tabId, timestamp: Date.now() };
      localStorage.setItem('trfpv_sync_leader', JSON.stringify(lockData));
      if (channel) {
        channel.postMessage({ type: 'I_AM_LEADER', leaderId: tabId });
      }
    };

    const checkLeaderStatus = () => {
      try {
        const raw = localStorage.getItem('trfpv_sync_leader');
        if (!raw) {
          claimLeadership();
          return;
        }
        const lock = JSON.parse(raw);
        // Overrides stale lock older than 30 seconds
        if (lock.leaderId === tabId) {
          isLeaderRef.current = true;
          // Refresh lock heartbeat timestamp
          localStorage.setItem('trfpv_sync_leader', JSON.stringify({ leaderId: tabId, timestamp: Date.now() }));
        } else if (Date.now() - lock.timestamp > 30000) {
          claimLeadership();
        } else {
          isLeaderRef.current = false;
        }
      } catch (e) {
        claimLeadership();
      }
    };

    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel('trfpv_inventory_sync');

      channel.onmessage = (event) => {
        if (event.data?.type === 'WHO_IS_LEADER') {
          if (isLeaderRef.current) {
            channel.postMessage({ type: 'I_AM_LEADER', leaderId: tabId });
          }
        } else if (event.data?.type === 'I_AM_LEADER') {
          if (event.data.leaderId !== tabId) {
            isLeaderRef.current = false;
          }
        }
      };

      // Ask if another tab is currently the leader
      channel.postMessage({ type: 'WHO_IS_LEADER' });
    }

    checkLeaderStatus();
    const heartbeatInterval = setInterval(checkLeaderStatus, 10000);

    return () => {
      clearInterval(heartbeatInterval);
      if (isLeaderRef.current) {
        localStorage.removeItem('trfpv_sync_leader');
      }
      if (channel) channel.close();
    };
  }, []);

  // Periodic fallback sync (every 20 mins) if leader
  useEffect(() => {
    const interval = setInterval(() => {
      if (isLeaderRef.current) {
        triggerGoogleSheetsSync();
      }
    }, 20 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Monitor Firestore changes (2-second debounce for coalescing rapid edits)
  useEffect(() => {
    let itemsLoaded = false;
    let invsLoaded = false;

    const handleDataChange = () => {
      if (!itemsLoaded || !invsLoaded) return;
      if (!isLeaderRef.current) return; // Only elected leader tab dispatches webhook

      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        triggerGoogleSheetsSync();
      }, 2000); // 2-second debounce
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
