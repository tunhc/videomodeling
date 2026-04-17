const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

async function checkTeacher() {
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
  
  console.log('--- Teacher: GV_KBC_QUYNH ---');
  const doc1 = await db.collection('users').doc('GV_KBC_QUYNH').get();
  console.log(JSON.stringify(doc1.data(), null, 2));

  console.log('\n--- Teacher: GV_KBC_THAO ---');
  const doc2 = await db.collection('users').doc('GV_KBC_THAO').get();
  console.log(JSON.stringify(doc2.data(), null, 2));

  process.exit(0);
}

checkTeacher().catch(err => {
  console.error(err);
  process.exit(1);
});
