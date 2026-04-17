const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

async function verify() {
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
  
  const childId = 'KBC-HCM_Hung-B20';
  const parentId = 'PH_KBC-HCM_Hung-B20';
  const teachers = ['GV_KBC_QUYNH', 'GV_KBC_THAO'];

  console.log(`--- Verifying Child: ${childId} ---`);
  const childDoc = await db.collection('children').doc(childId).get();
  console.log(JSON.stringify(childDoc.data(), null, 2));

  console.log(`\n--- Verifying Parent: ${parentId} ---`);
  const parentDoc = await db.collection('users').doc(parentId).get();
  console.log(JSON.stringify(parentDoc.data(), null, 2));

  for (const tid of teachers) {
    console.log(`\n--- Verifying Teacher: ${tid} ---`);
    const tDoc = await db.collection('users').doc(tid).get();
    const data = tDoc.data();
    console.log(`ChildIds: ${JSON.stringify(data.childIds)}`);
  }

  process.exit(0);
}

verify().catch(err => {
  console.error(err);
  process.exit(1);
});
