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
  const childId = "KBC-HCM_Hung-B20";
  const parentId = "PH_KBC-HCM_Hung-B20";
  const teacherId = "GV_KBC_QUYNH";
  const secondaryTeacherId = "GV_KBC_THAO";

  const parentPassword = generatePassword();

  console.log("🚀 Adding new child and parent data to Firestore...");

  try {
    // 1. Create Child Record
    await db.collection("children").doc(childId).set({
      name: "Đặng Phúc Hưng",
      initial: "Hưng",
      nickname: "Hưng",
      schoolCode: "KBC-HCM", // Inferred from ID
      centerCode: "KBC-HCM",
      teacherId: teacherId,
      status: "Bình thường",
      birthday: "2020-09-28",
      parentId: parentId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    console.log(`✅ Created/Updated Child: ${childId}`);

    // 2. Create Parent User Record
    await db.collection("users").doc(parentId).set({
      displayName: "Phụ huynh Đặng Phúc Hưng",
      role: "parent",
      childId: childId,
      teacherId: teacherId,
      password: parentPassword,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    console.log(`✅ Created/Updated Parent: ${parentId}`);

    // 3. Update Teachers
    const teachersToUpdate = [teacherId, secondaryTeacherId];
    for (const tid of teachersToUpdate) {
      await db.collection("users").doc(tid).update({
        childIds: admin.firestore.FieldValue.arrayUnion(childId),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`✅ Updated Teacher ${tid}: Added ${childId} to childIds`);
    }

    console.log("\n--- CREATION SUCCESSFUL ---");
    console.log(`Child ID: ${childId}`);
    console.log(`Parent ID: ${parentId}`);
    console.log(`Parent Pass: ${parentPassword}`);
    console.log(`Primary Teacher: ${teacherId}`);
    console.log(`Secondary Teacher: ${secondaryTeacherId}`);
    console.log("---------------------------\n");

  } catch (error) {
    console.error("❌ Error adding data:", error);
  } finally {
    process.exit();
  }
}

addData();
