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

// Names for 21 students
const STUDENTS_NAMES = [
  "Long", "Khoa", "Minh Khôi", "Hải", "Tuấn", "Nam", "Hoàng", "Việt", 
  "Mạnh", "Phúc", "Bảo", "Đức", "Trí",
  // Girls
  "Lan", "Ngọc", "Mai", "Trang", "Nhi", "Hương", "Chi", "Linh"
];

const GENDERS = [
  "B", "B", "B", "B", "B", "B", "B", "B", "B", "B", "B", "B", "B", 
  "G", "G", "G", "G", "G", "G", "G", "G"
];

function generateFakeChild(index: number) {
  const name = STUDENTS_NAMES[index % STUDENTS_NAMES.length];
  const firstName = name.split(" ").pop() || name; // Get last word of name
  const gender = GENDERS[index % GENDERS.length];
  const numberStr = (index + 1).toString().padStart(2, '0'); // 01, 02...
  
  const childId = `KBC-HCM_${firstName}_${gender}${numberStr}`;
  const parentId = `PH_${childId}`;
  
  const birthYear = 2026 - (Math.floor(Math.random() * 4) + 4); // Random age between 4 and 7 in 2026
  
  return {
    id: childId,
    name,
    initial: "B",
    status: "Bình thường",
    hpdt: 50,
    birthday: `${birthYear}-01-01`,
    age: 2026 - birthYear, // Calculate age
    diagnosis: "ASD Level 1",
    schoolCode: "KBC-HCM",
    teacherId: "GV_DUONG_01",
    parentId,
    parentName: `Phụ huynh của ${firstName}`,
    dimensions: {
      communication: 50,
      social: 50,
      behavior: 50,
      sensory: 50
    }
  };
}

async function seedClass21Children() {
  console.log("🚀 Generating 21 complete child profiles in 'children' collection...");
  
  // 1. Update Teacher
  await db.collection("users").doc("GV_DUONG_01").update({
    centerCode: "KBC-HCM"
  });
  console.log("✅ Updated teacher GV_DUONG_01 centerCode: KBC-HCM");
  
  let seedCount = 0;

  for (let i = 0; i < 21; i++) {
    const s = generateFakeChild(i);

    try {
      // 2. Child Document (`children` collection)
      await db.collection("children").doc(s.id).set({
        name: s.name,
        initial: s.initial,
        schoolCode: s.schoolCode,
        teacherId: s.teacherId,
        status: s.status,
        hpdt: s.hpdt,
        birthday: s.birthday,
        age: s.age,
        diagnosis: s.diagnosis,
        parentId: s.parentId,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      // 3. hpDT stats
      await db.collection("hpdt_stats").doc(s.id).set({
        overallScore: s.hpdt,
        dimensions: s.dimensions,
        lastUpdate: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      // 4. User account for parent
      await db.collection("users").doc(s.parentId).set({
        email: `parent_${s.id.toLowerCase()}@ai4autism.com`,
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

  console.log(`\n🎉 Success! Added ${seedCount}/21 children under 'children' collection.`);
  process.exit();
}

seedClass21Children();
