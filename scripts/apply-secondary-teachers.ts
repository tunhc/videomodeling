import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";

const APPLY = process.argv.includes("--apply");

type Assignment = {
  childName: string;
  parentId: string;
  primaryTeacherId: string;
  secondaryTeacherId: string;
};

// Source: operational table provided by user (April 2026).
const SECONDARY_ASSIGNMENTS: Assignment[] = [
  {
    childName: "Trương Thanh Phong",
    parentId: "PH_KBC-HCM_Phong-G19",
    primaryTeacherId: "GV_KBC_NGAN",
    secondaryTeacherId: "GV_KBC_HOA",
  },
  {
    childName: "Dương Minh Khang",
    parentId: "PH_KBC-HCM_Khang-G20",
    primaryTeacherId: "GV_KBC_NGAN",
    secondaryTeacherId: "GV_KBC_HOA",
  },
  {
    childName: "Trương Thanh Lâm",
    parentId: "PH_KBC-HCM_Lam-G21",
    primaryTeacherId: "GV_KBC_THAO",
    secondaryTeacherId: "GV_KBC_THUY",
  },
  {
    childName: "Thi Phúc Khang",
    parentId: "PH_KBC-HCM_Khang-B19",
    primaryTeacherId: "GV_KBC_QUYNH",
    secondaryTeacherId: "GV_KBC_HUYEN",
  },
  {
    childName: "Lê Minh Khang",
    parentId: "PH_KBC-HCM_Khang-G23",
    primaryTeacherId: "GV_KBC_QUYNH",
    secondaryTeacherId: "GV_KBC_THUY",
  },
  {
    childName: "Lại Thế Anh",
    parentId: "PH_KBC-HCM_Anh-G22",
    primaryTeacherId: "GV_KBC_QUYNH",
    secondaryTeacherId: "GV_KBC_HUYEN",
  },
  {
    childName: "Mai Hoàng Bảo Trân",
    parentId: "PH_KBC-HCM_Tran-G21",
    primaryTeacherId: "GV_KBC_HOANG",
    secondaryTeacherId: "GV_KBC_THAO",
  },
  {
    childName: "Lương Minh Bảo",
    parentId: "PH_KBC-HCM_Bao-G20",
    primaryTeacherId: "GV_KBC_HOA",
    secondaryTeacherId: "GV_KBC_THUY",
  },
  {
    childName: "Phạm Nguyễn Đan Nhi",
    parentId: "PH_KBC-HCM_Dan-G20",
    primaryTeacherId: "GV_KBC_BINH",
    secondaryTeacherId: "GV_KBC_TRANG",
  },
  {
    childName: "Đặng Bình Minh Anh",
    parentId: "PH_KBC-HCM_Anh-G19",
    primaryTeacherId: "GV_KBC_MAIAN",
    secondaryTeacherId: "GV_KBC_BINH",
  },
  {
    childName: "Lê Trung Khang",
    parentId: "PH_KBC-HCM_Khang-G19",
    primaryTeacherId: "GV_KBC_TRANG",
    secondaryTeacherId: "GV_KBC_BINH",
  },
  {
    childName: "Nguyễn Khải Ninh",
    parentId: "PH_KBC-HCM_Ninh-G15",
    primaryTeacherId: "GV_KBC_HUYEN",
    secondaryTeacherId: "GV_KBC_QUYNH",
  },
];

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
  parentId: string
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

  for (const assignment of SECONDARY_ASSIGNMENTS) {
    const docs = await findChildDocsByParentId(db, assignment.parentId);

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
        secondaryTeacherId: assignment.secondaryTeacherId,
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
  console.log(`assignments=${SECONDARY_ASSIGNMENTS.length}`);
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
