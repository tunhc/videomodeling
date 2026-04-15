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
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function buildCanonicalAliases(value: string) {
  const canonical = canonicalTeacherId(value);
  if (!canonical) return [];

  const aliases = new Set<string>([canonical]);
  const withoutTrailingDigits = canonical.replace(/(\D)\d+$/g, "$1");
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

  return mergeTeacherIds(collected);
}

export function isTeacherAssigned(data: Record<string, unknown>, teacherId: string) {
  const expectedAliases = new Set(buildCanonicalAliases(teacherId));
  if (expectedAliases.size === 0) return false;

  return extractTeacherIds(data).some((assignedId) => {
    const assignedAliases = buildCanonicalAliases(assignedId);
    return assignedAliases.some((alias) => expectedAliases.has(alias));
  });
}
