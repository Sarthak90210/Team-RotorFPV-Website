import { auth, db } from '../firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, getDoc, query, where, orderBy, serverTimestamp } from 'firebase/firestore';

// Log an action to audit_logs collection
export async function logInventoryAction(action, previousValue = null, newValue = null) {
  try {
    if (!auth.currentUser) return;
    const payload = {
      userEmail: auth.currentUser.email,
      action,
      timestamp: new Date(), // Using new Date() to match backend audit_logs pattern
    };
    if (previousValue !== null) payload.previousValue = previousValue;
    if (newValue !== null) payload.newValue = newValue;
    
    await addDoc(collection(db, 'audit_logs'), payload);
  } catch (error) {
    console.error('Failed to log inventory action:', error);
  }
}

// Fetch all users
export async function fetchUsers() {
  const q = query(collection(db, 'users'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Fetch all tags
export async function fetchTags() {
  const q = query(collection(db, 'tags'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Fetch custom fields
export async function fetchCustomFields() {
  const q = query(collection(db, 'custom_fields'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
