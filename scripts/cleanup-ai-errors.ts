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

async function cleanupErrors() {
  console.log("🔍 Searching for failed analysis records...");

  try {
    const analysisSnap = await db.collection("video_analysis").get();
    let count = 0;

    for (const doc of analysisSnap.docs) {
      const data = doc.data();
      const summaryObj = data.summary || {};
      const dominantBehavior = typeof summaryObj === "string" ? summaryObj : (summaryObj.dominantBehavior || "");
      const frameSummary = data.frameAnalysis?.summary || "";
      
      const isError = 
        dominantBehavior.includes("Error fetching from ht") || 
        dominantBehavior.includes("Claude: 400") ||
        frameSummary.includes("Error fetching from ht") ||
        frameSummary.includes("Claude: 400");

      if (isError) {
        const videoId = data.videoId;
        const analysisId = doc.id;

        console.log(`\n🧹 Cleaning up failed analysis: ${analysisId} (Video: ${videoId})`);

        // 1. Delete from video_analysis
        await db.collection("video_analysis").doc(analysisId).delete();

        // 2. Reset video_modeling status if videoId exists
        if (videoId) {
          await db.collection("video_modeling").doc(videoId).update({
            status: "pending",
            analysisId: admin.firestore.FieldValue.delete(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          console.log(`✅ Reset video status to pending: ${videoId}`);
        }
        count++;
      }
    }

    console.log(`\n✨ Finished. Cleaned up ${count} records.`);
  } catch (error) {
    console.error("❌ Cleanup failed:", error);
  } finally {
    process.exit();
  }
}

cleanupErrors();
