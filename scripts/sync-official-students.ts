import * as admin from "firebase-admin";
import * as path from "path";
import * as fs from "fs";

let serviceAccount: any;
try {
  const rawFromEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (rawFromEnv && rawFromEnv.trim()) {
    const sanitizedFromEnv = rawFromEnv.replace(/\\([^"\\\/bfnrtu])/g, "$1");
    serviceAccount = JSON.parse(sanitizedFromEnv);
  } else {
    const keyPath = path.join(process.cwd(), "serviceAccountKey.json");
    const rawData = fs.readFileSync(keyPath, "utf8");
    const sanitizedData = rawData.replace(/\\([^"\\\/bfnrtu])/g, "$1");
    serviceAccount = JSON.parse(sanitizedData);
  }
} catch (error) {
  console.error("❌ Failed to load Firebase credentials (FIREBASE_SERVICE_ACCOUNT_JSON or serviceAccountKey.json):", error);
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

const PRIMARY_TEACHER_BY_CHILD: Record<string, string> = {
  "Nguyễn Trường Long": "GV_KBC_VY",
  "Nguyễn Đăng Khôi": "GV_KBC_NGAN",
  "Trương Thanh Phong": "GV_KBC_NGAN",
  "Dương Minh Khang": "GV_KBC_NGAN",
  "Trương Thanh Lâm": "GV_KBC_THAO",
  "Nguyễn Quý Minh Đức": "GV_KBC_QUYNH",
  "Thi Phúc Khang": "GV_KBC_QUYNH",
  "Lê Minh Khang": "GV_KBC_QUYNH",
  "Phạm Quang Thiên": "GV_KBC_QUYNH",
  "Lại Thế Anh": "GV_KBC_QUYNH",
  "Lê Doãn Bảo Long": "GV_KBC_HOANG",
  "Mai Hoàng Bảo Trân": "GV_KBC_HOANG",
  "Nguyễn Tiến Phước": "GV_KBC_NGHI",
  "Lương Minh Bảo": "GV_KBC_HOA",
  "Phan Văn Trọng Nghĩa": "GV_KBC_HOA",
  "Vũ Đạt Phúc An": "GV_KBC_HOA",
  "Nguyễn Hoàng Đăng Khoa": "GV_KBC_KHIEM",
  "Trần Gia Phúc": "GV_KBC_TUYEN",
  "Đặng Bình Minh Anh": "GV_KBC_MAIAN",
  "Lê Trung Khang": "GV_KBC_TRANG",
  "Nguyễn Khải Ninh": "GV_KBC_HUYEN",
};

const SECONDARY_TEACHER_BY_CHILD: Record<string, string> = {
  "Trương Thanh Phong": "GV_KBC_HOA",
  "Dương Minh Khang": "GV_KBC_HOA",
  "Trương Thanh Lâm": "GV_KBC_THUY",
  "Thi Phúc Khang": "GV_KBC_HUYEN",
  "Lê Minh Khang": "GV_KBC_THUY",
  "Lại Thế Anh": "GV_KBC_HUYEN",
  "Mai Hoàng Bảo Trân": "GV_KBC_THAO",
  "Lương Minh Bảo": "GV_KBC_THUY",
  "Phạm Nguyễn Đan Nhi": "GV_KBC_TRANG",
  "Đặng Bình Minh Anh": "GV_KBC_BINH",
  "Lê Trung Khang": "GV_KBC_BINH",
  "Nguyễn Khải Ninh": "GV_KBC_QUYNH",
};

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function mergeIds(values: Array<string | undefined>) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!value) continue;
    const normalized = value.trim();
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

async function syncOfficialStudents() {
  console.log("🚀 Syncing 21 official students with Database...");
  
  const snap = await db.collection("children")
    .where("schoolCode", "==", "KBC-HCM")
    .get();
    
  const existingDocs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const existingByName = new Map<string, any>();
  for (const doc of existingDocs) {
    if (typeof doc.name === "string" && doc.name.trim()) {
      existingByName.set(normalizeName(doc.name), doc);
    }
  }
  console.log(`📊 Found ${existingDocs.length} existing students in DB.`);

  for (let i = 0; i < OFFICIAL_STUDENTS.length; i++) {
    const student = OFFICIAL_STUDENTS[i];
    const existing = existingByName.get(normalizeName(student.name));
    
    // Determine ID: reuse same child by name to avoid index mismatch corruption.
    let docId: string;
    if (existing?.id) {
      docId = existing.id;
      console.log(`♻️  Updating Record ${i+1}/${OFFICIAL_STUDENTS.length}: ${docId}`);
    } else {
      const firstName = student.name.split(" ").pop() || student.name;
      docId = `KBC-HCM_${firstName}_${i+1}`;
      console.log(`✨ Creating New Record ${i+1}/${OFFICIAL_STUDENTS.length}: ${docId}`);
    }

    const initial = student.nick || student.name.charAt(0).toUpperCase();
    const parentId = typeof existing?.parentId === "string" ? existing.parentId : `PH_${docId}`;
    const primaryTeacherId = PRIMARY_TEACHER_BY_CHILD[student.name] || "GV_DUONG_01";
    const secondaryTeacherId = SECONDARY_TEACHER_BY_CHILD[student.name];
    const teacherIds = mergeIds([
      primaryTeacherId,
      secondaryTeacherId,
      typeof existing?.teacherId === "string" ? existing.teacherId : undefined,
      ...(Array.isArray(existing?.teacherIds)
        ? existing.teacherIds.filter((id: unknown) => typeof id === "string")
        : []),
    ]);

    try {
      // 1. Update/Set Child Doc
      await db.collection("children").doc(docId).set({
        name: student.name,
        initial: initial,
        schoolCode: "KBC-HCM",
        teacherId: primaryTeacherId,
        secondaryTeacherId: secondaryTeacherId || admin.firestore.FieldValue.delete(),
        teacherIds: teacherIds,
        status: "Bình thường",
        hpdt: 75,
        birthday: student.dob,
        nickname: student.nick,
        teacherNote: student.teacher,
        parentId: parentId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      // 2. User account for parent
      await db.collection("users").doc(parentId).set({
        displayName: `Phụ huynh ${student.name}`,
        role: "parent",
        childId: docId,
        teacherId: primaryTeacherId,
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
