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

function normalizeTeacherId(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function canonicalTeacherId(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
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

  return mergeTeacherIds(collected);
}

export function isTeacherAssigned(data: Record<string, unknown>, teacherId: string) {
  const expected = canonicalTeacherId(teacherId);
  if (!expected) return false;

  return extractTeacherIds(data).some((assignedId) => canonicalTeacherId(assignedId) === expected);
}
