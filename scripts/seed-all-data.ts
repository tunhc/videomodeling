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

async function seedAllData() {
  console.log("🚀 Seeding ALL FULL DATA for AI4Autism Test Environment...");

  // --- 1. SEED SCHOOL ---
  const schoolId = "KBC-HCM";
  await db.collection("schools").doc(schoolId).set({
    schoolName: "Kim Bình Center",
    centerCode: "KBC-HCM",
    city: "Hồ Chí Minh",
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  console.log("✅ Seeded School: Kim Bình Center");

  // --- 2. SEED TEACHER USER ---
  const teacherId = "GV_DUONG_01";
  await db.collection("users").doc(teacherId).set({
    email: "teacher@ai4autism.com",
    displayName: "Cô Dương",
    role: "teacher",
    schoolId: schoolId,
    schoolName: "Kim Bình Center",
    centerCode: "KBC-HCM",
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  console.log("✅ Seeded Teacher: GV_DUONG_01");

  // --- 3. STUDENTS DATA ---
  const students = [
    { 
      id: "minh-khoi", name: "Minh Khôi", initial: "K", hpdt: 75,
      age: 6, diagnosis: "ASD Level 2", parentId: "PH_KHOI_M01", parentName: "Mẹ Minh Khôi",
      dimensions: { communication: 65, social: 55, behavior: 72, sensory: 80 }
    },
    { 
      id: "hoang-anh", name: "Hoàng Anh", initial: "A", hpdt: 62,
      age: 5, diagnosis: "ASD Level 1", parentId: "PH_ANH_M01", parentName: "Mẹ Hoàng Anh",
      dimensions: { communication: 70, social: 60, behavior: 55, sensory: 65 }
    },
    { 
      id: "ngoc-lan", name: "Ngọc Lan", initial: "N", hpdt: 88,
      age: 7, diagnosis: "Asperger Syndrome", parentId: "PH_LAN_01", parentName: "Bố Ngọc Lan",
      dimensions: { communication: 85, social: 75, behavior: 90, sensory: 88 }
    },
    { 
      id: "manh-hung", name: "Mạnh Hùng", initial: "M", hpdt: 45,
      age: 4, diagnosis: "ASD Level 3", parentId: "PH_HUNG_01", parentName: "Mẹ Mạnh Hùng",
      dimensions: { communication: 40, social: 35, behavior: 50, sensory: 55 }
    },
  ];

  for (const s of students) {
    // A. Seed Student Profile
    await db.collection("children").doc(s.id).set({
      name: s.name,
      initial: s.initial,
      schoolId: schoolId,
      teacherId: teacherId,
      status: "Bình thường",
      hpdt: s.hpdt,
      age: s.age,
      diagnosis: s.diagnosis,
      parentId: s.parentId,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // B. Seed hpDT Stats
    await db.collection("hpdt_stats").doc(s.id).set({
      overallScore: s.hpdt,
      dimensions: s.dimensions,
      lastUpdate: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // C. Seed Parent User Account
    await db.collection("users").doc(s.parentId).set({
      email: `parent_${s.id}@ai4autism.com`,
      displayName: s.parentName,
      role: "parent",
      childId: s.id,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    console.log(`✅ Seeded complete data for student: ${s.name} (Parent: ${s.parentId})`);
  }

  console.log("\n🎉 ALL DATA HAS BEEN SEEDED! The Admin and Teachers will now see complete info.");
  process.exit();
}

seedAllData();
