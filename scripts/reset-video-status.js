const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://ai4autism-video-modeling-default-rtdb.firebaseio.com"
  });
}

const db = admin.firestore();

async function resetVideoStatus() {
  console.log("Starting status reset...");
  const snapshot = await db.collection('video_modeling')
    .where('status', '==', 'Đã phân tích')
    .get();

  if (snapshot.empty) {
    console.log("No videos found with status 'Đã phân tích'.");
    return;
  }

  console.log(`Found ${snapshot.size} videos to reset.`);

  const batch = db.batch();
  snapshot.docs.forEach(doc => {
    batch.update(doc.ref, { status: 'pending' });
  });

  await batch.commit();
  console.log("Successfully reset statuses to 'pending'.");
}

resetVideoStatus().catch(console.error);
