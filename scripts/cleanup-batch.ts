import * as admin from "firebase-admin";
import * as path from "path";
import * as fs from "fs";

const keyPath = path.join(process.cwd(), "serviceAccountKey.json");
let serviceAccount: any;
try {
  const rawData = fs.readFileSync(keyPath, "utf8");
  const sanitizedData = rawData.replace(/\\([^"\\\/bfnrtu])/g, "$1");
  serviceAccount = JSON.parse(sanitizedData);
} catch (error) {
  console.error("❌ Failed to parse serviceAccountKey.json:", error);
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

const videoIds = [
  "02g2AbMdtw362sMekYfM",
  "GgFyR0phI5ohqZyvisvE",
  "KNCo7zqlsGqaYFt46YIb",
  "flnM3uTTrJcKcmpSsGGz"
];

async function cleanup() {
  console.log("🧹 Cleaning up 4 batch-processed videos...");

  for (const videoId of videoIds) {
    try {
      const videoDoc = await db.collection("video_modeling").doc(videoId).get();
      if (videoDoc.exists) {
        const data = videoDoc.data();
        const analysisId = data?.analysisId;

        // 1. Delete from video_analysis
        if (analysisId) {
          await db.collection("video_analysis").doc(analysisId).delete();
          console.log(`🗑️ Deleted analysis: ${analysisId}`);
        }

        // 2. Reset video_modeling status
        await db.collection("video_modeling").doc(videoId).update({
          status: "pending",
          analysisId: admin.firestore.FieldValue.delete(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`✅ Reset video status: ${videoId}`);
      }
    } catch (err: any) {
      console.error(`❌ Error cleaning up ${videoId}:`, err.message);
    }
  }

  console.log("✨ Cleanup finished.");
  process.exit();
}

cleanup();
