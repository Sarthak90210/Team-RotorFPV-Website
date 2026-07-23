const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function checkAchievements() {
  try {
    const snapshot = await db.collection('achievements').orderBy('order', 'desc').get();
    if (snapshot.empty) {
      console.log('No achievements found in Firestore with orderBy("order").');
      const all = await db.collection('achievements').get();
      console.log('Total achievements without orderBy:', all.size);
    } else {
      console.log(`Found ${snapshot.size} achievements.`);
      snapshot.forEach(doc => {
        console.log(doc.id, '=>', doc.data());
      });
    }
  } catch (err) {
    console.error('Error fetching achievements:', err);
  }
}

checkAchievements();
