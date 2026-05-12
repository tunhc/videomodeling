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
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  signOut as firebaseSignOut,
} from "firebase/auth";
import type { AppUserRole } from "@/lib/auth-session";
import { auth, db } from "@/lib/firebase";
import { getLearnersForTeacher } from "@/lib/services/learnerService";
import { isAdminId } from "@/lib/constants";

interface AppUserAuthRecord {
  displayName?: string;
  role?: string;
  password?: string;
  childId?: string;
  updatedAt?: unknown;
}

function isAdminAccount(userId: string) {
  return isAdminId(userId);
}

function normalizeRole(role: unknown, userId: string): AppUserRole {
  if (isAdminAccount(userId)) {
    return "admin";
  }

  const normalized = typeof role === "string" ? role.toLowerCase() : "";
  if (normalized === "parent" || normalized === "teacher" || normalized === "admin" || normalized === "professor" || normalized === "projectmanager") {
    return normalized as AppUserRole;
  }

  return userId.startsWith("PH_") ? "parent" : "teacher";
}

function routeForAccount(role: AppUserRole, _userId: string): "/parent" | "/teacher" | "/backend" {
  if (role === "admin" || role === "professor" || role === "projectmanager") return "/backend";
  if (role === "parent") return "/parent";
  return "/teacher";
}

function buildParentChildInfo(parentId: string, learnerDoc: { id: string; data: () => Record<string, unknown> }) {
  const data = learnerDoc.data();
  return {
    childId: learnerDoc.id,
    displayName: typeof data.name === "string" ? `PH ${data.name}` : parentId,
  };
}

async function findChildForParent(parentId: string) {
  const expectedChildId = parentId.startsWith("PH_") ? parentId.replace("PH_", "") : "";

  if (expectedChildId) {
    const exactInChildren = await getDoc(doc(db, "children", expectedChildId));

    if (exactInChildren.exists()) {
      const data = exactInChildren.data() as Record<string, unknown>;
      if (!data.parentId || data.parentId === parentId) {
        return buildParentChildInfo(parentId, {
          id: exactInChildren.id,
          data: () => data,
        });
      }
    }
  }

  const inChildren = await getDocs(query(collection(db, "children"), where("parentId", "==", parentId)));

  if (!inChildren.empty) {
    const preferred = expectedChildId ? inChildren.docs.find((d) => d.id === expectedChildId) : undefined;
    const chosen = preferred || [...inChildren.docs].sort((a, b) => a.id.localeCompare(b.id, "vi"))[0];
    return buildParentChildInfo(parentId, {
      id: chosen.id,
      data: () => chosen.data() as Record<string, unknown>,
    });
  }

  return null;
}

async function teacherHasAnyLearner(teacherId: string) {
  const learners = await getLearnersForTeacher(teacherId, "teacher");
  return learners.length > 0;
}

async function bootstrapUserIfMissing(userId: string, password: string) {
  // Admin IDs must be explicitly provisioned to avoid accidental role drift.
  if (isAdminAccount(userId)) {
    return null;
  }

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

  if (role === "parent") {
    const childInfo = await findChildForParent(userId);
    if (childInfo) {
      const currentChildId = typeof data.childId === "string" ? data.childId : "";
      const currentDisplayName = typeof data.displayName === "string" ? data.displayName : "";
      if (currentChildId !== childInfo.childId || currentDisplayName !== childInfo.displayName) {
        await updateDoc(userRef, {
          childId: childInfo.childId,
          displayName: childInfo.displayName,
          updatedAt: serverTimestamp(),
        });
      }
    }
  }

  return {
    userId,
    displayName: data.displayName || userId,
    role,
    homePath: routeForAccount(role, userId),
  };
}

export async function changeUserPassword(input: {
  userId: string;
  currentPassword: string;
  nextPassword: string;
  userRole?: AppUserRole;
}) {
  const userId = input.userId.trim();
  const userRef = doc(db, "users", userId);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    throw new Error("Không tìm thấy tài khoản để đổi mật khẩu");
  }

  const data = snap.data() as AppUserAuthRecord;
  const storedPassword = typeof data.password === "string" ? data.password : "";
  const currentPassword = input.currentPassword.trim();
  const resolvedRole = input.userRole || normalizeRole(data.role, userId);
  const isAdmin = resolvedRole === "admin" || isAdminAccount(userId);

  if (isAdmin) {
    if (!currentPassword || storedPassword !== currentPassword) {
      throw new Error("Mật khẩu hiện tại không đúng");
    }
  } else if (currentPassword && storedPassword && storedPassword !== currentPassword) {
    throw new Error("Mật khẩu hiện tại không đúng");
  }

  await updateDoc(userRef, {
    password: input.nextPassword,
    updatedAt: serverTimestamp(),
  });
}

// ── Firebase Auth sync ──────────────────────────────────────────────────────

function toFirebaseEmail(userId: string): string {
  return `${userId.toLowerCase().replace(/[^a-z0-9]/g, "")}@ai4autism.internal`;
}

function generateInternalPassword(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$";
  return Array.from({ length: 24 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

/**
 * Signs the user into Firebase Auth using an internal email/password stored in
 * Firestore. Creates the Firebase Auth account automatically on first login.
 * This is separate from the app password so password-sync logic never conflicts.
 */
export async function syncFirebaseAuth(userId: string): Promise<void> {
  try {
    // Wait for Firebase Auth SDK to restore its persisted session from IndexedDB.
    // auth.currentUser is null during this async restore and can't be trusted before this.
    await auth.authStateReady();

    // Already signed in — nothing to do
    if (auth.currentUser) return;

    const userRef = doc(db, "users", userId);
    const snap = await getDoc(userRef);
    const email = toFirebaseEmail(userId);
    let fbPass: string = snap.exists() ? (snap.data().firebaseAuthPassword ?? "") : "";

    if (!fbPass) {
      fbPass = generateInternalPassword();
      await updateDoc(userRef, { firebaseAuthPassword: fbPass });
    }

    try {
      await signInWithEmailAndPassword(auth, email, fbPass);
    } catch (err: any) {
      const code: string = err?.code ?? "";
      if (
        code === "auth/user-not-found" ||
        code === "auth/invalid-credential" ||
        code === "auth/invalid-login-credentials"
      ) {
        await createUserWithEmailAndPassword(auth, email, fbPass);
      } else if (code === "auth/wrong-password") {
        const newPass = generateInternalPassword();
        await updateDoc(userRef, { firebaseAuthPassword: newPass });
        await createUserWithEmailAndPassword(auth, email, newPass).catch(() =>
          signInAnonymously(auth)
        );
      } else {
        console.warn("[syncFirebaseAuth] falling back to anonymous:", err?.message);
        await signInAnonymously(auth);
      }
    }
  } catch (outer) {
    console.warn("[syncFirebaseAuth] skipped:", outer);
  }
}

export async function signOutFirebase(): Promise<void> {
  try {
    await firebaseSignOut(auth);
  } catch {
    // best-effort
  }
}
