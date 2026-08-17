// Deletes Firestore Event documents only. Cloudinary assets are intentionally untouched.
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : JSON.parse(readFileSync(new URL('./serviceAccountKey.json', import.meta.url)));

initializeApp({ credential: cert(serviceAccount) });

const resetEvents = async () => {
  const db = getFirestore();
  const snapshot = await db.collection('events').get();
  const ids = snapshot.docs.map((eventDoc) => eventDoc.id);

  while (ids.length > 0) {
    const batch = db.batch();
    ids.splice(0, 500).forEach((id) => batch.delete(db.collection('events').doc(id)));
    await batch.commit();
  }

  const remaining = await db.collection('events').count().get();
  console.log(JSON.stringify({ collection: 'events', deleted: snapshot.size, remaining: remaining.data().count }));
};

resetEvents().catch((error) => {
  console.error('Event reset failed:', error.message);
  process.exitCode = 1;
});
