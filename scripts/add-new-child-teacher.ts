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

function generatePassword(length = 8) {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let retVal = "";
  for (let i = 0, n = charset.length; i < length; ++i) {
    retVal += charset.charAt(Math.floor(Math.random() * n));
  }
  return retVal;
}

async function addData() {
  const childId = "KBC-HCM_Dan-G20";
  const teacherId = "GV_KBC_BINH";
  const parentId = `PH_${childId}`;

  const parentPassword = generatePassword();
  const teacherPassword = generatePassword();

  console.log("🚀 Adding new data to Firestore...");

  try {
    // 1. Create Teacher
    await db.collection("users").doc(teacherId).set({
      displayName: "Giáo viên Kim Bình",
      role: "teacher",
      password: teacherPassword,
      centerCode: "KBC-HCM",
      email: "kimbinh@ai4autism.com",
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    console.log(`✅ Created Teacher: ${teacherId}`);

    // 2. Create Parent
    await db.collection("users").doc(parentId).set({
      displayName: "Phụ huynh Phạm Nguyễn Thanh Đan",
      role: "parent",
      childId: childId,
      password: parentPassword,
      email: `parent_dan@ai4autism.com`,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    console.log(`✅ Created Parent: ${parentId}`);

    // 3. Create Child
    await db.collection("children").doc(childId).set({
      name: "Phạm Nguyễn Thanh Đan",
      initial: "Bối",
      nickname: "Bối",
      schoolCode: "KBC-HCM",
      teacherId: teacherId,
      status: "Bình thường",
      hpdt: 75,
      birthday: "2020-10-14",
      age: 6, // 2026 - 2020
      diagnosis: "ASD Level 1",
      parentId: parentId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    console.log(`✅ Created Child: ${childId}`);

    // 4. Create hpDT stats
    await db.collection("hpdt_stats").doc(childId).set({
      overallScore: 75,
      dimensions: {
        communication: 70,
        social: 75,
        behavior: 80,
        sensory: 75
      },
      lastUpdate: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    console.log(`✅ Created hpDT stats for: ${childId}`);

    console.log("\n--- CREATION SUCCESSFUL ---");
    console.log(`Teacher ID: ${teacherId}`);
    console.log(`Teacher Pass: ${teacherPassword}`);
    console.log(`Parent ID: ${parentId}`);
    console.log(`Parent Pass: ${parentPassword}`);
    console.log(`Child ID: ${childId}`);
    console.log("---------------------------\n");

  } catch (error) {
    console.error("❌ Error adding data:", error);
  } finally {
    process.exit();
  }
}

addData();
