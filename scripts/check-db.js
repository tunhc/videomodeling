
const admin = require('firebase-admin');
const fs = require('fs');

async function check() {
  try {
    const rawData = fs.readFileSync('serviceAccountKey.json', 'utf8');
    const sanitizedData = rawData.replace(/\\([^"\\\/bfnrtu])/g, '$1');
    const key = JSON.parse(sanitizedData);

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(key)
      });
    }

    const db = admin.firestore();
    
    console.log('--- Checking Collections ---');
    const collections = await db.listCollections();
    console.log('Collections:', collections.map(c => c.id));

    console.log('\n--- Checking hpdt_stats structure ---');
    const hpdtSnap = await db.collection('hpdt_stats').limit(1).get();
    if (!hpdtSnap.empty) {
      console.log('HPDT Doc Data:', JSON.stringify(hpdtSnap.docs[0].data(), null, 2));
    } else {
      console.log('hpdt_stats collection is empty.');
    }

    console.log('\n--- Checking children Docs ---');
    const childrenSnap = await db.collection('children').limit(5).get();
    console.log('Children IDs:', childrenSnap.docs.map(d => d.id));

    console.log('\n--- Checking students Docs ---');
    const studentsSnap = await db.collection('students').limit(5).get();
    console.log('Students IDs:', studentsSnap.docs.map(d => d.id));

    process.exit(0);
  } catch (error) {
    console.error('Error during check:', error);
    process.exit(1);
  }
}

check();
