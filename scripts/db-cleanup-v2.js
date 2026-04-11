const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

const keyPath = path.join(process.cwd(), "serviceAccountKey.json");
const rawData = fs.readFileSync(keyPath, "utf8");
const sanitizedData = rawData.replace(/\\([^"\\\/bfnrtu])/g, "$1");
const serviceAccount = JSON.parse(sanitizedData);

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

async function cleanup() {
  console.log("🧹 Starting Database Cleanup...");

  const childRegex = /^KBC-HCM_.+-G\d{2}$/;
  const parentRegex = /^PH_KBC-HCM_.+-G\d{2}$/;
  const teacherRegex = /^GV_KBC_[A-Z]+$/;
  const adminIds = ["PH_admin", "GV_admin"];

  // 1. Cleanup children
  const childrenSnap = await db.collection("children").get();
  for (const doc of childrenSnap.docs) {
    if (!childRegex.test(doc.id)) {
      console.log(`🗑️ Deleting old child: ${doc.id}`);
      await doc.ref.delete();
      // Also delete hpdt_stats if matched
      await db.collection("hpdt_stats").doc(doc.id).delete();
    }
  }

  // 2. Cleanup users
  const usersSnap = await db.collection("users").get();
  for (const doc of usersSnap.docs) {
    const id = doc.id;
    const isNewParent = parentRegex.test(id);
    const isNewTeacher = teacherRegex.test(id);
    const isAdmin = adminIds.includes(id);

    if (!isNewParent && !isNewTeacher && !isAdmin) {
      console.log(`🗑️ Deleting old user: ${id}`);
      await doc.ref.delete();
    }
  }

  console.log("\n✨ Cleanup Finished.");
  process.exit(0);
}

cleanup();
