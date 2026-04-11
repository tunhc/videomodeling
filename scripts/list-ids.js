
const admin = require('firebase-admin');
const fs = require('fs');

async function listAll() {
  try {
    const rawData = fs.readFileSync('serviceAccountKey.json', 'utf8');
    const sanitizedData = rawData.replace(/\\([^"\\\/bfnrtu])/g, '$1');
    const key = JSON.parse(sanitizedData);

    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(key) });
    }

    const db = admin.firestore();
    
    const collections = ['children', 'teachers', 'hpdt_stats', 'users'];
    
    for (const col of collections) {
      const snap = await db.collection(col).get();
      console.log(`--- ${col} (${snap.size} docs) ---`);
      console.log(snap.docs.map(d => d.id));
    }

    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

listAll();
