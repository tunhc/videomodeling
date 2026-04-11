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

const OFFICIAL_STUDENTS = [
  { name: "Nguyễn Trường Long", dob: "2020-01-19", nick: "", teacher: "Cô Vy" },
  { name: "Nguyễn Đăng Khôi", dob: "2018-12-26", nick: "", teacher: "Cô Hồng Ngân" },
  { name: "Trương Thanh Phong", dob: "2019-02-13", nick: "", teacher: "Cô Hồng Ngân" },
  { name: "Dương Minh Khang", dob: "2020-01-26", nick: "Rô", teacher: "Cô Hồng Ngân" },
  { name: "Trương Thanh Lâm", dob: "2021-08-16", nick: "", teacher: "Cô Thảo" },
  { name: "Nguyễn Quý Minh Đức", dob: "2021-01-07", nick: "", teacher: "Cô Quỳnh" },
  { name: "Thi Phúc Khang", dob: "2019-01-26", nick: "Đô la", teacher: "Cô Quỳnh" },
  { name: "Lê Minh Khang", dob: "2023-10-08", nick: "Toro", teacher: "Cô Quỳnh" },
  { name: "Phạm Quang Thiên", dob: "2024-02-11", nick: "", teacher: "Cô Quỳnh" },
  { name: "Lại Thế Anh", dob: "2022-02-07", nick: "Bo (KLC)", teacher: "Cô Quỳnh" },
  { name: "Lê Doãn Bảo Long", dob: "2024-03-18", nick: "Võ Tòng", teacher: "Thầy Hoàng" },
  { name: "Mai Hoàng Bảo Trân", dob: "2021-01-26", nick: "Sữa", teacher: "Thầy Hoàng" },
  { name: "Nguyễn Tiến Phước", dob: "2019-09-13", nick: "", teacher: "Cô Nghi" },
  { name: "Lương Minh Bảo", dob: "2020-03-25", nick: "Bòn Bon", teacher: "Cô Hoa" },
  { name: "Phan Văn Trọng Nghĩa", dob: "2024-03-30", nick: "Gà", teacher: "Cô Hoa" },
  { name: "Vũ Đạt Phúc An", dob: "2017-06-08", nick: "", teacher: "Cô Hoa" },
  { name: "Nguyễn Hoàng Đăng Khoa", dob: "2019-04-27", nick: "Lucas", teacher: "Thầy Khiêm" },
  { name: "Trần Gia Phúc", dob: "2019-12-05", nick: "Bo (TT)", teacher: "Cô Tuyến" },
  { name: "Đặng Bình Minh Anh", dob: "2019-04-08", nick: "Kem", teacher: "Cô Mai An" },
  { name: "Lê Trung Khang", dob: "2019-12-26", nick: "", teacher: "Cô Trang" },
  { name: "Nguyễn Khải Ninh", dob: "2015-03-12", nick: "Bon", teacher: "Cô Huyền" },
];

async function syncOfficialStudents() {
  console.log("🚀 Syncing 21 official students with Database...");
  
  const snap = await db.collection("children")
    .where("schoolCode", "==", "KBC-HCM")
    .get();
    
  const existingDocs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  console.log(`📊 Found ${existingDocs.length} existing students in DB.`);

  for (let i = 0; i < OFFICIAL_STUDENTS.length; i++) {
    const student = OFFICIAL_STUDENTS[i];
    
    // Determine ID: Reuse existing if available, else create new
    let docId: string;
    if (i < existingDocs.length) {
      docId = existingDocs[i].id;
      console.log(`♻️  Updating Record ${i+1}/${OFFICIAL_STUDENTS.length}: ${docId}`);
    } else {
      const firstName = student.name.split(" ").pop() || student.name;
      docId = `KBC-HCM_${firstName}_${i+1}`;
      console.log(`✨ Creating New Record ${i+1}/${OFFICIAL_STUDENTS.length}: ${docId}`);
    }

    const initial = student.nick || student.name.charAt(0).toUpperCase();

    try {
      // 1. Update/Set Child Doc
      await db.collection("children").doc(docId).set({
        name: student.name,
        initial: initial,
        schoolCode: "KBC-HCM",
        teacherId: "GV_DUONG_01", // Default for now, can be mapped to Cô Vy, etc later
        status: "Bình thường",
        hpdt: 75,
        birthday: student.dob,
        nickname: student.nick,
        teacherNote: student.teacher,
        parentId: `PH_${docId}`,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      // 2. User account for parent
      await db.collection("users").doc(`PH_${docId}`).set({
        displayName: `Phụ huynh ${student.name}`,
        role: "parent",
        childId: docId,
        hpdt: 75,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      process.stdout.write("✅ ");
    } catch (err) {
      console.error(`\n❌ Error syncing ${student.name}:`, err);
    }
  }

  console.log("\n🎉 ALL STUDENTS SYNCED SUCCESSFULLY!");
  process.exit();
}

syncOfficialStudents();
