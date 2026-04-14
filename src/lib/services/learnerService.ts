import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

type LearnerSource = "children" | "students";

export interface LearnerRecord {
  id: string;
  name: string;
  initial: string;
  status: string;
  hpdt: number;
  parentId?: string;
  teacherId?: string;
  schoolCode?: string;
  source: LearnerSource;
  [key: string]: unknown;
}

function normalizeLearner(source: LearnerSource, id: string, data: Record<string, unknown>): LearnerRecord {
  const name = typeof data.name === "string" && data.name.trim() ? data.name : "Học sinh không tên";
  const initialFromData = typeof data.initial === "string" && data.initial.trim() ? data.initial : "";

  return {
    id,
    name,
    initial: initialFromData || name.charAt(0) || "?",
    status: typeof data.status === "string" && data.status.trim() ? data.status : "Bình thường",
    hpdt: typeof data.hpdt === "number" ? data.hpdt : 0,
    parentId: typeof data.parentId === "string" ? data.parentId : undefined,
    teacherId: typeof data.teacherId === "string" ? data.teacherId : undefined,
    schoolCode: typeof data.schoolCode === "string" ? data.schoolCode : undefined,
    source,
    ...data,
  };
}

async function getLearnerByIdInCollection(source: LearnerSource, learnerId: string) {
  const snap = await getDoc(doc(db, source, learnerId));
  if (!snap.exists()) return null;
  return normalizeLearner(source, snap.id, snap.data() as Record<string, unknown>);
}

async function getLearnerByParentIdInCollection(source: LearnerSource, parentId: string, preferredLearnerId?: string) {
  const snap = await getDocs(query(collection(db, source), where("parentId", "==", parentId)));
  if (snap.empty) return null;

  const learners = snap.docs.map((d) =>
    normalizeLearner(source, d.id, d.data() as Record<string, unknown>)
  );

  if (preferredLearnerId) {
    const preferred = learners.find((learner) => learner.id === preferredLearnerId);
    if (preferred) return preferred;
  }

  return learners.sort((a, b) => a.name.localeCompare(b.name, "vi"))[0];
}

async function getLearnersByTeacherInCollection(source: LearnerSource, teacherId: string, isAdmin: boolean) {
  const ref = collection(db, source);
  const q = isAdmin ? query(ref) : query(ref, where("teacherId", "==", teacherId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => normalizeLearner(source, d.id, d.data() as Record<string, unknown>));
}

function dedupeLearners(list: LearnerRecord[]) {
  const map = new Map<string, LearnerRecord>();
  for (const learner of list) {
    const existing = map.get(learner.id);
    // Prefer children document when duplicated IDs exist across collections.
    if (!existing || (existing.source === "students" && learner.source === "children")) {
      map.set(learner.id, learner);
    }
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "vi"));
}

export async function getLearnerByIdAnyCollection(learnerId: string) {
  const inChildren = await getLearnerByIdInCollection("children", learnerId);
  if (inChildren) return inChildren;
  return getLearnerByIdInCollection("students", learnerId);
}

export async function resolveLearnerForParent(parentId: string, preferredChildId?: string) {
  const legacyChildId = parentId.startsWith("PH_") ? parentId.replace("PH_", "") : undefined;

  if (preferredChildId) {
    const byPreferred = await getLearnerByIdAnyCollection(preferredChildId);
    if (byPreferred && (!byPreferred.parentId || byPreferred.parentId === parentId)) {
      return byPreferred;
    }
  }

  if (legacyChildId) {
    const byLegacyId = await getLearnerByIdAnyCollection(legacyChildId);
    if (byLegacyId && (!byLegacyId.parentId || byLegacyId.parentId === parentId)) {
      return byLegacyId;
    }
  }

  const preferredMatchId = preferredChildId || legacyChildId;

  const byParentInChildren = await getLearnerByParentIdInCollection("children", parentId, preferredMatchId);
  if (byParentInChildren) return byParentInChildren;

  const byParentInStudents = await getLearnerByParentIdInCollection("students", parentId, preferredMatchId);
  if (byParentInStudents) return byParentInStudents;

  // Last fallback for legacy IDs.
  if (legacyChildId) {
    return getLearnerByIdAnyCollection(legacyChildId);
  }

  return null;
}

export async function getLearnersForTeacher(teacherId: string, role: string) {
  const isAdmin = role === "admin";
  const [fromChildren, fromStudents] = await Promise.all([
    getLearnersByTeacherInCollection("children", teacherId, isAdmin),
    getLearnersByTeacherInCollection("students", teacherId, isAdmin),
  ]);

  return dedupeLearners([...fromChildren, ...fromStudents]);
}
