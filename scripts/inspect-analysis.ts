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

async function inspect() {
  console.log("🔍 Fetching latest analysis...");
  const snap = await db.collection("video_analysis").orderBy("createdAt", "desc").limit(1).get();
  if (snap.empty) {
    console.log("No analysis found.");
    process.exit();
  }
  const data = snap.docs[0].data();
  console.log(JSON.stringify(data, null, 2));
  process.exit();
}

inspect();
