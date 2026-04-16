const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json'); // Adjust path as needed based on your project

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function check() {
  const c1 = await db.collection('children').doc('KBC-HCM_Khang-G19-1').get();
  const c2 = await db.collection('children').doc('KBC-HCM_Khang-G19').get();
  
  const u1 = await db.collection('users').doc('PH_KBC-HCM_Khang-G19-1').get();
  const u2 = await db.collection('users').doc('PH_KBC-HCM_Khang-G19').get();

  console.log('--- Child: KBC-HCM_Khang-G19-1 ---');
  console.log(c1.exists ? c1.data() : 'NOT FOUND');
  console.log('\n--- Child: KBC-HCM_Khang-G19 ---');
  console.log(c2.exists ? c2.data() : 'NOT FOUND');
  
  console.log('\n--- User: PH_KBC-HCM_Khang-G19-1 ---');
  console.log(u1.exists ? u1.data() : 'NOT FOUND');
  console.log('\n--- User: PH_KBC-HCM_Khang-G19 ---');
  console.log(u2.exists ? u2.data() : 'NOT FOUND');
}

check().catch(console.error);
