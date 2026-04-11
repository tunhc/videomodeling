import * as admin from "firebase-admin";
import * as path from "path";
import * as fs from "fs";

// 1. Initialize Firebase Admin
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
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function createTestUsers() {
  console.log("👥 Initializing AI4Autism Mock-Real Profiles...");

  const users = [
    {
      uid: "GV_DUONG_01",
      email: "teacher@ai4autism.com",
      displayName: "Cô Dương",
      role: "teacher"
    },
    {
      uid: "PH_KHOI_M01",
      email: "parent@ai4autism.com",
      displayName: "Mẹ Minh Khôi",
      role: "parent",
      childId: "minh-khoi"
    }
  ];

  for (const user of users) {
    try {
      // Create in Firestore 'users' collection 
      // This allows the app logic to work even if Auth is bypassed locally
      await db.collection("users").doc(user.uid).set({
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        ...(user.childId && { childId: user.childId }),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`✅ Profile Ready: ${user.uid} (${user.role})`);
    } catch (error: any) {
      console.error(`❌ Failed to create profile for ${user.uid}:`, error.message);
    }
  }

  console.log("\n🎉 Test profiles initialized! Use these IDs at /login to test the flow.");
  process.exit();
}

createTestUsers();
