
const admin = require('firebase-admin');
const fs = require('fs');

async function migrate() {
  console.log('🚀 Starting Database Migration & Structure Restoration...');
  
  try {
    const rawData = fs.readFileSync('serviceAccountKey.json', 'utf8');
    const sanitizedData = rawData.replace(/\\([^"\\\/bfnrtu])/g, '$1');
    const key = JSON.parse(sanitizedData);

    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(key) });
    }

    const db = admin.firestore();

    // 1. Merge students into children
    console.log('--- 1. Merging Students into Children ---');
    const studentsSnap = await db.collection('students').get();
    for (const doc of studentsSnap.docs) {
      const data = doc.data();
      console.log(`Migrating student: ${data.name || doc.id} -> children/${doc.id}`);
      await db.collection('children').doc(doc.id).set({
        ...data,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      // Delete from old collection
      await db.collection('students').doc(doc.id).delete();
    }
    console.log('✅ Merge complete.');

    // 2. Enhance hpdt_stats with Sensor dimension
    console.log('\n--- 2. Enhancing HPDT Stats (Adding Sensor) ---');
    const hpdtSnap = await db.collection('hpdt_stats').get();
    for (const doc of hpdtSnap.docs) {
      const data = doc.data();
      if (data.dimensions) {
        if (data.dimensions.sensor === undefined) {
          console.log(`Updating dimensions for child: ${doc.id} (adding sensor)`);
          await db.collection('hpdt_stats').doc(doc.id).set({
            dimensions: {
              ...data.dimensions,
              sensor: data.dimensions.sensor || 50 // Default baseline
            },
            lastUpdate: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
        }
      }
    }
    console.log('✅ HPDT enhancement complete.');

    // 3. Ensure video_modeling exist (Move from videos if any)
    console.log('\n--- 3. Consolidating Video Modeling ---');
    const oldVideosSnap = await db.collection('videos').get();
    if (!oldVideosSnap.empty) {
        for (const doc of oldVideosSnap.docs) {
            console.log(`Moving video ${doc.id} -> video_modeling`);
            await db.collection('video_modeling').doc(doc.id).set(doc.data());
            await db.collection('videos').doc(doc.id).delete();
        }
    }
    console.log('✅ Video modeling consolidated.');

    console.log('\n🎉 ALL DATABASE UPDATES COMPLETED SUCCESSFULLY!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
