const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function consolidate() {
  console.log('--- Starting consolidation for Khang ---');

  const child1Id = 'KBC-HCM_Khang-G19-1';
  const childBaseId = 'KBC-HCM_Khang-G19';
  const user1Id = 'PH_KBC-HCM_Khang-G19-1';
  const userBaseId = 'PH_KBC-HCM_Khang-G19';

  // 1. Get source data
  const child1Doc = await db.collection('children').doc(child1Id).get();
  const user1Doc = await db.collection('users').doc(user1Id).get();

  if (!child1Doc.exists) {
    throw new Error(`Source child ${child1Id} not found`);
  }
  if (!user1Doc.exists) {
    throw new Error(`Source user ${user1Id} not found`);
  }

  const child1Data = child1Doc.data();
  const user1Data = user1Doc.data();

  console.log(`Source child: ${child1Data.name} (${child1Id})`);
  console.log(`Source user: ${user1Data.displayName} (${user1Id})`);

  // 2. Prepare updates
  const batch = db.batch();

  // Update base child with data from child1
  // We keep the base ID but replace all content, ensuring parentId links to the base user
  const updatedChildData = {
    ...child1Data,
    parentId: userBaseId,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
  batch.set(db.collection('children').doc(childBaseId), updatedChildData);

  // Update base user
  batch.update(db.collection('users').doc(userBaseId), {
    displayName: user1Data.displayName,
    teacherId: user1Data.teacherId, // cô Trang
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // 3. Delete duplicates
  batch.delete(db.collection('children').doc(child1Id));
  batch.delete(db.collection('users').doc(user1Id));

  // 4. Commit
  await batch.commit();
  console.log('--- Consolidation completed successfully ---');
}

consolidate().catch(err => {
  console.error('Error during consolidation:', err);
  process.exit(1);
});
