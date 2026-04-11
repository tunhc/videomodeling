import * as admin from "firebase-admin";
import * as path from "path";

const fs = require('fs');
const rawData = fs.readFileSync(path.join(process.cwd(), "serviceAccountKey.json"), "utf8");
// Fix the known issue where backslashes like \k are in the JSON (not valid escapes)
const sanitizedData = rawData.replace(/\\(?![bfnrtu"/\\\\])/g, "\\\\");
const serviceAccount = JSON.parse(sanitizedData);

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

async function migrateVideos() {
  console.log("🚀 Starting migration: Adding teacherId to video_modeling documents...");
  
  // 1. Get all children to create a mapping
  const childrenSnap = await db.collection("children").get();
  const childTeacherMap: Record<string, string> = {};
  
  childrenSnap.forEach(doc => {
    const data = doc.data();
    if (data.teacherId) {
      childTeacherMap[doc.id] = data.teacherId;
    }
  });

  console.log(`✅ Loaded ${Object.keys(childTeacherMap).length} child-teacher relationships.`);

  // 2. Get all videos
  const videosSnap = await db.collection("video_modeling").get();
  let updateCount = 0;

  for (const videoDoc of videosSnap.docs) {
    const videoData = videoDoc.data();
    const assignedTeacherId = childTeacherMap[videoData.childId];

    if (assignedTeacherId && !videoData.teacherId) {
      await db.collection("video_modeling").doc(videoDoc.id).update({
        teacherId: assignedTeacherId
      });
      updateCount++;
    }
  }

  console.log(`🎉 Migration complete! Updated ${updateCount} videos with teacherId.`);
  process.exit(0);
}

migrateVideos();
