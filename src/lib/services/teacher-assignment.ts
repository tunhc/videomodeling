const SINGLE_TEACHER_FIELDS = [
  "teacherId",
  "secondaryTeacherId",
  "coTeacherId",
  "assistantTeacherId",
  "supportTeacherId",
] as const;

const ARRAY_TEACHER_FIELDS = [
  "teacherIds",
  "secondaryTeacherIds",
  "coTeacherIds",
  "assistantTeacherIds",
  "supportTeacherIds",
] as const;

type OfficialAssignment = {
  childName: string;
  parentId: string;
  primaryTeacherId: string;
  secondaryTeacherId?: string;
};

// Operational fallback table: used when Firestore records are still missing
// secondary-teacher fields during phased migration.
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

function normalizeOfficialTeacherId(raw: string | undefined) {
  if (!raw) return undefined;
  const normalized = raw
    .trim()
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .toUpperCase();
  return normalized || undefined;
}

function parseOfficialAssignments(rawTable: string): OfficialAssignment[] {
  const rows = rawTable
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const assignments: OfficialAssignment[] = [];

  for (const row of rows) {
    const cols = row.includes("\t")
      ? row.split("\t")
      : row.split(/\s{2,}/);

    if (cols.length < 6) continue;

    const childName = (cols[0] || "").trim();
    const parentId = (cols[4] || "").trim();
    const normalizedPrimaryTeacherId = normalizeOfficialTeacherId(cols[5]);
    const normalizedSecondaryTeacherId = normalizeOfficialTeacherId(cols[6]);

    const primaryTeacherId = normalizedPrimaryTeacherId?.startsWith("GV_")
      ? normalizedPrimaryTeacherId
      : undefined;

    const secondaryTeacherId = normalizedSecondaryTeacherId?.startsWith("GV_")
      ? normalizedSecondaryTeacherId
      : undefined;

    if (!childName || !parentId || !primaryTeacherId) continue;

    assignments.push({
      childName,
      parentId,
      primaryTeacherId,
      secondaryTeacherId,
    });
  }

  return assignments;
}

function normalizeTeacherId(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function canonicalTeacherId(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function addToMapWithMerge(target: Map<string, string[]>, key: string, values: string[]) {
  if (!key || values.length === 0) return;
  const current = target.get(key) || [];
  target.set(key, mergeTeacherIds(current, values));
}

function buildCanonicalAliases(value: string) {
  const canonical = canonicalTeacherId(value);
  if (!canonical) return [];

  const aliases = new Set<string>([canonical]);
  const withoutTrailingDigits = canonical.replace(/_?\d+$/g, "").replace(/_+$/g, "");
  if (withoutTrailingDigits && withoutTrailingDigits !== canonical) {
    aliases.add(withoutTrailingDigits);
  }

  return Array.from(aliases);
}

function extractTeacherIdFromUnknown(value: unknown): string[] {
  if (typeof value === "string") {
    const normalized = normalizeTeacherId(value);
    return normalized ? [normalized] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => extractTeacherIdFromUnknown(item));
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return [
      ...extractTeacherIdFromUnknown(record.id),
      ...extractTeacherIdFromUnknown(record.teacherId),
      ...extractTeacherIdFromUnknown(record.userId),
    ];
  }

  return [];
}

const OFFICIAL_ASSIGNMENTS = parseOfficialAssignments(OFFICIAL_ASSIGNMENTS_TSV);
const OFFICIAL_TEACHERS_BY_PARENT_ID = new Map<string, string[]>();
const OFFICIAL_TEACHERS_BY_CHILD_NAME = new Map<string, string[]>();

for (const assignment of OFFICIAL_ASSIGNMENTS) {
  const teacherIds = mergeTeacherIds(
    [assignment.primaryTeacherId],
    assignment.secondaryTeacherId ? [assignment.secondaryTeacherId] : undefined
  );

  addToMapWithMerge(
    OFFICIAL_TEACHERS_BY_PARENT_ID,
    canonicalTeacherId(assignment.parentId),
    teacherIds
  );

  addToMapWithMerge(
    OFFICIAL_TEACHERS_BY_CHILD_NAME,
    canonicalTeacherId(assignment.childName),
    teacherIds
  );
}

function extractOfficialTeacherIds(data: Record<string, unknown>) {
  const parentId = typeof data.parentId === "string" ? data.parentId : "";
  const childName = typeof data.name === "string" ? data.name : "";

  const idsByParentId = parentId
    ? OFFICIAL_TEACHERS_BY_PARENT_ID.get(canonicalTeacherId(parentId)) || []
    : [];

  const idsByChildName = childName
    ? OFFICIAL_TEACHERS_BY_CHILD_NAME.get(canonicalTeacherId(childName)) || []
    : [];

  return mergeTeacherIds(idsByParentId, idsByChildName);
}

export function mergeTeacherIds(...sources: Array<Array<string> | undefined | null>) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const source of sources) {
    if (!source) continue;
    for (const item of source) {
      const normalized = normalizeTeacherId(item);
      if (!normalized) continue;
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      result.push(normalized);
    }
  }

  return result;
}

export function extractTeacherIds(data: Record<string, unknown>) {
  const collected: string[] = [];

  for (const field of SINGLE_TEACHER_FIELDS) {
    collected.push(...extractTeacherIdFromUnknown(data[field]));
  }

  for (const field of ARRAY_TEACHER_FIELDS) {
    collected.push(...extractTeacherIdFromUnknown(data[field]));
  }

  // Optional generic fallback for datasets that store teacher entries in `teachers`.
  collected.push(...extractTeacherIdFromUnknown(data.teachers));

  // Defensive parser for operational datasets that may use ad-hoc teacher columns
  // such as GV / GV2 / teacher_2 / secondaryTeacher.
  for (const [key, value] of Object.entries(data)) {
    const normalizedKey = key.trim().toLowerCase();
    const likelyTeacherKey =
      normalizedKey === "gv" ||
      /^gv\d+$/.test(normalizedKey) ||
      normalizedKey.includes("teacher");

    if (!likelyTeacherKey) continue;
    collected.push(...extractTeacherIdFromUnknown(value));
  }

  return mergeTeacherIds(collected, extractOfficialTeacherIds(data));
}

export function isTeacherAssigned(data: Record<string, unknown>, teacherId: string) {
  const expectedAliases = new Set(buildCanonicalAliases(teacherId));
  if (expectedAliases.size === 0) return false;

  return extractTeacherIds(data).some((assignedId) => {
    const assignedAliases = buildCanonicalAliases(assignedId);
    return assignedAliases.some((alias) => expectedAliases.has(alias));
  });
}
