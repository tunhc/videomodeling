
const admin = require('firebase-admin');
const fs = require('fs');

async function deleteChild() {
  try {
    const rawData = fs.readFileSync('serviceAccountKey.json', 'utf8');
    const sanitizedData = rawData.replace(/\\([^"\\\/bfnrtu])/g, '$1');
    const key = JSON.parse(sanitizedData);

    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(key) });
    }

    const db = admin.firestore();
    
    // Xóa bé Khôi theo ID chính xác KBC-HCM_Khôi_B03
    const childId = 'KBC-HCM_Khôi_B03';
    
    console.log(`🗑️ Deleting child ${childId}...`);
    
    await db.collection('children').doc(childId).delete();
    await db.collection('hpdt_stats').doc(childId).delete();
    await db.collection('users').doc('PH_' + childId).delete();
    
    console.log('✅ Deleted Minh Khoi successfully.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to delete:', error);
    process.exit(1);
  }
}

deleteChild();
