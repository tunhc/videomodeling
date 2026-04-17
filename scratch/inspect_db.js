const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const keyPath = path.join(process.cwd(), 'serviceAccountKey.json');
let serviceAccount;
try {
  const rawData = fs.readFileSync(keyPath, 'utf8');
  // Simple sanitize if needed (though usually not for raw JS strings in files)
  serviceAccount = JSON.parse(rawData);
} catch (error) {
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

async function inspectCollections() {
  try {
    const collections = await db.listCollections();
    const collectionIds = collections.map(c => c.id);
    console.log('--- Database Collections ---');
    console.log(collectionIds.join(', '));
    
    for (const id of collectionIds) {
      const snap = await db.collection(id).limit(1).get();
      console.log(`Collection [${id}]: ${snap.size > 0 ? 'Has entries' : 'Empty'}`);
      if (snap.size > 0) {
          const doc = snap.docs[0].data();
          // Check for cloudinary or video indicators
          const keys = Object.keys(doc).join(', ').toLowerCase();
          if (keys.includes('video') || keys.includes('cloudinary') || keys.includes('url')) {
              console.log(`  -> Potential video collection match! Sample keys: ${keys}`);
          }
      }
    }
    
    // Specifically count 'videos' again to be sure
    const videosSnap = await db.collection('videos').get();
    console.log(`\nFinal check - 'videos' collection size: ${videosSnap.size}`);

  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

inspectCollections();
