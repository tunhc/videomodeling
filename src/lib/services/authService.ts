import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import type { AppUserRole } from "@/lib/auth-session";
import { db } from "@/lib/firebase";

interface AppUserAuthRecord {
  role?: string;
  password?: string;
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

export async function loginWithUserIdPassword(input: { userId: string; password: string }) {
  const userId = input.userId.trim();
  const userRef = doc(db, "users", userId);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    throw new Error("ID người dùng không tồn tại");
  }

  const data = snap.data() as AppUserAuthRecord;
  const storedPassword = typeof data.password === "string" ? data.password : "";

  if (storedPassword) {
    if (storedPassword !== input.password) {
      throw new Error("ID hoặc mật khẩu không đúng");
    }
  } else {
    // Backfill password for legacy records that were seeded without credentials.
    await updateDoc(userRef, {
      password: input.password,
      updatedAt: serverTimestamp(),
    });
  }

  const role = normalizeRole(data.role, userId);
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
