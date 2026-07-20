import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount)
  });
}

const db = getFirestore();
const auth = getAuth();

async function migrate() {
  console.log("Starting migration...");
  
  // 1. Ensure tags exist
  const tagsRef = db.collection('tags');
  const tagsSnap = await tagsRef.get();
  let adminTagId = null;
  let superAdminTagId = null;
  
  tagsSnap.forEach(doc => {
    const data = doc.data();
    if (data.grantsSuperAdmin) superAdminTagId = doc.id;
    else if (data.grantsAdmin) adminTagId = doc.id;
  });

  if (!superAdminTagId) {
    const res = await tagsRef.add({
      name: 'Super Admin',
      grantsAdmin: true,
      grantsSuperAdmin: true
    });
    superAdminTagId = res.id;
    console.log("Created Super Admin tag:", superAdminTagId);
  }

  if (!adminTagId) {
    const res = await tagsRef.add({
      name: 'Admin',
      grantsAdmin: true,
      grantsSuperAdmin: false
    });
    adminTagId = res.id;
    console.log("Created Admin tag:", adminTagId);
  }

  // 2. Fetch all Firebase Auth users to find admins
  let users = [];
  let pageToken;
  do {
    const list = await auth.listUsers(1000, pageToken);
    users = users.concat(list.users);
    pageToken = list.pageToken;
  } while (pageToken);

  console.log(`Found ${users.length} total auth users.`);

  // 3. For each admin, ensure they have a profile document with the correct tag
  for (const user of users) {
    const claims = user.customClaims || {};
    const isAdmin = claims.admin === true;
    const isSuperAdmin = claims.superAdmin === true;
    const isRoot = claims.root === true; // Usually also superAdmin

    if (!isAdmin && !isSuperAdmin && !isRoot) continue;

    console.log(`Migrating admin: ${user.email}`);

    const userRef = db.collection('users').doc(user.email);
    const userDoc = await userRef.get();
    let userData = userDoc.exists ? userDoc.data() : { email: user.email, name: user.displayName || user.email.split('@')[0] };
    let userTags = userData.tags || [];

    if (isSuperAdmin || isRoot) {
      if (!userTags.includes(superAdminTagId)) userTags.push(superAdminTagId);
    } else if (isAdmin) {
      if (!userTags.includes(adminTagId)) userTags.push(adminTagId);
    }

    await userRef.set({ ...userData, tags: userTags }, { merge: true });
    console.log(`  -> Assigned tags:`, userTags);
  }

  console.log("Migration complete.");
}

migrate().catch(console.error);
