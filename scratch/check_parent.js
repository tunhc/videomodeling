const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

async function checkParent() {
  const keyPath = path.join(process.cwd(), 'serviceAccountKey.json');
  const rawData = fs.readFileSync(keyPath, 'utf8');
  const sanitizedData = rawData.replace(/\\([^"\\\/bfnrtu])/g, '$1');
  const serviceAccount = JSON.parse(sanitizedData);

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }

  const db = admin.firestore();
  
  console.log('--- Random Parent User ---');
  const snap = await db.collection('users').where('role', '==', 'parent').limit(1).get();
  snap.forEach(doc => {
    console.log(`ID: ${doc.id}`);
    console.log(JSON.stringify(doc.data(), null, 2));
  });

  process.exit(0);
}

checkParent().catch(err => {
  console.error(err);
  process.exit(1);
});
