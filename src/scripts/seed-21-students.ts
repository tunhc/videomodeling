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

// Helper to generate a random number within a range
const getRandom = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

const FIRST_NAMES = ["Khôi", "Anh", "Lan", "Hùng", "Hải", "Phong", "Trang", "Linh", "Minh", "Khang", "Tâm", "Bảo", "Chi", "Nhi", "Huy", "Nam", "Việt", "Vy", "Ngọc", "Vy", "Khang", "Long"];
const LAST_NAMES = ["Minh", "Hoàng", "Ngọc", "Mạnh", "Thanh", "Nhật", "Thùy", "Gia", "Bảo", "Đức", "Mai", "Trần", "Lê", "Phạm", "Vũ", "Đinh"];

function generateFakeStudent(index: number) {
  const first = FIRST_NAMES[index % FIRST_NAMES.length];
  const last = LAST_NAMES[index % LAST_NAMES.length];
  const name = `${last} ${first}`;
  
  const idStr = `${first.charAt(0)}${last.charAt(0)}-${getRandom(100, 999)}`;
  const parentId = `PH_${idStr}`;
  const hpdt = getRandom(40, 95);
  const diagnoses = ["ASD Level 1", "ASD Level 2", "ASD Level 3", "Asperger Syndrome", "Khó khăn phát triển"];
  
  return {
    id: idStr.toLowerCase().replace(/[^a-z0-9-]/g, ''),
    name,
    initial: first.charAt(0).toUpperCase(),
    hpdt,
    age: getRandom(3, 8),
    diagnosis: diagnoses[index % diagnoses.length],
    parentId,
    parentName: `Phụ huynh của ${first}`,
    dimensions: {
      communication: getRandom(20, 95),
      social: getRandom(20, 95),
      behavior: getRandom(20, 95),
      sensory: getRandom(20, 95)
    }
  };
}

async function seedClass21() {
  console.log("🚀 Generating 21 complete student profiles...");
  
  const schoolId = "KBC-HCM";
  const teacherId = "GV_DUONG_01";
  
  // Clean up if we want, or just overwrite.
  let seedCount = 0;

  for (let i = 1; i <= 21; i++) {
    const s = generateFakeStudent(i);
    
    // Some hardcoded guaranteed test accounts out of the 21
    if (i === 1) {
      s.id = "minh-khoi";
      s.name = "Minh Khôi";
      s.initial = "K";
      s.parentId = "PH_KHOI_M01";
      s.parentName = "Mẹ Minh Khôi";
      s.diagnosis = "ASD Level 2";
      s.hpdt = 75;
    }

    try {
      // 1. Student Document
      await db.collection("students").doc(s.id).set({
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

      // 2. hpDT stats
      await db.collection("hpdt_stats").doc(s.id).set({
        overallScore: s.hpdt,
        dimensions: s.dimensions,
        lastUpdate: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      // 3. User account
      await db.collection("users").doc(s.parentId).set({
        email: `parent_${s.id}@ai4autism.com`,
        displayName: s.parentName,
        role: "parent",
        childId: s.id,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      process.stdout.write("✅ ");
      seedCount++;
    } catch (err) {
      console.error(`\n❌ Error seeding ${s.name}:`, err);
    }
  }

  console.log(`\n🎉 Success! Added ${seedCount}/21 students under teacher GV_DUONG_01.`);
  process.exit();
}

seedClass21();
