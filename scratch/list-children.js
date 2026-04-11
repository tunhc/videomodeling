
const admin = require('firebase-admin');
const fs = require('fs');

async function listCurrentChildren() {
  const rawData = fs.readFileSync('serviceAccountKey.json', 'utf8');
  const sanitizedData = rawData.replace(/\\([^"\\\/bfnrtu])/g, '$1');
  const key = JSON.parse(sanitizedData);

  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(key) });
  }

  const db = admin.firestore();
  const snap = await db.collection('children').get();
  
  console.log('--- Current Children in DB ---');
  snap.forEach(doc => {
    console.log(`ID: ${doc.id} | Name: ${doc.data().name}`);
  });
  console.log('--- End of List ---');
  process.exit(0);
}

listCurrentChildren();
