
const admin = require('firebase-admin');
const fs = require('fs');

async function cleanup() {
  console.log('🧹 Starting Professional Database Cleanup (KBC Format Only)...');
  
  try {
    const rawData = fs.readFileSync('serviceAccountKey.json', 'utf8');
    const sanitizedData = rawData.replace(/\\([^"\\\/bfnrtu])/g, '$1');
    const key = JSON.parse(sanitizedData);

    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(key) });
    }

    const db = admin.firestore();

    const collectionsToClean = ['children', 'teachers', 'hpdt_stats', 'users', 'video_modeling', 'collaboration_tasks'];
    
    // Retention rules: IDs that must NOT be deleted
    const isKBCChild = (id) => id.startsWith('KBC-HCM_');
    const isKBCTeacher = (id) => id.startsWith('GV_KBC_');
    const isKBCParent = (id) => id.startsWith('PH_KBC-HCM_') || id.startsWith('PH_KBC-');

    for (const colName of collectionsToClean) {
      console.log(`\nChecking collection: ${colName}...`);
      const snap = await db.collection(colName).get();
      let deletedCount = 0;
      const batch = db.batch();

      for (const doc of snap.docs) {
        const id = doc.id;
        let shouldKeep = false;

        if (colName === 'children' || colName === 'hpdt_stats') {
          shouldKeep = isKBCChild(id);
        } else if (colName === 'teachers') {
          shouldKeep = isKBCTeacher(id);
        } else if (colName === 'users') {
          shouldKeep = isKBCTeacher(id) || isKBCParent(id);
        } else if (colName === 'video_modeling' || colName === 'collaboration_tasks') {
          // Rule: delete all existing analysis/tasks to start fresh
          shouldKeep = false; 
        }

        if (!shouldKeep) {
          console.log(`   - Deleting fake entry: ${id}`);
          batch.delete(doc.ref);
          deletedCount++;
        }
      }

      if (deletedCount > 0) {
        await batch.commit();
        console.log(`✅ Deleted ${deletedCount} fake entries from ${colName}.`);
      } else {
        console.log(`✨ No fake entries found in ${colName}.`);
      }
    }

    console.log('\n🎉 DATABASE CLEANUP COMPLETED! Only Pro KBC data remains.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

cleanup();
