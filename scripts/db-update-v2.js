const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

// 1. Initialize Firebase Admin
const keyPath = path.join(process.cwd(), "serviceAccountKey.json");
let serviceAccount;
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

// 2. Data definition
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

const TEACHER_LINK = {
  "Cô Vy": "GV_KBC_VY",
  "Cô Hồng Ngân": "GV_KBC_NGAN",
  "Cô Thảo": "GV_KBC_THAO",
  "Cô Quỳnh": "GV_KBC_QUYNH",
  "Thầy Hoàng": "GV_KBC_HOANG",
  "Cô Nghi": "GV_KBC_NGHI",
  "Cô Hoa": "GV_KBC_HOA",
  "Thầy Khiêm": "GV_KBC_KHIEM",
  "Cô Tuyến": "GV_KBC_TUYEN",
  "Cô Mai An": "GV_KBC_MAIAN",
  "Cô Trang": "GV_KBC_TRANG",
  "Cô Huyền": "GV_KBC_HUYEN",
};

// 3. Utils
function removeAccents(str) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

function getSlug(name) {
  const parts = name.split(" ");
  const lastPart = parts[parts.length - 1];
  return removeAccents(lastPart);
}

// 4. Execution
async function runMigration() {
  console.log("🚀 Starting DB Migration v2...");
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()";

  const allTeacherIds = Object.values(TEACHER_LINK);
  const teacherChildrenMap = {};
  allTeacherIds.forEach(id => (teacherChildrenMap[id] = []));

  const allChildIds = [];

  for (const student of OFFICIAL_STUDENTS) {
    const slugName = getSlug(student.name);
    const yearSuffix = student.dob.substring(2, 4); // 2020 -> 20 -> G20
    const childId = `KBC-HCM_${slugName}-G${yearSuffix}`;
    const parentId = `PH_${childId}`;
    const teacherId = TEACHER_LINK[student.teacher] || "GV_KBC_ADMIN";

    allChildIds.push(childId);
    teacherChildrenMap[teacherId].push(childId);

    console.log(`📝 Processing Child: ${childId} (Teacher: ${teacherId})`);

    // A. Update Children Collection
    await db.collection("children").doc(childId).set({
      name: student.name,
      initial: student.nick || student.name.charAt(0).toUpperCase(),
      nickname: student.nick,
      birthday: student.dob,
      schoolCode: "KBC-HCM",
      teacherId: teacherId,
      parentId: parentId,
      hpdt: 75,
      status: "Bình thường",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    // B. Update HPDT Stats
    await db.collection("hpdt_stats").doc(childId).set({
      overallScore: 75,
      dimensions: {
        communication: 75,
        social: 75,
        behavior: 75,
        sensory: 75,
        sensor: 75
      },
      lastUpdate: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // C. Update User Collection (Parent)
    let randomPassword = "";
    for (let j = 0; j < 8; j++) {
      randomPassword += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    
    await db.collection("users").doc(parentId).set({
      displayName: `Phụ huynh ${student.name}`,
      role: "parent",
      password: randomPassword, // 8 characters random
      childId: childId,
      teacherId: teacherId,
      hpdt: 75,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }

  // D. Update Teacher Users
  for (const tId of allTeacherIds) {
    const childrenCount = teacherChildrenMap[tId].length;
    console.log(`👨‍🏫 Updating Teacher: ${tId} with ${childrenCount} children`);
    
    let randomTeacherPassword = "";
    for (let j = 0; j < 8; j++) {
      randomTeacherPassword += charset.charAt(Math.floor(Math.random() * charset.length));
    }

    await db.collection("users").doc(tId).set({
      displayName: tId.replace("GV_KBC_", "Giáo viên "),
      role: "teacher",
      password: randomTeacherPassword, // Added random password for GV
      childIds: teacherChildrenMap[tId],
      centerCode: "KBC-HCM",
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }

  // E. Create Admin Accounts
  console.log("👮 Creating Admin accounts...");
  
  await db.collection("users").doc("PH_admin").set({
    displayName: "Admin Phụ Huynh",
    role: "admin",
    password: "admin$$$",
    childIds: allChildIds, // All students
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  await db.collection("users").doc("GV_admin").set({
    displayName: "Admin Giáo Viên",
    role: "admin",
    password: "admin$$$",
    childIds: allChildIds, // All students
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  console.log("\n✅ MIGRATION COMPLETED SUCCESSFULLY!");
  process.exit(0);
}

runMigration().catch(err => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
