import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, orderBy } from "firebase/firestore";
import * as dotenv from 'dotenv';
dotenv.config();

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function test() {
  try {
    const q1 = query(collection(db, 'achievements'), orderBy('order', 'asc'));
    const snapshot1 = await getDocs(q1);
    console.log("Client SDK 'asc' got:", snapshot1.size, "documents.");

    const q2 = query(collection(db, 'achievements'), orderBy('order', 'desc'));
    const snapshot2 = await getDocs(q2);
    console.log("Client SDK 'desc' got:", snapshot2.size, "documents.");
  } catch (err) {
    console.error("Client SDK error:", err);
  }
}

test();
