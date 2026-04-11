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

async function seedSchool() {
  console.log("🏫 Seeding schools collection...");

  const schoolId = "KBC-HCM";

  // 1. School document
  await db.collection("schools").doc(schoolId).set({
    schoolName: "Kim Bình Center",
    centerCode: "KBC-HCM",
    city: "Hồ Chí Minh",
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  console.log("✅ Created school: Kim Bình Center (KBC-HCM)");

  // 2. Update teacher profile to link to school
  await db.collection("users").doc("GV_DUONG_01").update({
    schoolId: "KBC-HCM",
    schoolName: "Kim Bình Center",
    centerCode: "KBC-HCM"
  });
  console.log("✅ Linked teacher GV_DUONG_01 to KBC-HCM");

  // 3. Seed all 4 students with link to this school and teacher
  const students = [
    { id: "minh-khoi",   name: "Minh Khôi",  initial: "K", hpdt: 75 },
    { id: "hoang-anh",   name: "Hoàng Anh",  initial: "A", hpdt: 62 },
    { id: "ngoc-lan",    name: "Ngọc Lan",   initial: "N", hpdt: 88 },
    { id: "manh-hung",   name: "Mạnh Hùng",  initial: "M", hpdt: 45 },
  ];

  for (const s of students) {
    await db.collection("children").doc(s.id).set({
      name: s.name,
      initial: s.initial,
      schoolId: "KBC-HCM",
      teacherId: "GV_DUONG_01",
      status: "Bình thường",
      hpdt: s.hpdt,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    console.log(`  ↳ Student: ${s.name}`);
  }
  console.log("✅ Seeded 4 students linked to KBC-HCM");

  console.log("\n🎉 School schema ready! Go check Firestore Console.");
  process.exit();
}

seedSchool();
