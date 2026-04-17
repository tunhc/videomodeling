const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const keyPath = path.join(process.cwd(), 'serviceAccountKey.json');
const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

async function inspectSchema() {
  console.log('--- Inspecting video_modeling ---');
  const vmSnap = await db.collection('video_modeling').limit(5).get();
  vmSnap.forEach(doc => {
    console.log(`ID: ${doc.id}, Role: ${doc.data().role}, UID: ${doc.data().uid}, Child: ${doc.data().childid || doc.data().childId}`);
  });

  console.log('\n--- Inspecting children ---');
  const childrenSnap = await db.collection('children').limit(5).get();
  childrenSnap.forEach(doc => {
    console.log(`ID: ${doc.id}, Name: ${doc.data().name}, Center: ${doc.data().centerId}`);
  });

  console.log('\n--- Inspecting users ---');
  const usersSnap = await db.collection('users').limit(5).get();
  usersSnap.forEach(doc => {
    console.log(`ID: ${doc.id}, Name: ${doc.data().name}, Role: ${doc.data().role}`);
  });

  process.exit();
}

inspectSchema();
