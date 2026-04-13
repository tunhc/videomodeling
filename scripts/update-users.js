const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

async function updateUsers() {
  try {
    const keyPath = path.join(process.cwd(), 'serviceAccountKey.json');
    const rawData = fs.readFileSync(keyPath, 'utf8');
    
    // Use the same sanitization as the app
    const sanitizedData = rawData.replace(/\\([^"\\\/bfnrtu])/g, "$1");
    const serviceAccount = JSON.parse(sanitizedData);

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    }

    const db = admin.firestore();

    console.log('Updating GV_admin...');
    await db.collection('users').doc('GV_admin').set({
      role: 'teacher'
    }, { merge: true });
    console.log('✅ GV_admin updated to teacher.');

    console.log('Updating PH_admin...');
    await db.collection('users').doc('PH_admin').set({
      role: 'parent',
      childId: 'PH_KBC-HCM_Anh-G22'
    }, { merge: true });
    console.log('✅ PH_admin updated to parent and linked to PH_KBC-HCM_Anh-G22.');

    // Also ensure PH_KBC-HCM_Anh-G22 exists in children or at least has stats?
    // The user didn't ask but it's good for testing.
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

updateUsers();
