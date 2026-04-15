import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";

const APPLY = process.argv.includes("--apply");

type Assignment = {
  childName: string;
  parentId: string;
  primaryTeacherId: string;
  secondaryTeacherId?: string;
};

// Source: operational table provided by user (April 2026).
// Columns: name | dob | nickname | teacherName | parentId | primaryTeacherId | secondaryTeacherId(optional)
const OFFICIAL_ASSIGNMENTS_TSV = `
Nguyễn Trường Long	19/01/2020	(blank)	Cô Vy	PH_KBC-HCM_Long-G20	GV_KBC_VY	
Nguyễn Đăng Khôi	26/12/2018	(blank)	Cô Hồng Ngân	PH_KBC-HCM_Khoi-G18	GV_KBC_NGAN	
Trương Thanh Phong	13/02/2019	(blank)	Cô Hồng Ngân	PH_KBC-HCM_Phong-G19	GV_KBC_NGAN	GV_KBC_HOA
Dương Minh Khang	26/01/2020	Rô	Cô Hồng Ngân	PH_KBC-HCM_Khang-G20	GV_KBC_NGAN	GV_KBC_HOA
Trương Thanh Lâm	16/08/2021	(blank)	Cô Thảo	PH_KBC-HCM_Lam-G21	GV_KBC_THAO	GV_KBC_THUY
Nguyễn Quý Minh Đức	7/1/2021	(blank)	Cô Quỳnh	PH_KBC-HCM_Duc-G21	GV_KBC_QUYNH	
Thi Phúc Khang	26/01/2019	Đô la	Cô Quỳnh	PH_KBC-HCM_Khang-B19	GV_KBC_QUYNH	GV_KBC_HUYEN
Lê Minh Khang	8/10/2023	Toro	Cô Quỳnh	PH_KBC-HCM_Khang-G23	GV_KBC_QUYNH	GV_KBC_THUY
Phạm Quang Thiên	11/2/2024	(blank)	Cô Quỳnh	PH_KBC-HCM_Thien-G24	GV_KBC_QUYNH	
Lại Thế Anh	7/2/2022	Bo (KLC)	Cô Quỳnh	PH_KBC-HCM_Anh-G22	GV_KBC_QUYNH	GV_KBC_HUYEN
Lê Doãn Bảo Long	18/03/2024	Võ Tòng	Thầy Hoàng	PH_KBC-HCM_Long-G24	GV_KBC_HOANG	
Mai Hoàng Bảo Trân	26/01/2021	Sữa	Thầy Hoàng	PH_KBC-HCM_Tran-G21	GV_KBC_HOANG	GV_KBC_THAO
Nguyễn Tiến Phước	13/09/2019	(blank)	Cô Nghi	PH_KBC-HCM_Phuoc-G19	GV_KBC_NGHI	
Lương Minh Bảo	25/03/2020	Bòn Bon	Cô Hoa	PH_KBC-HCM_Bao-G20	GV_KBC_HOA	GV_KBC_THUY
Phan Văn Trọng Nghĩa	30/03/2024	Gà	Cô Hoa	PH_KBC-HCM_Nghia-G24	GV_KBC_HOA	
Vũ Đạt Phúc An	8/6/2017	(blank)	Cô Hoa	PH_KBC-HCM_An-G17	GV_KBC_HOA	
Nguyễn Hoàng Đăng Khoa	27/04/2019	Lucas	Thầy Khiêm	PH_KBC-HCM_Khoa-G19	GV_KBC_KHIEM	
Phạm Nguyễn Đan Nhi	14/10/2020	Bối	Cô Bình	PH_KBC-HCM_Dan-G20	GV_KBC_BINH	GV_KBC_TRANG
Trần Gia Phúc	5/12/2019	Bo (TT)	Cô Tuyến	PH_KBC-HCM_Phuc-G19	GV_KBC_TUYEN	
Đặng Bình Minh Anh	8/4/2019	Kem	Cô Mai An	PH_KBC-HCM_Anh-G19	GV_KBC_MAIAN	GV_KBC_BINH
Lê Trung Khang	26/12/2019	(blank)	Cô Trang	PH_KBC-HCM_Khang-G19	GV_KBC_TRANG	GV_KBC_BINH
Nguyễn Khải Ninh	12/3/2015	Bon	Cô Huyền	PH_KBC-HCM_Ninh-G15	GV_KBC_HUYEN	GV_KBC_QUYNH
`;

function normalizeTeacherId(raw: string | undefined) {
  if (!raw) return undefined;
  const normalized = raw
    .trim()
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .toUpperCase();
  return normalized || undefined;
}

function parseAssignmentsFromTable(rawTable: string): Assignment[] {
  const rows = rawTable
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const assignments: Assignment[] = [];

  for (const row of rows) {
    const cols = row.includes("\t")
      ? row.split("\t")
      : row.split(/\s{2,}/);

    if (cols.length < 6) {
      console.warn(`SKIP malformed row: ${row}`);
      continue;
    }

    const childName = (cols[0] || "").trim();
    const parentId = (cols[4] || "").trim();
    const normalizedPrimaryTeacherId = normalizeTeacherId(cols[5]);
    const normalizedSecondaryTeacherId = normalizeTeacherId(cols[6]);

    const primaryTeacherId = normalizedPrimaryTeacherId?.startsWith("GV_")
      ? normalizedPrimaryTeacherId
      : undefined;

    const secondaryTeacherId = normalizedSecondaryTeacherId?.startsWith("GV_")
      ? normalizedSecondaryTeacherId
      : undefined;

    if (!childName || !parentId || !primaryTeacherId) {
      console.warn(`SKIP missing required fields: ${row}`);
      continue;
    }

    assignments.push({
      childName,
      parentId,
      primaryTeacherId,
      secondaryTeacherId,
    });
  }

  return assignments;
}

const OFFICIAL_ASSIGNMENTS = parseAssignmentsFromTable(OFFICIAL_ASSIGNMENTS_TSV);

function mergeIds(values: Array<string | undefined>) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (!value || typeof value !== "string") continue;
    const normalized = value.trim();
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

function loadServiceAccount() {
  const rawFromEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (rawFromEnv && rawFromEnv.trim()) {
    const sanitized = rawFromEnv.replace(/\\([^"\\\/bfnrtu])/g, "$1");
    return JSON.parse(sanitized);
  }

  const keyPath = path.join(process.cwd(), "serviceAccountKey.json");
  const rawData = fs.readFileSync(keyPath, "utf8");
  const sanitizedData = rawData.replace(/\\([^"\\\/bfnrtu])/g, "$1");
  return JSON.parse(sanitizedData);
}

async function findChildDocsByParentId(
  db: admin.firestore.Firestore,
  parentId: string,
  childName?: string
) {
  const collections = ["children", "students"] as const;
  const results: Array<{ collection: "children" | "students"; ref: admin.firestore.DocumentReference; data: admin.firestore.DocumentData }> = [];

  for (const col of collections) {
    const snap = await db.collection(col).where("parentId", "==", parentId).get();
    for (const docSnap of snap.docs) {
      results.push({ collection: col, ref: docSnap.ref, data: docSnap.data() });
    }
  }

  if (results.length > 0) return results;

  const fallbackId = parentId.startsWith("PH_") ? parentId.replace("PH_", "") : parentId;
  for (const col of collections) {
    const direct = await db.collection(col).doc(fallbackId).get();
    if (direct.exists) {
      results.push({ collection: col, ref: direct.ref, data: direct.data() || {} });
    }
  }

  if (results.length > 0) return results;

  if (childName && childName.trim()) {
    for (const col of collections) {
      const byNameSnap = await db.collection(col).where("name", "==", childName).get();
      for (const docSnap of byNameSnap.docs) {
        results.push({ collection: col, ref: docSnap.ref, data: docSnap.data() });
      }
    }
  }

  return results;
}

async function run() {
  console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"}`);

  let serviceAccount: any;
  try {
    serviceAccount = loadServiceAccount();
  } catch (error) {
    console.error("ERROR: cannot load Firebase service account. Provide FIREBASE_SERVICE_ACCOUNT_JSON or serviceAccountKey.json", error);
    process.exit(1);
  }

  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }

  const db = admin.firestore();

  let found = 0;
  let updated = 0;
  let missing = 0;

  for (const assignment of OFFICIAL_ASSIGNMENTS) {
    const docs = await findChildDocsByParentId(db, assignment.parentId, assignment.childName);

    if (docs.length === 0) {
      missing += 1;
      console.log(`MISSING: ${assignment.childName} | parentId=${assignment.parentId}`);
      continue;
    }

    found += docs.length;

    for (const target of docs) {
      const existing = target.data || {};
      const currentTeacherIds = Array.isArray(existing.teacherIds)
        ? existing.teacherIds.filter((id: unknown) => typeof id === "string")
        : [];

      const mergedTeacherIds = mergeIds([
        ...currentTeacherIds,
        typeof existing.teacherId === "string" ? existing.teacherId : undefined,
        typeof existing.secondaryTeacherId === "string" ? existing.secondaryTeacherId : undefined,
        assignment.primaryTeacherId,
        assignment.secondaryTeacherId,
      ]);

      const payload = {
        teacherId: assignment.primaryTeacherId,
        secondaryTeacherId: assignment.secondaryTeacherId || admin.firestore.FieldValue.delete(),
        teacherIds: mergedTeacherIds,
        secondaryTeacherIds: mergeIds([
          ...(Array.isArray(existing.secondaryTeacherIds)
            ? existing.secondaryTeacherIds.filter((id: unknown) => typeof id === "string")
            : []),
          assignment.secondaryTeacherId,
        ]),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (APPLY) {
        await target.ref.set(payload, { merge: true });
        updated += 1;
      }

      console.log(
        `${APPLY ? "UPDATED" : "PLAN"}: ${target.collection}/${target.ref.id} | child=${assignment.childName} | teacherIds=${JSON.stringify(payload.teacherIds)}`
      );
    }
  }

  console.log("--- SUMMARY ---");
  console.log(`assignments=${OFFICIAL_ASSIGNMENTS.length}`);
  console.log(`docsFound=${found}`);
  console.log(`docsUpdated=${updated}`);
  console.log(`missingAssignments=${missing}`);
  console.log(`result=${APPLY ? "changes applied" : "dry-run only"}`);
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("FATAL:", error);
    process.exit(1);
  });
