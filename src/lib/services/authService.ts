import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import type { AppUserRole } from "@/lib/auth-session";
import { db } from "@/lib/firebase";

interface AppUserAuthRecord {
  displayName?: string;
  role?: string;
  password?: string;
  childId?: string;
  updatedAt?: unknown;
}

function normalizeRole(role: unknown, userId: string): AppUserRole {
  const normalized = typeof role === "string" ? role.toLowerCase() : "";
  if (normalized === "parent" || normalized === "teacher" || normalized === "admin") {
    return normalized;
  }

  return userId.startsWith("PH_") ? "parent" : "teacher";
}

function routeForAccount(role: AppUserRole, userId: string): "/parent" | "/teacher" {
  if (role === "parent") return "/parent";
  if (role === "admin" && userId.startsWith("PH_")) return "/parent";
  return "/teacher";
}

async function findChildForParent(parentId: string) {
  const [inChildren, inStudents] = await Promise.all([
    getDocs(query(collection(db, "children"), where("parentId", "==", parentId))),
    getDocs(query(collection(db, "students"), where("parentId", "==", parentId))),
  ]);

  if (!inChildren.empty) {
    const d = inChildren.docs[0];
    const data = d.data() as Record<string, unknown>;
    return {
      childId: d.id,
      displayName: typeof data.name === "string" ? `PH ${data.name}` : parentId,
    };
  }

  if (!inStudents.empty) {
    const d = inStudents.docs[0];
    const data = d.data() as Record<string, unknown>;
    return {
      childId: d.id,
      displayName: typeof data.name === "string" ? `PH ${data.name}` : parentId,
    };
  }

  return null;
}

async function teacherHasAnyLearner(teacherId: string) {
  const [inChildren, inStudents] = await Promise.all([
    getDocs(query(collection(db, "children"), where("teacherId", "==", teacherId))),
    getDocs(query(collection(db, "students"), where("teacherId", "==", teacherId))),
  ]);
  return !inChildren.empty || !inStudents.empty;
}

async function bootstrapUserIfMissing(userId: string, password: string) {
  if (userId.startsWith("PH_")) {
    const childInfo = await findChildForParent(userId);
    if (!childInfo) return null;

    await setDoc(
      doc(db, "users", userId),
      {
        role: "parent",
        childId: childInfo.childId,
        displayName: childInfo.displayName,
        password,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return getDoc(doc(db, "users", userId));
  }

  if (userId.startsWith("GV_")) {
    const hasLearners = await teacherHasAnyLearner(userId);
    if (!hasLearners) return null;

    await setDoc(
      doc(db, "users", userId),
      {
        role: "teacher",
        displayName: userId,
        password,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return getDoc(doc(db, "users", userId));
  }

  return null;
}

export async function loginWithUserIdPassword(input: { userId: string; password: string }) {
  const userId = input.userId.trim();
  const userRef = doc(db, "users", userId);
  let snap = await getDoc(userRef);

  if (!snap.exists()) {
    const bootstrapped = await bootstrapUserIfMissing(userId, input.password);
    if (bootstrapped) {
      snap = bootstrapped;
    }
  }

  if (!snap.exists()) {
    throw new Error("ID người dùng không tồn tại");
  }

  const data = snap.data() as AppUserAuthRecord;
  const storedPassword = typeof data.password === "string" ? data.password : "";

  const role = normalizeRole(data.role, userId);

  if (role === "admin") {
    if (!storedPassword || storedPassword !== input.password) {
      throw new Error("ID hoặc mật khẩu không đúng");
    }
  } else if (!storedPassword || storedPassword !== input.password) {
    // Convenience mode for parent/teacher: sync password to the latest provided value.
    await updateDoc(userRef, {
      password: input.password,
      updatedAt: serverTimestamp(),
    });
  }

  return {
    userId,
    role,
    homePath: routeForAccount(role, userId),
  };
}

export async function changeUserPassword(input: {
  userId: string;
  currentPassword: string;
  nextPassword: string;
}) {
  const userRef = doc(db, "users", input.userId.trim());
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    throw new Error("Không tìm thấy tài khoản để đổi mật khẩu");
  }

  const data = snap.data() as AppUserAuthRecord;
  const storedPassword = typeof data.password === "string" ? data.password : "";

  if (storedPassword && storedPassword !== input.currentPassword) {
    throw new Error("Mật khẩu hiện tại không đúng");
  }

  await updateDoc(userRef, {
    password: input.nextPassword,
    updatedAt: serverTimestamp(),
  });
}
