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

async function verify() {
  console.log("🔍 Verifying Database Migration...");

  // 1. Check Admin
  const phAdmin = await db.collection("users").doc("PH_admin").get();
  if (phAdmin.exists && phAdmin.data().password === "admin$$$") {
    console.log("✅ PH_admin verified.");
  } else {
    console.error("❌ PH_admin missing or wrong password.");
  }

  // 2. Check a parent
  const parentId = "PH_KBC-HCM_Long-G20";
  const parent = await db.collection("users").doc(parentId).get();
  if (parent.exists && parent.data().password === "PH_Long") {
    console.log(`✅ ${parentId} verified.`);
  } else {
    console.error(`❌ ${parentId} missing or wrong password.`);
  }

  // 3. Check a child
  const childId = "KBC-HCM_Long-G20";
  const child = await db.collection("children").doc(childId).get();
  if (child.exists && child.data().teacherId === "GV_KBC_VY") {
    console.log(`✅ ${childId} verified.`);
  } else {
    console.error(`❌ ${childId} missing or wrong teacher.`);
  }

  // 4. Check teacher
  const teacherId = "GV_KBC_VY";
  const teacher = await db.collection("users").doc(teacherId).get();
  if (teacher.exists && teacher.data().childIds.includes(childId)) {
    console.log(`✅ ${teacherId} verified.`);
  } else {
    console.error(`❌ ${teacherId} missing or wrong child links.`);
  }

  console.log("\n--- Verification Finished ---");
  process.exit(0);
}

verify();
